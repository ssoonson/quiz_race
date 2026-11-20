// 문제집 저장소: 선생님 브라우저(LocalStorage)에만 저장됩니다.
// 문제집 = { id, title, questions: [{ q: 문제, c: [보기1, 보기2, 보기3, 보기4], a: 정답 번호(0~3) }] }
import { emit } from '../core/events.js';
import { LIMITS } from '../shared/rules.js';

const KEY = 'quiz-race-sets-v1';

const SAMPLE = {
  title: '예시: 상식 퀴즈',
  questions: [
    ['우리나라의 수도는 어디일까요?', '부산', '서울', '대전', '광주', 2],
    ['한글을 만든 왕은 누구일까요?', '세종대왕', '태조', '정조', '영조', 1],
    ['무지개는 보통 몇 가지 색으로 말할까요?', '5가지', '6가지', '7가지', '8가지', 3],
    ['1년은 몇 달일까요?', '10달', '11달', '12달', '13달', 3],
    ['7 × 8 은 얼마일까요?', '54', '56', '58', '64', 2],
    ['지구 주위를 도는 위성은 무엇일까요?', '화성', '태양', '달', '금성', 3],
    ['대한민국의 나라꽃은 무엇일까요?', '무궁화', '장미', '해바라기', '진달래', 1],
    ['물이 얼면 무엇이 될까요?', '수증기', '얼음', '구름', '이슬', 2],
    ['일주일은 며칠일까요?', '5일', '6일', '7일', '8일', 3],
    ['다음 중 포유류는 무엇일까요?', '고래', '상어', '참치', '오징어', 1],
  ].map(([q, c1, c2, c3, c4, n]) => ({ q, c: [c1, c2, c3, c4], a: n - 1 })),
};

const newId = () => Math.random().toString(36).slice(2, 10);

function load() {
  try {
    const sets = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(sets) && sets.length) return sets;
  } catch { /* 무시 */ }
  return [{ id: newId(), ...structuredClone(SAMPLE) }];
}

let sets = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(sets)); } catch { /* 저장 공간 부족 */ }
  emit('sets:changed');
}

export const allSets = () => sets;
export const getSet = (id) => sets.find((s) => s.id === id) || sets[0];

export const blankQuestion = () => ({ q: '', c: ['', '', '', ''], a: 0 });

export function createSet(title = '새 문제집') {
  const set = { id: newId(), title, questions: [blankQuestion()] };
  sets.push(set);
  save();
  return set;
}
export function updateSet(id, change) {
  const set = getSet(id);
  change(set);
  set.questions = set.questions.slice(0, LIMITS.questions);
  save();
}
export function deleteSet(id) {
  sets = sets.filter((s) => s.id !== id);
  if (!sets.length) sets = [{ id: newId(), ...structuredClone(SAMPLE) }];
  save();
}

/** 완성된 문제만 (문제와 보기 4개가 모두 있고 정답이 정해진 것) */
export const readyQuestions = (set) =>
  set.questions.filter((x) => x.q.trim() && x.c.every((c) => c.trim()) && x.a >= 0 && x.a <= 3);

/**
 * 한꺼번에 붙여넣기: 한 줄에 한 문제
 *   문제 | 보기1 | 보기2 | 보기3 | 보기4 | 정답번호(1~4)
 * 엑셀·구글 시트에서 6칸을 복사하면 탭으로 나뉘어 들어오므로 그것도 받아들입니다.
 * @returns {{questions, skipped}} skipped: 형식이 맞지 않은 줄 번호
 */
export function parseBulk(text) {
  const questions = [];
  const skipped = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const parts = (line.includes('\t') ? line.split('\t') : line.split('|')).map((x) => x.trim());
    const n = Number(parts[5]);
    if (parts.length < 6 || !parts[0] || parts.slice(1, 5).some((x) => !x) || !(n >= 1 && n <= 4)) {
      skipped.push(i + 1);
      return;
    }
    questions.push({
      q: parts[0].slice(0, LIMITS.questionLength),
      c: parts.slice(1, 5).map((x) => x.slice(0, LIMITS.choiceLength)),
      a: n - 1,
    });
  });
  return { questions, skipped };
}

export const toBulk = (set) => set.questions.map((x) => [x.q, ...x.c, x.a + 1].join(' | ')).join('\n');

/** 파일 불러오기: 이 앱에서 저장한 JSON */
export function importSet(data) {
  if (!data || !Array.isArray(data.questions)) throw new Error('문제집 파일이 아닙니다.');
  const questions = data.questions
    .filter((x) => x && typeof x.q === 'string' && Array.isArray(x.c) && x.c.length === 4)
    .map((x) => ({
      q: x.q.slice(0, LIMITS.questionLength),
      c: x.c.map((c) => String(c).slice(0, LIMITS.choiceLength)),
      a: Math.min(3, Math.max(0, Number(x.a) || 0)),
    }));
  if (!questions.length) throw new Error('불러올 문제가 없습니다.');
  const set = { id: newId(), title: String(data.title || '불러온 문제집').slice(0, 40), questions };
  sets.push(set);
  save();
  return set;
}
