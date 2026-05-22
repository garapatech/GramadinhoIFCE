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

export const CAMPUS_ENTRY_X = -34;
export const CAMPUS_ENTRY_Z = -70;
export const CAMPUS_ENTRY_WIDTH = 9;
export const CAMPUS_SPAWN = { x: CAMPUS_ENTRY_X, z: -77 };
export const CAMPUS_WALL_LIMIT = 73;
export const CAMPUS_WALL_HEIGHT = 4.2;
export const CAMPUS_WALL_THICKNESS = 1.2;

export const campusPaths = [
  { width: 84, depth: 6, x: 0, z: -8 },
  { width: 6, depth: 66, x: -10, z: 10 },
  { width: 6, depth: 60, x: CAMPUS_ENTRY_X, z: -28 },
  { width: 32, depth: 5, x: 20, z: 16, rotation: Math.PI / 12 },
  { width: 26, depth: 5, x: -28, z: 18, rotation: -Math.PI / 14 },
  { width: 18, depth: 4, x: 2, z: 28, surface: "corridor" },
  { width: 8, depth: 12, x: CAMPUS_ENTRY_X, z: -75, surface: "corridor" },
  { width: 8, depth: 8, x: CAMPUS_ENTRY_X, z: -67, surface: "corridor" },
  // Estradinha ligando o corredor central (z~28) ate a porta do Bloco 3 (z~52)
  { width: 5, depth: 24, x: 0, z: 40 },
] satisfies readonly CampusPathDefinition[];

export const campusBuildings = [
  { x: 0, z: -28, width: 26, depth: 12, height: 7, color: 0xdbe0dd, roof: 0x8b3d2c, name: "bloco central" },
  { x: -26, z: -16, width: 18, depth: 10, height: 5.5, color: 0xcfd7cc, roof: 0x6c7f56, name: "sala norte" },
  { x: 25, z: -14, width: 17, depth: 10, height: 5.5, color: 0xd6d2c8, roof: 0x8a6b4c, name: "laboratorio" },
  { x: -47, z: -52, width: 11, depth: 8, height: 4.4, color: 0xe4ddd2, roof: 0x375b47, name: "portaria" },
  { x: 18, z: 24, width: 16, depth: 9, height: 5, color: 0xc8d0da, roof: 0x4a6278, name: "biblioteca" },
  { x: -21, z: 26, width: 13, depth: 8, height: 4.5, color: 0xddddcf, roof: 0x64725f, name: "secretaria" },
  { x: 0, z: 10, width: 10, depth: 8, height: 4.2, color: 0xe3dad0, roof: 0x715142, name: "atelier" },
] satisfies readonly CampusBuildingDefinition[];

export const campusArena = {
  x: 40,
  z: 42,
  width: 26,
  depth: 18,
  name: "quadra pvp",
  floorColor: 0x4e7c2e,
  lineColor: 0xffffff,
  postColor: 0xdddddd,
  signPoleColor: 0xaaaaaa,
  signBoardColor: 0xd4421a,
} as const;
