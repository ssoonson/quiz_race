// 이 기기에서만 쓰는 화면·소리 설정 (LocalStorage). 경기 데이터는 net/ 쪽(Firebase)에 있습니다.
import { emit } from './events.js';

const KEY = 'quiz-race-prefs-v1';
const DEFAULTS = { sound: true, bgm: 'builtin', bgmVolume: 55, quality: 'auto', reducedMotion: false };

let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* 무시 */ }

export const state = { ...DEFAULTS };
for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) state[k] = saved[k];

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  state[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 무시 */ }
  emit('state:changed', { keys: [key] });
}
