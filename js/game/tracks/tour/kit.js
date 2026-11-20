// 테마 투어 공통 도구: 구간 정보, 곡선 중심선, 도형 붙이기 도우미.
// 각 구간 파일(greenhouse.js 등)은 이 kit을 받아 자기 구간의 배경을 만듭니다.
import { THREE } from '../../parts.js';

export const TOUR_STAGES = [
  { name: '온실 출발역', icon: '🌿', sky: '#d8f2e4', ground: '#a1d693', road: '#f8e4bd', rail: '#4dae95' },
  { name: '무지개 정원', icon: '🌈', sky: '#a4ddf6', ground: '#cef49d', road: '#fff9f7', rail: '#f37ea9' },
  { name: '별빛 고가교', icon: '🌙', sky: '#736baa', ground: '#7579b6', road: '#565c87', rail: '#85d9f4' },
  { name: '산호 해변', icon: '🐚', sky: '#a0e9ef', ground: '#5cd4d6', road: '#f9e5b6', rail: '#50b9bc' },
  { name: '노을 축제장', icon: '🏮', sky: '#ffb8a9', ground: '#efb4c9', road: '#ffebed', rail: '#de719d' },
];

export const START_Z = 26;
export const STAGE_LENGTH = 52;
export const FINISH_Z = START_Z - TOUR_STAGES.length * STAGE_LENGTH; // -234

export const CANDY = ['#f777ad', '#ffd34e', '#76dff0', '#ac88ee', '#76d989'];
export const IVORY = '#fff3cb';
export const CORAL = '#fb947d';

/** 곡선 코스 중심선의 x 좌표 */
export const centerX = (z) => {
  const phase = (START_Z - z) / (STAGE_LENGTH * TOUR_STAGES.length);
  return 11 * Math.sin(phase * Math.PI * 3) + 4 * Math.sin(phase * Math.PI * 6);
};

/** z 위치가 몇 번째 구간인지 (0~4) */
export const stageAt = (z) =>
  THREE.MathUtils.clamp(Math.floor((START_Z - z) / STAGE_LENGTH), 0, TOUR_STAGES.length - 1);

const stageColors = TOUR_STAGES.map((s) =>
  Object.fromEntries(['sky', 'ground', 'road', 'rail'].map((k) => [k, new THREE.Color(s[k])])));

/** 구간 경계에서 색이 부드럽게 섞이도록 z 위치의 테마 색을 계산 */
export function themeColor(result, z, key) {
  const section = (START_Z - z) / STAGE_LENGTH;
  const left = Math.floor(section + 0.16) - 1;
  const a = THREE.MathUtils.clamp(left, 0, TOUR_STAGES.length - 1);
  const b = THREE.MathUtils.clamp(left + 1, 0, TOUR_STAGES.length - 1);
  const blend = THREE.MathUtils.smoothstep(section - left - 1, -0.16, 0.16);
  return result.lerpColors(stageColors[a][key], stageColors[b][key], blend);
}

/**
 * 투어 코스를 만드는 동안 쓰는 도구 모음.
 *  group     코스 전체
 *  sections  구간별 그룹 5개 (카메라에서 먼 구간은 통째로 숨겨 성능 확보)
 *  animated  움직이는 소품 목록
 */
export function createTourKit() {
  const group = new THREE.Group();
  const sections = TOUR_STAGES.map(() => {
    const section = new THREE.Group();
    group.add(section);
    return section;
  });
  const animated = [];
  const geo = {
    block: new THREE.BoxGeometry(1, 1, 1),
    ball: new THREE.SphereGeometry(1, 12, 8),
    ballSmall: new THREE.SphereGeometry(1, 7, 5), // 반지름 0.5 미만인 구에 자동 사용
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 8),
    diamond: new THREE.OctahedronGeometry(1),
    disk: new THREE.CircleGeometry(1, 14),
    wheelRing: new THREE.TorusGeometry(6.3, 0.14, 8, 40),
    halo: new THREE.TorusGeometry(1, 0.06, 6, 24),
  };
  const paints = new Map();

  /** matte=true면 빛을 받지 않는 밝은 재질(창문 불빛, 등불 등) */
  function paint(color, matte = false) {
    const key = color + (matte ? '|matte' : '');
    if (!paints.has(key)) {
      paints.set(key, matte ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0 }));
    }
    return paints.get(key);
  }
  /** item을 놓습니다. parent가 코스 전체(group)면 z에 맞는 구간 그룹에 넣습니다. */
  function object(parent, item, x, y, z) {
    item.position.set(x, y, z);
    (parent === group ? sections[stageAt(z)] : parent).add(item);
    return item;
  }
  function part(parent, geometry, color, x, y, z, sx, sy, sz, matte = false) {
    if (geometry === geo.ball && Math.max(sx, sy, sz) < 0.5) geometry = geo.ballSmall; // 작은 구는 면을 적게
    const item = object(parent, new THREE.Mesh(geometry, paint(color, matte)), x, y, z);
    item.scale.set(sx, sy, sz);
    return item;
  }
  /** 두 점 a, b를 잇는 기둥 */
  function beam(parent, a, b, radius, color, matte = false) {
    const start = new THREE.Vector3(...a);
    const delta = new THREE.Vector3(...b).sub(start);
    const mid = start.addScaledVector(delta, 0.5);
    const tube = part(parent, geo.cylinder, color, mid.x, mid.y, mid.z, radius, delta.length(), radius, matte);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return tube;
  }
  function curveTube(parent, points, size, color, matte = false) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return object(parent, new THREE.Mesh(new THREE.TubeGeometry(curve, 30, size, 6, false), paint(color, matte)), 0, 0, 0);
  }
  /** 코스 중심선 기준 (x, z)에 빈 그룹을 놓습니다 */
  function local(parent, z, x = 0) {
    return object(parent, new THREE.Group(), centerX(z) + x, 0, z);
  }
  /** 움직이는 소품: container는 고정, 반환된 그룹이 움직임 */
  function movingPart(container, kind, phase, x = 0, y = 0, z = 0) {
    const m = object(container, new THREE.Group(), x, y, z);
    m.userData.noBake = true;
    container.userData.kind = kind;
    container.userData.animated = m;
    container.userData.phase = phase;
    animated.push(container);
    return m;
  }
  /** 아치형 문 */
  function portal(z, color, accent, topHeight = 8) {
    const gate = local(group, z);
    for (const side of [-1, 1]) {
      const x = side * 11.92;
      part(gate, geo.block, color, x, 2.1, 0, 0.72, 4.2, 0.71);
      part(gate, geo.ball, accent, x, 4.25, 0, 0.42, 0.42, 0.42);
    }
    const points = Array.from({ length: 15 }, (_, i) => {
      const a = (i * Math.PI) / 14;
      return [Math.cos(a) * 11.92, 4.25 + topHeight * Math.sin(a), 0];
    });
    curveTube(gate, points, 0.29, color);
    curveTube(gate, points.map(([x, y, d]) => [x * 0.985, y - 0.46, d + 0.13]), 0.13, accent);
    return gate;
  }

  return { group, sections, animated, geo, paint, object, part, beam, curveTube, local, movingPart, portal };
}
