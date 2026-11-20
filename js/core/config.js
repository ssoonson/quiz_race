// 트랙·캐릭터 이름 (선택 화면용)
export const TRACKS = {
  tour: { emoji: '🎡', name: '테마 투어' },
  rainbow: { emoji: '🌈', name: '무지개 운동장' },
  space: { emoji: '🚀', name: '우주 스피드웨이' },
  ocean: { emoji: '🌊', name: '바다 산책로' },
};
export const CHARACTER_LABELS = { jelly: '젤리 헬멧 레이서', block: '라운드 블록 레이서' };
export const trackLabel = (id) => { const t = TRACKS[id] || TRACKS.tour; return `${t.emoji} ${t.name}`; };
