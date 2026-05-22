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

// Escada pequena no canto nordeste do lounge, orientada de lado: os degraus
// crescem ao longo de X (player sobe caminhando pro leste). Profundidade
// em Z, comprimento em X.
const STAIR_LENGTH = 4.2; // ao longo de X (direcao de subida)
const STAIR_DEPTH = 2.6;  // ao longo de Z (largura)
const STAIR_CENTER_X = 3; // ~metade leste do lounge (LOUNGE_HALF_WIDTH=6)
const STAIR_CENTER_Z = -BLOCO_DEPTH / 2 + 0.4 + STAIR_DEPTH / 2; // encostado na parede norte
const STORY_HEIGHT = 3.6;
const STORIES = 2;
const TOTAL_HEIGHT = STORY_HEIGHT * STORIES;
const WALL_THICKNESS = 0.3;
const INNER_WALL_THICKNESS = 0.18;
const WALL_COLOR = 0xdbe0dd;
const ROOF_COLOR = 0x8b3d2c;
const FRAME_COLOR = 0xf3f0e7;
const FLOOR_COLOR = 0xd4a574; // tom quente, granilite/granito clarinho do IFCE
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
type Room = {
  label: PlantaLabel;
  row: Row;
  worldX: number;
  // Quando definido, o corredor + cap walls dessa fileira encerram aqui
  // (em vez de seguirem ate o fim da ala). Util pra fileiras curtas
  // como os banheiros do superior.
  closeRowAt?: number;
};

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
  cullRadius?: number;
  cullDistance?: number;
  cullPosition?: THREE.Vector3;
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
  onPokerSeatInteract?: (
    seatIndex: number,
    anchor: { position: THREE.Vector3; rotation: number },
  ) => void;
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

  // Paredes externas: opacas. Usamos .visible nos meshes pra esconder
  // quando o player esta dentro (evita problemas de sorting de
  // transparencia que faziam o bloco "sumir" em angulos especificos).
  const outerMat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    map: windowTexture,
    roughness: 0.9,
    metalness: 0.03,
  });
  // Paredes internas estilo gesso: tom mais claro, quase branco. Opacas
  // — usamos visibility no storyGroup pra esconder andar oposto.
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xf3eee3,
    roughness: 0.85,
    metalness: 0,
  });
  // Materiais de mobiliario reutilizados em varias salas
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1c, roughness: 0.85 });
  const chalkMat = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.95 });
  const whiteboardMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.45 });
  const roomChairMat = new THREE.MeshStandardMaterial({ color: 0x2c4f6e, roughness: 0.85 });
  const monitorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x2a4858, roughness: 0.3, emissive: 0x16384a, emissiveIntensity: 0.6,
  });
  const pcCaseMat = new THREE.MeshStandardMaterial({ color: 0xbcbcbc, roughness: 0.7 });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x6e2f2f, roughness: 0.95 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
  const toiletMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: ROOF_COLOR,
    roughness: 1,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR,
    roughness: 0.85,
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

  // Piso do superior fica sobre a laje (laje top = STORY_HEIGHT + 0.08).
  // Centro do piso a STORY_HEIGHT + 0.08 + 0.04 + epsilon evita z-fighting
  // com o topo da laje.
  const floorSuperiorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCO_WIDTH, 0.08, BLOCO_DEPTH),
    floorMat,
  );
  floorSuperiorMesh.position.set(0, STORY_HEIGHT + 0.125, 0);
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

  // -------- Classificacao + mobiliario por sala --------
  type RoomType =
    | "classroom" | "lab" | "office" | "meeting"
    | "bathroom" | "storage" | "breakroom" | "generic";

  function classifyRoom(text: string): RoomType {
    const t = text.toLowerCase();
    // Labs especiais com nomes proprios
    if (
      t === "ltap" || t === "lasic" ||
      t.startsWith("núcleo") || t.startsWith("nucleo")
    ) return "lab";
    if (t.includes("w.c") || t.includes("banheiro")) return "bathroom";
    if (t.includes("reunio") || t.includes("reuniões") || t.includes("reuniao")) return "meeting";
    if (t.includes("professor")) return "breakroom";
    if (t.includes("lab")) return "lab";
    if (t.includes("descarga") || t.includes("equipament")) return "storage";
    if (t.includes("gab") || t.includes("coordena")) return "office";
    if (t.includes("sala de aula") || /sala \d/.test(t) || t.includes("latim")) return "classroom";
    return "generic";
  }

  type RoomBounds = { xMin: number; xMax: number; zMin: number; zMax: number };

  function placeFurniture(
    parent: THREE.Object3D,
    type: RoomType,
    b: RoomBounds,
    storyY: number,
    rowFacing: Row, // direcao do corredor (norte→sul=rowFacing=='north' significa porta no sul da sala)
  ) {
    const cx = (b.xMin + b.xMax) / 2;
    const cz = (b.zMin + b.zMax) / 2;
    const roomW = b.xMax - b.xMin;
    const roomD = b.zMax - b.zMin;
    // direcao da parede de fundo (oposta ao corredor)
    const backZ = rowFacing === "north" ? b.zMin + 0.2 : b.zMax - 0.2;
    const doorZ = rowFacing === "north" ? b.zMax : b.zMin; // perto do corredor

    const addMesh = (geom: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(x, y + storyY, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const ry = (m: THREE.Mesh, r: number) => { m.rotation.y = r; return m; };

    if (type === "classroom") {
      // Lousa na parede de fundo
      const boardW = Math.min(roomW * 0.7, 3.2);
      addMesh(new THREE.BoxGeometry(boardW, 1.1, 0.05), chalkMat, cx, 1.35, backZ);
      // Carteiras + cadeiras em 2-3 fileiras voltadas pra lousa
      const rows = 3;
      const cols = Math.max(2, Math.min(4, Math.floor(roomW / 1.5)));
      const startZ = doorZ + (rowFacing === "north" ? -1.2 : 1.2);
      const stepZ = rowFacing === "north" ? -1.1 : 1.1;
      const stepX = roomW / (cols + 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dx = b.xMin + stepX * (c + 1);
          const dz = startZ + stepZ * r;
          addMesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), woodMat, dx, 0.7, dz);
          for (const lx of [-0.3, 0.3]) for (const lz of [-0.2, 0.2]) {
            addMesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), darkWoodMat, dx + lx, 0.35, dz + lz);
          }
          // cadeira atras (em direcao a porta)
          const chairOffset = rowFacing === "north" ? 0.5 : -0.5;
          addMesh(new THREE.BoxGeometry(0.5, 0.05, 0.45), roomChairMat, dx, 0.45, dz + chairOffset);
          addMesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), roomChairMat, dx, 0.8, dz + chairOffset + (rowFacing === "north" ? 0.2 : -0.2));
          for (const lx of [-0.2, 0.2]) for (const lz of [-0.18, 0.18]) {
            addMesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), roomChairMat, dx + lx, 0.22, dz + chairOffset + lz);
          }
        }
      }
    } else if (type === "lab") {
      // Bancadas em U com computadores
      const benchH = 0.75;
      const monitorW = 0.55, monitorH = 0.4, monitorD = 0.06;
      const placePc = (x: number, z: number, facing: number) => {
        // bancada
        addMesh(new THREE.BoxGeometry(0.9, 0.04, 0.6), woodMat, x, benchH, z);
        for (const lx of [-0.4, 0.4]) for (const lz of [-0.25, 0.25]) {
          addMesh(new THREE.BoxGeometry(0.06, benchH, 0.06), darkWoodMat, x + lx, benchH / 2, z + lz);
        }
        // monitor (caixa preta + tela emissiva)
        const mz = z - Math.sin(facing) * 0.15;
        const mx = x - Math.cos(facing) * 0.15;
        const monBack = addMesh(new THREE.BoxGeometry(monitorW, monitorH, monitorD), monitorMat, mx, benchH + 0.05 + monitorH / 2, mz);
        ry(monBack, facing);
        const monScreen = addMesh(new THREE.BoxGeometry(monitorW - 0.06, monitorH - 0.06, 0.01), screenMat, mx, benchH + 0.05 + monitorH / 2, mz);
        ry(monScreen, facing);
        monScreen.translateZ(monitorD / 2 + 0.005);
        // cpu box
        addMesh(new THREE.BoxGeometry(0.16, 0.36, 0.32), pcCaseMat, x + 0.3, benchH + 0.18, z + 0.1);
      };
      // 4-6 PCs em linha contra a parede de fundo
      const numPcs = Math.max(3, Math.min(6, Math.floor(roomW / 1.2)));
      const stepX = roomW / (numPcs + 1);
      const facing = rowFacing === "north" ? Math.PI : 0; // monitor olha pra porta
      for (let i = 0; i < numPcs; i++) {
        const px = b.xMin + stepX * (i + 1);
        placePc(px, backZ + (rowFacing === "north" ? 0.6 : -0.6), facing);
      }
    } else if (type === "office") {
      // Mesa grande no centro
      addMesh(new THREE.BoxGeometry(1.6, 0.05, 0.8), woodMat, cx, 0.78, cz);
      for (const lx of [-0.7, 0.7]) for (const lz of [-0.35, 0.35]) {
        addMesh(new THREE.BoxGeometry(0.07, 0.78, 0.07), darkWoodMat, cx + lx, 0.39, cz + lz);
      }
      // Cadeira do prof atras da mesa (lado da parede)
      const chairZ = rowFacing === "north" ? cz - 0.7 : cz + 0.7;
      addMesh(new THREE.BoxGeometry(0.55, 0.05, 0.5), roomChairMat, cx, 0.48, chairZ);
      addMesh(new THREE.BoxGeometry(0.55, 0.6, 0.05), roomChairMat,
        cx, 0.8, chairZ + (rowFacing === "north" ? -0.22 : 0.22));
      // Estante na parede lateral
      const shelfX = b.xMin + 0.25;
      addMesh(new THREE.BoxGeometry(0.4, 1.6, Math.min(1.6, roomD - 0.6)), shelfMat, shelfX, 0.8, cz);
      // Pequeno pc no canto
      const pcDeskZ = backZ + (rowFacing === "north" ? 0.4 : -0.4);
      addMesh(new THREE.BoxGeometry(0.55, 0.04, 0.5), darkWoodMat, b.xMax - 0.5, 0.78, pcDeskZ);
      const mon = addMesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), monitorMat, b.xMax - 0.5, 1.02, pcDeskZ);
      ry(mon, rowFacing === "north" ? Math.PI : 0);
    } else if (type === "meeting") {
      // Mesa de reuniao grande
      addMesh(new THREE.BoxGeometry(roomW * 0.55, 0.06, Math.min(1.4, roomD * 0.4)), woodMat, cx, 0.78, cz);
      // 6 cadeiras ao redor (2 norte, 2 sul, 1 cada ponta)
      const halfMW = roomW * 0.55 / 2;
      const halfMD = Math.min(1.4, roomD * 0.4) / 2;
      for (const sx of [-halfMW * 0.6, halfMW * 0.6]) {
        for (const sz of [-halfMD - 0.4, halfMD + 0.4]) {
          addMesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), roomChairMat, cx + sx, 0.45, cz + sz);
        }
      }
      addMesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), roomChairMat, cx - halfMW - 0.4, 0.45, cz);
      addMesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), roomChairMat, cx + halfMW + 0.4, 0.45, cz);
    } else if (type === "breakroom") {
      // Sofa contra a parede de fundo + mesa de centro
      addMesh(new THREE.BoxGeometry(Math.min(2.5, roomW - 1), 0.6, 0.7), sofaMat, cx, 0.35, backZ + (rowFacing === "north" ? 0.45 : -0.45));
      addMesh(new THREE.BoxGeometry(Math.min(2.5, roomW - 1), 0.7, 0.18), sofaMat, cx, 0.85, backZ + (rowFacing === "north" ? 0.15 : -0.15));
      addMesh(new THREE.BoxGeometry(1.0, 0.05, 0.6), darkWoodMat, cx, 0.32, cz);
      for (const lx of [-0.4, 0.4]) for (const lz of [-0.25, 0.25]) {
        addMesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), darkWoodMat, cx + lx, 0.16, cz + lz);
      }
    } else if (type === "bathroom") {
      // Cubas/cabines simples
      const numStalls = Math.max(2, Math.min(3, Math.floor(roomW / 1.2)));
      const step = roomW / (numStalls + 1);
      for (let i = 0; i < numStalls; i++) {
        const sx = b.xMin + step * (i + 1);
        addMesh(new THREE.BoxGeometry(0.5, 0.45, 0.6), toiletMat, sx, 0.22, backZ + (rowFacing === "north" ? 0.4 : -0.4));
        // tampa
        addMesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), toiletMat, sx, 0.48, backZ + (rowFacing === "north" ? 0.4 : -0.4) - (rowFacing === "north" ? 0.05 : -0.05));
        // divisorias
        if (i < numStalls - 1) {
          addMesh(new THREE.BoxGeometry(0.04, 1.4, 1.2), innerMat, sx + step / 2, 0.7, backZ + (rowFacing === "north" ? 0.3 : -0.3));
        }
      }
    } else if (type === "storage") {
      // Estantes em duas fileiras
      const numShelves = Math.max(2, Math.floor(roomW / 1.2));
      const step = roomW / (numShelves + 1);
      for (let i = 0; i < numShelves; i++) {
        const sx = b.xMin + step * (i + 1);
        addMesh(new THREE.BoxGeometry(0.7, 1.8, 0.45), shelfMat, sx, 0.9, backZ + (rowFacing === "north" ? 0.35 : -0.35));
      }
    }
    // generic: deixa vazio (no caso de salas nao reconhecidas)
  }

  // -------- Salas (paredes internas) --------
  // Layout em T: o bloco eh um retangulo, mas dentro tem duas asas de salas
  // (oeste e leste do lounge central) e o "pe do T" eh o lounge.
  // A escada (pequena) fica agora no centro do lounge, contra a parede
  // norte; as alas vao ate as paredes externas leste/oeste.
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

    // No superior, dois labs gigantes ocupam os extremos das alas
    // (atravessam o corredor — viram uma sala so):
    //  - LATIM no oeste, com parede divisoria em x=-29
    //  - Laboratorio de Redes Wireless no leste, parede em x=+38
    const isSuperior = storyY > 0.001;
    const LATIM_EAST_X = -29;
    const WIRELESS_WEST_X = 38;
    const hasLatim = isSuperior;
    const hasWireless = isSuperior;

    const leftRooms = rooms.filter(
      (r) => r.worldX < -LOUNGE_HALF_WIDTH && (!hasLatim || r.worldX > LATIM_EAST_X),
    );
    const rightRooms = rooms.filter(
      (r) => r.worldX > LOUNGE_HALF_WIDTH && (!hasWireless || r.worldX < WIRELESS_WEST_X),
    );
    const wings: Wing[] = [
      {
        rooms: leftRooms,
        outerX: hasLatim ? LATIM_EAST_X : (-halfW + WALL_THICKNESS),
        loungeX: -LOUNGE_HALF_WIDTH,
      },
      {
        rooms: rightRooms,
        outerX: hasWireless ? WIRELESS_WEST_X : (halfW - WALL_THICKNESS),
        loungeX: LOUNGE_HALF_WIDTH,
      },
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
          const isLast = i === list.length - 1;
          const prevX = i === 0 ? xMin : (list[i - 1].worldX + r.worldX) / 2;
          // closeRowAt encurta a fileira: o ultimo room com esse marcador
          // termina ali em vez de estender ate o fim da ala.
          const nextX = isLast
            ? (r.closeRowAt ?? xMax)
            : (r.worldX + list[i + 1].worldX) / 2;
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
          // Se a fileira fecha aqui, adicionar cap wall perpendicular
          // ao corredor (sela a fileira a leste).
          if (isLast && r.closeRowAt != null) {
            addStoryBox(INNER_WALL_THICKNESS, wallH, rowDepth,
              r.closeRowAt, storyY + wallH / 2, wallZ, innerMat);
            registerInnerBlocker(
              r.closeRowAt - t2, r.closeRowAt + t2,
              wallZ - rowDepth / 2, wallZ + rowDepth / 2,
            );
          }
        }
      }
    }

    // Labels + moveis de cada sala
    for (const wing of wings) {
      const rowGroups: Record<Row, Room[]> = { north: [], south: [] };
      for (const r of wing.rooms) rowGroups[r.row].push(r);
      for (const row of ["north", "south"] as Row[]) {
        rowGroups[row].sort((a, b) => a.worldX - b.worldX);
      }
      const xMin = Math.min(wing.outerX, wing.loungeX);
      const xMax = Math.max(wing.outerX, wing.loungeX);

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

        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          const isLast = i === list.length - 1;
          const prevX = i === 0 ? xMin : (list[i - 1].worldX + r.worldX) / 2;
          const nextX = isLast
            ? (r.closeRowAt ?? xMax)
            : (r.worldX + list[i + 1].worldX) / 2;

          // Label
          const sprite = makeLabelSprite(r.label.text);
          sprite.position.set(r.worldX, storyY + wallH - 0.6, rowZCenter);
          storyGroup.add(sprite);

          // Mobiliario
          const type = classifyRoom(r.label.text);
          const bounds = {
            xMin: prevX + 0.2,
            xMax: nextX - 0.2,
            zMin: Math.min(corridorEdgeZ, outerEdgeZ) + 0.3,
            zMax: Math.max(corridorEdgeZ, outerEdgeZ) - 0.3,
          };
          placeFurniture(storyGroup, type, bounds, storyY, row);
        }
      }
    }

    // -------- LATIM (sala gigante no oeste do superior) --------
    if (hasLatim) {
      const latimXMin = -halfW + WALL_THICKNESS;
      const latimXMax = LATIM_EAST_X;
      const latimZMin = -halfD + WALL_THICKNESS;
      const latimZMax = halfD - WALL_THICKNESS;
      const latimCx = (latimXMin + latimXMax) / 2;
      const latimCz = (latimZMin + latimZMax) / 2;
      const latimWidth = latimXMax - latimXMin;

      // Parede leste de LATIM com porta de 1.6m centrada em z=0
      const doorW = 1.6;
      const northSegDepth = -doorW / 2 - latimZMin;
      const northSegZ = (latimZMin + (-doorW / 2)) / 2;
      const southSegDepth = latimZMax - doorW / 2;
      const southSegZ = (doorW / 2 + latimZMax) / 2;
      addStoryBox(
        INNER_WALL_THICKNESS, wallH, northSegDepth,
        latimXMax, storyY + wallH / 2, northSegZ, innerMat,
      );
      addStoryBox(
        INNER_WALL_THICKNESS, wallH, southSegDepth,
        latimXMax, storyY + wallH / 2, southSegZ, innerMat,
      );
      registerInnerBlocker(
        latimXMax - t2, latimXMax + t2,
        latimZMin, -doorW / 2,
      );
      registerInnerBlocker(
        latimXMax - t2, latimXMax + t2,
        doorW / 2, latimZMax,
      );

      // Label LATIM grande, no centro da sala
      const sprite = makeLabelSprite("LATIM — Lab. de Tecnologia em Automacao e Informacao");
      sprite.position.set(latimCx, storyY + wallH - 0.6, latimCz);
      sprite.scale.multiplyScalar(1.4); // maior pra sala grande
      storyGroup.add(sprite);

      // Mobiliario: muitas bancadas com PCs em duas linhas grandes
      const pcRowZ = [latimZMin + 1.8, latimZMax - 1.8];
      const pcsPerRow = Math.max(4, Math.floor(latimWidth / 2.2));
      const pcStepX = latimWidth / (pcsPerRow + 1);
      for (const pcZ of pcRowZ) {
        const facing = pcZ < 0 ? 0 : Math.PI; // monitor olha pro centro
        for (let i = 0; i < pcsPerRow; i++) {
          const px = latimXMin + pcStepX * (i + 1);
          // Bancada
          const bench = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 0.04, 0.65),
            woodMat,
          );
          bench.position.set(px, storyY + 0.78, pcZ);
          bench.castShadow = true;
          storyGroup.add(bench);
          // Pernas
          for (const lx of [-0.42, 0.42]) for (const lz of [-0.27, 0.27]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), darkWoodMat);
            leg.position.set(px + lx, storyY + 0.39, pcZ + lz);
            storyGroup.add(leg);
          }
          // Monitor + tela
          const monBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.06), monitorMat);
          monBack.position.set(px - Math.cos(facing) * 0.18, storyY + 1.05, pcZ - Math.sin(facing) * 0.18);
          monBack.rotation.y = facing;
          monBack.castShadow = true;
          storyGroup.add(monBack);
          const monScreen = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.012), screenMat);
          monScreen.position.copy(monBack.position);
          monScreen.rotation.y = facing;
          monScreen.translateZ(0.04);
          storyGroup.add(monScreen);
          // CPU
          const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.34), pcCaseMat);
          cpu.position.set(px + 0.35, storyY + 0.98, pcZ + 0.08);
          cpu.castShadow = true;
          storyGroup.add(cpu);
          // Cadeira simples
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.5), roomChairMat);
          const chairOffset = pcZ < 0 ? 0.7 : -0.7;
          seat.position.set(px, storyY + 0.48, pcZ + chairOffset);
          seat.castShadow = true;
          storyGroup.add(seat);
        }
      }

      // Quadro/lousa em uma das paredes laterais (parede oeste)
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 3.4), chalkMat);
      board.position.set(latimXMin + 0.05, storyY + 1.5, latimCz);
      storyGroup.add(board);

      // -------- Mesa de pôquer no centro do LATIM --------
      const pokerCx = latimCx;
      const pokerCz = latimCz;
      const tableRadius = 1.4;
      const rimRadius = tableRadius + 0.15;
      const tableTopY = storyY + 0.78;
      const tableTopThick = 0.06;

      const feltMat = new THREE.MeshStandardMaterial({ color: 0x0d6b3d, roughness: 0.95 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x3a1f10, roughness: 0.75 });
      const chipRedMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 });
      const chipBlueMat = new THREE.MeshStandardMaterial({ color: 0x2a6fb5, roughness: 0.6 });
      const chipWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.55 });
      const cardFaceMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 });
      const cardBackMat = new THREE.MeshStandardMaterial({ color: 0x8c1c1c, roughness: 0.5 });

      // Base larga no chão
      const baseDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.6, 0.08, 16),
        darkWoodMat,
      );
      baseDisc.position.set(pokerCx, storyY + 0.04, pokerCz);
      baseDisc.receiveShadow = true;
      storyGroup.add(baseDisc);

      // Pedestal
      const pedestalH = tableTopY - storyY - tableTopThick - 0.08;
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.32, pedestalH, 12),
        darkWoodMat,
      );
      pedestal.position.set(pokerCx, storyY + 0.08 + pedestalH / 2, pokerCz);
      pedestal.castShadow = true;
      storyGroup.add(pedestal);

      // Tampo (feltro verde)
      const tableTop = new THREE.Mesh(
        new THREE.CylinderGeometry(tableRadius, tableRadius, tableTopThick, 32),
        feltMat,
      );
      tableTop.position.set(pokerCx, tableTopY, pokerCz);
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      storyGroup.add(tableTop);

      // Borda de madeira (anel)
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(tableRadius + 0.07, 0.08, 10, 40),
        rimMat,
      );
      rim.position.set(pokerCx, tableTopY + tableTopThick / 2, pokerCz);
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = true;
      storyGroup.add(rim);

      // Bloqueio físico no tampo (player não atravessa a mesa)
      registerInnerBlocker(
        pokerCx - rimRadius, pokerCx + rimRadius,
        pokerCz - rimRadius, pokerCz + rimRadius,
      );

      // 5 cartas comunitárias decorativas (algumas viradas)
      for (let c = 0; c < 5; c++) {
        const faceUp = c < 3;
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.005, 0.22),
          faceUp ? cardFaceMat : cardBackMat,
        );
        card.position.set(
          pokerCx - 0.4 + c * 0.2,
          tableTopY + tableTopThick / 2 + 0.004,
          pokerCz - 0.15,
        );
        storyGroup.add(card);
      }

      // Pilhas de fichas em 4 pontos
      const chipMats = [chipRedMat, chipBlueMat, chipWhiteMat];
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
        const stackX = pokerCx + Math.cos(a) * 0.7;
        const stackZ = pokerCz + Math.sin(a) * 0.7;
        for (let k = 0; k < 5; k++) {
          const mat = chipMats[(s + k) % chipMats.length];
          const chip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.018, 12),
            mat,
          );
          chip.position.set(
            stackX,
            tableTopY + tableTopThick / 2 + 0.011 + k * 0.019,
            stackZ,
          );
          storyGroup.add(chip);
        }
      }

      // Dealer puck
      const dealer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.02, 18),
        chipWhiteMat,
      );
      dealer.position.set(pokerCx + 0.4, tableTopY + tableTopThick / 2 + 0.012, pokerCz + 0.45);
      storyGroup.add(dealer);

      // 6 cadeiras ao redor + interactables (cada assento dispara onPokerSeatInteract)
      const seatRadius = rimRadius + 0.95;
      const seatCount = 6;
      for (let i = 0; i < seatCount; i++) {
        const angle = (i / seatCount) * Math.PI * 2 + Math.PI / 6;
        const sx = pokerCx + Math.cos(angle) * seatRadius;
        const sz = pokerCz + Math.sin(angle) * seatRadius;
        // Cadeira olha pra mesa
        const facing = Math.atan2(pokerCx - sx, pokerCz - sz);

        const seatGroup = new THREE.Group();
        seatGroup.position.set(sx, storyY, sz);
        seatGroup.rotation.y = facing;
        storyGroup.add(seatGroup);

        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.08, 0.55),
          roomChairMat,
        );
        seat.position.set(0, 0.45, 0);
        seat.castShadow = true;
        seatGroup.add(seat);

        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.6, 0.08),
          roomChairMat,
        );
        back.position.set(0, 0.79, -0.24);
        back.castShadow = true;
        seatGroup.add(back);

        for (const dx of [-0.22, 0.22]) for (const dz of [-0.22, 0.22]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), darkWoodMat);
          leg.position.set(dx, 0.225, dz);
          seatGroup.add(leg);
        }

        // Placa numérica acima do encosto
        const seatLabel = makeLabelSprite(`Assento ${i + 1}`);
        seatLabel.position.set(0, 1.45, -0.1);
        seatLabel.scale.multiplyScalar(0.6);
        seatGroup.add(seatLabel);

        if (interactables) {
          const seatIndex = i;
          const anchorWorld = new THREE.Vector3(centerX + sx, 0, centerZ + sz);
          interactables.push({
            kind: "poker-seat",
            label: `Sentar na mesa de pôquer (assento ${seatIndex + 1})`,
            radius: 1.1,
            position: new THREE.Vector3(centerX + sx, tableTopY, centerZ + sz),
            root: seatGroup,
            npcDisabled: () => true,
            interact: () => {
              options.onPokerSeatInteract?.(seatIndex, {
                position: anchorWorld,
                rotation: facing,
              });
            },
          });
        }
      }
    }

    // -------- Lab. de Redes Wireless (sala media no leste do superior) --------
    if (hasWireless) {
      const wXMin = WIRELESS_WEST_X;
      const wXMax = halfW - WALL_THICKNESS;
      const wZMin = -halfD + WALL_THICKNESS;
      const wZMax = halfD - WALL_THICKNESS;
      const wCx = (wXMin + wXMax) / 2;
      const wCz = (wZMin + wZMax) / 2;
      const wWidth = wXMax - wXMin;

      // Parede divisoria oeste com porta de 1.6m centrada em z=0
      const doorW = 1.6;
      const northSegDepth = -doorW / 2 - wZMin;
      const northSegZ = (wZMin + (-doorW / 2)) / 2;
      const southSegDepth = wZMax - doorW / 2;
      const southSegZ = (doorW / 2 + wZMax) / 2;
      addStoryBox(
        INNER_WALL_THICKNESS, wallH, northSegDepth,
        wXMin, storyY + wallH / 2, northSegZ, innerMat,
      );
      addStoryBox(
        INNER_WALL_THICKNESS, wallH, southSegDepth,
        wXMin, storyY + wallH / 2, southSegZ, innerMat,
      );
      registerInnerBlocker(wXMin - t2, wXMin + t2, wZMin, -doorW / 2);
      registerInnerBlocker(wXMin - t2, wXMin + t2, doorW / 2, wZMax);

      // Label da sala
      const sprite = makeLabelSprite("Laboratório de Redes Wireless");
      sprite.position.set(wCx, storyY + wallH - 0.6, wCz);
      sprite.scale.multiplyScalar(1.2);
      storyGroup.add(sprite);

      // Bancadas com PCs em duas fileiras (norte + sul), sala menor
      // entao numero menor de PCs
      const pcsPerRow = Math.max(2, Math.floor(wWidth / 2.2));
      const pcStepX = wWidth / (pcsPerRow + 1);
      for (const pcZ of [wZMin + 1.6, wZMax - 1.6]) {
        const facing = pcZ < 0 ? 0 : Math.PI;
        for (let i = 0; i < pcsPerRow; i++) {
          const px = wXMin + pcStepX * (i + 1);
          const bench = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.65), woodMat);
          bench.position.set(px, storyY + 0.78, pcZ);
          bench.castShadow = true;
          storyGroup.add(bench);
          for (const lx of [-0.42, 0.42]) for (const lz of [-0.27, 0.27]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), darkWoodMat);
            leg.position.set(px + lx, storyY + 0.39, pcZ + lz);
            storyGroup.add(leg);
          }
          const monBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.06), monitorMat);
          monBack.position.set(px - Math.cos(facing) * 0.18, storyY + 1.05, pcZ - Math.sin(facing) * 0.18);
          monBack.rotation.y = facing;
          monBack.castShadow = true;
          storyGroup.add(monBack);
          const monScreen = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.012), screenMat);
          monScreen.position.copy(monBack.position);
          monScreen.rotation.y = facing;
          monScreen.translateZ(0.04);
          storyGroup.add(monScreen);
          const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.34), pcCaseMat);
          cpu.position.set(px + 0.32, storyY + 0.98, pcZ + 0.08);
          cpu.castShadow = true;
          storyGroup.add(cpu);
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.5), roomChairMat);
          const chairOffset = pcZ < 0 ? 0.7 : -0.7;
          seat.position.set(px, storyY + 0.48, pcZ + chairOffset);
          seat.castShadow = true;
          storyGroup.add(seat);
        }
      }

      // Antenas / roteador decorativo na parede leste
      const router = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.6), monitorMat);
      router.position.set(wXMax - 0.05, storyY + 2.5, wCz);
      storyGroup.add(router);
    }

    return storyBlockers;
  }

  const terreoStoryGroup = new THREE.Group();
  terreoStoryGroup.name = "blocoTelematica.terreo";
  group.add(terreoStoryGroup);
  const superiorStoryGroup = new THREE.Group();
  superiorStoryGroup.name = "blocoTelematica.superior";
  group.add(superiorStoryGroup);

  // Atualizacoes recentes no superior: Sala 06 + Sala 07 viraram um lab
  // unico (LTAP); Coord. de TI virou LASIC; LPA virou Nucleo de Redes
  // Operacionais. Aplicamos essas trocas na lista de rooms antes de
  // construir as paredes.
  const transformSuperior = (rooms: Room[]): Room[] => {
    let sala06: Room | null = null;
    let sala07: Room | null = null;
    const out: Room[] = [];
    for (const r of rooms) {
      const t = r.label.text;
      if (t === "Sala de Aula 06") { sala06 = r; continue; }
      if (t === "Sala de Aula 07") { sala07 = r; continue; }
      if (t === "Coordenação de T.i") {
        out.push({ ...r, label: { ...r.label, text: "LASIC" } });
        continue;
      }
      if (t === "Laboratório de Pesquisas Aplicadas (LPA)") {
        out.push({ ...r, label: { ...r.label, text: "Núcleo de Redes Operacionais" } });
        continue;
      }
      out.push(r);
    }
    if (sala06 || sala07) {
      const base = (sala06 ?? sala07) as Room;
      const worldX = sala06 && sala07
        ? (sala06.worldX + sala07.worldX) / 2
        : base.worldX;
      out.push({
        label: { ...base.label, text: "LTAP" },
        row: base.row,
        worldX,
      });
    }

    // Banheiros do superior: na fileira norte da ala direita, em frente
    // ao Laboratorio de Informatica 03 (worldX≈9). Tamanhos equilibrados
    // (~3.5m cada) e a fileira fecha logo depois do Masc (closeRowAt=13)
    // pra nao "esticar" ate a parede do Wireless.
    const mkBathroom = (text: string, worldX: number, closeRowAt?: number): Room => ({
      label: {
        text,
        px: { xMin: 0, yMin: 0, xMax: 0, yMax: 0, cx: 0, cy: 0 },
      },
      row: "north",
      worldX,
      closeRowAt,
    });
    out.push(mkBathroom("W.C. Feminino", 7.75));
    out.push(mkBathroom("W.C. Masculino", 11.25, 13));

    return out;
  };

  const terreoBlockers = buildStoryRooms(buildRoomList(terreoPlanta), 0, terreoStoryGroup);
  const superiorBlockers = buildStoryRooms(transformSuperior(buildRoomList(superiorPlanta)), STORY_HEIGHT, superiorStoryGroup);

  // -------- Laje intermediaria + teto --------
  // Laje cobre todo o footprint menos o vao da escada (no canto NE).
  // Quatro pedacos arranjados em volta do buraco.
  const stairHoleZMin = STAIR_CENTER_Z - STAIR_DEPTH / 2;
  const stairHoleZMax = STAIR_CENTER_Z + STAIR_DEPTH / 2;
  const stairHoleXMin = STAIR_CENTER_X - STAIR_LENGTH / 2;
  const stairHoleXMax = STAIR_CENTER_X + STAIR_LENGTH / 2;

  const slab = new THREE.Group();
  group.add(slab);
  const addSlabSlice = (w: number, d: number, x: number, z: number) => {
    if (w <= 0.01 || d <= 0.01) return;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.16, d),
      slabMat,
    );
    m.position.set(x, STORY_HEIGHT, z);
    m.castShadow = true;
    m.receiveShadow = true;
    slab.add(m);
  };
  // Norte do buraco (entre parede norte e topo do buraco)
  const slabNorthD = stairHoleZMin - (-halfD - 0.1);
  addSlabSlice(BLOCO_WIDTH + 0.2, slabNorthD, 0, (stairHoleZMin + (-halfD - 0.1)) / 2);
  // Sul do buraco (entre base do buraco e parede sul)
  const slabSouthD = (halfD + 0.1) - stairHoleZMax;
  addSlabSlice(BLOCO_WIDTH + 0.2, slabSouthD, 0, (stairHoleZMax + (halfD + 0.1)) / 2);
  // Oeste do buraco
  const slabWestW = stairHoleXMin - (-halfW - 0.1);
  addSlabSlice(slabWestW, STAIR_DEPTH, (stairHoleXMin + (-halfW - 0.1)) / 2, STAIR_CENTER_Z);
  // Leste do buraco
  const slabEastW = (halfW + 0.1) - stairHoleXMax;
  addSlabSlice(slabEastW, STAIR_DEPTH, (stairHoleXMax + (halfW + 0.1)) / 2, STAIR_CENTER_Z);

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

  // -------- Escada pequena no canto NE, lateral --------
  // Degraus crescem em X (player sobe andando pro leste). Cada degrau eh
  // estreito em X e largo em Z. 12 degraus.
  const stepCount = 12;
  const stepRise = STAIR_LENGTH / stepCount; // tamanho do degrau no X
  const stepHeight = STORY_HEIGHT / stepCount;
  const stairXBottom = STAIR_CENTER_X - STAIR_LENGTH / 2; // oeste = base
  for (let i = 0; i < stepCount; i++) {
    const sy = i * stepHeight + stepHeight / 2;
    const sx = stairXBottom + i * stepRise + stepRise / 2;
    addBox(stepRise, stepHeight, STAIR_DEPTH, sx, sy, STAIR_CENTER_Z, stairMat, false);
  }
  // Corrimaos (ao longo de X, nas duas laterais Z)
  for (const sz of [STAIR_CENTER_Z - STAIR_DEPTH / 2 - 0.04, STAIR_CENTER_Z + STAIR_DEPTH / 2 + 0.04]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(STAIR_LENGTH, 1.1, 0.08),
      stairMat,
    );
    rail.position.set(STAIR_CENTER_X, STORY_HEIGHT / 2 + 0.55, sz);
    rail.castShadow = true;
    group.add(rail);
  }
  // (divisoria antiga do leste removida — escada agora eh central)

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

  // Desativa frustum culling em tudo do bloco. Algumas combinacoes de
  // posicao da camera + transparencia das paredes faziam o bloco "sumir"
  // antes do fim do corredor. Forcar render evita esse comportamento.
  group.traverse((obj: THREE.Object3D) => {
    obj.frustumCulled = false;
  });

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
    // Nao usamos mais fade — paredes externas alternam .visible.
    const fadeMats: Array<{ mat: THREE.MeshStandardMaterial; target: number }> = [];
    // Escada lateral: x cresce pro leste (base oeste y=0 → topo leste y=SUPERIOR_VISUAL_Y).
    const STAIR_BOTTOM_X = STAIR_CENTER_X - STAIR_LENGTH / 2;
    const STAIR_TOP_X = STAIR_CENTER_X + STAIR_LENGTH / 2;
    const STAIR_MIN_Z = STAIR_CENTER_Z - STAIR_DEPTH / 2;
    const STAIR_MAX_Z = STAIR_CENTER_Z + STAIR_DEPTH / 2;
    // Topo visual do piso do superior = STORY_HEIGHT (slab center) + 0.08
    // (half slab) + 0.085 (half floor + epsilon). Player precisa ser
    // elevado ate aqui pra nao "afundar" no chao.
    const SUPERIOR_VISUAL_Y = STORY_HEIGHT + 0.165;
    let playerFloorY = 0;

    interactables.push({
      kind: "bloco-telematica",
      label: "Bloco Telemática",
      radius: 0,
      // Sphere de culling grande pra cobrir o bloco inteiro (90x16x7m).
      // Sem isso o engine escondia o grupo quando o centro do bloco
      // saia do frustum (player no fim do corredor).
      cullRadius: 60,
      cullDistance: 600,
      position: new THREE.Vector3(centerX, 0, centerZ),
      root: group,
      npcDisabled: () => true,
      update() {
        const p = getPlayerPosition();
        const localX = p.x - centerX;
        const localZ = p.z - centerZ;
        // Player conta como "dentro" so quando cruza a parede de fato.
        // (A culling do engine ja foi resolvida com cullRadius — nao
        // precisa de margem aqui pra renderizar.)
        const insideFootprint =
          Math.abs(localX) < BLOCO_WIDTH / 2 &&
          Math.abs(localZ) < BLOCO_DEPTH / 2;

        // Atualiza Y do andar conforme o jogador caminha
        const inStairZone =
          insideFootprint &&
          localZ >= STAIR_MIN_Z &&
          localZ <= STAIR_MAX_Z &&
          localX >= STAIR_BOTTOM_X &&
          localX <= STAIR_TOP_X;
        if (inStairZone) {
          const t = (localX - STAIR_BOTTOM_X) / (STAIR_TOP_X - STAIR_BOTTOM_X);
          playerFloorY = THREE.MathUtils.clamp(t, 0, 1) * SUPERIOR_VISUAL_Y;
        } else if (insideFootprint) {
          // Snap pro andar mais proximo, evita ficar parado entre niveis
          playerFloorY = playerFloorY < SUPERIOR_VISUAL_Y * 0.5 ? 0 : SUPERIOR_VISUAL_Y;
        } else {
          playerFloorY = 0;
        }

        // Adiciona offset Y ao player (engine ja setou y base + jumpY)
        p.y += playerFloorY;

        // Alterna os blockers internos conforme andar atual
        const onSuperior = playerFloorY >= SUPERIOR_VISUAL_Y * 0.5;
        for (const b of terreoBlockers) b.active = !onSuperior;
        for (const b of superiorBlockers) b.active = onSuperior;

        // Visibilidade dos story groups: so o andar do player aparece. Na
        // escada (entre andares), os dois ficam visiveis pra transicao
        // suave nao "piscar".
        const onStair = inStairZone;
        terreoStoryGroup.visible = onStair || !onSuperior;
        superiorStoryGroup.visible = onStair || onSuperior;

        // Laje (Group): invisivel no terreo, visivel no superior/escada.
        slab.visible = onSuperior || onStair;
        // Teto: invisivel quando o player esta dentro (deixa a camera
        // ver pro chao). Aparece de fora.
        roof.visible = !insideFootprint;
        // Paredes externas: visiveis so quando o player esta fora do
        // bloco. Quando entra, somem completamente pra a camera ver o
        // interior sem precisar transparencia (que gerava sorting bugs).
        for (const m of outerMeshesTerreo) m.visible = !insideFootprint;
        for (const m of outerMeshesSuperior) m.visible = !insideFootprint;

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
