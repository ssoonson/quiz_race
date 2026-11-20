// 구간 4 🐚 산호 해변: 야자수, 산호, 물결, 줄무늬 등대
import { THREE } from '../../parts.js';
import { centerX, CORAL } from './kit.js';

function palm(kit, z, side, size) {
  const { group, geo, part, beam, object } = kit;
  const tree = object(group, new THREE.Group(), centerX(z) + side * (16.5 + Math.abs(Math.sin(z)) * 7), 0, z);
  beam(tree, [0, 0, 0], [side * size * 0.73, 4.3 * size, 0], 0.33 * size, '#ac7e58');
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    part(tree, geo.ball, i % 2 ? '#49bd83' : '#70d499',
      side * size * 0.73 + Math.sin(a) * size * 1.18, 4.32 * size, Math.cos(a) * size * 1.18,
      0.53 * size, 0.2 * size, 1.66 * size).rotation.set(0.21, a, 0, 'YXZ');
  }
}

export function build(kit) {
  const { group, geo, part, beam, local, portal } = kit;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -134 - i * 5.3;
      palm(kit, z, side, 0.73 + ((i * 7) % 9) * 0.062);
      const x = centerX(z) + side * (14.4 + (i % 3) * 0.45);
      if (i % 2 === 0) {
        for (let branch = -1; branch <= 1; branch++) {
          const crown = [x + branch * 0.79, 1.69 + (1 - Math.abs(branch)) * 0.57, z + branch * 0.26];
          const color = i % 3 ? CORAL : '#ed82b5';
          beam(group, [x, 0.34, z], crown, 0.17, color);
          part(group, geo.ball, color, ...crown, 0.195, 0.2, 0.18);
        }
      }
      part(group, geo.halo, '#a4f2eb', centerX(z) + side * (27 + (i % 3) * 3), -0.056, z, 1.4, 1.4, 0.5, true)
        .rotation.x = -Math.PI / 2;
    }
  }
  const tower = local(group, -154, 24);
  for (let i = 0; i < 5; i++) {
    const r = 1.77 - i * 0.12;
    part(tower, geo.cylinder, i % 2 ? '#f58c81' : '#fff5cf', 0, i * 1.37 + 0.68, 0, r, 1.37, r);
  }
  part(tower, geo.cylinder, '#fee3a1', 0, 7.5, 0, 1.22, 1.3, 1.22);
  part(tower, geo.cone, '#e87a76', 0, 8.65, 0, 1.73, 1.48, 1.73);
  portal(-130, '#479ea5', '#ffdf95', 4.8);
}
