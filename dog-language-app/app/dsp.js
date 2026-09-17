/* BarkLens DSP — 순수 신호처리 + 해석 엔진 (DOM 의존 없음)
 * 브라우저에서는 전역 BarkDSP, Node에서는 module.exports 로 노출됩니다.
 *
 * 파이프라인
 *   샘플(Float32) → 프레임 에너지(dB) → 이벤트(짖음) 검출 → 이벤트별 특징
 *   (길이 · 기본주파수 F0 · 조화도(맑기) · 스펙트럼 중심 · 평탄도)
 *   → 연속 짖음(바우트) 간격 → 3축 지문(음높이 · 음색 · 리듬)
 *   → 맥락 점수(외로움 · 경계 · 놀이 · 요구 · 두려움) + 근거 문장
 *
 * 규칙은 논문에서 반복 확인된 관계만 사용합니다 (docs/02_리서치_논문정리.md 참고).
 *   - 낮은 음 + 거친 음색 + 빠른 반복 → 경계/공격 (Yin & McCowan 2004; Pongrácz 2005/2006)
 *   - 높은 음 + 긴 간격 → 두려움/절망, 고립 (Pongrácz 2006; Yin & McCowan 2004)
 *   - 높은 음 + 맑은 음색 + 짧은 간격 → 놀이/기쁨 (Pongrácz 2006)
 *   - 짧은 소리일수록 긍정, 높을수록 강렬 (Faragó 2014)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.BarkDSP = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- 기초 수학 ---------------- */
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function log2(x) { return Math.log(x) / Math.LN2; }
  function median(arr) {
    if (!arr.length) return NaN;
    const a = Array.from(arr).sort((p, q) => p - q);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function percentile(arr, p) {
    if (!arr.length) return NaN;
    const a = Array.from(arr).sort((x, y) => x - y);
    return a[clamp(Math.round((a.length - 1) * p), 0, a.length - 1)];
  }
  function mean(arr) {
    if (!arr.length) return NaN;
    let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  /* ---------------- FFT (radix-2, in-place) ---------------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const vr = re[b] * cr - im[b] * ci;
          const vi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  const windowCache = {};
  function hann(n) {
    if (windowCache[n]) return windowCache[n];
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, n - 1));
    return (windowCache[n] = w);
  }
  /** 프레임의 진폭 스펙트럼 (nfft/2 bins) */
  function magnitudeSpectrum(frame, nfft) {
    nfft = nfft || 2048;
    const re = new Float32Array(nfft), im = new Float32Array(nfft);
    const n = Math.min(frame.length, nfft);
    const w = hann(n);
    for (let i = 0; i < n; i++) re[i] = frame[i] * w[i];
    fft(re, im);
    const mags = new Float32Array(nfft >> 1);
    for (let i = 0; i < mags.length; i++) mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    return mags;
  }

  /* ---------------- 에너지 ---------------- */
  function rmsDb(samples, start, end) {
    let s = 0; const n = Math.max(1, end - start);
    for (let i = start; i < end; i++) s += samples[i] * samples[i];
    return 20 * Math.log10(Math.sqrt(s / n) + 1e-9);
  }

  /* ---------------- 기본주파수: NSDF (McLeod & Wyvill) ---------------- */
  function pitchNSDF(frame, sr, fmin, fmax) {
    fmin = fmin || 60; fmax = fmax || 3000;
    const n = frame.length;
    const tauMin = Math.max(2, Math.floor(sr / fmax));
    const tauMax = Math.min(n - 2, Math.ceil(sr / fmin));
    if (tauMax <= tauMin + 2) return { f0: 0, clarity: 0 };
    const nsdf = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let acf = 0, m = 0;
      for (let i = 0, j = tau; j < n; i++, j++) {
        const a = frame[i], b = frame[j];
        acf += a * b; m += a * a + b * b;
      }
      nsdf[tau] = m > 0 ? 2 * acf / m : 0;
    }
    // 첫 양의 구간(0-lag 주변)을 지나 양의 구간마다 최대점을 후보로
    const peaks = [];
    let tau = 1;
    while (tau <= tauMax && nsdf[tau] > 0) tau++;
    while (tau <= tauMax) {
      while (tau <= tauMax && nsdf[tau] <= 0) tau++;
      let best = -1, bestV = -Infinity;
      while (tau <= tauMax && nsdf[tau] > 0) {
        if (nsdf[tau] > bestV) { bestV = nsdf[tau]; best = tau; }
        tau++;
      }
      if (best >= tauMin) peaks.push({ tau: best, v: bestV });
    }
    if (!peaks.length) return { f0: 0, clarity: 0 };
    let maxV = -Infinity;
    for (const p of peaks) if (p.v > maxV) maxV = p.v;
    const chosen = peaks.find(p => p.v >= 0.9 * maxV) || peaks[0];
    let t = chosen.tau;
    if (t > 1 && t < tauMax) {
      const a = nsdf[t - 1], b = nsdf[t], c = nsdf[t + 1];
      const denom = a - 2 * b + c;
      if (denom !== 0) t += 0.5 * (a - c) / denom;
    }
    return { f0: sr / t, clarity: clamp(chosen.v, 0, 1) };
  }

  /* ---------------- 스펙트럼 특징 ---------------- */
  function spectralFeatures(frame, sr) {
    const nfft = 2048;
    const mags = magnitudeSpectrum(frame, nfft);
    const binHz = sr / nfft;
    const edges = [500, 1000, 2000, 4000, Infinity];
    const bands = [0, 0, 0, 0, 0];
    let sum = 0, wsum = 0, logSum = 0, sum8k = 0, cnt = 0;
    for (let i = 1; i < mags.length; i++) {
      const f = i * binHz, p = mags[i] * mags[i];
      sum += p; wsum += p * f;
      if (f <= 8000) { logSum += Math.log(p + 1e-12); sum8k += p; cnt++; }
      for (let b = 0; b < 5; b++) if (f < edges[b]) { bands[b] += p; break; }
    }
    const centroid = sum > 0 ? wsum / sum : 0;
    const flatness = cnt ? Math.exp(logSum / cnt) / (sum8k / cnt + 1e-12) : 0;
    let acc = 0, rolloff = 0;
    for (let i = 1; i < mags.length; i++) {
      acc += mags[i] * mags[i];
      if (acc >= 0.85 * sum) { rolloff = i * binHz; break; }
    }
    const bt = bands.reduce((a, b) => a + b, 0) || 1;
    return { centroid, flatness: clamp(flatness, 0, 1), rolloff, bands: bands.map(b => b / bt) };
  }

  /* ---------------- 이벤트(짖음) 검출기: 스트리밍 ---------------- */
  /**
   * createDetector({sr}) → det.push(Float32Array) → 완료된 이벤트 배열
   * 이벤트: { start, end (샘플 인덱스, 절대), peakDb, meanDb, floorDb, snr }
   */
  function createDetector(userOpts) {
    const o = Object.assign({
      sr: 48000, frameMs: 20, hopMs: 10,
      onsetDb: 12,      // 잡음 바닥 대비 시작 문턱
      offsetDb: 6,      // 잡음 바닥 대비 종료 문턱 (히스테리시스)
      absMinDb: -52,    // 절대 최소 레벨(dBFS)
      minDurMs: 40, maxDurMs: 4000,
      hangMs: 50,       // 종료 판정 지연
      mergeGapMs: 30,   // 이보다 짧은 끊김은 하나로 병합
      floorWindowSec: 6
    }, userOpts || {});
    const sr = o.sr;
    const frameLen = Math.round(sr * o.frameMs / 1000);
    const hop = Math.round(sr * o.hopMs / 1000);
    const hangMax = Math.max(1, Math.round(o.hangMs / o.hopMs));
    const maxHist = Math.round(o.floorWindowSec * 1000 / o.hopMs);
    const mergeGap = Math.round(o.mergeGapMs * sr / 1000);

    let residual = new Float32Array(0);
    let residualBase = 0;      // residual[0]의 절대 샘플 인덱스
    let frameIdx = 0;          // 다음에 계산할 프레임 번호
    const hist = new Float32Array(maxHist); let histN = 0, histPos = 0;
    let floor = -60, floorTick = 0;
    let inEvent = false, evStartFrame = 0, hang = 0;
    let evDbs = [];
    let pending = null;
    const out = [];

    function recomputeFloor() {
      const n = histN;
      if (!n) return;
      const arr = Array.from(hist.subarray(0, n));
      floor = percentile(arr, 0.2);
    }
    /** 이벤트 내부의 에너지 골짜기(≥ dropDb 하강 후 재상승)에서 분할 → 경계 프레임 인덱스들 */
    function splitByDips(dbs, dropDb) {
      const cuts = [];
      let runMax = dbs[0], runMaxAt = 0, minV = Infinity, minAt = -1;
      for (let i = 1; i < dbs.length; i++) {
        const v = dbs[i];
        if (minAt < 0) {
          if (v > runMax) { runMax = v; runMaxAt = i; }
          else if (v < runMax - dropDb) { minV = v; minAt = i; }
        } else {
          if (v < minV) { minV = v; minAt = i; }
          else if (v > minV + dropDb) {          // 재상승: 골짜기에서 자름
            if (minAt - (cuts.length ? cuts[cuts.length - 1] : 0) >= 3 && i - minAt >= 1) cuts.push(minAt);
            runMax = v; runMaxAt = i; minV = Infinity; minAt = -1;
          }
        }
      }
      return cuts;
    }
    function emit(startFrame, endFrame, dbs) {
      const start = Math.max(0, startFrame * hop - hop);
      const end = endFrame * hop + frameLen;
      if ((end - start) / sr * 1000 < o.minDurMs) return;
      let peak = -Infinity, sum = 0;
      for (const v of dbs) { if (v > peak) peak = v; sum += v; }
      const ev = { start, end, peakDb: peak, meanDb: sum / Math.max(1, dbs.length), floorDb: floor, snr: peak - floor };
      if (pending && start - pending.end <= mergeGap) {
        pending.end = end;
        pending.peakDb = Math.max(pending.peakDb, ev.peakDb);
        pending.snr = pending.peakDb - pending.floorDb;
      } else {
        if (pending) out.push(pending);
        pending = ev;
      }
    }
    function finish(endFrame) {
      inEvent = false;
      const nFrames = Math.max(1, endFrame - evStartFrame + 1);
      const dbs = evDbs.slice(0, nFrames);
      const cuts = dbs.length >= 8 ? splitByDips(dbs, 9) : [];
      let s = 0;
      for (const c of cuts) { emit(evStartFrame + s, evStartFrame + c - 1, dbs.slice(s, c)); s = c; }
      emit(evStartFrame + s, endFrame, dbs.slice(s));
      evDbs = [];
    }
    function processFrame(db, fi) {
      hist[histPos] = db; histPos = (histPos + 1) % maxHist; if (histN < maxHist) histN++;
      if (++floorTick >= 25) { floorTick = 0; recomputeFloor(); }
      const onset = Math.max(floor + o.onsetDb, o.absMinDb);
      const offset = Math.max(floor + o.offsetDb, o.absMinDb - 6);
      if (!inEvent) {
        if (db > onset) { inEvent = true; evStartFrame = fi; hang = 0; evDbs = [db]; }
      } else {
        evDbs.push(db);
        if (db > offset) hang = 0; else hang++;
        const durMs = (fi - evStartFrame) * o.hopMs;
        if (hang >= hangMax) finish(fi - hang);
        else if (durMs >= o.maxDurMs) finish(fi);
      }
      if (pending && !inEvent && fi * hop - pending.end > mergeGap) { out.push(pending); pending = null; }
    }
    return {
      sr, frameLen, hop,
      get floorDb() { return floor; },
      push(chunk) {
        const merged = new Float32Array(residual.length + chunk.length);
        merged.set(residual, 0); merged.set(chunk, residual.length);
        let pos = 0;
        while (pos + frameLen <= merged.length) {
          processFrame(rmsDb(merged, pos, pos + frameLen), frameIdx++);
          pos += hop;
        }
        residual = merged.subarray(pos);
        residualBase += pos;
        const done = out.splice(0, out.length);
        return done;
      },
      /** 남은 이벤트를 강제 종료·반환 (파일 분석 끝에서 호출) */
      flush() {
        if (inEvent) finish(frameIdx);
        if (pending) { out.push(pending); pending = null; }
        return out.splice(0, out.length);
      }
    };
  }

  /* ---------------- 이벤트 특징 추출 ---------------- */
  function analyzeSegment(seg, sr, meta) {
    meta = meta || {};
    const win = Math.round(0.04 * sr), step = Math.round(0.01 * sr);
    let s = seg;
    if (s.length < win) { const p = new Float32Array(win); p.set(s); s = p; }
    const frames = [];
    for (let i = 0; i + win <= s.length; i += step) frames.push({ s: i, db: rmsDb(s, i, i + win) });
    let peak = frames[0];
    for (const f of frames) if (f.db > peak.db) peak = f;
    let voiced = frames.filter(f => f.db >= peak.db - 10);
    if (voiced.length > 12) {
      const stepN = voiced.length / 12; const pick = [];
      for (let i = 0; i < 12; i++) pick.push(voiced[Math.floor(i * stepN)]);
      voiced = pick;
    }
    const f0s = [], clars = [];
    for (const f of voiced) {
      const p = pitchNSDF(s.subarray(f.s, f.s + win), sr, 60, 3000);
      clars.push(p.clarity);
      if (p.f0 > 0 && p.clarity > 0.38) f0s.push(p.f0);
    }
    const f0 = f0s.length ? median(f0s) : 0;
    let f0Range = 0;
    if (f0s.length >= 2) {
      const mx = Math.max.apply(null, f0s), mn = Math.min.apply(null, f0s);
      f0Range = 12 * log2(mx / mn);
    }
    const specStart = clamp(peak.s - (2048 - win) / 2, 0, Math.max(0, s.length - 2048));
    const spec = spectralFeatures(s.subarray(specStart, Math.min(s.length, specStart + 2048)), sr);
    return {
      durationMs: Math.round(seg.length / sr * 1000),
      f0: Math.round(f0), f0Range: Math.round(f0Range * 10) / 10,
      clarity: Math.round(mean(clars) * 100) / 100,
      centroid: Math.round(spec.centroid), flatness: Math.round(spec.flatness * 1000) / 1000,
      rolloff: Math.round(spec.rolloff), bands: spec.bands,
      peakDb: meta.peakDb != null ? Math.round(meta.peakDb) : Math.round(peak.db),
      snr: meta.snr != null ? Math.round(meta.snr) : null
    };
  }

  /* ---------------- 바우트(연속 짖음) ---------------- */
  const BOUT_GAP_SEC = 4.0;   // 이 간격 안의 짖음은 한 바우트(연속 짖음)로 묶음
  function groupBouts(events, sr, gapSec) {
    gapSec = gapSec || BOUT_GAP_SEC;
    const bouts = [];
    let cur = null;
    for (const ev of events) {
      if (cur && (ev.start - cur.end) / sr <= gapSec) { cur.events.push(ev); cur.end = ev.end; }
      else { cur = { start: ev.start, end: ev.end, events: [ev] }; bouts.push(cur); }
    }
    for (const b of bouts) Object.assign(b, boutStats(b.events, sr));
    return bouts;
  }
  function boutStats(events, sr) {
    const ibis = [];
    for (let i = 1; i < events.length; i++) ibis.push((events[i].start - events[i - 1].start) / sr);
    const durationSec = events.length ? (events[events.length - 1].end - events[0].start) / sr : 0;
    return {
      count: events.length,
      ibiMedian: ibis.length ? Math.round(median(ibis) * 100) / 100 : 0,
      durationSec: Math.round(durationSec * 10) / 10,
      rate: durationSec > 0 ? Math.round(events.length / durationSec * 10) / 10 : 0
    };
  }

  /* ---------------- 소리 종류 ---------------- */
  function classifyCallType(f) {
    const d = f.durationMs, f0 = f.f0, c = f.clarity;
    if (!f0 || c < 0.3) return (d > 300 && f.centroid < 1000) ? 'growl' : 'bark';
    if (f0 < 250 && d > 250) return 'growl';
    if ((c > 0.7 && f0 > 900 && d > 400) || (c > 0.6 && f0 > 1200 && d > 300)) return 'whine';
    if (c > 0.55 && d > 800 && f0 >= 250 && f0 <= 1500) return 'howl';
    if (d < 110 && f0 > 700) return 'yip';
    return 'bark';
  }
  const CALL_TYPES = {
    bark: { label: '짖음', note: '짧고 폭발적인 소리. 맥락에 따라 음높이·음색·리듬이 크게 달라집니다.' },
    yip: { label: '깽 (짧은 고음)', note: '매우 짧고 높은 소리. 놀람·통증·흥분에서 나옵니다.' },
    whine: { label: '낑낑 (휘파람 소리)', note: '길고 맑은 고음. 분리 상황에서는 두려움과 연관됩니다 (Lenkei 2021).' },
    growl: { label: '으르렁', note: '낮고 거친 지속음. 위협 외에 놀이 으르렁도 있어 상황을 함께 봐야 합니다 (Faragó 2017).' },
    howl: { label: '하울링', note: '길고 맑은 중음. 멀리 있는 대상과의 접촉·고립 맥락에서 나옵니다.' }
  };

  /* ---------------- 맥락 정의 ---------------- */
  const CONTEXTS = [
    { key: 'isolation', label: '외로움 · 분리', short: '외로움', target: { pitch: 0.72, tonality: 0.75, tempo: 0.15 },
      advice: '혼자 있을 때 반복되면 분리 관련 문제의 신호일 수 있습니다. 외출 전 산책·노즈워크로 에너지를 빼고, 짧은 부재부터 연습하세요.' },
    { key: 'alarm', label: '경계 · 위협', short: '경계', target: { pitch: 0.2, tonality: 0.25, tempo: 0.85 },
      advice: '무언가를 위협으로 느끼고 있습니다. 자극(창밖·초인종)을 확인하고, 짖음이 멈춘 순간을 보상해 "알렸으니 됐다"를 가르치세요.' },
    { key: 'play', label: '놀이 · 흥분', short: '놀이', target: { pitch: 0.7, tonality: 0.65, tempo: 0.7 },
      advice: '긍정적인 흥분입니다. 놀이 규칙(앉으면 던지기)을 넣어 흥분이 과해지지 않게 조절하세요.' },
    { key: 'demand', label: '요구 · 관심', short: '요구', target: { pitch: 0.55, tonality: 0.55, tempo: 0.45 },
      advice: '원하는 것이 있습니다(밥·산책·놀이). 짖을 때 주면 강화되니, 조용해진 뒤에 원하는 것을 주세요.' },
    { key: 'fear', label: '두려움 · 불안', short: '두려움', target: { pitch: 0.8, tonality: 0.3, tempo: 0.25 },
      advice: '무섭거나 불안한 상태입니다. 자극과 거리를 두고, 안전한 공간을 주세요. 반복되면 행동 전문가와 상담하세요.' }
  ];
  const CALLTYPE_PRIOR = {
    bark: {},
    yip: { play: 1.4, fear: 1.25, demand: 1.1, isolation: 0.8, alarm: 0.6 },
    whine: { isolation: 1.6, fear: 1.5, demand: 1.2, alarm: 0.35, play: 0.7 },
    growl: { alarm: 1.8, play: 1.1, fear: 0.9, isolation: 0.3, demand: 0.5 },
    howl: { isolation: 1.8, fear: 0.9, demand: 0.8, alarm: 0.5, play: 0.5 }
  };
  const SIZE_BASE_F0 = { small: 850, medium: 600, large: 420 };

  /* ---------------- 3축 지문 ---------------- */
  function computeAxes(f, seq, profile) {
    const base = (profile && profile.baseF0) || SIZE_BASE_F0[(profile && profile.size) || 'medium'] || 600;
    // F0를 못 잡은 거친 소리는 스펙트럼 중심으로 음높이를 대략 추정(가중치는 낮춤)
    const pitchKnown = f.f0 > 0;
    const pitch = pitchKnown ? clamp(0.5 + 0.5 * log2(f.f0 / base), 0, 1)
      : (f.centroid > 0 ? clamp(0.5 + 0.5 * log2(f.centroid / (base * 2.2)), 0, 1) : 0.5);
    const clarN = clamp((f.clarity - 0.3) / 0.6, 0, 1);
    const flatN = clamp((f.flatness - 0.02) / 0.3, 0, 1);
    const tonality = clamp(0.7 * clarN + 0.3 * (1 - flatN), 0, 1);
    let tempo, tempoKnown = true;
    if (seq && seq.ibiMedian > 0) tempo = clamp(1 - log2(seq.ibiMedian / 0.2) / log2(2.5 / 0.2), 0, 1);
    else { tempo = 0.2; tempoKnown = false; }
    return { pitch, pitchKnown, tonality, tempo, tempoKnown, baseF0: base };
  }

  /* ---------------- 해석 ---------------- */
  function interpret(f, seq, profile) {
    const axes = computeAxes(f, seq, profile);
    const callType = classifyCallType(f);
    const sigma = 0.28;
    const w = { pitch: axes.pitchKnown ? 1 : 0.5, tonality: 0.8, tempo: axes.tempoKnown ? 1 : 0.35 };
    const prior = CALLTYPE_PRIOR[callType] || {};
    let raw = CONTEXTS.map(c => {
      let d2 = 0, ws = 0;
      for (const k of ['pitch', 'tonality', 'tempo']) { const d = axes[k] - c.target[k]; d2 += w[k] * d * d; ws += w[k]; }
      const s = Math.exp(-(d2 / ws) / (2 * sigma * sigma)) * (prior[c.key] || 1);
      return { key: c.key, label: c.label, short: c.short, score: s };
    });
    const total = raw.reduce((a, c) => a + c.score, 0) || 1;
    raw = raw.map(c => Object.assign(c, { p: c.score / total }));
    const sorted = raw.slice().sort((a, b) => b.p - a.p);
    const top = sorted[0], second = sorted[1];
    const marginN = clamp((top.p - second.p) / 0.3, 0, 1);
    const evidence = clamp((seq && seq.count ? seq.count : 1) / 4, 0, 1);
    const snrN = f.snr != null ? clamp((f.snr - 8) / 20, 0, 1) : 0.6;
    const confidence = clamp(0.45 * marginN + 0.3 * evidence + 0.25 * snrN, 0, 1);
    return {
      callType, callTypeLabel: CALL_TYPES[callType].label, axes,
      contexts: raw, top, confidence: Math.round(confidence * 100) / 100,
      reasons: buildReasons(f, seq, axes, callType)
    };
  }

  function buildReasons(f, seq, axes, callType) {
    const r = [];
    const base = axes.baseF0;
    if (f.f0 > 0) {
      const st = Math.round(12 * log2(f.f0 / base));
      const lvl = axes.pitch < 0.35 ? '낮음' : axes.pitch > 0.65 ? '높음' : '보통';
      r.push({ k: '음높이', v: `${f.f0} Hz (기준 ${base} Hz 대비 ${st >= 0 ? '+' : ''}${st} 반음)`, lvl,
        note: lvl === '낮음' ? '낮은 음은 경계·위협 맥락에서 흔하고 사람도 공격적으로 평가합니다.'
          : lvl === '높음' ? '높은 음은 놀이·외로움·두려움 맥락에서 흔하고 더 강렬하게 들립니다.'
          : '기준 음역 근처입니다. 음색과 리듬이 판단을 좌우합니다.' });
    } else {
      r.push({ k: '음높이', v: '측정 불가 (잡음 성분이 큼)', lvl: '거침', note: '음높이가 잡히지 않을 만큼 거친 소리는 경계·위협 쪽 단서입니다.' });
    }
    const tl = axes.tonality < 0.35 ? '거침' : axes.tonality > 0.65 ? '맑음' : '보통';
    r.push({ k: '음색(조화도)', v: `${Math.round(axes.tonality * 100)} / 100 (맑기 ${f.clarity}, 평탄도 ${f.flatness})`, lvl: tl,
      note: tl === '거침' ? '잡음이 많은 거친 소리는 방해·경계 상황의 특징입니다 (Yin & McCowan 2004).'
        : tl === '맑음' ? '배음이 또렷한 맑은 소리는 놀이·고립 상황에서 더 많습니다.'
        : '중간 음색입니다.' });
    if (seq && seq.ibiMedian > 0) {
      const lvl = seq.ibiMedian < 0.35 ? '빠름' : seq.ibiMedian > 1.2 ? '느림' : '보통';
      r.push({ k: '반복 간격', v: `${seq.ibiMedian} 초 (연속 ${seq.count}회)`, lvl,
        note: lvl === '빠름' ? '빠르게 몰아치는 반복은 공격성·경계로 평가됩니다 (Pongrácz 2005).'
          : lvl === '느림' ? '띄엄띄엄 이어지는 짖음은 두려움·절망, 혼자 남겨진 상황과 연관됩니다.'
          : '보통 빠르기의 반복입니다.' });
    } else {
      r.push({ k: '반복 간격', v: '단발 (연속 짖음 없음)', lvl: '단발', note: '리듬 정보가 없어 확신이 낮습니다. 연속 짖음이 들어오면 판단이 갱신됩니다.' });
    }
    const dl = f.durationMs < 150 ? '짧음' : f.durationMs > 450 ? '김' : '보통';
    r.push({ k: '길이', v: `${f.durationMs} ms`, lvl: dl,
      note: dl === '짧음' ? '짧은 소리는 더 긍정적으로 평가됩니다 (Faragó 2014).' : dl === '김' ? '긴 소리는 낑낑·하울링·으르렁 계열일 수 있습니다.' : '전형적인 짖음 길이입니다.' });
    if (f.f0Range >= 3) r.push({ k: '음높이 변화', v: `${f.f0Range} 반음`, lvl: '변조', note: '음이 오르내리는 변조는 놀이·고립 짖음의 특징입니다 (Yin & McCowan 2004).' });
    if (callType !== 'bark') r.push({ k: '소리 종류', v: CALL_TYPES[callType].label, lvl: '분류', note: CALL_TYPES[callType].note });
    return r;
  }

  /* ---------------- 파일/버퍼 전체 분석 ---------------- */
  function analyzeBuffer(samples, sr, profile, opts) {
    const det = createDetector(Object.assign({ sr }, opts || {}));
    const chunk = 8192;
    let events = [];
    for (let i = 0; i < samples.length; i += chunk) events = events.concat(det.push(samples.subarray(i, Math.min(samples.length, i + chunk))));
    events = events.concat(det.flush());
    const bouts = groupBouts(events, sr);
    const results = [];
    for (const b of bouts) {
      const seq = boutStats(b.events, sr);
      for (const ev of b.events) {
        const f = analyzeSegment(samples.subarray(ev.start, ev.end), sr, ev);
        results.push({ event: ev, features: f, seq, result: interpret(f, seq, profile), tSec: ev.start / sr });
      }
    }
    return { events, bouts, results, floorDb: det.floorDb };
  }

  /* ---------------- STFT (정적 스펙트로그램용) ---------------- */
  function stft(samples, sr, nfft, hop, maxHz) {
    nfft = nfft || 1024; hop = hop || 512; maxHz = maxHz || 8000;
    const bins = Math.min(nfft >> 1, Math.ceil(maxHz / (sr / nfft)));
    const cols = [];
    for (let i = 0; i + nfft <= samples.length; i += hop) {
      const m = magnitudeSpectrum(samples.subarray(i, i + nfft), nfft);
      const col = new Float32Array(bins);
      for (let b = 0; b < bins; b++) col[b] = 20 * Math.log10(m[b] + 1e-6);
      cols.push(col);
    }
    return { cols, bins, binHz: sr / nfft, hopSec: hop / sr };
  }

  /* ---------------- 합성(데모·테스트) ---------------- */
  function synthBout(sr, spec) {
    const s = Object.assign({ f0: 600, f0Jitter: 0.05, noise: 0.3, durationMs: 200, count: 4, ibiSec: 0.4,
      ibiJitter: 0.1, modulation: 0, attackMs: 8, level: 0.5, lead: 0.4, tail: 0.6, seed: 7 }, spec || {});
    let seed = s.seed >>> 0 || 1;
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    const total = Math.ceil((s.lead + (s.count - 1) * s.ibiSec * (1 + s.ibiJitter) + s.durationMs / 1000 * 1.3 + s.tail) * sr);
    const out = new Float32Array(total);
    let t0 = s.lead * sr;
    const attack = Math.max(1, s.attackMs / 1000 * sr);
    const nh = 14;
    let hnorm = 0; for (let h = 1; h <= nh; h++) hnorm += 1 / h;
    for (let k = 0; k < s.count; k++) {
      const start = Math.round(t0);
      const len = Math.round(s.durationMs / 1000 * sr * (1 + (rand() - 0.5) * 0.2));
      const f0k = s.f0 * (1 + (rand() - 0.5) * 2 * s.f0Jitter);
      let phase = 0, lp = 0;
      for (let i = 0; i < len && start + i < total; i++) {
        const t = i / len;
        const env = Math.min(1, i / attack) * Math.exp(-2.4 * t);
        const f = f0k * Math.pow(2, s.modulation * Math.sin(Math.PI * t) / 12);
        phase += 2 * Math.PI * f / sr;
        let harm = 0;
        for (let h = 1; h <= nh; h++) harm += Math.sin(h * phase) / h;
        harm /= hnorm;
        const white = (rand() - 0.5) * 2;
        lp = 0.6 * lp + 0.4 * white;           // 약간 저역 쪽으로 기운 잡음
        const sample = (1 - s.noise) * harm * 1.4 + s.noise * (white * 0.5 + lp * 0.5) * 0.9;
        out[start + i] += sample * env * s.level;
      }
      t0 += s.ibiSec * (1 + (rand() - 0.5) * 2 * s.ibiJitter) * sr;
    }
    return out;
  }
  function concatBuffers(list, sr, gapSec) {
    const gap = Math.round((gapSec || 1.5) * sr);
    let n = 0; for (const b of list) n += b.length + gap;
    const out = new Float32Array(n); let pos = 0;
    for (const b of list) { out.set(b, pos); pos += b.length + gap; }
    return out;
  }
  const DEMO_SCENES = {
    alarm: { label: '초인종에 경계', spec: { f0: 330, noise: 0.5, durationMs: 150, count: 7, ibiSec: 0.3, ibiJitter: 0.08, modulation: 0.5, level: 0.55, seed: 11 } },
    play: { label: '공놀이 흥분', spec: { f0: 820, noise: 0.14, durationMs: 140, count: 5, ibiSec: 0.5, ibiJitter: 0.35, modulation: 4, level: 0.45, seed: 23 } },
    isolation: { label: '혼자 남겨짐', spec: { f0: 900, noise: 0.1, durationMs: 300, count: 3, ibiSec: 2.3, ibiJitter: 0.15, modulation: 2, level: 0.42, seed: 5 } },
    whine: { label: '낑낑거림', spec: { f0: 1500, noise: 0.05, durationMs: 900, count: 2, ibiSec: 1.6, modulation: 3, level: 0.3, attackMs: 40, seed: 9 } },
    growl: { label: '낮은 으르렁', spec: { f0: 110, noise: 0.45, durationMs: 1200, count: 1, ibiSec: 1, modulation: 0, level: 0.4, attackMs: 60, seed: 3 } }
  };

  return {
    clamp, median, percentile, mean, log2,
    fft, magnitudeSpectrum, rmsDb, pitchNSDF, spectralFeatures,
    createDetector, analyzeSegment, groupBouts, boutStats, BOUT_GAP_SEC,
    classifyCallType, CALL_TYPES, CONTEXTS, SIZE_BASE_F0,
    computeAxes, interpret, analyzeBuffer, stft,
    synthBout, concatBuffers, DEMO_SCENES
  };
});
