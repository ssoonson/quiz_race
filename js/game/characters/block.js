// 라운드 블록 레이서: 모서리가 둥근 블록 몸 + 헬멧·운동복 (블록 장난감 '스타일'의 자체 디자인)
import { buildRacer, animateRacer } from './racer.js';

export const label = '라운드 블록 레이서';
export const nameTagY = 3.55;

export const build = (index) => buildRacer('block', index);
export const animate = animateRacer;
