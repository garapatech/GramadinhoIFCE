import * as THREE from "three";

import { createWindowTexture } from "@/game/campusTextures";

import {
  BLOCO_TELEMATICA_PLACEMENT,
  superiorPlanta,
  terreoPlanta,
  type PlantaData,
  type PlantaLabel,
} from "./index";

// ---- Dimensoes do bloco no mundo ----
// Modelamos o bloco bem maior agora pra caber todas as salas. Layout em T:
// um corpo principal horizontal (longo) com um pequeno braco ao sul onde
// fica a escada. Cabe ao longo do muro norte do campus sem brigar com
// outros prédios (portaria fica a x<-41).
const BLOCO_WIDTH = 90; // ao longo de X (eixo do corredor)
const BLOCO_DEPTH = 16; // ao longo de Z, mais grosso pra salas maiores
const CORRIDOR_DEPTH = 4; // corredor central bem mais largo

// Trecho central reservado para lounge (cadeiras/mesa, sem salas). 12m de
// largura no centro do corredor.
const LOUNGE_HALF_WIDTH = 6;
// Trecho da ponta leste reservado pra escada (sem salas).
const STAIR_END_WIDTH = 8;
const STORY_HEIGHT = 3.6;
const STORIES = 2;
const TOTAL_HEIGHT = STORY_HEIGHT * STORIES;
const WALL_THICKNESS = 0.3;
const INNER_WALL_THICKNESS = 0.18;
const WALL_COLOR = 0xdbe0dd;
const ROOF_COLOR = 0x8b3d2c;
const FRAME_COLOR = 0xf3f0e7;
const FLOOR_COLOR = 0xe7decc;
const STAIR_COLOR = 0xb7aa8d;

// Mapa cx (pixel da planta) -> world X. As plantas tem cx de ~120 a ~2080
// distribuidos no corpo principal; mapeamos esse intervalo ao BLOCO_WIDTH.
const CX_MIN = 120;
const CX_MAX = 2080;
const cxToWorldX = (cx: number) =>
  ((cx - CX_MIN) / (CX_MAX - CX_MIN)) * BLOCO_WIDTH - BLOCO_WIDTH / 2;

// cy ~580 = fileira norte (gabinetes/banheiros), cy ~770 = fileira sul
// (salas/labs). Corredor entre elas.
const CY_NORTH_MAX = 700;
const NORTH_ROW_DEPTH = (BLOCO_DEPTH - CORRIDOR_DEPTH) / 2;
const SOUTH_ROW_DEPTH = NORTH_ROW_DEPTH;
const NORTH_ROW_Z_CENTER = -CORRIDOR_DEPTH / 2 - NORTH_ROW_DEPTH / 2;
const SOUTH_ROW_Z_CENTER = CORRIDOR_DEPTH / 2 + SOUTH_ROW_DEPTH / 2;

type Row = "north" | "south";
type Room = { label: PlantaLabel; row: Row; worldX: number };

function classifyRow(label: PlantaLabel): Row {
  return label.px.cy < CY_NORTH_MAX ? "north" : "south";
}

function buildRoomList(planta: PlantaData): Room[] {
  const rooms: Room[] = [];
  for (const label of planta.labels) {
    if (!label.text || label.text.length < 2) continue;
    rooms.push({ label, row: classifyRow(label), worldX: cxToWorldX(label.px.cx) });
  }
  return rooms;
}

const textureLoader = new THREE.TextureLoader();

type BlockerHandle = { active: boolean };
type AddBlocker = (
  minX: number, maxX: number, minZ: number, maxZ: number,
  options?: { active?: boolean },
) => BlockerHandle | void;
type Interactable = {
  kind: string;
  label: string;
  radius: number;
  position: THREE.Vector3;
  root: THREE.Object3D;
  npcDisabled?: () => boolean;
  interact?: () => void;
  update?: (dt: number, time: number) => void;
};

export type BlocoTelematicaScene = {
  group: THREE.Group;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  dispose(): void;
};

export type BlocoTelematicaOptions = {
  parent: THREE.Object3D;
  createBlocker?: AddBlocker;
  interactables?: Interactable[];
  getPlayerPosition?: () => THREE.Vector3;
};

function makeLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(20,28,40,0.78)";
  const padding = 14;
  const textW = Math.min(ctx.measureText(text).width + padding * 2, canvas.width - 8);
  const textH = 56;
  const x = (canvas.width - textW) / 2;
  const y = (canvas.height - textH) / 2;
  const radius = 18;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + textW, y, x + textW, y + textH, radius);
  ctx.arcTo(x + textW, y + textH, x, y + textH, radius);
  ctx.arcTo(x, y + textH, x, y, radius);
  ctx.arcTo(x, y, x + textW, y, radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  // escala proporcional ao tamanho do texto
  const aspect = textW / textH;
  const h = 0.55;
  sprite.scale.set(h * aspect, h, 1);
  sprite.renderOrder = 6;
  return sprite;
}

export function buildBlocoTelematica(options: BlocoTelematicaOptions): BlocoTelematicaScene {
  const { parent, createBlocker, interactables, getPlayerPosition } = options;
  const group = new THREE.Group();
  group.name = "blocoTelematica";

  const { centerX, centerZ } = BLOCO_TELEMATICA_PLACEMENT;

  const windowTexture = createWindowTexture();

  // Materiais com transparencia habilitada para suportar fade-on-enter
  const outerMat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    map: windowTexture,
    roughness: 0.9,
    metalness: 0.03,
    transparent: true,
    opacity: 1,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xeae2d2,
    roughness: 0.95,
    transparent: true,
    opacity: 1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: ROOF_COLOR,
    roughness: 1,
    transparent: true,
    opacity: 1,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR,
    roughness: 0.85,
    transparent: true,
    opacity: 1,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR,
    roughness: 0.98,
  });
  const stairMat = new THREE.MeshStandardMaterial({
    color: STAIR_COLOR,
    roughness: 0.95,
  });

  const addBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: THREE.Material,
    castShadow = true,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // -------- Piso do andar (chao bege) --------
  // O piso do superior eh exatamente o que o player ve "como teto" quando
  // esta no terreo olhando pra cima. Guardamos refs pra esconder no
  // toggle, igual aos outros elementos por andar.
  const floorTerreoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCO_WIDTH, 0.08, BLOCO_DEPTH),
    floorMat,
  );
  floorTerreoMesh.position.set(0, 0.04, 0);
  floorTerreoMesh.receiveShadow = true;
  group.add(floorTerreoMesh);

  const floorSuperiorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCO_WIDTH, 0.08, BLOCO_DEPTH),
    floorMat,
  );
  floorSuperiorMesh.position.set(0, STORY_HEIGHT + 0.04, 0);
  floorSuperiorMesh.receiveShadow = true;
  group.add(floorSuperiorMesh);

  // -------- Paredes externas do corpo principal --------
  // Norte e sul, com aberturas implicitas pra entrada (porta na fachada sul)
  const halfW = BLOCO_WIDTH / 2;
  const halfD = BLOCO_DEPTH / 2;
  const DOOR_W = 3;

  // Paredes externas ficam guardadas pra cada andar separadamente, pra
  // poder esconder as do andar oposto quando o player muda de piso.
  const outerMeshesTerreo: THREE.Mesh[] = [];
  const outerMeshesSuperior: THREE.Mesh[] = [];

  const addOuterWall = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    story: number,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), outerMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    (story === 0 ? outerMeshesTerreo : outerMeshesSuperior).push(mesh);
    return mesh;
  };

  for (let story = 0; story < STORIES; story++) {
    const y = story * STORY_HEIGHT + STORY_HEIGHT / 2;

    // Parede norte (fundo, virada pro centro do campus, longe da camera)
    addOuterWall(BLOCO_WIDTH, STORY_HEIGHT, WALL_THICKNESS,
      0, y, -halfD + WALL_THICKNESS / 2, story);

    // Parede sul (fachada, virada pro muro/camera) com porta no centro (so terreo)
    if (story === 0) {
      const sideW = (BLOCO_WIDTH - DOOR_W) / 2;
      addOuterWall(sideW, STORY_HEIGHT, WALL_THICKNESS,
        -DOOR_W / 2 - sideW / 2, y, halfD - WALL_THICKNESS / 2, story);
      addOuterWall(sideW, STORY_HEIGHT, WALL_THICKNESS,
        DOOR_W / 2 + sideW / 2, y, halfD - WALL_THICKNESS / 2, story);
      const lintelH = STORY_HEIGHT - 2.4;
      addOuterWall(DOOR_W, lintelH, WALL_THICKNESS,
        0, 2.4 + lintelH / 2, halfD - WALL_THICKNESS / 2, story);
    } else {
      addOuterWall(BLOCO_WIDTH, STORY_HEIGHT, WALL_THICKNESS,
        0, y, halfD - WALL_THICKNESS / 2, story);
    }

    // Paredes laterais leste/oeste
    addOuterWall(WALL_THICKNESS, STORY_HEIGHT, BLOCO_DEPTH,
      -halfW + WALL_THICKNESS / 2, y, 0, story);
    addOuterWall(WALL_THICKNESS, STORY_HEIGHT, BLOCO_DEPTH,
      halfW - WALL_THICKNESS / 2, y, 0, story);
  }

  // -------- Salas (paredes internas) --------
  // Layout em T: o bloco eh um retangulo, mas dentro tem duas asas de salas
  // (oeste e leste do lounge central) e o "pe do T" eh o lounge — ocupa
  // toda a profundidade no centro do bloco, sem paredes internas. A
  // escada fica na ponta leste, atras de uma parede divisoria.
  const STAIR_END_MIN_X = halfW - STAIR_END_WIDTH;

  type Wing = {
    rooms: Room[];
    outerX: number;   // borda virada pro lado de fora do bloco (parede externa)
    loungeX: number;  // borda virada pro lounge
  };

  function buildStoryRooms(
    rooms: Room[],
    storyY: number,
    storyGroup: THREE.Group,
  ): BlockerHandle[] {
    const storyBlockers: BlockerHandle[] = [];
    const registerInnerBlocker = (
      localMinX: number, localMaxX: number,
      localMinZ: number, localMaxZ: number,
    ) => {
      if (!createBlocker) return;
      const handle = createBlocker(
        centerX + localMinX, centerX + localMaxX,
        centerZ + localMinZ, centerZ + localMaxZ,
        { active: storyY < 0.001 },
      );
      if (handle) storyBlockers.push(handle);
    };
    // Helper que cria mesh dentro do storyGroup em vez do group principal
    const addStoryBox = (
      w: number, h: number, d: number,
      x: number, y: number, z: number,
      mat: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      storyGroup.add(mesh);
    };

    const leftRooms = rooms.filter((r) => r.worldX < -LOUNGE_HALF_WIDTH);
    const rightRooms = rooms.filter(
      (r) => r.worldX > LOUNGE_HALF_WIDTH && r.worldX < STAIR_END_MIN_X - 0.5,
    );
    const wings: Wing[] = [
      { rooms: leftRooms, outerX: -halfW + WALL_THICKNESS, loungeX: -LOUNGE_HALF_WIDTH },
      { rooms: rightRooms, outerX: STAIR_END_MIN_X, loungeX: LOUNGE_HALF_WIDTH },
    ];

    const wallH = STORY_HEIGHT;
    const t2 = INNER_WALL_THICKNESS / 2;
    const roomDoor = 1.4;

    for (const wing of wings) {
      const xMin = Math.min(wing.outerX, wing.loungeX);
      const xMax = Math.max(wing.outerX, wing.loungeX);
      const rowGroups: Record<Row, Room[]> = { north: [], south: [] };
      for (const r of wing.rooms) rowGroups[r.row].push(r);
      for (const row of ["north", "south"] as Row[]) {
        rowGroups[row].sort((a, b) => a.worldX - b.worldX);
      }

      for (const row of ["north", "south"] as Row[]) {
        const list = rowGroups[row];
        if (list.length === 0) continue;
        const rowZCenter = row === "north" ? NORTH_ROW_Z_CENTER : SOUTH_ROW_Z_CENTER;
        const rowDepth = row === "north" ? NORTH_ROW_DEPTH : SOUTH_ROW_DEPTH;
        const corridorEdgeZ = row === "north"
          ? rowZCenter + rowDepth / 2
          : rowZCenter - rowDepth / 2;
        const outerEdgeZ = row === "north"
          ? rowZCenter - rowDepth / 2
          : rowZCenter + rowDepth / 2;
        const wallZ = (corridorEdgeZ + outerEdgeZ) / 2;

        // Paredes entre salas adjacentes (perpendiculares ao corredor)
        for (let i = 0; i < list.length - 1; i++) {
          const wallX = (list[i].worldX + list[i + 1].worldX) / 2;
          addStoryBox(INNER_WALL_THICKNESS, wallH, rowDepth, wallX, storyY + wallH / 2, wallZ, innerMat);
          registerInnerBlocker(
            wallX - t2, wallX + t2,
            wallZ - rowDepth / 2, wallZ + rowDepth / 2,
          );
        }

        // Cap wall fechando a ponta da ala virada pro lounge
        addStoryBox(INNER_WALL_THICKNESS, wallH, rowDepth,
          wing.loungeX, storyY + wallH / 2, wallZ, innerMat);
        registerInnerBlocker(
          wing.loungeX - t2, wing.loungeX + t2,
          wallZ - rowDepth / 2, wallZ + rowDepth / 2,
        );

        // Parede do corredor (trechos esquerdo e direito da porta de cada sala)
        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          const prevX = i === 0 ? xMin : (list[i - 1].worldX + r.worldX) / 2;
          const nextX = i === list.length - 1 ? xMax : (r.worldX + list[i + 1].worldX) / 2;
          const leftW = r.worldX - roomDoor / 2 - prevX;
          const rightW = nextX - (r.worldX + roomDoor / 2);
          if (leftW > 0.1) {
            const cx = prevX + leftW / 2;
            addStoryBox(leftW, wallH, INNER_WALL_THICKNESS,
              cx, storyY + wallH / 2, corridorEdgeZ, innerMat);
            registerInnerBlocker(
              cx - leftW / 2, cx + leftW / 2,
              corridorEdgeZ - t2, corridorEdgeZ + t2,
            );
          }
          if (rightW > 0.1) {
            const cx = r.worldX + roomDoor / 2 + rightW / 2;
            addStoryBox(rightW, wallH, INNER_WALL_THICKNESS,
              cx, storyY + wallH / 2, corridorEdgeZ, innerMat);
            registerInnerBlocker(
              cx - rightW / 2, cx + rightW / 2,
              corridorEdgeZ - t2, corridorEdgeZ + t2,
            );
          }
        }
      }
    }

    // Labels das salas (so as que ficaram nas alas)
    for (const r of [...leftRooms, ...rightRooms]) {
      const rowZ = r.row === "north" ? NORTH_ROW_Z_CENTER : SOUTH_ROW_Z_CENTER;
      const sprite = makeLabelSprite(r.label.text);
      sprite.position.set(r.worldX, storyY + wallH - 0.6, rowZ);
      storyGroup.add(sprite);
    }

    return storyBlockers;
  }

  const terreoStoryGroup = new THREE.Group();
  terreoStoryGroup.name = "blocoTelematica.terreo";
  group.add(terreoStoryGroup);
  const superiorStoryGroup = new THREE.Group();
  superiorStoryGroup.name = "blocoTelematica.superior";
  group.add(superiorStoryGroup);

  const terreoBlockers = buildStoryRooms(buildRoomList(terreoPlanta), 0, terreoStoryGroup);
  const superiorBlockers = buildStoryRooms(buildRoomList(superiorPlanta), STORY_HEIGHT, superiorStoryGroup);

  // -------- Laje intermediaria + teto --------
  // Laje cobre tudo menos o vao da escada (ponta leste). Fica invisivel
  // quando o player esta no terreo (pra camera 3rd person nao bater no
  // teto e pra ver as salas de cima quando subir).
  const slabMainW = BLOCO_WIDTH - STAIR_END_WIDTH;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(slabMainW, 0.16, BLOCO_DEPTH + 0.2),
    slabMat,
  );
  slab.position.set(-halfW + slabMainW / 2, STORY_HEIGHT, 0);
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCO_WIDTH + 0.4, 0.6, BLOCO_DEPTH + 0.4),
    roofMat,
  );
  roof.position.set(0, TOTAL_HEIGHT + 0.3, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // -------- Lounge central (cadeiras + mesa) --------
  // Ocupa o trecho central do corredor e expande pra dentro das fileiras
  // norte/sul. Eh um espaco aberto sem paredes internas, com mobiliario.
  const loungeY = 0.04;
  // Tapete delimitando area
  const loungeRug = new THREE.Mesh(
    new THREE.BoxGeometry(LOUNGE_HALF_WIDTH * 2 - 0.6, 0.03, CORRIDOR_DEPTH + 2),
    new THREE.MeshStandardMaterial({ color: 0x506f8a, roughness: 1 }),
  );
  loungeRug.position.set(0, loungeY + 0.04, 0);
  loungeRug.receiveShadow = true;
  group.add(loungeRug);
  // Mesa central
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.2), tableMat);
  table.position.set(0, loungeY + 0.55, 0);
  table.castShadow = true;
  group.add(table);
  for (const [tx, tz] of [
    [-1.0, -0.5], [1.0, -0.5], [-1.0, 0.5], [1.0, 0.5],
  ] as [number, number][]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), tableMat);
    leg.position.set(tx, loungeY + 0.25, tz);
    group.add(leg);
  }
  // Cadeiras ao redor (visual + blocker)
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3d6b4a, roughness: 0.85 });
  const chairPositions: [number, number, number][] = [
    [-3.5, 0, 0], [3.5, 0, 0],
    [-1.8, 0, -2.4], [1.8, 0, -2.4],
    [-1.8, 0, 2.4], [1.8, 0, 2.4],
    [-3.5, Math.PI / 2, -2.6], [3.5, -Math.PI / 2, -2.6],
    [-3.5, Math.PI / 2, 2.6], [3.5, -Math.PI / 2, 2.6],
  ];
  for (const [cx, ry, cz] of chairPositions) {
    const chairGroup = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), chairMat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    chairGroup.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.1), chairMat);
    back.position.set(0, 0.85, -0.3);
    chairGroup.add(back);
    chairGroup.position.set(cx, loungeY, cz);
    chairGroup.rotation.y = ry;
    group.add(chairGroup);
  }
  // Plantas de canto pra dar vida
  const plantPotMat = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.95 });
  const plantLeafMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.8 });
  for (const [px, pz] of [
    [-LOUNGE_HALF_WIDTH + 0.6, -CORRIDOR_DEPTH / 2 - 0.6],
    [LOUNGE_HALF_WIDTH - 0.6, -CORRIDOR_DEPTH / 2 - 0.6],
    [-LOUNGE_HALF_WIDTH + 0.6, CORRIDOR_DEPTH / 2 + 0.6],
    [LOUNGE_HALF_WIDTH - 0.6, CORRIDOR_DEPTH / 2 + 0.6],
  ] as [number, number][]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.5, 12), plantPotMat);
    pot.position.set(px, loungeY + 0.25, pz);
    group.add(pot);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), plantLeafMat);
    leaves.position.set(px, loungeY + 0.7, pz);
    group.add(leaves);
  }

  // -------- Escada na ponta leste --------
  // Ocupa a faixa x: [halfW - STAIR_END_WIDTH, halfW] em toda a profundidade.
  // Sobe de sul (y=0) pra norte (y=STORY_HEIGHT), ao longo de Z.
  const stairXCenter = halfW - STAIR_END_WIDTH / 2;
  const stairLengthZ = BLOCO_DEPTH - WALL_THICKNESS * 2;
  const stairZTop = -halfD + WALL_THICKNESS;     // norte → y=STORY_HEIGHT
  const stairZBottom = halfD - WALL_THICKNESS;   // sul → y=0
  const stepCount = 16;
  const stepDepth = stairLengthZ / stepCount;
  const stepHeight = STORY_HEIGHT / stepCount;
  const stairW = STAIR_END_WIDTH - 1.2;
  for (let i = 0; i < stepCount; i++) {
    const sy = i * stepHeight + stepHeight / 2;
    // i=0 fica embaixo no sul, i=N-1 fica em cima no norte
    const sz = stairZBottom - i * stepDepth - stepDepth / 2;
    addBox(stairW, stepHeight, stepDepth, stairXCenter, sy, sz, stairMat, false);
  }
  // Corrimaos
  for (const sx of [stairXCenter - stairW / 2, stairXCenter + stairW / 2]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.1, stairLengthZ),
      stairMat,
    );
    rail.position.set(sx, STORY_HEIGHT / 2 + 0.55, 0);
    rail.castShadow = true;
    group.add(rail);
  }
  // Parede divisoria entre corredor e escada (com vao central de 2.5m
  // pra acesso). Cada andar tem a sua, no respectivo storyGroup.
  const stairWallHN = (BLOCO_DEPTH - 2.5) / 2;
  const addStairDivider = (storyY: number, target: THREE.Group) => {
    const yMid = storyY + STORY_HEIGHT / 2;
    const mkSegment = (zCenter: number) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS, STORY_HEIGHT, stairWallHN),
        innerMat,
      );
      m.position.set(STAIR_END_MIN_X, yMid, zCenter);
      m.castShadow = true;
      m.receiveShadow = true;
      target.add(m);
    };
    mkSegment(-halfD + stairWallHN / 2);
    mkSegment(halfD - stairWallHN / 2);
  };
  addStairDivider(0, terreoStoryGroup);
  addStairDivider(STORY_HEIGHT, superiorStoryGroup);

  // -------- Placa na fachada --------
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024;
  signCanvas.height = 256;
  const signCtx = signCanvas.getContext("2d")!;
  signCtx.fillStyle = "#1f2a44";
  signCtx.fillRect(0, 0, 1024, 256);
  signCtx.fillStyle = "#fff7cf";
  signCtx.font = "700 110px system-ui, sans-serif";
  signCtx.textAlign = "center";
  signCtx.textBaseline = "middle";
  signCtx.fillText("BLOCO TELEMÁTICA", 512, 128);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.4),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true }),
  );
  sign.position.set(0, STORY_HEIGHT + 1.2, halfD + 0.02);
  group.add(sign);

  group.position.set(centerX, 0, centerZ);
  parent.add(group);

  const bounds = {
    minX: centerX - BLOCO_WIDTH / 2,
    maxX: centerX + BLOCO_WIDTH / 2,
    minZ: centerZ - BLOCO_DEPTH / 2,
    maxZ: centerZ + BLOCO_DEPTH / 2,
  };

  // -------- Blockers de colisao (so paredes externas do corpo principal) --------
  if (createBlocker) {
    const t = WALL_THICKNESS;
    // norte (fundo)
    createBlocker(bounds.minX, bounds.maxX, centerZ - halfD - t, centerZ - halfD + t);
    // sul (fachada, com vao da porta)
    createBlocker(bounds.minX, centerX - DOOR_W / 2, centerZ + halfD - t, centerZ + halfD + t);
    createBlocker(centerX + DOOR_W / 2, bounds.maxX, centerZ + halfD - t, centerZ + halfD + t);
    // leste
    createBlocker(bounds.maxX - t, bounds.maxX + t, centerZ - halfD, centerZ + halfD);
    // oeste
    createBlocker(bounds.minX - t, bounds.minX + t, centerZ - halfD, centerZ + halfD);
  }

  // -------- Transparencia ao entrar + escada funcional --------
  // - outerMat (paredes externas) + roofMat (teto): viram quase invisiveis
  //   quando o jogador esta dentro, pra dar perspectiva.
  // - slabMat (laje entre andares): translucido (~0.35) pra ver os dois
  //   andares simultaneamente.
  // - innerMat (paredes entre salas): NAO desbotam — assim as salas
  //   continuam delimitadas mesmo de dentro.
  //
  // A escada interna no centro funciona como uma rampa: quando o player
  // entra no volume da escada, seu Y eh interpolado entre 0 (base, junto
  // ao corredor) e STORY_HEIGHT (topo, junto a parede norte). Ao sair do
  // volume da escada, mantemos o andar em que ele estava (memoria de
  // estado), entao da pra andar livremente pelo andar superior.
  if (interactables && getPlayerPosition) {
    const fadeMats: Array<{ mat: THREE.MeshStandardMaterial; target: number }> = [
      { mat: outerMat, target: 0.18 },
    ];
    // Escada agora fica na ponta leste, indo de sul (y=0) pra norte (y=top)
    const STAIR_BOTTOM_Z = halfD - WALL_THICKNESS;     // sul → y=0
    const STAIR_TOP_Z = -halfD + WALL_THICKNESS;       // norte → y=STORY_HEIGHT
    const STAIR_MIN_X = STAIR_END_MIN_X + 0.4;
    const STAIR_MAX_X = halfW - WALL_THICKNESS;
    let playerFloorY = 0; // estado: 0 (terreo) ou STORY_HEIGHT (superior)

    interactables.push({
      kind: "bloco-telematica",
      label: "Bloco Telemática",
      radius: 0,
      position: new THREE.Vector3(centerX, 0, centerZ),
      root: group,
      npcDisabled: () => true,
      update() {
        const p = getPlayerPosition();
        const localX = p.x - centerX;
        const localZ = p.z - centerZ;
        // Footprint usa as bordas do bloco mesmo (sem desconto da
        // parede) pra que assim que o player atravessa a porta ja conte
        // como dentro, escondendo o teto.
        const insideFootprint =
          Math.abs(localX) < BLOCO_WIDTH / 2 &&
          Math.abs(localZ) < BLOCO_DEPTH / 2;

        // Atualiza Y do andar conforme o jogador caminha
        const inStairZone =
          insideFootprint &&
          localX > STAIR_MIN_X &&
          localX < STAIR_MAX_X &&
          localZ <= STAIR_BOTTOM_Z &&
          localZ >= STAIR_TOP_Z;
        if (inStairZone) {
          const t = (localZ - STAIR_BOTTOM_Z) / (STAIR_TOP_Z - STAIR_BOTTOM_Z);
          playerFloorY = THREE.MathUtils.clamp(t, 0, 1) * STORY_HEIGHT;
        } else if (insideFootprint) {
          // Snap pro andar mais proximo, evita ficar parado entre niveis
          playerFloorY = playerFloorY < STORY_HEIGHT * 0.5 ? 0 : STORY_HEIGHT;
        } else {
          playerFloorY = 0;
        }

        // Adiciona offset Y ao player (engine ja setou y base + jumpY)
        p.y += playerFloorY;

        // Alterna os blockers internos conforme andar atual
        const onSuperior = playerFloorY >= STORY_HEIGHT * 0.5;
        for (const b of terreoBlockers) b.active = !onSuperior;
        for (const b of superiorBlockers) b.active = onSuperior;

        // Visibilidade dos story groups: so o andar do player aparece. Na
        // escada (entre andares), os dois ficam visiveis pra transicao
        // suave nao "piscar".
        const onStair = inStairZone;
        terreoStoryGroup.visible = onStair || !onSuperior;
        superiorStoryGroup.visible = onStair || onSuperior;

        // Laje: invisivel quando no terreo (nao "tampar" a camera). Visivel
        // quando o player esta em cima (vira o piso). Tambem visivel na
        // escada pra ver pra onde esta subindo.
        slab.visible = onSuperior || onStair;
        // Teto: invisivel quando o player esta dentro (deixa a camera
        // ver pro chao). Aparece de fora.
        roof.visible = !insideFootprint;
        // Paredes externas do andar oposto: somem pra nao tampar a
        // visao de cima. Da pra ver "uma caixinha" so do andar atual.
        for (const m of outerMeshesSuperior) m.visible = !insideFootprint || onSuperior || onStair;
        for (const m of outerMeshesTerreo) m.visible = !insideFootprint || !onSuperior || onStair;
        // O piso de cada andar so aparece se faz sentido visualmente.
        // O piso do superior visto de baixo seria "teto" — entao some
        // quando o player esta no terreo dentro do bloco.
        floorSuperiorMesh.visible = !insideFootprint || onSuperior || onStair;
        floorTerreoMesh.visible = !insideFootprint || !onSuperior || onStair;

        // Transparencia
        const targetFactor = insideFootprint ? 1 : 0;
        for (const entry of fadeMats) {
          const goal = THREE.MathUtils.lerp(1, entry.target, targetFactor);
          entry.mat.opacity = THREE.MathUtils.lerp(entry.mat.opacity, goal, 0.18);
          entry.mat.depthWrite = entry.mat.opacity > 0.85;
        }
      },
    });
  }

  return {
    group,
    bounds,
    dispose() {
      parent.remove(group);
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    },
  };
}
