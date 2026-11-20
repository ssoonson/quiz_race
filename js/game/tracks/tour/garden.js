// 구간 2 🌈 무지개 정원: 사탕색 나무, 라벤더 언덕, 도는 풍차, 사탕 장식 문
import { THREE } from '../../parts.js';
import { centerX, CANDY, IVORY } from './kit.js';

export function build(kit) {
  const { group, geo, part, object, local, portal, movingPart } = kit;

  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const z = -28 - i * 4.95;
      const x = centerX(z) + side * (14.1 + ((i * 7) % 5) * 2.6);
      const size = 1.08 + (i % 3) * 0.28;
      part(group, geo.cylinder, '#ad7d55', x, 1.7 * size, z, 0.21 * size, 3.4 * size, 0.21 * size);
      const crown = size * 1.36;
      part(group, geo.ball, CANDY[(i + (side > 0 ? 2 : 0)) % CANDY.length], x, 3.82 * size, z, crown, crown * 0.8, crown * 0.88);
      if (i % 2 === 1) {
        part(group, geo.cone, '#ebd3f6', x + side * (15 + (i % 3) * 6), 4.3 + (i % 3), z - 4, 9 + (i % 3), 8.6 + (i % 3) * 2, 8);
      }
    }
  }

  // 풍차 (날개가 돎)
  const mill = local(group, -51, -18.5);
  part(mill, geo.cylinder, '#fff2c2', 0, 2.75, 0, 2.05, 5.5, 2.05);
  part(mill, geo.cone, '#f58bb3', 0, 6.6, 0, 2.64, 2.45, 2.64);
  part(mill, geo.block, '#ef9bbb', 0, 0.98, 2.02, 0.86, 1.98, 0.15);
  const vanes = movingPart(mill, 'wheel', 0, 0, 4.77, 2.29);
  for (let i = 0; i < 4; i++) {
    const blade = object(vanes, new THREE.Group(), 0, 0, 0);
    blade.rotation.z = (i * Math.PI) / 2;
    part(blade, geo.block, '#f2ba76', 0, 1.44, 0, 0.16, 2.88, 0.16);
    part(blade, geo.block, i % 2 === 0 ? '#89e4e7' : '#ffc7d9', 0.29, 2.01, 0.02, 0.68, 1.48, 0.12);
  }
  part(vanes, geo.ball, IVORY, 0, 0, 0.13, 0.45, 0.45, 0.23);

  const gate = portal(-27, '#f471aa', '#ffde6d', 5.05);
  for (let i = 0; i < 7; i++) {
    const a = ((i + 1) * Math.PI) / 8;
    part(gate, geo.ball, CANDY[i % 5], Math.cos(a) * 11.92, 4.26 + 5.05 * Math.sin(a), 0.32, 0.33, 0.33, 0.26);
  }
}
