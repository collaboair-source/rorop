/* BarkLens DSP 검증 — 합성 짖음으로 검출·특징·해석 파이프라인을 확인합니다.
 * 실행: node dog-language-app/app/test/dsp.test.js */
const path = require('path');
const DSP = require(path.join(__dirname, '..', 'dsp.js'));
const K = require(path.join(__dirname, '..', 'knowledge.js'));

const SR = 48000;
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
}

// 1) FFT: 1 kHz 사인파의 피크 bin
{
  const n = 2048, f = 1000;
  const frame = new Float32Array(n);
  for (let i = 0; i < n; i++) frame[i] = Math.sin(2 * Math.PI * f * i / SR);
  const mags = DSP.magnitudeSpectrum(frame, n);
  let best = 0; for (let i = 1; i < mags.length; i++) if (mags[i] > mags[best]) best = i;
  const peakHz = best * SR / n;
  check('FFT 피크 주파수', Math.abs(peakHz - f) < SR / n, `${peakHz.toFixed(1)} Hz`);
}

// 2) NSDF 피치: 440 Hz 배음 신호
{
  const n = Math.round(0.04 * SR), f = 440;
  const frame = new Float32Array(n);
  for (let i = 0; i < n; i++) frame[i] = Math.sin(2 * Math.PI * f * i / SR) + 0.5 * Math.sin(2 * Math.PI * 2 * f * i / SR) + 0.3 * Math.sin(2 * Math.PI * 3 * f * i / SR);
  const p = DSP.pitchNSDF(frame, SR, 60, 3000);
  check('NSDF 피치 추정', Math.abs(p.f0 - f) / f < 0.03 && p.clarity > 0.9, `${p.f0.toFixed(1)} Hz, clarity ${p.clarity.toFixed(2)}`);
}

// 3) 검출기: 5회 짖음 → 5개 이벤트
{
  const audio = DSP.synthBout(SR, { f0: 600, noise: 0.3, durationMs: 200, count: 5, ibiSec: 0.5, seed: 42 });
  // 배경 잡음 추가
  let seed = 1; for (let i = 0; i < audio.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; audio[i] += (seed / 4294967296 - 0.5) * 0.004; }
  const r = DSP.analyzeBuffer(audio, SR, { size: 'medium' });
  check('이벤트 검출 개수', r.events.length === 5, `${r.events.length}개 (잡음 바닥 ${r.floorDb.toFixed(1)} dB)`);
  const seq = r.results[0].seq;
  check('바우트 간격 추정', Math.abs(seq.ibiMedian - 0.5) < 0.1, `IBI ${seq.ibiMedian}s, count ${seq.count}`);
  const f = r.results[0].features;
  check('F0 추정 (600 Hz 목표)', f.f0 > 480 && f.f0 < 720, `${f.f0} Hz, clarity ${f.clarity}`);
}

// 4) 데모 장면별 해석
const expect = { alarm: 'alarm', play: 'play', isolation: 'isolation', whine: ['isolation', 'fear'], growl: 'alarm' };
for (const key of Object.keys(DSP.DEMO_SCENES)) {
  const sc = DSP.DEMO_SCENES[key];
  const audio = DSP.synthBout(SR, sc.spec);
  const r = DSP.analyzeBuffer(audio, SR, { size: 'medium' });
  if (!r.results.length) { check(`데모 ${key}: 이벤트 검출`, false, '이벤트 없음'); continue; }
  const last = r.results[r.results.length - 1];
  const top = last.result.top.key;
  const ok = Array.isArray(expect[key]) ? expect[key].includes(top) : top === expect[key];
  const ax = last.result.axes;
  check(`데모 ${key} → ${top}`, ok,
    `${sc.label}: 소리=${last.result.callTypeLabel}, F0=${last.features.f0}Hz, 맑기=${last.features.clarity}, IBI=${last.seq.ibiMedian}s, 축(p${ax.pitch.toFixed(2)} t${ax.tonality.toFixed(2)} r${ax.tempo.toFixed(2)}), 확신 ${last.result.confidence}`);
}

// 5) 몸짓 평가
{
  const a = K.assessCues(['tail-right', 'mouth-relaxed', 'ear-adductor']);
  check('몸짓: 긍정 조합', a && a.tone === 'good', a && a.state);
  const b = K.assessCues(['stiff-forward', 'teeth', 'tail-high-fast']);
  check('몸짓: 위협 조합', b && /경계/.test(b.state), b && b.state);
  const c = K.assessCues(['yawn', 'head-turn', 'nose-lick']);
  check('몸짓: 카밍 시그널 안내', c && c.notes.some(n => /카밍/.test(n)), c && c.state);
}

console.log(failures ? `\n${failures}개 실패` : '\n모든 검사 통과');
process.exit(failures ? 1 : 0);
