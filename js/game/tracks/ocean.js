// 🌊 바다 산책로: 야자수, 조개, 물방울
import { THREE, add, lowBall, box, cylinder } from '../parts.js';
import { buildStraightTrack } from './course.js';

export const colors = { sky: '#8fe5f6', ground: '#7acfae', road: '#77c8de', rail: '#fff0bb', accent: '#ffb798' };

function palm(root, x, z) {
  const tree = new THREE.Group();
  add(tree, cylinder(0.18, 0.26, 3.8, '#a5764f', 8), 0, 1.9, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const leaf = add(tree, box(0.36, 0.13, 3.2, '#45bc9c'), Math.sin(a) * 1.25, 3.7, Math.cos(a) * 1.25);
    leaf.rotation.y = a;
    leaf.rotation.x = 0.37;
  }
  add(root, tree, x, 0, z);
}

export function decorate(root) {
  for (let i = 0; i < 28; i++) {
    for (const side of [-1, 1]) palm(root, side * (17 + (i % 3) * 2), 28 - i * 5.5);
  }
  for (let i = 0; i < 25; i++) {
    const shell = lowBall(0.65 + (i % 3) * 0.2, i % 2 ? '#ffe1ad' : '#ffaab6');
    shell.scale.set(1, 0.5, 1);
    add(root, shell, (i % 2 ? 1 : -1) * (23 + (i % 4) * 3), 0.4, 25 - i * 5.4);
  }
  for (const z of [-10, -46, -79]) {
    const bubble = lowBall(2, '#d0faff', { shadow: false });
    bubble.material.transparent = true;
    bubble.material.opacity = 0.36;
    add(root, bubble, 27, 6, z);
  }
}

export const build = () => buildStraightTrack({ colors, decorate });
