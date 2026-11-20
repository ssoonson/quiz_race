// 효과음 (Web Audio로 직접 합성, 소리 파일 없음). '게임 효과음 사용' 설정을 따릅니다.
// 배경음악(bgm.js)도 같은 오디오 장치를 씁니다.
import { state } from './store.js';

let ctx;
let sfxGain;

/** 공용 오디오 장치. 브라우저 정책상 사용자가 버튼을 누른 뒤에 소리가 납니다. */
export function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 음 하나: freq(Hz), dur(초), type(파형), vol, delay(초 뒤에) */
function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slideTo } = {}) {
  const c = audioContext();
  if (!c || !state.sound) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** 잡음: 함성·박수·바람 소리 재료 */
function noise(dur, { vol = 0.1, delay = 0, filter = 'bandpass', freq = 1200, q = 0.8, attack = 0.02 } = {}) {
  const c = audioContext();
  if (!c || !state.sound) return;
  const t = c.currentTime + delay;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
}

export const sounds = {
  /** 퀴즈: 정답 */
  correct: () => {
    tone(784, 0.1, { type: 'triangle', vol: 0.12 });
    tone(1175, 0.18, { type: 'triangle', vol: 0.12, delay: 0.08 });
  },
  /** 퀴즈: 오답 */
  wrong: () => tone(220, 0.35, { type: 'sawtooth', vol: 0.06, slideTo: 140 }),
  /** 선생님 화면: 학생 입장 */
  join: () => tone(1046, 0.08, { type: 'sine', vol: 0.06 }),
  /** 카운트다운 3·2·1 */
  count: () => tone(660, 0.18, { type: 'square', vol: 0.08 }),
  /** 출발! */
  go: () => {
    tone(880, 0.5, { type: 'square', vol: 0.09 });
    tone(1320, 0.5, { type: 'triangle', vol: 0.06 });
    noise(1.2, { vol: 0.07, freq: 900, attack: 0.15 }); // 함성
  },
  /** 선두 교체 */
  lead: () => {
    tone(988, 0.12, { type: 'triangle', vol: 0.1 });
    tone(1319, 0.2, { type: 'triangle', vol: 0.1, delay: 0.1 });
  },
  /** 구간 진입 (테마 투어) */
  stage: () => noise(0.5, { vol: 0.06, filter: 'highpass', freq: 2500, attack: 0.2 }),
  /** 마지막 10초 시작: 경고음 + 함성 */
  final: () => {
    tone(523, 0.16, { type: 'square', vol: 0.08 });
    tone(523, 0.16, { type: 'square', vol: 0.08, delay: 0.2 });
    tone(784, 0.3, { type: 'square', vol: 0.09, delay: 0.4 });
    noise(2.5, { vol: 0.09, freq: 1000, attack: 0.6 });
  },
  /** 마지막 초읽기 (3초 남으면 더 높게) */
  tick: (left) => tone(left <= 3 ? 1400 : 1000, 0.07, { type: 'square', vol: left <= 3 ? 0.08 : 0.05 }),
  /** 골인: 1위는 팡파르, 2·3위는 짧게, 나머지는 작은 소리 */
  finisher: (rank) => {
    if (rank === 1) {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.16, { type: 'square', vol: 0.08, delay: i * 0.12 }));
      noise(2.8, { vol: 0.12, freq: 1100, attack: 0.1 });
    } else if (rank <= 3) {
      tone(rank === 2 ? 784 : 659, 0.25, { type: 'triangle', vol: 0.1 });
      noise(0.8, { vol: 0.05, freq: 1100 });
    } else {
      tone(1200 + Math.random() * 200, 0.06, { type: 'sine', vol: 0.04 });
    }
  },
};
