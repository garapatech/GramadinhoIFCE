import type { CampusSurface } from "@/game/world/campusLayout";

const MINIMAP_WORLD = 170;
const MINIMAP_SIZE = 220;
const MINIMAP_SCALE = MINIMAP_SIZE / MINIMAP_WORLD;

type MinimapPoint = {
  x: number;
  z: number;
};

type MinimapPath = MinimapPoint & {
  width: number;
  depth: number;
  rotation?: number;
  surface?: CampusSurface;
};

type MinimapBuilding = MinimapPoint & {
  width: number;
  depth: number;
  color: number;
  roof: number;
};

type MinimapMarker = MinimapPoint & {
  color?: string;
};

type MinimapEntity = {
  group: {
    position: MinimapPoint;
  };
  mapColor?: string;
};

type MinimapBus = {
  position: MinimapPoint;
  facingYaw: number;
};

export type MinimapSnapshot = {
  mapFeatures: {
    buildings: MinimapBuilding[];
    paths: MinimapPath[];
    trees: MinimapPoint[];
  };
  interactables: Array<{
    position: MinimapPoint;
    available: boolean;
  }>;
  remotePlayers: MinimapEntity[];
  npcs: MinimapEntity[];
  ducks: Array<MinimapEntity & { mapColor: string }>;
  pigeons: Array<MinimapEntity & { mapColor: string }>;
  buses: MinimapBus[];
  player: {
    position: MinimapPoint;
  };
  facing: {
    x: number;
    y: number;
  };
  espectroMarker?: MinimapMarker | null;
  now: number;
};

function hexFromInt(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function worldToMapX(x: number) {
  return MINIMAP_SIZE / 2 + x * MINIMAP_SCALE;
}

function worldToMapY(z: number) {
  return MINIMAP_SIZE / 2 + z * MINIMAP_SCALE;
}

export function renderMinimap(ctx: CanvasRenderingContext2D, snapshot: MinimapSnapshot) {
  const size = MINIMAP_SIZE;
  const half = size / 2;
  const inset = 5;
  const contentInset = 10;

  ctx.clearRect(0, 0, size, size);

  roundedRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, 18);
  const background = ctx.createRadialGradient(half - 8, half - 10, 18, half, half, half);
  background.addColorStop(0, "#8fd46f");
  background.addColorStop(0.56, "#6ea34e");
  background.addColorStop(1, "#4f7c38");
  ctx.fillStyle = background;
  ctx.fill();

  ctx.save();
  roundedRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, 18);
  ctx.clip();

  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i += 1) {
    const x = half + i * 28;
    ctx.beginPath();
    ctx.moveTo(x, contentInset);
    ctx.lineTo(x, size - contentInset);
    ctx.stroke();

    const y = half + i * 28;
    ctx.beginPath();
    ctx.moveTo(contentInset, y);
    ctx.lineTo(size - contentInset, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(38, 66, 37, 0.48)";
  for (const tree of snapshot.mapFeatures.trees) {
    const mx = worldToMapX(tree.x);
    const my = worldToMapY(tree.z);
    ctx.beginPath();
    ctx.arc(mx, my, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const path of snapshot.mapFeatures.paths) {
    ctx.save();
    ctx.translate(worldToMapX(path.x), worldToMapY(path.z));
    ctx.rotate(path.rotation || 0);
    const w = path.width * MINIMAP_SCALE;
    const h = path.depth * MINIMAP_SCALE;
    ctx.fillStyle = path.surface === "corridor" ? "#b7ae9c" : "#d1c8b9";
    ctx.strokeStyle = path.surface === "corridor" ? "rgba(78, 69, 57, 0.34)" : "rgba(78, 69, 57, 0.22)";
    ctx.lineWidth = 1;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (path.surface === "corridor") {
      ctx.strokeStyle = "rgba(255, 248, 220, 0.45)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 1, 0);
      ctx.lineTo(w / 2 - 1, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const b of snapshot.mapFeatures.buildings) {
    const mx = worldToMapX(b.x);
    const my = worldToMapY(b.z);
    const w = b.width * MINIMAP_SCALE;
    const h = b.depth * MINIMAP_SCALE;
    ctx.fillStyle = hexFromInt(b.color);
    ctx.fillRect(mx - w / 2, my - h / 2, w, h);
    ctx.strokeStyle = "rgba(40, 58, 42, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
    ctx.fillStyle = hexFromInt(b.roof);
    ctx.fillRect(mx - w / 2 + 1, my - h / 2 + 1, w - 2, 3);
  }

  ctx.fillStyle = "#f7d36a";
  for (const item of snapshot.interactables) {
    if (!item.available) continue;
    const mx = worldToMapX(item.position.x);
    const my = worldToMapY(item.position.z);
    ctx.beginPath();
    ctx.moveTo(mx, my - 3.2);
    ctx.lineTo(mx + 3.2, my);
    ctx.lineTo(mx, my + 3.2);
    ctx.lineTo(mx - 3.2, my);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (const r of snapshot.remotePlayers) {
    const rmx = worldToMapX(r.group.position.x);
    const rmy = worldToMapY(r.group.position.z);
    ctx.fillStyle = r.mapColor || "#ffe28f";
    ctx.strokeStyle = "rgba(255, 248, 220, 0.7)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(rmx, rmy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const npc of snapshot.npcs) {
    const mx = worldToMapX(npc.group.position.x);
    const my = worldToMapY(npc.group.position.z);
    ctx.fillStyle = npc.mapColor || "#ffffff";
    ctx.beginPath();
    ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const espectroMarker = snapshot.espectroMarker;
  if (espectroMarker) {
    const mx = worldToMapX(espectroMarker.x);
    const my = worldToMapY(espectroMarker.z);
    const blink = 0.45 + 0.55 * ((Math.sin(snapshot.now * 0.012) + 1) / 2);
    ctx.fillStyle = espectroMarker.color || "#000000";
    ctx.globalAlpha = blink;
    ctx.beginPath();
    ctx.arc(mx, my, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 + blink * 0.65;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const duck of snapshot.ducks) {
    const mx = worldToMapX(duck.group.position.x);
    const my = worldToMapY(duck.group.position.z);
    ctx.fillStyle = duck.mapColor;
    ctx.beginPath();
    ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (const pigeon of snapshot.pigeons) {
    const mx = worldToMapX(pigeon.group.position.x);
    const my = worldToMapY(pigeon.group.position.z);
    ctx.fillStyle = pigeon.mapColor;
    ctx.beginPath();
    ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  for (const bus of snapshot.buses) {
    const mx = worldToMapX(bus.position.x);
    const my = worldToMapY(bus.position.z);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(-bus.facingYaw);
    ctx.fillStyle = "#23824c";
    ctx.strokeStyle = "#f7f4ea";
    ctx.lineWidth = 1;
    ctx.fillRect(-4, -2.3, 8, 4.6);
    ctx.strokeRect(-4, -2.3, 8, 4.6);
    ctx.restore();
  }

  const pmx = worldToMapX(snapshot.player.position.x);
  const pmy = worldToMapY(snapshot.player.position.z);
  const angle = Math.atan2(snapshot.facing.x, snapshot.facing.y);

  ctx.save();
  ctx.translate(pmx, pmy);
  ctx.fillStyle = "rgba(98, 255, 159, 0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(pmx, pmy);
  ctx.rotate(-angle);
  ctx.shadowColor = "rgba(98, 255, 159, 0.45)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#62ff9f";
  ctx.strokeStyle = "rgba(17, 46, 27, 0.85)";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(-4.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentInset - 2, contentInset - 2, size - (contentInset - 2) * 2, size - (contentInset - 2) * 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
  ctx.font = "900 11px Nunito, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", size - 22, 22);
  ctx.strokeStyle = "rgba(23, 68, 43, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size - 22, 30);
  ctx.lineTo(size - 22, 44);
  ctx.stroke();

  ctx.restore();
}
