// 직접 조종 모드 전용 장애물 배치.
// 방의 seed와 판(round)으로 정해지므로 모든 학생 화면에 똑같이 놓이고, '다시 하기'마다 배치가 바뀝니다.
//
//   hurdle  허들: 낮은 막대 → 점프로 넘음 (트랙 전체 또는 일부를 막음)
//   wall    벽: 높아서 못 넘음 → 뚫린 틈(폭 4.2)으로 지나가야 함 (왼쪽·오른쪽 두 조각)
//   slider  움직이는 블록: 좌우로 왔다 갔다 → 타이밍 맞춰 피함
//   boulder 굴러가는 돌: 트랙을 좌우로 끝까지 굴러다님 → 지나간 틈을 노리거나 점프로 넘음
//   spinner 회전 막대: 기둥을 중심으로 낮은 막대가 돎 → 점프로 넘거나 지나간 뒤 빠져나감 (기둥은 못 넘음)
//           (돌·막대는 game/moving-obstacles.js의 moverHit으로 판정, mover: true)
//
// 장애물 한 개 = { kind, x, z, halfWidth, halfDepth, clearHeight, dodge, move?, exact: true }
//   x는 트랙 중심선 기준. move가 있으면 x가 시간에 따라 바뀜 (obstacleX 참고)
import { seeded } from './rules.js';

export const DENSITY = {
  normal: { label: '보통', gap: 11 },
  many: { label: '많이', gap: 8 },
  lots: { label: '아주 많이', gap: 6 },
};

const TRACK_HALF = 11;
const GAP_HALF = 2.1;        // 벽의 틈 반폭
const START_CLEAR = 15;      // 출발선 앞 이만큼은 비워 둠
const FINISH_CLEAR = 9;      // 결승선 앞 이만큼은 비워 둠
const NEAR_EXISTING = 3.5;   // 트랙에 원래 있는 장애물과 이만큼 떨어뜨림
const SPINNER_LEN = 4.2;     // 회전 막대 반지름

/** 움직이는 장애물의 지금 x (tSec: 경기 시작 후 초) */
export function obstacleX(o, tSec) {
  return o.move ? o.x + o.move.amp * Math.sin(o.move.speed * tSec + o.move.phase) : o.x;
}

/**
 * @param seed      방마다 정해진 숫자
 * @param round     몇 번째 판
 * @param finishZ   결승선 위치
 * @param existing  트랙에 원래 있는 장애물 (겹치지 않게)
 * @param density   'normal' | 'many' | 'lots'
 */
export function makeRunObstacles({ seed, round = 1, finishZ, existing = [], density = 'many' }) {
  const rnd = seeded(`${seed}:${round}`);
  const pick = (a, b) => a + rnd() * (b - a);
  const gap = (DENSITY[density] || DENSITY.many).gap;
  const list = [];
  let lastKind = '';

  let z = 26 - START_CLEAR;
  let kind = '';
  let tries = 0;
  while (z > finishZ + FINISH_CLEAR) {
    // 같은 종류가 연달아 나오지 않게 고르기 (빈자리를 찾는 동안은 고른 종류 유지)
    if (!kind) {
      do {
        const r = rnd();
        kind = r < 0.24 ? 'hurdle' : r < 0.48 ? 'wall' : r < 0.62 ? 'slider' : r < 0.81 ? 'boulder' : 'spinner';
      } while (kind === lastKind && rnd() < 0.6);
    }
    // 회전 막대는 앞뒤로 막대 길이만큼 공간을 차지함
    const reach = kind === 'spinner' ? SPINNER_LEN : 0;
    const rowZ = z - reach;
    if (rowZ - reach < finishZ + FINISH_CLEAR) { kind = 'hurdle'; continue; }
    // 원래 장애물 바로 근처면 건너뛰지 말고 조금씩 앞으로 밀어서 빈자리를 찾음
    if (existing.some((o) => Math.abs(o.z - rowZ) < NEAR_EXISTING + reach)) {
      // 자리를 1칸씩 앞으로 옮겨 가며 찾되, 회전 막대가 12칸 안에서 못 찾으면 작은 장애물(돌)로 바꿈
      if (reach && ++tries > 12) { kind = 'boulder'; tries = 0; z += 12; }
      else z -= 1;
      continue;
    }
    tries = 0;
    z = rowZ - reach - gap * pick(0.85, 1.15);
    lastKind = kind;

    if (kind === 'hurdle') {
      const full = rnd() < 0.4;
      const halfWidth = full ? TRACK_HALF : pick(4.5, 7);
      const x = full ? 0 : pick(-TRACK_HALF + halfWidth, TRACK_HALF - halfWidth);
      list.push({ kind, x, z: rowZ, halfWidth, halfDepth: 0.35, clearHeight: 1.0, dodge: false });
    } else if (kind === 'wall') {
      const gx = pick(-7.5, 7.5); // 틈의 가운데
      const left = [-TRACK_HALF, gx - GAP_HALF];
      const right = [gx + GAP_HALF, TRACK_HALF];
      for (const [a, b] of [left, right]) {
        if (b - a < 0.8) continue;
        list.push({ kind, x: (a + b) / 2, z: rowZ, halfWidth: (b - a) / 2, halfDepth: 0.45, clearHeight: 99, dodge: true, gapX: gx });
      }
    } else if (kind === 'boulder') {
      list.push({
        kind, x: 0, z: rowZ, r: 0.85, amp: 8.6, speed: pick(0.9, 1.5) * (rnd() < 0.5 ? -1 : 1), phase: pick(0, Math.PI * 2),
        clearHeight: 1.9, mover: true,
      });
    } else if (kind === 'spinner') {
      list.push({
        kind, x: pick(-3.5, 3.5), z: rowZ, len: SPINNER_LEN, speed: pick(1.1, 1.8) * (rnd() < 0.5 ? -1 : 1), phase: pick(0, Math.PI * 2),
        clearHeight: 1.0, barY: 0.7, mover: true,
      });
    } else {
      const count = rnd() < 0.45 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        list.push({
          kind, z: rowZ - i * 2.4, x: count === 2 ? (i ? 4 : -4) : pick(-3, 3),
          halfWidth: 1.3, halfDepth: 0.7, clearHeight: 99, dodge: true,
          move: { amp: 0, speed: pick(0.9, 1.6), phase: pick(0, Math.PI * 2) },
        });
      }
    }
    kind = '';
  }
  // 움직이는 블록이 난간 밖으로 나가지 않게 움직임 폭을 맞춤
  for (const o of list) if (o.move) o.move.amp = Math.max(1.5, Math.min(pick(3.5, 6), 9.4 - Math.abs(o.x)));
  return list.map((o, id) => ({ ...o, id, exact: true }));
}
