// 직접 조종 모드: 학생이 키보드(↑ ← → 스페이스)나 화면 버튼으로 내 캐릭터를 움직입니다.
//  - ↑(달리기)를 누르고 있으면 앞으로 달리고, 떼면 천천히 멈춥니다.
//  - ← → 로 좌우 이동, 스페이스(점프 버튼)로 점프합니다.
//  - 장애물에 부딪히면 넘어져 뒤로 밀리고 잠깐 쉽니다. 높은 장애물(회전목마 등)은 점프로 못 넘으니 피해야 합니다.
//  - 내 위치는 1초에 6번 서버로 보냅니다(다른 친구들 화면에 보임).
import { RUN } from '../shared/rules.js';
import { START_Z } from '../game/layout.js';
import { sounds } from '../core/audio.js';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'run', KeyW: 'run',
  Space: 'jump', ArrowDown: 'jump', KeyS: 'jump',
};

/**
 * @param opts.view   3D 경기 화면 (race-view)
 * @param opts.net    연결
 * @param opts.code   방 코드
 * @param opts.getRoom 지금 방 데이터
 * @param opts.onFinish 결승선 통과 시 호출
 */
export function createRunControl({ view, net, code, getRoom, onFinish }) {
  const held = { left: false, right: false, run: false };
  let jumpQueued = false;
  let active = false;
  let s = null;          // {x, z, vz, j, vj, st, grace, finished}
  let lastSend = 0;
  let lastSent = '';

  // ---------- 입력: 키보드 ----------
  const onKey = (down) => (e) => {
    const action = KEYMAP[e.code];
    if (!action || e.target.closest?.('input, textarea')) return;
    e.preventDefault(); // 화면이 스크롤되지 않게
    if (action === 'jump') { if (down && !e.repeat) jumpQueued = true; }
    else held[action] = down;
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  window.addEventListener('blur', () => { held.left = held.right = held.run = false; });

  // ---------- 입력: 화면 버튼 (여러 손가락 동시에) ----------
  function bindPad(pad) {
    pad.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-ctl]');
      if (!b) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      if (b.dataset.ctl === 'jump') jumpQueued = true;
      else held[b.dataset.ctl] = true;
    });
    const up = (e) => {
      const b = e.target.closest('[data-ctl]');
      if (!b) return;
      b.classList.remove('down');
      if (b.dataset.ctl !== 'jump') held[b.dataset.ctl] = false;
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('contextmenu', (e) => e.preventDefault()); // 길게 누를 때 메뉴 안 뜨게
  }

  // ---------- 위치 보내기 ----------
  function send(now, force = false) {
    if (!s) return;
    if (!force && now - lastSend < 1000 / RUN.sendHz) return;
    const room = getRoom();
    const pos = {
      x: Math.round(s.x * 100) / 100,
      z: Math.round(s.z * 100) / 100,
      j: Math.round(s.j * 100) / 100,
      st: Math.round(s.st),
      round: room?.state?.round || 1,
      t: net.serverTime(), // 서버가 받은 시각 (규칙이 속도 검사에 사용)
    };
    const key = `${pos.x},${pos.z},${pos.j},${pos.st}`;
    if (key === lastSent && !force) return;
    lastSend = now;
    lastSent = key;
    net.update(code, { [`players/${net.uid}/pos`]: pos }).catch(() => {
      // 서버가 거절함 (보통은 일어나지 않음): 서버에 남아 있는 위치로 되돌려 맞춤
      const server = getRoom()?.players?.[net.uid]?.pos;
      if (s && server && server.z > s.z) s.z = server.z;
      lastSent = '';
    });
  }

  // ---------- 매 프레임 ----------
  // 화면이 느려 한 프레임이 길어도 같은 속도로 움직이되, 장애물을 뚫고 지나가지 않게 0.04초씩 나눠 계산
  function step(dt, now) {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(0.04, left);
      left -= h;
      tick(h, now - left * 1000);
    }
    if (s) {
      view.setLocal({ x: s.x, z: s.z, j: s.j, st: s.st, finished: s.finished });
      send(now);
    }
  }

  function tick(dt, now) {
    const track = view.track();
    if (!active || !track || !s) return;
    const room = getRoom();
    const maxSpeed = room?.settings?.maxSpeed || (START_Z - track.finishZ) / RUN.raceSeconds;
    const stunned = s.st > now;

    // 앞으로 달리기 (부드럽게 빨라지고 느려짐)
    if (stunned || s.finished) s.vz = 0;
    else {
      const target = held.run ? maxSpeed : 0;
      const rate = maxSpeed * dt * (held.run ? RUN.accel : 1.2);
      s.vz += Math.max(-rate, Math.min(rate, target - s.vz));
    }
    s.z -= s.vz * dt;

    // 좌우 이동
    if (!stunned && !s.finished) {
      const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      s.x = Math.max(-RUN.laneLimit, Math.min(RUN.laneLimit, s.x + dir * RUN.strafeSpeed * dt));
    }

    // 점프
    if (jumpQueued) {
      jumpQueued = false;
      if (s.j <= 0.01 && !stunned && !s.finished) s.vj = Math.sqrt(2 * RUN.gravity * RUN.jumpHeight);
    }
    if (s.j > 0 || s.vj > 0) {
      s.vj -= RUN.gravity * dt;
      s.j = Math.max(0, s.j + s.vj * dt);
      if (s.j === 0) s.vj = 0;
    }

    // 장애물 충돌
    if (!stunned && !s.finished && now > s.grace) {
      for (const o of track.obstacles) {
        const hitX = Math.abs(s.x - o.x) < o.halfWidth * 0.8 + 0.3;
        const hitZ = Math.abs(s.z - o.z) < o.halfDepth * 0.6 + 0.3;
        if (hitX && hitZ && (o.dodge || s.j < o.clearHeight * 0.75)) {
          const stunMs = Math.max(RUN.minStunMs, room?.settings?.stunMs || 0);
          s.st = now + stunMs;
          s.grace = s.st + RUN.graceMs;
          s.z = Math.min(START_Z + 8, s.z + RUN.knockback);
          s.vz = 0;
          s.vj = 0;
          s.j = 0;
          sounds.wrong();
          send(now, true);
          break;
        }
      }
    }

    // 결승
    if (!s.finished && s.z <= track.finishZ) {
      s.finished = true;
      s.z = track.finishZ - 0.5;
      send(now, true);
      onFinish?.(now);
    }

  }

  return {
    bindPad,
    step,
    /** 출발선에 세우기 (카운트다운 시작 때) */
    reset(from) {
      const r = view.runner(net.uid);
      s = {
        x: from?.x ?? (r ? r.baseX : 0), z: from?.z ?? (r ? r.startZ : START_Z),
        vz: 0, j: 0, vj: 0, st: 0, grace: 0, finished: false,
      };
      held.left = held.right = held.run = false;
      lastSent = '';
      view.setLocal({ ...s });
      send(net.now(), true);
    },
    /** 조종 시작/멈춤 */
    setActive(on) {
      active = on;
      if (!on) held.left = held.right = held.run = false;
    },
    get state() { return s; },
    get speedRatio() {
      const track = view.track();
      return s && track ? s.vz / ((START_Z - track.finishZ) / RUN.raceSeconds) : 0;
    },
  };
}
