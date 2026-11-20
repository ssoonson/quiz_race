// 구간 3 🌙 별빛 고가교: 불 켜진 건물, 반짝이는 별, 고리 달린 행성, 보라색 문
import { centerX } from './kit.js';

export function build(kit) {
  const { group, geo, part, local, portal } = kit;

  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -83 - i * 9.3;
      const x = centerX(z) + side * (18.5 + (i % 3) * 4.8);
      const h = 7 + ((i * 7 + (side > 0 ? 3 : 0)) % 11);
      const w = 5.2 + (i % 3);
      part(group, geo.block, ['#49497d', '#5c5494', '#6675aa'][i % 3], x, h * 0.5, z, w, h, 5.8);
      part(group, geo.block, '#8584b9', x, h + 0.27, z, w * 0.68, 0.55, 4.6);
      for (let floor = 0; floor < Math.floor(h / 2.1); floor++) {
        for (const offset of [-1.52, 0, 1.52]) {
          const light = (i + floor) % 3 === 0 ? '#fde5a5' : '#a4d6fc';
          part(group, geo.block, light, x + offset, 1.48 + floor * 2.05, z + 2.92, 0.66, 0.82, 0.055, true);
          part(group, geo.block, light, x - side * (w / 2 + 0.016), 1.48 + floor * 2.05, z + offset, 0.055, 0.82, 0.66, true);
        }
      }
      part(group, geo.diamond, '#a2edfa', x, h + 1.2, z, 0.38, 0.71, 0.38, true);
    }
  }
  for (let i = 0; i < 32; i++) {
    const r = 0.13 + (i % 4) * 0.061;
    part(group, geo.diamond, i % 3 === 0 ? '#ffe7a6' : '#e0f3ff',
      Math.sin(i * 2.11) * (22 + (i % 4) * 9), 10 + (i % 8) * 2.36, -77 - ((i * 17) % 67), r, r * 1.54, r, true);
  }
  const planet = local(group, -115, 27.4);
  part(planet, geo.ball, '#eab7f4', 0, 16.42, 0, 3.7, 3.7, 3.7);
  part(planet, geo.halo, '#fff0c0', 0, 16.45, 0, 4.98, 4.98, 4.98, true).rotation.set(1.14, 0.18, -0.23);
  for (const z of [-78, -101, -124]) portal(z, '#786fc6', '#a3e8ff', 5.9);
}
