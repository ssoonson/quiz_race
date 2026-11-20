// 젤리 헬멧 레이서: 말랑한 둥근 몸 + 둥근 바이저 헬멧
import { buildRacer, animateRacer } from './racer.js';

export const label = '젤리 헬멧 레이서';
export const nameTagY = 3.55;

export const build = (index) => buildRacer('jelly', index);
export const animate = animateRacer;
