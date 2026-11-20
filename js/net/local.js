// 체험 모드: Firebase 없이 '같은 컴퓨터, 같은 브라우저'의 탭끼리만 연결됩니다.
// 선생님 탭과 학생 탭 여러 개를 띄워 미리 해 보거나 시험할 때 씁니다.
// 방 데이터는 localStorage에 두고, 바뀌면 다른 탭에 알립니다.
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

const read = (code) => {
  try { return JSON.parse(localStorage.getItem(PREFIX + code) || 'null'); } catch { return null; }
};

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
    if (e.key?.startsWith(PREFIX)) notify(e.key.slice(PREFIX.length));
  });
  const write = (code, room) => {
    if (room) localStorage.setItem(PREFIX + code, JSON.stringify(room));
    else localStorage.removeItem(PREFIX + code);
    notify(code); // 같은 탭에는 storage 이벤트가 오지 않으므로 직접 알림
  };

  return {
    mode: 'local',
    uid: tabUid(),
    now: () => Date.now(),
    async createRoom(room) {
      let code;
      do code = makeRoomCode(); while (read(code));
      write(code, structuredClone(room));
      return code;
    },
    readRoom: async (code) => read(code),
    watchRoom(code, cb) {
      if (!watchers.has(code)) watchers.set(code, new Set());
      watchers.get(code).add(cb);
      queueMicrotask(() => cb(read(code)));
      return () => watchers.get(code)?.delete(cb);
    },
    async update(code, patch) {
      const room = read(code);
      if (!room) throw new Error('방이 없습니다.');
      write(code, applyPatch(room, patch));
    },
    removeRoom: async (code) => write(code, null),
  };
}
