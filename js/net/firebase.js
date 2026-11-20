// Firebase Realtime Database 연결. 학생은 계정 없이 '익명 로그인'으로 들어옵니다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase, ref, get, set, update, remove, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { makeRoomCode } from '../shared/rules.js';

export async function connectFirebase(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);

  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => { if (u) { stop(); resolve(u); } });
    signInAnonymously(auth).catch(reject);
  });

  // 서버 시각과 이 기기 시각의 차이 (모두가 같은 시각 기준으로 남은 시간을 계산)
  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });

  const roomRef = (code) => ref(db, `rooms/${code}`);

  return {
    mode: 'firebase',
    uid: user.uid,
    now: () => Date.now() + offset,
    serverTime: () => serverTimestamp(),
    async createRoom(room) {
      for (let tries = 0; tries < 20; tries++) {
        const code = makeRoomCode();
        const snap = await get(roomRef(code));
        if (!snap.exists()) {
          await set(roomRef(code), room);
          return code;
        }
      }
      throw new Error('빈 방 코드를 찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    },
    async readRoom(code) {
      const snap = await get(roomRef(code));
      return snap.exists() ? snap.val() : null;
    },
    watchRoom(code, cb) {
      return onValue(roomRef(code), (s) => cb(s.exists() ? s.val() : null), () => cb(null));
    },
    update: (code, patch) => update(roomRef(code), patch),
    removeRoom: (code) => remove(roomRef(code)),
  };
}
