// Definicao do Bloco Telematica do IFCE Cedro, reconstruido a partir das
// plantas baixas de 2018 (terreo + superior). Os assets cru sao servidos por
// /public/blocoTelematica/ e os labels (nomes de sala) com posicao pixel
// estao em superiorLabels.json / terreoLabels.json.

import superiorLabelsJson from "./superiorLabels.json";
import terreoLabelsJson from "./terreoLabels.json";

export type PlantaLabel = {
  text: string;
  px: { xMin: number; yMin: number; xMax: number; yMax: number; cx: number; cy: number };
};

export type PlantaSize = { width: number; height: number };

export type PlantaData = {
  refTexture: string;     // textura limpa (fundo branco) para usar no chao
  wallsTexture: string;   // mascara das paredes (branco sobre preto)
  wallsSvg: string;       // vetorizacao das paredes (potrace)
  originalTexture: string;// render direto do PDF (cores originais)
  pngSize: PlantaSize;
  labels: PlantaLabel[];
};

// Dimensoes do bloco no mundo. A planta marca o prédio com ~90m na
// realidade, mas o campus do Gramadinho é fechado por muros a 73 unidades
// do centro, entao escalamos o bloco para caber em um trecho disponivel.
// Quem quiser tamanho real depois e so subir esse valor (e o
// CAMPUS_WALL_LIMIT, em campusLayout.ts).
export const BLOCO_TELEMATICA_WORLD_WIDTH = 56;

// O PNG renderizado tem 2200x1700; profundidade do plano fica proporcional.
const PLANT_ASPECT = 1700 / 2200;
export const BLOCO_TELEMATICA_WORLD_DEPTH = BLOCO_TELEMATICA_WORLD_WIDTH * PLANT_ASPECT;

// Quantas unidades de mundo equivalem a 1 pixel da planta.
export const WORLD_UNITS_PER_PLANT_PIXEL = BLOCO_TELEMATICA_WORLD_WIDTH / 2200;

const cast = <T extends { labels: readonly unknown[] }>(json: T) => json as unknown as PlantaData;

export const superiorPlanta: PlantaData = cast({
  ...superiorLabelsJson,
  refTexture: "/blocoTelematica/superior-ref.png",
  wallsTexture: "/blocoTelematica/superior-walls.png",
  wallsSvg: "/blocoTelematica/superior-walls.svg",
  originalTexture: "/blocoTelematica/superior-original.png",
  pngSize: superiorLabelsJson.pngSize,
  labels: superiorLabelsJson.labels,
});

export const terreoPlanta: PlantaData = cast({
  ...terreoLabelsJson,
  refTexture: "/blocoTelematica/terreo-ref.png",
  wallsTexture: "/blocoTelematica/terreo-walls.png",
  wallsSvg: "/blocoTelematica/terreo-walls.svg",
  originalTexture: "/blocoTelematica/terreo-original.png",
  pngSize: terreoLabelsJson.pngSize,
  labels: terreoLabelsJson.labels,
});

// Converte coordenada da planta (pixel) para offset relativo ao centro do
// bloco, em unidades de mundo. Eixo X cresce pra direita; Z cresce pra
// "frente" (no mundo Three.js, sentido +Z).
export function plantaPixelToWorld(
  px: { cx: number; cy: number },
  pngSize: PlantaSize,
): { x: number; z: number } {
  const cxOffset = px.cx - pngSize.width / 2;
  const cyOffset = px.cy - pngSize.height / 2;
  return {
    x: cxOffset * WORLD_UNITS_PER_PLANT_PIXEL,
    z: cyOffset * WORLD_UNITS_PER_PLANT_PIXEL,
  };
}

// Posicao do bloco no mundo. Faixa sul do campus, onde tem espaco aberto
// — biblioteca/secretaria estao em z~+24, depois disso vai gramado ate o
// muro (z=+73). O bloco fica encostado no muro sul, com ~10m de gramado
// de frente.
export const BLOCO_TELEMATICA_PLACEMENT = {
  centerX: 0,
  centerZ: 60,
  floorThickness: 0.4,
  storyHeight: 3.6,
} as const;
