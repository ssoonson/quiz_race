// 레이서 캐릭터 공통 조립 (에셋 v4 디자인).
// 헬멧 + 운동복 + 배낭 + 운동화. 참가 순번(index)에 따라 몸 색, 장식 색, 얼굴색, 모자 종류가 달라집니다.
// 몸 모양(둥근 블록 / 젤리)은 block.js, jelly.js가 shape으로 정해 줍니다.
import { THREE, add, joint, material, bakeInto } from '../parts.js';

export const RACER_PALETTE = [
  '#fb527d', '#ffbe29', '#49d86b', '#33a6f6', '#9265e6', '#ff8641',
  '#15c8ce', '#f278b8', '#597cf3', '#a6db35', '#f5534c', '#9f80ef',
  '#2fc0a1', '#ffcf3e', '#ea70dc', '#466ac7', '#74da49', '#fe7054',
  '#2bbcf4', '#a161cc', '#e75b91', '#ed9b32', '#68c65e', '#778efb',
];
const ACCENTS = ['#fff0a3', '#ff9dca', '#fff4d8', '#79edfa', '#c9afff'];
const FACES = ['#ffd68e', '#ffe6bb', '#edb78b'];
const DARK = '#283154';
const IVORY = '#fff8ec';

// 도형은 모든 선수가 함께 씁니다(만들 때만 쓰고, 합친 뒤에는 각자 한 덩어리).
let shared;
function geometries() {
  shared ??= {
    round: new THREE.SphereGeometry(1, 14, 9),       // 몸통·헬멧처럼 큰 부분
    roundMid: new THREE.SphereGeometry(1, 10, 7),    // 손·모자 방울
    roundSmall: new THREE.SphereGeometry(1, 6, 4),   // 눈·반짝이처럼 아주 작은 부분
    stud: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 8),
    smile: new THREE.TorusGeometry(0.106, 0.019, 6, 12, Math.PI),
    softBlock: roundedBlock(),
  };
  return shared;
}

function roundedBlock() {
  const s = new THREE.Shape();
  s.moveTo(-0.57, -0.73);
  s.lineTo(0.57, -0.73);
  s.quadraticCurveTo(0.73, -0.73, 0.73, -0.57);
  s.lineTo(0.73, 0.57);
  s.quadraticCurveTo(0.73, 0.73, 0.57, 0.73);
  s.lineTo(-0.57, 0.73);
  s.quadraticCurveTo(-0.73, 0.73, -0.73, 0.57);
  s.lineTo(-0.73, -0.57);
  s.quadraticCurveTo(-0.73, -0.73, -0.57, -0.73);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 1.46, bevelEnabled: true, bevelThickness: 0.27, bevelSize: 0.27,
    bevelSegments: 2, curveSegments: 2, steps: 1,
  });
  g.translate(0, 0, -0.73);
  return g;
}

/** 크기를 조절한 부품 하나. 작은 구는 면이 적은 구로 자동 교체(성능) */
function part(parent, geometry, color, x, y, z, sx, sy, sz) {
  const g = shared;
  if (geometry === g.round) {
    const size = Math.max(sx, sy, sz);
    geometry = size < 0.1 ? g.roundSmall : size < 0.4 ? g.roundMid : g.round;
  }
  const m = add(parent, new THREE.Mesh(geometry, material(color, { roughness: 0.36 })), x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * @param shape 'block' | 'jelly'
 * @param index 참가 순번 (색·모자 결정)
 */
export function buildRacer(shape, index) {
  const g = geometries();
  const isBlock = shape === 'block';
  const body = isBlock ? g.softBlock : g.round;

  const color = new THREE.Color(RACER_PALETTE[index % RACER_PALETTE.length]);
  const accent = new THREE.Color(ACCENTS[index % ACCENTS.length]);
  const trim = color.clone().multiplyScalar(0.57);
  const face = new THREE.Color(FACES[index % FACES.length]);

  const model = new THREE.Group();
  model.rotation.y = Math.PI; // +Z를 보고 만든 모델을 달리는 방향(-Z)으로 돌림
  model.userData.baseY = 0.078;

  // 몸통·배낭·명찰
  part(model, body, color, 0, 1.19, 0, 0.61, 0.68, 0.45);
  part(model, body, trim, 0, 0.94, 0.015, 0.6, 0.12, 0.449);
  part(model, body, trim, 0, 1.26, -0.39, 0.4, 0.44, 0.21);
  part(model, body, accent, 0, 1.29, -0.51, 0.32, 0.34, 0.16);
  part(model, body, IVORY, 0, 1.32, -0.65, 0.14, 0.074, 0.035);
  part(model, body, accent, 0, 1.29, 0.425, 0.21, 0.12, 0.06);

  // 헬멧과 바이저 속 얼굴
  part(model, body, color, 0, 2.14, 0, 0.745, 0.708, 0.63);
  if (isBlock) {
    part(model, body, trim, 0, 1.98, 0.367, 0.61, 0.4, 0.335);
    part(model, body, face, 0, 1.98, 0.44, 0.525, 0.315, 0.282);
  } else {
    part(model, g.round, trim, 0, 1.98, 0.481, 0.575, 0.345, 0.264);
    part(model, g.round, face, 0, 1.98, 0.67, 0.466, 0.265, 0.112);
  }
  const eyesZ = isBlock ? 0.736 : 0.774;
  for (const side of [-1, 1]) {
    part(model, g.roundSmall, DARK, side * 0.173, 2.025, eyesZ, 0.057, 0.08, 0.024);
    part(model, g.roundSmall, IVORY, side * 0.173 - 0.014, 2.047, eyesZ + 0.021, 0.015, 0.018, 0.009);
    const button = part(model, g.stud, accent, side * 0.704, 2.07, 0, 0.244, 0.16, 0.244);
    button.rotation.z = Math.PI / 2;
  }
  const smile = part(model, g.smile, DARK, 0, 1.926, isBlock ? 0.748 : 0.791, 1, 0.58, 1);
  smile.rotation.x = Math.PI;
  part(model, body, accent, 0, 2.48, -0.542, 0.119, 0.26, 0.15);

  // 모자 3종 (4명마다 바뀜)
  const hat = Math.floor(index / 4) % 3;
  if (hat === 0) {
    part(model, g.stud, trim, 0, 2.49, 0.226, 0.682, 0.1, 0.55);
    part(model, g.stud, accent, 0, 2.55, 0.228, 0.668, 0.1, 0.53);
  } else if (hat === 1) {
    part(model, g.cone, accent, 0, 2.82, 0, 0.35, 0.46, 0.35);
    part(model, g.round, IVORY, 0, 3.05, 0, 0.095, 0.095, 0.095);
  } else {
    part(model, body, accent, 0, 2.72, -0.03, 0.39, 0.136, 0.37);
    part(model, g.round, IVORY, 0, 2.84, -0.05, 0.19, 0.15, 0.19);
  }

  // 팔(어깨 관절)과 다리(엉덩이 관절). 손·운동화도 관절에 붙어 함께 움직입니다.
  const arm = (side) => {
    const j = joint(model, side * 0.65, 1.52);
    part(j, body, color, side * 0.095, -0.2, 0, 0.2, 0.31, 0.206);
    part(j, g.round, IVORY, side * 0.14, -0.427, 0.015, 0.195, 0.19, 0.2);
    return j;
  };
  const leg = (side) => {
    const j = joint(model, side * 0.3, 0.81);
    part(j, body, trim, 0, -0.28, 0, 0.23, 0.35, 0.24);
    part(j, body, IVORY, 0, -0.64, 0.092, 0.266, 0.164, 0.33);
    part(j, body, accent, 0, -0.58, 0.125, 0.273, 0.155, 0.335);
    return j;
  };
  const legL = leg(-1), legR = leg(1), armL = arm(-1), armR = arm(1);

  // 성능: 몸 1덩어리 + 팔다리 4덩어리
  bakeInto(model);
  [armL, armR, legL, legR].forEach((j) => bakeInto(j));
  model.position.y = model.userData.baseY;

  return { model, armL, armR, legL, legR, color: '#' + color.getHexString() };
}

/** 두 레이서 공통 달리기 동작. phase: 걸음 위상, jump: 점프 높이 */
export function animateRacer(r, phase, jump) {
  const step = Math.sin(phase);
  const airborne = jump > 0.15;
  r.legL.rotation.x = airborne ? -0.55 : step * 0.52;
  r.legR.rotation.x = airborne ? 0.35 : -step * 0.52;
  r.armL.rotation.x = airborne ? 0.9 : -step * 0.46;
  r.armR.rotation.x = airborne ? 0.9 : step * 0.46;
  r.model.rotation.z = Math.sin(phase * 0.5) * 0.06;
  r.model.position.y = r.model.userData.baseY + jump + Math.abs(step) * 0.085;
}
