import * as THREE from "three";
import "./style.css";

const canvas = document.getElementById("scene");
const statusEl = document.getElementById("status");
const speechEl = document.getElementById("speech");
const speechBodyEl = document.getElementById("speech-body");
const speechNameEl = document.getElementById("speech-name");
const speechHintEl = document.getElementById("speech-hint");
const minimapCanvas = document.getElementById("minimap-canvas");
const minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;

window.addEventListener("error", (event) => {
  if (statusEl) {
    statusEl.textContent = `Erro na cena: ${event.message}`;
    statusEl.style.opacity = "1";
  }
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7d7f7);
scene.fog = new THREE.Fog(0xa7d7f7, 45, 180);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xa7d7f7, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
camera.position.set(-22, 18, 54);

const ambient = new THREE.HemisphereLight(0xdff3ff, 0x5a7c4f, 1.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(28, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

scene.add(new THREE.AmbientLight(0x88aa88, 0.35));

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

function createGrassTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6ea34e";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 16000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * 2.5;
    const h = 1 + Math.random() * 2.5;
    const g = 95 + Math.random() * 55;
    ctx.fillStyle = `rgba(${40 + Math.random() * 20}, ${g}, ${35 + Math.random() * 16}, ${0.06 + Math.random() * 0.1})`;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.anisotropy = 8;
  return texture;
}

function createWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9eb0b6";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#5d7881";
  ctx.fillRect(4, 4, 120, 120);
  for (let y = 12; y < 120; y += 22) {
    for (let x = 12; x < 120; x += 18) {
      const lit = Math.random() > 0.42;
      ctx.fillStyle = lit ? "#d7e8f2" : "#37505a";
      ctx.fillRect(x, y, 10, 14);
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createNoticeTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2e7d8";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#234634";
  ctx.fillRect(14, 14, 484, 228);
  ctx.fillStyle = "#f7f2e9";
  ctx.fillRect(22, 22, 468, 212);
  ctx.fillStyle = "#223b2d";
  ctx.font = "bold 34px Arial";
  ctx.fillText("Avisos do Campus", 44, 72);
  ctx.font = "22px Arial";
  ctx.fillText("Biblioteca aberta ate 21h", 44, 122);
  ctx.fillText("Mutirao do gramado: sexta", 44, 158);
  ctx.fillText("Sala de convivencia: bloco central", 44, 194);
  const texture = new THREE.CanvasTexture(c);
  return texture;
}

const grass = createGrassTexture();
const windowTexture = createWindowTexture();
const noticeTexture = createNoticeTexture();

const world = new THREE.Group();
scene.add(world);

const blockers = [];
const mapFeatures = {
  buildings: [],
  paths: [],
  trees: []
};

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
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

function addPath(width, depth, x, z, rotation = 0) {
  mapFeatures.paths.push({ width, depth, x, z, rotation });
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

addPath(84, 6, 0, -8);
addPath(6, 66, -10, 10);
addPath(32, 5, 20, 16, Math.PI / 12);
addPath(26, 5, -28, 18, -Math.PI / 14);
addPath(18, 4, 2, 28);

function addBuilding({ x, z, width, depth, height, color, roof, name }) {
  mapFeatures.buildings.push({ x, z, width, depth, color, roof });
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color,
      map: windowTexture,
      roughness: 0.92,
      metalness: 0.03
    })
  );
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = height / 2;
  group.add(body);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.7, depth + 0.3),
    new THREE.MeshStandardMaterial({ color: roof, roughness: 1 })
  );
  top.position.y = height + 0.35;
  top.castShadow = true;
  group.add(top);

  if (name) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(width * 0.7, 10), 1.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xf3f0e7, roughness: 0.8 })
    );
    sign.position.set(0, height * 0.65, depth / 2 + 0.18);
    sign.castShadow = true;
    group.add(sign);
  }

  group.position.set(x, 0, z);
  world.add(group);
  blockers.push({
    minX: x - width / 2 - 0.9,
    maxX: x + width / 2 + 0.9,
    minZ: z - depth / 2 - 0.9,
    maxZ: z + depth / 2 + 0.9
  });
}

addBuilding({ x: 0, z: -28, width: 26, depth: 12, height: 7, color: 0xdbe0dd, roof: 0x8b3d2c, name: "bloco" });
addBuilding({ x: -26, z: -16, width: 18, depth: 10, height: 5.5, color: 0xcfd7cc, roof: 0x6c7f56 });
addBuilding({ x: 25, z: -14, width: 17, depth: 10, height: 5.5, color: 0xd6d2c8, roof: 0x8a6b4c });
addBuilding({ x: 18, z: 24, width: 16, depth: 9, height: 5, color: 0xc8d0da, roof: 0x4a6278 });
addBuilding({ x: -21, z: 26, width: 13, depth: 8, height: 4.5, color: 0xddddcf, roof: 0x64725f });
addBuilding({ x: 0, z: 10, width: 10, depth: 8, height: 4.2, color: 0xe3dad0, roof: 0x715142 });

function createTree() {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 2.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1 })
  );
  trunk.position.y = 1.4;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x44753e, roughness: 1 })
  );
  crown.position.y = 3.2;
  crown.castShadow = true;
  tree.add(crown);
  return tree;
}

for (let i = 0; i < 86; i += 1) {
  const tree = createTree();
  const side = i % 4;
  let x = rand(-64, 64);
  let z = rand(-64, 64);
  if (side === 0) z = rand(-66, -48);
  if (side === 1) z = rand(48, 66);
  if (side === 2) x = rand(-66, -48);
  if (side === 3) x = rand(48, 66);
  tree.position.set(x, 0, z);
  tree.rotation.y = rand(0, Math.PI * 2);
  world.add(tree);
  mapFeatures.trees.push({ x, z });
}

function createCharacter({
  shirtColor,
  pantsColor,
  shoesColor,
  skinColor,
  backpackColor,
  hairColor = 0x3a2516,
  scale = 1,
  backpack = true,
  glasses = false
}) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.98 });
  const shoes = new THREE.MeshStandardMaterial({ color: shoesColor, roughness: 1 });
  const backpackMat = new THREE.MeshStandardMaterial({ color: backpackColor, roughness: 1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });

  const torso = new THREE.Group();
  torso.position.set(0, 1.05, 0);
  root.add(torso);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.9, 14), shirt);
  body.position.y = 0.45;
  body.castShadow = true;
  torso.add(body);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 14), shirt);
  collar.position.y = 0.92;
  torso.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skin);
  neck.position.y = 1.02;
  neck.castShadow = true;
  torso.add(neck);

  if (backpack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.22), backpackMat);
    pack.position.set(0, 0.5, -0.34);
    pack.castShadow = true;
    torso.add(pack);

    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.08), backpackMat);
    strapL.position.set(-0.2, 0.55, -0.2);
    torso.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.2;
    torso.add(strapR);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.2, 0);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), skin);
  skull.castShadow = true;
  head.add(skull);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.9), hairMat);
  hair.position.y = 0.04;
  hair.castShadow = true;
  head.add(hair);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
  leftEye.position.set(-0.12, 0.04, 0.3);
  head.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.12;
  head.add(rightEye);

  if (glasses) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xa9d8ef, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55
    });
    const lensGeo = new THREE.TorusGeometry(0.09, 0.012, 8, 18);
    const leftLens = new THREE.Mesh(lensGeo, frameMat);
    leftLens.position.set(-0.12, 0.05, 0.32);
    head.add(leftLens);
    const rightLens = leftLens.clone();
    rightLens.position.x = 0.12;
    head.add(rightLens);

    const innerGeo = new THREE.CircleGeometry(0.082, 16);
    const leftGlass = new THREE.Mesh(innerGeo, lensMat);
    leftGlass.position.set(-0.12, 0.05, 0.322);
    head.add(leftGlass);
    const rightGlass = leftGlass.clone();
    rightGlass.position.x = 0.12;
    head.add(rightGlass);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), frameMat);
    bridge.position.set(0, 0.05, 0.32);
    head.add(bridge);

    const templeGeo = new THREE.BoxGeometry(0.16, 0.012, 0.012);
    const leftTemple = new THREE.Mesh(templeGeo, frameMat);
    leftTemple.position.set(-0.22, 0.05, 0.22);
    leftTemple.rotation.y = 0.4;
    head.add(leftTemple);
    const rightTemple = leftTemple.clone();
    rightTemple.position.x = 0.22;
    rightTemple.rotation.y = -0.4;
    head.add(rightTemple);
  }

  function buildArm(side) {
    const sign = side === "left" ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.48, 0.88, 0);
    shoulder.rotation.z = sign * 0.14;
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.46, 10), shirt);
    upper.position.y = -0.23;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.46;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.4, 10), skin);
    forearm.position.y = -0.2;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), skin);
    hand.position.y = -0.42;
    hand.castShadow = true;
    elbow.add(hand);

    return { shoulder, elbow };
  }

  const leftArm = buildArm("left");
  const rightArm = buildArm("right");

  function buildLeg(side) {
    const sign = side === "left" ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.18, 1.05, 0);
    root.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.45, 10), pants);
    thigh.position.y = -0.225;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.45, 10), pants);
    shin.position.y = -0.225;
    shin.castShadow = true;
    knee.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.46), shoes);
    foot.position.set(0, -0.48, 0.08);
    foot.castShadow = true;
    knee.add(foot);

    return { hip, knee };
  }

  const leftLeg = buildLeg("left");
  const rightLeg = buildLeg("right");

  return {
    group: root,
    refs: {
      torso,
      head,
      leftShoulder: leftArm.shoulder,
      leftElbow: leftArm.elbow,
      rightShoulder: rightArm.shoulder,
      rightElbow: rightArm.elbow,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee
    }
  };
}

function animateWalk(refs, walkPhase, intensity) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const armSwing = Math.sin(walkPhase) * 1.0 * k;
  const legSwing = Math.sin(walkPhase) * 0.85 * k;

  refs.leftShoulder.rotation.x = armSwing;
  refs.rightShoulder.rotation.x = -armSwing;
  refs.leftElbow.rotation.x = 0.25 + Math.max(0, -armSwing) * 0.9;
  refs.rightElbow.rotation.x = 0.25 + Math.max(0, armSwing) * 0.9;

  refs.leftHip.rotation.x = -legSwing;
  refs.rightHip.rotation.x = legSwing;
  refs.leftKnee.rotation.x = Math.max(0, legSwing) * 1.2;
  refs.rightKnee.rotation.x = Math.max(0, -legSwing) * 1.2;

  refs.torso.rotation.y = -armSwing * 0.14;
  refs.head.rotation.y = armSwing * 0.07;
  refs.head.rotation.x = Math.sin(walkPhase * 2) * 0.05;
}

function setRestPose(refs, time, offset = 0) {
  const breath = Math.sin(time * 1.6 + offset) * 0.05;
  refs.leftShoulder.rotation.x = breath;
  refs.rightShoulder.rotation.x = -breath;
  refs.leftElbow.rotation.x = 0.2 + breath * 0.4;
  refs.rightElbow.rotation.x = 0.2 + breath * 0.4;
  refs.leftHip.rotation.x = 0;
  refs.rightHip.rotation.x = 0;
  refs.leftKnee.rotation.x = 0.05;
  refs.rightKnee.rotation.x = 0.05;
  refs.torso.rotation.y = Math.sin(time * 0.6 + offset) * 0.04;
  refs.head.rotation.y = Math.sin(time * 0.5 + offset * 1.3) * 0.18;
  refs.head.rotation.x = Math.sin(time * 0.8 + offset) * 0.04;
}

function setSittingPose(refs) {
  refs.leftShoulder.rotation.x = -0.15;
  refs.rightShoulder.rotation.x = -0.15;
  refs.leftElbow.rotation.x = 0.55;
  refs.rightElbow.rotation.x = 0.55;
  refs.leftHip.rotation.x = -Math.PI / 2.2;
  refs.rightHip.rotation.x = -Math.PI / 2.2;
  refs.leftKnee.rotation.x = Math.PI / 2.3;
  refs.rightKnee.rotation.x = Math.PI / 2.3;
  refs.torso.rotation.y = 0;
  refs.head.rotation.x = -0.05;
  refs.head.rotation.y = 0;
}

const playerRig = createCharacter({
  shirtColor: 0x2f855a,
  pantsColor: 0x24364d,
  shoesColor: 0x1a1a1a,
  skinColor: 0xf0c3a5,
  backpackColor: 0xb85a31,
  scale: 1,
  backpack: true
});
const player = playerRig.group;
world.add(player);
player.position.set(-40, 0, 38);

const spawnBeacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.28, 3.2, 12),
  new THREE.MeshStandardMaterial({ color: 0x31d17c, emissive: 0x1d8b52, emissiveIntensity: 0.35, roughness: 0.5 })
);
spawnBeacon.position.set(-40, 1.6, 38);
spawnBeacon.castShadow = true;
world.add(spawnBeacon);

const spawnGlow = new THREE.PointLight(0x62ff9f, 1.2, 10, 2);
spawnGlow.position.set(-40, 2.2, 38);
world.add(spawnGlow);

const playerState = {
  sitting: false,
  sitTimer: 0,
  sitTarget: null
};

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
      speak("Sentando para descansar um pouco.", "Banco");
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
    npcApproachRadius: 2.2,
    npcDuration: 1.7,
    interact() {
      pulseWater();
      speak("A agua respinga e refresca o caminho.", "Fonte");
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
      map: noticeTexture,
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
    npcApproachRadius: 1.8,
    npcDuration: 2.1,
    interact() {
      pulse = 1;
      speak("Biblioteca ate 21h. Mutirao do gramado sexta.", "Painel de avisos");
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
    npcApproachRadius: 0.95,
    npcDuration: 0.9,
    interact() {
      kickBall(player.position);
      speak("A bola sai rolando pelo gramado.", "Bola");
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

  const wheelA = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.08, 10, 18), wheelColor);
  wheelA.rotation.y = Math.PI / 2;
  wheelA.position.set(-0.62, 0.46, 0);
  wheelA.castShadow = true;
  bike.add(wheelA);

  const wheelB = wheelA.clone();
  wheelB.position.x = 0.62;
  bike.add(wheelB);

  const bar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), frameColor);
  bar1.position.set(0, 0.82, 0);
  bar1.rotation.z = Math.PI / 6;
  bar1.castShadow = true;
  bike.add(bar1);

  const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8), frameColor);
  bar2.position.set(-0.1, 0.72, 0);
  bar2.rotation.z = -Math.PI / 5;
  bar2.castShadow = true;
  bike.add(bar2);

  const bar3 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), frameColor);
  bar3.position.set(0.35, 0.98, 0);
  bar3.rotation.z = -Math.PI / 2.9;
  bar3.castShadow = true;
  bike.add(bar3);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.12), frameColor);
  seat.position.set(0.16, 1.26, 0);
  seat.castShadow = true;
  bike.add(seat);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), frameColor);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.7, 1.18, 0);
  handle.castShadow = true;
  bike.add(handle);

  bike.position.set(x, 0, z);
  bike.rotation.y = rotation;
  world.add(bike);

  let spinImpulse = 0;
  interactables.push({
    kind: "bike",
    label: "Bicicleta",
    radius: 2.4,
    position: new THREE.Vector3(x, 0, z),
    npcApproachRadius: 1.25,
    npcDuration: 1.3,
    interact() {
      spinImpulse += Math.PI / 8;
      speak("A bicicleta gira no suporte.", "Bicicleta");
    },
    npcInteract() {
      spinImpulse += Math.PI / 10;
    },
    update(dt) {
      spinImpulse *= Math.max(0, 1 - dt * 3.4);
      bike.rotation.y += spinImpulse * dt * 6;
      bike.position.y = Math.sin(clock.elapsedTime * 2) * 0.02;
    }
  });
}

function createLamp(x, z) {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 4.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.9 })
  );
  pole.position.y = 2.1;
  pole.castShadow = true;
  lamp.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.9 })
  );
  arm.position.set(0.46, 4.02, 0);
  arm.castShadow = true;
  lamp.add(arm);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf2f4d8, emissive: 0xf7f1b0, emissiveIntensity: 0.55 })
  );
  head.position.set(1.0, 4.0, 0);
  head.castShadow = true;
  lamp.add(head);

  const point = new THREE.PointLight(0xfff0b6, 0.35, 9, 2);
  point.position.set(1.0, 4.0, 0);
  lamp.add(point);

  lamp.position.set(x, 0, z);
  world.add(lamp);

  function toggleLamp() {
    point.intensity = point.intensity > 0.4 ? 0.18 : 0.72;
  }
  interactables.push({
    kind: "lamp",
    label: "Poste",
    radius: 2.2,
    position: new THREE.Vector3(x, 0, z),
    npcApproachRadius: 1.1,
    npcDuration: 1.1,
    interact() {
      toggleLamp();
      speak("O poste acende e apaga com um toque.", "Poste");
    },
    npcInteract() {
      toggleLamp();
    },
    update() {
      head.material.emissiveIntensity = 0.35 + Math.sin(clock.elapsedTime * 5) * 0.08;
    }
  });
}

const interactables = [];
createBench(-15, 8, Math.PI / 2);
createBench(11, 12, -Math.PI / 3);
createFountain(6, -2);
createNoticeBoard(-31, 9, Math.PI / 2);
createBall(-4, 16);
createBike(24, 4, -Math.PI / 2);
createLamp(-33, -2);

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

function createDuckEntity(x, z) {
  const visuals = createDuck(x, z);
  const state = {
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

function createNpc(config) {
  const rig = createCharacter(config.colors);
  const npc = rig.group;
  world.add(npc);
  npc.position.set(config.start.x, 0, config.start.z);
  const home = new THREE.Vector3(config.start.x, 0, config.start.z);
  const anchors = config.path.map(({ x, z }) => new THREE.Vector3(x, 0, z));

  const state = {
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
    phaseOffset: Math.random() * Math.PI * 2,
    mapColor: `#${config.colors.shirtColor.toString(16).padStart(6, "0")}`,
    interests: { ...(config.interests || {}) },
    state: "idle",
    stateTimer: 0.4 + rand(0, 1.4),
    moveTarget: home.clone(),
    focus: null,
    pose: null,
    lastInteraction: null
  };
  state.previewLine = pickRandomLine(state);

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: config.colors.shirtColor, emissive: config.colors.shirtColor, emissiveIntensity: 0.15 })
  );
  marker.position.y = 2.85;
  npc.add(marker);
  state.marker = marker;
  npcs.push(state);
  return state;
}

const npcs = [];
createNpc({
  name: "Ana",
  start: { x: -2, z: 18 },
  speed: 1.4,
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
  speed: 1.1,
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
  speed: 0.95,
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
  speed: 1.6,
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
  speed: 0.9,
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
  speed: 0.85,
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
  speed: 1.1,
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

createDuckEntity(7, 1);
createDuckEntity(4, -4);
createDuckEntity(9, -3);
createDuckEntity(-12, 30);
createDuckEntity(-2, 32);

function getInputVector() {
  const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  return new THREE.Vector2(x, z);
}

const keys = new Set();
let interactQueued = false;
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyE") interactQueued = true;
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

function showSpeech(text, speaker, hint) {
  if (!speechEl) return;
  if (speechBodyEl) speechBodyEl.textContent = text;
  if (speechNameEl) speechNameEl.textContent = speaker || "Aviso";
  if (speechHintEl) speechHintEl.textContent = hint || "[E]";
  speechEl.classList.add("visible");
}

function hideSpeech() {
  if (!speechEl) return;
  speechEl.classList.remove("visible");
}

function speak(text, speaker) {
  if (!speechEl) return;
  showSpeech(text, speaker, "");
  speechEl.dataset.locked = "1";
  speechEl.dataset.ttl = "2.6";
}

function setStatus(text) {
  if (!statusEl) return;
  if (!text) {
    statusEl.textContent = "";
    statusEl.style.opacity = "0";
    return;
  }
  statusEl.textContent = text;
  statusEl.style.opacity = "1";
}

function clearSpeech() {
  if (!speechEl) return;
  if (speechEl.dataset.locked === "1") return;
  hideSpeech();
}

function releaseSpeechLock(dt) {
  if (!speechEl) return;
  if (speechEl.dataset.ttl) {
    const ttl = Math.max(0, Number(speechEl.dataset.ttl) - dt);
    speechEl.dataset.ttl = String(ttl);
    if (ttl <= 0) {
      speechEl.dataset.locked = "0";
      hideSpeech();
      delete speechEl.dataset.ttl;
    }
  }
}

const playerVelocity = new THREE.Vector2();
const facing = new THREE.Vector2(0, -1);
const playerRadius = 0.55;
const npcRadius = 0.48;
const worldLimit = 68;
const maxSpeed = 7.2;
const accel = 22;
const drag = 10;
const clock = new THREE.Clock();

function clampPlayerToWorld() {
  player.position.x = THREE.MathUtils.clamp(player.position.x, -worldLimit, worldLimit);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -worldLimit, worldLimit);
}

function resolveCollisions(axis) {
  for (const box of blockers) {
    const px = player.position.x;
    const pz = player.position.z;
    const minX = box.minX - playerRadius;
    const maxX = box.maxX + playerRadius;
    const minZ = box.minZ - playerRadius;
    const maxZ = box.maxZ + playerRadius;
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

function enterSitState(target) {
  playerState.sitting = true;
  playerState.sitTimer = 2.6;
  playerState.sitTarget = target;
}

function updatePlayer(dt, time) {
  if (playerState.sitting) {
    playerState.sitTimer -= dt;
    if (playerState.sitTarget) {
      player.position.lerp(playerState.sitTarget.position, 0.12);
      player.rotation.y = lerpAngle(player.rotation.y, playerState.sitTarget.rotation, 0.12);
    }
    if (playerState.sitTimer <= 0) {
      playerState.sitting = false;
      playerState.sitTarget = null;
      speak("Voce se levantou do banco.", "Banco");
    }
    setSittingPose(playerRig.refs);
    return;
  }

  const input = getInputVector();
  if (input.lengthSq() > 0) {
    input.normalize();
    playerVelocity.addScaledVector(input, accel * dt);
    facing.copy(input);
  } else {
    const decay = Math.max(0, 1 - drag * dt);
    playerVelocity.multiplyScalar(decay);
  }

  const speed = playerVelocity.length();
  if (speed > maxSpeed) playerVelocity.setLength(maxSpeed);

  player.position.x += playerVelocity.x * dt;
  resolveCollisions("x");
  player.position.z += playerVelocity.y * dt;
  resolveCollisions("z");
  clampPlayerToWorld();

  if (facing.lengthSq() > 0.001) {
    const angle = Math.atan2(facing.x, facing.y);
    player.rotation.y = lerpAngle(player.rotation.y, angle, 0.16);
  }

  const intensity = Math.min(speed / maxSpeed, 1);
  if (intensity > 0.06) {
    const walkPhase = time * (5.5 + speed * 0.6);
    animateWalk(playerRig.refs, walkPhase, intensity);
    player.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * intensity;
  } else {
    setRestPose(playerRig.refs, time);
    player.position.y = Math.sin(time * 1.6) * 0.012;
  }
}

function getDistance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isInsideWorldBounds(x, z, radius = 0) {
  return (
    x >= -worldLimit + radius &&
    x <= worldLimit - radius &&
    z >= -worldLimit + radius &&
    z <= worldLimit - radius
  );
}

function isBlockedAt(x, z, radius = npcRadius) {
  if (!isInsideWorldBounds(x, z, radius)) return true;
  for (const box of blockers) {
    if (
      x > box.minX - radius &&
      x < box.maxX + radius &&
      z > box.minZ - radius &&
      z < box.maxZ + radius
    ) {
      return true;
    }
  }
  return false;
}

function clampPointToWorld(point, radius = 0) {
  point.x = THREE.MathUtils.clamp(point.x, -worldLimit + radius, worldLimit - radius);
  point.z = THREE.MathUtils.clamp(point.z, -worldLimit + radius, worldLimit - radius);
  point.y = 0;
  return point;
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

function pickNpcInteractable(npc) {
  const baseInterest = {
    bench: 1.1,
    fountain: 1.05,
    board: 1,
    ball: 0.95,
    bike: 0.75,
    lamp: 0.45
  };
  const candidates = [];

  for (const item of interactables) {
    const distance = getDistance2D(npc.group.position, item.position);
    if (distance > 24) continue;

    const itemInterest = baseInterest[item.kind] ?? 0.75;
    const personalInterest = npc.interests[item.kind] ?? 1;
    const distanceBonus = 1 - Math.min(distance / 24, 1);
    const noveltyPenalty = npc.lastInteraction === item ? 0.3 : 0;
    const score =
      itemInterest * personalInterest +
      distanceBonus * 0.85 +
      rand(-0.16, 0.22) -
      noveltyPenalty;

    if (score > 1.1) {
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

  if (rand(0, 1) < 0.48) {
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
  const step = Math.min(distance - arrivalRadius, npc.speed * dt);
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

  npc.group.rotation.y = lerpAngle(npc.group.rotation.y, Math.atan2(dirX, dirZ), 0.15);

  const walkPhase = time * (4 + npc.speed * 0.9) + npc.phaseOffset;
  const intensity = Math.min(npc.speed / 1.4, 1);
  animateWalk(npc.rig.refs, walkPhase, intensity);
  npc.group.position.y = Math.abs(Math.sin(walkPhase)) * 0.035 * intensity;

  return distance - step <= arrivalRadius + 0.02 ? "reached" : "moving";
}

function getNearestTarget() {
  let best = null;
  let bestDistance = Infinity;

  for (const npc of npcs) {
    const distance = getDistance2D(player.position, npc.group.position);
    if (distance < npc.radius && distance < bestDistance) {
      best = npc;
      bestDistance = distance;
    }
  }

  for (const duck of ducks) {
    const distance = getDistance2D(player.position, duck.group.position);
    if (distance < duck.radius && distance < bestDistance) {
      best = duck;
      bestDistance = distance;
    }
  }

  for (const item of interactables) {
    const distance = getDistance2D(player.position, item.position);
    if (distance < item.radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }

  return best;
}

function updateNpc(npc, dt, time) {
  npc.talkCooldown = Math.max(0, npc.talkCooldown - dt);

  if (npc.pause > 0) {
    npc.pause -= dt;
    applyNpcPose(npc, time);
    return;
  }

  if (npc.state === "idle") {
    npc.stateTimer -= dt;
    applyNpcPose(npc, time);
    if (npc.stateTimer <= 0) {
      chooseNextNpcAction(npc);
    }
    return;
  }

  if (npc.state === "wander") {
    npc.stateTimer -= dt;
    const result = moveNpcTowards(npc, npc.moveTarget, dt, time, 0.26);
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

  const target = getNearestTarget();
  if (!target) {
    setStatus("WASD ou setas para mover. E para interagir.");
    clearSpeech();
    return;
  }

  if (target.lines) {
    setStatus(`${target.name} - aperte E para conversar.`);
    if (speechEl.dataset.locked !== "1") {
      showSpeech(target.previewLine, target.name, "[E] falar");
    }
    return;
  }

  setStatus(`${target.label} - aperte E para interagir.`);
  clearSpeech();
}

function handleInteraction() {
  if (!interactQueued) return;
  interactQueued = false;
  const target = getNearestTarget();
  if (!target) return;

  if (target.lines) {
    const line = pickRandomLine(target);
    target.previewLine = line;
    target.pause = 1.2;
    target.talkCooldown = 0.5;
    speak(line, target.name);
    target.group.rotation.y = lerpAngle(target.group.rotation.y, Math.atan2(player.position.x - target.group.position.x, player.position.z - target.group.position.z), 0.35);
    return;
  }

  if (typeof target.interact === "function") {
    target.interact();
  }
}

const MINIMAP_WORLD = 140;
const MINIMAP_SIZE = 220;
const MINIMAP_SCALE = MINIMAP_SIZE / MINIMAP_WORLD;

function hexFromInt(value) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function worldToMapX(x) {
  return MINIMAP_SIZE / 2 + x * MINIMAP_SCALE;
}

function worldToMapY(z) {
  return MINIMAP_SIZE / 2 + z * MINIMAP_SCALE;
}

function drawMinimap() {
  if (!minimapCtx) return;
  const ctx = minimapCtx;
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  ctx.fillStyle = "#6ea34e";
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  ctx.fillStyle = "rgba(60, 110, 60, 0.45)";
  for (const tree of mapFeatures.trees) {
    const mx = worldToMapX(tree.x);
    const my = worldToMapY(tree.z);
    ctx.beginPath();
    ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#cdc4b1";
  for (const path of mapFeatures.paths) {
    ctx.save();
    ctx.translate(worldToMapX(path.x), worldToMapY(path.z));
    ctx.rotate(path.rotation || 0);
    const w = path.width * MINIMAP_SCALE;
    const h = path.depth * MINIMAP_SCALE;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  for (const b of mapFeatures.buildings) {
    const mx = worldToMapX(b.x);
    const my = worldToMapY(b.z);
    const w = b.width * MINIMAP_SCALE;
    const h = b.depth * MINIMAP_SCALE;
    ctx.fillStyle = hexFromInt(b.color);
    ctx.fillRect(mx - w / 2, my - h / 2, w, h);
    ctx.strokeStyle = hexFromInt(b.roof);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
  }

  ctx.fillStyle = "#f7d36a";
  for (const item of interactables) {
    const mx = worldToMapX(item.position.x);
    const my = worldToMapY(item.position.z);
    ctx.beginPath();
    ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const npc of npcs) {
    const mx = worldToMapX(npc.group.position.x);
    const my = worldToMapY(npc.group.position.z);
    ctx.fillStyle = npc.mapColor || "#ffffff";
    ctx.beginPath();
    ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (const duck of ducks) {
    const mx = worldToMapX(duck.group.position.x);
    const my = worldToMapY(duck.group.position.z);
    ctx.fillStyle = duck.mapColor;
    ctx.beginPath();
    ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const pmx = worldToMapX(player.position.x);
  const pmy = worldToMapY(player.position.z);
  const angle = Math.atan2(facing.x, facing.y);

  ctx.save();
  ctx.translate(pmx, pmy);
  ctx.rotate(-angle);
  ctx.fillStyle = "#62ff9f";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(-4.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, MINIMAP_SIZE - 1, MINIMAP_SIZE - 1);
}

function updateCamera() {
  camera.position.set(player.position.x + 14, player.position.y + 18, player.position.z + 14);
  camera.lookAt(player.position.x, 1.25, player.position.z);
}

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = clock.elapsedTime;

  releaseSpeechLock(dt);
  updatePlayer(dt, time);
  handleInteraction();

  for (const npc of npcs) {
    updateNpc(npc, dt, time);
  }

  for (const duck of ducks) {
    updateDuck(duck, dt, time);
  }

  for (const item of interactables) {
    item.update?.(dt, time);
  }

  updateInteractionUI();
  updateCamera();
  drawMinimap();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}
