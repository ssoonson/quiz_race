// 체험 모드: Firebase 없이 '같은 컴퓨터, 같은 브라우저'의 탭끼리만 연결됩니다.
// 선생님 탭과 학생 탭 여러 개를 띄워 미리 해 보거나 시험할 때 씁니다.
// 방 데이터는 localStorage에 두고, 바뀌면 다른 탭에 알립니다.
// 학생 기록은 학생마다 따로 저장합니다(여러 탭이 동시에 써도 서로 덮어쓰지 않게).
import { makeRoomCode } from '../shared/rules.js';

const PREFIX = 'quizrace-room-';

function tabUid() {
  // 탭마다 다른 사람으로 취급 (sessionStorage는 탭마다 따로)
  let id = sessionStorage.getItem('quizrace-uid');
  if (!id) {
    id = 'local-' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('quizrace-uid', id);
  }
  return id;
}

const baseKey = (code) => PREFIX + code;
const playerKey = (code, uid) => `${PREFIX}${code}/p/${uid}`;
const parse = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

/** 방 데이터 읽기: 방 본체 + 학생별 기록을 합침 */
function read(code) {
  const room = parse(baseKey(code));
  if (!room) return null;
  const players = {};
  const prefix = `${PREFIX}${code}/p/`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const p = parse(key);
      if (p) players[key.slice(prefix.length)] = p;
    }
  }
  room.players = players;
  return room;
}

function playerKeys(code) {
  const prefix = `${PREFIX}${code}/p/`;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

function applyPatch(obj, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('/');
    let node = obj;
    for (const k of keys.slice(0, -1)) node = node[k] ??= {};
    const last = keys[keys.length - 1];
    if (value === null) delete node[last];
    else node[last] = structuredClone(value);
  }
  return obj;
}

export async function connectLocal() {
  const watchers = new Map(); // code → Set(cb)
  const notify = (code) => watchers.get(code)?.forEach((cb) => cb(read(code)));
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith(PREFIX)) notify(e.key.slice(PREFIX.length).split('/')[0]);
  });

  /** 경로별 변경을 '방 본체'와 '학생별' 칸으로 나눠 저장 */
  function writePatch(code, patch) {
    const base = parse(baseKey(code));
    if (!base) throw new Error('방이 없습니다.');
    const baseChanges = {};
    const byPlayer = new Map();
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split('/');
      if (parts[0] === 'players' && parts[1]) {
        if (!byPlayer.has(parts[1])) byPlayer.set(parts[1], {});
        byPlayer.get(parts[1])[parts.slice(2).join('/')] = value;
      } else baseChanges[path] = value;
    }
    if (Object.keys(baseChanges).length) localStorage.setItem(baseKey(code), JSON.stringify(applyPatch(base, baseChanges)));
    for (const [uid, changes] of byPlayer) {
      const key = playerKey(code, uid);
      if ('' in changes) { // players/uid 통째로 바꾸기 또는 지우기
        const whole = changes[''];
        delete changes[''];
        if (whole === null) { localStorage.removeItem(key); continue; }
        localStorage.setItem(key, JSON.stringify(applyPatch(structuredClone(whole), changes)));
        continue;
      }
      const current = parse(key);
      if (!current) continue; // 없는 학생 (내보내진 뒤 늦게 온 기록)
      localStorage.setItem(key, JSON.stringify(applyPatch(current, changes)));
    }
    notify(code); // 같은 탭에는 storage 이벤트가 오지 않으므로 직접 알림
  }
  function removeAll(code) {
    playerKeys(code).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(baseKey(code));
    notify(code);
  }

  return {
    mode: 'local',
    uid: tabUid(),
    now: () => Date.now(),
    serverTime: () => Date.now(),
    async createRoom(room) {
      let code;
      do code = makeRoomCode(); while (read(code));
      const { players = {}, ...base } = structuredClone(room);
      localStorage.setItem(baseKey(code), JSON.stringify(base));
      for (const [uid, p] of Object.entries(players)) localStorage.setItem(playerKey(code, uid), JSON.stringify(p));
      notify(code);
      return code;
    },
    readRoom: async (code) => read(code),
    watchRoom(code, cb) {
      if (!watchers.has(code)) watchers.set(code, new Set());
      watchers.get(code).add(cb);
      queueMicrotask(() => cb(read(code)));
      return () => watchers.get(code)?.delete(cb);
    },
    async update(code, patch) { writePatch(code, patch); },
    removeRoom: async (code) => removeAll(code),
  };
}
