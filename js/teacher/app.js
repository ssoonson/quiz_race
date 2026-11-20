// 선생님 화면: 방 만들기 → 대기실(QR·참가자) → 경기(3D·순위) → 결과
import { $, escapeHTML, toast, formatTime } from '../core/dom.js';
import { on } from '../core/events.js';
import { state, setSetting } from '../core/store.js';
import { sounds, audioContext } from '../core/audio.js';
import { startBgm, stopBgm } from '../core/bgm.js';
import { TRACKS, CHARACTER_LABELS } from '../core/config.js';
import { connect } from '../net/index.js';
import {
  DEFAULT_SETTINGS, GOAL_OPTIONS, TIME_OPTIONS, COUNTDOWN_MS, LIMITS,
  answerHash, makeSalt, ranking, rankRoom, progressFor, MODES, runLimits, remainingSeconds,
} from '../shared/rules.js';
import { createScene } from '../shared/scene.js';
import { createBanner } from '../shared/banner.js';
import { mountEditor, currentSet } from './editor.js';
import { readyQuestions } from './quiz-sets.js';
import qrcode from '../lib/qrcode.js';

const ROOM_KEY = 'quiz-race-teacher-room';
const SETTINGS_KEY = 'quiz-race-teacher-settings';
const MEDALS = ['🥇', '🥈', '🥉'];

const net = await connect();
document.addEventListener('pointerdown', () => audioContext(), { once: true }); // 소리 잠금 해제
let code = '';
let room = null;
let unwatch = null;
let cameraMode = 'auto';
let followUid = '';
let scene = null;
let banner = null;

// ---------- 상단 바 ----------
$('#modeBadge').textContent = net.mode === 'firebase' ? '🟢 온라인' : '🧪 체험 모드';
$('#modeBadge').title = net.mode === 'firebase'
  ? 'Firebase로 연결됨: 학생 태블릿에서 들어올 수 있습니다.'
  : 'firebase-config.js가 비어 있어 같은 컴퓨터의 다른 탭에서만 들어올 수 있습니다.';
const renderToggles = () => {
  $('#soundBtn').textContent = state.sound ? '🔊 효과음' : '🔇 효과음';
  $('#musicBtn').textContent = state.bgm !== 'off' ? '🎵 음악' : '🔕 음악';
};
$('#soundBtn').onclick = () => { setSetting('sound', !state.sound); renderToggles(); };
$('#musicBtn').onclick = () => {
  setSetting('bgm', state.bgm === 'off' ? 'builtin' : 'off');
  if (state.bgm === 'off') stopBgm(0.3); else if (room?.state?.phase === 'playing') startBgm();
  renderToggles();
};
$('#fullBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
renderToggles();

// ---------- 1) 방 만들기 화면 ----------
mountEditor($('#editor'));

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}

function renderSettingsCard() {
  const s = loadSettings();
  const opt = (list, value, label) => list.map((v) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${label(v)}</option>`).join('');
  $('#roomSettings').innerHTML = `
    <div class="card-head"><h2>⚙ 경기 설정</h2></div>
    <label>게임 방식<select data-k="mode">${opt(Object.keys(MODES), s.mode, (v) => MODES[v])}</select></label>
    ${s.mode === 'run' ? '' : `<label>결승까지 맞힐 문제 수<select data-k="goal">${opt(GOAL_OPTIONS, s.goal, (v) => `${v}문제`)}</select></label>`}
    <label>제한 시간<select data-k="timeLimit">${opt(TIME_OPTIONS, s.timeLimit, (v) => (v ? `${v / 60}분` : '없음 (모두 결승까지)'))}</select></label>
    <label>${s.mode === 'run' ? '부딪히면 쉬는 시간' : '틀리면 쉬는 시간'}<select data-k="stunMs">${opt([0, 1000, 2000, 3000], s.stunMs, (v) => (v ? `${v / 1000}초` : s.mode === 'run' ? '최소(1.2초)' : '쉬지 않음'))}</select></label>
    <label>트랙<select data-k="track">${opt(Object.keys(TRACKS), s.track, (v) => `${TRACKS[v].emoji} ${TRACKS[v].name}`)}</select></label>
    <label>캐릭터<select data-k="character">${opt(Object.keys(CHARACTER_LABELS), s.character, (v) => CHARACTER_LABELS[v])}</select></label>
    <p class="help">${s.mode === 'run'
      ? '학생이 직접 조종합니다: ↑(달리기 버튼)로 달리고, ← →로 피하고, 스페이스(점프 버튼)로 장애물을 넘습니다. 먼저 결승에 들어오면 이기고, 시간이 끝나면 더 멀리 간 순서로 순위를 정합니다. 문제집은 쓰지 않습니다.'
      : '학생은 문제를 맞힐 때마다 결승선 쪽으로 달려갑니다. 먼저 정한 개수를 맞히면 결승, 시간이 끝나면 맞힌 개수로 순위를 정합니다.'}</p>
    <button class="primary big" data-create>🚪 방 만들기</button>
    ${net.mode === 'local' ? '<p class="notice">🧪 체험 모드입니다. 방을 만든 뒤 나오는 ‘학생 화면 열기’로 같은 컴퓨터에서 학생 탭을 여러 개 띄워 해 볼 수 있습니다. 학생 태블릿에서 들어오려면 firebase-config.js를 채워야 합니다(README 참고).</p>' : ''}`;
}
renderSettingsCard();

$('#roomSettings').addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const s = loadSettings();
  s[k] = ['goal', 'timeLimit', 'stunMs'].includes(k) ? Number(e.target.value) : e.target.value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  if (k === 'mode') renderSettingsCard(); // 방식에 따라 보이는 항목이 다름
});

$('#roomSettings').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-create]')) return;
  const settings = loadSettings();
  const runMode = settings.mode === 'run';
  if (runMode) Object.assign(settings, runLimits(settings.track)); // 서버 규칙이 쓰는 속도·결승 기준
  const set = currentSet();
  const questions = readyQuestions(set);
  if (!runMode && !questions.length) return toast('완성된 문제가 없습니다. 문제와 보기 4개를 모두 채워 주세요.');
  const btn = e.target.closest('button');
  btn.disabled = true;
  try {
    const salt = makeSalt();
    const quiz = runMode ? { title: '자유 달리기', salt, questions: [] } : {
      title: set.title.slice(0, 40),
      salt,
      questions: await Promise.all(questions.slice(0, LIMITS.questions).map(async (x, i) => ({
        q: x.q, c: x.c, h: await answerHash(salt, i, x.a),
      }))),
    };
    const newCode = await net.createRoom({
      host: net.uid,
      createdAt: net.now(),
      settings,
      quiz,
      state: { phase: 'lobby', round: 1 },
    });
    enterRoom(newCode);
  } catch (err) {
    toast('방을 만들지 못했습니다: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------- 2) 방 화면 ----------
function enterRoom(newCode) {
  code = newCode;
  sessionStorage.setItem(ROOM_KEY, code);
  $('#setup').hidden = true;
  $('#room').hidden = false;
  banner ??= createBanner($('#banner'));
  scene ??= createScene($('#canvasMount'), sceneContext, net.now);
  unwatch?.();
  unwatch = net.watchRoom(code, onRoom);
}

function leaveRoom() {
  unwatch?.();
  unwatch = null;
  room = null;
  code = '';
  sessionStorage.removeItem(ROOM_KEY);
  stopBgm(0.3);
  $('#room').hidden = true;
  $('#results').hidden = true;
  $('#setup').hidden = false;
  renderSettingsCard();
}

const phaseOf = () => room?.state?.phase || 'lobby';
const isLive = () => ['countdown', 'playing'].includes(phaseOf());

function sceneContext() {
  const phase = phaseOf();
  return {
    mode: cameraMode,
    phase: { lobby: 'ready', countdown: 'countdown', playing: 'running', finished: 'finished' }[phase],
    remaining: remainingSeconds(room, net.now()),
    focusUid: followUid,
  };
}

// 이벤트 감지용 이전 상태
let seen = { players: new Set(), finished: new Set(), leader: '', phase: '' };

function onRoom(next) {
  if (!next) { toast('방이 닫혔습니다.'); leaveRoom(); return; }
  if (next.host !== net.uid) { toast('이 방의 선생님이 아닙니다.'); leaveRoom(); return; }
  const prevPhase = seen.phase;
  room = next;
  const players = room.players || {};
  scene.view.sync(room, '');

  // 새로 들어온 학생
  for (const uid of Object.keys(players)) {
    if (!seen.players.has(uid) && seen.phase) sounds.join();
  }
  seen.players = new Set(Object.keys(players));

  const phase = phaseOf();
  if (phase !== prevPhase) onPhaseChange(phase, prevPhase);
  seen.phase = phase;

  if (phase === 'playing') detectRaceEvents(players);
  scheduleRender(phase !== prevPhase);
}

// 직접 조종 모드에서는 학생 위치가 1초에 수백 번 바뀌므로 화면 표(순위·대기실)는 0.4초에 한 번만 다시 그림
// (너무 자주 그리면 버튼을 누르는 도중에 바뀌어 클릭이 씹힘)
let redrawTimer = null;
let lastRender = 0;
function scheduleRender(now = false) {
  const wait = now ? 0 : Math.max(0, 400 - (performance.now() - lastRender));
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => { lastRender = performance.now(); if (room) renderAll(); }, wait);
}

function onPhaseChange(phase, prev) {
  if (phase === 'lobby') {
    seen.finished = new Set();
    seen.leader = '';
    banner.clear();
    $('#results').hidden = true;
    stopBgm(0.4);
  }
  if (phase === 'playing' && prev) { sounds.go(); startBgm(); }
  if (phase === 'finished') {
    stopBgm(2);
    if (prev) sounds.finisher(1);
    showResults();
  }
}

function detectRaceEvents(players) {
  const order = ranking(players, room.settings.mode);
  for (const p of order) {
    if (p.finishedAt && !seen.finished.has(p.uid)) {
      seen.finished.add(p.uid);
      const rank = seen.finished.size;
      if (rank <= 3) {
        banner.show(`${rank}위 골인!`, `${MEDALS[rank - 1]} ${p.name}`, { kind: 'finisher', ms: 2200, level: 4 });
        sounds.finisher(rank);
        scene.confetti(rank === 1 ? 160 : 70);
      }
    }
  }
  const leader = order[0];
  const started = room.settings.mode === 'run' ? progressFor(leader, room.settings, finishZ()) > 0.03 : (leader?.correct || 0) > 0;
  if (leader && started && leader.uid !== seen.leader) {
    if (seen.leader) {
      banner.show('선두 교체!', `🔥 ${leader.name}`, { kind: 'leader', level: 2 });
      sounds.lead();
    }
    seen.leader = leader.uid;
  }
}

// 0.25초마다: 카운트다운 숫자, 남은 시간, 자동 종료
let lastCount = 0;
let finalWarned = false;
setInterval(async () => {
  if (!room) return;
  const now = net.now();
  const s = room.state;
  if (s.phase === 'countdown') {
    const left = Math.ceil((s.startAt - now) / 1000);
    if (left > 0 && left !== lastCount) { lastCount = left; banner.count(String(left)); sounds.count(); }
    if (now >= s.startAt) {
      lastCount = 0;
      banner.count('GO!');
      await net.update(code, { 'state/phase': 'playing' }).catch(() => {});
    }
  }
  if (s.phase === 'playing') {
    const rem = remainingSeconds(room, now);
    if (rem <= 10 && rem > 0 && !finalWarned) {
      finalWarned = true;
      banner.show('막판 스퍼트!', '⏰ 마지막 10초', { kind: 'final', level: 3 });
      sounds.final();
    }
    const players = Object.values(room.players || {});
    const allDone = players.length > 0 && players.every((p) => p.finishedAt);
    if (rem <= 0 || allDone) await finishGame();
  } else {
    finalWarned = false;
  }
  renderTimer();
}, 250);

async function finishGame() {
  if (phaseOf() !== 'playing') return;
  await net.update(code, { 'state/phase': 'finished', 'state/endAt': net.now() }).catch(() => {});
}

// ---------- 버튼 ----------
$('#startBtn').onclick = async () => {
  const count = Object.keys(room?.players || {}).length;
  if (!count) return toast('아직 들어온 학생이 없습니다.');
  await net.update(code, { 'state/phase': 'countdown', 'state/startAt': net.now() + COUNTDOWN_MS, 'state/endAt': null });
};
$('#endBtn').onclick = async () => {
  if (!isLive()) return;
  if (confirm('경기를 지금 끝낼까요? 지금까지 맞힌 개수로 순위를 정합니다.')) {
    if (phaseOf() === 'countdown') await net.update(code, { 'state/phase': 'playing' });
    await finishGame();
  }
};
$('#replayBtn').onclick = () => replay();
$('#closeBtn').onclick = async () => {
  if (!confirm('방을 닫을까요? 학생들의 연결이 끊어집니다.')) return;
  await net.removeRoom(code).catch(() => {});
  leaveRoom();
};

async function replay() {
  const round = (room.state.round || 1) + 1;
  const patch = { 'state/phase': 'lobby', 'state/round': round, 'state/startAt': null, 'state/endAt': null };
  for (const uid of Object.keys(room.players || {})) {
    Object.assign(patch, {
      [`players/${uid}/correct`]: 0, [`players/${uid}/wrong`]: 0, [`players/${uid}/answered`]: 0,
      [`players/${uid}/stunUntil`]: 0, [`players/${uid}/round`]: round, [`players/${uid}/pos`]: null,
      [`players/${uid}/finishedAt`]: null, [`players/${uid}/lastCorrectAt`]: null,
    });
  }
  await net.update(code, patch);
}

async function kick(uid) {
  const p = room?.players?.[uid];
  if (!p || !confirm(`‘${p.name}’ 학생을 내보낼까요?`)) return;
  await net.update(code, { [`players/${uid}`]: null });
}

// ---------- 그리기 ----------
function joinUrl() {
  return new URL(`index.html?room=${code}`, location.href).href;
}

function renderAll() {
  renderLobby();
  renderBoard();
  renderButtons();
  renderCameraPanel();
}

function renderLobby() {
  const el = $('#lobby');
  el.hidden = phaseOf() !== 'lobby';
  if (el.hidden) return;
  const players = room.players || {};
  const list = Object.entries(players).sort(([, a], [, b]) => a.joinedAt - b.joinedAt);
  const qr = qrcode(0, 'M');
  qr.addData(joinUrl());
  qr.make();
  el.innerHTML = `
    <div class="lobby-left">
      <div class="qr">${qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true })}</div>
    </div>
    <div class="lobby-right">
      <div class="muted">방 코드</div>
      <div class="code">${code}</div>
      <div class="url">${escapeHTML(joinUrl())}</div>
      ${net.mode === 'local' ? `<a class="link-btn" href="${escapeHTML(joinUrl())}" target="_blank" rel="noopener">🧪 학생 화면 열기 (새 탭)</a>` : ''}
      <div class="joined-head"><b>${list.length}명 입장</b><span class="muted">이름을 누르면 내보낼 수 있어요</span></div>
      <div class="chips">${list.map(([uid, p]) => `<button class="chip" data-kick="${escapeHTML(uid)}">${escapeHTML(p.name)}</button>`).join('') || '<span class="muted">학생들이 들어오기를 기다리는 중…</span>'}</div>
      <div class="quiz-info">${room.settings.mode === 'run'
        ? '🎮 직접 조종 · ↑ 달리기 · ← → 이동 · 스페이스 점프'
        : `📚 ${escapeHTML(room.quiz.title)} · ${(room.quiz.questions || []).length}문제 · 결승 ${room.settings.goal}문제`} · ${room.settings.timeLimit ? `${room.settings.timeLimit / 60}분` : '시간 제한 없음'}</div>
    </div>`;
}
$('#lobby').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kick]');
  if (b) kick(b.dataset.kick);
});

const finishZ = () => scene?.view.track()?.finishZ ?? -100;
const scoreText = (p) => (room.settings.mode === 'run'
  ? (p.finishedAt ? '🏁' : `${Math.round(progressFor(p, room.settings, finishZ()) * 100)}%`)
  : `${p.correct || 0}/${room.settings.goal}`);

function renderBoard() {
  const goal = room.settings.goal;
  const order = rankRoom(room);
  $('#board').innerHTML = `
    <div class="panel-title"><strong>🏁 순위</strong><span class="muted">${order.length}명 · ${room.settings.mode === 'run' ? '직접 조종' : `결승 ${goal}문제`}</span></div>
    <div class="ranking">${order.map((p, i) => `
      <div class="rank-row${followUid === p.uid ? ' followed' : ''}">
        <span class="rank-num">${p.finishedAt ? MEDALS[i] || '🏁' : i + 1}</span>
        <button class="rank-name link" data-follow="${escapeHTML(p.uid)}" title="이 학생 따라가기">${escapeHTML(p.name)}</button>
        <span class="meter"><i style="width:${Math.round(progressFor(p, room.settings, finishZ()) * 100)}%"></i></span>
        <span class="score">${scoreText(p)}</span>
        <button class="xsmall" data-kick="${escapeHTML(p.uid)}" title="내보내기">✕</button>
      </div>`).join('') || '<div class="placeholder">학생이 들어오면 여기에 표시됩니다.</div>'}
    </div>`;
}
$('#board').addEventListener('click', (e) => {
  const k = e.target.closest('[data-kick]');
  if (k) return kick(k.dataset.kick);
  const f = e.target.closest('[data-follow]');
  if (f) { followUid = followUid === f.dataset.follow ? '' : f.dataset.follow; cameraMode = followUid ? 'follow' : 'auto'; renderBoard(); renderCameraPanel(); }
});

function renderButtons() {
  const phase = phaseOf();
  $('#startBtn').disabled = phase !== 'lobby';
  $('#endBtn').disabled = !isLive();
  $('#replayBtn').disabled = phase !== 'finished';
  $('#phaseChip').textContent = { lobby: '대기실', countdown: '출발 준비', playing: '경기 중', finished: '경기 끝' }[phase];
  $('#roomCodeChip').textContent = `방 코드 ${code}`;
}

function renderTimer() {
  const rem = remainingSeconds(room, net.now());
  $('#timer').textContent = rem === Infinity ? '∞' : formatTime(rem);
  $('#room .arena').classList.toggle('final', phaseOf() === 'playing' && rem <= 10);
}

function renderCameraPanel() {
  const modes = { auto: '자동', overview: '무리', follow: '학생 추적' };
  $('#cameraPanel').innerHTML = `
    <div class="panel-title"><strong>🎥 카메라</strong></div>
    <div class="seg">${Object.entries(modes).map(([m, t]) => `<button data-cam="${m}" class="${cameraMode === m ? 'active' : ''}">${t}</button>`).join('')}</div>
    <p class="camera-help">순위표에서 이름을 누르면 그 학생을 따라갑니다.<br>🖱 드래그: 회전 · 휠: 확대/축소 · 더블클릭: 원래대로</p>`;
}
$('#cameraPanel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cam]');
  if (!b) return;
  cameraMode = b.dataset.cam;
  if (cameraMode !== 'follow') followUid = '';
  else if (!followUid) followUid = rankRoom(room)[0]?.uid || '';
  renderCameraPanel();
  renderBoard();
});

// ---------- 3) 결과 ----------
function showResults() {
  const goal = room.settings.goal;
  const order = rankRoom(room);
  const el = $('#results');
  el.innerHTML = `
    <div class="result-card">
      <div class="result-head"><h2>🏆 경기 결과</h2><button class="xbtn" data-close>×</button></div>
      <p class="muted">${room.settings.mode === 'run' ? '🎮 직접 조종' : `${escapeHTML(room.quiz.title)} · 결승 ${goal}문제`} · ${order.length}명</p>
      <div class="result-list">${order.map((p, i) => `
        <div class="result-item${i < 3 ? ' top' : ''}">
          <b>${MEDALS[i] || `${i + 1}위`}</b> <strong>${escapeHTML(p.name)}</strong>
          <span class="muted">${room.settings.mode === 'run' ? (p.finishedAt ? '🏁 결승' : `진행 ${scoreText(p)}`) : `맞힘 ${p.correct || 0} · 틀림 ${p.wrong || 0}${p.finishedAt ? ' · 🏁' : ''}`}</span>
        </div>`).join('')}
      </div>
      <div class="inline"><button data-copy>결과 복사</button><button class="primary" data-replay>↻ 같은 학생들과 다시 하기</button></div>
    </div>`;
  setTimeout(() => { if (phaseOf() === 'finished') el.hidden = false; }, 1800);
}
$('#results').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) $('#results').hidden = true;
  if (e.target.closest('[data-replay]')) replay();
  if (e.target.closest('[data-copy]')) {
    const text = rankRoom(room).map((p, i) => `${i + 1}. ${p.name} (${room.settings.mode === 'run' ? scoreText(p) : `맞힘 ${p.correct || 0}, 틀림 ${p.wrong || 0}`})`).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast('결과를 복사했습니다.'), () => toast('클립보드 권한을 확인해 주세요.'));
  }
});

// 새로고침해도 하던 방으로 돌아가기
const saved = sessionStorage.getItem(ROOM_KEY);
if (saved) {
  const r = await net.readRoom(saved).catch(() => null);
  if (r && r.host === net.uid) enterRoom(saved);
  else sessionStorage.removeItem(ROOM_KEY);
}
on('state:changed', renderToggles);
