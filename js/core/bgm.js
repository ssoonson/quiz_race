// 배경음악.
//   builtin: 내장 음악. 신나는 4마디 반복곡을 Web Audio로 실시간 합성 (마지막 10초엔 더 빨라짐)
//   file   : 선생님 음악 파일. 우선순위 ① 설정에서 고른 파일(이 브라우저에 보관)
//                                 ② 사이트의 audio/bgm.mp3 (모든 컴퓨터에서 같은 음악)
//            마지막 10초에는 재생 속도를 10% 올립니다(음 높이는 그대로).
//   off    : 끄기
import { audioContext } from './audio.js';
import { state } from './store.js';
import { emit } from './events.js';
import { loadBgmFile } from './media-store.js';

const FOLDER_FILE = 'audio/bgm.mp3';
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

let player = null;      // 지금 재생 중인 것 { pause, resume, stop, setFinal, setVolume }
let file = { name: '', url: '', source: '' }; // source: 'browser' | 'folder' | ''

// ---------- 음악 파일 찾기 ----------
/** checkFolder: 사이트의 audio/bgm.mp3도 확인할지 (없으면 브라우저 콘솔에 404가 남으므로 필요할 때만) */
export async function refreshBgmFile({ checkFolder = true } = {}) {
  if (file.source === 'browser') URL.revokeObjectURL(file.url);
  file = { name: '', url: '', source: '' };
  const saved = await loadBgmFile();
  if (saved?.blob) {
    file = { name: saved.name, url: URL.createObjectURL(saved.blob), source: 'browser' };
  } else if (checkFolder) {
    try {
      const res = await fetch(FOLDER_FILE, { method: 'HEAD', cache: 'no-store' });
      if (res.ok) file = { name: FOLDER_FILE, url: FOLDER_FILE, source: 'folder' };
    } catch { /* 파일 없음 */ }
  }
  emit('bgm:file', { ...file });
  return file;
}
export const bgmFile = () => ({ ...file });

// ---------- 내장 음악 (합성) ----------
function createSynth(volume) {
  const c = audioContext();
  if (!c) return null;
  const out = c.createGain();
  out.gain.value = volume * 0.5;
  out.connect(c.destination);

  const noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // C - G - Am - F 진행
  const ROOTS = [36, 43, 45, 41];
  const ARPS = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]];
  let bpm = 132;
  let final = false;
  let step = 0;
  let nextTime = 0;
  let timer = null;

  function env(node, t, peak, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    node.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }
  function osc(type, freq, t, peak, decay, filterFreq) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    env(g, t, peak, decay);
    let node = o;
    if (filterFreq) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      node = o.connect(f);
    }
    node.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.02);
    return o;
  }
  function hiss(t, peak, decay, type, freq) {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    env(g, t, peak, decay);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + decay + 0.02);
  }
  const kick = (t) => osc('sine', 150, t, 0.9, 0.2).frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const snare = (t) => { hiss(t, 0.32, 0.14, 'bandpass', 1800); osc('triangle', 190, t, 0.15, 0.08); };
  const hat = (t, v) => hiss(t, v, 0.04, 'highpass', 7000);

  function play(t, s) {
    const bar = Math.floor(s / 16) % 4;
    const i = s % 16;
    if (i % 4 === 0) kick(t);
    if (i === 4 || i === 12) snare(t);
    if (final || i % 2 === 0) hat(t, i % 2 ? 0.04 : 0.07);
    if (i % 2 === 0) osc('triangle', midi(ROOTS[bar] + (i % 8 === 4 ? 12 : 0)), t, 0.35, 0.22);
    if (final || i % 2 === 0) {
      const arp = ARPS[bar];
      const n = final ? i % 4 : (i / 2) % 4;
      osc('square', midi(arp[n] + 12), t, 0.06, 0.13, 2600);
    }
  }
  function pump() {
    while (nextTime < c.currentTime + 0.12) {
      play(nextTime, step);
      nextTime += 60 / bpm / 4;
      step = (step + 1) % 64;
    }
  }
  const run = () => { nextTime = c.currentTime + 0.05; pump(); timer = setInterval(pump, 25); };

  return {
    start: run,
    pause() { clearInterval(timer); timer = null; },
    resume() { if (!timer) run(); },
    setFinal() { final = true; bpm = 156; },
    setVolume(v) { out.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.05); },
    stop(fade = 0.8) {
      clearInterval(timer);
      out.gain.setTargetAtTime(0.0001, c.currentTime, fade / 3 + 0.001);
      setTimeout(() => out.disconnect(), fade * 1000 + 200);
    },
  };
}

// ---------- 음악 파일 재생 ----------
function createFilePlayer(url, volume) {
  const el = new Audio(url);
  el.loop = true;
  el.volume = volume;
  el.preservesPitch = true;
  let fadeTimer;
  return {
    start: () => el.play().catch(() => {}),
    pause: () => el.pause(),
    resume: () => el.play().catch(() => {}),
    setFinal: () => { el.playbackRate = 1.1; },
    setVolume: (v) => { el.volume = v; },
    stop(fade = 0.8) {
      clearInterval(fadeTimer);
      const start = el.volume;
      const steps = Math.max(1, Math.round(fade * 20));
      let n = 0;
      fadeTimer = setInterval(() => {
        n++;
        el.volume = Math.max(0, start * (1 - n / steps));
        if (n >= steps) { clearInterval(fadeTimer); el.pause(); el.src = ''; }
      }, 50);
    },
  };
}

// ---------- 바깥에서 쓰는 함수 ----------
export const isBgmPlaying = () => !!player;

export function startBgm() {
  stopBgm(0);
  if (state.bgm === 'off') return;
  const volume = state.bgmVolume / 100;
  player = state.bgm === 'file' && file.url ? createFilePlayer(file.url, volume) : createSynth(volume);
  player?.start();
}
export const pauseBgm = () => player?.pause();
export const resumeBgm = () => player?.resume();
export const finalBgm = () => player?.setFinal();
export function stopBgm(fade = 0.8) {
  player?.stop(fade);
  player = null;
}
export const setBgmVolume = (v) => player?.setVolume(v / 100);
