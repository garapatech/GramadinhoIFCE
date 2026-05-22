import * as THREE from "three";
import { avatarToGameAppearance } from "@/features/avatar/avatarConfig";
import { getAtmosphereState, getAtmosphereStateKey, type AtmosphereState } from "@/game/atmosphere";
import { createCameraController } from "@/game/camera";
import { defaultAtmosphereState } from "@/shared/schemas/atmosphere";
import { createEspectroEvent } from "@/features/game/minigames/espectro";
import { createSwimmingMinigame } from "@/features/game/minigames/swimming";
import type {
  Blocker,
  BlockerOptions,
  BootGameOptions,
  MobileInput,
  MobileInputUpdate,
  ReactionOptions,
  SitOptions,
} from "@/features/game/engineTypes";
import { createGateCheckpoint } from "@/features/game/gateCheckpoint";
import { createDevTools } from "@/game/devtools";
import { createGameInputBindings } from "@/features/game/inputBindings";
import { createSpeechOverlay } from "@/features/game/overlay";
import { createNpcSync } from "@/features/game/npcSync";
import { renderMinimap } from "@/game/minimap";
import { createWeatherSystem } from "@/game/weather";
import { getCampusSurfaceAt } from "@/game/world/campusSurface";
import { buildBlocoTelematica } from "@/game/world/blocoTelematica/buildScene";
import { createWorldSpatialHelpers, getDistance2D } from "@/game/world/spatial";
import {
  CAMPUS_ENTRY_X,
  CAMPUS_ENTRY_Z,
  CAMPUS_ENTRY_WIDTH,
  CAMPUS_SPAWN,
  CAMPUS_WALL_HEIGHT,
  CAMPUS_WALL_LIMIT,
  CAMPUS_WALL_THICKNESS,
  campusArena,
  campusBuildings,
  campusPaths,
} from "@/game/world/campusLayout";
import {
  destroyGameAudio,
  ensureAmbientAudio,
  playBusArrivalSound,
  playFootstepSound,
  playParanormalSound,
  playPoolWaterSound,
  playSwimStrokeSound,
  readAmbientAudioState,
  resetGameAudio,
  toggleAmbientAudio as toggleGameAmbientAudio,
  updateAmbientAudio,
} from "@/game/audio";
import {
  createBusSignTexture,
  createCampusBannerTexture,
  createGrassTexture,
  createNoticeTexture,
  createWindowTexture,
} from "@/game/campusTextures";
import {
  animateCelebrate,
  animateDance,
  animateGlitch,
  animateRun,
  animateSixSeven,
  animateWalk,
  createCharacter,
  resetRigPose,
  setCrouchPose,
  setRestPose,
  setSittingPose,
} from "@/game/characterRig";
import {
  formatSeconds,
  getNearestCameraFocusTarget,
  getNearestInteractable,
  getNearestTarget,
  getNoTargetStatus,
  getRidingBikeStatus,
  getTargetStatus,
} from "@/game/playerInteractions";

const asFunction = (candidate) => (typeof candidate === "function" ? candidate : null);
const asHandler = (candidate, fallback = () => {}) => asFunction(candidate) || fallback;

export function bootGame(opts: BootGameOptions = {}) {
  const container = opts.container;
  if (!container) throw new Error("bootGame: container is required");
  const localNickname = opts.nickname || "Visitante";
  const onLocalState = asHandler(opts.onLocalState);
  const onLocalEntityState = asHandler(opts.onLocalEntityState);
  const onNpcState = asHandler(opts.onNpcState);
  const onAtmosphereChange = asHandler(opts.onAtmosphereChange);
  const onCameraModeChange = asHandler(opts.onCameraModeChange);
  const onAudioStateChange = asHandler(opts.onAudioStateChange);
  const onPlayerStateChange = asHandler(opts.onPlayerStateChange);
  const onEmote = asHandler(opts.onEmote);
  const onMediaBoothInteract = asHandler(opts.onMediaBoothInteract);
  const onPvpThrow = asHandler(opts.onPvpThrow);
  const onPvpHit = asHandler(opts.onPvpHit);
  const onEspectroConsumed = asHandler(opts.onEspectroConsumed);
  const onSecretDisconnect = asHandler(opts.onSecretDisconnect);
  const onPokerSeatInteract = asHandler(opts.onPokerSeatInteract);
  const shouldIgnoreKeys = asHandler(opts.shouldIgnoreKeys, () => false);
  const getWorldTime = asFunction(opts.getWorldTime);
  const broadcastEmote = (kind, duration) => onEmote({ kind, duration });

  const canvas = container.querySelector('[data-game="scene"]');
  const statusEl = container.querySelector('[data-game="status"]');
  const speechEl = container.querySelector('[data-game="speech"]');
  const speechBodyEl = container.querySelector('[data-game="speech-body"]');
  const speechNameEl = container.querySelector('[data-game="speech-name"]');
  const speechHintEl = container.querySelector('[data-game="speech-hint"]');
  const minimapCanvas = container.querySelector('[data-game="minimap-canvas"]');
  const minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;
  const speechOverlay = createSpeechOverlay({
    statusEl,
    speechEl,
    speechBodyEl,
    speechNameEl,
    speechHintEl,
    pushBubble,
  });

  const errorHandler = (event) => {
    if (statusEl) {
      statusEl.textContent = `Erro na cena: ${event.message}`;
      statusEl.style.opacity = "1";
      statusEl.dataset.active = "1";
    }
  };
  window.addEventListener("error", errorHandler);

  resetGameAudio();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa7d7f7);
  scene.fog = new THREE.Fog(0xa7d7f7, 45, 180);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0xa7d7f7, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
camera.position.set(-22, 18, 54);
let audioStateKey = "";
const cameraController = createCameraController(onCameraModeChange);

function emitAudioStateChange() {
  const audioState = readAmbientAudioState();
  const audioKey = `${audioState.enabled}:${audioState.label}`;
  if (audioKey === audioStateKey) return;
  audioStateKey = audioKey;
  onAudioStateChange(audioState);
}

function toggleAmbientAudio() {
  toggleGameAmbientAudio();
  emitAudioStateChange();
}
emitAudioStateChange();

const ambient = new THREE.HemisphereLight(0xdff3ff, 0x5a7c4f, 1.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(28, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.width = 1024;
sun.shadow.mapSize.height = 1024;
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

scene.add(new THREE.AmbientLight(0x88aa88, 0.35));

const daySkyColor = new THREE.Color(0xa7d7f7);
const duskSkyColor = new THREE.Color(0x9a8bc8);
const nightSkyColor = new THREE.Color(0x4f6687);
const dayFogColor = new THREE.Color(0xa7d7f7);
const duskFogColor = new THREE.Color(0x8f7fab);
const nightFogColor = new THREE.Color(0x596f8c);
const dayGroundColor = new THREE.Color(0x6ea34e);
const duskGroundColor = new THREE.Color(0x55783f);
const nightGroundColor = new THREE.Color(0x557a5e);
const clearSkyColor = new THREE.Color(0xb8e3fb);
const cloudySkyColor = new THREE.Color(0x9db8d4);
const rainSkyColor = new THREE.Color(0x74879f);
const clearFogColor = new THREE.Color(0xb8dff5);
const cloudyFogColor = new THREE.Color(0x98afc4);
const rainFogColor = new THREE.Color(0x6f8199);
const wetGroundColor = new THREE.Color(0x496a53);
const tempWeatherSkyColor = new THREE.Color();
const tempWeatherFogColor = new THREE.Color();
const tempSkyColor = new THREE.Color();
const tempFogColor = new THREE.Color();
const tempGroundColor = new THREE.Color();
let lastAtmosphereKey = "";
let currentAtmosphereState: AtmosphereState = defaultAtmosphereState;
function applyAtmosphere(state: AtmosphereState) {
  const duskMix = Math.min(Math.max(1 - state.daylight * 1.2, 0), 1);
  const nightMix = state.daylight <= 0 ? 1 : Math.max(0, 1 - state.daylight * 1.8);

  tempWeatherSkyColor.copy(clearSkyColor).lerp(cloudySkyColor, state.weather.cloudMix).lerp(rainSkyColor, state.weather.rain * 0.85);
  tempWeatherFogColor.copy(clearFogColor).lerp(cloudyFogColor, state.weather.cloudMix).lerp(rainFogColor, state.weather.rain * 0.9);
  const skyColor = tempSkyColor.copy(daySkyColor).lerp(tempWeatherSkyColor, 0.42).lerp(duskSkyColor, duskMix * 0.45).lerp(nightSkyColor, nightMix * 0.72);
  const fogColor = tempFogColor.copy(dayFogColor).lerp(tempWeatherFogColor, 0.38).lerp(duskFogColor, duskMix * 0.45).lerp(nightFogColor, nightMix * 0.72);
  const groundColor = tempGroundColor.copy(dayGroundColor).lerp(duskGroundColor, duskMix * 0.45).lerp(nightGroundColor, nightMix * 0.68);

  scene.background.copy(skyColor);
  scene.fog.color.copy(fogColor);
  renderer.setClearColor(skyColor, 1);

  const weatherDim = state.weather.rain * 0.22 + state.weather.cloudMix * 0.08;
  ambient.intensity = Math.max(0.88, 0.82 + state.daylight * 1.45 - weatherDim);
  ambient.color.setHex(state.daylight > 0.45 ? (state.weather.rain ? 0xa8bfd6 : 0xdff3ff) : 0xb9c8e8);

  sun.intensity = Math.max(0.34, 0.32 + state.daylight * 2.2 - state.weather.rain * 0.45 - state.weather.cloudMix * 0.18);
  sun.color.setHex(state.daylight > 0.5 ? (state.weather.rain ? 0xe4e8f4 : 0xfff4d6) : state.daylight > 0.1 ? 0xffcab4 : 0xc9d7ff);
  sun.position.set(28 - state.daylight * 10, 18 + state.daylight * 28, 18 + state.daylight * 8);

  const groundWetness = weatherSystem.getGroundWetness();
  ground.material.color.copy(groundColor).lerp(wetGroundColor, state.weather.rain * 0.12 + groundWetness * 0.08);
  ground.material.roughness = THREE.MathUtils.clamp(1 - state.weather.rain * 0.16 - groundWetness * 0.08, 0.72, 1);

  const atmosphereKey = getAtmosphereStateKey(state);
  if (atmosphereKey !== lastAtmosphereKey) {
    lastAtmosphereKey = atmosphereKey;
    currentAtmosphereState = state;
    onAtmosphereChange({ ...state });
  }
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seeded = mulberry32(9917);
function rand(min, max) {
  return min + (max - min) * seeded();
}

const grass = createGrassTexture();
const windowTexture = createWindowTexture();
const noticeTexture = createNoticeTexture();
const busSignTexture = createBusSignTexture();
const campusBannerTexture = createCampusBannerTexture();

const world = new THREE.Group();
scene.add(world);

const blockers: Blocker[] = [];
const mapFeatures = {
  buildings: [],
  paths: [],
  trees: []
};
const interactables = [];
const decorativeProps = [];
const cameraFrustum = new THREE.Frustum();
const cameraMatrix = new THREE.Matrix4();
const tempSphere = new THREE.Sphere();
const ENTITY_CULL_DIST = {
  npc: 40,
  duck: 30,
  pigeon: 28,
  interactable: 36,
  remote: 42,
  bus: 56
};
const buses = [];
const defaultPlayerPosition = new THREE.Vector3();
let playerPositionTarget: { position: THREE.Vector3 } | null = null;
const weatherSystem = createWeatherSystem({
  scene,
  world,
  mapFeatures,
  rand,
  getPlayerPosition: () => playerPositionTarget?.position ?? defaultPlayerPosition,
  disposeObject3D,
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(170, 170),
  new THREE.MeshStandardMaterial({
    map: grass,
    roughness: 1,
    metalness: 0
  })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

const walkways = new THREE.Group();
world.add(walkways);

function addPath(width, depth, x, z, rotation = 0, surface = "cement") {
  mapFeatures.paths.push({ width, depth, x, z, rotation, surface });
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      color: 0xc8c1b2,
      roughness: 1,
      metalness: 0
    })
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, 0.03, z);
  path.receiveShadow = true;
  walkways.add(path);
}

for (const path of campusPaths) {
  addPath(path.width, path.depth, path.x, path.z, path.rotation || 0, path.surface || "cement");
}

function createBlocker(minX, maxX, minZ, maxZ, options: BlockerOptions = {}) {
  const blocker = {
    minX,
    maxX,
    minZ,
    maxZ,
    active: options.active !== false,
  };
  blockers.push(blocker);
  return blocker;
}

function addWallSegment(width, depth, x, z, height = CAMPUS_WALL_HEIGHT) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0xd8d3c5,
      roughness: 0.94,
      metalness: 0.02,
    })
  );
  mesh.position.set(x, height / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  createBlocker(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2);
  return mesh;
}

function addCampusPerimeter() {
  const fullWidth = CAMPUS_WALL_LIMIT * 2;
  const gateMinX = CAMPUS_ENTRY_X - CAMPUS_ENTRY_WIDTH / 2;
  const gateMaxX = CAMPUS_ENTRY_X + CAMPUS_ENTRY_WIDTH / 2;
  const leftWidth = gateMinX - (-CAMPUS_WALL_LIMIT);
  const rightWidth = CAMPUS_WALL_LIMIT - gateMaxX;
  addWallSegment(fullWidth, CAMPUS_WALL_THICKNESS, 0, CAMPUS_WALL_LIMIT);
  addWallSegment(CAMPUS_WALL_THICKNESS, fullWidth, -CAMPUS_WALL_LIMIT, 0);
  addWallSegment(CAMPUS_WALL_THICKNESS, fullWidth, CAMPUS_WALL_LIMIT, 0);
  addWallSegment(
    leftWidth,
    CAMPUS_WALL_THICKNESS,
    -CAMPUS_WALL_LIMIT + leftWidth / 2,
    CAMPUS_ENTRY_Z
  );
  addWallSegment(
    rightWidth,
    CAMPUS_WALL_THICKNESS,
    gateMaxX + rightWidth / 2,
    CAMPUS_ENTRY_Z
  );
}

addCampusPerimeter();
let gateCheckpoint: { destroy(): void } | undefined;

function addBuilding({ x, z, width, depth, height, color, roof, name }) {
  mapFeatures.buildings.push({ x, z, width, depth, color, roof });
  const group = new THREE.Group();
  const wallThickness = 0.38;
  const doorWidth = THREE.MathUtils.clamp(width * 0.18, 2.2, Math.max(2.2, width - 4));
  const doorHeight = Math.min(height - 0.8, 2.65);
  const facadeDepth = depth / 2 - wallThickness / 2;
  const sideDepth = Math.max(0.8, depth - wallThickness * 2);
  const sideWallHeight = height;
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    map: windowTexture,
    roughness: 0.92,
    metalness: 0.03,
    transparent: true,
    opacity: 1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: roof,
    roughness: 1,
    transparent: true,
    opacity: 1,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf3f0e7,
    roughness: 0.8,
    transparent: true,
    opacity: 1,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe7decc,
    roughness: 0.98,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x6c4a2e,
    roughness: 0.92,
    transparent: true,
    opacity: 1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xb7aa8d,
    roughness: 0.95,
  });
  const shellMeshes = [];
  const frontSegmentWidth = Math.max(0.9, (width - doorWidth) / 2);

  function addShell(geometry, material, px, py, pz) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shellMeshes.push(mesh);
    return mesh;
  }

  addShell(
    new THREE.BoxGeometry(width, sideWallHeight, wallThickness),
    bodyMat,
    0,
    sideWallHeight / 2,
    -depth / 2 + wallThickness / 2
  );
  addShell(
    new THREE.BoxGeometry(wallThickness, sideWallHeight, sideDepth),
    bodyMat,
    -width / 2 + wallThickness / 2,
    sideWallHeight / 2,
    0
  );
  addShell(
    new THREE.BoxGeometry(wallThickness, sideWallHeight, sideDepth),
    bodyMat,
    width / 2 - wallThickness / 2,
    sideWallHeight / 2,
    0
  );
  addShell(
    new THREE.BoxGeometry(frontSegmentWidth, sideWallHeight, wallThickness),
    bodyMat,
    -doorWidth / 2 - frontSegmentWidth / 2,
    sideWallHeight / 2,
    facadeDepth
  );
  addShell(
    new THREE.BoxGeometry(frontSegmentWidth, sideWallHeight, wallThickness),
    bodyMat,
    doorWidth / 2 + frontSegmentWidth / 2,
    sideWallHeight / 2,
    facadeDepth
  );
  addShell(
    new THREE.BoxGeometry(doorWidth, Math.max(0.7, height - doorHeight), wallThickness),
    bodyMat,
    0,
    doorHeight + Math.max(0.7, height - doorHeight) / 2,
    facadeDepth
  );

  const top = addShell(
    new THREE.BoxGeometry(width + 0.3, 0.7, depth + 0.3),
    roofMat,
    0,
    height + 0.35,
    0
  );

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1.8, width - 0.7), 0.08, Math.max(1.8, depth - 0.7)),
    floorMat
  );
  floor.position.set(0, 0.04, 0);
  floor.receiveShadow = true;
  group.add(floor);

  const innerCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1.4, width - 2.4), 0.03, Math.max(1.4, depth - 2.2)),
    new THREE.MeshStandardMaterial({ color: 0xb8d7c0, roughness: 1 })
  );
  innerCarpet.position.set(0, 0.09, -0.12);
  group.add(innerCarpet);

  const innerBench = new THREE.Mesh(
    new THREE.BoxGeometry(Math.min(4, width - 2.8), 0.22, 0.54),
    accentMat
  );
  innerBench.position.set(0, 0.5, -Math.max(1.4, depth * 0.22));
  innerBench.castShadow = true;
  group.add(innerBench);

  const interiorLight = new THREE.PointLight(0xfff0c4, 0.32, Math.max(width, depth) * 1.4, 2);
  interiorLight.position.set(0, height - 0.9, 0);
  group.add(interiorLight);

  if (name) {
    const sign = addShell(
      new THREE.BoxGeometry(Math.min(width * 0.7, 10), 1.2, 0.3),
      frameMat,
      0,
      height * 0.65,
      depth / 2 + 0.18
    );
    sign.castShadow = true;
  }

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-doorWidth / 2, 0, facadeDepth + 0.03);
  group.add(leftDoorPivot);

  const leftDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth / 2 - 0.04, doorHeight, 0.08),
    doorMat
  );
  leftDoor.position.set((doorWidth / 2 - 0.04) / 2, doorHeight / 2, 0);
  leftDoor.castShadow = true;
  leftDoorPivot.add(leftDoor);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(doorWidth / 2, 0, facadeDepth + 0.03);
  group.add(rightDoorPivot);

  const rightDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth / 2 - 0.04, doorHeight, 0.08),
    doorMat
  );
  rightDoor.position.set(-(doorWidth / 2 - 0.04) / 2, doorHeight / 2, 0);
  rightDoor.castShadow = true;
  rightDoorPivot.add(rightDoor);

  group.position.set(x, 0, z);
  world.add(group);

  createBlocker(
    x - width / 2 - 0.9,
    x + width / 2 + 0.9,
    z - depth / 2 - wallThickness,
    z - depth / 2 + wallThickness
  );
  createBlocker(
    x - width / 2 - wallThickness,
    x - width / 2 + wallThickness,
    z - depth / 2,
    z + depth / 2
  );
  createBlocker(
    x + width / 2 - wallThickness,
    x + width / 2 + wallThickness,
    z - depth / 2,
    z + depth / 2
  );
  createBlocker(
    x - width / 2,
    x - doorWidth / 2,
    z + depth / 2 - wallThickness,
    z + depth / 2 + wallThickness
  );
  createBlocker(
    x + doorWidth / 2,
    x + width / 2,
    z + depth / 2 - wallThickness,
    z + depth / 2 + wallThickness
  );
  const doorBlocker = createBlocker(
    x - doorWidth / 2,
    x + doorWidth / 2,
    z + depth / 2 - wallThickness,
    z + depth / 2 + 0.5
  );

  let doorOpen = false;
  let doorAngle = 0;
  const maxDoorAngle = Math.PI * 0.62;

  function thresholdOccupied() {
    return (
      Math.abs(player.position.x - x) < doorWidth * 0.7 &&
      Math.abs(player.position.z - (z + depth / 2 - 0.1)) < 1.6
    );
  }

  interactables.push({
    kind: "door",
    label: name ? `Porta do ${name}` : "Porta",
    radius: 2.8,
    position: new THREE.Vector3(x, 0, z + depth / 2 - 0.2),
    root: group,
    npcDisabled: () => true,
    interact() {
      if (doorOpen) {
        if (thresholdOccupied()) {
          speechOverlay.speak("Saia um pouco do vão para fechar a porta.", name || "Porta");
          return;
        }
        doorOpen = false;
        speechOverlay.speak("A porta fechou com um clique seco.", name || "Porta");
        return;
      }
      doorOpen = true;
      speechOverlay.speak(`A porta de ${name || "estrutura"} está aberta. Pode entrar.`, name || "Porta");
    },
    update(dt) {
      const targetAngle = doorOpen ? maxDoorAngle : 0;
      doorAngle = THREE.MathUtils.lerp(doorAngle, targetAngle, Math.min(1, dt * 7.5));
      leftDoorPivot.rotation.y = -doorAngle;
      rightDoorPivot.rotation.y = doorAngle;
      doorBlocker.active = doorAngle < maxDoorAngle * 0.55;

      const inside =
        player.position.x > x - width / 2 + wallThickness + 0.12 &&
        player.position.x < x + width / 2 - wallThickness - 0.12 &&
        player.position.z > z - depth / 2 + wallThickness + 0.12 &&
        player.position.z < z + depth / 2 - wallThickness - 0.12;
      const opacity = inside ? 0.18 : 1;

      bodyMat.opacity = opacity;
      bodyMat.depthWrite = opacity > 0.92;
      roofMat.opacity = inside ? 0.14 : 1;
      roofMat.depthWrite = !inside;
      frameMat.opacity = opacity;
      frameMat.depthWrite = opacity > 0.92;
      doorMat.opacity = inside ? 0.22 : 1;
      doorMat.depthWrite = !inside;

      for (const mesh of shellMeshes) {
        mesh.visible = true;
      }
      top.visible = true;
    }
  });
}

for (const building of campusBuildings) {
  addBuilding(building);
}

// Bloco Telemática é construido depois que `player` existe (mais abaixo)
// porque seu update precisa da posicao do jogador para a transparencia.

// Quadra de Queimado (PvP Arena)
const ARENA_CX = campusArena.x;
const ARENA_CZ = campusArena.z;
const ARENA_W = campusArena.width;
const ARENA_D = campusArena.depth;
/* arena build scope */ {
  const floorMat = new THREE.MeshStandardMaterial({ color: campusArena.floorColor, roughness: 1 });
  const arenaFloor = new THREE.Mesh(new THREE.BoxGeometry(ARENA_W, 0.07, ARENA_D), floorMat);
  arenaFloor.position.set(ARENA_CX, 0.035, ARENA_CZ);
  arenaFloor.receiveShadow = true;
  world.add(arenaFloor);

  const lineMat = new THREE.MeshStandardMaterial({ color: campusArena.lineColor, roughness: 0.9 });
  function addCourtLine(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), lineMat);
    m.position.set(x, 0.07, z);
    world.add(m);
  }
  addCourtLine(ARENA_CX, ARENA_CZ, 0.18, ARENA_D);
  addCourtLine(ARENA_CX, ARENA_CZ - ARENA_D / 2, ARENA_W + 0.18, 0.18);
  addCourtLine(ARENA_CX, ARENA_CZ + ARENA_D / 2, ARENA_W + 0.18, 0.18);
  addCourtLine(ARENA_CX - ARENA_W / 2, ARENA_CZ, 0.18, ARENA_D + 0.18);
  addCourtLine(ARENA_CX + ARENA_W / 2, ARENA_CZ, 0.18, ARENA_D + 0.18);

  const postMat = new THREE.MeshStandardMaterial({ color: campusArena.postColor, roughness: 0.7, metalness: 0.3 });
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8);
  for (const [px, pz] of [
    [ARENA_CX - ARENA_W / 2, ARENA_CZ - ARENA_D / 2],
    [ARENA_CX + ARENA_W / 2, ARENA_CZ - ARENA_D / 2],
    [ARENA_CX - ARENA_W / 2, ARENA_CZ + ARENA_D / 2],
    [ARENA_CX + ARENA_W / 2, ARENA_CZ + ARENA_D / 2],
    [ARENA_CX, ARENA_CZ - ARENA_D / 2],
    [ARENA_CX, ARENA_CZ + ARENA_D / 2],
  ]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, 1.2, pz);
    post.castShadow = true;
    world.add(post);
  }

  // Placa "QUEIMADO"
  const signPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: campusArena.signPoleColor, roughness: 0.7, metalness: 0.4 })
  );
  signPole.position.set(ARENA_CX, 1.6, ARENA_CZ - ARENA_D / 2 - 1.2);
  signPole.castShadow = true;
  world.add(signPole);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.0, 0.12),
    new THREE.MeshStandardMaterial({ color: campusArena.signBoardColor, roughness: 0.8 })
  );
  signBoard.position.set(ARENA_CX, 3.5, ARENA_CZ - ARENA_D / 2 - 1.2);
  signBoard.castShadow = true;
  world.add(signBoard);

  mapFeatures.buildings.push({ x: ARENA_CX, z: ARENA_CZ, width: ARENA_W, depth: ARENA_D, color: campusArena.floorColor, roof: 0xffffff, name: campusArena.name });
}


const playerRig = createCharacter(avatarToGameAppearance(opts.avatar));
const player = playerRig.group;
world.add(player);
playerPositionTarget = player;
player.position.set(CAMPUS_SPAWN.x, 0, CAMPUS_SPAWN.z);

{
  const bloco = buildBlocoTelematica({
    parent: world,
    createBlocker,
    interactables,
    getPlayerPosition: () => player.position,
    onPokerSeatInteract: (seatIndex, anchor) => {
      enterSitState(
        { position: anchor.position, rotation: anchor.rotation },
        {
          persistent: true,
          label: `mesa de pôquer (assento ${seatIndex + 1})`,
        },
      );
      onPokerSeatInteract(seatIndex);
    },
  });
  mapFeatures.buildings.push({
    x: (bloco.bounds.minX + bloco.bounds.maxX) / 2,
    z: (bloco.bounds.minZ + bloco.bounds.maxZ) / 2,
    width: bloco.bounds.maxX - bloco.bounds.minX,
    depth: bloco.bounds.maxZ - bloco.bounds.minZ,
    color: 0xdbe0dd,
    roof: 0x8b3d2c,
  });
}

gateCheckpoint = createGateCheckpoint({
  container: container as HTMLElement | null | undefined,
  world,
  interactables,
  createBlocker,
  createNameLabel,
  getDistance2D,
  player,
  speak: speechOverlay.speak,
  entryX: CAMPUS_ENTRY_X,
  entryZ: CAMPUS_ENTRY_Z,
});

function createNameLabel(text, color = "#fff8dc", accent = "#62ff9f") {
  const canvasEl = document.createElement("canvas");
  const padding = 28;
  const fontSize = 56;
  const ctx2 = canvasEl.getContext("2d");
  ctx2.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const metrics = ctx2.measureText(text);
  canvasEl.width = Math.max(256, Math.ceil(metrics.width) + padding * 2);
  canvasEl.height = fontSize + padding * 2;
  const c = canvasEl.getContext("2d");
  c.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";

  const r = 28;
  const w = canvasEl.width;
  const h = canvasEl.height;
  c.fillStyle = "rgba(14, 24, 16, 0.78)";
  c.beginPath();
  c.moveTo(r, 4);
  c.lineTo(w - r, 4);
  c.quadraticCurveTo(w - 4, 4, w - 4, r + 4);
  c.lineTo(w - 4, h - r - 4);
  c.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
  c.lineTo(r, h - 4);
  c.quadraticCurveTo(4, h - 4, 4, h - r - 4);
  c.lineTo(4, r + 4);
  c.quadraticCurveTo(4, 4, r, 4);
  c.closePath();
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = accent;
  c.stroke();

  c.fillStyle = color;
  c.shadowColor = "rgba(0,0,0,0.6)";
  c.shadowBlur = 6;
  c.fillText(text, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvasEl.width / canvasEl.height;
  const baseHeight = 0.55;
  sprite.scale.set(baseHeight * aspect, baseHeight, 1);
  sprite.position.y = 2.72;
  sprite.renderOrder = 999;
  return sprite;
}

let localLabel = createNameLabel(localNickname, "#fff8dc", "#62ff9f");
player.add(localLabel);

function disposeMaterial(material, seenMaterials, seenTextures) {
  if (!material || seenMaterials.has(material)) return;
  seenMaterials.add(material);
  for (const key of [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap",
  ]) {
    const texture = material[key];
    if (texture && !seenTextures.has(texture)) {
      seenTextures.add(texture);
      texture.dispose?.();
    }
  }
  material.dispose?.();
}

function disposeObject3D(object) {
  if (!object) return;
  const seenGeometries = new Set();
  const seenMaterials = new Set();
  const seenTextures = new Set();
  object.traverse?.((node) => {
    if (node.geometry && !seenGeometries.has(node.geometry)) {
      seenGeometries.add(node.geometry);
      node.geometry.dispose?.();
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      disposeMaterial(material, seenMaterials, seenTextures);
    }
  });
}

function disposeSprite(sprite) {
  disposeObject3D(sprite);
}

const remotePlayers = new Map();
const sharedBikes = new Map();
let sharedBikeCount = 0;
let swimmingMinigame = null;
let espectroEvent = null;

function getFallbackRemoteAppearance(id = "") {
  const palette = hashPalette(id);
  return {
    shirtColor: palette.shirt ?? 0x4f9bd3,
    pantsColor: palette.pants ?? 0x2a3540,
    shoesColor: 0x202020,
    skinColor: 0xeec39c,
    backpackColor: 0x9b6b3a,
    hairColor: 0x3a2516,
    scale: 1,
    backpack: true,
    glasses: false,
  };
}

function createRemoteRig(nickname, appearance) {
  const rig = createCharacter(appearance || getFallbackRemoteAppearance());
  const label = createNameLabel(nickname || "Player", "#fff8dc", "#f6b94b");
  rig.group.add(label);
  return { rig, label };
}

function hashPalette(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  const c = new THREE.Color().setHSL(hue / 360, 0.55, 0.5);
  const c2 = new THREE.Color().setHSL(((hue + 40) % 360) / 360, 0.4, 0.25);
  return { shirt: c.getHex(), pants: c2.getHex() };
}

function addRemotePlayer(state) {
  if (!state || !state.id) return;
  if (remotePlayers.has(state.id)) {
    updateRemotePlayer(state);
    return;
  }
  const appearance = state.avatar ? avatarToGameAppearance(state.avatar) : getFallbackRemoteAppearance(state.id);
  const { rig, label } = createRemoteRig(state.nick, appearance);
  const group = rig.group;
  group.position.set(state.x ?? 0, 0, state.z ?? 0);
  group.rotation.y = state.ry ?? 0;
  world.add(group);
  const mapColor = state.avatar?.shirt || `#${appearance.shirtColor.toString(16).padStart(6, "0")}`;
  remotePlayers.set(state.id, {
    id: state.id,
    nick: state.nick,
    avatar: state.avatar || null,
    rig,
    group,
    label,
    mapColor,
    targetX: group.position.x,
    targetZ: group.position.z,
    targetRy: group.rotation.y,
    speed: 0,
    activity: state.activity || "idle",
    jumpY: typeof state.jumpY === "number" ? state.jumpY : 0,
    walkPhase: 0,
    ridePhase: 0,
    celebrateTimer: 0,
    celebrateSeed: Math.random() * Math.PI * 2,
    glitchTimer: 0,
    glitchSeed: Math.random() * Math.PI * 2
  });
}

function updateRemotePlayer(state) {
  const r = remotePlayers.get(state.id);
  if (!r) {
    addRemotePlayer(state);
    return;
  }
  if (typeof state.x === "number") r.targetX = state.x;
  if (typeof state.z === "number") r.targetZ = state.z;
  if (typeof state.ry === "number") r.targetRy = state.ry;
  if (typeof state.speed === "number") r.speed = state.speed;
  if (typeof state.activity === "string") r.activity = state.activity;
  if (typeof state.jumpY === "number") r.jumpY = Math.max(0, state.jumpY);
}

function removeRemotePlayer(id) {
  const r = remotePlayers.get(id);
  if (!r) return;
  for (const bike of sharedBikes.values()) {
    if (bike.remoteMountedBy === id) {
      bike.remoteMountedBy = null;
      bike.remoteSpeed = 0;
    }
  }
  clearChatBubblesFor(id);
  world.remove(r.group);
  disposeObject3D(r.group);
  remotePlayers.delete(id);
}

function updateSharedEntity(state) {
  if (!state?.id || state.kind !== "bike") return;
  const bike = sharedBikes.get(state.id);
  if (!bike || playerState.ridingBike === bike) return;
  if (typeof state.x === "number") bike.targetX = state.x;
  if (typeof state.z === "number") bike.targetZ = state.z;
  if (typeof state.ry === "number") bike.targetRy = state.ry;
  if (typeof state.speed === "number") bike.remoteSpeed = state.speed;
  bike.remoteMountedBy = typeof state.mountedBy === "string" ? state.mountedBy : null;
  bike.hasSharedState = true;
}

function setRemoteNick(id, nick) {
  const r = remotePlayers.get(id);
  if (!r) return;
  r.group.remove(r.label);
  disposeSprite(r.label);
  const newLabel = createNameLabel(nick || "Player", "#fff8dc", "#f6b94b");
  r.group.add(newLabel);
  r.label = newLabel;
  r.nick = nick;
}

function setLocalNick(nick) {
  player.remove(localLabel);
  disposeSprite(localLabel);
  localLabel = createNameLabel(nick || "Você", "#fff8dc", "#62ff9f");
  player.add(localLabel);
}

const chatBubbles = new Map(); // pid -> [{sprite, ttl, height, group}]
const BUBBLE_TTL = 15;
const EMOTE_TTL = 2.4;
const REACTION_TTL = 1.6;
const EMOTE_GLYPHS = {
  dance: "🕺",
  laugh: "😂",
  point: "👉",
  sixseven: "🤲",
  wave: "👋",
  cheer: "🎉",
  glitch: "🫨",
  stop: "✋",
  like: "👍",
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createSpeechBubble(text) {
  const padX = 46;
  const padY = 36;
  const fontSize = 60;
  const maxTextWidth = 760;
  const lineHeight = fontSize * 1.18;
  const tailHeight = 26;

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const lines = wrapText(measure, text, maxTextWidth);

  const textWidth = Math.min(
    maxTextWidth,
    Math.max(...lines.map((l) => measure.measureText(l).width))
  );
  const w = Math.ceil(textWidth + padX * 2);
  const h = Math.ceil(lines.length * lineHeight + padY * 2 + tailHeight);

  const canvasEl = document.createElement("canvas");
  canvasEl.width = w;
  canvasEl.height = h;
  const c = canvasEl.getContext("2d");
  c.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  c.textBaseline = "middle";
  c.textAlign = "center";
  c.lineJoin = "round";
  c.shadowColor = "rgba(0, 0, 0, 0.42)";
  c.shadowBlur = 10;
  c.shadowOffsetY = 3;

  const bodyH = h - tailHeight;
  const r = 30;
  c.fillStyle = "rgba(255, 255, 248, 1)";
  c.strokeStyle = "rgba(12, 24, 16, 0.98)";
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(r, 2);
  c.lineTo(w - r, 2);
  c.quadraticCurveTo(w - 2, 2, w - 2, r + 2);
  c.lineTo(w - 2, bodyH - r);
  c.quadraticCurveTo(w - 2, bodyH, w - r, bodyH);
  c.lineTo(w / 2 + 14, bodyH);
  c.lineTo(w / 2, bodyH + tailHeight - 2);
  c.lineTo(w / 2 - 14, bodyH);
  c.lineTo(r, bodyH);
  c.quadraticCurveTo(2, bodyH, 2, bodyH - r);
  c.lineTo(2, r + 2);
  c.quadraticCurveTo(2, 2, r, 2);
  c.closePath();
  c.fill();
  c.stroke();

  c.shadowColor = "transparent";
  c.fillStyle = "#07140b";
  for (let i = 0; i < lines.length; i += 1) {
    const y = padY + lineHeight / 2 + i * lineHeight;
    c.fillText(lines[i], w / 2, y);
  }

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  const baseHeight = 1.45;
  const aspect = w / h;
  sprite.scale.set(baseHeight * aspect, baseHeight, 1);
  sprite.renderOrder = 1000;
  return sprite;
}

function layoutBubblesFor(pid) {
  const list = chatBubbles.get(pid);
  if (!list) return;
  let y = 3.45;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    list[i].sprite.position.y = y;
    y += list[i].sprite.scale.y + 0.12;
  }
}

function pushBubble(target, text, ttl = BUBBLE_TTL) {
  if (!text) return;
  let group = null;
  let key = null;
  if (typeof target === "string") {
    key = target;
    if (target === "__local__") {
      group = player;
    } else {
      const r = remotePlayers.get(target);
      if (!r) return;
      group = r.group;
    }
  } else if (target && target.group) {
    key = target.key || target.id || target.group.uuid;
    group = target.group;
  } else {
    return;
  }
  const sprite = createSpeechBubble(text);
  group.add(sprite);
  if (!chatBubbles.has(key)) chatBubbles.set(key, []);
  const list = chatBubbles.get(key);
  list.push({ sprite, ttl, group });
  if (list.length > 4) {
    const old = list.shift();
    group.remove(old.sprite);
    disposeSprite(old.sprite);
  }
  layoutBubblesFor(key);
}

function pushChatBubble(playerId, text) {
  pushBubble(playerId, text, BUBBLE_TTL);
}

function pushEmoteBubble(playerId, kind) {
  const glyph = EMOTE_GLYPHS[kind] || "✨";
  pushBubble(playerId, glyph, EMOTE_TTL);
}

function pushReactionBubble(playerId, kind = "like") {
  const glyph = EMOTE_GLYPHS[kind] || "👍";
  pushBubble(playerId, glyph, REACTION_TTL);
}

function clearChatBubblesFor(playerId) {
  const list = chatBubbles.get(playerId);
  if (!list) return;
  for (const b of list) {
    b.group.remove(b.sprite);
    disposeSprite(b.sprite);
  }
  chatBubbles.delete(playerId);
}

function updateBubbles(dt) {
  for (const [pid, list] of chatBubbles) {
    let changed = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      list[i].ttl -= dt;
      if (list[i].ttl <= 0) {
        list[i].group.remove(list[i].sprite);
        disposeSprite(list[i].sprite);
        list.splice(i, 1);
        changed = true;
      } else if (list[i].ttl < 0.8) {
        list[i].sprite.material.opacity = Math.max(0, list[i].ttl / 0.8);
      }
    }
    if (list.length === 0) chatBubbles.delete(pid);
    else if (changed) layoutBubblesFor(pid);
  }
}

function updateRemotes(dt, time) {
  for (const r of remotePlayers.values()) {
    const jumpY = Math.max(0, r.jumpY || 0);
    if (r.glitchTimer && r.glitchTimer > 0) {
      r.glitchTimer -= dt;
      setRestPose(r.rig.refs, time, r.glitchSeed || 0);
      animateGlitch(r.rig.refs, time, 1, r.glitchSeed || 0);
      r.group.position.y = jumpY + Math.sin(time * 14 + (r.glitchSeed || 0)) * 0.06;
      continue;
    }
    if (r.celebrateTimer && r.celebrateTimer > 0) {
      r.celebrateTimer -= dt;
      animateCelebrate(r.rig.refs, time + (r.celebrateSeed || 0), 1);
      r.group.position.y = jumpY + Math.abs(Math.sin((time + (r.celebrateSeed || 0)) * 9)) * 0.08;
      continue;
    }
    if (r.sixSevenTimer && r.sixSevenTimer > 0) {
      r.sixSevenTimer -= dt;
      animateSixSeven(r.rig.refs, time, r.sixSevenSeed || 0);
      r.group.position.y = jumpY + Math.abs(Math.sin((time + (r.sixSevenSeed || 0)) * 4.8)) * 0.025;
      if (r.sixSevenTimer <= 0) resetRigPose(r.rig.refs);
      continue;
    }
    if (r.danceTimer && r.danceTimer > 0) {
      r.danceTimer -= dt;
      animateDance(r.rig.refs, time + (r.phaseOffset || 0));
      r.group.position.y = jumpY + Math.abs(Math.sin((time + (r.phaseOffset || 0)) * 8)) * 0.08;
      continue;
    }
    const lerp = Math.min(1, dt * 12);
    r.group.position.x += (r.targetX - r.group.position.x) * lerp;
    r.group.position.z += (r.targetZ - r.group.position.z) * lerp;
    r.group.rotation.y = lerpAngle(r.group.rotation.y, r.targetRy, lerp);
    if (r.activity === "sitting") {
      setSittingPose(r.rig.refs);
      r.group.position.y = 0;
      continue;
    }
    if (r.activity === "crouching") {
      setCrouchPose(r.rig.refs, time, 1);
      r.group.position.y = -0.22;
      continue;
    }
    if (r.activity === "riding") {
      r.ridePhase += Math.max(0.85, r.speed * 0.95) * dt;
      applyBikeRidePose(r.rig.refs, r.ridePhase, Math.min(r.speed / 10, 1), 0);
      r.group.position.y = 0.18 + Math.abs(Math.sin(r.ridePhase)) * 0.02 * Math.min(r.speed / 9, 1);
      continue;
    }
    const isRun = r.speed > 8;
    const speedRef = isRun ? 12.5 : 7.2;
    const intensity = Math.min(r.speed / speedRef, 1);
    if (intensity > 0.06) {
      r.walkPhase += dt * (isRun ? 9.5 : 5.5 + r.speed * 0.6);
      if (isRun) animateRun(r.rig.refs, r.walkPhase, intensity);
      else animateWalk(r.rig.refs, r.walkPhase, intensity);
      r.group.position.y = jumpY + Math.abs(Math.sin(r.walkPhase)) * 0.05 * intensity;
    } else {
      setRestPose(r.rig.refs, time);
      r.group.position.y = jumpY + Math.sin(time * 1.6) * 0.012;
    }
  }
}

function triggerNearbyDance() {
  const RADIUS = 6;
  for (const npc of npcs) {
    if (getDistance2D(player.position, npc.group.position) <= RADIUS) {
      npc.dancing = true;
      npc.danceTimer = 4.0;
      npc.pose = null;
      npc.focus = null;
    }
  }
  for (const r of remotePlayers.values()) {
    if (getDistance2D(player.position, r.group.position) <= RADIUS) {
      r.danceTimer = 4.0;
    }
  }
  triggerNearbyReaction(player.position, "cheer", { skipLocal: true });
}

function triggerNearbyCelebrate(origin, duration = 3.2, options: ReactionOptions = {}) {
  const RADIUS = 6.5;
  const skipLocal = options.skipLocal === true;
  const skipRemoteId = options.skipRemoteId || "";
  for (const npc of npcs) {
    if (getDistance2D(origin, npc.group.position) <= RADIUS) {
      npc.dancing = false;
      npc.danceTimer = 0;
      npc.celebrateTimer = duration;
      npc.pose = null;
      npc.focus = null;
    }
  }
  for (const r of remotePlayers.values()) {
    if (r.id === skipRemoteId) continue;
    if (getDistance2D(origin, r.group.position) <= RADIUS) {
      r.danceTimer = 0;
      r.celebrateTimer = duration;
      r.celebrateSeed = Math.random() * Math.PI * 2;
    }
  }
  triggerNearbyReaction(origin, "cheer", { skipLocal, skipRemoteId });
}

function triggerNearbyReaction(origin, kind = "like", options: ReactionOptions = {}) {
  const RADIUS = 6.25;
  const skipLocal = options.skipLocal === true;
  const skipRemoteId = options.skipRemoteId || "";

  for (const npc of npcs) {
    if (getDistance2D(origin, npc.group.position) <= RADIUS) {
      pushReactionBubble({ group: npc.group, key: npc.bubbleKey }, kind);
    }
  }

  for (const r of remotePlayers.values()) {
    if (r.id === skipRemoteId) continue;
    if (getDistance2D(origin, r.group.position) <= RADIUS) {
      pushReactionBubble(r.id, kind);
    }
  }

  if (!skipLocal && getDistance2D(origin, player.position) <= RADIUS) {
    pushReactionBubble("__local__", kind);
  }
}

function triggerLocalEmote(kind = "dance", duration = 8.0) {
  if (kind === "stop") {
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.glitchTimer = 0;
    playerState.celebrateTimer = 0;
    playerState.sixSevenTimer = 0;
    resetRigPose(playerRig.refs);
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("stop", 0);
    return;
  }

  if (kind === "glitch") {
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.celebrateTimer = 0;
    playerState.sixSevenTimer = 0;
    playerState.glitchTimer = duration || 2.2;
    playerState.glitchSeed = Math.random() * Math.PI * 2;
    resetRigPose(playerRig.refs);
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("glitch", duration || 2.2);
    return;
  }

  if (kind === "cheer") {
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.glitchTimer = 0;
    playerState.sixSevenTimer = 0;
    playerState.celebrateTimer = duration || 3.2;
    playerState.celebrateSeed = Math.random() * Math.PI * 2;
    resetRigPose(playerRig.refs);
    triggerNearbyCelebrate(player.position, playerState.celebrateTimer, { skipLocal: true });
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("cheer", playerState.celebrateTimer);
    return;
  }

  if (kind === "dance") {
    playerState.celebrateTimer = 0;
    playerState.glitchTimer = 0;
    playerState.sixSevenTimer = 0;
    if (playerState.dancing) {
      playerState.dancing = false;
      resetRigPose(playerRig.refs);
      pushEmoteBubble("__local__", kind);
      broadcastEmote?.("stop", 0);
      return;
    }
    playerState.dancing = true;
    playerState.danceTimer = duration;
    triggerNearbyDance();
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("dance", duration);
    return;
  }

  if (kind === "sixseven") {
    if (playerState.sixSevenTimer > 0) {
      playerState.sixSevenTimer = 0;
      resetRigPose(playerRig.refs);
      broadcastEmote?.("stop", 0);
      return;
    }
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.celebrateTimer = 0;
    playerState.glitchTimer = 0;
    playerState.sixSevenTimer = duration || 3.4;
    playerState.sixSevenSeed = Math.random() * Math.PI * 2;
    resetRigPose(playerRig.refs);
    broadcastEmote?.(kind, playerState.sixSevenTimer);
    return;
  }

  pushEmoteBubble("__local__", kind);
  if (kind === "laugh" || kind === "wave" || kind === "point") {
    triggerNearbyReaction(player.position, kind, { skipLocal: true });
  }
  broadcastEmote?.(kind, duration);
}

function triggerReaction(targetId, kind = "like") {
  if (!targetId) return;
  pushReactionBubble(targetId, kind);
}

function triggerRemoteEmote(playerId, kind, duration) {
  const r = remotePlayers.get(playerId);
  if (!r) return;
  if (kind === "dance") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = duration || 8.0;
    r.sixSevenTimer = 0;
    r.celebrateTimer = 0;
    r.phaseOffset = Math.random() * Math.PI * 2;
    triggerNearbyReaction(r.group.position, "cheer", { skipRemoteId: playerId });
    for (const npc of npcs) {
      if (getDistance2D(r.group.position, npc.group.position) <= 6) {
        npc.dancing = true;
        npc.danceTimer = duration || 8.0;
        npc.pose = null;
        npc.focus = null;
      }
    }
  } else if (kind === "cheer") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.sixSevenTimer = 0;
    r.glitchTimer = 0;
    r.celebrateSeed = Math.random() * Math.PI * 2;
    r.celebrateTimer = duration || 3.2;
    triggerNearbyCelebrate(r.group.position, r.celebrateTimer, { skipRemoteId: playerId });
  } else if (kind === "glitch") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.sixSevenTimer = 0;
    r.celebrateTimer = 0;
    r.glitchSeed = Math.random() * Math.PI * 2;
    r.glitchTimer = duration || 2.2;
  } else if (kind === "stop") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.sixSevenTimer = 0;
    r.glitchTimer = 0;
    r.celebrateTimer = 0;
    resetRigPose(r.rig.refs);
  } else if (kind === "sixseven") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.glitchTimer = 0;
    r.celebrateTimer = 0;
    r.sixSevenTimer = duration || 3.4;
    r.sixSevenSeed = Math.random() * Math.PI * 2;
  } else {
    pushEmoteBubble(playerId, kind);
  }
}

function triggerRemoteReaction(playerId, kind = "like") {
  const r = remotePlayers.get(playerId);
  if (!r) return;
  pushReactionBubble(playerId, kind);
}

const spawnBeacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.28, 3.2, 12),
  new THREE.MeshStandardMaterial({ color: 0x31d17c, emissive: 0x1d8b52, emissiveIntensity: 0.35, roughness: 0.5 })
);
spawnBeacon.position.set(CAMPUS_SPAWN.x, 1.6, CAMPUS_SPAWN.z);
spawnBeacon.castShadow = true;
world.add(spawnBeacon);

const spawnGlow = new THREE.PointLight(0x62ff9f, 1.2, 10, 2);
spawnGlow.position.set(CAMPUS_SPAWN.x, 2.2, CAMPUS_SPAWN.z);
world.add(spawnGlow);

const pvpBalls = [];
let pvpActiveMatch = null; // { matchId, opponentId, side } | null
let pvpThrowCooldown = 0;
let pvpSavedPosition = null; // { x, z } before teleport
let queuedPvpThrow = false;
const BALL_SPEED = 11;
const BALL_LIFE = 2.2;
const BALL_RADIUS = 0.28;
const PLAYER_HIT_RADIUS = 0.65;

const playerState = {
  sitting: false,
  sitTimer: 0,
  sitTarget: null,
  sitLabel: "",
  sitEndMessage: "",
  sitEndSpeaker: "Banco",
  sitPersistent: false,
  ridingBike: null,
  dancing: false,
  danceTimer: 0,
  sixSevenTimer: 0,
  sixSevenSeed: 0,
  celebrateTimer: 0,
  celebrateSeed: 0,
  glitchTimer: 0,
  glitchSeed: 0,
  jumping: false,
  jumpY: 0,
  jumpVel: 0
};
const playerActivitySnapshot = {
  kind: "idle",
  label: "parado",
  detail: "vagando pelo campus"
};
let lastPlayerActivityKey = "";

function emitPlayerActivity(nextActivity) {
  const key = `${nextActivity.kind}|${nextActivity.label}|${nextActivity.detail}`;
  if (key === lastPlayerActivityKey) return;
  lastPlayerActivityKey = key;
  playerActivitySnapshot.kind = nextActivity.kind;
  playerActivitySnapshot.label = nextActivity.label;
  playerActivitySnapshot.detail = nextActivity.detail;
  onPlayerStateChange({ ...playerActivitySnapshot });
}

function updatePlayerActivity(nextActivity) {
  emitPlayerActivity(nextActivity);
}

function createBench(x, z, rotation = 0) {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6440, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x5f6d71, roughness: 0.85 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.52), wood);
  seat.position.y = 0.62;
  seat.castShadow = true;
  bench.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 0.16), wood);
  back.position.set(0, 1.1, -0.18);
  back.rotation.x = -0.12;
  back.castShadow = true;
  bench.add(back);

  const supportLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), metal);
  supportLeft.position.set(-1.1, 0.36, 0.18);
  supportLeft.castShadow = true;
  bench.add(supportLeft);

  const supportRight = supportLeft.clone();
  supportRight.position.x = 1.1;
  bench.add(supportRight);

  bench.position.set(x, 0, z);
  bench.rotation.y = rotation;
  world.add(bench);

  const seatOffset = new THREE.Vector3(0, 0, 0.1).applyEuler(new THREE.Euler(0, rotation, 0));
  const sitSpot = new THREE.Vector3(x, 0, z).add(seatOffset);

  const interaction = {
    kind: "bench",
    label: "Banco",
    radius: 3.2,
    position: new THREE.Vector3(x, 0, z),
    root: bench,
    npcApproachPosition: sitSpot.clone(),
    npcDuration: 2.6,
    interact() {
      if (playerState.sitting) return;
      playerState.sitting = true;
      playerState.sitTimer = 2.6;
      playerState.sitTarget = {
        position: sitSpot.clone(),
        rotation: rotation + Math.PI
      };
      speechOverlay.speak("Sentando para descansar um pouco.", "Banco");
    },
    npcInteract(npc) {
      npc.pose = {
        type: "sit",
        position: sitSpot.clone(),
        rotation: rotation + Math.PI
      };
    },
    update() {
      const pulse = 1 + Math.sin(clock.elapsedTime * 3.5) * 0.02;
      seat.scale.y = pulse;
    }
  };
  interactables.push(interaction);
}

function createFountain(x, z) {
  const fountain = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.4, 0.55, 18),
    new THREE.MeshStandardMaterial({ color: 0xb9c4c7, roughness: 0.9 })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  fountain.add(base);

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: 0x94a5ad, roughness: 0.7 })
  );
  basin.position.y = 0.55;
  basin.castShadow = true;
  fountain.add(basin);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.1, 18),
    new THREE.MeshStandardMaterial({
      color: 0x6dbad6,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.05
    })
  );
  water.position.y = 0.95;
  fountain.add(water);

  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.18, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x9be4ff, transparent: true, opacity: 0.65 })
  );
  jet.position.y = 1.4;
  fountain.add(jet);

  fountain.position.set(x, 0, z);
  world.add(fountain);

  let pulse = 0;
  function pulseWater() {
    pulse = 1;
  }
  interactables.push({
    kind: "fountain",
    label: "Fonte",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    root: fountain,
    npcApproachRadius: 2.2,
    npcDuration: 1.7,
    interact() {
      pulseWater();
      speechOverlay.speak("A agua respinga e refresca o caminho.", "Fonte");
    },
    npcInteract() {
      pulseWater();
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 1.2);
      water.scale.y = 1 + pulse * 0.4;
      water.material.opacity = 0.78 + pulse * 0.2;
      jet.scale.y = 1 + pulse * 0.7;
      jet.material.opacity = 0.4 + pulse * 0.35;
      fountain.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.02;
    }
  });
}

function createNoticeBoard(x, z, rotation = 0) {
  const board = new THREE.Group();
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 2.3, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 })
  );
  stand.position.y = 1.15;
  stand.castShadow = true;
  board.add(stand);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.1, 0.15),
    new THREE.MeshStandardMaterial({
      map: noticeTexture.texture,
      color: 0xffffff,
      roughness: 0.9
    })
  );
  panel.position.set(0, 2.05, 0.15);
  panel.castShadow = true;
  board.add(panel);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(4.35, 2.25, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x4a3829, roughness: 1 })
  );
  frame.position.set(0, 2.05, 0.07);
  board.add(frame);

  board.position.set(x, 0, z);
  board.rotation.y = rotation;
  world.add(board);

  let pulse = 0;
  interactables.push({
    kind: "board",
    label: "Painel de avisos",
    radius: 3.1,
    position: new THREE.Vector3(x, 0, z),
    root: board,
    npcApproachRadius: 1.8,
    npcDuration: 2.1,
    interact() {
      pulse = 1;
      speechOverlay.speak("Biblioteca ate 21h. Mutirao do gramado sexta.", "Painel de avisos");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 1.3);
      frame.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.01 + pulse * 0.035);
    }
  });
}

function createCampusBanner(x, z, rotation = 0) {
  const banner = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 });
  const clothMat = new THREE.MeshStandardMaterial({
    map: campusBannerTexture,
    roughness: 0.9,
    side: THREE.DoubleSide
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 10), poleMat);
  pole.position.y = 1.9;
  pole.castShadow = true;
  banner.add(pole);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c3, roughness: 0.6 })
  );
  cap.position.y = 3.85;
  cap.castShadow = true;
  banner.add(cap);

  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5, 10, 4), clothMat);
  cloth.geometry.translate(1.6, 0, 0);
  cloth.position.set(0.1, 2.35, 0.02);
  cloth.rotation.y = Math.PI / 2;
  cloth.castShadow = true;
  banner.add(cloth);

  const anchor = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x8f7d66, roughness: 0.9 })
  );
  anchor.position.set(0.12, 2.42, 0.0);
  anchor.castShadow = true;
  banner.add(anchor);

  banner.position.set(x, 0, z);
  banner.rotation.y = rotation;
  world.add(banner);

  const clothGeometry = cloth.geometry;
  const clothPositions = clothGeometry.attributes.position;
  const basePositions = new Float32Array(clothPositions.array);
  const phase = rand(0, Math.PI * 2);

  decorativeProps.push({
    update(dt, time) {
      const wind = Math.max(0.12, currentAtmosphereState.weather.wind * 0.9 + 0.08);
      const sway = 0.04 + wind * 0.16;
      for (let i = 0; i < clothPositions.count; i += 1) {
        const index = i * 3;
        const baseX = basePositions[index];
        const xRatio = baseX / 3.2;
        const wave = Math.sin(time * 4.2 + phase + xRatio * 8.5) * sway * xRatio;
        clothPositions.array[index + 2] = basePositions[index + 2] + wave;
        clothPositions.array[index + 1] =
          basePositions[index + 1] + Math.sin(time * 1.9 + phase + xRatio * 4.5) * wind * 0.018;
      }
      clothPositions.needsUpdate = true;
      cloth.rotation.z = Math.sin(time * 1.3 + phase) * wind * 0.03;
      pole.rotation.z = Math.sin(time * 0.8 + phase) * wind * 0.01;
    }
  });
}

function createBall(x, z) {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      roughness: 0.9,
      metalness: 0.05
    })
  );
  ball.castShadow = true;
  ball.position.set(x, 0.32, z);
  world.add(ball);

  const velocity = new THREE.Vector2(0, 0);
  let lift = 0;
  const position = new THREE.Vector3(x, 0, z);
  function kickBall(source) {
    const push = new THREE.Vector2(ball.position.x - source.x, ball.position.z - source.z);
    if (push.lengthSq() < 0.001) push.set(0, -1);
    push.normalize().multiplyScalar(5.2);
    velocity.add(push);
    lift = 0.24;
  }

  interactables.push({
    kind: "ball",
    label: "Bola",
    radius: 2.2,
    position,
    root: ball,
    npcApproachRadius: 0.95,
    npcDuration: 0.9,
    interact() {
      kickBall(player.position);
      speechOverlay.speak("A bola sai rolando pelo gramado.", "Bola");
    },
    npcInteract(npc) {
      kickBall(npc.group.position);
    },
    update(dt) {
      ball.position.x += velocity.x * dt;
      ball.position.z += velocity.y * dt;
      velocity.multiplyScalar(Math.max(0, 1 - dt * 2.3));
      ball.position.x = THREE.MathUtils.clamp(ball.position.x, -66, 66);
      ball.position.z = THREE.MathUtils.clamp(ball.position.z, -66, 66);
      lift = Math.max(0, lift - dt * 0.6);
      ball.position.y = 0.32 + Math.sin(clock.elapsedTime * 9) * lift * 0.05;
      position.set(ball.position.x, 0, ball.position.z);
    }
  });
}

function createBike(x, z, rotation = 0) {
  const bike = new THREE.Group();
  const frameColor = new THREE.MeshStandardMaterial({ color: 0x214d7a, roughness: 0.8 });
  const wheelColor = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 1 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x5a3f26, roughness: 0.85 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcad4dc, roughness: 0.35, metalness: 0.6 });
  const wheelRadius = 0.42;
  const rearZ = -0.86;
  const frontZ = 0.86;
  const tubeUp = new THREE.Vector3(0, 1, 0);

  function addTubeBetween(from, to, radius, material) {
    const direction = to.clone().sub(from);
    const length = direction.length();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
    tube.position.copy(from).addScaledVector(direction, 0.5);
    tube.quaternion.setFromUnitVectors(tubeUp, direction.normalize());
    tube.castShadow = true;
    bike.add(tube);
    return tube;
  }

  const wheelA = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.065, 12, 20), wheelColor);
  wheelA.rotation.y = Math.PI / 2;
  wheelA.position.set(0, wheelRadius, frontZ);
  wheelA.castShadow = true;
  bike.add(wheelA);

  const wheelB = wheelA.clone();
  wheelB.position.z = rearZ;
  bike.add(wheelB);

  const rearHub = new THREE.Vector3(0, wheelRadius, rearZ);
  const frontHub = new THREE.Vector3(0, wheelRadius, frontZ);
  const crankPos = new THREE.Vector3(0, 0.52, -0.02);
  const seatCluster = new THREE.Vector3(0, 1.06, -0.24);
  const headCluster = new THREE.Vector3(0, 1.03, 0.58);
  const handleAnchor = new THREE.Vector3(0, 1.16, 0.8);

  addTubeBetween(seatCluster, headCluster, 0.045, frameColor);
  addTubeBetween(headCluster, crankPos, 0.045, frameColor);
  addTubeBetween(crankPos, seatCluster, 0.04, frameColor);
  addTubeBetween(rearHub, crankPos, 0.035, frameColor);
  addTubeBetween(rearHub, seatCluster, 0.032, frameColor);
  addTubeBetween(frontHub, headCluster, 0.035, chromeMat);
  addTubeBetween(headCluster, handleAnchor, 0.03, chromeMat);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), chromeMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.copy(handleAnchor);
  handle.castShadow = true;
  bike.add(handle);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.38), seatMat);
  seat.position.set(0, 1.18, -0.32);
  seat.castShadow = true;
  bike.add(seat);

  const crank = new THREE.Group();
  crank.position.copy(crankPos);
  bike.add(crank);

  const crankHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), chromeMat);
  crankHub.rotation.z = Math.PI / 2;
  crankHub.castShadow = true;
  crank.add(crankHub);

  const pedalArmLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), chromeMat);
  pedalArmLeft.position.set(-0.11, 0.17, 0);
  crank.add(pedalArmLeft);

  const pedalArmRight = pedalArmLeft.clone();
  pedalArmRight.position.set(0.11, -0.17, 0);
  crank.add(pedalArmRight);

  const pedalLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.08), frameColor);
  pedalLeft.position.set(-0.16, 0.35, 0);
  pedalLeft.castShadow = true;
  crank.add(pedalLeft);

  const pedalRight = pedalLeft.clone();
  pedalRight.position.set(0.16, -0.35, 0);
  crank.add(pedalRight);

  const mudguardA = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.05, 0.02, 8, 18, Math.PI), frameColor);
  mudguardA.rotation.y = Math.PI / 2;
  mudguardA.position.set(0, wheelRadius + 0.08, frontZ);
  mudguardA.castShadow = true;
  bike.add(mudguardA);

  const mudguardB = mudguardA.clone();
  mudguardB.position.z = rearZ;
  bike.add(mudguardB);

  bike.position.set(x, 0, z);
  bike.rotation.y = rotation;
  world.add(bike);

  const bikeState = {
    group: bike,
    position: bike.position,
    wheels: [wheelA, wheelB],
    handle,
    crank,
    seat,
    wheelRadius,
    mounted: false,
    syncId: `bike:${sharedBikeCount++}`,
    wheelSpin: 0,
    pedalPhase: 0,
    wheelieAmount: 0,
    wheelieTimer: 0,
    facingYaw: rotation,
    targetX: x,
    targetZ: z,
    targetRy: rotation,
    remoteMountedBy: null,
    remoteSpeed: 0,
    hasSharedState: false,
    emitState: null,
    mount: null,
    dismount: null,
  };
  sharedBikes.set(bikeState.syncId, bikeState);

  function emitBikeState(mounted = bikeState.mounted) {
    onLocalEntityState({
      id: bikeState.syncId,
      kind: "bike",
      x: bike.position.x,
      z: bike.position.z,
      ry: bike.rotation.y,
      speed: mounted ? playerVelocity.length() : 0,
      mounted,
    });
  }
  bikeState.emitState = emitBikeState;

  function findDismountSpot() {
    const candidateOffsets = [
      new THREE.Vector3(0.95, 0, 0.75),
      new THREE.Vector3(-0.95, 0, 0.75),
      new THREE.Vector3(0, 0, 1.25),
      new THREE.Vector3(0, 0, -1.25),
    ];
    for (const offset of candidateOffsets) {
      const worldOffset = offset.clone().applyEuler(new THREE.Euler(0, bike.rotation.y, 0));
      const candidate = new THREE.Vector3(
        player.position.x + worldOffset.x,
        0,
        player.position.z + worldOffset.z
      );
      if (
        !isBlockedAt(candidate.x, candidate.z, 0.62) &&
        !swimmingMinigame?.isNoBikeZone(candidate.x, candidate.z)
      ) {
        return candidate;
      }
    }
    return null;
  }

  function mountBike() {
    if (playerState.sitting) return;
    if (
      swimmingMinigame?.isNoBikeZone(player.position.x, player.position.z) ||
      swimmingMinigame?.isNoBikeZone(bike.position.x, bike.position.z)
    ) {
      speechOverlay.speak("Bicicletas ficam fora da area da piscina.", "Piscina");
      return;
    }
    if (bikeState.remoteMountedBy) {
      speechOverlay.speak("Essa bicicleta ja esta sendo usada por outro player.", "Bicicleta");
      return;
    }
    if (playerState.ridingBike === bikeState) return;
    player.position.set(bike.position.x, 0, bike.position.z);
    if (playerVelocity.lengthSq() < 0.01) {
      player.rotation.y = bike.rotation.y;
    }
    playerState.ridingBike = bikeState;
    bikeState.mounted = true;
    playerState.jumping = false;
    playerState.jumpY = 0;
    playerState.jumpVel = 0;
    playerVelocity.multiplyScalar(0.2);
    emitBikeState(true);
    speechOverlay.speak("Voce subiu na bicicleta. Pedale com WASD e use E longe de objetos para descer.", "Bicicleta");
  }

  function dismountBike() {
    if (playerState.ridingBike !== bikeState) return false;
    const spot = findDismountSpot();
    if (!spot) {
      speechOverlay.speak("Nao ha espaco para descer da bicicleta aqui.", "Bicicleta");
      return false;
    }
    player.position.set(spot.x, 0, spot.z);
    bike.position.set(spot.x - 0.38, 0, spot.z - 0.12);
    bike.rotation.y = player.rotation.y - 0.42;
    bike.rotation.x = 0;
    bikeState.facingYaw = bike.rotation.y;
    bikeState.wheelieAmount = 0;
    bikeState.wheelieTimer = 0;
    bikeState.mounted = false;
    playerState.ridingBike = null;
    player.rotation.x = 0;
    playerVelocity.set(0, 0);
    emitBikeState(false);
    speechOverlay.speak("Voce desceu da bicicleta.", "Bicicleta");
    return true;
  }

  bikeState.mount = mountBike;
  bikeState.dismount = dismountBike;

  let spinImpulse = 0;
  interactables.push({
    kind: "bike",
    label: "Bicicleta",
    radius: 2.4,
    position: bike.position,
    root: bike,
    npcApproachRadius: 1.25,
    npcDuration: 1.3,
    isDisabledForPlayer: () => playerState.ridingBike === bikeState || !!bikeState.remoteMountedBy,
    npcDisabled: () => bikeState.mounted || !!bikeState.remoteMountedBy,
    interact() {
      if (playerState.ridingBike === bikeState) {
        dismountBike();
        return;
      }
      mountBike();
    },
    npcInteract() {
      if (bikeState.mounted) return;
      spinImpulse += Math.PI / 10;
    },
    update(dt) {
      if (bikeState.mounted) {
        const wheelieAngle = bikeState.wheelieAmount * 0.52;
        const wheelieLift = Math.sin(wheelieAngle) * 0.86;
        bike.position.set(player.position.x, wheelieLift, player.position.z);
        bike.rotation.x = -wheelieAngle;
        bike.rotation.y = player.rotation.y;
        bikeState.facingYaw = bike.rotation.y;
        wheelA.rotation.x = bikeState.wheelSpin;
        wheelB.rotation.x = bikeState.wheelSpin;
        crank.rotation.x = bikeState.pedalPhase;
        handle.rotation.y = THREE.MathUtils.clamp(playerVelocity.length() * 0.015, -0.08, 0.08);
        spinImpulse = 0;
        return;
      }
      if (bikeState.remoteMountedBy) {
        const lerp = Math.min(1, dt * 12);
        bike.position.x += (bikeState.targetX - bike.position.x) * lerp;
        bike.position.z += (bikeState.targetZ - bike.position.z) * lerp;
        bike.rotation.y = lerpAngle(bike.rotation.y, bikeState.targetRy, lerp);
        bikeState.facingYaw = bike.rotation.y;
        bikeState.wheelSpin += bikeState.remoteSpeed * dt / Math.max(0.2, bikeState.wheelRadius);
        bikeState.pedalPhase += bikeState.remoteSpeed * dt * 0.95;
        wheelA.rotation.x = bikeState.wheelSpin;
        wheelB.rotation.x = bikeState.wheelSpin;
        crank.rotation.x = bikeState.pedalPhase;
        handle.rotation.y = THREE.MathUtils.clamp(bikeState.remoteSpeed * 0.01, -0.08, 0.08);
        bike.rotation.x = THREE.MathUtils.lerp(bike.rotation.x, 0, Math.min(1, dt * 8));
        bike.position.y = 0;
        spinImpulse = 0;
        return;
      }
      if (bikeState.hasSharedState) {
        const lerp = Math.min(1, dt * 8);
        bike.position.x += (bikeState.targetX - bike.position.x) * lerp;
        bike.position.z += (bikeState.targetZ - bike.position.z) * lerp;
        bike.rotation.y = lerpAngle(bike.rotation.y, bikeState.targetRy, lerp);
      }
      spinImpulse *= Math.max(0, 1 - dt * 3.4);
      bike.rotation.x = THREE.MathUtils.lerp(bike.rotation.x, 0, Math.min(1, dt * 8));
      bike.rotation.y += spinImpulse * dt * 6;
      bike.position.y = Math.sin(clock.elapsedTime * 2) * 0.02;
      wheelA.rotation.x += spinImpulse * dt * 12;
      wheelB.rotation.x += spinImpulse * dt * 12;
      crank.rotation.x += spinImpulse * dt * 7;
    }
  });
}

function createCampusBus(routePoints) {
  const bus = new THREE.Group();
  const wheelRadius = 0.34;
  const busSpeed = 6.2;
  const TAU = Math.PI * 2;
  const upperBodyMat = new THREE.MeshStandardMaterial({ color: 0xf7f4ea, roughness: 0.78 });
  const lowerBodyMat = new THREE.MeshStandardMaterial({ color: 0x23824c, roughness: 0.84 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x155b36, roughness: 0.74 });
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x333b37, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2a6, emissive: 0xffdf78, emissiveIntensity: 0.22, roughness: 0.42 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xc73535, emissive: 0x8b1515, emissiveIntensity: 0.18, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8dc4e6,
    transparent: true,
    opacity: 0.72,
    roughness: 0.2,
    metalness: 0.08
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 1 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xe3e0d2, roughness: 0.68 });

  const bodyShell = new THREE.Group();
  bus.add(bodyShell);

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.95, 1.98), lowerBodyMat);
  lowerBody.position.y = 0.98;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  bodyShell.add(lowerBody);

  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.95, 1.9), upperBodyMat);
  upperBody.position.y = 1.93;
  upperBody.castShadow = true;
  upperBody.receiveShadow = true;
  bodyShell.add(upperBody);

  const beltLine = new THREE.Mesh(new THREE.BoxGeometry(5.44, 0.08, 2.04), trimMat);
  beltLine.position.y = 1.45;
  beltLine.castShadow = true;
  bodyShell.add(beltLine);

  const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(5.12, 0.14, 1.92), trimMat);
  lowerTrim.position.y = 0.66;
  lowerTrim.castShadow = true;
  bodyShell.add(lowerTrim);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.98, 0.22, 1.86), upperBodyMat);
  roof.position.y = 2.5;
  roof.castShadow = true;
  bodyShell.add(roof);

  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.78, 1.56), glassMat);
  windowBand.position.set(0.14, 1.72, 0);
  bodyShell.add(windowBand);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.92, 1.5), glassMat);
  windshield.position.set(2.58, 1.68, 0);
  bodyShell.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.92, 1.5), glassMat);
  rearWindow.position.set(-2.56, 1.68, 0);
  bodyShell.add(rearWindow);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ map: busSignTexture, roughness: 0.8 })
  );
  sign.position.set(1.12, 2.13, 1.03);
  sign.castShadow = true;
  bodyShell.add(sign);

  const frontSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.42, 1.12),
    new THREE.MeshStandardMaterial({ map: busSignTexture, roughness: 0.8 })
  );
  frontSign.position.set(2.72, 2.05, 0);
  frontSign.castShadow = true;
  bodyShell.add(frontSign);

  const sideAccent = new THREE.Mesh(new THREE.BoxGeometry(5.18, 0.1, 0.12), trimMat);
  sideAccent.position.set(0, 2.02, 1.03);
  bodyShell.add(sideAccent);

  const doorSeamA = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.55, 0.05), trimMat);
  doorSeamA.position.set(1.52, 1.2, 1.06);
  bodyShell.add(doorSeamA);

  const doorSeamB = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.55, 0.05), trimMat);
  doorSeamB.position.set(0.9, 1.2, 1.06);
  bodyShell.add(doorSeamB);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 1.72), bumperMat);
  frontBumper.position.set(2.76, 0.55, 0);
  frontBumper.castShadow = true;
  bodyShell.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 1.72), bumperMat);
  rearBumper.position.set(-2.76, 0.55, 0);
  rearBumper.castShadow = true;
  bodyShell.add(rearBumper);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.62), bumperMat);
  grille.position.set(2.79, 0.88, 0);
  bodyShell.add(grille);

  for (const z of [-0.58, 0.58]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.26), lightMat);
    headlight.position.set(2.81, 0.95, z);
    bodyShell.add(headlight);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.22), tailLightMat);
    tailLight.position.set(-2.81, 0.92, z);
    bodyShell.add(tailLight);
  }

  const wheelPositions = [
    [-1.65, 0.42, 0.92],
    [1.65, 0.42, 0.92],
    [-1.65, 0.42, -0.92],
    [1.65, 0.42, -0.92]
  ];
  const wheels = [];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Group();
    wheel.position.set(x, y, z);

    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 10, 18), wheelMat);
    tire.castShadow = true;
    wheel.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    wheel.add(hub);

    wheel.castShadow = true;
    bus.add(wheel);
    wheels.push(wheel);
  }

  const route = routePoints.map((point) => ({
    position: new THREE.Vector3(point.x, 0, point.z),
    dwell: point.dwell ?? 1.0
  }));
  const routeSegments = route.map((point, index) => {
    const next = route[(index + 1) % route.length];
    const dx = next.position.x - point.position.x;
    const dz = next.position.z - point.position.z;
    const length = Math.max(0.0001, Math.hypot(dx, dz));
    return {
      index,
      start: point.position,
      end: next.position,
      dx,
      dz,
      length,
      yaw: Math.atan2(dx, dz),
      travelDuration: length / busSpeed,
    };
  });
  const cycleDuration = routeSegments.reduce(
    (total, segment) => total + route[segment.index].dwell + segment.travelDuration,
    0
  );
  const seatAnchor = new THREE.Vector3();
  const initialPathYaw = routeSegments[0]?.yaw ?? Math.PI / 2;
  bus.rotation.y = routeYawToBusYaw(initialPathYaw);
  const state: any = {
    group: bus,
    route,
    routeSegments,
    routeIndex: 0,
    segmentProgress: 0,
    dwellTimer: route[0]?.dwell ?? 1.2,
    speed: busSpeed,
    currentSpeed: 0,
    wheelSpin: 0,
    seatAnchor,
    facingYaw: bus.rotation.y,
    position: bus.position,
    rideBeacon: 0,
    crowdCount: 0,
    crowdLabel: "livre",
    crowdComplaintCooldown: 0,
    activeStopIndex: -1,
    routeReady: false,
  };

  function clamp01(value) {
    return THREE.MathUtils.clamp(value, 0, 1);
  }

  function easeVehicleProgress(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function routeYawToBusYaw(routeYaw) {
    return routeYaw - Math.PI / 2;
  }

  function updateSeatAnchor() {
    seatAnchor.set(0.18, 1.18, 0.04).applyEuler(new THREE.Euler(0, bus.rotation.y, 0)).add(bus.position);
  }

  function sampleRouteAtTime(time) {
    if (!cycleDuration) {
      return {
        position: route[0]?.position || new THREE.Vector3(),
        pathYaw: Math.PI / 2,
        visualYaw: routeYawToBusYaw(Math.PI / 2),
        routeIndex: 0,
        dwellTimer: 0,
        segmentProgress: 0,
        currentSpeed: 0,
        wheelSpin: 0,
      };
    }

    const normalized = ((time % cycleDuration) + cycleDuration) % cycleDuration;
    let cursor = 0;
    let traveledDistance = 0;

    for (const segment of routeSegments) {
      const dwellDuration = route[segment.index].dwell;
      if (normalized < cursor + dwellDuration) {
        const previousSegment = routeSegments[(segment.index - 1 + routeSegments.length) % routeSegments.length];
        const dwellProgress = dwellDuration <= 0.0001
          ? 1
          : (dwellDuration - (cursor + dwellDuration - normalized)) / dwellDuration;
        const pathYaw = lerpAngle(previousSegment?.yaw ?? segment.yaw, segment.yaw, easeVehicleProgress(dwellProgress));
        return {
          position: segment.start,
          pathYaw,
          visualYaw: routeYawToBusYaw(pathYaw),
          routeIndex: segment.index,
          dwellTimer: cursor + dwellDuration - normalized,
          segmentProgress: 0,
          currentSpeed: 0,
          wheelSpin: (traveledDistance / wheelRadius) % TAU,
        };
      }
      cursor += dwellDuration;

      const travelEnd = cursor + segment.travelDuration;
      if (normalized < travelEnd) {
        const rawProgress = segment.travelDuration <= 0.0001 ? 1 : (normalized - cursor) / segment.travelDuration;
        const progress = easeVehicleProgress(rawProgress);
        const segmentProgress = segment.length * progress;
        const speedFactor = 6 * rawProgress * (1 - rawProgress);
        return {
          position: new THREE.Vector3(
            segment.start.x + segment.dx * progress,
            0,
            segment.start.z + segment.dz * progress
          ),
          pathYaw: segment.yaw,
          visualYaw: routeYawToBusYaw(segment.yaw),
          routeIndex: segment.index,
          dwellTimer: 0,
          segmentProgress,
          currentSpeed: busSpeed * speedFactor,
          wheelSpin: ((traveledDistance + segmentProgress) / wheelRadius) % TAU,
        };
      }
      cursor = travelEnd;
      traveledDistance += segment.length;
    }

    const fallback = routeSegments[0];
    return {
      position: fallback?.start || new THREE.Vector3(),
      pathYaw: fallback?.yaw ?? Math.PI / 2,
      visualYaw: routeYawToBusYaw(fallback?.yaw ?? Math.PI / 2),
      routeIndex: 0,
      dwellTimer: route[0]?.dwell ?? 0,
      segmentProgress: 0,
      currentSpeed: 0,
      wheelSpin: 0,
    };
  }

  function moveAlongRoute(dt, time) {
    const sample = sampleRouteAtTime(time);
    const yawDelta = ((((sample.visualYaw - bus.rotation.y) % TAU) + Math.PI * 3) % TAU) - Math.PI;
    const turnLerp = Math.min(1, dt * (sample.currentSpeed > 0.2 ? 5.4 : 3.2));
    const acceleration = dt > 0 ? (sample.currentSpeed - state.currentSpeed) / dt : 0;
    const movingFactor = THREE.MathUtils.clamp(sample.currentSpeed / busSpeed, 0, 1.4);

    state.routeIndex = sample.routeIndex;
    state.segmentProgress = sample.segmentProgress;
    state.dwellTimer = sample.dwellTimer;
    state.wheelSpin = sample.wheelSpin;
    state.currentSpeed = sample.currentSpeed;

    bus.position.copy(sample.position);
    bus.rotation.y = lerpAngle(bus.rotation.y, sample.visualYaw, turnLerp);
    bus.rotation.z = THREE.MathUtils.lerp(
      bus.rotation.z,
      THREE.MathUtils.clamp(-yawDelta * movingFactor * 0.18, -0.075, 0.075),
      Math.min(1, dt * 5.5)
    );
    bus.rotation.x = THREE.MathUtils.lerp(
      bus.rotation.x,
      THREE.MathUtils.clamp(-acceleration * 0.012, -0.05, 0.05),
      Math.min(1, dt * 4.6)
    );
    state.facingYaw = bus.rotation.y;
    bus.position.y =
      movingFactor * (Math.sin(time * 7.4) * 0.018 + Math.sin(time * 13.1) * 0.006) +
      (state.dwellTimer > 0 ? Math.sin(time * 2.1) * 0.006 : 0);

    for (const wheel of wheels) {
      wheel.rotation.z = -state.wheelSpin;
    }
    if (state.dwellTimer > 0) {
      state.rideBeacon = Math.max(state.rideBeacon, 0.2);
    }
    const stopIndex = state.dwellTimer > 0 ? state.routeIndex : -1;
    if (!state.routeReady) {
      state.activeStopIndex = stopIndex;
      state.routeReady = true;
    } else if (stopIndex !== state.activeStopIndex) {
      if (stopIndex >= 0) {
        playBusArrivalSound(0.8 + state.crowdCount * 0.1);
      }
      state.activeStopIndex = stopIndex;
    }
    updateSeatAnchor();
  }

  function updateCrowdState(dt) {
    state.crowdCount = countNearbyHumans(bus.position, 5.6);
    state.crowdLabel = state.crowdCount >= 3
      ? "lotado"
      : state.crowdCount >= 2
        ? "quase lotado"
        : "livre";
    state.crowdComplaintCooldown = Math.max(0, state.crowdComplaintCooldown - dt);
  }

  world.add(bus);
  buses.push(state);

  const busInteractable: any = {
    kind: "bus",
    label: "Jardineira",
    radius: 4.6,
    position: bus.position,
    root: bus,
    npcApproachRadius: 1.2,
    npcDuration: 5.8,
    interact() {
      if (playerState.sitting) return;
      state.rideBeacon = 1.2;
      if (state.crowdCount >= 3) {
        if (state.crowdComplaintCooldown <= 0) {
          speechOverlay.speak("Chegou tarde. Essa jardineira ja lotou. Espera a proxima.", "Motorista");
          state.crowdComplaintCooldown = 5.5;
        }
        return;
      }
      if (state.crowdCount >= 2) {
        speechOverlay.speak("Vai apertado, mas ainda cabe mais um.", "Motorista");
      }
      enterSitState(
        {
          position: seatAnchor,
          rotation: bus.rotation.y + Math.PI
        },
        {
          duration: 5.8,
          label: "jardineira",
          endMessage: "Voce desceu da jardineira na parada seguinte.",
          endSpeaker: "Jardineira"
        }
      );
      speechOverlay.speak("Voce embarcou na jardineira do campus.", "Jardineira");
    },
    update(dt, time) {
      moveAlongRoute(dt, time);
      updateCrowdState(dt);
      busInteractable.crowdLabel = state.crowdLabel;
      busInteractable.crowdCount = state.crowdCount;
      state.rideBeacon = Math.max(0, state.rideBeacon - dt * 0.75);
      const suspensionPulse = (state.currentSpeed / busSpeed) * Math.sin(time * 8.2) * 0.006;
      bodyShell.scale.y = 1 + suspensionPulse + state.rideBeacon * 0.01 + state.crowdCount * 0.004;
      roof.position.y = 2.5 + Math.sin(time * 3.5) * 0.01 * (state.currentSpeed / busSpeed);
      sign.scale.setScalar(1 + state.rideBeacon * 0.05 + state.crowdCount * 0.02);
    }
  };
  busInteractable.crowdLabel = state.crowdLabel;
  busInteractable.crowdCount = state.crowdCount;
  interactables.push(busInteractable);
}

function createSnackCart(x, z, rotation = 0) {
  const cart = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x7a4c27, roughness: 0.95 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.9 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 });

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.4), clothMat);
  roof.position.y = 2.1;
  roof.castShadow = true;
  cart.add(roof);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.05), frameMat);
  body.position.y = 1.05;
  body.castShadow = true;
  cart.add(body);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.28), clothMat);
  awning.position.set(0, 1.58, 0.58);
  awning.castShadow = true;
  cart.add(awning);

  for (const sx of [-0.72, 0.72]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 14), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(sx, 0.22, 0);
    wheel.castShadow = true;
    cart.add(wheel);
  }

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.4, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  );
  sign.position.set(0, 1.8, 0.78);
  sign.castShadow = true;
  cart.add(sign);

  cart.position.set(x, 0, z);
  cart.rotation.y = rotation;
  world.add(cart);

  let pulse = 0;
  interactables.push({
    kind: "snack",
    label: "Carrinho",
    radius: 2.8,
    position: new THREE.Vector3(x, 0, z),
    root: cart,
    npcApproachRadius: 1.35,
    npcDuration: 1.8,
    interact() {
      pulse = 1;
      speechOverlay.speak("O carrinho tem um cheirinho bom de lanche.", "Carrinho");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.4);
      cart.position.y = Math.sin(time * 2.2) * 0.02;
      sign.scale.setScalar(1 + pulse * 0.08);
    }
  });
}

function createReadingTable(x, z, rotation = 0) {
  const table = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8e6a45, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x62727d, roughness: 0.9 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 1.25), wood);
  top.position.y = 0.92;
  top.castShadow = true;
  table.add(top);

  const legPositions = [
    [-1.02, 0.45, -0.48],
    [1.02, 0.45, -0.48],
    [-1.02, 0.45, 0.48],
    [1.02, 0.45, 0.48]
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), metal);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    table.add(leg);
  }

  const books = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.12, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x4b7bd1, roughness: 0.85 })
  );
  books.position.set(-0.15, 1.08, 0);
  books.castShadow = true;
  table.add(books);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95 })
  );
  lamp.position.set(0.58, 1.34, -0.22);
  lamp.castShadow = true;
  table.add(lamp);

  table.position.set(x, 0, z);
  table.rotation.y = rotation;
  world.add(table);

  let pulse = 0;
  interactables.push({
    kind: "table",
    label: "Mesa",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    root: table,
    npcApproachRadius: 1.6,
    npcDuration: 2.4,
    interact() {
      pulse = 1;
      speechOverlay.speak("Mesa boa para revisar anotações e combinar planos.", "Mesa");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.2);
      table.position.y = Math.sin(time * 1.9) * 0.015;
      books.rotation.z = Math.sin(time * 2.7) * 0.04 + pulse * 0.08;
    }
  });
}

function createInfoKiosk(x, z, rotation = 0) {
  const kiosk = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x6c7f56, roughness: 0.96 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.5, 0.28), baseMat);
  stand.position.y = 1.25;
  stand.castShadow = true;
  kiosk.add(stand);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.6, 0.16), boardMat);
  sign.position.set(0, 2.15, 0.14);
  sign.castShadow = true;
  kiosk.add(sign);

  const footer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 0.32), baseMat);
  footer.position.set(0, 0.38, 0.1);
  footer.castShadow = true;
  kiosk.add(footer);

  kiosk.position.set(x, 0, z);
  kiosk.rotation.y = rotation;
  world.add(kiosk);

  let pulse = 0;
  interactables.push({
    kind: "kiosk",
    label: "Quiosque",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    root: kiosk,
    npcApproachRadius: 1.7,
    npcDuration: 1.9,
    interact() {
      pulse = 1;
      speechOverlay.speak("O quiosque mostra o caminho mais movimentado do campus.", "Quiosque");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.5);
      sign.scale.setScalar(1 + pulse * 0.06);
      kiosk.rotation.y = rotation + Math.sin(time * 0.35) * 0.02;
    }
  });
}

function createBikeRack(x, z, rotation = 0) {
  const rack = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f6d71, roughness: 0.9 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 1 });

  for (let i = -1; i <= 1; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 2.4), mat);
    bar.position.set(i * 0.55, 0.5, 0);
    bar.castShadow = true;
    rack.add(bar);
  }

  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 16), tireMat);
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(0, 0.42, 0.95);
  wheel.castShadow = true;
  rack.add(wheel);

  rack.position.set(x, 0, z);
  rack.rotation.y = rotation;
  world.add(rack);

  let pulse = 0;
  interactables.push({
    kind: "bike",
    label: "Bicicletário",
    radius: 2.7,
    position: new THREE.Vector3(x, 0, z),
    root: rack,
    npcApproachRadius: 1.35,
    npcDuration: 1.4,
    interact() {
      pulse = 1;
      speechOverlay.speak("O bicicletário está pronto para a próxima corrida.", "Bicicletário");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.6);
      rack.position.y = Math.sin(time * 2.4) * 0.012;
      wheel.rotation.x = time * 0.6 + pulse * 0.3;
    }
  });
}

function createMusicTotem(x, z, rotation = 0) {
  const booth = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4d35, roughness: 0.95 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x2e4e3c, roughness: 0.7 });
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf6b94b,
    emissive: 0xb86f16,
    emissiveIntensity: 0.35,
    roughness: 0.55
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xa8ffda,
    emissive: 0x62ff9f,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.85
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.42, 12), woodMat);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  booth.add(base);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.1), shellMat);
  body.position.y = 1.48;
  body.castShadow = true;
  booth.add(body);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.56, 0.08), accentMat);
  panel.position.set(0, 2.05, 0.6);
  panel.castShadow = true;
  booth.add(panel);

  const screenGlow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.04), glowMat);
  screenGlow.position.set(0, 2.06, 0.66);
  booth.add(screenGlow);

  for (const side of [-1, 1]) {
    const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24), speakerMat);
    speaker.rotation.x = Math.PI / 2;
    speaker.position.set(side * 0.4, 1.45, 0.6);
    speaker.castShadow = true;
    booth.add(speaker);

    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16), accentMat);
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(side * 0.4, 1.82, 0.6);
    booth.add(tweeter);
  }

  const beacon = new THREE.PointLight(0x62ff9f, 0.6, 7, 2);
  beacon.position.set(0, 2.35, 0.85);
  booth.add(beacon);

  booth.position.set(x, 0, z);
  booth.rotation.y = rotation;
  world.add(booth);

  let pulse = 0;
  interactables.push({
    kind: "music",
    label: "Radio do campus",
    radius: 3.2,
    position: new THREE.Vector3(x, 0, z),
    root: booth,
    npcApproachRadius: 1.35,
    npcDuration: 1.5,
    interact() {
      pulse = 1;
      onMediaBoothInteract();
      speechOverlay.speak("Cole um link do YouTube ou Spotify para tocar na radio.", "Radio do campus");
    },
    npcInteract() {
      pulse = Math.max(pulse, 0.35);
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.4);
      const shimmer = Math.sin(time * 4.2) * 0.08;
      booth.position.y = Math.sin(time * 2.2) * 0.016;
      panel.scale.setScalar(1 + pulse * 0.05 + shimmer * 0.15);
      screenGlow.material.opacity = 0.56 + pulse * 0.2 + Math.max(0, shimmer) * 0.18;
      accentMat.emissiveIntensity = 0.3 + pulse * 0.35;
      glowMat.emissiveIntensity = 0.5 + pulse * 0.45;
      beacon.intensity = 0.55 + pulse * 0.7 + Math.max(0, shimmer) * 0.12;
    }
  });
}

function createWaterStation(x, z, rotation = 0) {
  const station = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7b9cb2, roughness: 0.8 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x9be4ff, transparent: true, opacity: 0.75 });

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.8, 12), mat);
  column.position.y = 0.9;
  column.castShadow = true;
  station.add(column);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.24, 0.7), mat);
  top.position.y = 1.9;
  top.castShadow = true;
  station.add(top);

  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 10), glowMat);
  stream.position.set(0, 1.35, 0.34);
  station.add(stream);

  station.position.set(x, 0, z);
  station.rotation.y = rotation;
  world.add(station);

  let pulse = 0;
  interactables.push({
    kind: "fountain",
    label: "Bebedouro",
    radius: 2.5,
    position: new THREE.Vector3(x, 0, z),
    root: station,
    npcApproachRadius: 1.15,
    npcDuration: 1.2,
    interact() {
      pulse = 1;
      speechOverlay.speak("Um gole de água gelada ajuda a voltar pro ritmo.", "Bebedouro");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.8);
      station.position.y = Math.sin(time * 2.8) * 0.012;
      stream.material.opacity = 0.55 + pulse * 0.25;
    }
  });
}

createBench(-15, 8, Math.PI / 2);
createBench(11, 12, -Math.PI / 3);
createFountain(6, -2);
createNoticeBoard(-31, 9, Math.PI / 2);
createCampusBanner(-38, 16, Math.PI / 2);
createBall(-4, 16);
createBike(24, 4, -Math.PI / 2);
// Bike de cortesia logo apos a catraca, pra player ir mais rapido ate o bloco
createBike(CAMPUS_ENTRY_X + 6, -60, -Math.PI / 2);
createCampusBus([
  { x: -62, z: 62, dwell: 1.4 },
  { x: -12, z: 62, dwell: 0.8 },
  { x: 28, z: 62, dwell: 0.7 },
  { x: 62, z: 56, dwell: 1.0 },
  { x: 62, z: 8, dwell: 0.8 },
  { x: 62, z: -44, dwell: 1.2 },
  { x: 22, z: -66, dwell: 0.9 },
  { x: -54, z: -66, dwell: 1.1 },
  { x: -64, z: -10, dwell: 0.8 },
  { x: -62, z: 38, dwell: 1.0 }
]);
createSnackCart(20, -20, Math.PI / 2);
createReadingTable(-10, 28, -Math.PI / 4);
createInfoKiosk(2, -34, 0);
createBikeRack(-24, -26, Math.PI / 2);
createMusicTotem(-18, -4, Math.PI / 2);
createWaterStation(30, 24, -Math.PI / 2);
createBench(34, 18, -Math.PI / 2);
createBench(-32, 20, Math.PI / 2);
createNoticeBoard(28, -10, 0);
createBall(16, 28);
createBall(-18, 30);

function createDuck(x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = Math.random() * Math.PI * 2;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4dd55, roughness: 0.85 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe6c443, roughness: 0.88 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf48b25, roughness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), bodyMat);
  body.scale.set(1, 0.88, 1.35);
  body.position.y = 0.42;
  body.castShadow = true;
  root.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 8), bodyMat);
  tail.position.set(0, 0.46, -0.4);
  tail.rotation.x = -Math.PI / 2.4;
  tail.castShadow = true;
  root.add(tail);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.2, 10), bodyMat);
  neck.position.set(0, 0.6, 0.22);
  neck.rotation.x = 0.45;
  neck.castShadow = true;
  root.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.74, 0.32);
  root.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), bodyMat);
  skull.castShadow = true;
  head.add(skull);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 10), beakMat);
  beak.position.set(0, -0.02, 0.2);
  beak.rotation.x = Math.PI / 2;
  beak.castShadow = true;
  head.add(beak);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
  leftEye.position.set(-0.08, 0.05, 0.13);
  head.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.08;
  head.add(rightEye);

  const wingGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.scale.set(0.35, 0.55, 1);
  leftWing.position.set(-0.27, 0.44, 0);
  leftWing.castShadow = true;
  root.add(leftWing);
  const rightWing = leftWing.clone();
  rightWing.position.x = 0.27;
  root.add(rightWing);

  const footGeo = new THREE.BoxGeometry(0.1, 0.04, 0.16);
  const leftFoot = new THREE.Mesh(footGeo, beakMat);
  leftFoot.position.set(-0.1, 0.04, 0.1);
  leftFoot.castShadow = true;
  root.add(leftFoot);
  const rightFoot = leftFoot.clone();
  rightFoot.position.x = 0.1;
  root.add(rightFoot);

  world.add(root);

  return { group: root, head, leftWing, rightWing, leftFoot, rightFoot };
}

const DUCK_LINE =
  "Os outros pretendentes ao trono eram SkekUng o lider militar do imperio que ansiava pelo trono, e isso no livro fica bem claro, e SkekZok o lider espiritual.";

const ducks = [];
const pigeons = [];

function createDuckEntity(x, z) {
  const visuals = createDuck(x, z);
  const state: any = {
    name: "Pato",
    kind: "duck",
    group: visuals.group,
    visuals,
    radius: 2.4,
    home: new THREE.Vector3(x, 0, z),
    target: new THREE.Vector3(x, 0, z),
    waitTimer: 0.5 + Math.random() * 1.5,
    hopPhase: Math.random() * Math.PI * 2,
    hopSpeed: 5.2 + Math.random() * 1.4,
    speed: 1.3,
    lines: [DUCK_LINE],
    lastLineIndex: -1,
    previewLine: DUCK_LINE,
    nearby: false,
    pause: 0,
    talkCooldown: 0,
    mapColor: "#f4dd55"
  };
  ducks.push(state);
  return state;
}

function updateDuck(duck, dt, time) {
  duck.talkCooldown = Math.max(0, duck.talkCooldown - dt);

  if (duck.pause > 0) {
    duck.pause -= dt;
    duck.group.position.y = THREE.MathUtils.lerp(duck.group.position.y, 0, 0.2);
    duck.visuals.leftWing.rotation.z = 0.25;
    duck.visuals.rightWing.rotation.z = -0.25;
    duck.visuals.head.rotation.y = Math.sin(time * 4) * 0.25;
    return;
  }

  const dx = duck.target.x - duck.group.position.x;
  const dz = duck.target.z - duck.group.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.25) {
    duck.waitTimer -= dt;
    if (duck.waitTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.6 + Math.random() * 3.4;
      duck.target.set(
        duck.home.x + Math.cos(angle) * r,
        0,
        duck.home.z + Math.sin(angle) * r
      );
      duck.waitTimer = 0.4 + Math.random() * 1.4;
    }
    duck.group.position.y = THREE.MathUtils.lerp(duck.group.position.y, 0, 0.25);
    duck.visuals.leftWing.rotation.z = 0.22;
    duck.visuals.rightWing.rotation.z = -0.22;
    duck.visuals.head.rotation.x = Math.sin(time * 2 + duck.hopPhase) * 0.1;
    return;
  }

  duck.hopPhase += dt * duck.hopSpeed;
  const hop = Math.max(0, Math.sin(duck.hopPhase));
  duck.group.position.y = hop * 0.48;

  const moveScale = 0.25 + hop * 1.4;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  duck.group.position.x += dirX * duck.speed * dt * moveScale;
  duck.group.position.z += dirZ * duck.speed * dt * moveScale;
  duck.group.rotation.y = lerpAngle(duck.group.rotation.y, Math.atan2(dirX, dirZ), 0.25);

  duck.visuals.leftWing.rotation.z = 0.2 + hop * 0.8;
  duck.visuals.rightWing.rotation.z = -0.2 - hop * 0.8;
  duck.visuals.head.rotation.x = -hop * 0.2;
  duck.group.rotation.x = hop * 0.12;
}

function createPigeon(x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = Math.random() * Math.PI * 2;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9099a6, roughness: 0.94 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x6d7480, roughness: 0.92 });
  const neckMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c2, roughness: 0.9 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xd99332, roughness: 0.72 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
  body.scale.set(1.22, 0.92, 1.5);
  body.position.y = 0.24;
  body.castShadow = true;
  root.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), neckMat);
  chest.scale.set(0.95, 0.78, 1.18);
  chest.position.set(0, 0.33, 0.18);
  chest.castShadow = true;
  root.add(chest);

  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.28);
  root.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), neckMat);
  skull.castShadow = true;
  head.add(skull);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), beakMat);
  beak.position.set(0, -0.01, 0.09);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
  eye.position.set(0.04, 0.02, 0.07);
  head.add(eye);
  const eye2 = eye.clone();
  eye2.position.x = -0.04;
  head.add(eye2);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.68), wingMat);
  leftWing.position.set(-0.2, 0.29, 0.02);
  leftWing.rotation.z = 0.28;
  leftWing.castShadow = true;
  root.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.68), wingMat);
  rightWing.position.set(0.2, 0.29, 0.02);
  rightWing.rotation.z = -0.28;
  rightWing.castShadow = true;
  root.add(rightWing);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), wingMat);
  tail.position.set(0, 0.23, -0.28);
  tail.rotation.x = -Math.PI / 2.2;
  tail.castShadow = true;
  root.add(tail);

  const footGeo = new THREE.BoxGeometry(0.03, 0.04, 0.12);
  const leftFoot = new THREE.Mesh(footGeo, beakMat);
  leftFoot.position.set(-0.05, 0.03, 0.05);
  leftFoot.castShadow = true;
  root.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, beakMat);
  rightFoot.position.set(0.05, 0.03, 0.05);
  rightFoot.castShadow = true;
  root.add(rightFoot);

  world.add(root);
  return { group: root, head, leftWing, rightWing };
}

function choosePigeonTarget(pigeon, spread = 3.4) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(1.4, spread);
    const candidate = new THREE.Vector3(
      pigeon.home.x + Math.cos(angle) * distance,
      0,
      pigeon.home.z + Math.sin(angle) * distance
    );
    clampPointToWorld(candidate, 0.45);
    if (!isBlockedAt(candidate.x, candidate.z, 0.35)) {
      return candidate;
    }
  }

  return pigeon.home.clone();
}

function createPigeonEntity(x, z) {
  const visuals = createPigeon(x, z);
  const state: any = {
    name: "Pombo",
    kind: "pigeon",
    group: visuals.group,
    visuals,
    radius: 1.55,
    home: new THREE.Vector3(x, 0, z),
    target: new THREE.Vector3(x, 0, z),
    wanderTimer: 0.35 + Math.random() * 1.1,
    fleeTimer: 0,
    flapPhase: Math.random() * Math.PI * 2,
    speed: 0.92 + Math.random() * 0.34,
    mapColor: "#c4cad3",
    nearby: false
  };
  pigeons.push(state);
  return state;
}

function updatePigeon(pigeon, dt, time) {
  const playerDistance = getDistance2D(player.position, pigeon.group.position);
  const startled =
    playerDistance < 2.5 ||
    (playerVelocity.length() > 2.2 && playerDistance < 7);

  if (startled && pigeon.fleeTimer <= 0) {
    const awayX = pigeon.group.position.x - player.position.x;
    const awayZ = pigeon.group.position.z - player.position.z;
    const len = Math.hypot(awayX, awayZ) || 1;
    const fleeDistance = 4.5 + rand(0, 4.5);
    const candidate = new THREE.Vector3(
      pigeon.group.position.x + (awayX / len) * fleeDistance,
      0,
      pigeon.group.position.z + (awayZ / len) * fleeDistance
    );
    clampPointToWorld(candidate, 0.45);
    if (isBlockedAt(candidate.x, candidate.z, 0.35)) {
      candidate.copy(choosePigeonTarget(pigeon, 4.2));
    }
    pigeon.target.copy(candidate);
    pigeon.fleeTimer = 0.8 + rand(0, 0.8);
    pigeon.wanderTimer = 0.45 + rand(0, 0.9);
  }

  pigeon.flapPhase += dt * (pigeon.fleeTimer > 0 ? 14 : 4.6);

  if (pigeon.fleeTimer > 0) {
    pigeon.fleeTimer = Math.max(0, pigeon.fleeTimer - dt);
    const dx = pigeon.target.x - pigeon.group.position.x;
    const dz = pigeon.target.z - pigeon.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      pigeon.fleeTimer = 0;
      pigeon.wanderTimer = 0.35 + rand(0, 0.9);
      pigeon.target.copy(choosePigeonTarget(pigeon, 3.6));
    } else {
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const move = pigeon.speed * dt * 2.5;
      pigeon.group.position.x += dirX * move;
      pigeon.group.position.z += dirZ * move;
      pigeon.group.rotation.y = lerpAngle(pigeon.group.rotation.y, Math.atan2(dirX, dirZ), 0.32);
      pigeon.group.position.y = 0.26 + Math.sin(pigeon.flapPhase * 1.2) * 0.18;
      const flap = 0.55 + Math.max(0, Math.sin(pigeon.flapPhase)) * 0.9;
      pigeon.visuals.leftWing.rotation.z = 0.32 + flap;
      pigeon.visuals.rightWing.rotation.z = -0.32 - flap;
      pigeon.visuals.head.rotation.x = -0.12 + Math.sin(pigeon.flapPhase * 0.8) * 0.08;
      pigeon.group.rotation.x = Math.sin(pigeon.flapPhase * 0.8) * 0.18;
      return;
    }
  }

  const dx = pigeon.target.x - pigeon.group.position.x;
  const dz = pigeon.target.z - pigeon.group.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.18) {
    pigeon.wanderTimer -= dt;
    pigeon.group.position.y = THREE.MathUtils.lerp(pigeon.group.position.y, 0, 0.18);
    pigeon.visuals.leftWing.rotation.z = 0.18;
    pigeon.visuals.rightWing.rotation.z = -0.18;
    pigeon.visuals.head.rotation.x = Math.sin(time * 4 + pigeon.flapPhase) * 0.06;
    if (pigeon.wanderTimer <= 0) {
      pigeon.target.copy(choosePigeonTarget(pigeon));
      pigeon.wanderTimer = 0.5 + Math.random() * 1.1;
    }
    return;
  }

  const dirX = dx / dist;
  const dirZ = dz / dist;
  const bob = Math.max(0, Math.sin(pigeon.flapPhase));
  const move = pigeon.speed * dt * (0.48 + bob * 0.08);
  pigeon.group.position.x += dirX * move;
  pigeon.group.position.z += dirZ * move;
  pigeon.group.rotation.y = lerpAngle(pigeon.group.rotation.y, Math.atan2(dirX, dirZ), 0.2);
  pigeon.group.position.y = bob * 0.035;
  pigeon.visuals.leftWing.rotation.z = 0.14 + bob * 0.12;
  pigeon.visuals.rightWing.rotation.z = -0.14 - bob * 0.12;
  pigeon.visuals.head.rotation.x = Math.sin(time * 3.8 + pigeon.flapPhase) * 0.05;
  pigeon.group.rotation.x = bob * 0.06;
}

function pickRandomLine(npc) {
  if (!npc.lines || npc.lines.length === 0) return "...";
  if (npc.lines.length === 1) {
    npc.lastLineIndex = 0;
    return npc.lines[0];
  }
  let idx;
  do {
    idx = Math.floor(Math.random() * npc.lines.length);
  } while (idx === npc.lastLineIndex);
  npc.lastLineIndex = idx;
  return npc.lines[idx];
}

function getNpcReactionLine(npc, human, distance) {
  const nick = human?.nick || "você";
  const mood = npc.personality || "curious";
  if (mood === "shy") {
    return distance < 5
      ? `Oi, ${nick}... eu já passo depois.`
      : `Vou só observar de longe, ${nick}.`;
  }
  if (mood === "athletic") {
    return human?.speed > 5
      ? `Boa passada, ${nick}. Vamos manter o ritmo.`
      : `Se quiser acelerar, eu acompanho.`;
  }
  if (mood === "busy") {
    return `Anotado, ${nick}. Já volto pra falar.`;
  }
  if (mood === "friendly") {
    return distance < 6
      ? `Ei, ${nick}! Chegou bem na hora.`
      : `Opa, ${nick}. Passa aqui depois.`;
  }
  if (mood === "gossipy") {
    return distance < 6
      ? `Ei, ${nick}... tem coisa acontecendo ali na praça.`
      : `Se vir alguém correndo, me conta depois, ${nick}.`;
  }
  return distance < 6
    ? `Ei, ${nick}, achei você no mapa.`
    : `Percebi movimento por aqui, ${nick}.`;
}

function getNpcChatterDelay(npc) {
  const mood = npc.personality || "curious";
  if (mood === "friendly") return rand(8, 14);
  if (mood === "curious") return rand(10, 16);
  if (mood === "busy") return rand(14, 22);
  if (mood === "athletic") return rand(16, 24);
  if (mood === "shy") return rand(18, 28);
  if (mood === "gossipy") return rand(6, 12);
  return rand(12, 20);
}

function findNearestHuman(position, maxDistance = 18) {
  let best = null;
  let bestDistance = maxDistance;

  const localDistance = getDistance2D(position, player.position);
  if (localDistance <= bestDistance) {
    best = {
      id: "__local__",
      nick: localNickname,
      position: player.position,
      speed: playerVelocity.length(),
      distance: localDistance,
      isLocal: true
    };
    bestDistance = localDistance;
  }

  for (const r of remotePlayers.values()) {
    const distance = getDistance2D(position, r.group.position);
    if (distance > bestDistance) continue;
    best = {
      id: r.id,
      nick: r.nick,
      position: r.group.position,
      speed: r.speed || 0,
      distance,
      isLocal: false
    };
    bestDistance = distance;
  }

  return best;
}

function countNearbyHumans(position, maxDistance = 18) {
  let count = 0;

  if (getDistance2D(position, player.position) <= maxDistance) {
    count += 1;
  }

  for (const r of remotePlayers.values()) {
    if (getDistance2D(position, r.group.position) <= maxDistance) {
      count += 1;
    }
  }

  return count;
}

function setNpcReactionTarget(npc, human) {
  const dx = npc.group.position.x - human.position.x;
  const dz = npc.group.position.z - human.position.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;
  const style = npc.personality || "curious";

  if (style === "shy") {
    npc.moveTarget.set(
      npc.group.position.x + nx * (5.5 + rand(0, 2.2)),
      0,
      npc.group.position.z + nz * (5.5 + rand(0, 2.2))
    );
    return;
  }

  if (style === "athletic") {
    const side = rand(-1, 1) >= 0 ? 1 : -1;
    npc.moveTarget.set(
      human.position.x + nx * 1.6 + side * nz * 1.8,
      0,
      human.position.z + nz * 1.6 - side * nx * 1.8
    );
    return;
  }

  if (style === "busy") {
    npc.moveTarget.set(
      npc.home.x + rand(-2.5, 2.5),
      0,
      npc.home.z + rand(-2.5, 2.5)
    );
    return;
  }

  npc.moveTarget.set(
    human.position.x + nx * (1.8 + rand(0, 1.2)),
    0,
    human.position.z + nz * (1.8 + rand(0, 1.2))
  );
}

function createNpc(config) {
  const rig = createCharacter(config.colors);
  const npc = rig.group;
  world.add(npc);
  npc.position.set(config.start.x, 0, config.start.z);
  const home = new THREE.Vector3(config.start.x, 0, config.start.z);
  const anchors = config.path.map(({ x, z }) => new THREE.Vector3(x, 0, z));
  const id = `npc:${npcs.length}`;

  const state: any = {
    id,
    name: config.name,
    rig,
    group: npc,
    path: config.path,
    anchors,
    home,
    speed: config.speed,
    lines: config.lines,
    lastLineIndex: -1,
    previewLine: config.lines[0],
    nearby: false,
    pause: 0,
    talkCooldown: 0,
    radius: 3.2,
    phaseOffset: rand(0, Math.PI * 2),
    celebrateTimer: 0,
    mapColor: `#${config.colors.shirtColor.toString(16).padStart(6, "0")}`,
    interests: { ...(config.interests || {}) },
    state: "idle",
    stateTimer: 0.4 + rand(0, 1.4),
    moveTarget: home.clone(),
    focus: null,
    pose: null,
    lastInteraction: null,
    personality: config.personality || "curious",
    bubbleKey: `npc:${config.name}`,
    awarenessRadius: config.awarenessRadius || 18,
    reactionRadius: config.reactionRadius || 7,
    reactionCooldown: rand(0.8, 2.6),
    reactionTimer: 0,
    reactionHuman: null,
    chatterCooldown: getNpcChatterDelay(config),
    thinkRadius: config.thinkRadius || 44,
    renderRadius: config.renderRadius || 38,
    slowThinkTimer: rand(0, 0.6),
    targetX: npc.position.x,
    targetY: npc.position.y,
    targetZ: npc.position.z,
    targetRy: npc.rotation.y,
    netAnim: "idle",
    hasNetState: false,
  };
  state.previewLine = pickRandomLine(state);

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: config.colors.shirtColor, emissive: config.colors.shirtColor, emissiveIntensity: 0.15 })
  );
  marker.position.y = 2.85;
  npc.add(marker);
  state.marker = marker;
  npcById.set(id, state);
  npcs.push(state);
  return state;
}

const npcs = [];
const npcById = new Map();
const npcSync = createNpcSync();
createNpc({
  name: "Ana",
  start: { x: -2, z: 18 },
  speed: 2.1,
  personality: "friendly",
  path: [
    { x: -2, z: 18 },
    { x: 8, z: 18 },
    { x: 11, z: 9 },
    { x: 1, z: 7 }
  ],
  lines: [
    "Hoje o gramado esta bem movimentado.",
    "Se precisar, o painel ali mostra os avisos do campus.",
    "Esse banco perto da fonte e um bom ponto para descansar.",
    "Eu tava te procurando, viu? Achei que ia perder a aula.",
    "Reparou no pato la perto da fonte? Acho que ele me julga."
  ],
  interests: {
    bench: 1.3,
    fountain: 1.15,
    board: 1.2
  },
  colors: {
    shirtColor: 0x4363d8,
    pantsColor: 0x23344b,
    shoesColor: 0x202020,
    skinColor: 0xe8b992,
    hairColor: 0x1c1410,
    backpackColor: 0x7e4ab8,
    backpack: true,
    scale: 0.98
  }
});

createNpc({
  name: "Rafael",
  start: { x: 22, z: -6 },
  speed: 1.8,
  personality: "busy",
  path: [
    { x: 22, z: -6 },
    { x: 26, z: 6 },
    { x: 18, z: 17 },
    { x: 11, z: 4 }
  ],
  lines: [
    "Estou fazendo uma ronda pelo campus.",
    "A bicicleta ficou bem ali ao lado da pista.",
    "O fluxo entre os blocos fica melhor quando a rota esta livre.",
    "Se ver alguem perdido, manda pra coordenacao no bloco central.",
    "Faz tempo que nao vejo o pessoal usar a bola, da uma chutada la."
  ],
  interests: {
    bike: 1.35,
    lamp: 1.05,
    board: 1.1
  },
  colors: {
    shirtColor: 0xb85a31,
    pantsColor: 0x3a3d46,
    shoesColor: 0x202020,
    skinColor: 0xc98c62,
    hairColor: 0x2b1a0d,
    backpackColor: 0x566d54,
    backpack: false,
    scale: 1
  }
});

createNpc({
  name: "Prof. Lucia",
  start: { x: -20, z: 21 },
  speed: 1.35,
  personality: "curious",
  path: [
    { x: -20, z: 21 },
    { x: -10, z: 26 },
    { x: -5, z: 17 },
    { x: -13, z: 12 }
  ],
  lines: [
    "Passe no mural para ver os avisos mais recentes.",
    "A fonte e a area de convivio costumam ficar cheias no fim da tarde.",
    "Esse mapa ajuda a ler o espaco com mais rapidez.",
    "Hoje a turma esta agitada, deve ser o calor.",
    "Lembre de devolver o livro antes de sexta, ta?"
  ],
  interests: {
    board: 1.45,
    fountain: 1.15,
    bench: 1.05
  },
  colors: {
    shirtColor: 0x6a4c93,
    pantsColor: 0x34495e,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf1c7aa,
    hairColor: 0x5c3a22,
    backpackColor: 0x9b5e4d,
    backpack: true,
    glasses: true,
    scale: 1
  }
});

createNpc({
  name: "Bruno",
  start: { x: 30, z: 12 },
  speed: 2.55,
  personality: "athletic",
  path: [
    { x: 30, z: 12 },
    { x: 22, z: 22 },
    { x: 6, z: 30 },
    { x: 18, z: 4 }
  ],
  lines: [
    "Hoje o treino e na quadra dos fundos, depois da fonte.",
    "Quem chega cedo pega aquela sombra boa la perto do banco.",
    "Eu uso a bicicleta pra cortar caminho ate o bloco central.",
    "Topa correr um pouco comigo? So mais uma volta.",
    "O Seu Diego ja avisou pra nao pisar no gramado novo."
  ],
  interests: {
    ball: 1.45,
    bike: 1.25,
    fountain: 0.95
  },
  colors: {
    shirtColor: 0xe74c3c,
    pantsColor: 0x2c3e50,
    shoesColor: 0xf5f5f5,
    skinColor: 0xd4a07a,
    hairColor: 0x111111,
    backpackColor: 0x111111,
    backpack: false,
    scale: 1.05
  }
});

createNpc({
  name: "Camila",
  start: { x: -34, z: 12 },
  speed: 1.45,
  personality: "curious",
  path: [
    { x: -34, z: 12 },
    { x: -22, z: 6 },
    { x: -12, z: 14 },
    { x: -30, z: 22 }
  ],
  lines: [
    "A biblioteca esta com novos titulos de engenharia esta semana.",
    "Se quiser sala silenciosa, suba pro segundo andar do bloco.",
    "Os avisos do mural costumam vir direto da coordenacao.",
    "Eu gosto de ler perto da fonte no fim da tarde.",
    "Voce ja conheceu o pato? Ele tem opinioes fortes sobre fantasia."
  ],
  interests: {
    board: 1.4,
    fountain: 1.2,
    bench: 1.1
  },
  colors: {
    shirtColor: 0x16a085,
    pantsColor: 0x4a3328,
    shoesColor: 0x202020,
    skinColor: 0xefcaa6,
    hairColor: 0x261612,
    backpackColor: 0x342f1a,
    backpack: true,
    glasses: true,
    scale: 0.96
  }
});

createNpc({
  name: "Seu Diego",
  start: { x: 6, z: 36 },
  speed: 1.2,
  personality: "busy",
  path: [
    { x: 6, z: 36 },
    { x: -8, z: 34 },
    { x: -2, z: 22 },
    { x: 12, z: 28 }
  ],
  lines: [
    "Acabei de aparar essa parte do gramado, da pra sentar a vontade.",
    "Quando chove forte, o caminho do meio fica meio escorregadio.",
    "A bola sempre acaba parando perto da fonte, ja reparou?",
    "Cuidem das arvores novas que plantamos ali na bordinha.",
    "Os patos aparecem cedo, gostam do orvalho no gramado."
  ],
  interests: {
    bench: 1.25,
    fountain: 1.3,
    ball: 1.15
  },
  colors: {
    shirtColor: 0xf1c40f,
    pantsColor: 0x6b4226,
    shoesColor: 0x3d2c1c,
    skinColor: 0xb98552,
    hairColor: 0x4a3a2a,
    backpackColor: 0x6c4a2e,
    backpack: false,
    glasses: true,
    scale: 1.04
  }
});

createNpc({
  name: "Helena",
  start: { x: 14, z: -18 },
  speed: 1.55,
  personality: "friendly",
  path: [
    { x: 14, z: -18 },
    { x: 4, z: -2 },
    { x: -6, z: 4 },
    { x: 0, z: -16 }
  ],
  lines: [
    "Estou rascunhando o bloco central pra aula de artes visuais.",
    "A iluminacao no fim da tarde fica perfeita aqui na fonte.",
    "Voce ja viu o mural novo do corredor B? Vale o desvio.",
    "Topa posar pra um esboco rapido? E so um minuto.",
    "O Seu Diego me deixou desenhar os patos hoje cedo."
  ],
  interests: {
    fountain: 1.35,
    board: 1.2,
    bike: 0.95
  },
  colors: {
    shirtColor: 0xff7ab6,
    pantsColor: 0x35506b,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf4d2b8,
    hairColor: 0x7a3b1c,
    backpackColor: 0x2a3142,
    backpack: true,
    scale: 0.97
  }
});

const lucas = createNpc({
  name: "Lucas",
  start: { x: 12, z: 6 },
  speed: 5.5,
  personality: "athletic",
  path: [
    { x: 14, z: 8 },
    { x: -10, z: -4 },
    { x: -20, z: 22 },
    { x: 22, z: 18 },
    { x: 2, z: -22 }
  ],
  lines: ["Preciso terminar meu TCC!"],
  interests: {
    board: 0.4
  },
  colors: {
    shirtColor: 0x2b6cb0,
    pantsColor: 0x2a3540,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf4d2b8,
    hairColor: 0xc0461a,
    backpackColor: 0x6b3a1a,
    backpack: false,
    scale: 1
  }
});
lucas.running = true;
lucas.holdingBucket = true;
{
  const bucketGroup = new THREE.Group();
  bucketGroup.position.set(0, 1.25, 0.55);
  lucas.group.add(bucketGroup);
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.7, metalness: 0.3 });
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.24, 0.5, 16, 1, true),
    bucketMat
  );
  bucket.castShadow = true;
  bucketGroup.add(bucket);
  const bucketBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16),
    bucketMat
  );
  bucketBottom.position.y = -0.25;
  bucketGroup.add(bucketBottom);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x5fb5e6, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.9 })
  );
  water.position.y = 0.2;
  bucketGroup.add(water);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.022, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.5 })
  );
  handle.position.y = 0.26;
  handle.rotation.x = Math.PI / 2;
  bucketGroup.add(handle);
lucas.bucketGroup = bucketGroup;
}

createNpc({
  name: "Sofia",
  start: { x: -8, z: -22 },
  speed: 1.25,
  personality: "shy",
  awarenessRadius: 20,
  reactionRadius: 6,
  path: [
    { x: -8, z: -22 },
    { x: -2, z: -12 },
    { x: -12, z: -6 },
    { x: -18, z: -18 }
  ],
  lines: [
    "Eu prefiro ficar perto da mesa, mas posso me aproximar.",
    "Se o player chega correndo, eu dou espaço.",
    "O gramado está melhor quando a movimentação é leve.",
    "Tem um quiosque novo ali; vou observar de longe."
  ],
  interests: {
    table: 1.6,
    kiosk: 1.15,
    bench: 1.1
  },
  colors: {
    shirtColor: 0x7bdff2,
    pantsColor: 0x3f4c63,
    shoesColor: 0x202020,
    skinColor: 0xf0c7a7,
    hairColor: 0x3a2516,
    backpackColor: 0x5f7c8a,
    backpack: true,
    scale: 0.96
  }
});

createNpc({
  name: "Marcos",
  start: { x: 34, z: -18 },
  speed: 2.05,
  personality: "friendly",
  awarenessRadius: 22,
  reactionRadius: 8,
  path: [
    { x: 34, z: -18 },
    { x: 24, z: -4 },
    { x: 18, z: -20 },
    { x: 30, z: 8 }
  ],
  lines: [
    "Se você vier falar comigo, eu já viro na sua direção.",
    "Esse mapa é ótimo pra achar o ponto de encontro.",
    "Eu sempre paro no carrinho antes de seguir o caminho.",
    "O player correu? Então eu corro pra acompanhar."
  ],
  interests: {
    snack: 1.4,
    kiosk: 1.15,
    board: 1.05
  },
  colors: {
    shirtColor: 0x2bb673,
    pantsColor: 0x34495e,
    shoesColor: 0x1e1e1e,
    skinColor: 0xd8a272,
    hairColor: 0x111111,
    backpackColor: 0x7c4a1e,
    backpack: false,
    scale: 1
  }
});

createNpc({
  name: "Yara",
  start: { x: 18, z: 30 },
  speed: 1.7,
  personality: "busy",
  awarenessRadius: 16,
  reactionRadius: 6,
  path: [
    { x: 18, z: 30 },
    { x: 4, z: 34 },
    { x: 2, z: 20 },
    { x: 14, z: 18 }
  ],
  lines: [
    "Estou indo e voltando entre a mesa e o painel.",
    "Se eu passar perto de você, é porque estou no meu trajeto.",
    "Os novos objetos deixaram o espaço mais vivo.",
    "O player chamou atenção? Eu olho, mas continuo andando."
  ],
  interests: {
    table: 1.35,
    board: 1.25,
    fountain: 1.05
  },
  colors: {
    shirtColor: 0xff8c42,
    pantsColor: 0x2b3947,
    shoesColor: 0x111111,
    skinColor: 0xf0c1a0,
    hairColor: 0x6d3c17,
    backpackColor: 0x515151,
    backpack: true,
    scale: 0.98
  }
});

createNpc({
  name: "Tiago",
  start: { x: -28, z: -24 },
  speed: 2.3,
  personality: "athletic",
  awarenessRadius: 24,
  reactionRadius: 9,
  path: [
    { x: -28, z: -24 },
    { x: -18, z: -10 },
    { x: -4, z: -18 },
    { x: -14, z: -30 }
  ],
  lines: [
    "Se o player acelerar, eu já entro na disputa.",
    "Bora cruzar o gramado até o bicicletário.",
    "Eu reajo rápido quando alguém passa perto.",
    "A corrida só começa depois do aviso do painel."
  ],
  interests: {
    bike: 1.45,
    lamp: 1.1,
    ball: 1.35
  },
  colors: {
    shirtColor: 0xe84855,
    pantsColor: 0x263238,
    shoesColor: 0xf1f1f1,
    skinColor: 0xc99264,
    hairColor: 0x111111,
    backpackColor: 0x2f2f2f,
    backpack: false,
    scale: 1.03
  }
});

createNpc({
  name: "Nina",
  start: { x: 0, z: -10 },
  speed: 1.95,
  personality: "gossipy",
  awarenessRadius: 21,
  reactionRadius: 7,
  path: [
    { x: 0, z: -10 },
    { x: 10, z: -8 },
    { x: 14, z: 2 },
    { x: 2, z: 2 }
  ],
  lines: [
    "Eu sigo quem estiver mais ativo no gramado.",
    "Se o player passa por aqui, eu mudo a rota.",
    "Tem muito objeto novo pra explorar.",
    "A mesa e o quiosque viraram meus pontos favoritos."
  ],
  interests: {
    kiosk: 1.3,
    snack: 1.2,
    table: 1.15,
    fountain: 1.1
  },
  colors: {
    shirtColor: 0x7c5cff,
    pantsColor: 0x304050,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf1c6aa,
    hairColor: 0x261612,
    backpackColor: 0x8aa1a8,
    backpack: true,
    scale: 0.97
  }
});

createNpc({
  name: "Joana",
  start: { x: -38, z: 2 },
  speed: 1.55,
  personality: "friendly",
  awarenessRadius: 23,
  reactionRadius: 8,
  path: [
    { x: -38, z: 2 },
    { x: -28, z: 10 },
    { x: -20, z: 0 },
    { x: -30, z: -10 }
  ],
  lines: [
    "Eu gosto quando o player passa perto e aciona uma conversa.",
    "O painel de avisos ficou mais fácil de ler agora.",
    "Tem muita coisa nova no campus hoje.",
    "Se quiser companhia, eu acompanho até a mesa."
  ],
  interests: {
    board: 1.5,
    bench: 1.2,
    table: 1.25
  },
  colors: {
    shirtColor: 0x27ae60,
    pantsColor: 0x3e4a59,
    shoesColor: 0x1b1b1b,
    skinColor: 0xf0c9a6,
    hairColor: 0x4a2f17,
    backpackColor: 0x6c7f56,
    backpack: true,
    glasses: true,
    scale: 0.99
  }
});

function serializeNpcStates() {
  return npcSync.serializeNpcStates(npcs);
}

function setNpcAuthority(active) {
  npcSync.setNpcAuthority(active);
}

function applyNpcSnapshots(snapshots = []) {
  npcSync.applyNpcSnapshots(npcById, snapshots);
}

function updateNpcFromSnapshot(npc, dt, time) {
  if (!npc.hasNetState) {
    applyNpcPose(npc, time);
    return;
  }

  const lerp = Math.min(1, dt * 12);
  npc.group.position.x += (npc.targetX - npc.group.position.x) * lerp;
  npc.group.position.y += (npc.targetY - npc.group.position.y) * lerp;
  npc.group.position.z += (npc.targetZ - npc.group.position.z) * lerp;
  npc.group.rotation.y = lerpAngle(npc.group.rotation.y, npc.targetRy, lerp);

  if (npc.netAnim === "sit") {
    setSittingPose(npc.rig.refs);
    return;
  }
  if (npc.netAnim === "dance") {
    animateDance(npc.rig.refs, time + npc.phaseOffset);
    return;
  }
  if (npc.netAnim === "celebrate") {
    animateCelebrate(npc.rig.refs, time + npc.phaseOffset, 1);
    return;
  }
  if (npc.netAnim === "run") {
    const runPhase = time * (8 + npc.speed * 0.5) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 4.0, 1);
    animateRun(npc.rig.refs, runPhase, intensity);
    if (npc.holdingBucket) {
      const r = npc.rig.refs;
      r.leftShoulder.rotation.x = -1.35;
      r.rightShoulder.rotation.x = -1.35;
      r.leftShoulder.rotation.z = 0.35;
      r.rightShoulder.rotation.z = -0.35;
      r.leftElbow.rotation.x = 0.6;
      r.rightElbow.rotation.x = 0.6;
      r.torso.rotation.x = 0.22;
    }
    return;
  }
  if (npc.netAnim === "walk") {
    const walkPhase = time * (4 + npc.speed * 0.9) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 1.4, 1);
    animateWalk(npc.rig.refs, walkPhase, intensity);
    return;
  }

  setRestPose(npc.rig.refs, time, npc.phaseOffset);
}

createDuckEntity(7, 1);
createDuckEntity(4, -4);
createDuckEntity(9, -3);
createDuckEntity(-12, 30);
createDuckEntity(-2, 32);
createDuckEntity(18, 20);
createDuckEntity(-20, 20);
createPigeonEntity(4.6, -1.8);
createPigeonEntity(6.8, -3.1);
createPigeonEntity(8.5, -1.2);
createPigeonEntity(7.2, 0.8);

const devTools = createDevTools({
  scene,
  world,
  container,
  canvas,
  renderer,
  camera,
  player,
  interactables,
  npcs,
  ducks,
  pigeons,
  sharedBikes,
  clearInputState: () => keys.clear(),
  stopCameraDrag: () => cameraController.endDrag(),
  stopPlayerMotion: () => playerVelocity.set(0, 0),
});

const inputVector = new THREE.Vector2();
const cameraGroundBasis = {
  forward: new THREE.Vector2(),
  right: new THREE.Vector2(),
};
const playerWorldInput = new THREE.Vector2();
const mobileInput: MobileInput = {
  x: 0,
  y: 0,
  running: false,
};

function getInputVector() {
  const keyX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const keyZ = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  const x = THREE.MathUtils.clamp(keyX + mobileInput.x, -1, 1);
  const z = THREE.MathUtils.clamp(keyZ + mobileInput.y, -1, 1);
  return inputVector.set(x, z);
}

function setMobileInput(nextInput: MobileInputUpdate = {}) {
  if (typeof nextInput.x === "number") {
    mobileInput.x = THREE.MathUtils.clamp(nextInput.x, -1, 1);
  }
  if (typeof nextInput.y === "number") {
    mobileInput.y = THREE.MathUtils.clamp(nextInput.y, -1, 1);
  }
  if (typeof nextInput.running === "boolean") {
    mobileInput.running = nextInput.running;
  }
  if (readAmbientAudioState().enabled) ensureAmbientAudio();
}

function queueMobileInteract() {
  interactQueued = true;
  if (readAmbientAudioState().enabled) ensureAmbientAudio();
}

function queueMobileJump() {
  jumpQueued = true;
  if (readAmbientAudioState().enabled) ensureAmbientAudio();
}

function getCameraGroundBasis() {
  const forward = cameraGroundBasis.forward.set(
    player.position.x - camera.position.x,
    player.position.z - camera.position.z
  );
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, -1);
  } else {
    forward.normalize();
  }
  cameraGroundBasis.right.set(-forward.y, forward.x);
  return cameraGroundBasis;
}

const keys = new Set();
let interactQueued = false;
let jumpQueued = false;
let queuedEmoteKind = null;
const inputBindings = createGameInputBindings({
  cameraController,
  devTools,
  ensureAmbientAudio,
  isAmbientAudioEnabled: () => readAmbientAudioState().enabled,
  shouldIgnoreKeys,
  onPressKey: (code) => keys.add(code),
  onReleaseKey: (code) => keys.delete(code),
  isSwimmingPlayerControlled: () => swimmingMinigame?.isPlayerControlled() ?? false,
  queueSwimmingStroke: () => swimmingMinigame?.queueStroke(),
  queueSwimmingCancel: () => swimmingMinigame?.queueCancel(),
  isEspectroSecretActive: () => espectroEvent?.isSecretActive() ?? false,
  queueEspectroThrow: () => espectroEvent?.queueThrow(),
  onToggleCameraFocus: () => toggleCameraFocus(),
  onQueueInteract: () => {
    interactQueued = true;
  },
  onQueueJump: () => {
    jumpQueued = true;
  },
  onQueueEmote: (kind) => {
    queuedEmoteKind = kind;
  },
  onQueuePvpThrow: () => {
    if (pvpActiveMatch) queuedPvpThrow = true;
  },
  clearKeys: () => keys.clear(),
});

function syncInteractionProximityState() {
  for (const npc of npcs) {
    const inRange = getDistance2D(player.position, npc.group.position) < npc.radius;
    if (inRange && !npc.nearby) {
      npc.previewLine = pickRandomLine(npc);
    }
    npc.nearby = inRange;
  }

  for (const duck of ducks) {
    duck.nearby = getDistance2D(player.position, duck.group.position) < duck.radius;
  }
}

const playerVelocity = new THREE.Vector2();
const facing = new THREE.Vector2(0, -1);
let playerFootstepDistance = 0;
const playerRadius = 0.55;
const npcRadius = 0.48;
const worldLimit = 83;
const { isBlockedAt, clampPointToWorld } = createWorldSpatialHelpers({
  blockers,
  worldLimit,
});
const maxSpeed = 7.2;
const accel = 22;
const drag = 10;
const clock = new THREE.Clock();

function forceDismountCurrentBike() {
  const bike = playerState.ridingBike;
  if (!bike) return;
  bike.mounted = false;
  bike.group.position.set(player.position.x, 0, player.position.z);
  bike.group.rotation.x = 0;
  bike.group.rotation.y = player.rotation.y - 0.35;
  bike.facingYaw = bike.group.rotation.y;
  bike.wheelieAmount = 0;
  bike.wheelieTimer = 0;
  playerState.ridingBike = null;
  player.rotation.x = 0;
  playerVelocity.set(0, 0);
  bike.emitState?.(false);
}

function removeTreesInArea(bounds, padding = 1.6) {
  weatherSystem.removeTreesInArea(bounds, padding);
}

swimmingMinigame = createSwimmingMinigame({
  world,
  container,
  createBlocker,
  interactables,
  mapFeatures,
  player,
  playerRig,
  playerVelocity,
  speak: speechOverlay.speak,
  updatePlayerActivity,
  resetRigPose,
  isRidingBike: () => !!playerState.ridingBike,
  removeTreesInArea,
  playPoolSound: playPoolWaterSound,
  playSwimStrokeSound,
});

espectroEvent = createEspectroEvent({
  world,
  scene,
  container,
  player,
  playerVelocity,
  createCharacter,
  createNameLabel,
  disposeObject3D,
  pushBubble,
  animateWalk,
  animateRun,
  animateGlitch,
  setRestPose,
  resetRigPose: () => resetRigPose(playerRig.refs),
  forceDismount: forceDismountCurrentBike,
  canStartSecret: () => !pvpActiveMatch && !swimmingMinigame?.isActive(),
  onConsumed: onEspectroConsumed,
  onSecretDisconnect,
  playParanormalSound,
});

function clampPlayerToWorld(radius = playerRadius) {
  player.position.x = THREE.MathUtils.clamp(player.position.x, -worldLimit + radius, worldLimit - radius);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -worldLimit + radius, worldLimit - radius);
}

function resolveCollisions(axis, radius = playerRadius) {
  for (const box of blockers) {
    if (box.active === false) continue;
    const px = player.position.x;
    const pz = player.position.z;
    const minX = box.minX - radius;
    const maxX = box.maxX + radius;
    const minZ = box.minZ - radius;
    const maxZ = box.maxZ + radius;
    if (!(px > minX && px < maxX && pz > minZ && pz < maxZ)) continue;

    if (axis === "x") {
      player.position.x = px < (box.minX + box.maxX) / 2 ? minX : maxX;
      playerVelocity.x = 0;
    } else {
      player.position.z = pz < (box.minZ + box.maxZ) / 2 ? minZ : maxZ;
      playerVelocity.y = 0;
    }
  }
}

function enterSitState(target, options: SitOptions = {}) {
  playerState.sitting = true;
  playerState.sitTimer = options.duration ?? 2.6;
  playerState.sitTarget = target;
  playerState.sitLabel = options.label ?? "banco";
  playerState.sitEndMessage = options.endMessage ?? "Voce se levantou do banco.";
  playerState.sitEndSpeaker = options.endSpeaker ?? "Banco";
  playerState.sitPersistent = options.persistent === true;
}

function exitSit() {
  if (!playerState.sitting) return;
  playerState.sitting = false;
  playerState.sitTarget = null;
  playerState.sitLabel = "";
  playerState.sitEndMessage = "";
  playerState.sitEndSpeaker = "Banco";
  playerState.sitPersistent = false;
  playerState.sitTimer = 0;
}

function applyBikeRidePose(refs, pedalPhase, intensity = 1, steering = 0, wheelie = 0) {
  const lean = steering * 0.16;
  refs.leftShoulder.rotation.x = -0.72 + wheelie * 0.24;
  refs.rightShoulder.rotation.x = -0.72 + wheelie * 0.24;
  refs.leftShoulder.rotation.z = 0.08 + lean;
  refs.rightShoulder.rotation.z = -0.08 + lean;
  refs.leftElbow.rotation.x = 0.58 - steering * 0.08 + wheelie * 0.16;
  refs.rightElbow.rotation.x = 0.58 + steering * 0.08 + wheelie * 0.16;
  refs.leftElbow.rotation.z = 0.05;
  refs.rightElbow.rotation.z = -0.05;

  const pedal = Math.sin(pedalPhase) * 0.72 * intensity;
  const oppositePedal = Math.sin(pedalPhase + Math.PI) * 0.72 * intensity;
  refs.leftHip.rotation.x = -1.1 + pedal * 0.52;
  refs.rightHip.rotation.x = -1.1 + oppositePedal * 0.52;
  refs.leftKnee.rotation.x = 1.42 + Math.max(0, -pedal) * 0.68;
  refs.rightKnee.rotation.x = 1.42 + Math.max(0, -oppositePedal) * 0.68;
  refs.torso.rotation.x = 0.14 - wheelie * 0.22;
  refs.torso.rotation.y = lean;
  refs.head.rotation.x = -0.06 + wheelie * 0.12;
  refs.head.rotation.y = steering * 0.12;
}

function updatePlayer(dt, time) {
  if (swimmingMinigame?.isPlayerControlled()) {
    interactQueued = false;
    jumpQueued = false;
    queuedEmoteKind = null;
    playerState.jumping = false;
    playerState.jumpY = 0;
    playerState.jumpVel = 0;
    swimmingMinigame.updatePlayer(dt, time);
    return;
  }

  if (playerState.sitting) {
    interactQueued = false;
    playerFootstepDistance = 0;
    updatePlayerActivity({
      kind: "sitting",
      label: "sentado",
      detail: `no ${playerState.sitLabel || "banco"}`
    });
    if (!playerState.sitPersistent) playerState.sitTimer -= dt;
    if (playerState.sitTarget) {
      const target = playerState.sitTarget;
      const t = 0.12;
      player.position.x += (target.position.x - player.position.x) * t;
      player.position.z += (target.position.z - player.position.z) * t;
      // Y eh snapado direto: o bloco superior adiciona playerFloorY depois,
      // e lerpar o Y junto com X/Z faz o valor divergir no andar superior.
      player.position.y = target.position.y;
      player.rotation.y = lerpAngle(player.rotation.y, target.rotation, t);
    }
    if (!playerState.sitPersistent && playerState.sitTimer <= 0) {
      playerState.sitting = false;
      playerState.sitTarget = null;
      speechOverlay.speak(playerState.sitEndMessage || "Voce se levantou.", playerState.sitEndSpeaker || "Banco");
      playerState.sitLabel = "";
      playerState.sitEndMessage = "";
      playerState.sitEndSpeaker = "Banco";
    }
    setSittingPose(playerRig.refs);
    return;
  }

  const mountedBike = playerState.ridingBike;
  if (mountedBike) {
    if (queuedEmoteKind) queuedEmoteKind = null;
    const wheelieQueued = jumpQueued || keys.has("Space");
    jumpQueued = false;
    playerState.jumping = false;
    playerState.jumpVel = 0;
    playerState.jumpY = 0;

    const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight") || mobileInput.running;
    const input = getInputVector();
    const moving = input.lengthSq() > 0;
    const isBoosting = shiftHeld && moving;
    const speedBeforeMove = playerVelocity.length();
    const wheelieRequested = wheelieQueued && speedBeforeMove > 3.8;
    if (wheelieRequested) {
      mountedBike.wheelieTimer = Math.max(mountedBike.wheelieTimer, keys.has("Space") ? 0.18 : 0.9);
    }
    updatePlayerActivity({
      kind: "riding",
      label: mountedBike.wheelieAmount > 0.22 || wheelieRequested ? "dando grau" : "pedalando",
      detail: mountedBike.wheelieAmount > 0.22 || wheelieRequested
        ? "levantando a roda da frente"
        : isBoosting ? "acelerando na bicicleta" : moving ? "rodando pelo campus" : "equilibrando a bicicleta",
    });

    const targetMaxSpeed = moving ? (isBoosting ? 18.5 : 12.8) : 0;
    const targetAccel = isBoosting ? 30 : 22;
    const bikeDrag = moving ? 0.985 : Math.max(0, 1 - drag * 1.35 * dt);
    const cameraBasis = getCameraGroundBasis();

    if (moving) {
      input.normalize();
      const worldInput = playerWorldInput.set(0, 0)
        .addScaledVector(cameraBasis.right, input.x)
        .addScaledVector(cameraBasis.forward, -input.y);
      if (worldInput.lengthSq() > 0.0001) {
        worldInput.normalize();
        playerVelocity.addScaledVector(worldInput, targetAccel * dt);
        facing.copy(worldInput);
      }
    } else {
      playerVelocity.multiplyScalar(bikeDrag);
    }

    const speed = playerVelocity.length();
    if (targetMaxSpeed > 0 && speed > targetMaxSpeed) {
      playerVelocity.setLength(targetMaxSpeed);
    }
    mountedBike.wheelieTimer = Math.max(0, mountedBike.wheelieTimer - dt);
    const wheelieSpeedFactor = THREE.MathUtils.clamp((speed - 3.2) / 7.5, 0, 1);
    const targetWheelie = mountedBike.wheelieTimer > 0 ? wheelieSpeedFactor : 0;
    mountedBike.wheelieAmount = THREE.MathUtils.lerp(
      mountedBike.wheelieAmount,
      targetWheelie,
      Math.min(1, dt * (targetWheelie > 0 ? 7.5 : 5.2))
    );
    if (mountedBike.wheelieAmount > 0.15) {
      playerVelocity.multiplyScalar(1 - mountedBike.wheelieAmount * 0.24 * dt);
    }

    const collisionRadius = 0.82;
    const prevBikeX = player.position.x;
    const prevBikeZ = player.position.z;
    player.position.x += playerVelocity.x * dt;
    resolveCollisions("x", collisionRadius);
    player.position.z += playerVelocity.y * dt;
    resolveCollisions("z", collisionRadius);
    clampPlayerToWorld(collisionRadius);
    if (swimmingMinigame?.rejectBikeEntry(player.position)) {
      player.position.x = prevBikeX;
      player.position.z = prevBikeZ;
      playerVelocity.set(0, 0);
      mountedBike.wheelieTimer = 0;
      mountedBike.wheelieAmount = 0;
    }

    if (facing.lengthSq() > 0.001) {
      const angle = Math.atan2(facing.x, facing.y);
      player.rotation.y = lerpAngle(player.rotation.y, angle, 0.14);
    }

    mountedBike.wheelSpin += speed * dt / Math.max(0.2, mountedBike.wheelRadius);
    mountedBike.pedalPhase += speed * dt * 0.95;
    const wheelieAngle = mountedBike.wheelieAmount * 0.52;
    const wheelieLift = Math.sin(wheelieAngle) * 0.86;
    mountedBike.group.position.set(player.position.x, wheelieLift, player.position.z);
    mountedBike.group.rotation.x = -wheelieAngle;
    mountedBike.group.rotation.y = player.rotation.y;
    for (const wheel of mountedBike.wheels) {
      wheel.rotation.x = mountedBike.wheelSpin;
    }
    mountedBike.crank.rotation.x = mountedBike.pedalPhase;

    const steering = THREE.MathUtils.clamp(playerVelocity.length() > 0.1 ? playerVelocity.x * 0.05 : 0, -1, 1);
    applyBikeRidePose(playerRig.refs, mountedBike.pedalPhase, Math.min(speed / 10, 1), steering, mountedBike.wheelieAmount);
    player.rotation.x = -mountedBike.wheelieAmount * 0.28;
    player.position.y = 0.18 + wheelieLift + Math.abs(Math.sin(mountedBike.pedalPhase)) * 0.02 * Math.min(speed / 9, 1);
    playerFootstepDistance = 0;
    return;
  }
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, 0, Math.min(1, dt * 9));

  if (queuedEmoteKind) {
    const queuedDuration =
      queuedEmoteKind === "dance" ? 8.0 :
      queuedEmoteKind === "glitch" ? 2.2 :
      queuedEmoteKind === "cheer" ? 3.2 :
      queuedEmoteKind === "sixseven" ? 3.4 :
      2.4;
    triggerLocalEmote(queuedEmoteKind, queuedDuration);
  }
  queuedEmoteKind = null;

  if (playerState.glitchTimer > 0) {
    playerState.glitchTimer -= dt;
    updatePlayerActivity({
      kind: "emoting",
      label: "bugando",
      detail: "desmaiando no lag do campus"
    });
    playerVelocity.set(0, 0);
    playerFootstepDistance = 0;
    setRestPose(playerRig.refs, time, playerState.glitchSeed || 0);
    animateGlitch(playerRig.refs, time, 1, playerState.glitchSeed || 0);
    player.position.y = playerState.jumpY + Math.sin(time * 14 + (playerState.glitchSeed || 0)) * 0.06;
    if (playerState.glitchTimer <= 0) {
      resetRigPose(playerRig.refs);
    }
    return;
  }

  if (playerState.celebrateTimer > 0) {
    playerState.celebrateTimer -= dt;
    updatePlayerActivity({
      kind: "emoting",
      label: "comemorando",
      detail: "soltando um caos feliz"
    });
    playerVelocity.set(0, 0);
    playerFootstepDistance = 0;
    animateCelebrate(playerRig.refs, time + (playerState.celebrateSeed || 0), 1);
    player.position.y = playerState.jumpY + Math.abs(Math.sin((time + (playerState.celebrateSeed || 0)) * 9)) * 0.08;
    if (playerState.celebrateTimer <= 0) {
      resetRigPose(playerRig.refs);
    }
    return;
  }

  if (playerState.sixSevenTimer > 0) {
    const moveCheck = getInputVector();
    if (moveCheck.lengthSq() > 0) {
      playerState.sixSevenTimer = 0;
      resetRigPose(playerRig.refs);
      broadcastEmote?.("stop", 0);
      playerFootstepDistance = 0;
    } else {
      playerState.sixSevenTimer -= dt;
      updatePlayerActivity({
        kind: "emoting",
        label: "67",
        detail: "balançando os braços no seis sete"
      });
      playerVelocity.set(0, 0);
      playerFootstepDistance = 0;
      animateSixSeven(playerRig.refs, time, playerState.sixSevenSeed || 0);
      player.position.y = playerState.jumpY + Math.abs(Math.sin((time + (playerState.sixSevenSeed || 0)) * 4.8)) * 0.025;
      if (playerState.sixSevenTimer <= 0) {
        resetRigPose(playerRig.refs);
      }
      return;
    }
  }

  if (playerState.dancing) {
    updatePlayerActivity({
      kind: "emoting",
      label: "dançando",
      detail: "em emote"
    });
    const moveCheck = getInputVector();
    if (moveCheck.lengthSq() > 0) {
      playerState.dancing = false;
      resetRigPose(playerRig.refs);
      broadcastEmote?.("stop", 0);
      playerFootstepDistance = 0;
    } else {
      playerState.danceTimer -= dt;
      playerVelocity.set(0, 0);
      playerFootstepDistance = 0;
      animateDance(playerRig.refs, time);
      player.position.y = playerState.jumpY + Math.abs(Math.sin(time * 8)) * 0.08;
      if (playerState.danceTimer <= 0) {
        playerState.dancing = false;
        resetRigPose(playerRig.refs);
      }
      return;
    }
  }

  const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight") || mobileInput.running;
  const input = getInputVector();
  const moving = input.lengthSq() > 0;
  const isCrouching = shiftHeld && !moving;
  const isRunning = shiftHeld && moving;
  updatePlayerActivity({
    kind: isRunning ? "running" : isCrouching ? "crouching" : moving ? "walking" : "idle",
    label: isRunning ? "correndo" : isCrouching ? "agachado" : moving ? "andando" : "parado",
    detail: isRunning ? "acelerando pelo campus" : isCrouching ? "bem baixinho" : moving ? "explorando o gramado" : "observando o campus"
  });
  const targetMaxSpeed = isCrouching ? 2.4 : isRunning ? 12.5 : maxSpeed;
  const targetAccel = isRunning ? accel * 1.6 : accel;
  const cameraBasis = getCameraGroundBasis();

  if (jumpQueued && !playerState.jumping && !isCrouching) {
    playerState.jumping = true;
    playerState.jumpVel = 8.2;
  }
  jumpQueued = false;

  if (moving) {
    input.normalize();
    const worldInput = playerWorldInput.set(0, 0)
      .addScaledVector(cameraBasis.right, input.x)
      .addScaledVector(cameraBasis.forward, -input.y);
    if (worldInput.lengthSq() > 0.0001) {
      worldInput.normalize();
      playerVelocity.addScaledVector(worldInput, targetAccel * dt);
      facing.copy(worldInput);
    }
  } else {
    const decay = Math.max(0, 1 - drag * dt);
    playerVelocity.multiplyScalar(decay);
  }

  const speed = playerVelocity.length();
  if (speed > targetMaxSpeed) playerVelocity.setLength(targetMaxSpeed);

  player.position.x += playerVelocity.x * dt;
  resolveCollisions("x");
  player.position.z += playerVelocity.y * dt;
  resolveCollisions("z");
  clampPlayerToWorld();
  if (pvpActiveMatch) {
    const margin = 0.9;
    player.position.x = THREE.MathUtils.clamp(player.position.x, ARENA_CX - ARENA_W / 2 + margin, ARENA_CX + ARENA_W / 2 - margin);
    player.position.z = THREE.MathUtils.clamp(player.position.z, ARENA_CZ - ARENA_D / 2 + margin, ARENA_CZ + ARENA_D / 2 - margin);
  }

  const grounded = !playerState.jumping;
  const surface = getCampusSurfaceAt(player.position.x, player.position.z);
  if (!moving || isCrouching || !grounded || speed < 0.9) {
    playerFootstepDistance = 0;
  } else {
    playerFootstepDistance += speed * dt;
    const stepSpacing = isRunning ? 1.25 : 1.95;
    if (playerFootstepDistance >= stepSpacing) {
      playerFootstepDistance %= stepSpacing;
      playFootstepSound(surface, isRunning);
    }
  }

  if (facing.lengthSq() > 0.001) {
    const angle = Math.atan2(facing.x, facing.y);
    player.rotation.y = lerpAngle(player.rotation.y, angle, 0.16);
  }

  if (playerState.jumping) {
    playerState.jumpVel -= 22 * dt;
    playerState.jumpY += playerState.jumpVel * dt;
    if (playerState.jumpY <= 0) {
      playerState.jumpY = 0;
      playerState.jumpVel = 0;
      playerState.jumping = false;
    }
  }

  const speedRef = isRunning ? 12.5 : maxSpeed;
  const intensity = Math.min(speed / speedRef, 1);

  if (isCrouching) {
    setCrouchPose(playerRig.refs, time, 1);
    player.position.y = playerState.jumpY - 0.22;
  } else if (intensity > 0.06) {
    const walkPhase = time * (isRunning ? 9.5 : 5.5) + speed * 0.6;
    if (isRunning) animateRun(playerRig.refs, walkPhase, intensity);
    else animateWalk(playerRig.refs, walkPhase, intensity);
    player.position.y = playerState.jumpY + Math.abs(Math.sin(walkPhase)) * 0.05 * intensity;
  } else {
    setRestPose(playerRig.refs, time);
    player.position.y = playerState.jumpY + Math.sin(time * 1.6) * 0.012;
  }
}

function refreshCameraFrustum() {
  camera.updateMatrixWorld();
  cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  cameraFrustum.setFromProjectionMatrix(cameraMatrix);
}

function isWithinCamera(entity, radius, maxDistance, positionOverride = null) {
  const position = positionOverride || entity.position;
  const dx = position.x - player.position.x;
  const dz = position.z - player.position.z;
  if (dx * dx + dz * dz > maxDistance * maxDistance) return false;

  tempSphere.center.set(position.x, position.y ?? 0, position.z);
  tempSphere.radius = radius;
  return cameraFrustum.intersectsSphere(tempSphere);
}

function updateRenderableVisibility(entity, radius, maxDistance, positionOverride = null) {
  if (devTools.isEnabled()) {
    if (entity.visible !== true) entity.visible = true;
    return true;
  }
  const visible = isWithinCamera(entity, radius, maxDistance, positionOverride);
  if (entity.visible !== visible) entity.visible = visible;
  return visible;
}

function setNpcRestState(npc, time) {
  setRestPose(npc.rig.refs, time, npc.phaseOffset);
  npc.group.position.y = Math.sin(time * 1.6 + npc.phaseOffset) * 0.012;
}

function applyNpcPose(npc, time) {
  if (npc.pose?.type === "sit") {
    npc.group.position.lerp(npc.pose.position, 0.12);
    npc.group.rotation.y = lerpAngle(npc.group.rotation.y, npc.pose.rotation, 0.12);
    npc.group.position.y = 0;
    setSittingPose(npc.rig.refs);
    return;
  }
  setNpcRestState(npc, time);
}

function applyNpcAttention(npc, human, time) {
  if (!human || npc.dancing || npc.pause > 0) return;

  const distance = human.distance ?? getDistance2D(npc.group.position, human.position);
  const closeness = THREE.MathUtils.clamp(1 - distance / (npc.awarenessRadius * 1.15), 0, 1);
  if (closeness <= 0) return;

  const refs = npc.rig.refs;
  const dx = human.position.x - npc.group.position.x;
  const dz = human.position.z - npc.group.position.z;
  const targetYaw = Math.atan2(dx, dz);
  const yawOffset = THREE.MathUtils.clamp(targetYaw - npc.group.rotation.y, -0.75, 0.75);
  const lookStrength = closeness * (npc.state === "interact" ? 0.85 : npc.state === "react" ? 1 : 0.7);

  refs.torso.rotation.y += yawOffset * 0.08 * lookStrength;
  refs.head.rotation.y += yawOffset * 0.22 * lookStrength;
  refs.head.rotation.x += THREE.MathUtils.clamp(0.16 - distance * 0.01, -0.14, 0.14) * lookStrength;
  refs.head.rotation.z += Math.sin(time * 2.8 + npc.phaseOffset) * 0.015 * lookStrength;
}

function pickNpcWanderTarget(npc) {
  const anchors = npc.anchors.length ? npc.anchors : [npc.home];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const anchor = anchors[Math.floor(rand(0, anchors.length))];
    const angle = rand(0, Math.PI * 2);
    const distance = rand(2.4, 8.6);
    const candidate = new THREE.Vector3(
      anchor.x + Math.cos(angle) * distance,
      0,
      anchor.z + Math.sin(angle) * distance
    );
    clampPointToWorld(candidate, npcRadius);
    if (!isBlockedAt(candidate.x, candidate.z, npcRadius)) {
      return candidate;
    }
  }

  for (const anchor of anchors) {
    if (!isBlockedAt(anchor.x, anchor.z, npcRadius)) {
      return anchor.clone();
    }
  }

  return npc.home.clone();
}

function isInteractableAvailableForPlayer(item) {
  return item?.isDisabledForPlayer?.() !== true;
}

function isInteractableAvailableForNpc(item) {
  return item?.npcDisabled?.() !== true;
}

function pickNpcInteractable(npc) {
  const baseInterest = {
    bench: 1.1,
    fountain: 1.05,
    board: 1,
    ball: 0.95,
    bike: 0.75,
    lamp: 0.45,
    snack: 1.08,
    table: 1.18,
    kiosk: 0.82,
    bus: 0.12
  };
  const candidates = [];

  for (const item of interactables) {
    if (!isInteractableAvailableForNpc(item)) continue;
    if (item.kind === "bus") continue;
    const distance = getDistance2D(npc.group.position, item.position);
    if (distance > 30) continue;

    const itemInterest = baseInterest[item.kind] ?? 0.75;
    const personalInterest = npc.interests[item.kind] ?? 1;
    const distanceBonus = 1 - Math.min(distance / 24, 1);
    const noveltyPenalty = npc.lastInteraction === item ? 0.3 : 0;
    const score =
      itemInterest * personalInterest +
      distanceBonus * 0.85 +
      rand(-0.16, 0.22) -
      noveltyPenalty;

    if (score > 0.94) {
      candidates.push({ item, score });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].item;
}

function getNpcApproachPoint(npc, item) {
  if (item.npcApproachPosition) {
    return item.npcApproachPosition.clone();
  }

  const approachRadius = item.npcApproachRadius ?? Math.max(0.9, item.radius * 0.55);
  let baseAngle = Math.atan2(
    npc.group.position.z - item.position.z,
    npc.group.position.x - item.position.x
  );
  if (!Number.isFinite(baseAngle)) {
    baseAngle = rand(0, Math.PI * 2);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const offset = attempt === 0 ? 0 : rand(-1.25, 1.25);
    const angle = baseAngle + offset;
    const candidate = new THREE.Vector3(
      item.position.x + Math.cos(angle) * approachRadius,
      0,
      item.position.z + Math.sin(angle) * approachRadius
    );
    clampPointToWorld(candidate, npcRadius);
    if (!isBlockedAt(candidate.x, candidate.z, npcRadius)) {
      return candidate;
    }
  }

  return pickNpcWanderTarget(npc);
}

function enterNpcIdle(npc, min = 0.35, max = 1.3) {
  npc.state = "idle";
  npc.stateTimer = min + rand(0, Math.max(0.05, max - min));
  npc.focus = null;
  npc.pose = null;
}

function chooseNextNpcAction(npc) {
  npc.pose = null;

  const interactChance =
    npc.personality === "busy"
      ? 0.72
      : npc.personality === "friendly" || npc.personality === "gossipy"
        ? 0.66
        : 0.58;
  if (rand(0, 1) < interactChance) {
    const focus = pickNpcInteractable(npc);
    if (focus) {
      npc.state = "approach";
      npc.focus = focus;
      npc.stateTimer = 5.5 + rand(0, 3.2);
      npc.moveTarget.copy(getNpcApproachPoint(npc, focus));
      return;
    }
  }

  npc.state = "wander";
  npc.focus = null;
  npc.stateTimer = 4 + rand(0, 3.8);
  npc.moveTarget.copy(pickNpcWanderTarget(npc));
}

function moveNpcTowards(npc, target, dt, time, arrivalRadius = 0.3) {
  const dx = target.x - npc.group.position.x;
  const dz = target.z - npc.group.position.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= arrivalRadius) {
    setNpcRestState(npc, time);
    return "reached";
  }

  const dirX = dx / distance;
  const dirZ = dz / distance;
  const speedBoost = npc.state === "react" ? 1.28 : npc.running ? 1.18 : 1.08;
  const step = Math.min(distance - arrivalRadius, npc.speed * speedBoost * dt);
  const nextX = npc.group.position.x + dirX * step;
  const nextZ = npc.group.position.z + dirZ * step;

  let moved = false;
  if (!isBlockedAt(nextX, nextZ, npcRadius)) {
    npc.group.position.x = nextX;
    npc.group.position.z = nextZ;
    moved = true;
  } else if (!isBlockedAt(nextX, npc.group.position.z, npcRadius)) {
    npc.group.position.x = nextX;
    moved = true;
  } else if (!isBlockedAt(npc.group.position.x, nextZ, npcRadius)) {
    npc.group.position.z = nextZ;
    moved = true;
  }

  if (!moved) {
    setNpcRestState(npc, time);
    return "blocked";
  }

  npc.group.rotation.y = lerpAngle(npc.group.rotation.y, Math.atan2(dirX, dirZ), 0.18);

  if (npc.running) {
    const walkPhase = time * (8 + npc.speed * 0.5) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 4.0, 1);
    animateRun(npc.rig.refs, walkPhase, intensity);
    if (npc.holdingBucket) {
      const r = npc.rig.refs;
      r.leftShoulder.rotation.x = -1.35;
      r.rightShoulder.rotation.x = -1.35;
      r.leftShoulder.rotation.z = 0.35;
      r.rightShoulder.rotation.z = -0.35;
      r.leftElbow.rotation.x = 0.6;
      r.rightElbow.rotation.x = 0.6;
      r.torso.rotation.x = 0.22;
    }
    npc.group.position.y = Math.abs(Math.sin(walkPhase)) * 0.06 * intensity;
  } else {
    const walkPhase = time * (4 + npc.speed * 0.9) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 1.4, 1);
    animateWalk(npc.rig.refs, walkPhase, intensity);
    npc.group.position.y = Math.abs(Math.sin(walkPhase)) * 0.035 * intensity;
  }

  return distance - step <= arrivalRadius + 0.02 ? "reached" : "moving";
}

function toggleCameraFocus() {
  if (cameraController.mode !== "orbit") return;
  if (cameraController.focusTarget) {
    cameraController.clearFocus();
    return;
  }

  const target = getNearestCameraFocusTarget(player.position, remotePlayers.values(), interactables, isInteractableAvailableForPlayer);
  if (target) cameraController.setFocus(target);
}

function updateNpc(npc, dt, time) {
  npc.talkCooldown = Math.max(0, npc.talkCooldown - dt);
  npc.reactionCooldown = Math.max(0, npc.reactionCooldown - dt);
  npc.chatterCooldown = Math.max(0, npc.chatterCooldown - dt);
  npc.slowThinkTimer = Math.max(0, npc.slowThinkTimer - dt);
  const playerDistance = getDistance2D(player.position, npc.group.position);
  const human = findNearestHuman(npc.group.position, npc.awarenessRadius);

  if (
    playerDistance > npc.thinkRadius &&
    npc.state === "idle" &&
    npc.pause <= 0 &&
    !npc.dancing
  ) {
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);
    if (npc.slowThinkTimer > 0) return;
    npc.slowThinkTimer = 0.18 + rand(0, 0.25);
  }

  if (
    human &&
    npc.reactionCooldown <= 0 &&
    npc.state !== "interact" &&
    npc.state !== "approach"
  ) {
    const shouldReact =
      human.distance <= npc.reactionRadius ||
      (human.speed > 5 && human.distance <= npc.awarenessRadius * 0.9) ||
      (npc.personality === "friendly" && human.distance <= npc.reactionRadius + 2) ||
      (npc.personality === "curious" && human.distance <= npc.reactionRadius + 3) ||
      (npc.personality === "gossipy" && human.distance <= npc.reactionRadius + 3);

    if (shouldReact) {
      npc.state = "react";
      npc.reactionTimer = 0.85 + rand(0, 0.95);
      npc.reactionHuman = human;
      npc.focus = null;
      npc.pose = null;
      npc.reactionCooldown = 1.8 + rand(0, 1.8);
      setNpcReactionTarget(npc, human);
    }
  }

  if (npc.dancing && npc.danceTimer > 0) {
    npc.danceTimer -= dt;
    animateDance(npc.rig.refs, time + npc.phaseOffset);
    npc.group.position.y = Math.abs(Math.sin((time + npc.phaseOffset) * 8)) * 0.06;
    if (npc.danceTimer <= 0) {
      npc.dancing = false;
      resetRigPose(npc.rig.refs);
      npc.pause = 0.4;
    }
    return;
  }

  if (npc.celebrateTimer && npc.celebrateTimer > 0) {
    npc.celebrateTimer -= dt;
    animateCelebrate(npc.rig.refs, time + npc.phaseOffset, 1);
    npc.group.position.y = Math.abs(Math.sin((time + npc.phaseOffset) * 9)) * 0.08;
    if (npc.celebrateTimer <= 0) {
      resetRigPose(npc.rig.refs);
      npc.pause = 0.35;
    }
    return;
  }

  if (npc.state === "react") {
    npc.reactionTimer -= dt;
    const currentHuman = findNearestHuman(npc.group.position, npc.awarenessRadius);
    if (!currentHuman) {
      enterNpcIdle(npc, 0.2, 0.7);
      npc.reactionHuman = null;
      return;
    }

    npc.reactionHuman = currentHuman;
    setNpcReactionTarget(npc, currentHuman);
    const chase = npc.personality === "athletic" ? 1.35 : 1.05;
    const result = moveNpcTowards(npc, npc.moveTarget, dt * chase, time, 0.32);

    npc.group.rotation.y = lerpAngle(
      npc.group.rotation.y,
      Math.atan2(
        currentHuman.position.x - npc.group.position.x,
        currentHuman.position.z - npc.group.position.z
      ),
      0.16
    );

    if (result === "blocked") {
      setNpcReactionTarget(npc, currentHuman);
    }

    applyNpcAttention(npc, currentHuman, time);
    if (npc.reactionTimer <= 0 || currentHuman.distance > npc.awarenessRadius * 1.15) {
      enterNpcIdle(npc, 0.25, 0.9);
      npc.reactionHuman = null;
    }
    return;
  }

  if (npc.pause > 0) {
    npc.pause -= dt;
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);
    return;
  }

  if (npc.state === "idle") {
    if (npc.running && npc.stateTimer > 0.15) npc.stateTimer = 0.15;
    npc.stateTimer -= dt;
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);
    if (npc.stateTimer <= 0) {
      if (npc.running) {
        npc.state = "wander";
        npc.stateTimer = 4 + rand(0, 2);
        npc.moveTarget.copy(pickNpcWanderTarget(npc));
      } else {
        chooseNextNpcAction(npc);
      }
    }
    return;
  }

  if (npc.state === "wander") {
    npc.stateTimer -= dt;
    const result = moveNpcTowards(npc, npc.moveTarget, dt, time, 0.26);
    applyNpcAttention(npc, human, time);
    if (result === "reached") {
      enterNpcIdle(npc, 0.25, 1);
    } else if (result === "blocked") {
      npc.moveTarget.copy(pickNpcWanderTarget(npc));
      npc.stateTimer = Math.max(npc.stateTimer, 1.1);
    } else if (npc.stateTimer <= 0) {
      enterNpcIdle(npc, 0.25, 0.8);
    }
    return;
  }

  if (npc.state === "approach") {
    npc.stateTimer -= dt;

    if (!npc.focus) {
      enterNpcIdle(npc, 0.2, 0.8);
      return;
    }

    if (
      npc.focus.kind === "ball" ||
      !npc.focus.npcApproachPosition &&
      getDistance2D(npc.moveTarget, npc.focus.position) > npc.focus.npcApproachRadius + 0.35
    ) {
      npc.moveTarget.copy(getNpcApproachPoint(npc, npc.focus));
    }

    const result = moveNpcTowards(npc, npc.moveTarget, dt, time, 0.26);
    applyNpcAttention(npc, human, time);
    if (result === "reached") {
      npc.state = "interact";
      npc.stateTimer = npc.focus.npcDuration ?? 1.2;
      npc.lastInteraction = npc.focus;
      npc.focus.npcInteract?.(npc);
    } else if (result === "blocked") {
      npc.moveTarget.copy(getNpcApproachPoint(npc, npc.focus));
      npc.stateTimer -= dt * 1.5;
    }

    if (npc.stateTimer <= 0) {
      enterNpcIdle(npc, 0.3, 1.1);
    }
    return;
  }

  if (npc.state === "interact") {
    npc.stateTimer -= dt;
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);

    if (!npc.pose && npc.focus?.position) {
      const lookX = npc.focus.position.x - npc.group.position.x;
      const lookZ = npc.focus.position.z - npc.group.position.z;
      if (lookX * lookX + lookZ * lookZ > 0.001) {
        npc.group.rotation.y = lerpAngle(
          npc.group.rotation.y,
          Math.atan2(lookX, lookZ),
          0.14
        );
      }
    }

    if (npc.stateTimer <= 0) {
      enterNpcIdle(npc, 0.5, 1.5);
    }
    return;
  }

  enterNpcIdle(npc, 0.35, 1.1);
}

function updateInteractionUI() {
  if (playerState.sitting) {
    const rideLabel = playerState.sitLabel || "banco";
    if (playerState.sitPersistent) {
      speechOverlay.setStatus(`Sentado na ${rideLabel} • clique em "Sair da mesa" pra levantar.`);
    } else {
      speechOverlay.setStatus(`No ${rideLabel} • faltam ${formatSeconds(playerState.sitTimer)} para descer.`);
    }
    speechOverlay.clearSpeech();
    return;
  }

  syncInteractionProximityState();

  const target = getNearestTarget(player.position, npcs, ducks, interactables, isInteractableAvailableForPlayer);
  if (!target) {
    if (playerState.ridingBike) {
      speechOverlay.setStatus(getRidingBikeStatus());
      speechOverlay.clearSpeech();
      return;
    }
    speechOverlay.setStatus(
      getNoTargetStatus(
        currentAtmosphereState,
        getNearestInteractable(player.position, interactables, isInteractableAvailableForPlayer)
      )
    );
    speechOverlay.clearSpeech();
    return;
  }

  if (target.lines) {
    if (speechEl && speechEl.dataset.locked !== "1") {
      speechOverlay.showSpeech(target.previewLine, target.name, "[E] falar");
    }
    return;
  }

  if (target.kind === "poker-seat") {
    if (speechEl && speechEl.dataset.locked !== "1") {
      speechOverlay.showSpeech(
        "Sentar na mesa de pôquer",
        target.label || "Mesa de pôquer",
        "[E] sentar",
      );
    }
    return;
  }

  speechOverlay.setStatus(getTargetStatus(player.position, target));
  speechOverlay.clearSpeech();
}

function syncEntityVisibility() {
  for (const npc of npcs) {
    updateRenderableVisibility(npc.group, 1.8, Math.min(npc.renderRadius, ENTITY_CULL_DIST.npc));
  }
  for (const duck of ducks) {
    updateRenderableVisibility(duck.group, 1.4, ENTITY_CULL_DIST.duck);
  }
  for (const pigeon of pigeons) {
    updateRenderableVisibility(pigeon.group, 1.0, ENTITY_CULL_DIST.pigeon);
  }
  for (const bus of buses) {
    updateRenderableVisibility(bus.group, 2.4, ENTITY_CULL_DIST.bus);
  }
  for (const item of interactables) {
    updateRenderableVisibility(
      item.root || item.group || item,
      item.cullRadius ?? 2.2,
      item.cullDistance ?? ENTITY_CULL_DIST.interactable,
      item.cullPosition || item.position
    );
  }
  for (const r of remotePlayers.values()) {
    updateRenderableVisibility(r.group, 1.8, ENTITY_CULL_DIST.remote);
  }
}

function handleInteraction() {
  if (!interactQueued) return;
  interactQueued = false;
  if (playerState.sitting) return;
  const target = getNearestTarget(player.position, npcs, ducks, interactables, isInteractableAvailableForPlayer);
  if (!target) {
    if (playerState.ridingBike?.mounted) {
      playerState.ridingBike.dismount?.();
    }
    return;
  }

  if (target.lines) {
    const line = pickRandomLine(target);
    target.previewLine = line;
    target.pause = 1.2;
    target.talkCooldown = 0.5;
    const targetGroup = target.group as THREE.Group;
    pushBubble({ group: targetGroup, key: target.bubbleKey }, line, 4.2);
    targetGroup.rotation.y = lerpAngle(
      targetGroup.rotation.y,
      Math.atan2(player.position.x - targetGroup.position.x, player.position.z - targetGroup.position.z),
      0.35
    );
    return;
  }

  if (typeof target.interact === "function") {
    target.interact();
  }
}

function drawMinimap() {
  if (!minimapCtx) return;
  renderMinimap(minimapCtx, {
    mapFeatures,
    interactables: interactables.map((item) => ({
      available: isInteractableAvailableForPlayer(item),
      position: item.position,
    })),
    remotePlayers: Array.from(remotePlayers.values()),
    npcs,
    ducks,
    pigeons,
    buses,
    player,
    facing,
    espectroMarker: espectroEvent?.getMapMarker?.(),
    now: performance.now(),
  });
}

function updateCamera() {
  cameraController.updateCamera(camera, player.position, (id) => remotePlayers.has(id));
}

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const resizeHandler = () => resize();
window.addEventListener("resize", resizeHandler);
resize();

let rafId = 0;
let running = true;
let netAccumulator = 0;
let minimapTimer = 0;
const NET_INTERVAL = 0.08; // ~12.5 Hz

function tick() {
  if (!running) return;
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = getWorldTime ? getWorldTime() : clock.elapsedTime;
  const atmosphereState = getAtmosphereState(time);
  applyAtmosphere(atmosphereState);
  weatherSystem.update(dt, time, atmosphereState);
  noticeTexture.update(time, atmosphereState);
  updateAmbientAudio(time, atmosphereState);

  speechOverlay.releaseSpeechLock(dt);
  updatePlayer(dt, time);
  handleInteraction();

  for (const npc of npcs) {
    if (npcSync.isNpcAuthorityActive()) updateNpc(npc, dt, time);
    else updateNpcFromSnapshot(npc, dt, time);
  }

  for (const duck of ducks) {
    updateDuck(duck, dt, time);
  }

  for (const pigeon of pigeons) {
    updatePigeon(pigeon, dt, time);
  }

  for (const item of interactables) {
    item.update?.(dt, time);
  }

  for (const prop of decorativeProps) {
    prop.update?.(dt, time);
  }

  updateRemotes(dt, time);
  updateBubbles(dt);
  updatePvpBalls(dt);
  espectroEvent?.update(dt, time);

  netAccumulator += dt;
  if (netAccumulator >= NET_INTERVAL) {
    netAccumulator = 0;
    onLocalState({
      x: player.position.x,
      z: player.position.z,
      ry: player.rotation.y,
      speed: playerVelocity.length(),
      activity: playerActivitySnapshot.kind,
      jumpY: playerState.jumpY,
    });
    if (npcSync.isNpcAuthorityActive()) {
      onNpcState(serializeNpcStates());
    }
    if (playerState.ridingBike?.mounted) {
      const mountedBike = playerState.ridingBike;
      const wheelieAngle = mountedBike.wheelieAmount * 0.52;
      mountedBike.position.set(player.position.x, Math.sin(wheelieAngle) * 0.86, player.position.z);
      mountedBike.group.rotation.x = -wheelieAngle;
      mountedBike.group.rotation.y = player.rotation.y;
      playerState.ridingBike.emitState?.(true);
    }
  }

  updateInteractionUI();
  updateCamera();
  refreshCameraFrustum();
  syncEntityVisibility();
  devTools.updateSelectionBox();
  minimapTimer += dt;
  if (minimapTimer >= 0.1) {
    minimapTimer = 0;
    drawMinimap();
  }
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(tick);
}

tick();

// ── PvP Queimado ─────────────────────────────────────────────────────────────

function createBallMesh() {
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 10, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff6a00,
    emissive: 0xff3300,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  return mesh;
}

function spawnBall(x, z, dx, dz, matchId, isLocal) {
  const mesh = createBallMesh();
  mesh.position.set(x, 0.9, z);
  world.add(mesh);
  pvpBalls.push({ mesh, x, z, dx, dz, life: BALL_LIFE, matchId, isLocal });
}

function doLocalPvpThrow() {
  if (!pvpActiveMatch || pvpThrowCooldown > 0) return;
  pvpThrowCooldown = 0.55;
  const ry = player.rotation.y;
  const dx = -Math.sin(ry);
  const dz = -Math.cos(ry);
  const ox = player.position.x + dx * 0.9;
  const oz = player.position.z + dz * 0.9;
  spawnBall(ox, oz, dx, dz, pvpActiveMatch.matchId, true);
  onPvpThrow(pvpActiveMatch.matchId, dx, dz, ox, oz);
}

function updatePvpBalls(dt) {
  if (pvpThrowCooldown > 0) pvpThrowCooldown -= dt;
  if (queuedPvpThrow) {
    queuedPvpThrow = false;
    doLocalPvpThrow();
  }

  for (let i = pvpBalls.length - 1; i >= 0; i--) {
    const b = pvpBalls[i];
    b.life -= dt;
    if (b.life <= 0) {
      world.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      pvpBalls.splice(i, 1);
      continue;
    }
    b.x += b.dx * BALL_SPEED * dt;
    b.z += b.dz * BALL_SPEED * dt;
    b.mesh.position.set(b.x, 0.9 + Math.sin(b.life * 4) * 0.08, b.z);

    if (b.isLocal && pvpActiveMatch) {
      const opponentId = pvpActiveMatch.opponentId;
      const r = remotePlayers.get(opponentId);
      if (r) {
        const dx = b.x - r.group.position.x;
        const dz = b.z - r.group.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < BALL_RADIUS + PLAYER_HIT_RADIUS) {
          onPvpHit(pvpActiveMatch.matchId, opponentId);
          pvpShowHit(opponentId);
          world.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.mesh.material.dispose();
          pvpBalls.splice(i, 1);
        }
      }
    }
  }
}

function pvpSetMatch(match) {
  pvpActiveMatch = match;
  if (!match) {
    for (const b of pvpBalls) {
      world.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
    }
    pvpBalls.length = 0;
    pvpThrowCooldown = 0;
  }
}

function pvpShowThrow(matchId, fromId, x, z, dx, dz) {
  if (!pvpActiveMatch || pvpActiveMatch.matchId !== matchId) return;
  spawnBall(x, z, dx, dz, matchId, false);
}

function pvpShowHit(victimId) {
  const isLocal = victimId === "__local__";
  const target = isLocal ? player : remotePlayers.get(victimId)?.group;
  if (!target) return;
  const flashMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.2, transparent: true, opacity: 0.55 });
  const flashGeo = new THREE.SphereGeometry(0.72, 8, 8);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.set(0, 0.95, 0);
  target.add(flash);
  let t = 0;
  const anim = () => {
    t += 0.035;
    if (t >= 1) { target.remove(flash); flash.geometry.dispose(); flash.material.dispose(); return; }
    flash.material.opacity = 0.55 * (1 - t);
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

function pvpTeleportToArena(side) {
  forceDismountCurrentBike();
  pvpSavedPosition = { x: player.position.x, z: player.position.z };
  const spawnX = side === "A" ? ARENA_CX - 7.5 : ARENA_CX + 7.5;
  const facingY = side === "A" ? 0 : Math.PI;
  player.position.set(spawnX, 0, ARENA_CZ);
  player.rotation.y = facingY;
  playerVelocity.set(0, 0);
}

function pvpReturnFromArena() {
  if (pvpSavedPosition) {
    player.position.set(pvpSavedPosition.x, 0, pvpSavedPosition.z);
    pvpSavedPosition = null;
  }
}

function queueMobilePvpThrow() {
  if (pvpActiveMatch) queuedPvpThrow = true;
}

// ── end PvP ──────────────────────────────────────────────────────────────────

function destroy() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  destroyGameAudio();
  inputBindings.destroy();
  window.removeEventListener("resize", resizeHandler);
  window.removeEventListener("error", errorHandler);
  gateCheckpoint?.destroy?.();
  swimmingMinigame?.destroy?.();
  espectroEvent?.destroy?.();
  weatherSystem.destroy();
  swimmingMinigame = null;
  espectroEvent = null;
  devTools.destroy();
  disposeObject3D(scene);
  renderer.dispose?.();
}

  return {
    destroy,
    addRemotePlayer,
    updateRemotePlayer,
    removeRemotePlayer,
    setNpcAuthority,
    applyNpcSnapshots,
    setRemoteNick,
    setLocalNick,
    updateSharedEntity,
    pushChatBubble,
    pushReactionBubble,
    triggerLocalEmote,
    triggerReaction,
    triggerRemoteEmote,
    triggerRemoteReaction,
    toggleAmbientAudio,
    setMobileInput,
    queueMobileInteract,
    queueMobileJump,
    toggleCameraMode: cameraController.toggleMode,
    pvpSetMatch,
    pvpShowThrow,
    pvpShowHit,
    pvpTeleportToArena,
    pvpReturnFromArena,
    queueMobilePvpThrow,
    espectroSpawn: (payload) => espectroEvent?.spawn(payload),
    espectroDespawn: () => espectroEvent?.despawn(),
    exitSit,
  };
}

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}
