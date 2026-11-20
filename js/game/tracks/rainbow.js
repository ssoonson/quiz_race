// 🌈 무지개 운동장 (에셋 v4): 흰색 곡선 트랙, 분홍 난간, 무지개 아치, 사탕나무·오두막·라벤더 언덕,
// 회전목마·사탕 공·발판·시소. 트랙이 곡선이라 centerX(z)로 중심선을 알려 줍니다.
import { THREE, add, bakeInto } from '../parts.js';

const FINISH_Z = -100;

/** 곡선 트랙 중심선의 x 좌표 */
export const centerX = (z) => {
  const progress = (26 - z) / 126;
  return 7.2 * (Math.cos(2 * Math.PI * progress) - 1) + 9 * progress;
};

const SKY = '#91d3ef';
const FOG = '#d4fbd2';
const GRASS = '#d4ffa6';
const PINK = '#f575ab';
const CREAM = '#fff4b4';
const TEAL = '#47e0e9';
const GOLD = '#ffd355';
const WHITE = '#fffcf4';
const TREE_COLORS = ['#77e96c', '#50dd87', '#9aeb62', '#f99abc'];
const CANDY = ['#ff739f', '#ffe64e', '#3cdbec', '#9c72ea', '#83e873'];
const BANDS = ['#ff5578', '#ffae45', '#ffe652', '#46cfed', '#a477ef'];

// ---------- 장애물 배치 (선수의 점프·회피 계산에 사용) ----------
const CAROUSELS = [[-4.9, 9, 0], [4.4, 0.8, 1], [-4.4, -65, 2], [4.7, -72, 3]];
const CANDY_ROWS = [-10, -56];
const CANDY_X = [-6.6, 0, 6.6];
const PAD_ROWS = [-24, -41, -85]; // -41은 시소, 나머지는 발판
const PAD_X = [0, 1, 2, 3].map((i) => -7.7 + i * 5.1);

export const obstacles = [
  ...CAROUSELS.map(([x, z]) => ({ kind: 'carousel', x, z, halfWidth: 2.5, halfDepth: 2.5, dodge: true })),
  ...CANDY_ROWS.flatMap((z) => CANDY_X.map((x) => ({ kind: 'candy', x, z, halfWidth: 1.6, halfDepth: 1.0, dodge: true }))),
  ...PAD_ROWS.flatMap((z) => PAD_X.map((x) => ({
    kind: z === -41 ? 'seesaw' : 'platform', x, z, halfWidth: 1.31, halfDepth: 0.95, clearHeight: z === -41 ? 1.15 : 1.0,
  }))),
];

// ---------- 만들기 ----------
export function build() {
  const group = new THREE.Group();
  const animated = [];
  const geo = {
    sphere: new THREE.SphereGeometry(1, 14, 9),
    sphereSmall: new THREE.SphereGeometry(1, 7, 5), // 반지름 0.5 미만인 구에 자동 사용
    pole: new THREE.CylinderGeometry(0.83, 1, 1, 10),
    disc: new THREE.CylinderGeometry(1, 1, 1, 20),
    cone: new THREE.ConeGeometry(1, 1, 10),
    block: new THREE.BoxGeometry(1, 1, 1),
    circle: new THREE.CircleGeometry(1, 16),
  };
  const paints = new Map();
  const paint = (color) => {
    if (!paints.has(color)) paints.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.47, metalness: 0 }));
    return paints.get(color);
  };
  const shadeMaterial = new THREE.MeshBasicMaterial({ color: '#54536b', transparent: true, opacity: 0.095, depthWrite: false });

  function prop(parent, geometry, color, x, y, z, sx, sy, sz) {
    if (geometry === geo.sphere && Math.max(sx, sy, sz) < 0.5) geometry = geo.sphereSmall; // 작은 구는 면을 적게
    const material = typeof color === 'string' ? paint(color) : color;
    const m = add(parent, new THREE.Mesh(geometry, material), x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  function groundShade(parent, x, z, rx, rz, y = -0.069) {
    prop(parent, geo.circle, shadeMaterial, x, y, z, rx, rz, 1).rotation.x = -Math.PI / 2;
  }
  /** 움직이는 장애물 자리: base는 고정, 반환된 moving 그룹이 움직임 */
  function animatePart(kind, x, z, phase = 0) {
    const base = add(group, new THREE.Group(), centerX(z) + x, 0, z);
    base.userData.kind = kind;
    base.userData.phase = (z + 160) * 0.1 + x + phase;
    animated.push(base);
    return base;
  }
  function moving(base, y = 0) {
    const m = add(base, new THREE.Group(), 0, y, 0);
    m.userData.noBake = true;
    base.userData.animated = m;
    return m;
  }
  function tube(parent, points, radius, color) {
    const curve = new THREE.CatmullRomCurve3(points);
    return prop(parent, new THREE.TubeGeometry(curve, points.length > 40 ? 64 : 32, radius, 5, false), color, 0, 0, 0, 1, 1, 1);
  }
  /** 트랙 중심선을 따라가는 띠 (도로, 가장자리 선) */
  function ribbon(color, x0, x1, z0, z1, y, stripes, basic = false) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= stripes; i++) {
      const z = z0 + ((z1 - z0) * i) / stripes;
      const c = centerX(z);
      positions.push(c + x0, y, z, c + x1, y, z);
      if (i < stripes) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return add(group, new THREE.Mesh(g, basic ? new THREE.MeshBasicMaterial({ color }) : paint(color)));
  }
  function arch(z, finish = false) {
    const gate = add(group, new THREE.Group(), centerX(z), 0, z);
    const radius = finish ? 12.3 : 13.6;
    if (!finish) gate.rotation.y = 0.27;
    for (const side of [-1, 1]) {
      const x = side * radius;
      prop(gate, geo.pole, PINK, x, 2.08, 0, 0.53, 4.24, 0.53);
      prop(gate, geo.disc, '#fff0df', x, 0.28, 0, 0.69, 0.48, 0.69);
      prop(gate, geo.sphere, CREAM, x, 4.23, 0, 0.63, 0.59, 0.63);
    }
    BANDS.forEach((color, index) => {
      const r = radius - 0.19 - index * 0.38;
      const points = Array.from({ length: 31 }, (_, i) => {
        const a = (i * Math.PI) / 30;
        return new THREE.Vector3(Math.cos(a) * r, 4.23 + Math.sin(a) * r * (finish ? 0.7 : 0.63), 0);
      });
      tube(gate, points, 0.224, color);
    });
    if (finish) {
      prop(gate, geo.block, '#fff8e1', 0, 10.12, 0.14, 5.2, 1.46, 0.34);
      for (const side of [-1, 1]) {
        prop(gate, geo.pole, CREAM, side * 2, 11.5, 0.14, 0.055, 1.55, 0.055);
        for (let i = 0; i < 5; i++) prop(gate, geo.block, BANDS[i], -1.54 + 0.77 * i, 10.12, side * 0.321, 0.54, 0.5, 0.033);
      }
    }
  }

  // 하늘: 파란 하늘이 민트색 지평선으로 자연스럽게 이어지는 돔
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(252, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { blue: { value: new THREE.Color(SKY) }, mint: { value: new THREE.Color(FOG) } },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform vec3 blue;
      uniform vec3 mint;
      varying vec3 vWorldPosition;
      void main() {
        float elevation = normalize(vWorldPosition - cameraPosition).y;
        gl_FragColor = vec4(mix(mint, blue, smoothstep(-0.079, 0.041, elevation)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  skyDome.renderOrder = -10;
  add(group, skyDome, 0, 0, -38);

  // 들판·도로·난간
  const terrain = add(group, new THREE.Mesh(new THREE.PlaneGeometry(480, 320), new THREE.MeshBasicMaterial({ color: GRASS })), 0, -0.08, -55);
  terrain.rotation.x = -Math.PI / 2;
  const zStart = -112, zEnd = 63;
  ribbon('#fffefb', -11, 11, zStart, zEnd, 0.075, 74, true);
  for (const side of [-1, 1]) {
    ribbon('#f897ba', side * 11 - 0.22, side * 11 + 0.22, zStart, zEnd, 0.083, 74);
    for (const [height, radius, color] of [[0.72, 0.14, '#ffadd0'], [1.45, 0.19, '#ff85b9']]) {
      const points = Array.from({ length: 52 }, (_, i) => {
        const z = -105 + (137 * i) / 51;
        return new THREE.Vector3(centerX(z) + side * 11.19, height, z);
      });
      tube(group, points, radius, color);
    }
    for (let i = 0; i < 31; i++) {
      const z = 32 - i * 4.55;
      const x = centerX(z) + side * 11.19;
      prop(group, geo.block, PINK, x, 0.79, z, 0.35, 1.6, 0.37);
      prop(group, geo.sphere, CREAM, x, 1.69, z, 0.255, 0.255, 0.255);
    }
    for (const z of [43, 36, 20, 5, -13, -31, -54, -76, -94]) {
      const x = centerX(z) + side * 13.15;
      prop(group, geo.pole, '#a87e51', x, 1.19, z, 0.115, 2.5, 0.115);
      prop(group, geo.sphere, CREAM, x, 2.5, z, 0.3, 0.3, 0.3);
    }
  }

  // 노면의 금색 점, 출발·결승 체크무늬
  const dotMaterial = new THREE.MeshBasicMaterial({ color: '#ffec5d' });
  for (let z = 59; z >= -109; z -= 3.65) {
    for (const x of [-5.55, 0, 5.55]) prop(group, geo.circle, dotMaterial, centerX(z) + x, 0.086, z, 0.19, 0.19, 1).rotation.x = -Math.PI / 2;
  }
  for (const lineZ of [24.1, -99.9]) {
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 20; column++) {
        const color = (column + row) % 2 === 0 ? '#31324d' : '#fffdf9';
        prop(group, geo.block, color, centerX(lineZ) + (column - 10) * 1.1 + 0.55, 0.086, lineZ + (row - 0.5) * 0.73, 1.1, 0.022, 0.73);
      }
    }
  }
  arch(42);
  arch(-99.6, true);

  // 사탕나무, 원뿔 지붕 오두막, 라벤더 언덕
  for (const side of [-1, 1]) {
    for (let i = 0; i < 20; i++) {
      const z = 52 - i * 8.12 + (side > 0 ? -2.1 : 0.7);
      const x = centerX(z) + side * (15.2 + ((i * 5) % 7) * 1.13);
      const s = 0.73 + ((i * 7) % 11) * 0.045;
      const y = 4.06 * s;
      prop(group, geo.pole, '#a47444', x, y * 0.47, z, 0.31 * s, y, 0.31 * s).rotation.z = side * 0.1;
      const crown = TREE_COLORS[(i * 7 + (side > 0 ? 1 : 0)) % TREE_COLORS.length];
      prop(group, geo.sphere, crown, x - side * 0.18 * s, y, z, 1.62 * s, 1.47 * s, 1.53 * s);
      groundShade(group, x + 0.32 * s, z - 0.08, 0.91 * s, 0.56 * s);
    }
    for (let i = 0; i < 7; i++) {
      const z = 48 - i * 21.7 + (side > 0 ? -7.2 : 0);
      const x = centerX(z) + side * (22.6 + (i % 3) * 1.75);
      const s = 0.79 + ((i * 3) % 5) * 0.098;
      const roof = [TEAL, '#ff6c98', '#ffed4f'][(i + (side > 0 ? 2 : 0)) % 3];
      groundShade(group, x + 0.57, z - 0.3, 2.66 * s, 2.1 * s);
      prop(group, geo.disc, WHITE, x, 1.0 * s, z, 2.1 * s, 2.08 * s, 2.1 * s);
      prop(group, geo.cone, roof, x, 3.35 * s, z, 2.55 * s, 2.8 * s, 2.55 * s).rotation.y = i * 0.6;
    }
    for (let i = 0; i < 7; i++) {
      const z = 48 - i * 28.1 + (side > 0 ? -6 : 7);
      const h = 9.6 + (i % 4) * 3.65;
      const w = 10.6 + (i % 4) * 2.25;
      prop(group, geo.cone, ['#f8dafb', '#e8d7fc', '#f7e5fd', '#d8c8fa'][(i + 1) % 4],
        side * (43 + (i % 3) * 10), h * 0.5 - 0.24, z, w, h, w * 0.81).rotation.y = i * 1.22;
    }
  }

  // 구름
  for (const [x, y, z, s] of [
    [-33, 24, -32, 2.5], [30, 19, -41, 2.4], [-24, 17, -76, 1.5], [41, 28, -83, 2.85], [-57, 20, 6, 3.2],
    [7, 22, -125, 2.2], [-46, 21, -119, 2.2], [55, 17, -131, 2.9], [17, 24, -80, 1.3],
  ]) {
    prop(group, geo.sphere, '#fff7ef', x, y, z, s, 0.33 * s, 0.5 * s);
    prop(group, geo.sphere, '#fffdfa', x + 0.2 * s, y + 0.27 * s, z - 0.08 * s, 0.56 * s, 0.45 * s, 0.39 * s);
    prop(group, geo.sphere, '#fff9f3', x - 0.41 * s, y + 0.1 * s, z + 0.07 * s, 0.66 * s, 0.33 * s, 0.45 * s);
  }

  // 회전목마 (높아서 선수들이 옆으로 피해 감)
  for (const [x, z, phase] of CAROUSELS) {
    const base = animatePart('carousel', x, z, phase);
    base.scale.setScalar(1.12);
    groundShade(base, 0.25, -0.12, 2.35, 2.18, 0.096);
    prop(base, geo.disc, '#fa75a4', 0, 0.24, 0, 2.18, 0.31, 2.18);
    prop(base, geo.disc, '#ffc9de', 0, 0.42, 0, 2.09, 0.2, 2.09);
    prop(base, geo.pole, GOLD, 0, 2.08, 0, 0.14, 3.64, 0.14);
    prop(base, geo.cone, '#fc6aa2', 0, 4.27, 0, 2.55, 1.02, 2.55);
    prop(base, geo.sphere, CREAM, 0, 4.83, 0, 0.26, 0.26, 0.26);
    const spin = moving(base);
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5;
      const sx = Math.cos(a) * 1.43, sz = Math.sin(a) * 1.43;
      prop(spin, geo.pole, '#ffe68a', sx, 2.12, sz, 0.049, 2.9, 0.049);
      const seat = add(spin, new THREE.Group(), sx, 0, sz);
      seat.rotation.y = -a;
      prop(seat, geo.block, CANDY[i], 0, 0.77, 0, 0.72, 0.28, 0.53);
      prop(seat, geo.block, CANDY[i], 0, 1.01, -0.22, 0.7, 0.44, 0.14);
      prop(seat, geo.sphere, CREAM, 0.31, 1, 0.04, 0.107, 0.106, 0.105);
    }
  }

  // 결승 앞 무지개 깃발 기둥
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -66 - i * 7.1;
      const x = centerX(z) + side * 12.8;
      prop(group, geo.pole, '#ffdda0', x, 3.55, z, 0.14, 7.1, 0.14);
      prop(group, geo.sphere, CREAM, x, 7.17, z, 0.23, 0.23, 0.23);
      prop(group, geo.block, BANDS[(i + (side > 0 ? 2 : 0)) % BANDS.length], x + side * 0.52, 5.57, z, 1.03, 2.14, 0.11);
    }
  }

  // 사탕 공 묶음 (높아서 옆으로 피해 감)
  for (const z of CANDY_ROWS) {
    for (const x of CANDY_X) {
      const base = animatePart('candy', x, z);
      groundShade(base, 0.19, 0, 0.89, 0.55, 0.096);
      prop(base, geo.pole, '#ffedb8', 0, 0.94, 0, 0.07, 1.74, 0.07);
      const cluster = moving(base, 1.85);
      cluster.userData.baseY = 1.85;
      CANDY.forEach((color, i) => {
        const a = (i * 2 * Math.PI) / CANDY.length;
        prop(cluster, geo.sphere, color, Math.cos(a) * 0.46, (i % 2) * 0.31, Math.sin(a) * 0.46, 0.49, 0.49, 0.49);
      });
    }
  }

  // 발판과 시소 (넘어감)
  for (const z of PAD_ROWS) {
    PAD_X.forEach((x, i) => {
      const seesaw = z === -41;
      const base = animatePart(seesaw ? 'seesaw' : 'platform', x, z);
      groundShade(base, 0, 0, 1.34, 0.85, 0.096);
      const pad = moving(base, 0.38);
      const color = CANDY[(i + (seesaw ? 2 : 0)) % CANDY.length];
      prop(pad, geo.disc, color, 0, 0, 0, 1.31, 0.29, 0.95);
      prop(pad, geo.disc, '#fff3d9', 0, 0.164, 0, 1.17, 0.11, 0.82);
      prop(pad, geo.sphere, CREAM, -0.9, 0.26, 0, 0.14, 0.14, 0.14);
    });
  }

  // 성능: 움직이는 부품은 부품별로, 나머지 배경은 재질별로 한 덩어리씩
  animated.forEach((base) => bakeInto(base.userData.animated, { deep: true, castShadow: false }));
  bakeInto(group, { deep: true, castShadow: false });

  return {
    group, animated, obstacles,
    sky: SKY,
    fog: { color: FOG, near: 125, far: 255 },
    finishZ: FINISH_Z,
    rowGap: 1.7,
    curved: true,
    centerX,
    shadows: false, // 흰 노면이 빛을 받지 않는 재질이라 실시간 그림자 대신 발밑 그림자 사용
  };
}
