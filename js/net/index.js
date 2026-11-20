// 연결 고르기: firebase-config.js가 채워져 있으면 Firebase, 아니면 체험 모드(같은 컴퓨터의 탭끼리).
//
// 두 연결 방식이 똑같이 제공하는 기능
//   mode                 'firebase' | 'local'
//   uid                  이 기기(탭)의 고유 번호
//   now()                모두가 같은 기준으로 쓰는 현재 시각(ms)
//   createRoom(room)     → 방 코드
//   readRoom(code)       → 방 데이터 또는 null
//   watchRoom(code, cb)  방이 바뀔 때마다 cb(방 데이터 또는 null). 반환값을 부르면 그만 봄
//   update(code, patch)  {'state/phase': 'playing', 'players/uid/correct': 3} 처럼 경로별로 바꿈 (null = 지움)
//   removeRoom(code)
import { firebaseConfig } from '../../firebase-config.js';

export const firebaseReady = () => Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);

let connection;
export function connect() {
  connection ??= firebaseReady()
    ? import('./firebase.js').then((m) => m.connectFirebase(firebaseConfig))
    : import('./local.js').then((m) => m.connectLocal());
  return connection;
}
