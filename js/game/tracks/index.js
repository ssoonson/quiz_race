// 트랙(게임 배경) 목록.
// 새 트랙을 추가하려면: 이 폴더에 트랙 파일(또는 폴더)을 만들고 build()가 아래 '트랙 정보'를 돌려주게 한 뒤,
// THEMES와 core/config.js의 TRACKS에 한 줄씩 추가하세요.
//
// 트랙 정보 = {
//   group, animated(움직이는 소품), obstacles(점프·회피용 장애물 목록, game/layout.js 참고),
//   sky, fog{color,near,far}, finishZ, rowGap(뒤 줄 간격), curved, centerX(z), shadows,
//   stages?, stageAt?(z), updateView?(scene, cameraZ, focusZ)   구간이 있는 트랙(테마 투어)
// }
import * as tour from './tour/index.js';
import * as rainbow from './rainbow.js';
import * as space from './space.js';
import * as ocean from './ocean.js';

export { animateObstacles } from './obstacles.js';

const THEMES = { tour, rainbow, space, ocean };

export function buildTrack(themeId) {
  return (THEMES[themeId] || tour).build();
}
