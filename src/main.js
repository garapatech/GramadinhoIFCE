import * as THREE from "three";
import "./style.css";

const canvas = document.getElementById("scene");
const statusEl = document.getElementById("status");
const speechEl = document.getElementById("speech");

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

const blockers = [];

function addBuilding({ x, z, width, depth, height, color, roof, name }) {
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
}

function createCharacter({
  shirtColor,
  pantsColor,
  shoesColor,
  skinColor,
  backpackColor,
  scale = 1,
  backpack = true
}) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.95 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.98 });
  const shoes = new THREE.MeshStandardMaterial({ color: shoesColor, roughness: 1 });
  const backpackMat = new THREE.MeshStandardMaterial({ color: backpackColor, roughness: 1 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.4, 10), shirt);
  body.position.y = 1.55;
  body.castShadow = true;
  group.add(body);

  if (backpack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.25), backpackMat);
    pack.position.set(0, 1.6, -0.4);
    pack.castShadow = true;
    group.add(pack);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), skin);
  head.position.y = 2.4;
  head.castShadow = true;
  group.add(head);

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.95, 8), shirt);
  leftArm.position.set(-0.62, 1.55, 0);
  leftArm.rotation.z = 0.18;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.62;
  rightArm.rotation.z = -0.18;
  group.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.0, 8), pants);
  leftLeg.position.set(-0.22, 0.55, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.22;
  group.add(rightLeg);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.42), shoes);
  leftShoe.position.set(-0.22, 0.05, 0.12);
  leftShoe.castShadow = true;
  group.add(leftShoe);

  const rightShoe = leftShoe.clone();
  rightShoe.position.x = 0.22;
  group.add(rightShoe);

  return {
    group,
    refs: { leftArm, rightArm, leftLeg, rightLeg, leftShoe, rightShoe }
  };
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
    interact() {
      if (playerState.sitting) return;
      playerState.sitting = true;
      playerState.sitTimer = 2.6;
      playerState.sitTarget = {
        position: sitSpot.clone(),
        rotation: rotation + Math.PI
      };
      speak("Sentando para descansar um pouco.");
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
  interactables.push({
    kind: "fountain",
    label: "Fonte",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    interact() {
      pulse = 1;
      speak("A agua respinga e refresca o caminho.");
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

  interactables.push({
    kind: "board",
    label: "Painel de avisos",
    radius: 3.1,
    position: new THREE.Vector3(x, 0, z),
    interact() {
      speak("Biblioteca ate 21h. Mutirao do gramado sexta.");
    },
    update() {
      frame.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.01);
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

  interactables.push({
    kind: "ball",
    label: "Bola",
    radius: 2.2,
    position,
    interact() {
      const push = new THREE.Vector2(ball.position.x - player.position.x, ball.position.z - player.position.z);
      if (push.lengthSq() < 0.001) push.set(0, -1);
      push.normalize().multiplyScalar(5.2);
      velocity.add(push);
      lift = 0.24;
      speak("A bola sai rolando pelo gramado.");
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

  interactables.push({
    kind: "bike",
    label: "Bicicleta",
    radius: 2.4,
    position: new THREE.Vector3(x, 0, z),
    interact() {
      bike.rotation.y += Math.PI / 8;
      speak("A bicicleta gira no suporte.");
    },
    update() {
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

  interactables.push({
    kind: "lamp",
    label: "Poste",
    radius: 2.2,
    position: new THREE.Vector3(x, 0, z),
    interact() {
      point.intensity = point.intensity > 0.4 ? 0.18 : 0.72;
      speak("O poste acende e apaga com um toque.");
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

function createNpc(config) {
  const rig = createCharacter(config.colors);
  const npc = rig.group;
  world.add(npc);
  npc.position.set(config.start.x, 0, config.start.z);

  const state = {
    name: config.name,
    rig,
    path: config.path,
    index: 0,
    speed: config.speed,
    lines: config.lines,
    lineIndex: 0,
    wait: 0,
    pause: 0,
    talkCooldown: 0,
    radius: 3.2
  };

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
    "Esse banco perto da fonte e um bom ponto para descansar."
  ],
  colors: {
    shirtColor: 0x4363d8,
    pantsColor: 0x23344b,
    shoesColor: 0x202020,
    skinColor: 0xe8b992,
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
    "O fluxo entre os blocos fica melhor quando a rota esta livre."
  ],
  colors: {
    shirtColor: 0xb85a31,
    pantsColor: 0x3a3d46,
    shoesColor: 0x202020,
    skinColor: 0xc98c62,
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
    "Esse mapa ajuda a ler o espaco com mais rapidez."
  ],
  colors: {
    shirtColor: 0x6a4c93,
    pantsColor: 0x34495e,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf1c7aa,
    backpackColor: 0x9b5e4d,
    backpack: true,
    scale: 1
  }
});

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

function speak(text) {
  if (!speechEl) return;
  speechEl.textContent = text;
  speechEl.style.opacity = "1";
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
  speechEl.textContent = "";
  speechEl.style.opacity = "0";
}

function releaseSpeechLock(dt) {
  if (!speechEl) return;
  if (speechEl.dataset.ttl) {
    const ttl = Math.max(0, Number(speechEl.dataset.ttl) - dt);
    speechEl.dataset.ttl = String(ttl);
    if (ttl <= 0) {
      speechEl.dataset.locked = "0";
      speechEl.textContent = "";
      speechEl.style.opacity = "0";
      delete speechEl.dataset.ttl;
    }
  }
}

const playerVelocity = new THREE.Vector2();
const facing = new THREE.Vector2(0, -1);
const playerRadius = 0.55;
const maxSpeed = 7.2;
const accel = 22;
const drag = 10;
const clock = new THREE.Clock();

function clampPlayerToWorld() {
  player.position.x = THREE.MathUtils.clamp(player.position.x, -68, 68);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -68, 68);
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
      speak("Voce se levantou do banco.");
    }
    playerRig.refs.leftArm.rotation.x = 0;
    playerRig.refs.rightArm.rotation.x = 0;
    playerRig.refs.leftLeg.rotation.x = 0;
    playerRig.refs.rightLeg.rotation.x = 0;
    playerRig.refs.leftShoe.rotation.x = 0;
    playerRig.refs.rightShoe.rotation.x = 0;
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

  const walkPhase = time * (4 + speed * 0.5);
  const swing = Math.sin(walkPhase) * Math.min(speed / maxSpeed, 1) * 0.65;
  playerRig.refs.leftArm.rotation.x = swing;
  playerRig.refs.rightArm.rotation.x = -swing;
  playerRig.refs.leftLeg.rotation.x = -swing;
  playerRig.refs.rightLeg.rotation.x = swing;
  playerRig.refs.leftShoe.rotation.x = -swing * 0.4;
  playerRig.refs.rightShoe.rotation.x = swing * 0.4;
  player.position.y = Math.sin(walkPhase * 2) * 0.03;
}

function getDistance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
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
    if (npc.pause <= 0) npc.wait = 0.2;
    return;
  }

  if (npc.wait > 0) {
    npc.wait -= dt;
    return;
  }

  const target = npc.path[npc.index];
  const dx = target.x - npc.group.position.x;
  const dz = target.z - npc.group.position.z;
  const distance = Math.hypot(dx, dz);

  if (distance < 0.24) {
    npc.index = (npc.index + 1) % npc.path.length;
    npc.wait = 0.15 + rand(0, 0.2);
    return;
  }

  const dirX = dx / distance;
  const dirZ = dz / distance;
  npc.group.position.x += dirX * npc.speed * dt;
  npc.group.position.z += dirZ * npc.speed * dt;
  npc.group.rotation.y = lerpAngle(npc.group.rotation.y, Math.atan2(dirX, dirZ), 0.15);

  const swing = Math.sin(time * (4.4 + npc.speed)) * 0.6 * npc.speed;
  npc.rig.refs.leftArm.rotation.x = swing;
  npc.rig.refs.rightArm.rotation.x = -swing;
  npc.rig.refs.leftLeg.rotation.x = -swing;
  npc.rig.refs.rightLeg.rotation.x = swing;
  npc.rig.refs.leftShoe.rotation.x = -swing * 0.35;
  npc.rig.refs.rightShoe.rotation.x = swing * 0.35;
  npc.group.position.y = Math.sin(time * 3 + npc.index) * 0.025;
}

function updateInteractionUI() {
  const target = getNearestTarget();
  if (!target) {
    setStatus("WASD ou setas para mover. E para interagir.");
    clearSpeech();
    return;
  }

  if (target.lines) {
    setStatus(`${target.name} - aperte E para conversar.`);
    if (speechEl.dataset.locked !== "1") {
      speechEl.textContent = target.lines[target.lineIndex % target.lines.length];
      speechEl.style.opacity = "1";
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
    target.lineIndex += 1;
    target.pause = 1.2;
    target.talkCooldown = 0.5;
    speak(target.lines[target.lineIndex % target.lines.length]);
    target.group.rotation.y = lerpAngle(target.group.rotation.y, Math.atan2(player.position.x - target.group.position.x, player.position.z - target.group.position.z), 0.35);
    return;
  }

  if (typeof target.interact === "function") {
    target.interact();
  }
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

window.addEventListener("error", (event) => {
  if (statusEl) {
    statusEl.textContent = `Erro na cena: ${event.message}`;
    statusEl.style.opacity = "1";
  }
});

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = clock.elapsedTime;

  releaseSpeechLock(dt);
  updatePlayer(dt, time);
  handleInteraction();

  for (const npc of npcs) {
    updateNpc(npc, dt, time);
  }

  for (const item of interactables) {
    item.update?.(dt, time);
  }

  updateInteractionUI();
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}
