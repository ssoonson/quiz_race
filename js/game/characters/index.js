// 캐릭터 목록과 공통 조립.
// 새 캐릭터를 추가하려면: 이 폴더에 block.js 같은 파일을 만들고(label, nameTagY, build(index) → {model, armL, armR, legL, legR, color}, animate),
// 아래 CHARACTER_TYPES와 core/config.js의 CHARACTER_LABELS에 한 줄씩 추가하세요.
import { THREE } from '../parts.js';
import * as block from './block.js';
import * as jelly from './jelly.js';
import { createNameTag } from './name-tag.js';

export const CHARACTER_TYPES = { block, jelly };

// 이동 거리 1당 걸음 위상 증가량 (길이 126인 기본 코스, 1배속에서 약 1.7걸음/초).
// 코스가 길면 stepScale로 줄여서 어느 트랙이든 같은 빠르기로 걷습니다.
const STEP_PER_UNIT = 4.6;

let blobGeometry;

export function createRunner(style, index, name, showName) {
  const type = CHARACTER_TYPES[style] || jelly;
  const parts = type.build(index);

  const group = new THREE.Group();
  group.add(parts.model);

  // 발밑 원형 그림자: 실시간 그림자가 꺼져 있을 때만 보입니다.
  blobGeometry ??= new THREE.CircleGeometry(0.85, 22);
  const shadow = new THREE.Mesh(blobGeometry.clone(), new THREE.MeshBasicMaterial({
    color: '#364467', transparent: true, opacity: 0.22, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.y = 0.79;
  shadow.position.y = 0.105;
  group.add(shadow);

  const label = createNameTag(name);
  label.position.y = type.nameTagY;
  label.visible = showName;
  group.add(label);

  return { ...parts, type, group, shadow, label, phase: index * 1.37, lastZ: null };
}

/**
 * 달린 거리만큼 걸음을 진행시키고 자세를 갱신합니다.
 * 걸음이 시간이 아니라 '거리'에 묶여 있어서, 2배속이면 발도 2배 빠르고 결승 후에는 멈춥니다.
 */
export function animateRunner(r, z, jump, stepScale = 1) {
  if (r.lastZ !== null) r.phase += Math.abs(z - r.lastZ) * STEP_PER_UNIT * stepScale;
  r.lastZ = z;
  r.type.animate(r, r.phase, jump);
  r.shadow.material.opacity = Math.max(0.09, 0.22 - jump * 0.12);
}

/** 대기·결승 후 서 있는 자세 */
export function idleRunner(r) {
  r.lastZ = null;
  r.type.animate(r, 0, 0);
}
