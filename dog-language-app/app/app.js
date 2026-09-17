/* BarkLens 앱 — UI · 오디오 입력 · 시각화 · 저장 (엔진은 dsp.js, 지식은 knowledge.js) */
(function () {
  'use strict';
  const DSP = window.BarkDSP, K = window.BarkKnowledge;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ---------- 저장 (브라우저 로컬, 실패해도 동작) ---------- */
  function load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 저장 불가 환경 */ } }

  const CTX_COLOR = { isolation: 'var(--c-isolation)', alarm: 'var(--c-alarm)', play: 'var(--c-play)', demand: 'var(--c-demand)', fear: 'var(--c-fear)', other: 'var(--muted)' };
  const CTX_BY_KEY = {}; DSP.CONTEXTS.forEach(c => { CTX_BY_KEY[c.key] = c; });
  const SIZE_LABEL = { small: '소형', medium: '중형', large: '대형' };

  const state = {
    profile: Object.assign({ name: '', size: 'medium', autoBase: true, sensitivity: 12 }, load('barklens.profile.v1', {})),
    log: load('barklens.log.v1', []),
    session: [],            // 이번 세션 이벤트(판독 포함)
    bout: null,             // 현재 바우트 {events, lastEnd}
    listening: false,
    mode: 'idle',           // idle | live | file | demo
    current: null           // 화면에 표시 중인 판독
  };

  /* ---------- 프로필 ---------- */
  function effectiveProfile() {
    const p = { size: state.profile.size };
    if (state.profile.autoBase) {
      const f0s = state.log.filter(e => e.callType === 'bark' && e.features && e.features.f0 > 0).map(e => e.features.f0);
      if (f0s.length >= 10) p.baseF0 = Math.round(DSP.median(f0s.slice(-60)));
    }
    return p;
  }
  function renderProfile() {
    const p = state.profile;
    $('#dogChipText').textContent = `${p.name || '우리 강아지'} · ${SIZE_LABEL[p.size]}`;
    $('#dogName').value = p.name; $('#dogSize').value = p.size; $('#autoBase').checked = !!p.autoBase;
    $('#sensitivity').value = p.sensitivity; $('#sensV').textContent = `${p.sensitivity} dB`;
    const ep = effectiveProfile();
    $('#baseInfo').textContent = ep.baseF0
      ? `학습된 기준 음역: ${ep.baseF0} Hz (기록된 짖음 ${state.log.filter(e => e.callType === 'bark').length}회 기준)`
      : `현재 기준 음역: ${DSP.SIZE_BASE_F0[p.size]} Hz (몸집 기본값). 짖음 10회 이상 기록되면 자동으로 보정됩니다.`;
  }
  $('#profileForm').addEventListener('input', () => {
    state.profile.name = $('#dogName').value.trim();
    state.profile.size = $('#dogSize').value;
    state.profile.autoBase = $('#autoBase').checked;
    state.profile.sensitivity = +$('#sensitivity').value;
    save('barklens.profile.v1', state.profile);
    renderProfile();
    if (det) det.onsetDb = state.profile.sensitivity;
  });
  $('#dogChip').addEventListener('click', () => showTab('settings'));

  /* ---------- 탭 ---------- */
  function showTab(name) {
    $$('.tab').forEach(s => { s.hidden = s.id !== `tab-${name}`; });
    $$('.tabbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
    save('barklens.tab', name);
    if (name === 'log') renderLog();
    if (name === 'settings') renderProfile();
    window.scrollTo({ top: 0 });
  }
  $$('.tabbtn').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- 스펙트로그램 색 (inferno 계열 LUT) ---------- */
  const LUT = (function () {
    const stops = [[0, [0, 0, 4]], [0.2, [50, 10, 90]], [0.4, [120, 28, 109]], [0.6, [187, 55, 84]], [0.8, [237, 105, 37]], [1, [252, 255, 164]]];
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const x = i / 255; let a = stops[0], b = stops[stops.length - 1];
      for (let s = 0; s < stops.length - 1; s++) if (x >= stops[s][0] && x <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
      const t = (x - a[0]) / (b[0] - a[0] || 1);
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * t;
    }
    return lut;
  })();

  const specCv = $('#spec'), specCx = specCv.getContext('2d');
  const waveCv = $('#wave'), waveCx = waveCv.getContext('2d');
  const tlCv = $('#timeline'), tlCx = tlCv.getContext('2d');
  const F_MIN = 150, F_MAX = 8000;   // 로그 주파수 축
  function rowMap(binHz, nBins, H) {
    const map = new Int32Array(H * 2);
    for (let y = 0; y < H; y++) {
      const fHi = F_MIN * Math.pow(F_MAX / F_MIN, 1 - y / H);
      const fLo = F_MIN * Math.pow(F_MAX / F_MIN, 1 - (y + 1) / H);
      map[y * 2] = Math.max(0, Math.min(nBins - 1, Math.floor(fLo / binHz)));
      map[y * 2 + 1] = Math.max(map[y * 2], Math.min(nBins - 1, Math.floor(fHi / binHz)));
    }
    return map;
  }
  function clearScope() {
    specCx.fillStyle = '#0b0f12'; specCx.fillRect(0, 0, specCv.width, specCv.height);
    waveCx.fillStyle = '#0b0f12'; waveCx.fillRect(0, 0, waveCv.width, waveCv.height);
  }
  clearScope();
  /** 한 열(column)을 오른쪽 끝에 그리고 왼쪽으로 민다. vals: 0..1 (행 순서 = 위→아래) */
  function pushColumn(vals, colW) {
    colW = colW || 2;
    const W = specCv.width, H = specCv.height;
    specCx.drawImage(specCv, colW, 0, W - colW, H, 0, 0, W - colW, H);
    const img = specCx.createImageData(colW, H);
    for (let y = 0; y < H; y++) {
      const v = Math.max(0, Math.min(255, Math.round(vals[y] * 255)));
      for (let x = 0; x < colW; x++) {
        const o = (y * colW + x) * 4;
        img.data[o] = LUT[v * 3]; img.data[o + 1] = LUT[v * 3 + 1]; img.data[o + 2] = LUT[v * 3 + 2]; img.data[o + 3] = 255;
      }
    }
    specCx.putImageData(img, W - colW, 0);
  }

  /* ---------- 오디오 ---------- */
  let ctx = null, analyser = null, proc = null, stream = null, det = null, src = null;
  let ring = null, ringLen = 0, total = 0;
  let envHist = new Float32Array(300), envPos = 0;   // 20ms × 300 = 6초
  let rowmap = null, freqData = null, raf = 0;

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  async function startListening() {
    const c = ensureCtx();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    } catch (e) {
      setStatus('마이크를 열 수 없습니다. 브라우저 주소창의 마이크 권한을 허용하거나, 미리보기 창이라면 새 탭에서 열어 주세요. 그동안 데모·파일 분석은 사용할 수 있습니다.', true);
      return;
    }
    const sr = c.sampleRate;
    src = c.createMediaStreamSource(stream);
    analyser = c.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.2;
    proc = c.createScriptProcessor(4096, 1, 1);
    src.connect(analyser); analyser.connect(proc); proc.connect(c.destination);
    ringLen = sr * 30; ring = new Float32Array(ringLen); total = 0;
    det = DSP.createDetector({ sr, onsetDb: state.profile.sensitivity });
    freqData = new Uint8Array(analyser.frequencyBinCount);
    rowmap = rowMap(sr / analyser.fftSize, analyser.frequencyBinCount, specCv.height);
    clearScope();
    state.bout = null; state.mode = 'live'; state.listening = true;
    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(input);   // 복사 (버퍼 재사용 방지)
      for (let i = 0; i < chunk.length; i++) ring[(total + i) % ringLen] = chunk[i];
      // 20ms 포락선
      const step = Math.round(sr * 0.02);
      for (let i = 0; i + step <= chunk.length; i += step) { envHist[envPos] = DSP.rmsDb(chunk, i, i + step); envPos = (envPos + 1) % envHist.length; }
      const events = det.push(chunk);
      total += chunk.length;
      for (const ev of events) handleLiveEvent(ev, sr);
      $('#hudLevel').textContent = `${DSP.rmsDb(chunk, 0, chunk.length).toFixed(0)} dB`;
      $('#hudFloor').textContent = `바닥 ${Math.max(-90, det.floorDb).toFixed(0)} dB`;
    };
    $('#btnListen').textContent = '■ 듣기 중지'; $('#btnListen').classList.add('live');
    $('#hudMode').textContent = `듣는 중 · ${(sr / 1000).toFixed(1)} kHz`;
    setStatus('듣고 있습니다. 짖음이 잡히면 아래 판독이 바로 갱신됩니다. 폰을 강아지 쪽으로 두고 TV·음악은 꺼 주세요.');
    drawLive();
  }
  function stopListening() {
    cancelAnimationFrame(raf);
    if (proc) { proc.disconnect(); proc.onaudioprocess = null; }
    if (analyser) analyser.disconnect();
    if (src) src.disconnect();
    if (stream) stream.getTracks().forEach(t => t.stop());
    proc = analyser = src = stream = null;
    state.listening = false; state.mode = 'idle';
    $('#btnListen').textContent = '🎙 듣기 시작'; $('#btnListen').classList.remove('live');
    $('#hudMode').textContent = '대기 중';
    setStatus('듣기를 멈췄습니다. 이번 세션 기록은 아래와 기록 탭에 남아 있습니다.');
  }
  $('#btnListen').addEventListener('click', () => state.listening ? stopListening() : startListening());

  function drawLive() {
    if (!state.listening) return;
    analyser.getByteFrequencyData(freqData);
    const H = specCv.height, vals = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      let m = 0; for (let b = rowmap[y * 2]; b <= rowmap[y * 2 + 1]; b++) if (freqData[b] > m) m = freqData[b];
      vals[y] = Math.pow(m / 255, 1.4);
    }
    pushColumn(vals, 2);
    drawWave();
    drawTimeline();
    raf = requestAnimationFrame(drawLive);
  }
  function drawWave() {
    const W = waveCv.width, H = waveCv.height, n = envHist.length;
    waveCx.fillStyle = '#0b0f12'; waveCx.fillRect(0, 0, W, H);
    const floor = det ? det.floorDb : -60, thr = floor + (det ? det.onsetDb || state.profile.sensitivity : 12);
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = envHist[(envPos + i) % n];
      const h = Math.max(1, (Math.min(0, Math.max(-70, v)) + 70) / 70 * (H - 6));
      waveCx.fillStyle = v > thr ? '#ed6925' : '#3a4a52';
      waveCx.fillRect(i * bw, H - h - 3, Math.max(1, bw - 0.5), h);
    }
    const ty = H - 3 - (thr + 70) / 70 * (H - 6);
    waveCx.strokeStyle = 'rgba(201,211,214,0.45)'; waveCx.setLineDash([3, 3]); waveCx.beginPath(); waveCx.moveTo(0, ty); waveCx.lineTo(W, ty); waveCx.stroke(); waveCx.setLineDash([]);
  }

  /* ---------- 이벤트 처리 ---------- */
  function handleLiveEvent(ev, sr) {
    if (ev.end - ev.start > ringLen || ev.start < total + 0 - ringLen) return;
    const seg = new Float32Array(ev.end - ev.start);
    for (let i = 0; i < seg.length; i++) seg[i] = ring[(ev.start + i) % ringLen];
    processEvent(seg, sr, ev, ev.start / sr, Date.now());
  }
  function processEvent(seg, sr, ev, tSec, wallMs) {
    const f = DSP.analyzeSegment(seg, sr, ev);
    if (state.bout && (ev.start - state.bout.lastEnd) / sr <= DSP.BOUT_GAP_SEC) { state.bout.events.push(ev); state.bout.lastEnd = ev.end; }
    else state.bout = { id: (state.bout ? state.bout.id + 1 : 1), events: [ev], lastEnd: ev.end };
    const seq = DSP.boutStats(state.bout.events, sr);
    const r = DSP.interpret(f, seq, effectiveProfile());
    const entry = {
      id: `${wallMs}-${Math.round(tSec * 1000)}`, t: wallMs, tSec, mode: state.mode, boutId: state.bout.id,
      callType: r.callType, callTypeLabel: r.callTypeLabel, top: r.top.key, p: Math.round(r.top.p * 100), confidence: r.confidence,
      contexts: r.contexts.map(c => ({ key: c.key, p: Math.round(c.p * 100) })),
      axes: { pitch: +r.axes.pitch.toFixed(2), tonality: +r.axes.tonality.toFixed(2), tempo: +r.axes.tempo.toFixed(2), tempoKnown: r.axes.tempoKnown, baseF0: r.axes.baseF0 },
      features: f, seq, reasons: r.reasons, tag: null
    };
    state.session.push(entry);
    if (state.mode !== 'demo') { state.log.push(entry); if (state.log.length > 2000) state.log.splice(0, state.log.length - 2000); save('barklens.log.v1', state.log); }
    renderReading(entry);
    renderSession();
    return entry;
  }

  /* ---------- 판독 카드 ---------- */
  function ctxRowsHtml(contexts, topKey) {
    return DSP.CONTEXTS.map(c => {
      const item = contexts.find(x => x.key === c.key) || { p: 0 };
      return `<div class="ctx-row${c.key === topKey ? ' top' : ''}"><span class="name"><span class="swatch" style="background:${CTX_COLOR[c.key]}"></span>${c.label}</span><span class="bar"><i style="width:${item.p}%;background:${CTX_COLOR[c.key]}"></i></span><span class="val mono">${item.p}%</span></div>`;
    }).join('');
  }
  function drawRadar(ax) {
    const svg = $('#radar');
    const cx = 80, cy = 78, R = 58;
    const angles = [-Math.PI / 2, -Math.PI / 2 + 2 * Math.PI / 3, -Math.PI / 2 + 4 * Math.PI / 3];
    const names = ['음높이', '음색', '리듬'];
    const vals = ax ? [ax.pitch, ax.tonality, ax.tempo] : [0, 0, 0];
    const pt = (i, r) => [cx + Math.cos(angles[i]) * r, cy + Math.sin(angles[i]) * r];
    let s = '';
    for (const k of [0.33, 0.66, 1]) s += `<polygon points="${[0, 1, 2].map(i => pt(i, R * k).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    for (let i = 0; i < 3; i++) { const p = pt(i, R); s += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="var(--line)" stroke-width="1"/>`; }
    s += `<polygon points="${[0, 1, 2].map(i => pt(i, 6 + vals[i] * (R - 6)).join(',')).join(' ')}" fill="var(--accent)" fill-opacity="0.28" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    for (let i = 0; i < 3; i++) { const p = pt(i, 6 + vals[i] * (R - 6)); s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--accent)"/>`; }
    const lab = [[cx, cy - R - 8, 'middle'], [cx + R + 4, cy + R * 0.5 + 8, 'start'], [cx - R - 4, cy + R * 0.5 + 8, 'end']];
    for (let i = 0; i < 3; i++) s += `<text x="${lab[i][0]}" y="${lab[i][1]}" text-anchor="${lab[i][2]}" font-size="11" fill="var(--muted)" font-family="var(--font-body)">${names[i]}</text>`;
    svg.innerHTML = s;
  }
  drawRadar(null);
  function renderReading(e) {
    state.current = e;
    const top = CTX_BY_KEY[e.top];
    $('#rCall').textContent = e.callTypeLabel;
    $('#rTime').textContent = e.mode === 'live' ? new Date(e.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `${e.tSec.toFixed(2)} s`;
    $('#rConf').textContent = `${Math.round(e.confidence * 100)}%`; $('#rConfBar').style.width = `${Math.round(e.confidence * 100)}%`;
    $('#rTop').innerHTML = `<span class="dot" style="background:${CTX_COLOR[e.top]}"></span>${top.label} <span class="mono muted" style="font-size:16px">${e.p}%</span>`;
    const boutTxt = e.seq.count > 1 ? `연속 ${e.seq.count}회 · 간격 ${e.seq.ibiMedian}초` : '단발';
    $('#rTopSub').textContent = `${e.callTypeLabel} · ${e.features.durationMs} ms · F0 ${e.features.f0 ? e.features.f0 + ' Hz' : '측정 불가'} · ${boutTxt}`;
    $('#axPitch').style.left = `${8 + e.axes.pitch * 84}%`; $('#axPitchV').textContent = e.features.f0 ? `${e.features.f0} Hz` : '—';
    $('#axTone').style.left = `${8 + e.axes.tonality * 84}%`; $('#axToneV').textContent = `${Math.round(e.axes.tonality * 100)}`;
    $('#axTempo').style.left = `${8 + e.axes.tempo * 84}%`; $('#axTempoV').textContent = e.axes.tempoKnown ? `${e.seq.ibiMedian} s` : '단발';
    drawRadar(e.axes);
    $('#ctxBars').innerHTML = ctxRowsHtml(e.contexts, e.top);
    $('#rReasons').innerHTML = e.reasons.map(r => `<li><span class="k">${r.k}</span><span><span class="mono">${r.v}</span><span class="lvl">${r.lvl}</span><span class="note">${r.note}</span></span></li>`).join('');
    const adv = $('#rAdvice'); adv.hidden = false; adv.textContent = top.advice;
    const tr = $('#tagRow'); tr.hidden = false;
    $$('#tagRow [data-tag]').forEach(b => b.setAttribute('aria-pressed', String(e.tag === b.dataset.tag)));
  }
  $$('#tagRow [data-tag]').forEach(b => b.addEventListener('click', () => {
    if (!state.current) return;
    state.current.tag = b.dataset.tag;
    save('barklens.log.v1', state.log);
    $$('#tagRow [data-tag]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderSession();
  }));

  /* ---------- 세션 ---------- */
  function renderSession() {
    const s = state.session;
    $('#sessionMeta').textContent = `${s.length}회`;
    const counts = {}; s.forEach(e => { counts[e.top] = (counts[e.top] || 0) + 1; });
    $('#sessionCounts').innerHTML = DSP.CONTEXTS.filter(c => counts[c.key]).map(c => `<span><i class="swatch" style="background:${CTX_COLOR[c.key]}"></i>${c.short} ${counts[c.key]}</span>`).join('');
    const list = $('#eventList');
    if (!s.length) { list.innerHTML = '<li class="empty">아직 없음</li>'; return; }
    list.innerHTML = s.slice(-12).reverse().map(e => `<li data-id="${e.id}"><span class="mono muted">${e.mode === 'live' ? new Date(e.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : e.tSec.toFixed(2) + ' s'}</span><span class="ctx"><i class="swatch" style="background:${CTX_COLOR[e.top]}"></i>${CTX_BY_KEY[e.top].short} ${e.p}% <span class="muted">· ${e.callTypeLabel}</span></span><span class="tag">${e.tag ? '태그: ' + (CTX_BY_KEY[e.tag] ? CTX_BY_KEY[e.tag].short : '기타') : ''}</span></li>`).join('');
    $$('#eventList li[data-id]').forEach(li => li.addEventListener('click', () => { const e = s.find(x => x.id === li.dataset.id); if (e) { renderReading(e); $('#reading').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
    drawTimeline();
  }
  function drawTimeline() {
    const W = tlCv.width, H = tlCv.height;
    tlCx.clearRect(0, 0, W, H);
    tlCx.fillStyle = 'rgba(127,139,133,0.18)'; tlCx.fillRect(0, H / 2 - 1, W, 2);
    const now = Date.now();
    const live = state.session.filter(e => e.mode === 'live' && now - e.t <= 60000);
    const colors = { isolation: '#2a78d6', alarm: '#eb6834', play: '#1baf7a', demand: '#eda100', fear: '#e87ba4' };
    for (const e of live) {
      const x = W - (now - e.t) / 60000 * W;
      tlCx.fillStyle = colors[e.top]; tlCx.fillRect(x - 2, 6, 4, H - 12);
    }
    if (!live.length && state.session.length) {
      const s = state.session.filter(e => e.mode !== 'live');
      const maxT = Math.max(1, ...s.map(e => e.tSec));
      for (const e of s) { const x = (e.tSec / maxT) * (W - 8) + 4; tlCx.fillStyle = colors[e.top]; tlCx.fillRect(x - 2, 6, 4, H - 12); }
    }
  }
  renderSession();

  /* ---------- 파일 · 데모 분석 ---------- */
  function setStatus(msg, err) { const s = $('#status'); s.textContent = msg; s.classList.toggle('err', !!err); }
  function analyzeStatic(samples, sr, label, playIt) {
    if (state.listening) stopListening();
    state.bout = null;
    clearScope();
    // 정적 스펙트로그램
    const nfft = 1024, hop = Math.max(256, Math.floor(samples.length / 720));
    const st = DSP.stft(samples, sr, nfft, hop, F_MAX);
    const H = specCv.height, map = rowMap(st.binHz, st.bins, H);
    let mx = -Infinity, mn = Infinity;
    for (const col of st.cols) for (let b = 0; b < col.length; b++) { if (col[b] > mx) mx = col[b]; }
    mn = mx - 70;
    const colW = Math.max(1, Math.ceil(specCv.width / Math.max(1, st.cols.length)));
    specCx.fillStyle = '#0b0f12'; specCx.fillRect(0, 0, specCv.width, H);
    for (const col of st.cols) {
      const vals = new Float32Array(H);
      for (let y = 0; y < H; y++) { let m = -Infinity; for (let b = map[y * 2]; b <= map[y * 2 + 1]; b++) if (col[b] > m) m = col[b]; vals[y] = Math.pow(Math.max(0, Math.min(1, (m - mn) / (mx - mn))), 1.3); }
      pushColumn(vals, colW);
    }
    // 포락선
    const step = Math.round(sr * 0.02); envHist = new Float32Array(Math.max(1, Math.floor(samples.length / step))); envPos = 0;
    for (let i = 0; i < envHist.length; i++) envHist[i] = DSP.rmsDb(samples, i * step, Math.min(samples.length, (i + 1) * step));
    det = DSP.createDetector({ sr, onsetDb: state.profile.sensitivity });
    const res = DSP.analyzeBuffer(samples, sr, effectiveProfile(), { onsetDb: state.profile.sensitivity });
    det = { floorDb: res.floorDb, onsetDb: state.profile.sensitivity };
    drawWave();
    $('#hudMode').textContent = `${label} · ${(samples.length / sr).toFixed(1)}초`;
    $('#hudLevel').textContent = `${res.events.length}개 소리`; $('#hudFloor').textContent = `바닥 ${Math.max(-90, res.floorDb).toFixed(0)} dB`;
    if (!res.results.length) { setStatus('짖음으로 볼 만한 소리를 찾지 못했습니다. 설정에서 민감도를 낮추거나(숫자를 작게) 더 가까이서 녹음해 보세요.', true); renderSession(); return; }
    for (const r of res.results) processEvent(samples.subarray(r.event.start, r.event.end), sr, r.event, r.tSec, Date.now());
    setStatus(`${label}: 소리 ${res.results.length}개를 읽었습니다. 목록에서 항목을 누르면 각 소리의 판독을 볼 수 있습니다.`);
    if (playIt) playSamples(samples, sr);
  }
  function playSamples(samples, sr) {
    const c = ensureCtx();
    const buf = c.createBuffer(1, samples.length, sr);
    buf.getChannelData(0).set(samples);
    const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination); s.start();
  }
  $$('.demo').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.demo, scene = DSP.DEMO_SCENES[key];
    const c = ensureCtx();
    state.mode = 'demo'; state.session = state.session.filter(e => e.mode !== 'demo');
    const audio = DSP.synthBout(c.sampleRate, scene.spec);
    analyzeStatic(audio, c.sampleRate, `데모 · ${scene.label}`, true);
    setStatus(`데모 "${scene.label}" (합성음)을 읽었습니다. 데모 결과는 기록에 저장되지 않습니다. 실제 짖음은 훨씬 다양하니 우리 강아지 소리로 꼭 확인해 보세요.`);
  }));
  $('#fileInput').addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    const c = ensureCtx();
    setStatus(`"${file.name}" 디코딩 중…`);
    try {
      const ab = await file.arrayBuffer();
      const audio = await c.decodeAudioData(ab);
      const n = audio.length, ch = audio.numberOfChannels;
      const mono = new Float32Array(n);
      for (let k = 0; k < ch; k++) { const d = audio.getChannelData(k); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
      state.mode = 'file';
      analyzeStatic(mono, audio.sampleRate, file.name.slice(0, 24), false);
    } catch (e) {
      setStatus('이 파일을 디코딩할 수 없습니다. m4a·mp3·wav·webm 형식의 녹음을 올려 주세요.', true);
    }
    ev.target.value = '';
  });

  /* ---------- 몸짓 ---------- */
  const selectedCues = new Set();
  function renderCueGroups() {
    const groups = {};
    K.BODY_CUES.forEach(c => { (groups[c.group] = groups[c.group] || []).push(c); });
    $('#cueGroups').innerHTML = Object.keys(groups).map(g => `<div class="cue-group"><h3>${g}</h3><div class="cue-chips">${groups[g].map(c => `<button type="button" class="btn small cue-chip" data-cue="${c.id}" aria-pressed="false" title="${c.desc}">${c.label}</button>`).join('')}</div></div>`).join('');
    $$('.cue-chip').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.cue;
      if (selectedCues.has(id)) selectedCues.delete(id); else selectedCues.add(id);
      b.setAttribute('aria-pressed', String(selectedCues.has(id)));
      renderCueResult();
    }));
  }
  function renderCueResult() {
    const res = K.assessCues(Array.from(selectedCues));
    const box = $('#cueResult');
    if (!res) { box.hidden = true; return; }
    box.hidden = false;
    $('#cueState').textContent = res.state; $('#cueState').className = `tone-${res.tone}`;
    $('#cueMeta').textContent = `정서가 ${res.valence >= 0 ? '+' : ''}${res.valence.toFixed(2)} · 각성 ${res.arousal.toFixed(2)} · 단서 ${res.selected.length}개`;
    $('#cueNotes').innerHTML = res.notes.map(n => `<li>${n}</li>`).join('');
    $('#cueEvidence').innerHTML = res.selected.map(c => `<li><strong>${c.label}</strong> — ${c.desc} <span class="muted">(${c.ev})</span></li>`).join('');
    const x = 100 + res.valence * 85, y = 190 - res.arousal * 180;
    $('#vaPlot').innerHTML = `
      <rect x="0" y="0" width="200" height="200" rx="10" fill="var(--surface-2)"/>
      <line x1="100" y1="8" x2="100" y2="192" stroke="var(--line)"/><line x1="8" y1="100" x2="192" y2="100" stroke="var(--line)"/>
      <text x="12" y="20" font-size="10" fill="var(--muted)">두려움·경계</text>
      <text x="188" y="20" font-size="10" fill="var(--muted)" text-anchor="end">놀이·흥분</text>
      <text x="12" y="192" font-size="10" fill="var(--muted)">불편·스트레스</text>
      <text x="188" y="192" font-size="10" fill="var(--muted)" text-anchor="end">편안·친화</text>
      <text x="100" y="108" font-size="9" fill="var(--muted)" text-anchor="middle">각성 ↑</text>
      <circle cx="${x}" cy="${y}" r="9" fill="var(--accent)" fill-opacity="0.3" stroke="var(--accent)" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`;
  }
  $('#cueClear').addEventListener('click', () => { selectedCues.clear(); $$('.cue-chip').forEach(b => b.setAttribute('aria-pressed', 'false')); renderCueResult(); });
  renderCueGroups();

  /* ---------- 기록 ---------- */
  function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function renderLog() {
    const log = state.log;
    $('#logMeta').textContent = `총 ${log.length}회`;
    const now = Date.now(), week = log.filter(e => now - e.t <= 7 * 86400000);
    const counts = {}; week.forEach(e => { counts[e.top] = (counts[e.top] || 0) + 1; });
    const agreed = week.filter(e => e.tag && e.tag === e.top).length, tagged = week.filter(e => e.tag && e.tag !== 'other').length;
    $('#logTiles').innerHTML = DSP.CONTEXTS.map(c => `<div class="tile"><div class="n">${counts[c.key] || 0}</div><div class="l"><i class="swatch" style="width:9px;height:9px;border-radius:50%;background:${CTX_COLOR[c.key]}"></i>${c.short}</div></div>`).join('')
      + `<div class="tile"><div class="n">${tagged ? Math.round(agreed / tagged * 100) + '%' : '—'}</div><div class="l">보호자 태그 일치</div></div>`;
    // 7일 막대
    const days = []; for (let i = 6; i >= 0; i--) days.push(dayKey(now - i * 86400000));
    const byDay = {}; days.forEach(d => { byDay[d] = {}; });
    week.forEach(e => { const d = dayKey(e.t); if (byDay[d]) byDay[d][e.top] = (byDay[d][e.top] || 0) + 1; });
    const maxN = Math.max(1, ...days.map(d => Object.values(byDay[d]).reduce((a, b) => a + b, 0)));
    const W = 720, H = 220, padL = 36, padB = 28, padT = 10, bw = (W - padL - 10) / 7;
    let s = '';
    for (let g = 0; g <= 4; g++) { const v = Math.round(maxN * g / 4), y = padT + (H - padT - padB) * (1 - g / 4); s += `<line x1="${padL}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="var(--line)"/><text x="${padL - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${v}</text>`; }
    days.forEach((d, i) => {
      let acc = 0; const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
      DSP.CONTEXTS.forEach(c => {
        const n = byDay[d][c.key] || 0; if (!n) return;
        const h = (H - padT - padB) * n / maxN, y = padT + (H - padT - padB) * (1 - (acc + n) / maxN);
        s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, h - 2)}" rx="3" fill="${CTX_COLOR[c.key]}"><title>${d} ${c.short} ${n}회</title></rect>`;
        acc += n;
      });
      const tot = Object.values(byDay[d]).reduce((a, b) => a + b, 0);
      if (tot) s += `<text x="${x + w / 2}" y="${padT + (H - padT - padB) * (1 - tot / maxN) - 5}" font-size="11" text-anchor="middle" fill="var(--ink-2)">${tot}</text>`;
      s += `<text x="${x + w / 2}" y="${H - 8}" font-size="11" text-anchor="middle" fill="var(--muted)">${d.slice(5).replace('-', '/')}</text>`;
    });
    $('#logChart').innerHTML = s;
    $('#logLegend').innerHTML = DSP.CONTEXTS.map(c => `<span><i class="swatch" style="background:${CTX_COLOR[c.key]}"></i>${c.label}</span>`).join('');
    const list = $('#logList');
    list.innerHTML = log.length ? log.slice(-30).reverse().map(e => `<li data-id="${e.id}"><span class="mono muted">${new Date(e.t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span class="ctx"><i class="swatch" style="background:${CTX_COLOR[e.top]}"></i>${CTX_BY_KEY[e.top].short} ${e.p}% <span class="muted">· ${e.callTypeLabel} · ${e.features.f0 ? e.features.f0 + ' Hz' : '—'}</span></span><span class="tag">${e.tag ? (CTX_BY_KEY[e.tag] ? CTX_BY_KEY[e.tag].short : '기타') : ''}</span></li>`).join('') : '<li class="empty">아직 기록이 없습니다. 듣기를 시작하거나 녹음 파일을 분석하면 여기에 쌓입니다.</li>';
    $$('#logList li[data-id]').forEach(li => li.addEventListener('click', () => { const e = log.find(x => x.id === li.dataset.id); if (e) { renderReading(e); showTab('listen'); } }));
  }
  $('#logExport').addEventListener('click', () => { const ta = $('#logJson'); ta.hidden = false; ta.value = JSON.stringify({ profile: state.profile, exportedAt: new Date().toISOString(), entries: state.log }, null, 1); ta.focus(); ta.select(); });
  $('#logClear').addEventListener('click', () => { if (confirm('이 브라우저의 모든 기록을 지울까요?')) { state.log = []; save('barklens.log.v1', []); renderLog(); renderProfile(); } });

  /* ---------- 근거 ---------- */
  function renderEvidence() {
    const groups = {};
    K.PAPERS.forEach(p => { (groups[p.g] = groups[p.g] || []).push(p); });
    $('#papers').innerHTML = Object.keys(K.PAPER_GROUPS).filter(g => groups[g]).map(g => `<div class="paper-group"><h3>${K.PAPER_GROUPS[g]}</h3>${groups[g].sort((a, b) => a.y - b.y).map(p => `<div class="paper"><div class="who">${p.a} · ${p.y} · ${p.j}</div><a class="ttl" href="https://doi.org/${p.doi}" target="_blank" rel="noopener">${p.t}</a><div>${p.i}</div><div class="use">앱 반영 → ${p.u}</div></div>`).join('')}</div>`).join('');
    $('#datasets').innerHTML = K.DATASETS.map(d => `<li><strong>${d.n}</strong> — ${d.d}</li>`).join('');
  }
  renderEvidence();

  /* ---------- 시작 ---------- */
  renderProfile();
  showTab(load('barklens.tab', 'listen'));
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) setStatus('이 브라우저는 마이크 입력을 지원하지 않습니다. 데모·파일 분석은 사용할 수 있습니다.', true);
})();
