import * as THREE from "three";

// ── Types ─────────────────────────────────────────────────────────────────────

type MoveAxis = "x" | "z" | "y" | null;

type PlatformDef = {
  baseX: number; baseZ: number; baseY: number;
  w: number; d: number;
  moveAxis: MoveAxis; moveAmp: number; moveSpeed: number; movePhase: number;
  isCheckpoint: boolean;
};

type PlatformRuntime = PlatformDef & {
  mesh: THREE.Mesh;
  currentX: number; currentZ: number; currentY: number;
};

export type ParkourOptions = {
  world: THREE.Group;
  player: THREE.Group & { position: THREE.Vector3; rotation: { y: number } };
  playerState: { jumping: boolean; jumpY: number; jumpVel: number };
  playerVelocity: THREE.Vector2;
  speak: (text: string, speaker: string) => void;
  interactables: any[];
  container?: HTMLElement | null;
  isKeyDown?: (code: string) => boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const JUMP_VEL_BOOST = 10.5;
const FALL_GRAVITY   = 26;
const LAND_TOL       = 0.35;
const VOID_Y         = -1.5;

// ── Raw platform data ─────────────────────────────────────────────────────────
// [bx, bz, by, w, d, moveAxis(0=none,1=x,2=z,3=y), amp, speed, phase, checkpoint]
const RAW: readonly (number | boolean)[][] = [
  // TOPO DA RAMPA + salto curto até o circuito
  [-30, -86, 4.0,  4, 3,  0,   0,   0,    0,    false],  // aterrissagem do topo da rampa
  [-26, -82, 4.0,  3, 2,  0,   0,   0,    0,    true],   // CHECKPOINT 1 – perto da 1ª plat.

  // FACE NORTE – indo para leste (z≈-79 a -82, y 4→8)
  [-22, -79, 4.0,  2.5, 2, 0,   0,   0,    0,    false],
  [-14, -81, 4.5,  2,   2, 1,   2.5, 1.0,  0.0,  false],
  [ -6, -79, 5.0,  2,   2, 0,   0,   0,    0,    true],   // CHECKPOINT NORTE-1
  [  2, -81, 5.5,  1.5, 1.5, 2, 1.5, 1.2,  1.0,  false],
  [ 10, -79, 6.0,  2,   2, 0,   0,   0,    0,    false],
  [ 18, -81, 6.0,  2,   2, 1,   3.0, 0.9,  0.5,  false],
  [ 26, -79, 6.5,  1.5, 1.5, 0, 0,   0,    0,    false],
  [ 34, -81, 7.0,  2.5, 2.5, 2, 2.5, 1.4,  0.0,  false],
  [ 42, -79, 7.0,  2,   2, 0,   0,   0,    0,    true],   // CHECKPOINT NORTE-2
  [ 50, -81, 7.5,  1.5, 1.5, 1, 3.5, 1.3,  1.5,  false],
  [ 58, -79, 8.0,  2,   2, 0,   0,   0,    0,    false],
  [ 66, -81, 8.0,  2,   2, 2,   2.0, 1.1,  0.8,  false],
  [ 72, -77, 8.0,  3,   2, 0,   0,   0,    0,    false],

  // CANTO NE
  [ 77, -74, 8.0,  2,   2, 0,   0,   0,    0,    false],
  [ 79, -68, 8.5,  2,   2, 0,   0,   0,    0,    false],

  // FACE LESTE – indo para sul (x≈79-81, y 8.5→14)
  [ 79, -58, 8.5,  2,   2, 2,   3.0, 1.0,  0.0,  false],
  [ 81, -48, 9.0,  1.5, 1.5, 0, 0,   0,    0,    false],
  [ 79, -38, 9.5,  2,   2, 2,   4.0, 1.2,  0.7,  true],   // CHECKPOINT LESTE-1
  [ 81, -28, 10.0, 2,   2, 0,   0,   0,    0,    false],
  [ 79, -18, 10.5, 2.5, 2.5, 2, 3.0, 1.3,  0.0,  false],
  [ 81,  -8, 11.0, 2,   2, 0,   0,   0,    0,    true],   // CHECKPOINT LESTE-2
  [ 79,   2, 11.5, 2,   2, 2,   3.0, 0.8,  1.0,  false],
  [ 81,  12, 12.0, 1.5, 1.5, 0, 0,   0,    0,    false],
  [ 79,  22, 12.5, 2,   2, 2,   4.0, 1.4,  0.3,  true],   // CHECKPOINT LESTE-3
  [ 81,  32, 13.0, 2,   2, 0,   0,   0,    0,    false],
  [ 79,  42, 13.0, 2.5, 2.5, 2, 2.5, 1.5,  0.5,  false],
  [ 81,  52, 13.5, 2,   2, 0,   0,   0,    0,    false],
  [ 79,  62, 14.0, 2,   2, 2,   3.0, 1.1,  1.2,  true],   // CHECKPOINT LESTE-4
  [ 80,  71, 14.0, 3,   2, 0,   0,   0,    0,    false],

  // CANTO SE
  [ 76,  77, 14.0, 2,   2, 0,   0,   0,    0,    false],
  [ 70,  79, 14.0, 2,   2, 0,   0,   0,    0,    false],

  // FACE SUL – indo para oeste (z≈79-82, y 14→18)
  [ 60,  79, 14.5, 2,   2, 1,   3.0, 1.2,  0.0,  false],
  [ 50,  81, 15.0, 1.5, 1.5, 0, 0,   0,    0,    true],   // CHECKPOINT SUL-1
  [ 40,  79, 15.5, 2,   2, 1,   4.0, 1.0,  0.5,  false],
  [ 30,  81, 15.5, 2.5, 2.5, 1, 2.5, 1.6,  0.0,  false],
  [ 20,  79, 16.0, 1.5, 1.5, 0, 0,   0,    0,    true],   // CHECKPOINT SUL-2
  [ 10,  81, 16.5, 2,   2, 1,   3.5, 1.3,  1.0,  false],
  [  0,  79, 16.5, 2,   2, 0,   0,   0,    0,    false],
  [-10,  81, 17.0, 1.5, 1.5, 1, 4.0, 1.4,  0.8,  false],
  [-20,  79, 17.0, 2,   2, 0,   0,   0,    0,    true],   // CHECKPOINT SUL-3
  [-30,  81, 17.5, 2,   2, 1,   3.0, 0.9,  1.5,  false],
  [-40,  79, 18.0, 1.5, 1.5, 0, 0,   0,    0,    false],
  [-50,  81, 18.0, 2.5, 2.5, 1, 2.5, 1.2,  0.2,  false],
  [-60,  79, 18.0, 2,   2, 0,   0,   0,    0,    true],   // CHECKPOINT SUL-4
  [-70,  81, 18.0, 3,   2, 0,   0,   0,    0,    false],

  // CANTO SO
  [-76,  77, 18.0, 2,   2, 0,   0,   0,    0,    false],
  [-79,  70, 18.0, 2,   2, 0,   0,   0,    0,    false],

  // FACE OESTE – indo para norte (x≈-79/-81, y 18→24)
  [-79,  60, 18.5, 2,   2, 2,   3.0, 1.2,  0.0,  true],   // CHECKPOINT OESTE-1
  [-81,  50, 19.0, 1.5, 1.5, 0, 0,   0,    0,    false],
  [-79,  40, 19.5, 2,   2, 2,   4.0, 1.1,  0.7,  false],
  [-81,  30, 20.0, 2.5, 2.5, 2, 2.5, 1.5,  0.0,  true],   // CHECKPOINT OESTE-2
  [-79,  20, 20.5, 2,   2, 0,   0,   0,    0,    false],
  [-81,  10, 21.0, 1.5, 1.5, 2, 3.0, 1.3,  1.0,  false],
  [-79,   0, 21.5, 2,   2, 0,   0,   0,    0,    true],   // CHECKPOINT OESTE-3
  [-81, -10, 22.0, 2.5, 2.5, 2, 2.5, 1.6,  0.5,  false],
  [-79, -20, 22.5, 2,   2, 2,   4.0, 1.4,  0.3,  false],
  [-81, -30, 23.0, 1.5, 1.5, 0, 0,   0,    0,    true],   // CHECKPOINT OESTE-4
  [-79, -40, 23.5, 2,   2, 2,   3.0, 1.0,  1.2,  false],
  [-81, -50, 24.0, 1.5, 1.5, 0, 0,   0,    0,    false],
  [-79, -60, 24.0, 2,   2, 2,   3.5, 1.5,  0.8,  true],   // CHECKPOINT OESTE-5

  // ASCENSÃO FINAL – rumo ao aviãozinho
  [-79, -66, 24.0, 2,   2, 0,   0,   0,    0,    false],
  [-80, -70, 24.5, 2,   2, 0,   0,   0,    0,    false],
  [-80, -74, 25.0, 2,   2, 0,   0,   0,    0,    false],
  [-80, -77, 25.5, 2,   2, 0,   0,   0,    0,    false],
  [-79, -80, 26.0, 8.0, 8.0, 0, 0,   0,    0,    false],  // TOPO – plataforma do aviãozinho (grande e segura)
];

const MOVE_AXIS_MAP: MoveAxis[] = [null, "x", "z", "y"];

function parsePlatforms(): PlatformDef[] {
  return RAW.map((r) => ({
    baseX:        r[0] as number,
    baseZ:        r[1] as number,
    baseY:        r[2] as number,
    w:            r[3] as number,
    d:            r[4] as number,
    moveAxis:     MOVE_AXIS_MAP[r[5] as number],
    moveAmp:      r[6] as number,
    moveSpeed:    r[7] as number,
    movePhase:    r[8] as number,
    isCheckpoint: r[9] as boolean,
  }));
}

// ── Ramp ─────────────────────────────────────────────────────────────────────

// Spawn do jogador: x=-34, z=-77
// Rampa deslocada para x=-20 (14 unidades a leste do spawn) → sem sobreposição
// z começa em -79.5 → jogador em z=-77 não entra na rampa acidentalmente
const RAMP_X        = -30;
const RAMP_HALF_W   = 2.0;     // x de -32 a -28 → spawn em x=-34 está fora ✓
const RAMP_Z_START  = -79.5;   // lado sul (nível do chão)
const RAMP_Z_END    = -85.5;   // lado norte (topo y=4)
const RAMP_Y_TOP    = 4.0;
const RAMP_LENGTH_Z = RAMP_Z_START - RAMP_Z_END;  // 6.0

function getRampY(pz: number): number {
  const t = THREE.MathUtils.clamp((RAMP_Z_START - pz) / RAMP_LENGTH_Z, 0, 1);
  return t * RAMP_Y_TOP;
}

function isInRampZone(px: number, pz: number): boolean {
  return (
    Math.abs(px - RAMP_X) <= RAMP_HALF_W &&
    pz <= RAMP_Z_START &&
    pz >= RAMP_Z_END
  );
}

function buildRamp(world: THREE.Group): THREE.Mesh {
  const dz        = Math.abs(RAMP_Z_END - RAMP_Z_START);   // 6.0
  const dy        = RAMP_Y_TOP;                              // 4.0
  const slopeLen  = Math.sqrt(dz * dz + dy * dy);
  const slopeAng  = Math.atan2(dy, dz);

  const mat = new THREE.MeshStandardMaterial({ color: 0x4a8a46, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(RAMP_HALF_W * 2, 0.5, slopeLen), mat);

  // Centro da rampa: meio do percurso XZ e metade da altura
  mesh.position.set(RAMP_X, dy / 2, (RAMP_Z_START + RAMP_Z_END) / 2);
  mesh.rotation.x = slopeAng;   // inclina o lado -Z para cima
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

// ── Colors ────────────────────────────────────────────────────────────────────

function platformColor(def: PlatformDef): number {
  if (def.isCheckpoint)        return 0xf0c040;
  if (def.moveAxis === "y")    return 0xc04030;
  if (def.moveAxis !== null)   return 0xd4821e;
  if (def.w <= 1.6)            return 0x7a3fa0;
  if (def.baseZ >= -82 && def.baseZ <= -78 && def.baseX === -32) return 0x3a7a38;
  return 0x8a9ba8;
}

// ── Flag builder ──────────────────────────────────────────────────────────────

function buildParkourFlag(world: THREE.Group): THREE.Group {
  const group = new THREE.Group();

  // Mastro
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.10, 7, 10),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 })
  );
  pole.position.y = 3.5;
  pole.castShadow = true;
  group.add(pole);

  // Base do mastro
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a2810, roughness: 1 })
  );
  base.position.y = 0.25;
  group.add(base);

  // Ponta dourada
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.38, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.5, metalness: 0.4 })
  );
  tip.position.y = 7.19;
  group.add(tip);

  // Bandeira – canvas texture com "PARKOUR"
  const canvas = document.createElement("canvas");
  canvas.width  = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // fundo verde IFCE
  ctx.fillStyle = "#1e7a3c";
  ctx.fillRect(0, 0, 256, 128);

  // faixa branca central
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 40, 256, 48);

  // texto
  ctx.fillStyle = "#1e7a3c";
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PARKOUR", 128, 64);

  // borda
  ctx.strokeStyle = "#f0c040";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 122);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6, 12, 6),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 })
  );
  cloth.geometry.translate(1.6, 0, 0);
  cloth.position.set(0.1, 6.1, 0);
  group.add(cloth);

  // Guardar posições base para animar
  const clothPositions  = cloth.geometry.attributes.position;
  const basePositions   = new Float32Array(clothPositions.array);
  (group as any)._clothMesh = cloth;
  (group as any)._basePos   = basePositions;

  group.position.set(-24, 0, -80);
  world.add(group);

  return group;
}

// ── Airplane builder ──────────────────────────────────────────────────────────

function buildAirplane(world: THREE.Group, x: number, z: number, y: number): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, y, z);

  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.7 });
  const green = new THREE.MeshStandardMaterial({ color: 0x1e7a3c, roughness: 0.8 });
  const gray  = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9bd4f5, transparent: true, opacity: 0.6, roughness: 0.1 });

  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.1, 1.4), white);
  fuselage.castShadow = true;
  root.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 10), white);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 4.35;
  nose.castShadow = true;
  root.add(nose);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.28, 1.42), green);
  stripe.position.y = 0.08;
  root.add(stripe);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 10.0), white);
  wings.position.set(0.2, -0.3, 0);
  wings.castShadow = true;
  root.add(wings);

  const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.20, 10.0), green);
  wingStripe.position.set(0.2, -0.38, 0);
  root.add(wingStripe);

  const hTail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 4.2), white);
  hTail.position.set(-3.2, 0, 0);
  hTail.castShadow = true;
  root.add(hTail);

  const vTail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 0.2), white);
  vTail.position.set(-3.1, 0.7, 0);
  vTail.castShadow = true;
  root.add(vTail);

  const vTailStripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.22), green);
  vTailStripe.position.set(-3.1, 0.4, 0);
  root.add(vTailStripe);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.1), glass);
  cockpit.position.set(2.6, 0.62, 0);
  root.add(cockpit);

  const propPivot = new THREE.Group();
  propPivot.position.set(4.9, 0, 0);
  root.add(propPivot);

  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.22), gray);
  blade1.castShadow = true;
  propPivot.add(blade1);
  const blade2 = blade1.clone();
  blade2.rotation.z = Math.PI / 2;
  propPivot.add(blade2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 12), gray);
  hub.rotation.z = Math.PI / 2;
  propPivot.add(hub);

  for (const side of [-0.55, 0.55]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), gray);
    strut.position.set(1.0, -0.72, side);
    strut.castShadow = true;
    root.add(strut);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 12), gray);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(1.0, -1.0, side);
    root.add(wheel);
  }

  const tailStrut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), gray);
  tailStrut.position.set(-3.3, -0.58, 0);
  tailStrut.castShadow = true;
  root.add(tailStrut);

  const tailWheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 12), gray);
  tailWheel.rotation.y = Math.PI / 2;
  tailWheel.position.set(-3.3, -0.78, 0);
  root.add(tailWheel);

  const navLight = new THREE.PointLight(0x62ff9f, 1.0, 8, 2);
  navLight.position.set(-3.1, 1.6, 0);
  root.add(navLight);

  world.add(root);
  return root;
}

// ── Parkour pigeons ───────────────────────────────────────────────────────────

// [centerX, centerZ, flyHeight, orbitRadius, angularSpeed, startPhase]
const PATROL_DATA: readonly number[][] = [
  // Face norte
  [ -8, -80,  5.5, 4.0,  1.3, 0.0],
  [ 22, -80,  6.5, 3.5, -1.5, 1.0],
  [ 50, -80,  7.5, 3.2,  1.2, 2.1],
  // Canto NE
  [ 76, -75,  8.2, 2.8,  2.0, 0.5],
  // Face leste
  [ 80, -35, 10.0, 3.5, -1.4, 0.0],
  [ 80,   5, 11.8, 3.2,  1.6, 1.6],
  [ 80,  47, 13.2, 3.5, -1.3, 0.9],
  // Face sul
  [ 35,  80, 15.0, 3.5,  1.5, 0.3],
  [-15,  80, 16.5, 3.0, -1.7, 1.3],
  [-55,  80, 17.5, 3.5,  1.2, 2.3],
  // Face oeste
  [-80,  42, 19.5, 3.2, -1.5, 0.0],
  [-80,   2, 21.2, 3.5,  1.8, 1.1],
  [-80, -28, 23.0, 3.0, -1.6, 2.2],
  // Ascensão final – mais rápidos e densos
  [-80, -52, 24.5, 2.5,  2.4, 0.7],
  [-80, -68, 25.0, 2.0, -2.8, 1.8],
];

type ParkourPigeonState = {
  group: THREE.Group;
  head: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  cx: number; cz: number; cy: number;
  radius: number;
  angSpeed: number;
  phase: number;
  flapPhase: number;
  hitCooldown: number;
};

function buildParkourPigeon(world: THREE.Group): ParkourPigeonState {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9099a6, roughness: 0.94 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x5d666f, roughness: 0.9  });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xd99332, roughness: 0.7  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), bodyMat);
  body.scale.set(1.22, 0.92, 1.5);
  body.position.y = 0.24;
  body.castShadow = true;
  root.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.28);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bodyMat);
  skull.castShadow = true;
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), beakMat);
  beak.position.set(0, -0.01, 0.09);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);
  root.add(head);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.62), wingMat);
  leftWing.position.set(-0.2, 0.29, 0.02);
  leftWing.rotation.z = 0.28;
  leftWing.castShadow = true;
  root.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x = 0.2;
  rightWing.rotation.z = -0.28;
  root.add(rightWing);

  world.add(root);
  return { group: root, head, leftWing: leftWing as THREE.Mesh, rightWing: rightWing as THREE.Mesh,
           cx: 0, cz: 0, cy: 0, radius: 3, angSpeed: 1, phase: 0, flapPhase: 0, hitCooldown: 0 };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createParkourCircuit(opts: ParkourOptions) {
  const { world, player, playerState, playerVelocity, speak, interactables, container, isKeyDown } = opts;
  const keyDown = isKeyDown ?? (() => false);
  const MIN_FLY_Y = 10;  // altura mínima — acima de todos os prédios (~7u)
  const MAX_FLY_Y = 52;

  // Build platforms
  const defs = parsePlatforms();
  const platforms: PlatformRuntime[] = defs.map((def) => {
    const mat = new THREE.MeshStandardMaterial({
      color: platformColor(def),
      roughness: 0.88,
      metalness: 0.04,
    });
    if (def.isCheckpoint) {
      (mat as any).emissive    = new THREE.Color(0x906000);
      (mat as any).emissiveIntensity = 0.25;
    }

    // Plataformas estáticas: coluna sólida do chão até a superfície (evita flutuar)
    // Plataformas móveis: caixa fina (se movem, não podem ter coluna)
    const isStatic    = def.moveAxis === null;
    const meshH       = isStatic ? def.baseY : 0.4;
    const meshCenterY = isStatic ? def.baseY / 2 : def.baseY - 0.2;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, meshH, def.d), mat);
    mesh.position.set(def.baseX, meshCenterY, def.baseZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
    return { ...def, mesh, currentX: def.baseX, currentZ: def.baseZ, currentY: def.baseY };
  });

  // Rampa de entrada
  const rampMesh = buildRamp(world);

  // Pombos patrulheiros
  const parkourPigeons: ParkourPigeonState[] = PATROL_DATA.map((d) => {
    const p = buildParkourPigeon(world);
    p.cx       = d[0]; p.cz = d[1]; p.cy = d[2];
    p.radius   = d[3]; p.angSpeed = d[4]; p.phase = d[5];
    p.flapPhase = Math.random() * Math.PI * 2;
    p.hitCooldown = 0;
    p.group.position.set(p.cx + p.radius, p.cy, p.cz);
    return p;
  });

  // Bandeira na entrada
  const flagGroup = buildParkourFlag(world);

  // Avião no topo
  const AIRPLANE_X = -77;
  const AIRPLANE_Z = -83;
  const AIRPLANE_Y = 27.4;
  const airplaneGroup = buildAirplane(world, AIRPLANE_X, AIRPLANE_Z, AIRPLANE_Y);
  airplaneGroup.rotation.y = -Math.PI / 2;
  airplaneGroup.scale.setScalar(0.55);
  // Desativa frustum culling para o avião não sumir durante o voo
  airplaneGroup.traverse((obj) => { obj.frustumCulled = false; });
  const propPivot = airplaneGroup.children.find((c) => c instanceof THREE.Group) as THREE.Group;

  // ── DOM: botão Sair do Parkour ─────────────────────────────────────────────

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.textContent = "✕  Sair do Parkour";
  Object.assign(exitBtn.style, {
    position:       "absolute",
    bottom:         "88px",
    left:           "50%",
    transform:      "translateX(-50%)",
    padding:        "10px 22px",
    background:     "rgba(10, 60, 24, 0.88)",
    color:          "#62ff9f",
    border:         "2px solid #62ff9f",
    borderRadius:   "8px",
    fontSize:       "15px",
    fontWeight:     "700",
    fontFamily:     "inherit",
    cursor:         "pointer",
    zIndex:         "500",
    display:        "none",
    letterSpacing:  "0.04em",
    backdropFilter: "blur(4px)",
    transition:     "background 0.15s",
  });
  exitBtn.addEventListener("mouseenter", () => {
    exitBtn.style.background = "rgba(20, 100, 40, 0.95)";
  });
  exitBtn.addEventListener("mouseleave", () => {
    exitBtn.style.background = "rgba(10, 60, 24, 0.88)";
  });
  exitBtn.addEventListener("click", exitParkour);
  container?.appendChild(exitBtn);


  // ── Timer HUD ──────────────────────────────────────────────────────────────

  const timerEl = document.createElement("div");
  Object.assign(timerEl.style, {
    position:        "absolute",
    top:             "14px",
    left:            "50%",
    transform:       "translateX(-50%)",
    padding:         "6px 18px",
    background:      "rgba(10, 40, 18, 0.82)",
    color:           "#62ff9f",
    border:          "2px solid #62ff9f",
    borderRadius:    "8px",
    fontSize:        "20px",
    fontWeight:      "800",
    fontFamily:      "monospace, 'Courier New'",
    letterSpacing:   "0.08em",
    zIndex:          "500",
    display:         "none",
    textAlign:       "center",
    backdropFilter:  "blur(4px)",
    pointerEvents:   "none",
    minWidth:        "130px",
  });
  timerEl.textContent = "00:00.0";
  container?.appendChild(timerEl);

  // ── State ──────────────────────────────────────────────────────────────────

  const state = {
    active:           false,
    floorY:           0,
    fallVel:          0,
    prevAbsY:         0,
    wasJumping:       false,
    checkpoint:       { x: -26, z: -82, y: 4.0 },
    voidCooldown:     0,
    completedParkour: false,
    elapsedTime:      0,
    bestTime:         Infinity,
    isRiding:         false,
    rideX:            0,
    rideZ:            0,
    rideY:            0,
    rideHeading:      0,
    rideBank:         0,
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getHighestPlatformBelow(px: number, pz: number, maxAbsY: number): number | null {
    let best: number | null = null;
    // Rampa
    if (isInRampZone(px, pz)) {
      const ry = getRampY(pz);
      if (ry <= maxAbsY + 0.5) best = ry;
    }
    // Plataformas
    for (const p of platforms) {
      if (Math.abs(px - p.currentX) > p.w / 2 + 0.18) continue;
      if (Math.abs(pz - p.currentZ) > p.d / 2 + 0.18) continue;
      if (p.currentY > maxAbsY + 0.5) continue;
      if (best === null || p.currentY > best) best = p.currentY;
    }
    return best;
  }

  function getCheckpointAt(px: number, pz: number, floorY: number): { x: number; z: number; y: number } | null {
    for (const p of platforms) {
      if (!p.isCheckpoint) continue;
      if (Math.abs(floorY - p.currentY) > 0.25) continue;
      if (Math.abs(px - p.currentX) > p.w / 2) continue;
      if (Math.abs(pz - p.currentZ) > p.d / 2) continue;
      return { x: p.currentX, z: p.currentZ, y: p.currentY };
    }
    return null;
  }

  // Empurra o jogador para fora do volume lateral das plataformas
  function resolveSideCollisions(absY: number) {
    const r = 0.5; // raio horizontal do jogador
    for (const p of platforms) {
      // Altura sólida da plataforma:
      // - estática (coluna): 0 a currentY
      // - móvel (caixa fina 0.4): currentY-0.4 a currentY
      const topY = p.currentY;
      const botY = p.moveAxis === null ? 0 : topY - 0.5;

      // Sem sobreposição vertical → sem colisão lateral
      // absY >= topY - 0.1: player está em cima da superfície, não empurrar
      if (absY < botY - 0.05 || absY >= topY - 0.1) continue;

      const halfW = p.w / 2 + r;
      const halfD = p.d / 2 + r;
      const dx = player.position.x - p.currentX;
      const dz = player.position.z - p.currentZ;

      // Sem sobreposição horizontal → sem colisão
      if (Math.abs(dx) >= halfW || Math.abs(dz) >= halfD) continue;

      // Eixo de menor sobreposição → empurrar por ali
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        player.position.x += dx >= 0 ? overlapX : -overlapX;
        if (Math.sign(playerVelocity.x) !== Math.sign(dx)) playerVelocity.x = 0;
      } else {
        player.position.z += dz >= 0 ? overlapZ : -overlapZ;
        if (Math.sign(playerVelocity.y) !== Math.sign(dz)) playerVelocity.y = 0;
      }
    }
  }

  function landOn(platY: number, px: number, pz: number) {
    state.floorY  = platY;
    state.fallVel = 0;
    playerState.jumpY   = 0;
    playerState.jumpVel = 0;
    playerState.jumping = false;
    const cp = getCheckpointAt(px, pz, platY);
    if (cp) state.checkpoint = cp;
  }

  function teleportToCheckpoint() {
    state.voidCooldown = 1.6;
    state.fallVel      = 0;
    state.floorY       = state.checkpoint.y;
    playerVelocity.set(0, 0);
    playerState.jumping = false;
    playerState.jumpY   = 0;
    playerState.jumpVel = 0;
    player.position.x   = state.checkpoint.x;
    player.position.z   = state.checkpoint.z;
    speak("Você caiu! Voltando ao checkpoint...", "Parkour");
  }

  function exitParkour() {
    if (state.isRiding) stopRiding();
    state.active      = false;
    state.floorY      = 0;
    state.fallVel     = 0;
    state.elapsedTime = 0;
    playerVelocity.set(0, 0);
    playerState.jumping = false;
    playerState.jumpY   = 0;
    playerState.jumpVel = 0;
    // Teleporta de volta para a entrada do campus
    player.position.x = -34;
    player.position.z = -73.5;
    exitBtn.style.display = "none";
    speak("Você saiu do parkour.", "Parkour");
  }

  // ── Airplane interactable ──────────────────────────────────────────────────

  const RIDE_RADIUS = 52;
  const RIDE_Y      = AIRPLANE_Y;
  const RIDE_SPEED  = 0.10; // rad/s — volta completa em ~63s

  function formatTime(t: number) {
    const m  = Math.floor(t / 60);
    const s  = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${ms}`;
  }

  function startRiding() {
    state.isRiding    = true;
    state.rideX       = airplaneGroup.position.x;
    state.rideZ       = airplaneGroup.position.z;
    state.rideY       = airplaneGroup.position.y;
    state.rideHeading = -Math.PI / 2;
    state.rideBank    = 0;
    playerVelocity.set(0, 0);
    playerState.jumping = false;
    playerState.jumpY   = 0;
    playerState.jumpVel = 0;
    // Garante que o avião nunca seja culled enquanto o jogador estiver pilotando
    airplaneInteractable.cullRadius   = 99999;
    airplaneInteractable.cullDistance = 99999;
    airplaneGroup.visible = true;
    speak("Decolando! Use WASD para pilotar. Pressione E para pousar.", "Aviãozinho do IFCE");
  }

  function stopRiding() {
    state.isRiding = false;
    // Restaura parâmetros normais de culling
    airplaneInteractable.cullRadius   = 10;
    airplaneInteractable.cullDistance = 160;
    // Pousa de volta na plataforma do topo
    airplaneGroup.position.set(AIRPLANE_X, AIRPLANE_Y, AIRPLANE_Z);
    airplaneGroup.rotation.set(0, -Math.PI / 2, 0);
    player.position.x = -79;
    player.position.z = -80;
    state.floorY  = 26.0;
    state.fallVel = 0;
    playerVelocity.set(0, 0);
    airplaneInteractable.position.set(AIRPLANE_X, AIRPLANE_Y, AIRPLANE_Z);
    speak("Você pousou o aviãozinho. Que voo!", "Aviãozinho do IFCE");
  }

  const airplaneInteractable: any = {
    kind: "airplane",
    label: "Aviãozinho do IFCE",
    radius: 5.5,
    position: new THREE.Vector3(AIRPLANE_X, AIRPLANE_Y, AIRPLANE_Z),
    root: airplaneGroup,
    cullPosition: new THREE.Vector3(AIRPLANE_X, AIRPLANE_Y, AIRPLANE_Z),
    cullRadius: 10,
    cullDistance: 160,
    npcDisabled: () => true,
    isDisabledForPlayer: () => !state.isRiding && !(state.active && state.floorY >= 25.5),
    interact() {
      if (state.isRiding) {
        stopRiding();
        return;
      }
      // Registra tempo e parabeniza
      const t = state.elapsedTime;
      const isRecord = t < state.bestTime;
      if (isRecord && t > 0) state.bestTime = t;
      if (!state.completedParkour) {
        state.completedParkour = true;
        speak(
          `PARABÉNS! Parkour em ${formatTime(t)}! Agora pode pilotar o aviãozinho!`,
          "Aviãozinho do IFCE"
        );
      } else {
        const bestStr = formatTime(state.bestTime);
        speak(
          `Recorde: ${bestStr}. Agora pilotar é sua recompensa!`,
          "Aviãozinho do IFCE"
        );
      }
      startRiding();
    },
    update(dt: number, _time: number) {
      if (!state.isRiding) {
        if (propPivot) propPivot.rotation.x += dt * 4;
        const navL = airplaneGroup.children.find((c) => c instanceof THREE.PointLight) as THREE.PointLight | undefined;
        if (navL) navL.intensity = 0.7 + Math.sin(_time * 4.0) * 0.4;
      }
    },
  };
  interactables.push(airplaneInteractable);

  // ── Public API ─────────────────────────────────────────────────────────────

  function isInParkourZone(): boolean {
    return state.active;
  }

  function update(dt: number, time: number) {
    // Plataformas móveis
    for (const p of platforms) {
      if (!p.moveAxis) {
        p.currentX = p.baseX; p.currentZ = p.baseZ; p.currentY = p.baseY;
        continue;
      }
      const offset = Math.sin(time * p.moveSpeed + p.movePhase) * p.moveAmp;
      if      (p.moveAxis === "x") { p.currentX = p.baseX + offset; p.currentZ = p.baseZ;        p.currentY = p.baseY; }
      else if (p.moveAxis === "z") { p.currentX = p.baseX;          p.currentZ = p.baseZ + offset; p.currentY = p.baseY; }
      else                          { p.currentX = p.baseX;          p.currentZ = p.baseZ;          p.currentY = p.baseY + Math.abs(offset); }
      // Centro visual da plataforma móvel (caixa fina 0.4): topo está em currentY, centro em currentY-0.2
      p.mesh.position.set(p.currentX, p.currentY - 0.2, p.currentZ);
    }

    // Animar bandeira
    const cloth     = (flagGroup as any)._clothMesh as THREE.Mesh | undefined;
    const basePos   = (flagGroup as any)._basePos   as Float32Array | undefined;
    if (cloth && basePos) {
      const pos = cloth.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const idx  = i * 3;
        const bx   = basePos[idx];
        const xRatio = bx / 3.2;
        const wave = Math.sin(time * 4.5 + xRatio * 9) * 0.08 * xRatio;
        (pos.array as Float32Array)[idx + 2] = basePos[idx + 2] + wave;
        (pos.array as Float32Array)[idx + 1] = basePos[idx + 1] + Math.sin(time * 2.0 + xRatio * 4) * 0.02 * xRatio;
      }
      pos.needsUpdate = true;
    }

    if (state.voidCooldown > 0) state.voidCooldown -= dt;

    // ── Aviãozinho: hélice e luz (posição controlada em postUpdatePlayer) ────
    if (state.isRiding) {
      if (propPivot) propPivot.rotation.x += dt * 22;
    } else {
      if (propPivot) propPivot.rotation.x += dt * 4;
    }
    const navL = airplaneGroup.children.find((c) => c instanceof THREE.PointLight) as THREE.PointLight | undefined;
    if (navL) navL.intensity = 0.7 + Math.sin(time * 4.0) * 0.4;

    // Botão e timer: visíveis só no parkour normal (não durante o voo)
    const inParkourUI = state.active && !state.isRiding;
    exitBtn.style.display = inParkourUI ? "flex" : "none";
    timerEl.style.display = inParkourUI ? "block" : "none";

    // Conta o tempo enquanto ativo e não voando
    if (inParkourUI && state.voidCooldown <= 0) {
      state.elapsedTime += dt;
      const t   = state.elapsedTime;
      const m   = Math.floor(t / 60);
      const s   = Math.floor(t % 60);
      const ms  = Math.floor((t % 1) * 10);
      timerEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;

      timerEl.style.color       = "#62ff9f";
      timerEl.style.borderColor = "#62ff9f";
    }

    // Animar pombos patrulheiros
    for (const p of parkourPigeons) {
      p.phase     += p.angSpeed * dt;
      p.flapPhase += dt * 12;
      if (p.hitCooldown > 0) p.hitCooldown -= dt;

      const px = p.cx + Math.cos(p.phase) * p.radius;
      const pz = p.cz + Math.sin(p.phase) * p.radius;
      const py = p.cy + Math.sin(p.flapPhase * 0.35) * 0.3;

      p.group.position.set(px, py, pz);
      // vira o bico na direção do movimento
      p.group.rotation.y = -p.phase + Math.PI / 2;
      p.group.rotation.x = Math.sin(p.flapPhase * 0.4) * 0.14;

      // bater asas
      const flap = 0.5 + Math.max(0, Math.sin(p.flapPhase)) * 1.0;
      p.leftWing.rotation.z  =  0.3 + flap;
      p.rightWing.rotation.z = -0.3 - flap;
      p.head.rotation.x      = Math.sin(p.flapPhase * 0.6) * 0.1;
    }
  }

  function postUpdatePlayer(dt: number) {
    // ── Durante o voo: controle por WASD ─────────────────────────────────────
    if (state.isRiding) {
      const FLIGHT_SPEED = 9;   // unidades/s
      const TURN_RATE    = 1.4; // rad/s

      // Zera para o personagem não andar no chão
      playerVelocity.set(0, 0);
      playerState.jumping = false;
      playerState.jumpY   = 0;
      playerState.jumpVel = 0;

      // A/D viram o avião (yaw); o avião sempre voa no heading atual
      const turnLeft  = keyDown("KeyA") || keyDown("ArrowLeft");
      const turnRight = keyDown("KeyD") || keyDown("ArrowRight");
      const turnDir   = (turnRight ? 1 : 0) - (turnLeft ? 1 : 0);

      state.rideHeading += turnDir * TURN_RATE * dt;

      // Banking visual suave na direção da curva
      state.rideBank = THREE.MathUtils.lerp(
        state.rideBank,
        -turnDir * 0.45,
        Math.min(1, dt * 5)
      );

      // Controle de altitude: Espaço = sobe, Shift = desce
      const VERT_SPEED = 6; // u/s
      if (keyDown("Space"))      state.rideY += VERT_SPEED * dt;
      if (keyDown("ShiftLeft") || keyDown("ShiftRight")) state.rideY -= VERT_SPEED * dt;
      state.rideY = THREE.MathUtils.clamp(state.rideY, MIN_FLY_Y, MAX_FLY_Y);

      // Inclinação de nariz baseada no movimento vertical
      const pitchTarget = keyDown("Space") ? -0.18 : (keyDown("ShiftLeft") || keyDown("ShiftRight")) ? 0.18 : 0;

      // Sempre voa para frente no heading atual
      state.rideX += Math.sin(state.rideHeading) * FLIGHT_SPEED * dt;
      state.rideZ += Math.cos(state.rideHeading) * FLIGHT_SPEED * dt;

      // Limita área de voo
      state.rideX = THREE.MathUtils.clamp(state.rideX, -100, 100);
      state.rideZ = THREE.MathUtils.clamp(state.rideZ, -100, 100);

      // Atualiza mesh do avião
      airplaneGroup.position.set(state.rideX, state.rideY, state.rideZ);
      airplaneGroup.rotation.y = state.rideHeading - Math.PI / 2;
      airplaneGroup.rotation.z = state.rideBank;
      airplaneGroup.rotation.x = THREE.MathUtils.lerp(airplaneGroup.rotation.x, pitchTarget, Math.min(1, dt * 4));

      // Mantém jogador na cabine
      player.position.x = state.rideX;
      player.position.z = state.rideZ;
      state.floorY      = state.rideY + 0.55;
      player.position.y = state.floorY;
      state.prevAbsY    = state.floorY;
      state.wasJumping  = false;

      // Atualiza posição do interactable para E funcionar em qualquer posição
      airplaneInteractable.position.set(state.rideX, RIDE_Y, state.rideZ);
      return;
    }

    // Salva os valores que updatePlayer acabou de escrever
    const relYFromEngine = player.position.y;       // = jumpY + bob
    const jumpYFromEngine = playerState.jumpY;       // pode ser 0 se acabou de pousar

    // Bob = parte de animação sem o salto
    const bobVal = relYFromEngine - jumpYFromEngine;

    if (state.voidCooldown > 0) {
      player.position.y = state.floorY + playerState.jumpY + bobVal;
      state.prevAbsY    = state.floorY + playerState.jumpY;
      state.wasJumping  = playerState.jumping;
      return;
    }

    const px = player.position.x;
    const pz = player.position.z;

    // Boost no salto – primeiro frame do pulo
    if (playerState.jumping && !state.wasJumping && state.active) {
      playerState.jumpVel = JUMP_VEL_BOOST;
    }
    state.wasJumping = playerState.jumping;

    // ── Colisão com pombos patrulheiros ────────────────────────────────────────
    if (state.active && state.voidCooldown <= 0) {
      const playerAbsY = state.floorY + playerState.jumpY;
      for (const p of parkourPigeons) {
        if (p.hitCooldown > 0) continue;
        const dx = p.group.position.x - px;
        const dy = p.group.position.y - playerAbsY;
        const dz = p.group.position.z - pz;
        const dist = Math.sqrt(dx * dx + dy * dy * 0.6 + dz * dz);
        if (dist < 1.2) {
          // Knockback: empurra o jogador para longe do pombo
          const len = Math.hypot(dx, dz) || 1;
          playerVelocity.x -= (dx / len) * 9;
          playerVelocity.y -= (dz / len) * 9;
          // Também "puxa" o piso para baixo levemente, facilitando a queda
          if (!playerState.jumping) {
            state.fallVel = -4;
          }
          p.hitCooldown = 1.5;
          speak("Um pombo te derrubou!", "Pombo do Parkour");
        }
      }
    }

    const isFalling   = !playerState.jumping || playerState.jumpVel <= 0;
    const currentAbsY = state.active ? state.floorY + jumpYFromEngine : jumpYFromEngine;
    const prevAbs     = state.prevAbsY;
    const platY       = getHighestPlatformBelow(px, pz, currentAbsY + 4.0);

    // ── Rampa de entrada: o jogador pode subir sem pular ─────────────────────
    if (isInRampZone(px, pz)) {
      const ry = getRampY(pz);
      if (!state.active) {
        state.active      = true;
        state.elapsedTime = 0;
        state.checkpoint  = { x: -26, z: -82, y: RAMP_Y_TOP };
        speak("Parkour iniciado! Cronômetro rodando.", "Parkour");
      }
      state.floorY  = ry;
      state.fallVel = 0;
      playerState.jumpY   = 0;
      playerState.jumpVel = 0;
      playerState.jumping = false;
      player.position.y   = ry + bobVal;
      state.prevAbsY      = ry;
      state.wasJumping    = false;
      return;
    }

    if (!state.active) {
      // Detecta entrada no parkour: player pousou em cima de uma plataforma elevada
      if (
        platY !== null && platY > 0.25 &&
        isFalling &&
        prevAbs >= platY - 0.05 &&
        currentAbsY <= platY + LAND_TOL
      ) {
        state.active = true;
        landOn(platY, px, pz);
        exitBtn.style.display = "flex";
      }
      state.prevAbsY = state.active ? state.floorY + playerState.jumpY : currentAbsY;
      player.position.y = state.active
        ? state.floorY + playerState.jumpY + bobVal
        : relYFromEngine;
      return;
    }

    // ── Física de parkour ativo ────────────────────────────────────────────────

    if (
      platY !== null && isFalling &&
      prevAbs >= platY - 0.05 &&
      currentAbsY <= platY + LAND_TOL
    ) {
      // Pousar em plataforma
      landOn(platY, px, pz);
    } else if (!playerState.jumping && (platY === null || currentAbsY > platY + LAND_TOL + 0.1)) {
      // Cair (sem plataforma abaixo ou plataforma abaixo mas muito longe)
      state.fallVel -= FALL_GRAVITY * dt;
      state.floorY  += state.fallVel * dt;

      // Pousar enquanto caindo
      const newPlatY = getHighestPlatformBelow(px, pz, state.floorY + 3.5);
      if (newPlatY !== null && state.floorY <= newPlatY + 0.15) {
        landOn(newPlatY, px, pz);
      }

      // Void
      if (state.floorY + playerState.jumpY < VOID_Y) {
        teleportToCheckpoint();
      }
    }

    // Saída automática ao passar pela porta de entrada
    if (pz > -72 && Math.abs(px - (-34)) < 8 && state.floorY < 1.0 && !playerState.jumping) {
      exitParkour();
      player.position.y = playerState.jumpY + bobVal;
      state.prevAbsY    = playerState.jumpY;
      return;
    }

    // Colisão lateral com as plataformas (impede entrar pelos lados)
    resolveSideCollisions(state.floorY + playerState.jumpY);

    // Escreve posição Y final com offset do piso do parkour
    player.position.y = state.floorY + playerState.jumpY + bobVal;
    state.prevAbsY    = state.floorY + playerState.jumpY;
  }

  function destroy() {
    exitBtn.remove();
    timerEl.remove();
    for (const p of parkourPigeons) world.remove(p.group);
    world.remove(rampMesh);
    world.remove(flagGroup);
    world.remove(airplaneGroup);
    for (const p of platforms) {
      world.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
  }

  return { update, postUpdatePlayer, isInParkourZone, destroy };
}
