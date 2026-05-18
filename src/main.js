import * as THREE from "three";
import "./style.css";

const canvas = document.getElementById("scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7d7f7);
scene.fog = new THREE.Fog(0xa7d7f7, 45, 180);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

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

  for (let i = 0; i < 1200; i += 1) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 6 - 3, y + Math.random() * 6 - 3);
    ctx.stroke();
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
  texture.repeat.set(1, 1);
  return texture;
}

const grass = createGrassTexture();
const windowTexture = createWindowTexture();

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
  return { x, z, width, depth, rotation };
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
  return group;
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

const seeded = mulberry32(9917);
function rand(min, max) {
  return min + (max - min) * seeded();
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

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const player = new THREE.Group();
world.add(player);

const skin = new THREE.MeshStandardMaterial({ color: 0xf0c3a5, roughness: 1 });
const shirt = new THREE.MeshStandardMaterial({ color: 0x2f855a, roughness: 0.95 });
const pants = new THREE.MeshStandardMaterial({ color: 0x24364d, roughness: 0.98 });
const shoes = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
const backpack = new THREE.MeshStandardMaterial({ color: 0xb85a31, roughness: 1 });

const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.4, 10), shirt);
body.position.y = 1.55;
body.castShadow = true;
player.add(body);

const torsoPack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.25), backpack);
torsoPack.position.set(0, 1.6, -0.4);
torsoPack.castShadow = true;
player.add(torsoPack);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), skin);
head.position.y = 2.4;
head.castShadow = true;
player.add(head);

const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.95, 8), shirt);
leftArm.position.set(-0.62, 1.55, 0);
leftArm.rotation.z = 0.18;
leftArm.castShadow = true;
player.add(leftArm);

const rightArm = leftArm.clone();
rightArm.position.x = 0.62;
rightArm.rotation.z = -0.18;
player.add(rightArm);

const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.0, 8), pants);
leftLeg.position.set(-0.22, 0.55, 0);
leftLeg.castShadow = true;
player.add(leftLeg);

const rightLeg = leftLeg.clone();
rightLeg.position.x = 0.22;
player.add(rightLeg);

const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.42), shoes);
leftShoe.position.set(-0.22, 0.05, 0.12);
leftShoe.castShadow = true;
player.add(leftShoe);

const rightShoe = leftShoe.clone();
rightShoe.position.x = 0.22;
player.add(rightShoe);

player.position.set(-40, 0, 38);

const keys = new Set();
window.addEventListener("keydown", (event) => keys.add(event.code));
window.addEventListener("keyup", (event) => keys.delete(event.code));

function getInputVector() {
  const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  return new THREE.Vector2(x, z);
}

const velocity = new THREE.Vector2();
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
    const inside = px > minX && px < maxX && pz > minZ && pz < maxZ;
    if (!inside) continue;

    if (axis === "x") {
      player.position.x = px < (box.minX + box.maxX) / 2 ? minX : maxX;
      velocity.x = 0;
    } else {
      player.position.z = pz < (box.minZ + box.maxZ) / 2 ? minZ : maxZ;
      velocity.y = 0;
    }
  }
}

function updatePlayer(dt, time) {
  const input = getInputVector();
  if (input.lengthSq() > 0) {
    input.normalize();
    velocity.addScaledVector(input, accel * dt);
    facing.copy(input);
  } else {
    const decay = Math.max(0, 1 - drag * dt);
    velocity.multiplyScalar(decay);
  }

  const speed = velocity.length();
  if (speed > maxSpeed) velocity.setLength(maxSpeed);

  player.position.x += velocity.x * dt;
  resolveCollisions("x");
  player.position.z += velocity.y * dt;
  resolveCollisions("z");
  clampPlayerToWorld();

  if (facing.lengthSq() > 0.001) {
    const angle = Math.atan2(facing.x, facing.y);
    player.rotation.y = lerpAngle(player.rotation.y, angle, 0.16);
  }

  const walkPhase = time * (4 + speed * 0.5);
  const swing = Math.sin(walkPhase) * Math.min(speed / maxSpeed, 1) * 0.65;
  leftArm.rotation.x = swing;
  rightArm.rotation.x = -swing;
  leftLeg.rotation.x = -swing;
  rightLeg.rotation.x = swing;
  leftShoe.rotation.x = -swing * 0.4;
  rightShoe.rotation.x = swing * 0.4;
  player.position.y = Math.sin(walkPhase * 2) * 0.03;
}

function updateCamera() {
  const offset = new THREE.Vector3(14, 16, 14);
  const target = new THREE.Vector3().copy(player.position).add(offset);
  camera.position.lerp(target, 0.07);
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
  updatePlayer(dt, time);
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}
