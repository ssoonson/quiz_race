// 모듈끼리 직접 import하지 않고 이벤트로 소식을 주고받기 위한 작은 이벤트 버스.
//
// 사용하는 이벤트
//   state:changed   { keys: string[] }        설정·명단이 바뀜 (store.js)
//   settings:open   { tab?: string }          설정 창 열기 요청
//   race:phase      { phase }                 ready | countdown | running | paused | finished
//   race:countdown  { n }                     카운트다운 3, 2, 1
//   race:go         {}                        출발!
//   race:leader     { id, name }              선두가 바뀜
//   race:final      {}                        마지막 10초 시작
//   race:second     { left }                  마지막 10초 동안 1초마다
//   race:finisher   { rank, name, id }        한 선수가 골인
//   bgm:file        { name, url, source }     배경음악 파일을 찾았거나 바뀜
//   race:tick       {}                        경기 중 1초에 약 3번 (순위·시간 갱신)
//   race:roster     {}                        3D 선수들을 다시 만들었음
//   race:stage      { label }                 테마 투어에서 지금 구간이 바뀜 (예: '🌈 무지개 정원 · 2/5')
//   race:finished   { result }                경기 종료, 결과 데이터
//   camera:changed  { mode, followId }        카메라 모드 변경
//   camera:reset    {}                        마우스로 돌린 카메라를 원래 시점으로
//   quality:changed { level, auto }           실제 적용된 그래픽 품질 (high|medium|low)

const bus = new EventTarget();

export function on(type, handler) {
  const listener = (e) => handler(e.detail || {});
  bus.addEventListener(type, listener);
  return () => bus.removeEventListener(type, listener);
}

export function emit(type, detail = {}) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}
