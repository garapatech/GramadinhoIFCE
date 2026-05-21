import { campusPaths, type CampusPathDefinition, type CampusSurface } from "@/game/world/campusLayout";

type CampusSurfaceRect = Pick<CampusPathDefinition, "width" | "depth" | "x" | "z" | "rotation">;

export function pointInRotatedRect(x: number, z: number, rect: CampusSurfaceRect) {
  const dx = x - rect.x;
  const dz = z - rect.z;
  const angle = -(rect.rotation || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  return Math.abs(localX) <= rect.width / 2 && Math.abs(localZ) <= rect.depth / 2;
}

export function getCampusSurfaceAt(x: number, z: number): CampusSurface {
  for (const path of campusPaths) {
    if (pointInRotatedRect(x, z, path)) {
      return (path.surface || "cement") as CampusSurface;
    }
  }
  return "grass";
}
