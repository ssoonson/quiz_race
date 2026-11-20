// 3D 효과: 골인할 때 터지는 꽃가루. 조각 수백 개를 한 번에 그리는 InstancedMesh라 가볍습니다.
import { THREE } from './parts.js';

const COUNT = 240;
const LIFE = 3.2; // 초
const COLORS = ['#ff5578', '#ffd34e', '#46cfed', '#a477ef', '#76d989', '#ffffff', '#ff9a3c'];

export function createEffects(scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.28, 0.18),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
    COUNT,
  );
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  const pieces = Array.from({ length: COUNT }, (_, i) => {
    mesh.setColorAt(i, new THREE.Color(COLORS[i % COLORS.length]));
    return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), age: LIFE };
  });
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  let next = 0;
  let alive = 0;

  return {
    /** (x, y, z)에서 꽃가루 count개를 터뜨림 */
    burst(x, y, z, count = 120) {
      for (let n = 0; n < count; n++) {
        const p = pieces[next];
        next = (next + 1) % COUNT;
        p.pos.set(x + (Math.random() - 0.5) * 8, y, z + (Math.random() - 0.5) * 2);
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 6;
        p.vel.set(Math.cos(a) * s, 6 + Math.random() * 8, Math.sin(a) * s * 0.6);
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        p.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        p.age = 0;
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = true;
      alive = LIFE;
    },
    update(dt) {
      if (!mesh.visible) return;
      alive -= dt;
      for (let i = 0; i < COUNT; i++) {
        const p = pieces[i];
        if (p.age >= LIFE) { mesh.setMatrixAt(i, hidden); continue; }
        p.age += dt;
        p.vel.y -= 9.8 * dt;
        p.vel.multiplyScalar(1 - dt * 1.2); // 공기 저항: 팔랑팔랑 떨어지게
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
        matrix.compose(p.pos, quat.setFromEuler(p.rot), one);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (alive <= 0) mesh.visible = false;
    },
    clear() {
      pieces.forEach((p) => { p.age = LIFE; });
      mesh.visible = false;
    },
  };
}
