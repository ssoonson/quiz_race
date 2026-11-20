// 선생님: 문제집 편집 화면 (문제집 고르기·만들기·이름 바꾸기·지우기, 문제 카드 편집, 한꺼번에 붙여넣기, 파일 저장/불러오기)
import { $, $$, escapeHTML, toast, download } from '../core/dom.js';
import {
  allSets, getSet, createSet, updateSet, deleteSet, blankQuestion, readyQuestions, parseBulk, toBulk, importSet,
} from './quiz-sets.js';
import { LIMITS } from '../shared/rules.js';

const MARKS = ['▲', '◆', '●', '■'];
const PICK_KEY = 'quiz-race-current-set';

let currentId = localStorage.getItem(PICK_KEY) || '';
export const currentSet = () => getSet(currentId);

export function mountEditor(el) {
  let saveTimer;

  function render() {
    const set = currentSet();
    currentId = set.id;
    localStorage.setItem(PICK_KEY, currentId);
    const ready = readyQuestions(set).length;
    el.innerHTML = `
      <div class="card-head">
        <h2>📚 문제집</h2>
        <span class="muted">완성된 문제 <b>${ready}</b> / ${set.questions.length}개</span>
      </div>
      <div class="inline">
        <select data-pick>${allSets().map((s) => `<option value="${s.id}" ${s.id === set.id ? 'selected' : ''}>${escapeHTML(s.title)} (${s.questions.length})</option>`).join('')}</select>
        <button data-new>+ 새 문제집</button>
        <button data-rename>이름 바꾸기</button>
        <button data-delete>지우기</button>
      </div>
      <div class="inline small">
        <button data-bulk-toggle>📋 한꺼번에 붙여넣기</button>
        <button data-export>파일로 저장</button>
        <button data-import>파일 불러오기</button>
        <input type="file" accept=".json,application/json" data-import-file hidden/>
      </div>
      <div class="bulk" data-bulk hidden>
        <p class="help">한 줄에 한 문제: <code>문제 | 보기1 | 보기2 | 보기3 | 보기4 | 정답번호(1~4)</code><br>
          엑셀·구글 시트에서 6칸(문제, 보기 4개, 정답 번호)을 그대로 복사해 붙여 넣어도 됩니다.</p>
        <textarea rows="8" data-bulk-text placeholder="우리나라의 수도는? | 부산 | 서울 | 대전 | 광주 | 2"></textarea>
        <div class="inline">
          <button class="yellow" data-bulk-replace>지금 문제집을 이것으로 바꾸기</button>
          <button data-bulk-append>뒤에 덧붙이기</button>
        </div>
      </div>
      <ol class="questions">${set.questions.map((x, i) => `
        <li class="q-card" data-i="${i}">
          <div class="q-top"><b>${i + 1}</b>
            <textarea rows="2" maxlength="${LIMITS.questionLength}" data-q placeholder="문제를 입력하세요">${escapeHTML(x.q)}</textarea>
            <button class="xsmall" data-del title="이 문제 지우기">✕</button>
          </div>
          <div class="choices">${x.c.map((c, k) => `
            <label class="choice c${k}">
              <input type="radio" name="a${i}" value="${k}" ${x.a === k ? 'checked' : ''} data-a title="정답으로 정하기"/>
              <span class="mark">${MARKS[k]}</span>
              <input maxlength="${LIMITS.choiceLength}" data-c="${k}" value="${escapeHTML(c)}" placeholder="보기 ${k + 1}"/>
            </label>`).join('')}
          </div>
        </li>`).join('')}
      </ol>
      <div class="inline"><button class="yellow" data-add>+ 문제 추가</button><span class="muted">동그라미를 눌러 정답을 고르세요.</span></div>`;
  }

  // 글자 입력: 다시 그리지 않고 저장만 (입력 중인 칸이 흔들리지 않게)
  el.addEventListener('input', (e) => {
    const card = e.target.closest('[data-i]');
    if (!card) return;
    const i = Number(card.dataset.i);
    clearTimeout(saveTimer);
    const value = e.target.value;
    const field = e.target.matches('[data-q]') ? 'q' : e.target.dataset.c;
    saveTimer = setTimeout(() => updateSet(currentId, (set) => {
      if (field === 'q') set.questions[i].q = value;
      else if (field !== undefined) set.questions[i].c[Number(field)] = value;
      el.querySelector('.card-head .muted b').textContent = readyQuestions(set).length;
    }), 250);
  });

  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-pick]')) { currentId = e.target.value; render(); return; }
    if (e.target.matches('[data-a]')) {
      const i = Number(e.target.closest('[data-i]').dataset.i);
      updateSet(currentId, (set) => { set.questions[i].a = Number(e.target.value); });
      el.querySelector('.card-head .muted b').textContent = readyQuestions(currentSet()).length;
    }
    if (e.target.matches('[data-import-file]')) importFile(e.target);
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-new]')) {
      const title = prompt('새 문제집 이름', '새 문제집');
      if (title === null) return;
      currentId = createSet(title.trim().slice(0, 40) || '새 문제집').id;
      render();
    } else if (b.matches('[data-rename]')) {
      const title = prompt('문제집 이름', currentSet().title);
      if (title === null) return;
      updateSet(currentId, (set) => { set.title = title.trim().slice(0, 40) || set.title; });
      render();
    } else if (b.matches('[data-delete]')) {
      if (!confirm(`‘${currentSet().title}’ 문제집을 지울까요?`)) return;
      deleteSet(currentId);
      currentId = '';
      render();
    } else if (b.matches('[data-add]')) {
      updateSet(currentId, (set) => set.questions.push(blankQuestion()));
      render();
      el.querySelector('.q-card:last-child [data-q]')?.focus();
    } else if (b.matches('[data-del]')) {
      const i = Number(b.closest('[data-i]').dataset.i);
      updateSet(currentId, (set) => {
        set.questions.splice(i, 1);
        if (!set.questions.length) set.questions.push(blankQuestion());
      });
      render();
    } else if (b.matches('[data-bulk-toggle]')) {
      const box = $('[data-bulk]', el);
      box.hidden = !box.hidden;
      if (!box.hidden) $('[data-bulk-text]', el).value = toBulk(currentSet());
    } else if (b.matches('[data-bulk-replace], [data-bulk-append]')) {
      const { questions, skipped } = parseBulk($('[data-bulk-text]', el).value);
      if (!questions.length) return toast('형식에 맞는 줄이 없습니다. 칸이 6개인지, 정답 번호가 1~4인지 확인해 주세요.');
      const append = b.matches('[data-bulk-append]');
      updateSet(currentId, (set) => {
        set.questions = append ? [...set.questions.filter((x) => x.q.trim()), ...questions] : questions;
      });
      render();
      toast(`${questions.length}문제를 넣었습니다.${skipped.length ? ` (${skipped.join(', ')}번째 줄은 형식이 맞지 않아 건너뜀)` : ''}`);
    } else if (b.matches('[data-export]')) {
      const set = currentSet();
      download(`${set.title}.json`, JSON.stringify({ format: 'quiz-race-set-v1', title: set.title, questions: set.questions }, null, 2));
    } else if (b.matches('[data-import]')) {
      $('[data-import-file]', el).click();
    }
  });

  async function importFile(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      currentId = importSet(JSON.parse(await file.text())).id;
      render();
      toast('문제집을 불러왔습니다.');
    } catch (err) {
      toast('불러오기 실패: ' + (err instanceof SyntaxError ? 'JSON 파일이 아닙니다.' : err.message));
    }
  }

  render();
}
