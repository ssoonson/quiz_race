// 코스 배치(좌표)와 선수의 점프·회피 계산.
// 각 트랙은 자기 장애물 목록(obstacles)을 내보내고, 경기(race.js)는 그 목록으로
// "넘을지(점프)" "옆으로 비켜 갈지(회피)"를 계산합니다. 장애물을 옮기면 점프·회피도 따라갑니다.
//
// 장애물 한 개 = { kind, x, z, halfWidth, halfDepth, clearHeight, dodge }
//   x          트랙 중심선 기준 좌우 위치 (곡선 트랙이어도 중심선 기준)
//   halfWidth  좌우로 차지하는 반폭 (움직이는 범위 포함)
//   halfDepth  앞뒤로 차지하는 반깊이
//   clearHeight 점프할 때 이 높이 이상 떠야 발이 닿지 않음
//   dodge      true면 넘지 않고 옆으로 비켜 감 (회전목마처럼 너무 높은 것)

export const START_Z = 26;
export const LANE_COUNT = 8;
const LANE_LEFT_X = -9.2;
const LANE_GAP = 2.63;

export const laneX = (i) => LANE_LEFT_X + (i % LANE_COUNT) * LANE_GAP;
export const laneRow = (i) => Math.floor(i / LANE_COUNT);

const RUNNER_HALF_WIDTH = 0.6;
const TAKEOFF_DISTANCE = 1.3; // 장애물 앞에서 이만큼 먼저 뛰어오름
const DODGE_DISTANCE = 3.5;   // 장애물 앞에서 이만큼 먼저 옆으로 비킴

// 가운데서 1, 가장자리에서 0, 위쪽은 평평한 종 모양
const bell = (d, window) => Math.min(1, (1 - (d / window) ** 2) * 1.6);

/** (x, z)에 있는 선수가 지금 얼마나 높이 떠 있어야 하는지 */
export function jumpHeightAt(obstacles, x, z) {
  let height = 0;
  for (const o of obstacles) {
    if (o.dodge || Math.abs(x - o.x) >= o.halfWidth + RUNNER_HALF_WIDTH) continue;
    const window = o.halfDepth + TAKEOFF_DISTANCE;
    const d = Math.abs(z - o.z);
    if (d < window) height = Math.max(height, o.clearHeight * bell(d, window));
  }
  return height;
}

/** (x, z)에 있는 선수가 높은 장애물을 피하려고 옆으로 얼마나 비켜야 하는지 */
export function dodgeOffsetAt(obstacles, x, z) {
  let offset = 0;
  for (const o of obstacles) {
    if (!o.dodge) continue;
    const need = o.halfWidth + RUNNER_HALF_WIDTH - Math.abs(x - o.x);
    if (need <= 0) continue;
    const window = o.halfDepth + DODGE_DISTANCE;
    const d = Math.abs(z - o.z);
    if (d >= window) continue;
    const side = x >= o.x ? 1 : -1; // 가까운 쪽으로 비킴
    offset += side * need * bell(d, window);
  }
  return offset;
}
