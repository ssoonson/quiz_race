// 모든 트랙에 공통인 경기장 뼈대: 땅, 도로, 레인, 난간, 출발 아치, 결승선. (장애물은 obstacles.js)
import { THREE, add, box, bakeInto } from '../parts.js';
import { buildObstacle, STRAIGHT_OBSTACLES } from './obstacles.js';

const COURSE = { roadWidth: 22, laneCount: 8, finishZ: -100 };

/** colors: { ground, road, rail, accent } */
function buildCourse(root, colors) {
  const { roadWidth: W, finishZ } = COURSE;
  const midZ = -44, length = 145;

  add(root, box(240, 0.22, 310, colors.ground), 0, -0.25, midZ);
  add(root, box(W, 0.18, length, colors.road), 0, 0, midZ);

  for (let i = 0; i <= COURSE.laneCount; i++) {
    const lane = add(root, box(0.04, 0.025, length - 3, '#ffffff', { shadow: false }), -W / 2 + i * W / COURSE.laneCount, 0.11, midZ);
    lane.material.transparent = true;
    lane.material.opacity = 0.34;
  }
  for (const side of [-1, 1]) add(root, box(0.53, 0.61, length, colors.rail), side * (W / 2 + 0.45), 0.38, midZ);

  // 출발 아치
  for (const side of [-1, 1]) add(root, box(0.7, 4.8, 0.85, colors.accent), side * 12.1, 2.35, 24);
  add(root, box(25, 0.55, 0.95, colors.rail), 0, 4.8, 24);

  // 결승선 체크무늬
  add(root, box(W, 0.06, 2, '#ffffff'), 0, 0.16, finishZ + 1);
  for (let k = 0; k < 12; k++) {
    add(root, box(W / 12, 0.085, 1.04, k % 2 ? '#ffffff' : '#2b3240'), -W / 2 + (k + 0.5) * W / 12, 0.22, finishZ + 1);
  }

}

/**
 * 직선 트랙 만들기 (우주 스피드웨이·바다 산책로가 사용)
 * @param theme { colors: {sky, ground, road, rail, accent}, decorate(root) }
 */
export function buildStraightTrack(theme) {
  const { colors } = theme;
  const group = new THREE.Group();

  // 움직이지 않는 것(땅·도로·장식)은 전부 만든 뒤 한꺼번에 합침. 장식은 그림자를 드리우지 않음.
  const scenery = new THREE.Group();
  buildCourse(scenery, colors);
  theme.decorate(scenery);
  bakeInto(scenery, { deep: true, castShadow: false });
  group.add(scenery);

  // 움직이는 장애물 (줄마다 색을 번갈아)
  const animated = STRAIGHT_OBSTACLES.map((o) => buildObstacle(group, o, o.row % 2 ? colors.accent : colors.rail));

  return {
    group, animated,
    obstacles: STRAIGHT_OBSTACLES,
    sky: colors.sky,
    fog: { color: colors.sky, near: 125, far: 285 },
    finishZ: COURSE.finishZ,
    rowGap: 3.1,
    curved: false,
    centerX: () => 0,
    shadows: true,
  };
}
