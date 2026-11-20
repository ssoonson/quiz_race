// Three.js 무대: 렌더러, 장면, 조명, 화면 크기 맞춤.
import { THREE } from './parts.js';

export function createStage(mount) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
  camera.position.set(0, 40, 72);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8d89, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-20, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 110, bottom: -110 });
  scene.add(sun);

  const courseGroup = new THREE.Group();
  const playerGroup = new THREE.Group();
  scene.add(courseGroup, playerGroup);

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.userData.baseFov = Math.max(48, Math.min(65, 56 / camera.aspect)); // 세로로 긴 화면에서는 시야를 넓힘
    camera.fov = camera.userData.baseFov; // 샷별 추가 시야는 camera.js가 더함
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  let qualityShadows = true;
  let trackShadows = true;
  const applyShadows = () => {
    // 그림자를 끄면 그림자 계산(장면을 한 번 더 그리기)이 통째로 빠짐
    sun.castShadow = qualityShadows && trackShadows;
    stage.shadows = sun.castShadow;
  };

  const stage = {
    scene, camera, renderer, courseGroup, playerGroup,
    shadows: true, // 지금 실시간 그림자가 켜져 있는지 (꺼져 있으면 발밑 원형 그림자 사용)
    /** 품질 적용: 해상도 배율과 실시간 그림자 */
    setQuality({ pixelRatio, shadows }) {
      renderer.setPixelRatio(pixelRatio);
      qualityShadows = shadows;
      applyShadows();
      resize();
    },
    /** 트랙이 실시간 그림자를 쓰는지 (곡선 트랙은 쓰지 않음) */
    setTrackShadows(on) {
      trackShadows = on !== false;
      applyShadows();
    },
    setSky(color, fog = { color, near: 125, far: 285 }) {
      scene.background = new THREE.Color(color);
      scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    },
    render() { renderer.render(scene, camera); },
  };
  return stage;
}
