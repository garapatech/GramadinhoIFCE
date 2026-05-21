import * as THREE from "three";
import type { CharacterRigRefs } from "@/game/characterRig";

export const SWIMMING_POOL_CONFIG = {
  centerX: 0,
  centerZ: -48,
  areaWidth: 32,
  areaDepth: 26,
  waterWidth: 20,
  waterDepth: 18.5,
  laneCount: 4,
  laneIndex: 1,
} as const;

type SwimPhase = "idle" | "countdown" | "race" | "finish";

type SwimHudState = {
  phase: SwimPhase;
  countdown: number;
  progress: number;
  energy: number;
  speed: number;
  speedPulse: number;
  finishTimer: number;
  savedPosition: { x: number; z: number } | null;
  taps: number[];
  strokeCount: number;
  waterSoundTimer: number;
  bikeWarnCooldown: number;
};

type Blocker = {
  active?: boolean;
};

type SwimInteractable = {
  kind: string;
  label: string;
  radius: number;
  position: THREE.Vector3;
  cullPosition: THREE.Vector3;
  cullRadius: number;
  cullDistance: number;
  root: THREE.Group;
  npcDisabled: () => boolean;
  isDisabledForPlayer: () => boolean;
  interact: () => void;
  update: (dt: number, time: number) => void;
};

type MapFeatureRecord = Record<string, unknown>;

type SwimmingMapFeatures = {
  buildings?: MapFeatureRecord[];
  paths?: MapFeatureRecord[];
};

type SwimPlayerLike = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

type SwimVelocityLike = {
  set: (x: number, y: number) => void;
};

type SwimRigLike = {
  refs: CharacterRigRefs;
};

export type SwimmingMinigameOptions = {
  world: THREE.Group;
  container?: HTMLElement | null;
  createBlocker: (minX: number, maxX: number, minZ: number, maxZ: number) => Blocker;
  interactables: SwimInteractable[];
  mapFeatures?: SwimmingMapFeatures | null;
  player: SwimPlayerLike;
  playerRig: SwimRigLike;
  playerVelocity: SwimVelocityLike;
  speak?: (text: string, speaker?: string) => void;
  updatePlayerActivity?: (state: { kind: string; label: string; detail: string }) => void;
  resetRigPose?: (refs: CharacterRigRefs) => void;
  isRidingBike?: () => boolean;
  removeTreesInArea?: (
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    padding: number
  ) => void;
  playPoolSound?: (intensity: number) => void;
  playSwimStrokeSound?: (intensity: number) => void;
};

function clamp01(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function createPanelTexture({
  title,
  subtitle = "",
  width = 512,
  height = 256,
  background = "#0a5d83",
  accent = "#9be7ff",
  text = "#f7fdff",
}: {
  title: string;
  subtitle?: string;
  width?: number;
  height?: number;
  background?: string;
  accent?: string;
  text?: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createPanelTexture: 2D context unavailable");
  }
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, background);
  gradient.addColorStop(1, "#08324d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.fillStyle = text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 48px Arial, sans-serif";
  ctx.fillText(title, width / 2, height * 0.42);
  if (subtitle) {
    ctx.font = "700 27px Arial, sans-serif";
    ctx.fillStyle = "#d7f7ff";
    ctx.fillText(subtitle, width / 2, height * 0.66);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createPoolDeckTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createPoolDeckTexture: 2D context unavailable");
  }
  ctx.fillStyle = "#d9ecef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 32) {
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.fillStyle = (x / 32 + y / 32) % 2 === 0 ? "#eaf6f8" : "#cfe5e9";
      ctx.fillRect(x, y, 31, 31);
    }
  }

  ctx.strokeStyle = "rgba(28, 88, 115, 0.24)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= canvas.width; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createPoolWaterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createPoolWaterTexture: 2D context unavailable");
  }
  const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, "#3bd7ff");
  base.addColorStop(0.5, "#1499d4");
  base.addColorStop(1, "#0872ae");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(230, 255, 255, 0.42)";
  ctx.lineWidth = 3;
  for (let y = -40; y < canvas.height + 40; y += 24) {
    ctx.beginPath();
    for (let x = -20; x <= canvas.width + 20; x += 12) {
      const waveY = y + Math.sin((x + y) * 0.05) * 7;
      if (x === -20) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  for (let x = -40; x < canvas.width + 40; x += 30) {
    ctx.beginPath();
    for (let y = -20; y <= canvas.height + 20; y += 12) {
      const waveX = x + Math.cos((x + y) * 0.06) * 5;
      if (y === -20) ctx.moveTo(waveX, y);
      else ctx.lineTo(waveX, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.4, 3.0);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function addBox(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  options: { rx?: number; ry?: number; rz?: number; castShadow?: boolean; receiveShadow?: boolean } = {}
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(options.rx || 0, options.ry || 0, options.rz || 0);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  group.add(mesh);
  return mesh;
}

function applySwimPose(refs: CharacterRigRefs, time: number, intensity = 1) {
  const k = clamp01(intensity);
  const stroke = Math.sin(time * (6.5 + k * 6));
  const strokeOpp = Math.sin(time * (6.5 + k * 6) + Math.PI);
  const kick = Math.sin(time * (10 + k * 8));

  refs.leftShoulder.rotation.x = -1.1 + stroke * 0.72 * k;
  refs.rightShoulder.rotation.x = -1.1 + strokeOpp * 0.72 * k;
  refs.leftShoulder.rotation.z = -0.26 + Math.max(0, stroke) * 0.28 * k;
  refs.rightShoulder.rotation.z = 0.26 - Math.max(0, strokeOpp) * 0.28 * k;
  refs.leftElbow.rotation.x = 0.38 + Math.max(0, -stroke) * 0.7 * k;
  refs.rightElbow.rotation.x = 0.38 + Math.max(0, -strokeOpp) * 0.7 * k;
  refs.leftHip.rotation.x = -0.38 + kick * 0.32 * k;
  refs.rightHip.rotation.x = -0.38 - kick * 0.32 * k;
  refs.leftKnee.rotation.x = 0.46 + Math.max(0, -kick) * 0.36 * k;
  refs.rightKnee.rotation.x = 0.46 + Math.max(0, kick) * 0.36 * k;
  refs.torso.rotation.x = 0.34 + k * 0.1;
  refs.torso.rotation.y = stroke * 0.09 * k;
  refs.head.rotation.x = -0.12 + Math.sin(time * 3.4) * 0.04;
  refs.head.rotation.y = -stroke * 0.08 * k;
}

export function createSwimmingMinigame({
  world,
  container,
  createBlocker,
  interactables,
  mapFeatures,
  player,
  playerRig,
  playerVelocity,
  speak,
  updatePlayerActivity,
  resetRigPose,
  isRidingBike,
  removeTreesInArea,
  playPoolSound,
  playSwimStrokeSound,
}: SwimmingMinigameOptions) {
  const cfg = SWIMMING_POOL_CONFIG;
  const bounds = {
    minX: cfg.centerX - cfg.areaWidth / 2,
    maxX: cfg.centerX + cfg.areaWidth / 2,
    minZ: cfg.centerZ - cfg.areaDepth / 2,
    maxZ: cfg.centerZ + cfg.areaDepth / 2,
  };
  const water = {
    minX: cfg.centerX - cfg.waterWidth / 2,
    maxX: cfg.centerX + cfg.waterWidth / 2,
    minZ: cfg.centerZ - cfg.waterDepth / 2,
    maxZ: cfg.centerZ + cfg.waterDepth / 2,
  };
  removeTreesInArea?.(bounds, 1.8);
  const laneWidth = cfg.waterWidth / cfg.laneCount;
  const laneX = water.minX + laneWidth * (cfg.laneIndex + 0.5);
  const startZ = water.minZ + 1.15;
  const finishZ = water.maxZ - 1.15;
  const laneLength = finishZ - startZ;
  const group = new THREE.Group();
  world.add(group);

  const deckTexture = createPoolDeckTexture();
  const waterTexture = createPoolWaterTexture();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: deckTexture, roughness: 0.88 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2b8db8, roughness: 0.58, metalness: 0.04 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, roughness: 0.4, metalness: 0.36 });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x22a9df,
    map: waterTexture,
    emissive: 0x0b5c9a,
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.78,
    roughness: 0.12,
    metalness: 0.08,
  });

  const deck = addBox(
    group,
    new THREE.BoxGeometry(cfg.areaWidth, 0.11, cfg.areaDepth),
    deckMat,
    cfg.centerX,
    0.045,
    cfg.centerZ,
    { receiveShadow: true }
  );
  deck.receiveShadow = true;

  const waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.waterWidth, cfg.waterDepth, 36, 24),
    waterMat
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(cfg.centerX, 0.125, cfg.centerZ);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  addBox(group, new THREE.BoxGeometry(cfg.waterWidth + 1.2, 0.28, 0.42), edgeMat, cfg.centerX, 0.22, water.minZ - 0.38);
  addBox(group, new THREE.BoxGeometry(cfg.waterWidth + 1.2, 0.28, 0.42), edgeMat, cfg.centerX, 0.22, water.maxZ + 0.38);
  addBox(group, new THREE.BoxGeometry(0.42, 0.28, cfg.waterDepth + 1.2), edgeMat, water.minX - 0.38, 0.22, cfg.centerZ);
  addBox(group, new THREE.BoxGeometry(0.42, 0.28, cfg.waterDepth + 1.2), edgeMat, water.maxX + 0.38, 0.22, cfg.centerZ);

  for (let i = 1; i < cfg.laneCount; i += 1) {
    const x = water.minX + i * laneWidth;
    const lane = addBox(
      group,
      new THREE.BoxGeometry(0.08, 0.05, cfg.waterDepth - 1.4),
      laneMat,
      x,
      0.18,
      cfg.centerZ,
      { castShadow: false }
    ) as THREE.Mesh;
    lane.userData.baseY = lane.position.y;
  }

  const startLineMat = new THREE.MeshStandardMaterial({ color: 0xfff4b0, roughness: 0.5, emissive: 0x574000, emissiveIntensity: 0.1 });
  addBox(group, new THREE.BoxGeometry(cfg.waterWidth - 0.8, 0.06, 0.14), startLineMat, cfg.centerX, 0.19, startZ);
  addBox(group, new THREE.BoxGeometry(cfg.waterWidth - 0.8, 0.06, 0.14), startLineMat, cfg.centerX, 0.19, finishZ);

  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x0a5d83, roughness: 0.7 });
  const fenceHeight = 1.18;
  const fenceThickness = 0.28;
  const gateHalf = 2.2;
  addBox(group, new THREE.BoxGeometry(cfg.areaWidth, fenceHeight, fenceThickness), fenceMat, cfg.centerX, fenceHeight / 2, bounds.maxZ);
  addBox(group, new THREE.BoxGeometry(fenceThickness, fenceHeight, cfg.areaDepth), fenceMat, bounds.minX, fenceHeight / 2, cfg.centerZ);
  addBox(group, new THREE.BoxGeometry(fenceThickness, fenceHeight, cfg.areaDepth), fenceMat, bounds.maxX, fenceHeight / 2, cfg.centerZ);
  addBox(group, new THREE.BoxGeometry((cfg.areaWidth / 2) - gateHalf, fenceHeight, fenceThickness), fenceMat, bounds.minX + (cfg.areaWidth / 4) - gateHalf / 2, fenceHeight / 2, bounds.minZ);
  addBox(group, new THREE.BoxGeometry((cfg.areaWidth / 2) - gateHalf, fenceHeight, fenceThickness), fenceMat, bounds.maxX - (cfg.areaWidth / 4) + gateHalf / 2, fenceHeight / 2, bounds.minZ);

  createBlocker(bounds.minX - 0.4, bounds.maxX + 0.4, bounds.maxZ - 0.45, bounds.maxZ + 0.45);
  createBlocker(bounds.minX - 0.45, bounds.minX + 0.45, bounds.minZ, bounds.maxZ);
  createBlocker(bounds.maxX - 0.45, bounds.maxX + 0.45, bounds.minZ, bounds.maxZ);
  createBlocker(bounds.minX, cfg.centerX - gateHalf, bounds.minZ - 0.45, bounds.minZ + 0.45);
  createBlocker(cfg.centerX + gateHalf, bounds.maxX, bounds.minZ - 0.45, bounds.minZ + 0.45);
  const gateBlocker = createBlocker(cfg.centerX - gateHalf, cfg.centerX + gateHalf, bounds.minZ - 0.45, bounds.minZ + 0.45);

  const standMat = new THREE.MeshStandardMaterial({ color: 0x6f8c99, roughness: 0.82 });
  for (let i = 0; i < 3; i += 1) {
    addBox(
      group,
      new THREE.BoxGeometry(12.6, 0.36, 1.0),
      standMat,
      cfg.centerX + 7.2,
      0.28 + i * 0.38,
      bounds.maxZ - 3.3 - i * 0.92,
      { castShadow: true }
    );
  }

  const waitingMat = new THREE.MeshStandardMaterial({ color: 0x75c7d9, roughness: 0.78 });
  addBox(group, new THREE.BoxGeometry(9.4, 0.08, 4.8), waitingMat, cfg.centerX, 0.105, bounds.minZ - 3.4, { receiveShadow: true });
  addBox(group, new THREE.BoxGeometry(3.2, 0.42, 0.7), edgeMat, cfg.centerX - 4.8, 0.34, bounds.minZ - 3.8);
  addBox(group, new THREE.BoxGeometry(3.2, 0.42, 0.7), edgeMat, cfg.centerX + 4.8, 0.34, bounds.minZ - 3.8);

  const clubSign = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 2.1, 0.16),
    new THREE.MeshStandardMaterial({
      map: createPanelTexture({ title: "PISCINA", subtitle: "CLUBE AQUATICO" }),
      roughness: 0.7,
    })
  );
  clubSign.position.set(bounds.minX + 4.3, 2.2, bounds.minZ - 0.55);
  clubSign.rotation.y = 0;
  clubSign.castShadow = true;
  group.add(clubSign);

  const rulesSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 1.8, 0.14),
    new THREE.MeshStandardMaterial({
      map: createPanelTexture({
        title: "RAIAS",
        subtitle: "AREA RESERVADA",
        width: 512,
        height: 220,
        background: "#123f73",
        accent: "#bfefff",
      }),
      roughness: 0.7,
    })
  );
  rulesSign.position.set(bounds.maxX - 4.1, 1.9, bounds.minZ - 0.55);
  group.add(rulesSign);

  const lampColor = 0x7fdcff;
  for (const [x, z] of [
    [bounds.minX + 2.2, bounds.minZ + 2.2],
    [bounds.maxX - 2.2, bounds.minZ + 2.2],
    [bounds.minX + 2.2, bounds.maxZ - 2.2],
    [bounds.maxX - 2.2, bounds.maxZ - 2.2],
  ]) {
    const lamp = new THREE.PointLight(lampColor, 0.78, 14, 2);
    lamp.position.set(x, 3.1, z);
    group.add(lamp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.0, 8), railMat);
    pole.position.set(x, 1.5, z);
    pole.castShadow = true;
    group.add(pole);
  }

  const ripples: Array<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>> = [];
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xc9f8ff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  for (let i = 0; i < 6; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.32, 24),
      rippleMat.clone()
    ) as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(
      water.minX + 1.5 + (i % 3) * 6.8,
      0.205,
      water.minZ + 2.4 + Math.floor(i / 3) * 10
    );
    ring.userData.phase = i * 0.7;
    ring.renderOrder = 4;
    group.add(ring);
    ripples.push(ring);
  }

  if (mapFeatures?.buildings) {
    mapFeatures.buildings.push({
      x: cfg.centerX,
      z: cfg.centerZ,
      width: cfg.areaWidth,
      depth: cfg.areaDepth,
      color: 0x75c7d9,
      roof: 0x22a9df,
      name: "piscina",
    });
  }
  if (mapFeatures?.paths) {
    mapFeatures.paths.push({
      width: 10,
      depth: 5,
      x: cfg.centerX,
      z: bounds.minZ - 3.4,
      rotation: 0,
      surface: "cement",
    });
  }

  const hud = document.createElement("div");
  hud.className = "swim-hud";
  hud.innerHTML = `
    <div class="swim-hud-top">
      <span class="swim-hud-kicker">NATAÇÃO</span>
      <strong data-swim="phase">Aguardando</strong>
    </div>
    <div class="swim-count" data-swim="count"></div>
    <div class="swim-progress-track"><span data-swim="bar"></span></div>
    <div class="swim-hud-metrics">
      <span data-swim="speed">ritmo 0%</span>
      <span data-swim="taps">0 toques</span>
    </div>
  `;
  container?.appendChild(hud);
  const phaseEl = hud.querySelector('[data-swim="phase"]') as HTMLElement;
  const countEl = hud.querySelector('[data-swim="count"]') as HTMLElement;
  const barEl = hud.querySelector('[data-swim="bar"]') as HTMLElement;
  const speedEl = hud.querySelector('[data-swim="speed"]') as HTMLElement;
  const tapsEl = hud.querySelector('[data-swim="taps"]') as HTMLElement;

  const state: SwimHudState = {
    phase: "idle",
    countdown: 0,
    progress: 0,
    energy: 0,
    speed: 0,
    speedPulse: 0,
    finishTimer: 0,
    savedPosition: null,
    taps: [],
    strokeCount: 0,
    waterSoundTimer: 1.5,
    bikeWarnCooldown: 0,
  };

  function isActive() {
    return state.phase !== "idle";
  }

  function isPlayerControlled() {
    return state.phase === "countdown" || state.phase === "race" || state.phase === "finish";
  }

  function isNoBikeZone(x: number, z: number) {
    return (
      x >= bounds.minX - 1.2 &&
      x <= bounds.maxX + 1.2 &&
      z >= bounds.minZ - 5.8 &&
      z <= bounds.maxZ + 1.2
    );
  }

  function rejectBikeEntry(position: { x: number; z: number }) {
    if (!isNoBikeZone(position.x, position.z)) return false;
    if (state.bikeWarnCooldown <= 0) {
      speak?.("Bicicletas ficam fora da area da piscina.", "Piscina");
      state.bikeWarnCooldown = 2.2;
    }
    return true;
  }

  function setRacePosition(progress: number, time: number) {
    const p = clamp01(progress);
    const laneJitter = Math.sin(time * 7.5) * state.speedPulse * 0.08;
    player.position.x = laneX + laneJitter;
    player.position.z = startZ + laneLength * p;
    player.position.y = 0.05 + Math.sin(time * 6.2) * 0.04 + state.speedPulse * 0.03;
    player.rotation.y = 0;
    player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, -0.32, 0.2);
  }

  function startRace() {
    if (isRidingBike?.()) {
      speak?.("Desca da bicicleta antes de entrar na piscina.", "Piscina");
      return;
    }
    state.phase = "countdown";
    state.countdown = 3.25;
    state.progress = 0;
    state.energy = 0;
    state.speed = 0;
    state.speedPulse = 0;
    state.finishTimer = 0;
    state.savedPosition = { x: player.position.x, z: player.position.z };
    state.taps.length = 0;
    state.strokeCount = 0;
    playerVelocity.set(0, 0);
    setRacePosition(0, performance.now() / 1000);
    speak?.("Competidor na raia. A largada vai começar.", "Piscina");
  }

  function finishRace(cancelled = false) {
    playerVelocity.set(0, 0);
    player.rotation.x = 0;
    resetRigPose?.(playerRig.refs);
    player.position.set(cfg.centerX, 0, bounds.minZ - 4.2);
    state.phase = "idle";
    state.countdown = 0;
    state.progress = 0;
    state.energy = 0;
    state.speed = 0;
    state.speedPulse = 0;
    state.finishTimer = 0;
    state.savedPosition = null;
    state.taps.length = 0;
    state.strokeCount = 0;
    if (cancelled) speak?.("Corrida cancelada. Voce voltou para a area de espera.", "Piscina");
  }

  function queueStroke() {
    if (state.phase !== "race") return;
    const now = performance.now() / 1000;
    state.taps.push(now);
    while (state.taps.length && now - state.taps[0] > 1) state.taps.shift();
    const rate = state.taps.length;
    state.energy = THREE.MathUtils.clamp(state.energy + 0.32 + Math.min(0.26, rate * 0.018), 0, 2.2);
    state.speedPulse = Math.min(1.25, state.speedPulse + 0.32);
    state.strokeCount += 1;
    playSwimStrokeSound?.(Math.min(1, rate / 10));
  }

  function queueCancel() {
    if (!isActive()) return false;
    finishRace(true);
    return true;
  }

  function updateHud() {
    const visible = isActive();
    hud.classList.toggle("visible", visible);
    if (!visible) return;

    if (state.phase === "countdown") {
      phaseEl.textContent = "Largada";
      countEl.textContent = `${Math.max(1, Math.ceil(state.countdown))}`;
    } else if (state.phase === "race") {
      phaseEl.textContent = "Corrida";
      countEl.textContent = "";
    } else {
      phaseEl.textContent = "Vitória";
      countEl.textContent = "✓";
    }
    barEl.style.width = `${Math.round(clamp01(state.progress) * 100)}%`;
    speedEl.textContent = `ritmo ${Math.round(clamp01(state.speed / 12) * 100)}%`;
    tapsEl.textContent = `${state.strokeCount} toques`;
  }

  function updatePlayer(dt: number, time: number) {
    if (!isPlayerControlled()) return false;
    updatePlayerActivity?.({
      kind: "emoting",
      label: "nadando",
      detail: state.phase === "race" ? "competindo na piscina" : "na raia da piscina",
    });
    playerVelocity.set(0, 0);

    if (state.phase === "countdown") {
      state.countdown -= dt;
      setRacePosition(0, time);
      applySwimPose(playerRig.refs, time, 0.25);
      if (state.countdown <= 0) {
        state.phase = "race";
        speak?.("Vai!", "Piscina");
      }
      return true;
    }

    if (state.phase === "race") {
      const now = performance.now() / 1000;
      while (state.taps.length && now - state.taps[0] > 1) state.taps.shift();
      state.energy = Math.max(0, state.energy - dt * 0.82);
      state.speedPulse = Math.max(0, state.speedPulse - dt * 1.6);
      const tapRate = state.taps.length;
      state.speed = 1.15 + state.energy * 3.9 + tapRate * 0.34;
      state.progress += (state.speed * dt) / laneLength;
      setRacePosition(state.progress, time);
      applySwimPose(playerRig.refs, time, Math.min(1, state.speed / 9.5));
      if (state.progress >= 1) {
        state.phase = "finish";
        state.finishTimer = 2.2;
        state.progress = 1;
        state.speed = 0;
        speak?.("Vitória! Você completou a prova de natação.", "Piscina");
      }
      return true;
    }

    if (state.phase === "finish") {
      state.finishTimer -= dt;
      setRacePosition(1, time);
      applySwimPose(playerRig.refs, time, 0.15);
      if (state.finishTimer <= 0) {
        finishRace(false);
      }
      return true;
    }

    return false;
  }

  function updateEnvironment(dt: number, time: number) {
    state.bikeWarnCooldown = Math.max(0, state.bikeWarnCooldown - dt);
    gateBlocker.active = true;

    const wave = Math.sin(time * 1.8) * 0.025 + Math.sin(time * 3.7) * 0.014;
    waterMesh.position.y = 0.125 + wave;
    waterMat.emissiveIntensity = 0.2 + Math.sin(time * 2.4) * 0.04 + state.speedPulse * 0.08;
    waterMat.opacity = 0.72 + Math.sin(time * 1.5) * 0.035 + state.speedPulse * 0.04;

    for (const ripple of ripples) {
      const phase = time * 0.55 + ripple.userData.phase;
      const scale = 0.9 + (phase % 1) * 2.6;
      ripple.scale.setScalar(scale);
      ripple.material.opacity = Math.max(0, 0.22 * (1 - (phase % 1)));
    }

    state.waterSoundTimer -= dt;
    const dx = player.position.x - cfg.centerX;
    const dz = player.position.z - cfg.centerZ;
    if (state.waterSoundTimer <= 0 && dx * dx + dz * dz < 30 * 30) {
      playPoolSound?.(isActive() ? 0.85 : 0.36);
      state.waterSoundTimer = isActive() ? 1.2 : 3.4;
    }

    updateHud();
  }

  interactables.push({
    kind: "pool",
    label: "Piscina de competicao",
    radius: 4.2,
    position: new THREE.Vector3(cfg.centerX, 0, bounds.minZ - 3.4),
    cullPosition: new THREE.Vector3(cfg.centerX, 0, cfg.centerZ),
    cullRadius: Math.max(cfg.areaWidth, cfg.areaDepth) * 0.72,
    cullDistance: 64,
    root: group,
    npcDisabled: () => true,
    isDisabledForPlayer: () => isActive(),
    interact() {
      startRace();
    },
    update(dt: number, time: number) {
      updateEnvironment(dt, time);
    },
  });

  return {
    group,
    bounds,
    water,
    laneX,
    startRace,
    isActive,
    isPlayerControlled,
    isNoBikeZone,
    rejectBikeEntry,
    queueStroke,
    queueCancel,
    updatePlayer,
    update: updateEnvironment,
    destroy() {
      hud.remove();
    },
  };
}
