// 테마 투어 공통: 구간 색이 이어지는 땅·노면·난간 띠, 난간 기둥, 레인 표시, 출발·결승 체크무늬, 구름
import { THREE } from '../../parts.js';
import { TOUR_STAGES, START_Z, FINISH_Z, centerX, stageAt, themeColor, IVORY } from './kit.js';

/** 중심선을 따라가며 구간마다 색이 바뀌는 띠 (정점 색상) */
function stripe(group, left, right, y, key) {
  const vertices = [], shades = [], indices = [];
  const color = new THREE.Color();
  const start = FINISH_Z - 35, end = START_Z + 46, segments = 180;
  for (let step = 0; step <= segments; step++) {
    const z = THREE.MathUtils.lerp(start, end, step / segments);
    const c = centerX(z);
    vertices.push(c + left, y, z, c + right, y, z);
    themeColor(color, z, key);
    shades.push(color.r, color.g, color.b, color.r, color.g, color.b);
    if (step < segments) indices.push(step * 2, step * 2 + 2, step * 2 + 1, step * 2 + 1, step * 2 + 2, step * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
  g.setIndex(indices);
  group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true })));
}

function checks(kit, z) {
  for (let i = 0; i < 18; i++) {
    for (let row = 0; row < 2; row++) {
      const color = (i + row) % 2 === 0 ? '#29304b' : '#fffdf8';
      kit.part(kit.group, kit.geo.block, color, centerX(z) + (i - 8.5) * 1.2, 0.086, z + 0.72 * (row - 0.5), 1.2, 0.02, 0.72, true);
    }
  }
}

export function buildRoad(kit) {
  const { group, geo, part, beam, local } = kit;
  stripe(group, -142, 142, -0.075, 'ground');
  stripe(group, -11.65, 11.65, 0.067, 'rail');
  stripe(group, -11, 11, 0.075, 'road');

  for (let i = 0; i < 61; i++) {
    const z = 33 - 4.5 * i;
    const nextZ = z - 4.5;
    const stage = stageAt(z);
    const trim = TOUR_STAGES[stage].rail;
    for (const side of [-1, 1]) {
      const x = centerX(z) + side * 11.4;
      const nextX = centerX(nextZ) + side * 11.4;
      part(group, geo.cylinder, trim, x, 0.61, z, 0.18, 1.2, 0.18);
      part(group, geo.ball, IVORY, x, 1.26, z, 0.225, 0.225, 0.225);
      beam(group, [x, 0.93, z], [nextX, 0.93, nextZ], 0.115, trim);
      for (const lane of [3.65, 7.3]) {
        part(group, geo.disk, stage === 2 ? '#a7e9f5' : '#fffbea', centerX(z) + side * lane, 0.082, z, 0.15, 0.22, 1, true)
          .rotation.x = -Math.PI / 2;
      }
    }
  }
  checks(kit, 25.1);
  checks(kit, FINISH_Z);

  for (const [z, offset, height, size] of [
    [14, -29, 14, 2.4], [-13, 34, 16, 2.8], [-42, -30, 15, 3.0], [-63, 27, 17, 2.7], [-143, -32, 18, 2.65], [-170, 31, 16, 3.12],
  ]) {
    const cloud = local(group, z, offset);
    part(cloud, geo.ball, '#fff7eb', 0, height, 0, size, size * 0.29, size * 0.55);
    part(cloud, geo.ball, '#fffaf2', -0.3 * size, height + size * 0.23, 0.03, size * 0.53, size * 0.35, size * 0.42);
    part(cloud, geo.ball, '#fffaf2', 0.29 * size, height + size * 0.28, 0.05, size * 0.48, size * 0.43, size * 0.38);
  }
}
