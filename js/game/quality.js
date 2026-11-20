// 그래픽 품질 관리.
//  - 수동: 설정 > 화면·소리 > 그래픽 품질 (높음/보통/낮음)
//  - 자동(기본): '높음'으로 시작해, 경기 중 3초 평균이 40fps 아래면 한 단계씩 낮춥니다.
//    알아낸 단계는 이 브라우저에 기억해 두었다가 다음에 그 단계부터 시작합니다.
import { emit, on } from '../core/events.js';
import { state } from '../core/store.js';
import { toast } from '../core/dom.js';

const LEVELS = ['high', 'medium', 'low'];
const LEVEL_NAMES = { high: '높음', medium: '보통', low: '낮음' };
const PRESETS = {
  high: { pixelRatio: () => Math.min(devicePixelRatio, 1.6), shadows: true },
  medium: { pixelRatio: () => 1, shadows: true },
  low: { pixelRatio: () => 0.75, shadows: false },
};
const SAMPLE_SECONDS = 3;
const WARMUP_SECONDS = 1.5; // 경기 시작 직후 준비 시간은 측정에서 제외
const MIN_FPS = 40;
const MEMORY_KEY = 'classroom-race-auto-quality';

const recall = () => { try { return LEVELS.includes(localStorage.getItem(MEMORY_KEY)) ? localStorage.getItem(MEMORY_KEY) : 'high'; } catch { return 'high'; } };
const remember = (level) => { try { localStorage.setItem(MEMORY_KEY, level); } catch { /* 무시 */ } };

export const levelName = (level) => LEVEL_NAMES[level] || '';

export function createQualityController(stage) {
  let level = null;
  let autoLevel = recall();
  let frames = 0, time = 0, warmup = WARMUP_SECONDS;

  function apply(next) {
    if (next === level) return;
    level = next;
    const p = PRESETS[next];
    stage.setQuality({ pixelRatio: p.pixelRatio(), shadows: p.shadows });
    emit('quality:changed', { level, auto: state.quality === 'auto' });
  }
  const resetSampling = () => { frames = 0; time = 0; warmup = WARMUP_SECONDS; };
  const desired = () => (state.quality === 'auto' ? autoLevel : state.quality);

  on('state:changed', ({ keys }) => {
    if (!keys.includes('quality')) return;
    if (state.quality === 'auto') { autoLevel = 'high'; remember('high'); } // 자동을 다시 고르면 처음부터 측정
    resetSampling();
    apply(desired());
    emit('quality:changed', { level, auto: state.quality === 'auto' });
  });
  on('race:phase', resetSampling);

  apply(desired());

  return {
    get level() { return level; },
    /** 매 프레임 호출. measuring: 경기 중(실제 부하가 걸리는 때)만 true */
    sample(dt, measuring) {
      if (state.quality !== 'auto' || !measuring) return;
      if (warmup > 0) { warmup -= dt; return; }
      frames++;
      time += dt;
      if (time < SAMPLE_SECONDS) return;
      const fps = frames / time;
      frames = 0; time = 0;
      const i = LEVELS.indexOf(autoLevel);
      if (fps < MIN_FPS && i < LEVELS.length - 1) {
        autoLevel = LEVELS[i + 1];
        remember(autoLevel);
        apply(autoLevel);
        warmup = WARMUP_SECONDS;
        toast(`화면이 느려서 그래픽 품질을 '${LEVEL_NAMES[autoLevel]}'으로 낮췄습니다.`);
      }
    },
  };
}
