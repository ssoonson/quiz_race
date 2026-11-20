// 구간 5 🏮 노을 축제장: 천막, 등불 줄, 노을 해, 도는 관람차, 결승 문
import { THREE } from '../../parts.js';
import { centerX, CANDY, FINISH_Z } from './kit.js';

export function build(kit) {
  const { group, geo, part, beam, object, local, curveTube, portal, movingPart, paint } = kit;

  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = -183 - i * 8.5;
      const tent = local(group, z, side * (16.9 + (i % 3) * 2.6));
      part(tent, geo.cylinder, '#fff0cc', 0, 1.27, 0, 1.8, 2.54, 1.8);
      part(tent, geo.cone, ['#f083a6', '#a18add', '#f9ab7d'][i % 3], 0, 3.35, 0, 2.35, 2.6, 2.35);
      part(tent, geo.ball, '#fff3ab', 0, 4.69, 0, 0.22, 0.22, 0.22, true);
      const x = centerX(z) + 13.05 * side;
      part(group, geo.cylinder, '#b27893', x, 2.06, z, 0.119, 4.14, 0.119);
      part(group, geo.ball, '#ffe0a0', x, 4.26, z, 0.42, 0.51, 0.42, true);
    }
  }

  // 트랙을 가로지르는 등불 줄
  for (const z of [-188, -207, -222]) {
    const strand = local(group, z);
    for (const side of [-1, 1]) {
      beam(strand, [side * 12.7, 0, 0], [side * 12.7, 9.1, 0], 0.16, '#ba7996');
      part(strand, geo.ball, '#ffebbf', side * 12.7, 9.16, 0, 0.21, 0.21, 0.21);
    }
    const points = Array.from({ length: 7 }, (_, i) => {
      const d = (i - 3) / 3;
      return [d * 12.7, 6.7 + 2.4 * d ** 2, 0];
    });
    curveTube(strand, points, 0.073, '#b97391');
    for (let i = 0; i < points.length - 1; i++) {
      const x = (points[i][0] + points[i + 1][0]) / 2;
      const y = 6.7 + 2.4 * (x / 12.7) ** 2;
      beam(strand, [x, y, 0], [x, y - 0.28, 0], 0.045, '#c07890');
      part(strand, geo.ball, i % 2 ? '#ffd37a' : '#ffa78f', x, y - 0.59, 0, 0.35, 0.4, 0.35, true);
      part(strand, geo.cylinder, '#bc6e88', x, y - 0.22, 0, 0.14, 0.13, 0.14);
    }
  }

  // 노을 해
  const sunsetZ = FINISH_Z - 8;
  part(group, geo.ball, '#ffe7a2', centerX(sunsetZ) + 38, 19, sunsetZ, 6.2, 6.2, 6.2, true);

  // 관람차 (바퀴가 천천히 돎)
  const carnival = local(group, -213, -29);
  beam(carnival, [-4.6, 0, 0], [0, 7.6, 0], 0.35, '#ac7194');
  beam(carnival, [4.6, 0, 0], [0, 7.6, 0], 0.35, '#ac7194');
  const wheel = movingPart(carnival, 'wheel', 1.5, 0, 7.6, 0.42);
  object(wheel, new THREE.Mesh(geo.wheelRing, paint('#ffe3ba', true)), 0, 0, 0);
  object(wheel, new THREE.Mesh(geo.wheelRing, paint('#c97bb9')), 0, 0, 0).scale.setScalar(0.82);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x = Math.cos(a) * 6.27, y = Math.sin(a) * 6.27;
    beam(wheel, [0, 0, 0], [x, y, 0], 0.079, '#fbf0cf', true);
    part(wheel, geo.block, CANDY[i % 5], x, y, 0.21, 0.93, 0.91, 0.65).rotation.z = a + Math.PI / 2;
  }
  part(wheel, geo.ball, '#fff0b1', 0, 0, 0.38, 0.65, 0.65, 0.32, true);

  // 결승 문
  const finish = portal(FINISH_Z - 0.56, '#ef8bab', '#ffdf8b', 6.1);
  for (let i = 0; i < 9; i++) {
    const a = ((i + 1) * Math.PI) / 10;
    part(finish, geo.diamond, '#ffe69b', 11.92 * Math.cos(a), 4.32 + 6.1 * Math.sin(a), 0.29, 0.23, 0.43, 0.24, true);
  }
}
