// 카메라 감독: 자동 모드에서는 경기 상황에 맞춰 3~5초마다 '샷'을 바꿔 가며 컷 전환합니다.
// 모든 샷은 선수 가까이에서 잡습니다(멀리서 코스 전체를 비추는 샷은 긴박감이 떨어져 쓰지 않음).
//
// 샷 종류
//   start   대기·카운트다운: 출발선 앞에서 선수들 얼굴을 낮게
//   chase   선두 바로 뒤에서 낮게 따라가기 (속도감)
//   front   선두 앞에서 뒤돌아보기 (쫓아오는 무리가 보임)
//   side    옆에서 나란히 달리며 보기
//   battle  가장 접전인 두 선수를 가까이
//   pack    선두 무리를 뒤쪽 위에서 따라가기 (여러 명이 한 화면에)
//   finish  마지막 10초: 결승선에서 들어오는 선수들을 정면으로
// 수동 모드: overview(선두 무리 보기 = pack), follow(고른 선수 또는 선두를 chase로)
// '카메라 움직임 줄이기'를 켜면 컷 전환·흔들림 없이 pack만 씁니다.
//
// 마우스: 드래그 = 비추는 선수를 중심으로 회전, 휠 = 확대/축소, 더블클릭 = 원래대로
//   자동 모드에서는 손을 뗀 뒤 4초가 지나면 감독 시점으로 천천히 돌아옵니다.
//   확대/축소 정도는 계속 유지됩니다.
import { THREE } from './parts.js';

const SHOT_SECONDS = [3.4, 4.8];
const MID_RACE_SHOTS = ['chase', 'front', 'pack', 'side', 'battle', 'chase', 'front'];
const FINAL_SHOTS = ['finish', 'chase', 'front', 'battle'];
const FOV_EXTRA = { chase: 10, front: 6, battle: 6, start: 4, side: 2, pack: 2, finish: 2 };

// 마우스 조작
const DRAG_YAW = 0.006;      // 좌우 드래그 1px당 회전(라디안)
const DRAG_PITCH = 0.004;    // 위아래 드래그 1px당 기울기
const ZOOM_MIN = 0.45, ZOOM_MAX = 2.2;
const RETURN_AFTER = 4;      // 자동 모드: 손을 뗀 뒤 이 초가 지나면 원래 각도로 복귀

export function createCameraDirector(camera) {
  const look = new THREE.Vector3(0, 0, -38);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  let shot = '';
  let shotUntil = 0;
  let shotIndex = 0;
  let sideSign = 1;
  let fovExtra = 0;
  let clock = 0;
  let lastType = '';

  // 마우스로 더한 회전·확대 (감독이 정한 시점 위에 얹음)
  const orbit = { yaw: 0, pitch: 0, zoom: 1, dragging: false, lastInput: -Infinity };
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();

  /** 다음 샷 고르기 (같은 샷이 연달아 나오지 않게) */
  function nextShot(final) {
    const list = final ? FINAL_SHOTS : MID_RACE_SHOTS;
    shotIndex = (shotIndex + 1 + Math.floor(Math.random() * 2)) % list.length;
    let next = list[shotIndex];
    if (next === shot) next = list[(shotIndex + 1) % list.length];
    if (next === 'side') sideSign = -sideSign;
    return next;
  }

  /** 가장 접전인 앞쪽 두 선수 (상위 6명 중 간격이 가장 좁은 쌍) */
  function closestPair(order) {
    const top = order.filter((r) => !r.finished).slice(0, 6);
    let best = null;
    for (let i = 0; i + 1 < top.length; i++) {
      const gap = Math.abs(top[i].group.position.z - top[i + 1].group.position.z);
      if (!best || gap < best.gap) best = { a: top[i], b: top[i + 1], gap };
    }
    return best;
  }

  function aim(type, ctx) {
    const { track, order, focus } = ctx;
    const cx = track ? track.centerX : () => 0;
    const lead = focus || order.find((r) => !r.finished) || order[0];
    // 아직 선수가 없으면(대기실에 아무도 없을 때) 출발선을 기준으로
    const p = lead?.group.position || { x: cx(26), y: 0, z: 26 };
    switch (type) {
      case 'start': {
        const z = 15.5;
        wantPos.set(cx(z) + 3, 2.8, z);
        wantLook.set(cx(28), 1.8, 28);
        return;
      }
      case 'chase': {
        const adv = cx(p.z - 10) - cx(p.z);
        wantPos.set(p.x - adv * 0.3, 3.1, p.z + 6.8);
        wantLook.set(p.x + adv * 0.6, 1.7, p.z - 8);
        return;
      }
      case 'front': {
        const ahead = p.z - 8;
        wantPos.set(cx(ahead) + (p.x - cx(p.z)) * 0.7, 2.7, ahead);
        wantLook.set(p.x, 1.7, p.z + 4);
        return;
      }
      case 'side': {
        const z = p.z - 2;
        wantPos.set(cx(z) + sideSign * 13.5, 4.2, z + 1.5); // 난간 바깥에서 (다른 선수에 가리지 않게)
        wantLook.set(p.x, 1.5, z - 1);
        return;
      }
      case 'battle': {
        const pair = closestPair(order);
        if (!pair) return aim('chase', ctx);
        const mx = (pair.a.group.position.x + pair.b.group.position.x) / 2;
        const mz = (pair.a.group.position.z + pair.b.group.position.z) / 2;
        wantPos.set(mx - 4.8, 3.1, mz + 4.6);
        wantLook.set(mx, 1.6, mz - 1.5);
        return;
      }
      case 'finish': {
        const fz = track.finishZ;
        if (ctx.phase === 'running' && p.z - fz > 30) { // 선두가 아직 멀면 선두 앞에서 넓게
          const ahead = p.z - 15;
          wantPos.set(cx(ahead) + 3, 4.5, ahead);
          wantLook.set(p.x, 1.6, p.z + 4);
          return;
        }
        wantPos.set(cx(fz) + 6, 3.4, fz - 9);
        const z = Math.max(p.z, fz);
        wantLook.set(p.x * 0.5 + cx(fz) * 0.5, 1.6, (z + fz) / 2 + 4);
        return;
      }
      default: { // pack: 선두 뒤쪽 위에서 앞을 내려다보며 무리를 함께 담음
        const z = p.z;
        const rear = z + 15, ahead = z - 9;
        wantPos.set(cx(rear) + (p.x - cx(z)) * 0.5 - 4, 8.5, rear);
        wantLook.set(cx(ahead) + (p.x - cx(z)) * 0.5, 1.2, ahead);
      }
    }
  }

  /** 감독이 정한 시점(wantPos → wantLook)을 마우스 회전·확대만큼 돌리고 당깁니다 */
  function applyOrbit(dt, mode) {
    const idle = clock - orbit.lastInput;
    if (mode === 'auto' && !orbit.dragging && idle > RETURN_AFTER) {
      const ease = Math.min(1, dt * 1.5); // 자동 모드: 천천히 원래 각도로
      orbit.yaw += (0 - orbit.yaw) * ease;
      orbit.pitch += (0 - orbit.pitch) * ease;
    }
    offset.subVectors(wantPos, wantLook);
    spherical.setFromVector3(offset);
    spherical.theta += orbit.yaw;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - orbit.pitch, 0.12, 1.5);
    spherical.radius *= orbit.zoom;
    offset.setFromSpherical(spherical);
    wantPos.copy(wantLook).add(offset);
    if (wantPos.y < 0.6) wantPos.y = 0.6; // 땅 밑으로 들어가지 않게
  }

  /** 캔버스에 마우스·터치 조작을 붙입니다 */
  function attachControls(el) {
    let lastX = 0, lastY = 0;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      orbit.dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', (e) => {
      if (!orbit.dragging) return;
      orbit.yaw -= (e.clientX - lastX) * DRAG_YAW;
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.clientY - lastY) * DRAG_PITCH, -0.6, 1.1);
      lastX = e.clientX; lastY = e.clientY;
      orbit.lastInput = clock;
    });
    const end = (e) => {
      if (!orbit.dragging) return;
      orbit.dragging = false;
      orbit.lastInput = clock;
      el.style.cursor = 'grab';
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * Math.exp(e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
      orbit.lastInput = clock;
    }, { passive: false });
    el.addEventListener('dblclick', resetView);
  }

  function resetView() {
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.zoom = 1;
    orbit.lastInput = -Infinity;
  }

  return {
    get shot() { return shot; },
    attachControls,
    resetView,
    /**
     * ctx: { mode, phase, remaining, reducedMotion, track, order(앞선 순서의 선수들), focus(고른 선수) }
     */
    update(dt, ctx) {
      clock += dt;
      const { mode, phase, reducedMotion, order } = ctx;
      const live = phase === 'countdown' || phase === 'running' || phase === 'paused';
      const final = phase === 'running' && ctx.remaining <= 10;

      let type;
      if (!order.length) type = 'pack';
      else if (mode === 'follow') type = 'chase';
      else if (phase === 'ready' || phase === 'countdown') type = 'start';
      else if (mode === 'overview' || reducedMotion) type = 'pack';
      else if (phase === 'finished') type = 'finish';
      else if (!live) type = 'pack';
      else {
        if (!shot || clock >= shotUntil || (final && !FINAL_SHOTS.includes(shot))) {
          if (phase === 'running') {
            const [a, b] = SHOT_SECONDS;
            shot = nextShot(final);
            shotUntil = clock + (final ? a : a + Math.random() * (b - a));
          }
        }
        type = shot || 'chase';
      }

      const cut = type !== lastType;
      lastType = type;
      aim(type, ctx);

      // 마지막 10초에는 가까운 샷에서 살짝 흔들림 (긴박감)
      if (final && !reducedMotion && (type === 'chase' || type === 'front')) {
        wantPos.x += Math.sin(clock * 37) * 0.06;
        wantPos.y += Math.sin(clock * 29) * 0.05;
      }

      applyOrbit(dt, mode);

      // 샷이 바뀌면 순간 컷, 같은 샷 안에서는 부드럽게 따라감 (마우스로 돌릴 때는 바로 반응)
      const k = (cut && live && !reducedMotion) || reducedMotion ? 1 : 1 - Math.exp(-dt * (orbit.dragging ? 14 : 5));
      camera.position.lerp(wantPos, k);
      look.lerp(wantLook, k);
      camera.lookAt(look);

      const targetFov = reducedMotion ? 0 : FOV_EXTRA[type] || 0;
      fovExtra += (targetFov - fovExtra) * (cut ? 1 : Math.min(1, dt * 3));
      const fov = (camera.userData.baseFov || camera.fov) + fovExtra;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
