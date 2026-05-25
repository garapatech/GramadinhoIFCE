import * as THREE from "three";

export type ElectricNpc = {
  electricAura?: boolean;
  lightningCooldown?: number;
  auraLight?: THREE.PointLight;
  group: THREE.Group;
};

type LightningBolt = {
  lines: THREE.Line[];
  lights: THREE.PointLight[];
  ttl: number;
};

const bolts: LightningBolt[] = [];
let effectWorld: THREE.Object3D | null = null;
let electricPulseTime = 0;

const BOLT_TTL = 0.22;
const STEP_COOLDOWN = 0.11;

const boltMaterial = new THREE.LineBasicMaterial({
  color: 0xe8fcff,
  transparent: true,
  opacity: 1,
  blending: THREE.AdditiveBlending,
});

const boltCoreMaterial = new THREE.LineBasicMaterial({
  color: 0xfff9a8,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
});

function jitterPoint(base: THREE.Vector3, spread: number) {
  return new THREE.Vector3(
    base.x + (Math.random() - 0.5) * spread,
    base.y + (Math.random() - 0.5) * spread * 0.6,
    base.z + (Math.random() - 0.5) * spread
  );
}

function buildBoltPoints(origin: THREE.Vector3, ground: THREE.Vector3, segments = 7) {
  const points: THREE.Vector3[] = [origin.clone()];
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const p = origin.clone().lerp(ground, t);
    const spread = 0.35 + (1 - Math.abs(t - 0.5) * 2) * 0.55;
    p.x += (Math.random() - 0.5) * spread;
    p.y += (Math.random() - 0.5) * spread * 0.45;
    p.z += (Math.random() - 0.5) * spread;
    points.push(p);
  }
  points.push(ground.clone());
  return points;
}

function spawnBolt(origin: THREE.Vector3, ground: THREE.Vector3) {
  if (!effectWorld) return;

  const points = buildBoltPoints(origin, ground);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, boltMaterial);
  line.renderOrder = 1200;
  effectWorld.add(line);

  const corePoints = buildBoltPoints(origin, ground, 5);
  const coreGeometry = new THREE.BufferGeometry().setFromPoints(corePoints);
  const coreLine = new THREE.Line(coreGeometry, boltCoreMaterial);
  coreLine.renderOrder = 1201;
  effectWorld.add(coreLine);

  const flash = new THREE.PointLight(0xb8f7ff, 2.4, 5.5, 2);
  flash.position.copy(ground);
  flash.position.y += 0.15;
  effectWorld.add(flash);

  bolts.push({ lines: [line, coreLine], lights: [flash], ttl: BOLT_TTL });
}

function disposeBolt(bolt: LightningBolt) {
  for (const line of bolt.lines) {
    effectWorld?.remove(line);
    line.geometry.dispose();
  }
  for (const light of bolt.lights) {
    effectWorld?.remove(light);
  }
}

export function initElectricEffects(world: THREE.Object3D) {
  effectWorld = world;
}

export function attachElectricAura(npc: ElectricNpc) {
  npc.electricAura = true;
  npc.lightningCooldown = 0;
  const light = new THREE.PointLight(0x8ee8ff, 0.85, 8, 2);
  light.position.set(0, 1.4, 0);
  npc.group.add(light);
  npc.auraLight = light;
}

export function tryNpcElectricStep(npc: ElectricNpc, moved: boolean) {
  if (!npc.electricAura || !moved || !effectWorld) return;
  if ((npc.lightningCooldown ?? 0) > 0) return;

  npc.lightningCooldown = STEP_COOLDOWN;

  const px = npc.group.position.x;
  const py = npc.group.position.y;
  const pz = npc.group.position.z;
  const ry = npc.group.rotation.y;
  const forwardX = Math.sin(ry);
  const forwardZ = Math.cos(ry);

  const origin = new THREE.Vector3(
    px + (Math.random() - 0.5) * 0.35,
    py + 1.05 + Math.random() * 0.45,
    pz + (Math.random() - 0.5) * 0.35
  );

  const strikeCount = Math.random() < 0.35 ? 2 : 1;
  for (let i = 0; i < strikeCount; i += 1) {
    const side = i === 0 ? 1 : -1;
    const ground = new THREE.Vector3(
      px + forwardX * (0.4 + Math.random() * 1.1) + side * (Math.random() - 0.5) * 1.4,
      py + 0.02,
      pz + forwardZ * (0.4 + Math.random() * 1.1) + side * (Math.random() - 0.5) * 1.4
    );
    spawnBolt(jitterPoint(origin, 0.25), ground);
  }
}

export function tryNpcElectricMotion(npc: ElectricNpc, dx: number, dz: number, dt: number) {
  if (!npc.electricAura || dt <= 0) return;
  const speed = Math.hypot(dx, dz) / dt;
  if (speed < 0.35) return;
  tryNpcElectricStep(npc, true);
}

export function tickElectricCooldowns(npcs: ElectricNpc[], dt: number) {
  const pulse = 0.72 + Math.sin(electricPulseTime * 12) * 0.18;
  let hasElectricAura = false;

  for (const npc of npcs) {
    if (!npc.electricAura) continue;
    hasElectricAura = true;
    const cooldown = npc.lightningCooldown ?? 0;
    if (cooldown > 0) {
      npc.lightningCooldown = Math.max(0, cooldown - dt);
    }
    if (npc.auraLight) {
      npc.auraLight.intensity = pulse;
    }
  }

  if (hasElectricAura) {
    electricPulseTime += dt;
  }
}

export function updateElectricEffects(dt: number) {
  for (let i = bolts.length - 1; i >= 0; i -= 1) {
    const bolt = bolts[i];
    bolt.ttl -= dt;
    const fade = Math.max(0, bolt.ttl / BOLT_TTL);
    for (const line of bolt.lines) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = fade;
    }
    for (const light of bolt.lights) {
      light.intensity = 2.4 * fade;
    }
    if (bolt.ttl <= 0) {
      disposeBolt(bolt);
      bolts.splice(i, 1);
    }
  }
}

export function clearElectricEffects() {
  for (const bolt of bolts) disposeBolt(bolt);
  bolts.length = 0;
  effectWorld = null;
  electricPulseTime = 0;
}
