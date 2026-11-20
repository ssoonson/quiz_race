// 퀴즈 레이스 규칙과 계산. 선생님 화면과 학생 화면이 함께 씁니다.

export const LIMITS = {
  maxPlayers: 40,
  nameLength: 12,
  questions: 100,
  questionLength: 200,
  choiceLength: 60,
};

export const GOAL_OPTIONS = [5, 8, 10, 12, 15, 20];           // 결승까지 맞혀야 하는 문제 수
export const TIME_OPTIONS = [60, 120, 180, 240, 300, 0];      // 제한 시간(초), 0 = 없음
export const DEFAULT_SETTINGS = { goal: 10, timeLimit: 180, stunMs: 2000, track: 'tour', character: 'jelly' };
export const COUNTDOWN_MS = 3000;

/** 4자리 방 코드 (0으로 시작하지 않음) */
export const makeRoomCode = () => String(1000 + Math.floor(Math.random() * 9000));

/** 이름 정리: 앞뒤 공백 제거, 길이 제한, 제어 문자 제거 */
export const cleanName = (name) => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.nameLength);

/**
 * 정답 확인용 값. 정답 번호를 그대로 저장하지 않고 '방마다 다른 소금(salt)'을 섞은 해시로 저장해서
 * 화면 개발자 도구를 열어도 정답 번호가 바로 보이지 않게 합니다(완벽한 보안은 아님).
 */
export async function answerHash(salt, questionIndex, choice) {
  const data = new TextEncoder().encode(`${salt}:${questionIndex}:${choice}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const makeSalt = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** 문자열로 정해지는 난수 (학생마다 문제 순서를 다르게 섞되, 새로고침해도 같은 순서) */
function seeded(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 학생이 n번째로 풀 문제의 번호. 문제를 다 풀면 다시 섞어서 반복합니다. */
export function questionFor(uid, round, count, n) {
  const lap = Math.floor(n / count);
  const rnd = seeded(`${uid}:${round}:${lap}`);
  const order = [...Array(count).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[n % count];
}

/** 진행률 0~1 */
export const progressOf = (player, goal) => Math.min(1, (player?.correct || 0) / goal);

/**
 * 순위: ① 결승에 먼저 들어온 순서 ② 맞힌 개수 많은 순 ③ 마지막으로 맞힌 시각이 빠른 순
 * @returns [{uid, ...player}]
 */
export function ranking(players = {}) {
  return Object.entries(players)
    .map(([uid, p]) => ({ uid, ...p }))
    .sort((a, b) => {
      const af = a.finishedAt || Infinity, bf = b.finishedAt || Infinity;
      if (af !== bf) return af - bf;
      if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
      return (a.lastCorrectAt || Infinity) - (b.lastCorrectAt || Infinity) || (a.joinedAt || 0) - (b.joinedAt || 0);
    });
}

/** 입장 순서 (레인·색 배정용) */
export const joinOrder = (players = {}) =>
  Object.entries(players).sort(([, a], [, b]) => (a.joinedAt || 0) - (b.joinedAt || 0)).map(([uid]) => uid);

/** 남은 시간(초). 제한 없음이면 Infinity */
export function remainingSeconds(room, now) {
  const s = room?.state;
  if (!s || !room.settings?.timeLimit) return Infinity;
  if (s.phase === 'countdown') return room.settings.timeLimit;
  if (s.phase !== 'playing') return s.phase === 'finished' ? 0 : room.settings.timeLimit;
  return Math.max(0, room.settings.timeLimit - (now - s.startAt) / 1000);
}
