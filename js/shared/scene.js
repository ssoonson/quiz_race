// 3D 장면 한 벌: 무대 + 경기 화면 + 카메라 감독 + 꽃가루 + 품질 조절 + 매 프레임 루프
import { createStage } from '../game/stage.js';
import { createCameraDirector } from '../game/camera.js';
import { createQualityController } from '../game/quality.js';
import { createEffects } from '../game/effects.js';
import { createRaceView } from '../game/race-view.js';
import { on } from '../core/events.js';

/**
 * @param mount 캔버스를 넣을 요소
 * @param getContext 매 프레임 카메라에 줄 정보를 돌려주는 함수
 *        → { mode: 'auto'|'overview'|'follow', phase: 'ready'|'countdown'|'running'|'finished', remaining, focusUid }
 * @param now 모두가 같은 기준으로 쓰는 현재 시각 함수
 */
export function createScene(mount, getContext, now) {
  const stage = createStage(mount);
  const director = createCameraDirector(stage.camera);
  director.attachControls(stage.renderer.domElement);
  const quality = createQualityController(stage);
  const view = createRaceView(stage);
  const effects = createEffects(stage.scene);
  on('quality:changed', () => view.refreshShadows());

  const hooks = []; // 매 프레임 먼저 부를 함수들 (직접 조종 입력 처리 등)
  let last = 0;
  function frame(time) {
    requestAnimationFrame(frame);
    const rawDt = last ? Math.min(0.5, (time - last) / 1000) : 0;
    const dt = Math.min(0.1, rawDt);
    last = time;
    const ctx = getContext();
    for (const hook of hooks) hook(rawDt, now()); // 조종은 실제 흐른 시간으로 (느린 기기에서도 같은 속도)
    view.update(dt, now());
    effects.update(dt);
    quality.sample(dt, ctx.phase === 'running');
    if (view.track()) {
      director.update(Math.min(0.07, dt), {
        mode: ctx.mode,
        phase: ctx.phase,
        remaining: ctx.remaining,
        reducedMotion: false,
        track: view.track(),
        order: view.order(),
        focus: ctx.focusUid ? view.runner(ctx.focusUid) : undefined,
      });
    }
    view.updateLabels(stage.camera);
    stage.render();
  }
  requestAnimationFrame(frame);

  return {
    stage, view, director, effects,
    /** 매 프레임 호출할 함수 등록: fn(dt, now) */
    onFrame: (fn) => hooks.push(fn),
    /** 결승선에서 꽃가루 */
    confetti(count = 120) {
      const t = view.track();
      if (t) effects.burst(t.centerX(t.finishZ), 5, t.finishZ - 1, count);
    },
  };
}
