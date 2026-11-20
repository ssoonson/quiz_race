// 🚀 우주 스피드웨이: 별, 소행성, 링
import { THREE, add, ball, material, mesh, bakeInto } from '../parts.js';
import { buildStraightTrack } from './course.js';

export const colors = { sky: '#101336', ground: '#232953', road: '#6557ad', rail: '#ffe681', accent: '#94a8ff' };

function starfield(root) {
  const stars = add(root, new THREE.Group());
  for (let i = 0; i < 65; i++) {
    const theta = i * 2.4;
    const star = ball(0.07 + (i % 3) * 0.04, i % 4 ? '#fff7c4' : '#9be9ff', { shadow: false });
    add(stars, star, Math.sin(theta) * (20 + (i % 8) * 12), 9 + (i % 9) * 2, 42 - ((i * 29) % 170));
  }
  bakeInto(stars, { deep: true, unlit: true, castShadow: false, receiveShadow: false }); // 스스로 빛나는 별 65개 → 1덩어리
}

function asteroid(root, x, z, i) {
  const a = mesh(new THREE.DodecahedronGeometry(1.1 + (i % 3) * 0.35, 0), i % 2 ? '#a5a2d5' : '#e2c997');
  a.rotation.set(i * 0.6, i * 0.24, i * 0.44);
  add(root, a, x, 1.6, z);
}

export function decorate(root) {
  starfield(root);
  for (let i = 0; i < 30; i++) asteroid(root, (i % 2 ? 1 : -1) * (18 + (i % 4) * 6), 30 - i * 4.5, i);
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.14, 6, 28), material(i % 2 ? '#9c88fa' : '#ffe17a'));
    ring.rotation.y = Math.PI / 2;
    add(root, ring, i % 2 ? 25 : -25, 10, 18 - i * 20);
  }
}

export const build = () => buildStraightTrack({ colors, decorate });
