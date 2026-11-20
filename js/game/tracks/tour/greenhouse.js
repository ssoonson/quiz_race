// 구간 1 🌿 온실 출발역: 유리 온실, 화분 줄, 출발 문
import { centerX, CANDY } from './kit.js';

function planter(kit, x, z, size, flower) {
  const { group, geo, part } = kit;
  part(group, geo.cylinder, '#eea782', x, size * 0.37, z, size * 0.78, size * 0.74, size * 0.78);
  part(group, geo.cylinder, '#ae7171', x, size * 0.73, z, size * 0.82, size * 0.17, size * 0.82);
  for (let leaf = 0; leaf < 5; leaf++) {
    const a = (leaf * 2 * Math.PI) / 5;
    const s = part(group, geo.ball, leaf % 2 ? '#70c986' : '#39a679',
      x + Math.cos(a) * size * 0.41, size * 1.47, z + Math.sin(a) * size * 0.41, size * 0.29, size * 0.83, size * 0.33);
    s.rotation.z = -Math.cos(a) * 0.62;
    s.rotation.x = Math.sin(a) * 0.62;
  }
  if (flower) part(group, geo.ball, flower, x, size * 2.05, z, size * 0.39, size * 0.27, size * 0.39);
}

function greenhouse(kit, z, x) {
  const { group, geo, part, beam, local } = kit;
  const h = local(group, z, x);
  part(h, geo.block, '#f4d4a8', 0, 0.22, 0, 11, 0.44, 12);
  part(h, geo.block, '#bcebdd', 0, 2.19, -0.07, 9.6, 3.85, 10.3);
  part(h, geo.block, '#72b9a4', 0, 0.38, 0, 9.81, 0.35, 10.51);
  for (const along of [-5.28, 0, 5.28]) {
    for (const bx of [-4.91, 4.91]) {
      beam(h, [bx, 0.35, along], [bx, 4.22, along], 0.137, '#65ae99');
      beam(h, [bx, 4.22, along], [0, 6.5, along], 0.136, '#70b8a9');
    }
  }
  for (const bx of [-4.9, 0, 4.9]) {
    const y = bx === 0 ? 6.5 : 4.22;
    beam(h, [bx, y, -5.34], [bx, y, 5.34], 0.14, '#6db2a1');
  }
  for (const end of [-1, 1]) {
    part(h, geo.block, '#fff4d6', 0, 1.73, end * 5.22, 2.3, 2.89, 0.14);
    part(h, geo.block, '#70bdad', 0, 1.71, end * 5.31, 1.79, 2.64, 0.1);
    for (const wx of [-3.24, 3.24]) part(h, geo.block, '#e4f5e5', wx, 2.26, end * 5.21, 2.02, 1.9, 0.14);
  }
  for (const side of [-1, 1]) {
    part(h, geo.block, '#cfefe3', side * 2.48, 5.27, 0, 5.39, 0.112, 10.22).rotation.z = -side * 0.429;
  }
}

export function build(kit) {
  for (const side of [-1, 1]) {
    for (let house = 0; house < 3; house++) greenhouse(kit, 22 - house * 15, side * (22 + (house % 2) * 3));
    for (let i = 0; i < 10; i++) {
      const z = 35 - i * 6.45;
      const x = centerX(z) + side * (13.65 + (i % 3) * 1.15);
      planter(kit, x, z, 0.72 + 0.18 * (i % 4), CANDY[(i + (side > 0 ? 3 : 0)) % CANDY.length]);
    }
  }
  kit.portal(35, '#6ab89e', '#fff0aa', 5.7);
}
