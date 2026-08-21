import * as THREE from "three";

export const ESPECTRO_SPAWN_POINTS = [
  { x: -56, z: 34 },
  { x: -31, z: 33 },
  { x: -55, z: 57 },
  { x: 24, z: 31 },
  { x: 53, z: 50 },
  { x: 50, z: 29 },
];

const SECRET_ARENA = {
  x: 44,
  z: -54,
  width: 16,
  depth: 11,
};

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function seedToNumber(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const raw = String(seed || "espectro");
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function createSecretCourt(world) {
  const group = new THREE.Group();
  world.add(group);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x17191f,
    emissive: 0x05060a,
    emissiveIntensity: 0.34,
    roughness: 0.94,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x090a10,
    emissive: 0x120016,
    emissiveIntensity: 0.26,
    roughness: 0.82,
  });
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xb90838,
    emissive: 0x740020,
    emissiveIntensity: 0.55,
    roughness: 0.5,
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(SECRET_ARENA.width, 0.08, SECRET_ARENA.depth), floorMat);
  floor.position.set(SECRET_ARENA.x, 0.035, SECRET_ARENA.z);
  floor.receiveShadow = true;
  group.add(floor);

  const wallH = 1.45;
  const wallT = 0.35;
  const walls = [
    [SECRET_ARENA.width + wallT, wallH, wallT, SECRET_ARENA.x, wallH / 2, SECRET_ARENA.z - SECRET_ARENA.depth / 2],
    [SECRET_ARENA.width + wallT, wallH, wallT, SECRET_ARENA.x, wallH / 2, SECRET_ARENA.z + SECRET_ARENA.depth / 2],
    [wallT, wallH, SECRET_ARENA.depth + wallT, SECRET_ARENA.x - SECRET_ARENA.width / 2, wallH / 2, SECRET_ARENA.z],
    [wallT, wallH, SECRET_ARENA.depth + wallT, SECRET_ARENA.x + SECRET_ARENA.width / 2, wallH / 2, SECRET_ARENA.z],
  ];
  for (const [w, h, d, x, y, z] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, SECRET_ARENA.depth - 1.2), lineMat);
  centerLine.position.set(SECRET_ARENA.x, 0.11, SECRET_ARENA.z);
  group.add(centerLine);
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(SECRET_ARENA.width - 1.2, 0.1, 0.1), lineMat);
    line.position.set(SECRET_ARENA.x, 0.11, SECRET_ARENA.z + side * (SECRET_ARENA.depth / 2 - 1.0));
    group.add(line);
  }

  const mistMat = new THREE.MeshBasicMaterial({
    color: 0x271331,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(SECRET_ARENA.width * 1.5, SECRET_ARENA.depth * 1.5), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(SECRET_ARENA.x, 0.16, SECRET_ARENA.z);
  mist.renderOrder = 3;
  group.add(mist);

  const redLight = new THREE.PointLight(0xff124b, 1.0, 18, 2);
  redLight.position.set(SECRET_ARENA.x - 4, 3.2, SECRET_ARENA.z - 2);
  group.add(redLight);
  const blueLight = new THREE.PointLight(0x536dff, 0.48, 16, 2);
  blueLight.position.set(SECRET_ARENA.x + 4, 2.8, SECRET_ARENA.z + 2);
  group.add(blueLight);

  return { group, mist, redLight, blueLight };
}

function createDodgeballMesh() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xc81636,
      emissive: 0x6c0018,
      emissiveIntensity: 0.52,
      roughness: 0.42,
    })
  );
  mesh.castShadow = true;
  return mesh;
}

function flashTarget(target, color = 0xff183c) {
  if (!target) return;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.74, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })
  );
  mesh.position.set(0, 0.92, 0);
  target.add(mesh);
  let t = 0;
  const fade = () => {
    t += 0.045;
    if (t >= 1) {
      target.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      return;
    }
    mesh.material.opacity = 0.5 * (1 - t);
    requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);
}

type EspectroSpawnPayload = {
  seed?: string | number;
  spawnIndex?: number;
  expiresAt?: number;
  mode?: "foot" | "bike";
};

function createBiribaBike() {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2f8b72, roughness: 0.52, metalness: 0.28 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.92 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xaeb9bf, roughness: 0.32, metalness: 0.72 });
  const wheels: THREE.Mesh[] = [];
  for (const z of [-0.72, 0.72]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 22), tireMat);
    wheel.position.set(0, 0.37, z);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const addTube = (length: number, x: number, y: number, z: number, rx: number, rz = 0) => {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length, 8), frameMat);
    tube.position.set(x, y, z);
    tube.rotation.set(rx, 0, rz);
    tube.castShadow = true;
    group.add(tube);
  };
  addTube(1.08, 0, 0.57, 0, Math.PI / 2, 0);
  addTube(0.8, 0, 0.63, -0.33, 0.75, 0);
  addTube(0.82, 0, 0.63, 0.3, -0.72, 0);
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8), metalMat);
  handlebar.position.set(0, 0.96, -0.68);
  handlebar.rotation.z = Math.PI / 2;
  group.add(handlebar);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.18), tireMat);
  seat.position.set(0, 0.9, 0.18);
  group.add(seat);
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), metalMat);
  crank.position.set(0, 0.5, 0);
  crank.rotation.z = Math.PI / 2;
  group.add(crank);
  return { group, wheels, crank };
}

function applyBiribaBikePose(refs, phase: number, intensity: number) {
  const pedal = Math.sin(phase) * 0.58 * intensity;
  refs.leftShoulder.rotation.set(-0.78, 0, 0.12);
  refs.rightShoulder.rotation.set(-0.78, 0, -0.12);
  refs.leftElbow.rotation.x = 0.58;
  refs.rightElbow.rotation.x = 0.58;
  refs.leftHip.rotation.x = -1.08 + pedal;
  refs.rightHip.rotation.x = -1.08 - pedal;
  refs.leftKnee.rotation.x = 1.34 + Math.max(0, -pedal) * 0.5;
  refs.rightKnee.rotation.x = 1.34 + Math.max(0, pedal) * 0.5;
  refs.torso.rotation.x = 0.16;
  refs.head.rotation.x = -0.05;
}

export function createEspectroEvent({
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
  resetRigPose,
  forceDismount,
  canStartSecret,
  onConsumed,
  onDuelStart,
  onDuelHit,
  onSecretDisconnect,
  playParanormalSound,
  isBlockedAt,
  clampPointToWorld,
  getHumans,
  getPlayerFloorY,
  setPlayerFloorY,
}) {
  let secretCourt: ReturnType<typeof createSecretCourt> | null = null;
  const veil = document.createElement("div");
  veil.className = "espectro-veil";
  container?.appendChild(veil);

  function randomRgb(rng, min = 0, max = 255) {
    const r = Math.floor(randomBetween(rng, min, max + 1));
    const g = Math.floor(randomBetween(rng, min, max + 1));
    const b = Math.floor(randomBetween(rng, min, max + 1));
    return (r << 16) | (g << 8) | b;
  }

  function createRandomAppearance(rng) {
    return {
      shirtColor: randomRgb(rng, 20, 240),
      pantsColor: randomRgb(rng, 15, 220),
      shoesColor: randomRgb(rng, 0, 120),
      skinColor: randomRgb(rng, 120, 240),
      hairColor: randomRgb(rng, 0, 140),
      backpackColor: randomRgb(rng, 25, 230),
      backpack: true,
      scale: 1,
    };
  }

  const state: any = {
    espectro: null,
    seed: null,
    rng: Math.random,
    nearTimer: 0,
    spoken: false,
    veilPower: 0,
    strangeSoundTimer: 0,
    consumed: false,
    activePayload: null,
    secret: null,
    appearance: null,
  };

  function makeEspectroRig(appearance = state.appearance || createRandomAppearance(Math.random)) {
    const rig = createCharacter(appearance);
    const label = createNameLabel("Biriba", "#fff8dc", "#9ca3af");
    rig.group.add(label);
    return { rig, label };
  }

  function ensureSecretCourt() {
    if (!secretCourt) {
      secretCourt = createSecretCourt(world);
    }
    return secretCourt;
  }

  function removeEspectro({ clearPayload = false } = {}) {
    if (clearPayload) state.activePayload = null;
    if (!state.espectro) return;
    world.remove(state.espectro.group);
    disposeObject3D?.(state.espectro.group);
    state.espectro = null;
    state.nearTimer = 0;
    state.spoken = false;
  }

  function pickWanderTarget(origin, rng = state.rng) {
    for (let i = 0; i < 18; i += 1) {
      const angle = randomBetween(rng, 0, Math.PI * 2);
      const radius = randomBetween(rng, 3.2, 13.5);
      const candidate = new THREE.Vector3(
        origin.x + Math.cos(angle) * radius,
        0,
        origin.z + Math.sin(angle) * radius,
      );
      clampPointToWorld?.(candidate, 0.58);
      if (!isBlockedAt?.(candidate.x, candidate.z, 0.58)) return candidate;
    }
    return origin.clone();
  }

  function chooseHuman(espectro) {
    const humans = getHumans?.() || [{
      id: "__local__",
      position: player.position,
      velocity: { x: playerVelocity.x || 0, z: playerVelocity.y || 0 },
    }];
    let best: any = null;
    let bestScore = Infinity;
    for (const human of humans) {
      if (!human?.position) continue;
      const distance = Math.hypot(
        human.position.x - espectro.group.position.x,
        human.position.z - espectro.group.position.z,
      );
      const samePenalty = human.id === espectro.lastHumanId ? 1.4 : 0;
      const noise = randomBetween(state.rng, -1.3, 1.3);
      const score = distance + samePenalty + noise;
      if (score < bestScore) {
        best = { ...human, distance };
        bestScore = score;
      }
    }
    return best;
  }

  function predictHumanPoint(human, leadSeconds: number) {
    const velocity = human?.velocity || { x: 0, z: 0 };
    const point = new THREE.Vector3(
      human.position.x + velocity.x * leadSeconds,
      0,
      human.position.z + velocity.z * leadSeconds,
    );
    clampPointToWorld?.(point, 0.58);
    return point;
  }

  function chooseStrategy(espectro) {
    const human = chooseHuman(espectro);
    espectro.human = human;
    espectro.decisionTimer = randomBetween(state.rng, 1.6, 3.8);
    espectro.strategyAge = 0;
    if (!human) {
      espectro.strategy = "wander";
      espectro.target.copy(pickWanderTarget(espectro.home, state.rng));
      return;
    }

    const roll = state.rng();
    const movingSpeed = Math.hypot(human.velocity?.x || 0, human.velocity?.z || 0);
    if (human.distance < 15 && roll < 0.5) {
      espectro.strategy = "intercept";
      const lead = THREE.MathUtils.clamp(human.distance / (espectro.speed + 2.5), 0.35, 1.45);
      espectro.target.copy(predictHumanPoint(human, lead + movingSpeed * 0.025));
    } else if (human.distance < 25 && roll < 0.82) {
      espectro.strategy = "stalk";
      const dx = espectro.group.position.x - human.position.x;
      const dz = espectro.group.position.z - human.position.z;
      const length = Math.hypot(dx, dz) || 1;
      const side = state.rng() < 0.5 ? -1 : 1;
      espectro.target.set(
        human.position.x + (dx / length) * randomBetween(state.rng, 3.3, 5.8) + (dz / length) * side * 2.2,
        0,
        human.position.z + (dz / length) * randomBetween(state.rng, 3.3, 5.8) - (dx / length) * side * 2.2,
      );
      clampPointToWorld?.(espectro.target, 0.58);
    } else {
      espectro.strategy = "wander";
      espectro.target.copy(pickWanderTarget(espectro.group.position, state.rng));
    }
    espectro.lastHumanId = human.id;
  }

  function chooseSteeredStep(espectro, desiredX: number, desiredZ: number, distance: number, step: number) {
    const baseAngle = Math.atan2(desiredX, desiredZ);
    const probe = Math.max(0.72, step * 2.4);
    const offsets = [0, 0.42, -0.42, 0.82, -0.82, 1.25, -1.25, Math.PI];
    let best: any = null;
    let bestScore = Infinity;
    for (const offset of offsets) {
      const angle = baseAngle + offset;
      const nx = Math.sin(angle);
      const nz = Math.cos(angle);
      const testX = espectro.group.position.x + nx * probe;
      const testZ = espectro.group.position.z + nz * probe;
      if (isBlockedAt?.(testX, testZ, 0.58)) continue;
      const remaining = Math.hypot(espectro.target.x - testX, espectro.target.z - testZ);
      const turnCost = Math.abs(offset) * (espectro.mode === "bike" ? 1.5 : 0.65);
      const score = remaining + turnCost;
      if (score < bestScore) {
        bestScore = score;
        best = { nx, nz, angle };
      }
    }
    if (!best && distance > 0.001) return { nx: desiredX / distance, nz: desiredZ / distance, angle: baseAngle };
    return best;
  }

  function spawnEspectro(payload: EspectroSpawnPayload = {}) {
    removeEspectro({ clearPayload: true });
    if (!payload || typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) return;
    const seed = seedToNumber(payload.seed);
    const rng = mulberry32(seed);
    const spawn = ESPECTRO_SPAWN_POINTS[Math.abs(payload.spawnIndex || 0) % ESPECTRO_SPAWN_POINTS.length];
    state.appearance = createRandomAppearance(rng);
    const { rig } = makeEspectroRig(state.appearance);
    const group = rig.group;
    const mode = payload.mode === "bike" ? "bike" : "foot";
    const bike = mode === "bike" ? createBiribaBike() : null;
    if (bike) group.add(bike.group);
    group.position.set(spawn.x + randomBetween(rng, -0.8, 0.8), 0, spawn.z + randomBetween(rng, -0.8, 0.8));
    group.rotation.y = randomBetween(rng, -Math.PI, Math.PI);
    world.add(group);
    state.seed = payload.seed;
    state.activePayload = payload;
    state.rng = rng;
    state.nearTimer = 0;
    state.spoken = false;
    state.consumed = false;
    state.espectro = {
      group,
      rig,
      home: group.position.clone(),
      target: pickWanderTarget(group.position, rng),
      pause: randomBetween(rng, 0.4, 1.4),
      turnTimer: randomBetween(rng, 0.5, 1.5),
      fakeMoveTimer: randomBetween(rng, 1.0, 2.2),
      expiresAt: payload.expiresAt,
      speed: mode === "bike" ? randomBetween(rng, 4.4, 6.1) : randomBetween(rng, 1.25, 2.45),
      mode,
      bike,
      pedalPhase: randomBetween(rng, 0, Math.PI * 2),
      strategy: "wander",
      strategyAge: 0,
      decisionTimer: randomBetween(rng, 0.3, 1.1),
      human: null,
      lastHumanId: null,
      stuckTimer: 0,
      noProgressTimer: 0,
      lastPosition: group.position.clone(),
      recoverySide: rng() < 0.5 ? -1 : 1,
    };
  }

  function updateEspectro(dt, time) {
    const espectro = state.espectro;
    if (!espectro || state.secret?.active) return;
    if (espectro.expiresAt <= Date.now()) {
      removeEspectro({ clearPayload: true });
      return;
    }

    const distance = Math.hypot(
      player.position.x - espectro.group.position.x,
      player.position.y - espectro.group.position.y,
      player.position.z - espectro.group.position.z,
    );
    state.veilPower = Math.max(state.veilPower, clamp01(1 - distance / 9) * 0.32);

    const canPullPlayer = espectro.mode !== "bike" && canStartSecret?.() !== false;
    if (distance < 3.4 && canPullPlayer) {
      state.nearTimer += dt;
      if (!state.spoken) {
        state.spoken = true;
        pushBubble?.({ group: espectro.group, key: "espectro" }, "Soube não...", 4.8);
        playParanormalSound?.(0.72);
      }
    } else {
      state.nearTimer = Math.max(0, state.nearTimer - dt * 0.8);
    }

    if (canPullPlayer && state.spoken && state.nearTimer > 4.9 && !state.consumed) {
      triggerSecretDodgeball();
      return;
    }

    espectro.decisionTimer -= dt;
    espectro.strategyAge += dt;
    espectro.fakeMoveTimer -= dt;
    if (espectro.decisionTimer <= 0 || espectro.strategyAge > 6.5) {
      chooseStrategy(espectro);
    }
    if (espectro.fakeMoveTimer <= 0) {
      espectro.fakeMoveTimer = randomBetween(state.rng, 2.2, 5.4);
      if (state.rng() < (espectro.mode === "bike" ? 0.12 : 0.34)) {
        espectro.pause = randomBetween(state.rng, 0.12, espectro.mode === "bike" ? 0.28 : 0.72);
      } else if (state.rng() < 0.45) {
        chooseStrategy(espectro);
      }
    }

    if (espectro.strategy === "intercept" && espectro.human?.position) {
      espectro.turnTimer -= dt;
      if (espectro.turnTimer <= 0) {
        espectro.turnTimer = randomBetween(state.rng, 0.28, 0.55);
        const human = chooseHuman(espectro) || espectro.human;
        espectro.human = human;
        const lead = THREE.MathUtils.clamp(human.distance / Math.max(2.5, espectro.speed), 0.3, 1.25);
        espectro.target.copy(predictHumanPoint(human, lead));
      }
    }

    if (espectro.pause > 0) {
      espectro.pause -= dt;
      setRestPose(espectro.rig.refs, time, seedToNumber(state.seed) * 0.001);
      if (espectro.bike) applyBiribaBikePose(espectro.rig.refs, espectro.pedalPhase, 0.05);
      return;
    }

    const dx = espectro.target.x - espectro.group.position.x;
    const dz = espectro.target.z - espectro.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.38) {
      chooseStrategy(espectro);
      espectro.pause = randomBetween(state.rng, 0.08, espectro.mode === "bike" ? 0.2 : 0.48);
      return;
    }
    const strategyBoost = espectro.strategy === "intercept" ? 1.22 : espectro.strategy === "recovery" ? 0.82 : 1;
    const speed = espectro.speed * strategyBoost;
    const step = Math.min(dist, speed * dt);
    const steer = chooseSteeredStep(espectro, dx, dz, dist, step);
    if (!steer) {
      espectro.stuckTimer += dt;
      return;
    }

    const nextX = espectro.group.position.x + steer.nx * step;
    const nextZ = espectro.group.position.z + steer.nz * step;
    let moved = false;
    if (!isBlockedAt?.(nextX, nextZ, 0.56)) {
      espectro.group.position.x = nextX;
      espectro.group.position.z = nextZ;
      moved = true;
    } else if (!isBlockedAt?.(nextX, espectro.group.position.z, 0.56)) {
      espectro.group.position.x = nextX;
      moved = true;
    } else if (!isBlockedAt?.(espectro.group.position.x, nextZ, 0.56)) {
      espectro.group.position.z = nextZ;
      moved = true;
    }

    const actualMove = Math.hypot(
      espectro.group.position.x - espectro.lastPosition.x,
      espectro.group.position.z - espectro.lastPosition.z,
    );
    espectro.lastPosition.copy(espectro.group.position);
    if (!moved || actualMove < speed * dt * 0.18) espectro.stuckTimer += dt;
    else espectro.stuckTimer = Math.max(0, espectro.stuckTimer - dt * 2.2);

    if (espectro.stuckTimer > 0.72) {
      espectro.stuckTimer = 0;
      espectro.recoverySide *= -1;
      const sideX = steer.nz * espectro.recoverySide;
      const sideZ = -steer.nx * espectro.recoverySide;
      const recovery = new THREE.Vector3(
        espectro.group.position.x - steer.nx * 2.2 + sideX * randomBetween(state.rng, 3.1, 5.2),
        0,
        espectro.group.position.z - steer.nz * 2.2 + sideZ * randomBetween(state.rng, 3.1, 5.2),
      );
      clampPointToWorld?.(recovery, 0.58);
      if (isBlockedAt?.(recovery.x, recovery.z, 0.58)) {
        recovery.copy(pickWanderTarget(espectro.group.position, state.rng));
      }
      espectro.target.copy(recovery);
      espectro.strategy = "recovery";
      espectro.strategyAge = 0;
      espectro.decisionTimer = randomBetween(state.rng, 0.75, 1.35);
    }

    const turnRate = espectro.mode === "bike" ? Math.min(0.16, dt * 4.2) : Math.min(0.24, dt * 7.5);
    espectro.group.rotation.y = espectro.group.rotation.y + ((((steer.angle - espectro.group.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * turnRate;
    if (espectro.bike) {
      espectro.pedalPhase += speed * dt * 1.35;
      for (const wheel of espectro.bike.wheels) wheel.rotation.x += speed * dt / 0.36;
      espectro.bike.crank.rotation.x = espectro.pedalPhase;
      applyBiribaBikePose(espectro.rig.refs, espectro.pedalPhase, clamp01(speed / 6));
      espectro.group.position.y = 0.18 + Math.abs(Math.sin(espectro.pedalPhase)) * 0.018;
    } else {
      const phase = time * (espectro.strategy === "intercept" ? 7.2 : 5.1);
      if (speed > 2.25) animateRun(espectro.rig.refs, phase, clamp01(speed / 3.2));
      else animateWalk(espectro.rig.refs, phase, clamp01(speed / 2.3));
      espectro.group.position.y = Math.sin(time * 7.2) * 0.018;
    }
  }

  function makeSecretState() {
    ensureSecretCourt();
    const { rig } = makeEspectroRig(state.appearance || createRandomAppearance(state.rng));
    rig.group.position.set(SECRET_ARENA.x + 5.0, 0, SECRET_ARENA.z);
    rig.group.rotation.y = Math.PI;
    world.add(rig.group);
    return {
      active: true,
      phase: "teleport",
      timer: 0.72,
      savedPosition: {
        x: player.position.x,
        z: player.position.z,
        floorY: getPlayerFloorY?.() ?? 0,
      },
      ai: {
        rig,
        group: rig.group,
        target: new THREE.Vector3(SECRET_ARENA.x + 4.5, 0, SECRET_ARENA.z + 2),
        hits: 0,
        throwTimer: 1.0,
        dodgeTimer: 0.18,
        evadeCooldown: 0,
      },
      balls: [],
      playerHits: 0,
      playerThrowCooldown: 0,
      throwQueued: false,
      endTimer: 0,
      disconnectQueued: false,
    };
  }

  function triggerSecretDodgeball() {
    state.consumed = true;
    forceDismount?.();
    playParanormalSound?.(1.0);
    state.secret = makeSecretState();
    removeEspectro();
    setPlayerFloorY?.(0);
    playerVelocity.set(0, 0);
    player.position.set(SECRET_ARENA.x - 5.1, 0, SECRET_ARENA.z);
    player.rotation.y = Math.PI / 2;
    onDuelStart?.(state.seed);
  }

  function removeSecretBalls(secret) {
    if (!secret) return;
    for (const ball of secret.balls) {
      world.remove(ball.mesh);
      ball.mesh.geometry.dispose();
      ball.mesh.material.dispose();
    }
    secret.balls.length = 0;
  }

  function endSecret({ lost = false } = {}) {
    const secret = state.secret;
    if (!secret) return;
    removeSecretBalls(secret);
    if (secret.ai?.group) {
      world.remove(secret.ai.group);
      disposeObject3D?.(secret.ai.group);
    }
    if (secretCourt?.group) {
      world.remove(secretCourt.group);
      disposeObject3D?.(secretCourt.group);
      secretCourt = null;
    }
    if (!lost && secret.savedPosition) {
      setPlayerFloorY?.(secret.savedPosition.floorY ?? 0);
      player.position.set(secret.savedPosition.x, 0, secret.savedPosition.z);
      playerVelocity.set(0, 0);
    }
    resetRigPose?.();
    state.secret = null;
    state.veilPower = lost ? 1 : 0;
    if (!lost && state.activePayload && state.activePayload.expiresAt > Date.now()) {
      spawnEspectro(state.activePayload);
    }
  }

  function queueThrow() {
    if (!state.secret?.active || state.secret.phase !== "playing") return false;
    state.secret.throwQueued = true;
    return true;
  }

  function spawnSecretBall(x, z, dx, dz, owner, speed = 9.2) {
    const mesh = createDodgeballMesh();
    mesh.position.set(x, 0.78, z);
    world.add(mesh);
    state.secret.balls.push({
      mesh,
      x,
      z,
      dx,
      dz,
      owner,
      speed,
      life: 2.6,
      hit: false,
    });
  }

  function doPlayerThrow(secret) {
    if (secret.playerThrowCooldown > 0) return;
    secret.playerThrowCooldown = 0.62;
    const yaw = player.rotation.y;
    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);
    spawnSecretBall(player.position.x + dx * 0.8, player.position.z + dz * 0.8, dx, dz, "player", 9.2);
    playParanormalSound?.(0.22);
  }

  function doAiThrow(secret) {
    const ai = secret.ai;
    const directDistance = Math.hypot(
      player.position.x - ai.group.position.x,
      player.position.z - ai.group.position.z,
    );
    const leadTime = THREE.MathUtils.clamp(directDistance / 11.5, 0.18, 0.62);
    let dx = player.position.x + playerVelocity.x * leadTime - ai.group.position.x;
    let dz = player.position.z + playerVelocity.y * leadTime - ai.group.position.z;
    const len = Math.hypot(dx, dz) || 1;
    dx = dx / len + randomBetween(state.rng, -0.035, 0.035);
    dz = dz / len + randomBetween(state.rng, -0.035, 0.035);
    const adjusted = Math.hypot(dx, dz) || 1;
    spawnSecretBall(
      ai.group.position.x + (dx / adjusted) * 0.8,
      ai.group.position.z + (dz / adjusted) * 0.8,
      dx / adjusted,
      dz / adjusted,
      "espectro",
      11.5,
    );
    playParanormalSound?.(0.3);
  }

  function clampPlayerToSecretArena() {
    const margin = 1.0;
    player.position.x = THREE.MathUtils.clamp(
      player.position.x,
      SECRET_ARENA.x - SECRET_ARENA.width / 2 + margin,
      SECRET_ARENA.x + SECRET_ARENA.width / 2 - margin
    );
    player.position.z = THREE.MathUtils.clamp(
      player.position.z,
      SECRET_ARENA.z - SECRET_ARENA.depth / 2 + margin,
      SECRET_ARENA.z + SECRET_ARENA.depth / 2 - margin
    );
  }

  function updateSecretAi(secret, dt, time) {
    const ai = secret.ai;
    ai.evadeCooldown = Math.max(0, (ai.evadeCooldown || 0) - dt);
    ai.dodgeTimer -= dt;
    let threat: any = null;
    let threatTime = Infinity;
    for (const ball of secret.balls) {
      if (ball.owner !== "player" || ball.hit) continue;
      const relX = ai.group.position.x - ball.x;
      const relZ = ai.group.position.z - ball.z;
      const along = relX * ball.dx + relZ * ball.dz;
      const eta = along / Math.max(0.1, ball.speed || 9.2);
      if (eta <= 0 || eta > 0.9 || eta >= threatTime) continue;
      const closestX = ball.x + ball.dx * along;
      const closestZ = ball.z + ball.dz * along;
      if (Math.hypot(ai.group.position.x - closestX, ai.group.position.z - closestZ) > 1.45) continue;
      threat = ball;
      threatTime = eta;
    }

    if (threat && ai.evadeCooldown <= 0) {
      const sideA = { x: -threat.dz, z: threat.dx };
      const sideB = { x: threat.dz, z: -threat.dx };
      const roomA = Math.min(
        SECRET_ARENA.x + SECRET_ARENA.width / 2 - 0.85 - (ai.group.position.x + sideA.x * 4.8),
        ai.group.position.x + sideA.x * 4.8 - (SECRET_ARENA.x + 0.55),
        SECRET_ARENA.z + SECRET_ARENA.depth / 2 - 0.8 - (ai.group.position.z + sideA.z * 4.8),
        ai.group.position.z + sideA.z * 4.8 - (SECRET_ARENA.z - SECRET_ARENA.depth / 2 + 0.8),
      );
      const side = roomA > -0.15 || state.rng() > 0.82 ? sideA : sideB;
      ai.target.set(
        THREE.MathUtils.clamp(ai.group.position.x + side.x * randomBetween(state.rng, 4.1, 5.4), SECRET_ARENA.x + 0.55, SECRET_ARENA.x + SECRET_ARENA.width / 2 - 0.85),
        0,
        THREE.MathUtils.clamp(ai.group.position.z + side.z * randomBetween(state.rng, 4.1, 5.4), SECRET_ARENA.z - SECRET_ARENA.depth / 2 + 0.8, SECRET_ARENA.z + SECRET_ARENA.depth / 2 - 0.8),
      );
      ai.evadeCooldown = 0.16;
      ai.dodgeTimer = randomBetween(state.rng, 0.16, 0.3);
    } else if (ai.dodgeTimer <= 0 || Math.hypot(ai.target.x - ai.group.position.x, ai.target.z - ai.group.position.z) < 0.25) {
      ai.dodgeTimer = randomBetween(state.rng, 0.2, 0.48);
      ai.target.set(
        randomBetween(state.rng, SECRET_ARENA.x + 0.65, SECRET_ARENA.x + SECRET_ARENA.width / 2 - 0.85),
        0,
        randomBetween(state.rng, SECRET_ARENA.z - SECRET_ARENA.depth / 2 + 0.85, SECRET_ARENA.z + SECRET_ARENA.depth / 2 - 0.85)
      );
    }

    const dx = ai.target.x - ai.group.position.x;
    const dz = ai.target.z - ai.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const speed = threat ? 8.8 : 4.7 + Math.sin(time * 2.7) * 0.55;
      const nx = dx / dist;
      const nz = dz / dist;
      ai.group.position.x += nx * Math.min(dist, speed * dt);
      ai.group.position.z += nz * Math.min(dist, speed * dt);
      ai.group.rotation.y = ai.group.rotation.y + ((((Math.atan2(player.position.x - ai.group.position.x, player.position.z - ai.group.position.z) - ai.group.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.14;
      animateRun(ai.rig.refs, time * (threat ? 11.2 : 8.4), threat ? 1 : 0.78);
    } else {
      setRestPose(ai.rig.refs, time, 2.4);
    }

    ai.throwTimer -= dt;
    if (ai.throwTimer <= 0) {
      ai.throwTimer = randomBetween(state.rng, 0.72, 1.28);
      doAiThrow(secret);
    }
  }

  function updateSecretBalls(secret, dt) {
    for (let i = secret.balls.length - 1; i >= 0; i -= 1) {
      const ball = secret.balls[i];
      ball.life -= dt;
      if (ball.life <= 0 || ball.hit) {
        world.remove(ball.mesh);
        ball.mesh.geometry.dispose();
        ball.mesh.material.dispose();
        secret.balls.splice(i, 1);
        continue;
      }
      ball.x += ball.dx * (ball.speed || 9.2) * dt;
      ball.z += ball.dz * (ball.speed || 9.2) * dt;
      ball.mesh.position.set(ball.x, 0.82 + Math.sin(ball.life * 5) * 0.08, ball.z);

      const out =
        ball.x < SECRET_ARENA.x - SECRET_ARENA.width / 2 + 0.55 ||
        ball.x > SECRET_ARENA.x + SECRET_ARENA.width / 2 - 0.55 ||
        ball.z < SECRET_ARENA.z - SECRET_ARENA.depth / 2 + 0.55 ||
        ball.z > SECRET_ARENA.z + SECRET_ARENA.depth / 2 - 0.55;
      if (out) {
        ball.hit = true;
        continue;
      }

      if (ball.owner === "espectro") {
        const d = Math.hypot(ball.x - player.position.x, ball.z - player.position.z);
        if (d < 0.68) {
          ball.hit = true;
          secret.playerHits += 1;
          flashTarget(player, 0xff183c);
          playParanormalSound?.(0.75);
          if (secret.playerHits >= 3) {
            secret.phase = "lost";
            secret.endTimer = 0.2;
          }
        }
      } else if (secret.ai?.group) {
        const d = Math.hypot(ball.x - secret.ai.group.position.x, ball.z - secret.ai.group.position.z);
        if (d < 0.42) {
          ball.hit = true;
          secret.ai.hits += 1;
          onDuelHit?.(state.seed, secret.ai.hits);
          flashTarget(secret.ai.group, 0xc8f7ff);
          playParanormalSound?.(0.55);
          if (secret.ai.hits >= 5) {
            secret.phase = "won";
            secret.endTimer = 0.9;
          }
        }
      }
    }
  }

  function updateSecret(secret, dt, time) {
    state.veilPower = Math.max(state.veilPower, secret.phase === "teleport" ? 0.95 : 0.58);
    clampPlayerToSecretArena();

    if (secret.phase === "teleport") {
      secret.timer -= dt;
      playerVelocity.set(0, 0);
      setRestPose(secret.ai.rig.refs, time, 3.1);
      if (secret.timer <= 0) {
        secret.phase = "playing";
      }
      return;
    }

    if (secret.phase === "playing") {
      secret.playerThrowCooldown = Math.max(0, secret.playerThrowCooldown - dt);
      if (secret.throwQueued) {
        secret.throwQueued = false;
        doPlayerThrow(secret);
      }
      updateSecretAi(secret, dt, time);
      updateSecretBalls(secret, dt);
      return;
    }

    secret.endTimer -= dt;
    playerVelocity.set(0, 0);
    if (secret.phase === "lost") {
      animateGlitch(secret.ai.rig.refs, time, 1, 0.8);
      if (!secret.disconnectQueued) {
        secret.disconnectQueued = true;
        window.setTimeout(() => {
          onConsumed?.(state.seed);
          endSecret({ lost: true });
          onSecretDisconnect?.();
        }, 180);
      }
      return;
    }

    if (secret.phase === "won" && secret.endTimer <= 0) {
      onConsumed?.(state.seed, "won");
      state.activePayload = null;
      endSecret({ lost: false });
    }
  }

  function updateVeil(dt, time) {
    state.veilPower = Math.max(0, state.veilPower - dt * 0.55);
    const secret = state.secret;
    if (secret?.active) {
      state.strangeSoundTimer -= dt;
      if (state.strangeSoundTimer <= 0) {
        playParanormalSound?.(secret.phase === "playing" ? 0.28 : 0.45);
        state.strangeSoundTimer = secret.phase === "playing" ? 3.2 : 1.4;
      }
    }

    const pulse = Math.max(0, state.veilPower);
    veil.style.opacity = String(THREE.MathUtils.clamp(pulse, 0, 1));
    veil.style.transform = `translate(${Math.sin(time * 33) * pulse * 3}px, ${Math.cos(time * 27) * pulse * 2}px)`;
    if (secretCourt) {
      secretCourt.mist.material.opacity = 0.08 + pulse * 0.18 + Math.sin(time * 1.7) * 0.02;
      secretCourt.redLight.intensity = 0.7 + pulse * 0.8 + Math.max(0, Math.sin(time * 6.3)) * 0.18;
      secretCourt.blueLight.intensity = 0.32 + pulse * 0.35;
    }

    if (scene?.fog && pulse > 0.05) {
      scene.fog.color.lerp(new THREE.Color(0x120918), pulse * 0.24);
      scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, 16, pulse * 0.35);
      scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, 68, pulse * 0.25);
    }
  }

  function update(dt, time) {
    if (state.activePayload?.expiresAt <= Date.now()) {
      despawnEvent();
      return;
    }
    if (
      !state.activePayload &&
      !state.espectro &&
      !state.secret?.active &&
      state.veilPower <= 0
    ) {
      return;
    }
    updateEspectro(dt, time);
    if (state.secret?.active) {
      updateSecret(state.secret, dt, time);
    }
    updateVeil(dt, time);
  }

  function despawnEvent() {
    state.activePayload = null;
    removeEspectro({ clearPayload: true });
    if (state.secret?.active) {
      endSecret({ lost: false });
    }
  }

  return {
    spawn: spawnEspectro,
    despawn: despawnEvent,
    update,
    queueThrow,
    getMapMarker: () => {
      const group = state.espectro?.group;
      if (!group || state.secret?.active) return null;
      return { x: group.position.x, z: group.position.z, color: "#000000" };
    },
    isSecretActive: () => state.secret?.active === true,
    isPlayerInSecretArena: () => state.secret?.active === true,
    destroy() {
      removeEspectro({ clearPayload: true });
      endSecret({ lost: false });
      veil.remove();
    },
  };
}
