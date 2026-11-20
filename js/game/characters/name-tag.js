// 캐릭터 머리 위 이름표 (캔버스 텍스처 스프라이트)
import { THREE } from '../parts.js';

export function createNameTag(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 72;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffffed';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 62, 16);
  ctx.fill();
  ctx.strokeStyle = '#253a32';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#182c27';
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px system-ui';
  ctx.fillText(name.length > 9 ? name.slice(0, 9) + '…' : name, 128, 45);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthTest: false,
  }));
  sprite.scale.set(2.5, 0.7, 1);
  sprite.renderOrder = 10;
  return sprite;
}
