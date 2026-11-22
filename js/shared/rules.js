// 퀴즈 레이스 규칙과 계산. 선생님 화면과 학생 화면이 함께 씁니다.

export const LIMITS = {
  maxPlayers: 60,
  nameLength: 12,
  questions: 100,
  questionLength: 200,
  choiceLength: 60,
};

export const GOAL_OPTIONS = [5, 8, 10, 12, 15, 20];           // 결승까지 맞혀야 하는 문제 수
export const TIME_OPTIONS = [60, 120, 180, 240, 300, 0];      // 제한 시간(초), 0 = 없음
export const DEFAULT_SETTINGS = { mode: 'quiz', goal: 10, timeLimit: 180, stunMs: 2000, track: 'tour', character: 'jelly' };

// 게임 방식: quiz = 문제를 맞히면 전진, run = 학생이 방향키·화면 버튼으로 직접 조종
export const MODES = { quiz: '📝 문제 풀기', run: '🎮 직접 조종 (자유 달리기)' };

/** 직접 조종 모드의 물리값 */
export const RUN = {
  raceSeconds: 40,      // 쉬지 않고 달리면 결승까지 약 40초 (트랙 길이에 맞춰 최고 속도를 정함)
  accel: 1,             // 최고 속도까지 걸리는 시간(초)의 역수 → 약 1초
  laneLimit: 10.2,      // 좌우로 갈 수 있는 한계 (난간 안쪽)
  strafeSpeed: 9,       // 좌우 이동 속도 (초당)
  jumpHeight: 2.6,      // 점프 최고 높이
  gravity: 22,          // 낮을수록 오래 떠 있음 (점프 타이밍이 너그러워짐)
  knockback: 1.6,       // 부딪히면 뒤로 밀리는 거리
  minStunMs: 1200,
  graceMs: 1600,        // 넘어졌다 일어난 뒤 잠깐 무적 (부딪힌 장애물을 지나갈 수 있게)
  sendHz: 6,            // 내 위치를 1초에 몇 번 보낼지
  speedTolerance: 1.1,  // 서버 규칙: 출발 후 (최고 속도 × 이 배수 × 시간 + speedSlack)보다 앞서면 거절
  speedSlack: 5,
};

/** 트랙별 결승 위치 (출발 z=26) */
export const TRACK_FINISH_Z = { tour: -234, rainbow: -100, space: -100, ocean: -100 };

/**
 * 직접 조종 방에 저장할 값: 서버 보안 규칙이 이 값으로 속도·결승을 검사합니다.
 *  maxSpeed     최고 달리기 속도 (초당)
 *  finishZ      결승선 위치
 *  minFinishMs  출발 후 이보다 빨리 결승하면 거절 (정상 최고 기록보다 짧게)
 */
export function runLimits(track) {
  const finishZ = TRACK_FINISH_Z[track] ?? -100;
  const maxSpeed = Math.round(((26 - finishZ) / RUN.raceSeconds) * 1000) / 1000;
  return { finishZ, maxSpeed, minFinishMs: Math.floor((RUN.raceSeconds * 1000) / RUN.speedTolerance) };
}
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

/** 문자열로 정해지는 난수 (같은 글자를 넣으면 어느 기기에서나 같은 순서의 난수) */
export function seeded(text) {
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
 * 순위
 *  문제 풀기: ① 결승에 먼저 들어온 순서 ② 맞힌 개수 많은 순 ③ 마지막으로 맞힌 시각이 빠른 순
 *  직접 조종: ① 결승에 먼저 들어온 순서 ② 더 멀리 간 순 (z가 작을수록 앞)
 * @returns [{uid, ...player}]
 */
export function ranking(players = {}, mode = 'quiz') {
  return Object.entries(players)
    .map(([uid, p]) => ({ uid, ...p }))
    .sort((a, b) => {
      const af = a.finishedAt || Infinity, bf = b.finishedAt || Infinity;
      if (af !== bf) return af - bf;
      if (mode === 'run') return (a.pos?.z ?? 99) - (b.pos?.z ?? 99) || (a.joinedAt || 0) - (b.joinedAt || 0);
      if ((b.correct || 0) !== (a.correct || 0)) return (b.correct || 0) - (a.correct || 0);
      return (a.lastCorrectAt || Infinity) - (b.lastCorrectAt || Infinity) || (a.joinedAt || 0) - (b.joinedAt || 0);
    });
}

/** 방 데이터로 순위 */
export const rankRoom = (room) => ranking(room?.players || {}, room?.settings?.mode);

/** 진행률 0~1 (모드에 맞게). finishZ: 트랙 결승 위치 */
export function progressFor(player, settings, finishZ = -100) {
  if (settings?.mode === 'run') {
    if (player?.finishedAt) return 1;
    const z = player?.pos?.z ?? 26;
    return Math.min(1, Math.max(0, (26 - z) / (26 - finishZ)));
  }
  return progressOf(player, settings?.goal || 10);
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
