// 🎡 테마 투어 (에셋 v4): 다섯 배경이 한 코스로 이어지는 곡선 트랙.
// 구간을 고치려면 해당 파일을 여세요:
//   greenhouse.js 온실 출발역 · garden.js 무지개 정원 · starlight.js 별빛 고가교
//   coast.js 산호 해변 · festival.js 노을 축제장 · road.js 노면·난간 · kit.js 공통 도구·구간 색
import { THREE, bakeInto } from '../../parts.js';
import { TOUR_STAGES, START_Z, STAGE_LENGTH, FINISH_Z, CANDY, IVORY, centerX, stageAt, themeColor, createTourKit } from './kit.js';
import { buildRoad } from './road.js';
import * as greenhouse from './greenhouse.js';
import * as garden from './garden.js';
import * as starlight from './starlight.js';
import * as coast from './coast.js';
import * as festival from './festival.js';

export { centerX };

// ---------- 장애물: 구간마다 사탕 공 한 줄(넘음) + 발판 한 줄(넘음) ----------
const ROWS = [
  { kind: 'candy', gap: 16, offset: -0.85, halfWidth: 1.3, halfDepth: 0.7, clearHeight: 2.1 },
  { kind: 'platform', gap: 32, offset: 1.15, halfWidth: 1.1, halfDepth: 0.95, clearHeight: 1.1 },
];
export const obstacles = TOUR_STAGES.flatMap((_, stage) => ROWS.flatMap((row) =>
  [0, 1, 2].map((lane) => ({
    kind: row.kind, stage, lane,
    x: (lane - 1) * 6.15 + row.offset,
    z: START_Z - stage * STAGE_LENGTH - row.gap,
    halfWidth: row.halfWidth, halfDepth: row.halfDepth, clearHeight: row.clearHeight,
  }))));

function buildObstacles(kit) {
  const { group, geo, part, local, movingPart } = kit;
  for (const o of obstacles) {
    const base = local(group, o.z, o.x);
    part(base, geo.cylinder, TOUR_STAGES[o.stage].rail, 0, 0.15, 0, 0.84, 0.16, 0.8);
    const color = CANDY[(o.stage + o.lane + (o.kind === 'platform' ? 1 : 0)) % CANDY.length];
    const phase = o.stage * 1.5 + o.lane * 0.63;
    if (o.kind === 'platform') {
      const pad = movingPart(base, 'platform', phase, 0, 0.28, 0);
      part(pad, geo.cylinder, color, 0, 0.22, 0, 1.1, 0.36, 0.93);
      part(pad, geo.cylinder, IVORY, 0, 0.42, 0, 0.96, 0.08, 0.82);
    } else {
      part(base, geo.cylinder, IVORY, 0, 0.62, 0, 0.085, 0.97, 0.085);
      const ball = movingPart(base, 'candy', phase, 0, 1.04, 0);
      ball.userData.baseY = 1.04;
      const star = o.stage === 2; // 별빛 구간은 별 모양
      part(ball, star ? geo.diamond : geo.ball, color, 0, 0.2, 0, 0.56, 0.62, 0.55, star);
    }
  }
}

// ---------- 만들기 ----------
export function build() {
  const kit = createTourKit();
  buildRoad(kit);
  [greenhouse, garden, starlight, coast, festival].forEach((stage) => stage.build(kit));
  buildObstacles(kit);

  // 성능: 움직이는 부품은 부품별로, 각 구간 배경은 재질별로 한 덩어리씩
  kit.animated.forEach((c) => bakeInto(c.userData.animated, { deep: true, castShadow: false }));
  kit.sections.forEach((s) => bakeInto(s, { deep: true, castShadow: false }));

  const FOG_NEAR = 43, FOG_FAR = 134;

  /** 카메라 근처 구간만 보이게(나머지는 안개 너머라 숨김) */
  function updateSections(cameraZ) {
    kit.sections.forEach((section, i) => {
      const start = i === 0 ? Infinity : START_Z - STAGE_LENGTH * i + 12;
      const end = i === kit.sections.length - 1 ? -Infinity : START_Z - STAGE_LENGTH * (i + 1) - 12;
      section.visible = cameraZ + 14 >= end && cameraZ - FOG_FAR <= start;
    });
  }

  return {
    group: kit.group,
    animated: kit.animated,
    obstacles,
    sky: TOUR_STAGES[0].sky,
    fog: { color: TOUR_STAGES[0].sky, near: FOG_NEAR, far: FOG_FAR },
    finishZ: FINISH_Z,
    rowGap: 1.7,
    curved: true,
    centerX,
    shadows: false,
    stages: TOUR_STAGES,
    stageAt,
    /** 매 프레임: 하늘·안개 색을 지금 구간에 맞추고, 먼 구간은 숨김 */
    updateView(scene, cameraZ, focusZ) {
      themeColor(scene.background, focusZ, 'sky');
      scene.fog.color.copy(scene.background);
      updateSections(cameraZ);
    },
  };
}
