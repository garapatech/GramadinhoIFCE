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
};

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
  onSecretDisconnect,
  playParanormalSound,
}) {
  let secretCourt = null;
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

  const state = {
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
    const label = createNameLabel("Espectro", "#fff8dc", "#9ca3af");
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
    for (let i = 0; i < 10; i += 1) {
      const angle = randomBetween(rng, 0, Math.PI * 2);
      const radius = randomBetween(rng, 1.8, 6.2);
      const x = THREE.MathUtils.clamp(origin.x + Math.cos(angle) * radius, -66, 66);
      const z = THREE.MathUtils.clamp(origin.z + Math.sin(angle) * radius, -66, 66);
      return new THREE.Vector3(x, 0, z);
    }
    return origin.clone();
  }

  function spawnEspectro(payload: EspectroSpawnPayload = {}) {
    removeEspectro({ clearPayload: true });
    if (!payload || payload.expiresAt < Date.now()) return;
    const seed = seedToNumber(payload.seed);
    const rng = mulberry32(seed);
    const spawn = ESPECTRO_SPAWN_POINTS[Math.abs(payload.spawnIndex || 0) % ESPECTRO_SPAWN_POINTS.length];
    state.appearance = createRandomAppearance(rng);
    const { rig } = makeEspectroRig(state.appearance);
    const group = rig.group;
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
      speed: randomBetween(rng, 0.75, 1.4),
    };
  }

  function updateEspectro(dt, time) {
    const espectro = state.espectro;
    if (!espectro || state.secret?.active) return;
    if (espectro.expiresAt <= Date.now()) {
      removeEspectro({ clearPayload: true });
      return;
    }

    const distance = Math.hypot(player.position.x - espectro.group.position.x, player.position.z - espectro.group.position.z);
    state.veilPower = Math.max(state.veilPower, clamp01(1 - distance / 9) * 0.32);

    const canPullPlayer = canStartSecret?.() !== false;
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

    espectro.turnTimer -= dt;
    espectro.fakeMoveTimer -= dt;
    if (espectro.turnTimer <= 0) {
      espectro.turnTimer = randomBetween(state.rng, 0.5, 1.8);
      espectro.group.rotation.y += randomBetween(state.rng, -0.95, 0.95);
    }
    if (espectro.fakeMoveTimer <= 0) {
      espectro.fakeMoveTimer = randomBetween(state.rng, 1.1, 2.8);
      espectro.pause = randomBetween(state.rng, 0.15, 0.9);
    }

    if (espectro.pause > 0) {
      espectro.pause -= dt;
      setRestPose(espectro.rig.refs, time, seedToNumber(state.seed) * 0.001);
      if (state.rng() < 0.025) {
        espectro.group.position.x += randomBetween(state.rng, -0.025, 0.025);
        espectro.group.position.z += randomBetween(state.rng, -0.025, 0.025);
      }
      return;
    }

    const dx = espectro.target.x - espectro.group.position.x;
    const dz = espectro.target.z - espectro.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.28 || state.rng() < 0.003) {
      espectro.target = pickWanderTarget(espectro.home, state.rng);
      espectro.pause = randomBetween(state.rng, 0.12, 0.55);
      return;
    }
    const step = Math.min(dist, espectro.speed * dt);
    const nx = dx / dist;
    const nz = dz / dist;
    espectro.group.position.x += nx * step;
    espectro.group.position.z += nz * step;
    espectro.group.rotation.y = espectro.group.rotation.y + ((((Math.atan2(nx, nz) - espectro.group.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.08;
    animateWalk(espectro.rig.refs, time * 4.4, 0.45);
    espectro.group.position.y = Math.sin(time * 7.2) * 0.025;
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
      savedPosition: { x: player.position.x, z: player.position.z },
      ai: {
        rig,
        group: rig.group,
        target: new THREE.Vector3(SECRET_ARENA.x + 4.5, 0, SECRET_ARENA.z + 2),
        hits: 0,
        throwTimer: 1.0,
        dodgeTimer: 0.4,
      },
      balls: [],
      playerHits: 0,
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
    playerVelocity.set(0, 0);
    player.position.set(SECRET_ARENA.x - 5.1, 0, SECRET_ARENA.z);
    player.rotation.y = Math.PI / 2;
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

  function spawnSecretBall(x, z, dx, dz, owner) {
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
      life: 2.6,
      hit: false,
    });
  }

  function doPlayerThrow(secret) {
    const yaw = player.rotation.y;
    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);
    spawnSecretBall(player.position.x + dx * 0.8, player.position.z + dz * 0.8, dx, dz, "player");
    playParanormalSound?.(0.22);
  }

  function doAiThrow(secret) {
    const ai = secret.ai;
    let dx = player.position.x - ai.group.position.x;
    let dz = player.position.z - ai.group.position.z;
    const len = Math.hypot(dx, dz) || 1;
    dx = dx / len + randomBetween(state.rng, -0.08, 0.08);
    dz = dz / len + randomBetween(state.rng, -0.08, 0.08);
    const adjusted = Math.hypot(dx, dz) || 1;
    spawnSecretBall(ai.group.position.x + (dx / adjusted) * 0.8, ai.group.position.z + (dz / adjusted) * 0.8, dx / adjusted, dz / adjusted, "espectro");
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
    ai.dodgeTimer -= dt;
    if (ai.dodgeTimer <= 0 || Math.hypot(ai.target.x - ai.group.position.x, ai.target.z - ai.group.position.z) < 0.25) {
      ai.dodgeTimer = randomBetween(state.rng, 0.35, 0.95);
      ai.target.set(
        randomBetween(state.rng, SECRET_ARENA.x + 1.1, SECRET_ARENA.x + SECRET_ARENA.width / 2 - 1.4),
        0,
        randomBetween(state.rng, SECRET_ARENA.z - SECRET_ARENA.depth / 2 + 1.3, SECRET_ARENA.z + SECRET_ARENA.depth / 2 - 1.3)
      );
    }

    const dx = ai.target.x - ai.group.position.x;
    const dz = ai.target.z - ai.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const speed = 2.3 + Math.sin(time * 2.7) * 0.4;
      const nx = dx / dist;
      const nz = dz / dist;
      ai.group.position.x += nx * Math.min(dist, speed * dt);
      ai.group.position.z += nz * Math.min(dist, speed * dt);
      ai.group.rotation.y = ai.group.rotation.y + ((((Math.atan2(player.position.x - ai.group.position.x, player.position.z - ai.group.position.z) - ai.group.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.14;
      animateRun(ai.rig.refs, time * 6.4, 0.52);
    } else {
      setRestPose(ai.rig.refs, time, 2.4);
    }

    ai.throwTimer -= dt;
    if (ai.throwTimer <= 0) {
      ai.throwTimer = randomBetween(state.rng, 1.05, 1.85);
      doAiThrow(secret);
    }
  }

  function updateSecretBalls(secret, dt) {
    const speed = 8.6;
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
      ball.x += ball.dx * speed * dt;
      ball.z += ball.dz * speed * dt;
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
        if (d < 0.68) {
          ball.hit = true;
          secret.ai.hits += 1;
          flashTarget(secret.ai.group, 0xc8f7ff);
          playParanormalSound?.(0.55);
          if (secret.ai.hits >= 3) {
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
