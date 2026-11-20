// 학생 화면: 입장(방 코드 + 이름) → 대기 → 문제 풀기 또는 직접 조종(내 캐릭터 3D) → 결승 → 결과
import { $, escapeHTML, toast, formatTime } from '../core/dom.js';
import { state, setSetting } from '../core/store.js';
import { sounds, audioContext } from '../core/audio.js';
import { connect } from '../net/index.js';
import { LIMITS, cleanName, answerHash, questionFor, rankRoom, remainingSeconds, progressFor } from '../shared/rules.js';
import { createScene } from '../shared/scene.js';
import { createBanner } from '../shared/banner.js';
import { createRunControl } from './run-control.js';

const MARKS = ['▲', '◆', '●', '■'];
const NAME_KEY = 'quiz-race-my-name';

const params = new URLSearchParams(location.search);
$('#codeInput').value = (params.get('room') || '').replace(/\D/g, '').slice(0, 4);
$('#nameInput').value = localStorage.getItem(NAME_KEY) || '';
$('#nameInput').maxLength = LIMITS.nameLength;

let net = null;
let code = '';
let room = null;
let unwatch = null;
let scene = null;
let banner = null;
let joined = false;
let busy = false;           // 답 보내는 중
let shownKey = '';          // 지금 보여 주는 문제 (같은 문제를 다시 그리지 않게)
let lastPhase = '';
let lastCount = 0;
let control = null;         // 직접 조종 모드 입력·물리
let padShown = false;

const me = () => room?.players?.[net.uid];
const isRun = () => room?.settings?.mode === 'run';
const phaseOf = () => {
  const s = room?.state;
  if (!s) return 'lobby';
  if (s.phase === 'countdown' && net.now() >= s.startAt) return 'playing'; // 선생님 화면보다 먼저 출발
  return s.phase;
};

document.addEventListener('pointerdown', () => audioContext(), { once: true }); // 소리 잠금 해제

// ---------- 입장 ----------
$('#joinForm').onsubmit = async (e) => {
  e.preventDefault();
  const joinCode = $('#codeInput').value.trim();
  const name = cleanName($('#nameInput').value);
  if (!/^\d{4}$/.test(joinCode)) return showJoinError('방 코드 4자리를 입력해 주세요.');
  if (!name) return showJoinError('이름을 입력해 주세요.');
  const btn = $('#joinBtn');
  btn.disabled = true;
  btn.textContent = '들어가는 중…';
  try {
    net ??= await connect();
    const r = await net.readRoom(joinCode);
    if (!r) throw new Error('그런 방이 없어요. 방 코드를 다시 확인해 주세요.');
    const already = r.players?.[net.uid];
    if (!already) {
      if (r.state.phase !== 'lobby') throw new Error('이미 경기가 시작됐어요. 다음 경기에 들어와 주세요.');
      if (Object.keys(r.players || {}).length >= LIMITS.maxPlayers) throw new Error('방이 꽉 찼어요.');
      await net.update(joinCode, {
        [`players/${net.uid}`]: { name, joinedAt: net.now(), round: r.state.round || 1, correct: 0, wrong: 0, answered: 0, stunUntil: 0 },
      });
    } else if (already.name !== name) {
      await net.update(joinCode, { [`players/${net.uid}/name`]: name });
    }
    localStorage.setItem(NAME_KEY, name);
    enterGame(joinCode);
  } catch (err) {
    showJoinError(err.code === 'PERMISSION_DENIED' ? '들어갈 수 없어요. 경기가 시작됐거나 방이 꽉 찼어요.' : err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '들어가기';
  }
};

function showJoinError(msg) {
  $('#joinError').textContent = msg;
  $('#joinError').hidden = false;
}

function enterGame(joinCode) {
  code = joinCode;
  joined = true;
  history.replaceState(null, '', `?room=${code}${new URLSearchParams(location.search).has('debug') ? '&debug' : ''}`);
  $('#join').hidden = true;
  $('#game').hidden = false;
  banner ??= createBanner($('#banner'));
  scene ??= createScene($('#canvasMount'), () => ({
    mode: 'follow',
    phase: { lobby: 'ready', countdown: 'countdown', playing: 'running', finished: 'finished' }[phaseOf()],
    remaining: remainingSeconds(room, net.now()),
    focusUid: net.uid,
  }), () => net.now());
  unwatch?.();
  unwatch = net.watchRoom(code, onRoom);
  // 주소에 ?debug가 있을 때만: 시험·문제 확인용으로 내부 상태 열어 두기
  if (new URLSearchParams(location.search).has('debug')) window.__quizRace = { scene, net, control: () => control, room: () => room };
}

function backToJoin(message) {
  unwatch?.();
  unwatch = null;
  joined = false;
  room = null;
  $('#game').hidden = true;
  $('#join').hidden = false;
  if (message) showJoinError(message);
}

// ---------- 방 데이터가 바뀔 때 ----------
function onRoom(next) {
  if (!joined) return;
  if (!next) return backToJoin('방이 닫혔어요.');
  room = next;
  if (!me()) return backToJoin('선생님이 내보냈어요. 이름을 확인하고 다시 들어와 주세요.');
  scene.view.sync(room, net.uid);
  document.body.classList.toggle('run', isRun());
  if (isRun() && !control) {
    control = createRunControl({ view: scene.view, net, code, getRoom: () => room, onFinish: finishRun });
    scene.onFrame((dt, now) => control.step(dt, now));
  }
  const phase = phaseOf();
  if (phase !== lastPhase) {
    if (phase === 'lobby') { shownKey = ''; banner.clear(); }
    if (phase === 'finished' && lastPhase) sounds.finisher(myRank() === 1 ? 1 : 4);
    if (control) {
      if (phase === 'countdown' || (phase === 'playing' && !control.state)) control.reset(phase === 'playing' ? me().pos : null);
      control.setActive(phase === 'playing' && !me().finishedAt);
    }
    lastPhase = phase;
  }
  render();
}

/** 직접 조종: 결승선 통과 */
async function finishRun(now) {
  control.setActive(false);
  sounds.finisher(1);
  banner.show('', '🏁 결승!', { kind: 'right', ms: 1200 });
  await net.update(code, { [`players/${net.uid}/finishedAt`]: net.serverTime() }).catch(() => toast('연결이 불안정해요.'));
}

const myRank = () => rankRoom(room).findIndex((p) => p.uid === net.uid) + 1;

// 0.2초마다: 카운트다운·남은 시간·쉬는 시간 갱신
setInterval(() => {
  if (!room || !joined) return;
  const s = room.state;
  if (s.phase === 'countdown') {
    const left = Math.ceil((s.startAt - net.now()) / 1000);
    if (left > 0 && left !== lastCount) { lastCount = left; banner.count(String(left)); sounds.count(); }
    if (left <= 0 && lastCount) { lastCount = 0; banner.count('GO!'); sounds.go(); }
  }
  if (phaseOf() !== lastPhase) onRoom(room);
  renderStatus();
  renderStun();
}, 200);

// ---------- 그리기 ----------
function render() {
  renderStatus();
  const phase = phaseOf();
  const p = me();
  const panel = $('#quiz');
  if (phase === 'lobby' || phase === 'countdown') {
    shownKey = '';
    padShown = false;
    panel.innerHTML = isRun() ? `
      <div class="wait run-wait">
        <div class="big">${phase === 'countdown' ? '곧 출발!' : '🙌 준비 완료!'}</div>
        <p><b>${escapeHTML(p.name)}</b> 님, 노란 고리가 있는 캐릭터가 나예요.</p>
        <p class="muted">⬆ <b>달리기</b>를 누르고 있으면 달리고, ◀ ▶ 로 피하고, <b>점프</b>로 장애물을 넘어요.
        높은 장애물은 점프로 못 넘으니 옆으로 피하세요! 부딪히면 넘어져서 잠깐 쉬어요.<br>
        키보드: ↑ 달리기 · ← → 이동 · 스페이스 점프</p>
      </div>` : `
      <div class="wait">
        <div class="big">${phase === 'countdown' ? '곧 출발!' : '🙌 준비 완료!'}</div>
        <p><b>${escapeHTML(p.name)}</b> 님, 노란 고리가 있는 캐릭터가 나예요.</p>
        <p class="muted">선생님이 시작하면 문제가 나와요. 문제를 맞힐 때마다 결승선을 향해 달려가요!<br>
        결승까지 <b>${room.settings.goal}문제</b>${room.settings.stunMs ? `, 틀리면 ${room.settings.stunMs / 1000}초 쉬어요` : ''}.</p>
      </div>`;
    return;
  }
  if (phase === 'finished' || p.finishedAt) {
    shownKey = '';
    padShown = false;
    const rank = myRank();
    const top = rankRoom(room).slice(0, 5);
    panel.innerHTML = `
      <div class="wait">
        <div class="big">${p.finishedAt ? '🏁 결승 도착!' : '⏰ 경기 끝!'}</div>
        <p class="rank-big">${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : ''} 지금 <b>${rank}등</b></p>
        ${isRun() ? '' : `<p class="muted">맞힘 ${p.correct || 0} · 틀림 ${p.wrong || 0}</p>`}
        ${phase === 'finished' ? `<ol class="mini-rank">${top.map((x) => `<li class="${x.uid === net.uid ? 'me' : ''}">${escapeHTML(x.name)} <span>${isRun() ? (x.finishedAt ? '🏁' : `${Math.round(progressFor(x, room.settings, finishZ()) * 100)}%`) : x.correct || 0}</span></li>`).join('')}</ol>`
          : '<p class="muted">다른 친구들이 들어올 때까지 응원해 주세요!</p>'}
      </div>`;
    return;
  }
  if (isRun()) return renderPad();
  renderQuestion();
}

const finishZ = () => scene?.view.track()?.finishZ ?? -100;

/** 직접 조종 버튼 (한 번만 그림: 누르고 있는 중에 다시 그려지면 손가락이 떨어진 것으로 처리되므로) */
function renderPad() {
  if (padShown) return;
  padShown = true;
  const panel = $('#quiz');
  panel.innerHTML = `
    <div class="pad">
      <div class="pad-side">
        <button class="ctl" data-ctl="left" aria-label="왼쪽">◀</button>
        <button class="ctl" data-ctl="right" aria-label="오른쪽">▶</button>
      </div>
      <div class="pad-hint">키보드: ↑ 달리기 · ← → 이동 · 스페이스 점프</div>
      <div class="pad-side">
        <button class="ctl jump" data-ctl="jump">점프</button>
        <button class="ctl run" data-ctl="run">⬆ 달리기</button>
      </div>
    </div>`;
  control.bindPad(panel.querySelector('.pad'));
}

function currentQuestionIndex() {
  const p = me();
  return questionFor(net.uid, room.state.round || 1, room.quiz.questions.length, p.answered || 0);
}

function renderQuestion() {
  const p = me();
  const qi = currentQuestionIndex();
  const key = `${room.state.round}:${p.answered || 0}`;
  if (key === shownKey) return;
  shownKey = key;
  const q = room.quiz.questions[qi];
  $('#quiz').innerHTML = `
    <div class="q-head"><span class="q-num">${(p.answered || 0) + 1}번째 문제</span></div>
    <div class="q-text">${escapeHTML(q.q)}</div>
    <div class="answers">${q.c.map((c, k) => `
      <button class="answer a${k}" data-k="${k}"><span class="mark">${MARKS[k]}</span><span>${escapeHTML(c)}</span></button>`).join('')}
    </div>
    <div class="stun" data-stun hidden><div>💫</div><b>앗! 잠깐 쉬어요</b><span data-stun-left></span></div>`;
  renderStun();
}

$('#quiz').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-k]');
  if (!b || busy || phaseOf() !== 'playing') return;
  const p = me();
  if (!p || p.finishedAt || (p.stunUntil || 0) > net.now()) return;
  busy = true;
  const choice = Number(b.dataset.k);
  const qi = currentQuestionIndex();
  const right = (await answerHash(room.quiz.salt, qi, choice)) === room.quiz.questions[qi].h;
  b.classList.add(right ? 'right' : 'wrong');
  const correct = (p.correct || 0) + (right ? 1 : 0);
  if (right) {
    sounds.correct();
    banner.show('', correct >= room.settings.goal ? '🏁 결승!' : '⭕ 정답!', { kind: 'right', ms: 700 });
  } else {
    sounds.wrong();
    banner.show('', '❌ 아쉬워요', { kind: 'wrong', ms: 700 });
  }
  // 정답·오답 표시를 잠깐 보여 준 뒤 기록 (기록되면 다음 문제가 나옴).
  // 시각은 기록하는 순간에 재야 '쉬는 시간'이 온전히 2초가 됩니다.
  setTimeout(async () => {
    const now = net.now();
    const base = `players/${net.uid}`;
    const patch = { [`${base}/answered`]: (p.answered || 0) + 1 };
    if (right) {
      Object.assign(patch, { [`${base}/correct`]: correct, [`${base}/lastCorrectAt`]: now });
      if (correct >= room.settings.goal) patch[`${base}/finishedAt`] = net.serverTime();
    } else {
      Object.assign(patch, { [`${base}/wrong`]: (p.wrong || 0) + 1, [`${base}/stunUntil`]: now + (room.settings.stunMs || 0) });
    }
    try { await net.update(code, patch); } catch { toast('연결이 불안정해요. 다시 눌러 주세요.'); shownKey = ''; render(); }
    busy = false;
  }, right ? 350 : 500);
});

function renderStatus() {
  const p = me();
  if (!p) return;
  const rem = remainingSeconds(room, net.now());
  $('#myName').textContent = p.name;
  const progress = progressFor(p, room.settings, finishZ());
  $('#myScore').textContent = isRun() ? `${Math.round((control?.state && !p.finishedAt ? Math.min(1, Math.max(0, (26 - control.state.z) / (26 - finishZ()))) : progress) * 100)}%` : `${p.correct || 0} / ${room.settings.goal}`;
  $('#myRank').textContent = phaseOf() === 'lobby' ? '-' : `${myRank()}등`;
  $('#myTime').textContent = rem === Infinity ? '∞' : formatTime(rem);
  $('#myProgress').style.width = isRun() ? $('#myScore').textContent : `${Math.min(100, ((p.correct || 0) / room.settings.goal) * 100)}%`;
  document.body.classList.toggle('final', phaseOf() === 'playing' && rem <= 10);
}

function renderStun() {
  if (isRun()) {
    const left = ((control?.state?.st || 0) - net.now()) / 1000;
    document.body.classList.toggle('stunned', left > 0);
    return;
  }
  const box = $('[data-stun]');
  if (!box) return;
  const left = ((me()?.stunUntil || 0) - net.now()) / 1000;
  box.hidden = !(left > 0);
  $('#quiz').classList.toggle('stunned', left > 0);
  if (left > 0) $('[data-stun-left]').textContent = `${Math.ceil(left)}초`;
}

$('#soundBtn').onclick = () => {
  setSetting('sound', !state.sound);
  $('#soundBtn').textContent = state.sound ? '🔊' : '🔇';
};
$('#soundBtn').textContent = state.sound ? '🔊' : '🔇';

// 방 코드가 주소에 있고 예전에 들어온 적이 있으면 자동으로 다시 들어가기 (새로고침 대비)
if ($('#codeInput').value && $('#nameInput').value && sessionStorage.getItem('quiz-race-joined') === $('#codeInput').value) {
  $('#joinForm').requestSubmit();
}
window.addEventListener('beforeunload', () => { if (joined) sessionStorage.setItem('quiz-race-joined', code); });
