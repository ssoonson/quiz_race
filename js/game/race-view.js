// 퀴즈 레이스 3D 경기 화면 (선생님 화면·학생 화면 공용)
//  - 방 데이터(room)를 받아 선수들을 세우고, 맞힌 개수만큼 앞으로 달려가게 합니다.
//  - 문제를 맞히면 한 칸 거리를 약 0.9초 동안 달려가고(점프·회피 포함), 틀리면 넘어져 있다가 일어납니다.
//  - 결승에 들어온 선수는 결승선에서 만세를 부릅니다.
import { THREE, clearGroup } from './parts.js';
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
  let clock = 0;
  const runners = new Map(); // uid → runner

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
    const key = `${style}|${trackId}|${me}|` + order.map((uid) => `${uid}:${players[uid].name}`).join(',');
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
      r.baseX = laneX(i) + (track.curved ? ((row % 2) - 0.5) * 0.48 : 0);
      r.startZ = START_Z + row * track.rowGap;
      r.shown = progressOf(p, goal); // 화면에 보이는 진행률 (실제 맞힌 개수를 따라감)
      r.shadow.visible = !stage.shadows;
      if (uid === me) r.group.add(meRing());
      place(r, r.baseX, r.startZ);
      idleRunner(r);
      stage.playerGroup.add(r.group);
      runners.set(uid, r);
    });
  }

  function pose(r, now, moving, z, x, stepScale) {
    const p = r.player || {};
    const stunned = (p.stunUntil || 0) > now && !r.finished;
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
    } else if (moving) {
      animateRunner(r, z, jumpHeightAt(track.obstacles, x, z), stepScale);
    } else {
      idleRunner(r);
      r.model.position.y = r.model.userData.baseY + Math.abs(Math.sin(clock * 3 + r.baseX)) * 0.04; // 제자리 숨쉬기
    }
  }

  return {
    /** 방 데이터가 바뀔 때마다 호출 */
    sync(room, myUid = '') {
      if (!room?.settings) return;
      goal = room.settings.goal;
      me = myUid;
      setTrack(room.settings.track);
      if (room.settings.character !== style) { style = room.settings.character; rosterKey = ''; }
      syncRoster(room.players || {});
      for (const [uid, r] of runners) r.player = room.players?.[uid];
    },

    /** 매 프레임 */
    update(dt, now) {
      if (!track) return;
      clock += dt;
      animateObstacles(track.animated, clock);
      const stepScale = BASE_RUN_LENGTH / (START_Z - track.finishZ);
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
