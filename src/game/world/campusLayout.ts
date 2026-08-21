export type CampusSurface = "grass" | "cement" | "corridor";
export type CampusPathDefinition = {
  width: number;
  depth: number;
  x: number;
  z: number;
  rotation?: number;
  surface?: CampusSurface;
};

export type CampusBuildingDefinition = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  roof: number;
  name: string;
};

export const CAMPUS_ENTRY_X = -37;
export const CAMPUS_ENTRY_Z = -75;
export const CAMPUS_ENTRY_WIDTH = 9;
export const CAMPUS_SPAWN = { x: CAMPUS_ENTRY_X, z: -82 };
// O Bloco 3 termina em z=68. Cinco unidades de respiro são suficientes e
// mantêm o circuito de parkour (em torno de ±80) totalmente fora do muro.
export const CAMPUS_WALL_LIMIT = 73;
export const CAMPUS_WALL_HEIGHT = 4.2;
export const CAMPUS_WALL_THICKNESS = 1.2;

export const campusPaths = [
  { width: 92, depth: 7, x: 0, z: -8 },
  { width: 7, depth: 72, x: -11, z: 11 },
  { width: 7, depth: 68, x: CAMPUS_ENTRY_X, z: -31 },
  { width: 36, depth: 6, x: 22, z: 18, rotation: Math.PI / 12 },
  { width: 30, depth: 6, x: -31, z: 20, rotation: -Math.PI / 14 },
  { width: 22, depth: 5, x: 2, z: 31, surface: "corridor" },
  { width: 9, depth: 12, x: CAMPUS_ENTRY_X, z: -80, surface: "corridor" },
  { width: 9, depth: 9, x: CAMPUS_ENTRY_X, z: -72, surface: "corridor" },
  // Estradinha ligando o corredor central (z~28) ate a porta do Bloco 3 (z~52)
  { width: 6, depth: 27, x: 0, z: 42 },
] satisfies readonly CampusPathDefinition[];

export const campusBuildings = [
  { x: 0, z: -31, width: 26, depth: 12, height: 7, color: 0xdbe0dd, roof: 0x8b3d2c, name: "bloco central" },
  { x: -29, z: -17, width: 18, depth: 10, height: 5.5, color: 0xcfd7cc, roof: 0x6c7f56, name: "sala norte" },
  { x: 28, z: -16, width: 17, depth: 10, height: 5.5, color: 0xd6d2c8, roof: 0x8a6b4c, name: "laboratorio" },
  { x: -51, z: -56, width: 11, depth: 8, height: 4.4, color: 0xe4ddd2, roof: 0x375b47, name: "portaria" },
  { x: 21, z: 27, width: 16, depth: 9, height: 5, color: 0xc8d0da, roof: 0x4a6278, name: "biblioteca" },
  { x: -24, z: 29, width: 13, depth: 8, height: 4.5, color: 0xddddcf, roof: 0x64725f, name: "secretaria" },
  { x: 1, z: 11, width: 10, depth: 8, height: 4.2, color: 0xe3dad0, roof: 0x715142, name: "atelier" },
] satisfies readonly CampusBuildingDefinition[];

export const campusArena = {
  x: 43,
  z: 44,
  width: 26,
  depth: 18,
  name: "quadra pvp",
  floorColor: 0x4e7c2e,
  lineColor: 0xffffff,
  postColor: 0xdddddd,
  signPoleColor: 0xaaaaaa,
  signBoardColor: 0xd4421a,
} as const;
