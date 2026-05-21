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
const BLOCO_DEPTH = 9;  // ao longo de Z (norte<->sul do corredor)
const CORRIDOR_DEPTH = 1.8; // largura do corredor central
// Largura do espaco da escada (sacrificado no centro do corpo principal,
// sem sair pra fora — o bloco continua retangular pra caber entre muro
// norte e a piscina).
const STAIR_BAY_WIDTH = 5;
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
  for (let story = 0; story < STORIES; story++) {
    const y = story * STORY_HEIGHT + 0.04;
    addBox(BLOCO_WIDTH, 0.08, BLOCO_DEPTH, 0, y, 0, floorMat, false);
  }

  // -------- Paredes externas do corpo principal --------
  // Norte e sul, com aberturas implicitas pra entrada (porta na fachada sul)
  const halfW = BLOCO_WIDTH / 2;
  const halfD = BLOCO_DEPTH / 2;
  const DOOR_W = 3;

  for (let story = 0; story < STORIES; story++) {
    const y = story * STORY_HEIGHT + STORY_HEIGHT / 2;

    // Parede norte (fundo, virada pro centro do campus, longe da camera)
    addBox(BLOCO_WIDTH, STORY_HEIGHT, WALL_THICKNESS,
      0, y, -halfD + WALL_THICKNESS / 2, outerMat);

    // Parede sul (fachada, virada pro muro/camera) com porta no centro (so terreo)
    if (story === 0) {
      const sideW = (BLOCO_WIDTH - DOOR_W) / 2;
      addBox(sideW, STORY_HEIGHT, WALL_THICKNESS,
        -DOOR_W / 2 - sideW / 2, y, halfD - WALL_THICKNESS / 2, outerMat);
      addBox(sideW, STORY_HEIGHT, WALL_THICKNESS,
        DOOR_W / 2 + sideW / 2, y, halfD - WALL_THICKNESS / 2, outerMat);
      const lintelH = STORY_HEIGHT - 2.4;
      addBox(DOOR_W, lintelH, WALL_THICKNESS,
        0, 2.4 + lintelH / 2, halfD - WALL_THICKNESS / 2, outerMat);
    } else {
      addBox(BLOCO_WIDTH, STORY_HEIGHT, WALL_THICKNESS,
        0, y, halfD - WALL_THICKNESS / 2, outerMat);
    }

    // Paredes laterais leste/oeste
    addBox(WALL_THICKNESS, STORY_HEIGHT, BLOCO_DEPTH,
      -halfW + WALL_THICKNESS / 2, y, 0, outerMat);
    addBox(WALL_THICKNESS, STORY_HEIGHT, BLOCO_DEPTH,
      halfW - WALL_THICKNESS / 2, y, 0, outerMat);
  }

  // -------- Salas (paredes internas) --------
  // Pra cada andar, agrupamos por fileira e construímos paredes verticais
  // (perpendiculares ao corredor) entre salas adjacentes, e a parede do
  // corredor com aberturas a cada gap (porta de sala). Cada parede vira
  // tambem um blocker (collision XZ), guardado na lista do andar para
  // alternar conforme o player muda de piso.
  function buildStoryRooms(rooms: Room[], storyY: number): BlockerHandle[] {
    const storyBlockers: BlockerHandle[] = [];
    const registerInnerBlocker = (
      localMinX: number, localMaxX: number,
      localMinZ: number, localMaxZ: number,
    ) => {
      if (!createBlocker) return;
      const handle = createBlocker(
        centerX + localMinX, centerX + localMaxX,
        centerZ + localMinZ, centerZ + localMaxZ,
        { active: storyY < 0.001 }, // só térreo começa ativo
      );
      if (handle) storyBlockers.push(handle);
    };

    const rowGroups: Record<Row, Room[]> = { north: [], south: [] };
    for (const r of rooms) rowGroups[r.row].push(r);
    for (const row of ["north", "south"] as Row[]) {
      rowGroups[row].sort((a, b) => a.worldX - b.worldX);
    }

    const wallH = STORY_HEIGHT;
    const t2 = INNER_WALL_THICKNESS / 2;

    for (const row of ["north", "south"] as Row[]) {
      const list = rowGroups[row];
      const rowZCenter = row === "north" ? NORTH_ROW_Z_CENTER : SOUTH_ROW_Z_CENTER;
      const rowDepth = row === "north" ? NORTH_ROW_DEPTH : SOUTH_ROW_DEPTH;
      const corridorEdgeZ = row === "north"
        ? rowZCenter + rowDepth / 2
        : rowZCenter - rowDepth / 2;
      const outerEdgeZ = row === "north"
        ? rowZCenter - rowDepth / 2
        : rowZCenter + rowDepth / 2;

      // Paredes entre salas adjacentes (perpendiculares ao corredor)
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i];
        const b = list[i + 1];
        const wallX = (a.worldX + b.worldX) / 2;
        const wallDepth = Math.abs(corridorEdgeZ - outerEdgeZ);
        const wallZ = (corridorEdgeZ + outerEdgeZ) / 2;
        addBox(INNER_WALL_THICKNESS, wallH, wallDepth, wallX, storyY + wallH / 2, wallZ, innerMat);
        registerInnerBlocker(
          wallX - t2, wallX + t2,
          wallZ - wallDepth / 2, wallZ + wallDepth / 2,
        );
      }

      // Parede do corredor: para cada sala, dois trechos (esquerdo e direito
      // da porta da sala). Porta da sala = 1.2m no centro da face do
      // corredor.
      const roomDoor = 1.2;
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const prevX = i === 0 ? -halfW + WALL_THICKNESS : (list[i - 1].worldX + r.worldX) / 2;
        const nextX = i === list.length - 1 ? halfW - WALL_THICKNESS : (r.worldX + list[i + 1].worldX) / 2;
        const leftW = r.worldX - roomDoor / 2 - prevX;
        const rightW = nextX - (r.worldX + roomDoor / 2);
        if (leftW > 0.1) {
          const cx = prevX + leftW / 2;
          addBox(leftW, wallH, INNER_WALL_THICKNESS,
            cx, storyY + wallH / 2, corridorEdgeZ, innerMat);
          registerInnerBlocker(
            cx - leftW / 2, cx + leftW / 2,
            corridorEdgeZ - t2, corridorEdgeZ + t2,
          );
        }
        if (rightW > 0.1) {
          const cx = r.worldX + roomDoor / 2 + rightW / 2;
          addBox(rightW, wallH, INNER_WALL_THICKNESS,
            cx, storyY + wallH / 2, corridorEdgeZ, innerMat);
          registerInnerBlocker(
            cx - rightW / 2, cx + rightW / 2,
            corridorEdgeZ - t2, corridorEdgeZ + t2,
          );
        }
      }
    }

    // Labels das salas
    for (const r of rooms) {
      const rowZ = r.row === "north" ? NORTH_ROW_Z_CENTER : SOUTH_ROW_Z_CENTER;
      const sprite = makeLabelSprite(r.label.text);
      sprite.position.set(r.worldX, storyY + wallH - 0.6, rowZ);
      group.add(sprite);
    }

    return storyBlockers;
  }

  // Salas, removendo as que ficam no espaco central da escada
  const stairBayMinX = -STAIR_BAY_WIDTH / 2;
  const stairBayMaxX = STAIR_BAY_WIDTH / 2;
  const dropStairBay = (rooms: Room[]) =>
    rooms.filter((r) => r.worldX < stairBayMinX - 0.5 || r.worldX > stairBayMaxX + 0.5);

  const terreoBlockers = buildStoryRooms(dropStairBay(buildRoomList(terreoPlanta)), 0);
  const superiorBlockers = buildStoryRooms(dropStairBay(buildRoomList(superiorPlanta)), STORY_HEIGHT);

  // -------- Laje intermediaria + teto --------
  // Laje com vao aberto na area da escada (dois blocos: leste e oeste)
  const slabSideW = (BLOCO_WIDTH - STAIR_BAY_WIDTH) / 2;
  addBox(slabSideW, 0.16, BLOCO_DEPTH + 0.2,
    -BLOCO_WIDTH / 2 + slabSideW / 2, STORY_HEIGHT, 0, slabMat);
  addBox(slabSideW, 0.16, BLOCO_DEPTH + 0.2,
    BLOCO_WIDTH / 2 - slabSideW / 2, STORY_HEIGHT, 0, slabMat);
  // teto continuo
  addBox(BLOCO_WIDTH + 0.4, 0.6, BLOCO_DEPTH + 0.4, 0, TOTAL_HEIGHT + 0.3, 0, roofMat);

  // -------- Escada interna no centro --------
  // Sobe de y=0 ate STORY_HEIGHT, ocupando do norte (z=-halfD) ate o
  // corredor (z=-CORRIDOR_DEPTH/2). Patamar fica encostado no corredor.
  const stairLengthZ = halfD - CORRIDOR_DEPTH / 2;
  const stairStartZ = -halfD + WALL_THICKNESS;
  const stepCount = 14;
  const stepDepth = (stairLengthZ - WALL_THICKNESS) / stepCount;
  const stepHeight = STORY_HEIGHT / stepCount;
  const stairW = STAIR_BAY_WIDTH - 0.4;
  for (let i = 0; i < stepCount; i++) {
    const sy = i * stepHeight + stepHeight / 2;
    const sz = stairStartZ + i * stepDepth + stepDepth / 2;
    addBox(stairW, stepHeight, stepDepth, 0, sy, sz, stairMat, false);
  }
  // Corrimao simples nas laterais (visual)
  for (const sx of [-stairW / 2, stairW / 2]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.1, stairLengthZ),
      stairMat,
    );
    rail.position.set(sx, STORY_HEIGHT / 2 + 0.55, stairStartZ + stairLengthZ / 2);
    rail.castShadow = true;
    group.add(rail);
  }

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
      { mat: roofMat, target: 0.08 },
      { mat: slabMat, target: 0.32 },
    ];
    const STAIR_BOTTOM_Z = -CORRIDOR_DEPTH / 2;        // y=0 aqui
    const STAIR_TOP_Z = -halfD + WALL_THICKNESS;       // y=STORY_HEIGHT aqui
    const STAIR_HALF_W = STAIR_BAY_WIDTH / 2 - 0.2;
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
        const insideFootprint =
          Math.abs(localX) < BLOCO_WIDTH / 2 - WALL_THICKNESS &&
          Math.abs(localZ) < BLOCO_DEPTH / 2 - WALL_THICKNESS;

        // Atualiza Y do andar conforme o jogador caminha
        const inStairZone =
          insideFootprint &&
          Math.abs(localX) < STAIR_HALF_W &&
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
