// 움직이는 장애물: 굴러가는 돌(boulder), 회전 막대(spinner)
// '우리 반 콩콩 달리기'와 '퀴즈 레이스'가 같은 파일을 씁니다.
//
// 장애물 한 개
//   boulder: { kind: 'boulder', x, z, r, amp, speed, phase, clearHeight }
//            x를 가운데로 좌우 amp만큼 굴러다님 (x = x + amp·sin(speed·t + phase))
//   spinner: { kind: 'spinner', x, z, len, speed, phase, clearHeight, barY }
//            (x, z)의 기둥을 중심으로 반지름 len의 막대가 돎 (각도 = speed·t + phase)
//   x는 트랙 중심선 기준, t는 경기 시작 후 초. cx는 트랙 중심선 함수(곡선 트랙).
import { THREE, add, ball, box, cylinder, bakeInto } from './parts.js';

const RUNNER_RADIUS = 0.4;

export const boulderX = (o, t) => o.x + o.amp * Math.sin(o.speed * t + o.phase);
export const spinAngle = (o, t) => o.speed * t + o.phase;

/**
 * (x, z)에 높이 j로 떠 있는 선수가 장애물에 닿는지
 * @param pad 판정을 넉넉하게 (자동 점프용으로 미리 알아챌 때)
 */
export function moverHit(o, x, z, j, t, cx = () => 0, pad = 0) {
  if (o.kind === 'boulder') {
    const dx = x + cx(z) - (boulderX(o, t) + cx(o.z));
    const dz = z - o.z;
    return Math.hypot(dx, dz) < o.r + RUNNER_RADIUS + pad && j < o.clearHeight * 0.75;
  }
  if (o.kind === 'spinner') {
    // 곡선 트랙에서도 맞도록 실제 좌표 차이로 계산
    const px = x + cx(z) - (o.x + cx(o.z));
    const pz = z - o.z;
    if (Math.hypot(px, pz) < 0.35 + RUNNER_RADIUS + pad) return true; // 가운데 기둥은 점프로 못 넘음
    const a = spinAngle(o, t);
    const along = px * Math.cos(a) + pz * Math.sin(a);
    const across = Math.abs(-px * Math.sin(a) + pz * Math.cos(a));
    return Math.abs(along) <= o.len + 0.2 && across < 0.22 + RUNNER_RADIUS + pad && j < o.clearHeight * 0.75;
  }
  return false;
}

/** 회전 막대의 가운데 기둥: 점프로 못 넘으니 자동 선수가 옆으로 비켜 가도록 '피할 장애물'로 */
export const moverPosts = (movers) => movers.filter((o) => o.kind === 'spinner')
  .map((o) => ({ kind: 'post', x: o.x, z: o.z, halfWidth: 0.5, halfDepth: 0.5, dodge: true }));

/** 이 장애물 근처인지 (앞뒤로) — 계산을 줄이기 위한 빠른 거르기 */
export const moverNear = (o, z, range = 3) => Math.abs(z - o.z) < (o.kind === 'spinner' ? o.len : o.r) + range;

/**
 * 3D 모양 만들기
 * @returns {{ group, update(t) }}  update(t)를 매 프레임 부르면 굴러가고 돎
 */
export function buildMover(o, cx = () => 0, color = '#ff6c4a') {
  const group = new THREE.Group();
  group.position.set(cx(o.z) + o.x, 0, o.z);

  if (o.kind === 'boulder') {
    const rock = add(group, new THREE.Group(), 0, o.r, 0);
    add(rock, ball(o.r, '#8d8f98'));
    // 굴러가는 게 보이도록 무늬 점
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, b = i * 1.3;
      const dot = ball(o.r * 0.22, i % 2 ? '#6e7079' : '#b4b6bd');
      add(rock, dot, Math.cos(a) * Math.cos(b) * o.r * 0.9, Math.sin(b) * o.r * 0.9, Math.sin(a) * Math.cos(b) * o.r * 0.9);
    }
    bakeInto(rock);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(o.r * 0.95, 20),
      new THREE.MeshBasicMaterial({ color: '#2a2f3a', transparent: true, opacity: 0.18, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    add(group, shadow, 0, 0.09, 0);
    return {
      group,
      update(t) {
        const x = boulderX(o, t);
        rock.position.x = x - o.x;
        shadow.position.x = x - o.x;
        rock.rotation.z = -(x - o.x) / o.r; // 굴러간 거리만큼 회전
      },
    };
  }

  // spinner
  add(group, cylinder(0.6, 0.75, 0.25, '#4b4f63'), 0, 0.12, 0);
  add(group, cylinder(0.32, 0.32, o.barY + 0.5, '#ffd34e'), 0, (o.barY + 0.5) / 2, 0);
  const arm = add(group, new THREE.Group(), 0, o.barY, 0);
  const stripes = Math.round(o.len * 2 / 1.2);
  for (let k = 0; k < stripes; k++) {
    add(arm, box((o.len * 2) / stripes, 0.36, 0.36, k % 2 ? '#ffffff' : color), -o.len + (k + 0.5) * ((o.len * 2) / stripes), 0, 0);
  }
  for (const s of [-1, 1]) add(arm, ball(0.3, color), s * o.len, 0, 0);
  bakeInto(arm);
  bakeInto(group);
  return {
    group,
    update(t) { arm.rotation.y = -spinAngle(o, t); }, // three.js의 y회전 방향과 판정 각도를 맞춤
  };
}
