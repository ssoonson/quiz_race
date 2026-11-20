// 캐릭터와 트랙이 함께 쓰는 기본 도형 도우미 + 성능용 '굽기(bake)' 도구.
//
// 만드는 방법은 그대로 "도형을 하나씩 붙이기"입니다(읽고 고치기 쉬움).
// 다 만든 뒤 bakeInto()를 부르면 같은 재질의 도형들을 한 덩어리로 합쳐서
// 그리기 호출(draw call)을 수십~수백 분의 1로 줄입니다. 색은 정점 색상으로 보존됩니다.
import * as THREE from '../lib/three.js';

export { THREE };

export const PALETTE = ['#fa728b', '#ffd166', '#49cbb7', '#65a6ff', '#b38bfa', '#fc9e67', '#a2d978', '#ef8bc4'];

export const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0, ...options });

export function mesh(geometry, color, options = {}, { shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material(color, options));
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

// 작은 구는 면을 적게: 눈(반지름 0.07)에 384개 삼각형은 낭비
const sphereDetail = (r) => (r < 0.15 ? [8, 6] : r < 0.5 ? [12, 8] : [16, 12]);

export const box = (w, h, d, color, opts) => mesh(new THREE.BoxGeometry(w, h, d), color, {}, opts);
export const ball = (r, color, opts) => mesh(new THREE.SphereGeometry(r, ...sphereDetail(r)), color, {}, opts);
/** 멀리 있는 장식용 저폴리곤 구 (나무 열매, 조개, 구름 등) */
export const lowBall = (r, color, opts) => mesh(new THREE.SphereGeometry(r, 10, 7), color, {}, opts);
export const cylinder = (top, bottom, h, color, segments = 12, opts) =>
  mesh(new THREE.CylinderGeometry(top, bottom, h, segments), color, {}, opts);

/** child를 (x,y,z)에 놓고 parent에 붙인 뒤 child를 돌려줍니다. */
export function add(parent, child, x = 0, y = 0, z = 0) {
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

/**
 * 회전 축(관절)이 되는 빈 그룹. 어깨·엉덩이 위치에 두고, 팔·다리 도형은 그 아래로 매답니다.
 * 이 그룹을 돌리면 팔다리가 관절을 중심으로 흔들립니다.
 */
export const joint = (parent, x, y, z = 0) => add(parent, new THREE.Group(), x, y, z);

// ---------- 공유 재질 (정점 색상) ----------
// 합친 메시는 색을 정점에 담으므로, 재질은 "종류·거칠기·투명도"가 같으면 모두 하나를 같이 씁니다.
const sharedMaterials = new Map();

function materialKey(mat) {
  return [mat.type, mat.roughness, mat.metalness, mat.transparent ? mat.opacity : 1,
    mat.depthWrite, mat.side, mat.polygonOffset, mat.fog].join('|');
}
function sharedFrom(mat, key) {
  if (!sharedMaterials.has(key)) {
    const m = mat.clone();
    m.color.set('#ffffff');
    m.vertexColors = true;
    m.map = null;
    m.userData.shared = true; // clearGroup이 지우지 않음
    sharedMaterials.set(key, m);
  }
  return sharedMaterials.get(key);
}
const unlitMaterial = () => sharedFrom(new THREE.MeshBasicMaterial(), 'unlit');

/** 합칠 수 있는 메시: 텍스처 없는 기본 재질(조명/무조명), 스스로 빛나지 않는 것 */
const canBake = (m) => {
  const mat = m.material;
  if (!m.isMesh || m.isInstancedMesh || !mat || Array.isArray(mat) || mat.map) return false;
  if (mat.isMeshStandardMaterial) return mat.emissive.getHex() === 0 && !!m.geometry.attributes.normal;
  return mat.isMeshBasicMaterial === true;
};

// ---------- 합치기 ----------
const _m4 = new THREE.Matrix4();
const _n3 = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

/** 여러 메시를 relativeTo 좌표계 기준 하나의 BufferGeometry(위치·법선·색)로 합칩니다. */
function mergeMeshes(meshes, relativeTo) {
  const inv = new THREE.Matrix4().copy(relativeTo.matrixWorld).invert();
  let vCount = 0, iCount = 0;
  for (const m of meshes) {
    vCount += m.geometry.attributes.position.count;
    iCount += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
  }
  const P = new Float32Array(vCount * 3), N = new Float32Array(vCount * 3), C = new Float32Array(vCount * 3);
  const I = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const m of meshes) {
    const { position: pos, normal: nor, color: col } = m.geometry.attributes;
    const useVertexColor = m.material.vertexColors && col;
    const idx = m.geometry.index;
    const base = m.material.color;
    _m4.multiplyMatrices(inv, m.matrixWorld);
    _n3.getNormalMatrix(_m4);
    for (let i = 0; i < pos.count; i++) {
      const o = (vo + i) * 3;
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m4);
      P[o] = _v.x; P[o + 1] = _v.y; P[o + 2] = _v.z;
      if (nor) _v.fromBufferAttribute(nor, i).applyNormalMatrix(_n3); else _v.set(0, 1, 0);
      N[o] = _v.x; N[o + 1] = _v.y; N[o + 2] = _v.z;
      _c.copy(base);
      if (useVertexColor) _c.multiply(new THREE.Color().fromBufferAttribute(col, i));
      C[o] = _c.r; C[o + 1] = _c.g; C[o + 2] = _c.b;
    }
    if (idx) for (let k = 0; k < idx.count; k++) I[io + k] = idx.getX(k) + vo;
    else for (let k = 0; k < pos.count; k++) I[io + k] = vo + k;
    vo += pos.count;
    io += idx ? idx.count : pos.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  return geo;
}

function disposeMesh(m) {
  m.geometry.dispose();
  if (!m.material.userData.shared) m.material.dispose();
}

/**
 * group 안의 도형을 재질 종류별로 한 덩어리씩 합칩니다.
 *  deep: false → group의 '바로 아래' 메시만 합침 (관절 Group은 건드리지 않음 → 캐릭터용)
 *  deep: true  → 모든 하위 메시를 합침 (움직이지 않는 배경용).
 *               userData.noBake 표시가 있는 그룹(움직이는 부품)과 그 안쪽은 건드리지 않습니다.
 *  unlit: true → 빛을 받지 않는 밝은 재질로 (별 등)
 *  castShadow / receiveShadow: 합친 메시의 그림자 설정
 */
export function bakeInto(group, { deep = false, unlit = false, castShadow = true, receiveShadow = true } = {}) {
  group.updateMatrixWorld(true);
  const candidates = [];
  if (deep) {
    const walk = (o) => {
      for (const c of o.children) {
        if (c.userData.noBake) continue;
        if (c.isMesh) candidates.push(c);
        walk(c);
      }
    };
    walk(group);
  } else {
    candidates.push(...group.children.filter((o) => o.isMesh));
  }

  const buckets = new Map();
  for (const m of candidates) {
    if (!canBake(m) && !(unlit && m.isMesh && !Array.isArray(m.material))) continue; // 합칠 수 없는 것은 그대로 둠
    const key = unlit ? 'unlit' : materialKey(m.material);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  }

  for (const [key, list] of buckets) {
    if (list.length < 2 && !unlit && !deep) continue; // 하나뿐이면 합칠 이득이 없음
    const mat = key === 'unlit' ? unlitMaterial() : sharedFrom(list[0].material, key);
    const out = new THREE.Mesh(mergeMeshes(list, group), mat);
    out.castShadow = castShadow;
    out.receiveShadow = receiveShadow;
    out.renderOrder = list[0].renderOrder;
    list.forEach((m) => { m.removeFromParent(); disposeMesh(m); });
    group.add(out);
  }

  if (deep) pruneEmpty(group);
  return group;
}

/** 메시가 빠져 비게 된 그룹을 정리합니다(움직이는 부품 그룹은 유지). */
function pruneEmpty(group) {
  for (const c of [...group.children]) {
    if (c.userData.noBake || c.isMesh || c.isSprite) continue;
    pruneEmpty(c);
    if (!c.children.length && c.type === 'Group') c.removeFromParent();
  }
}

/** 그룹 안의 도형·재질·텍스처를 모두 비우고 GPU 메모리를 돌려줍니다(공유 재질은 유지). */
export function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.((m) => {
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((x) => { if (x.userData.shared) return; x.map?.dispose?.(); x.dispose?.(); });
    });
  }
}
