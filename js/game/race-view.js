// 퀴즈 레이스 3D 경기 화면 (선생님 화면·학생 화면 공용)
//  - 문제 풀기 모드: 방 데이터(room)를 받아 선수들을 세우고, 맞힌 개수만큼 앞으로 달려가게 합니다.
//  - 직접 조종 모드: 학생들이 보낸 위치(players/uid/pos)대로 움직입니다. 내 캐릭터는 setLocal()로
//    받은 내 조작 결과를 지연 없이 그리고, 다른 학생은 받은 위치 사이를 부드럽게 이어 그립니다.
//  - 문제를 맞히면 한 칸 거리를 약 0.9초 동안 달려가고(점프·회피 포함), 틀리면 넘어져 있다가 일어납니다.
//  - 결승에 들어온 선수는 결승선에서 만세를 부릅니다.
import { THREE, clearGroup, add, box, cylinder, ball, bakeInto } from './parts.js';
import { makeRunObstacles, obstacleX } from '../shared/run-obstacles.js';
import { buildMover } from './moving-obstacles.js';
import { buildTrack, animateObstacles } from './tracks/index.js';
import { createRunner, animateRunner, idleRunner } from './characters/index.js';
import { START_Z, laneX, laneRow, jumpHeightAt, dodgeOffsetAt } from './layout.js';
import { progressOf, joinOrder } from '../shared/rules.js';

const SECONDS_PER_STEP = 0.9; // 문제 하나를 맞혔을 때 달려가는 시간
const BASE_RUN_LENGTH = 126;

export function createRaceView(stage) {
  let track = null;
  let trackId = '';
  let style = '';
  let rosterKey = '';
  let goal = 10;
  let me = '';
  let mode = 'quiz';
  let localState = null; // 직접 조종: 내 위치 {x, z, j, st, finished}
  let runObstacles = [];  // 직접 조종 전용 장애물 (허들·벽·움직이는 블록)
  let runKey = '';
  let runGroup = null;
  let movers = [];        // 움직이는 블록의 3D 그룹
  let startAt = 0;
  let clock = 0;
  const runners = new Map(); // uid → runner
  const RUN_ROW_GAP = 1.1;    // 직접 조종 모드의 출발 줄 간격

  function setTrack(id) {
    if (id === trackId && track) return;
    trackId = id;
    clearGroup(stage.courseGroup);
    track = buildTrack(id);
    stage.courseGroup.add(track.group);
    stage.setSky(track.sky, track.fog);
    stage.setTrackShadows(track.shadows);
    rosterKey = ''; // 출발 위치가 트랙마다 달라서 다시 세움
  }

  function place(r, x, z, sway = 0) {
    const c = track.centerX;
    r.group.position.set(x + c(z), 0, z);
    r.group.rotation.y = (track.curved ? Math.atan2(c(z + 1) - c(z - 1), 2) : 0) + sway;
  }

  /** 내 캐릭터 발밑의 노란 고리 */
  function meRing() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.12, 32),
      new THREE.MeshBasicMaterial({ color: '#ffd34e', transparent: true, opacity: 0.95, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.13;
    return ring;
  }

  function syncRoster(players) {
    const order = joinOrder(players);
    const key = `${style}|${trackId}|${me}|${mode}|` + order.map((uid) => `${uid}:${players[uid].name}`).join(',');
    if (key === rosterKey) return;
    rosterKey = key;
    clearGroup(stage.playerGroup);
    runners.clear();
    order.forEach((uid, i) => {
      const p = players[uid];
      const r = createRunner(style, i, p.name, true);
      const row = laneRow(i);
      r.uid = uid;
      r.name = p.name;
      // 직접 조종: 뒷줄이 불리하지 않게 줄 간격을 좁히고, 겹치지 않게 홀수 줄은 반 칸 옆으로
      const run = mode === 'run';
      const stagger = run ? ((row % 2) - 0.5) * 1.3 : track.curved ? ((row % 2) - 0.5) * 0.48 : 0;
      r.baseX = laneX(i) + stagger;
      r.startZ = START_Z + row * (run ? Math.min(track.rowGap, RUN_ROW_GAP) : track.rowGap);
      r.shown = progressOf(p, goal); // 화면에 보이는 진행률 (실제 맞힌 개수를 따라감)
      r.shadow.visible = !stage.shadows;
      if (uid === me) r.group.add(meRing());
      place(r, r.baseX, r.startZ);
      idleRunner(r);
      stage.playerGroup.add(r.group);
      runners.set(uid, r);
    });
  }

  function pose(r, now, moving, z, x, stepScale, jump) {
    const p = r.player || {};
    const stunUntil = r.stunUntil ?? p.stunUntil ?? 0;
    const stunned = stunUntil > now && !r.finished;
    r.model.rotation.x = 0;
    if (stunned) {
      // 넘어짐: 뒤로 벌러덩 + 살짝 들썩
      idleRunner(r);
      r.model.rotation.x = -1.25;
      r.model.position.y = r.model.userData.baseY + 0.45 + Math.abs(Math.sin(clock * 9)) * 0.08;
      r.armL.rotation.x = r.armR.rotation.x = 2.2;
    } else if (r.finished) {
      // 결승: 만세 점프
      idleRunner(r);
      const hop = Math.abs(Math.sin(clock * 5 + r.baseX));
      r.model.position.y = r.model.userData.baseY + hop * 0.5;
      r.armL.rotation.x = r.armR.rotation.x = 2.9;
    } else if (moving || jump > 0.05) {
      animateRunner(r, z, jump ?? jumpHeightAt(track.obstacles, x, z), stepScale);
    } else {
      idleRunner(r);
      r.model.position.y = r.model.userData.baseY + Math.abs(Math.sin(clock * 3 + r.baseX)) * 0.04; // 제자리 숨쉬기
    }
  }

  // ---------- 직접 조종 전용 장애물 ----------
  const HURDLE_COLORS = ['#ff5578', '#ffb03c', '#46cfed', '#a477ef', '#5fcf6b'];
  function buildRunObstacles(list) {
    if (runGroup) { runGroup.removeFromParent(); clearGroup(runGroup); }
    runGroup = new THREE.Group();
    movers = [];
    const fixed = new THREE.Group();
    const c = track.centerX;
    const turn = (z) => (track.curved ? Math.atan2(c(z + 1) - c(z - 1), 2) : 0);
    list.forEach((o, i) => {
      if (o.mover) { // 굴러가는 돌·회전 막대
        const m = buildMover(o, c, HURDLE_COLORS[i % HURDLE_COLORS.length]);
        runGroup.add(m.group);
        movers.push({ update: m.update });
        return;
      }
      const g = new THREE.Group();
      g.position.set(c(o.z) + o.x, 0, o.z);
      g.rotation.y = turn(o.z);
      const w = o.halfWidth * 2;
      if (o.kind === 'hurdle') {
        const color = HURDLE_COLORS[i % HURDLE_COLORS.length];
        for (const side of [-1, 1]) {
          add(g, cylinder(0.12, 0.14, 0.8, '#fff3d9'), side * (o.halfWidth - 0.15), 0.4, 0);
          add(g, ball(0.18, color), side * (o.halfWidth - 0.15), 0.85, 0);
        }
        const stripes = Math.max(2, Math.round(w / 1.4));
        for (let k = 0; k < stripes; k++) {
          add(g, box(w / stripes, 0.26, 0.26, k % 2 ? '#ffffff' : color), -o.halfWidth + (k + 0.5) * (w / stripes), 0.65, 0);
        }
        fixed.add(g);
      } else if (o.kind === 'wall') {
        add(g, box(w, 2.6, 0.8, '#7c6cd8'), 0, 1.3, 0);
        add(g, box(w + 0.1, 0.25, 0.9, '#ffd34e'), 0, 2.7, 0);
        for (let k = 0; k < Math.floor(w / 1.6); k++) add(g, ball(0.22, '#fff3d9'), -o.halfWidth + 0.8 + k * 1.6, 1.5, 0.42);
        fixed.add(g);
      } else {
        const body = add(g, new THREE.Group());
        add(body, box(2.6, 2.3, 1.4, '#ff6c4a'), 0, 1.15, 0);
        add(body, box(2.7, 0.3, 1.5, '#ffd34e'), 0, 2.35, 0);
        for (const side of [-1, 1]) add(body, ball(0.2, '#1d2926'), side * 0.5, 1.5, 0.71); // 눈
        add(body, box(0.9, 0.12, 0.05, '#1d2926'), 0, 1.0, 0.71);                       // 입
        bakeInto(body, { deep: true });
        runGroup.add(g);
        movers.push({ g, o });
      }
    });
    bakeInto(fixed, { deep: true });
    runGroup.add(fixed);
    stage.courseGroup.add(runGroup);
  }

  function syncRunObstacles(room) {
    const s = room.settings;
    const round = room.state?.round || 1;
    const key = `${trackId}|${s.seed}|${round}|${s.density}`;
    startAt = room.state?.startAt || 0;
    if (key === runKey) return;
    runKey = key;
    runObstacles = makeRunObstacles({ seed: s.seed ?? 1, round, finishZ: track.finishZ, existing: track.obstacles, density: s.density });
    buildRunObstacles(runObstacles);
  }

  function animateMovers(now) {
    const t = startAt && now > startAt ? (now - startAt) / 1000 : 0;
    for (const m of movers) {
      if (m.update) m.update(t);
      else m.g.position.x = track.centerX(m.o.z) + obstacleX(m.o, t);
    }
  }

  /** 직접 조종 모드: 받은 위치로 그리기 */
  function updateRun(dt, now, stepScale) {
    const length = START_Z - track.finishZ;
    const k = 1 - Math.exp(-dt * 10);
    animateMovers(now);
    for (const r of runners.values()) {
      const p = r.player || {};
      const local = r.uid === me ? localState : null;
      const src = local || p.pos;
      if (!src || (p.pos && !local && p.pos.round !== undefined && p.pos.round !== p.round)) {
        r.cur = null; // 아직 출발 전: 출발선에 서 있기
        r.stunUntil = 0;
        r.shown = 0;
        r.finished = false;
        place(r, r.baseX, r.startZ);
        pose(r, now, false, r.startZ, r.baseX, stepScale, 0);
        continue;
      }
      if (!r.cur || local) r.cur = { x: src.x, z: src.z, j: src.j || 0 };
      else {
        r.cur.x += (src.x - r.cur.x) * k;
        r.cur.z += (src.z - r.cur.z) * k;
        r.cur.j += ((src.j || 0) - r.cur.j) * k;
      }
      r.finished = Boolean(p.finishedAt || local?.finished);
      r.stunUntil = (local ? local.st : src.st) || 0;
      const moving = r.lastRunZ !== undefined && Math.abs(r.cur.z - r.lastRunZ) > dt * 0.4;
      r.lastRunZ = r.cur.z;
      r.shown = r.finished ? 1 : Math.min(1, Math.max(0, (START_Z - r.cur.z) / length));
      r.progress = r.shown;
      place(r, r.cur.x, r.cur.z);
      pose(r, now, moving, r.cur.z, r.cur.x, stepScale, r.cur.j);
    }
  }

  return {
    /** 방 데이터가 바뀔 때마다 호출 */
    sync(room, myUid = '') {
      if (!room?.settings) return;
      goal = room.settings.goal;
      mode = room.settings.mode || 'quiz';
      me = myUid;
      setTrack(room.settings.track);
      if (mode === 'run') syncRunObstacles(room);
      else if (runGroup) { runGroup.removeFromParent(); clearGroup(runGroup); runGroup = null; runKey = ''; runObstacles = []; }
      if (room.settings.character !== style) { style = room.settings.character; rosterKey = ''; }
      syncRoster(room.players || {});
      for (const [uid, r] of runners) r.player = room.players?.[uid];
    },

    /** 직접 조종 전용 장애물 목록과 시작 시각 (충돌 판정용) */
    runObstacles: () => runObstacles,
    runStartAt: () => startAt,

    /** 직접 조종: 내 캐릭터의 지금 상태 */
    setLocal(state) { localState = state; },

    /** 매 프레임 */
    update(dt, now) {
      if (!track) return;
      clock += dt;
      animateObstacles(track.animated, clock);
      const stepScale = BASE_RUN_LENGTH / (START_Z - track.finishZ);
      if (mode === 'run') return updateRun(dt, now, stepScale);
      const speed = dt / (SECONDS_PER_STEP * goal);
      for (const r of runners.values()) {
        const p = r.player || {};
        const target = progressOf(p, goal);
        const stunned = (p.stunUntil || 0) > now;
        if (target < r.shown) r.shown = target;                 // 다시 하기로 처음으로
        else if (!stunned) r.shown = Math.min(target, r.shown + speed);
        r.finished = r.shown >= 1;
        r.progress = r.shown;
        const moving = r.shown < target - 1e-4 && !stunned;
        const z = r.startZ - (r.startZ - track.finishZ) * r.shown;
        const x = r.baseX + dodgeOffsetAt(track.obstacles, r.baseX, z);
        place(r, x, z);
        pose(r, now, moving, z, x, stepScale);
      }
    },

    /** 앞선 순서 (카메라·알림용) */
    order: () => [...runners.values()].sort((a, b) => b.shown - a.shown || (a.player?.finishedAt || Infinity) - (b.player?.finishedAt || Infinity)),
    runner: (uid) => runners.get(uid),
    track: () => track,

    /** 이름표 크기를 카메라 거리에 맞춤 */
    updateLabels(camera) {
      for (const r of runners.values()) {
        const s = Math.min(1.15, Math.max(0.42, camera.position.distanceTo(r.group.position) / 24));
        r.label.scale.set(2.5 * s, 0.7 * s, 1);
      }
    },
    /** 품질이 바뀌어 실시간 그림자가 켜지거나 꺼질 때 */
    refreshShadows() {
      for (const r of runners.values()) r.shadow.visible = !stage.shadows;
    },
  };
}
