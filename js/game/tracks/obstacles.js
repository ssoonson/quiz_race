// 직선 트랙(우주·바다)의 움직이는 장애물 4종과, 모든 트랙 공용 장애물 움직임.
import { THREE, add, ball, box, cylinder, bakeInto } from '../parts.js';

const BUILDERS = {
  // 흔들리는 공: 기둥과 공이 함께 좌우로 흔들립니다.
  ball(group, color) {
    const swing = add(group, new THREE.Group());
    add(swing, ball(0.84, color), 0, 1.1, 0);
    add(swing, cylinder(0.12, 0.12, 2.2, '#f4f4f5'), 0, 1.1, 0);
    return swing;
  },
  seesaw(group, color) {
    add(group, cylinder(0.18, 0.18, 0.85, '#f4e2bb'), 0, 0.45, 0);
    const deck = add(group, new THREE.Group(), 0, 0.93, 0);
    add(deck, box(3.9, 0.23, 1.35, color));
    return deck;
  },
  platform(group, color) {
    const plat = add(group, new THREE.Group(), 0, 0.28, 0);
    add(plat, box(2.7, 0.3, 2.2, color));
    add(plat, box(2.6, 0.08, 0.22, '#ffffff'), 0, 0.19, -0.65);
    return plat;
  },
  spinner(group, color) {
    add(group, cylinder(0.11, 0.11, 2.3, '#ffe6a2'), 0, 1.15, 0);
    const arm = add(group, new THREE.Group(), 0, 1.6, 0);
    add(arm, box(3.8, 0.35, 0.35, color));
    return arm;
  },
};

// 직선 트랙 장애물 배치: 줄마다 같은 종류 4개
const STRAIGHT_ROWS = [
  { kind: 'ball', z: 5, halfWidth: 1.5, halfDepth: 0.9, clearHeight: 2.3 },
  { kind: 'seesaw', z: -21, halfWidth: 1.95, halfDepth: 0.7, clearHeight: 1.6 },
  { kind: 'platform', z: -47, halfWidth: 1.35, halfDepth: 1.1, clearHeight: 0.9 },
  { kind: 'spinner', z: -73, halfWidth: 1.9, halfDepth: 1.9, clearHeight: 1.95 },
];
export const STRAIGHT_OBSTACLES = STRAIGHT_ROWS.flatMap((row, r) =>
  [-8.2, -2.75, 2.7, 8.15].map((x) => ({ ...row, x, row: r })));

export function buildObstacle(parent, { kind, x, z }, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.kind = kind;
  group.userData.phase = (z + 160) * 0.1 + x;
  const moving = BUILDERS[kind](group, color); // 항상 Group: 움직이는 부분
  moving.userData.noBake = true;
  group.userData.animated = moving;
  // 성능: 고정 받침대 1덩어리 + 움직이는 부분 1덩어리
  bakeInto(group);
  bakeInto(moving, { deep: true });
  parent.add(group);
  return group;
}

/** 모든 트랙의 움직이는 소품을 시간에 맞춰 움직입니다 (kind별 동작) */
export function animateObstacles(items, seconds) {
  for (const o of items) {
    const { kind, animated: a, phase } = o.userData;
    if (!a) continue;
    const t = seconds * 1.8 + phase;
    switch (kind) {
      case 'ball': a.position.x = Math.sin(t) * 0.65; break;
      case 'candy': // 사탕 공: 좌우로 흔들리며 돌고 살짝 오르내림
        a.position.x = Math.sin(t) * 0.65;
        a.rotation.y = t * 0.46;
        a.position.y = a.userData.baseY + Math.cos(t) * 0.15;
        break;
      case 'seesaw': a.rotation.z = Math.sin(t) * 0.22; break;
      case 'platform': a.position.y = 0.28 + Math.sin(t) * 0.23; break;
      case 'spinner': a.rotation.y = t * 0.7; break;
      case 'carousel': a.rotation.y = t * 0.42; break;
      case 'wheel': a.rotation.z = t * 0.16; break;
    }
  }
}
