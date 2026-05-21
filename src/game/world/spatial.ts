import * as THREE from "three";
import type { Blocker } from "@/features/game/engineTypes";

type WorldPoint2D = {
  x: number;
  z: number;
};

type WorldSpatialHelpersOptions = {
  blockers: readonly Blocker[];
  worldLimit: number;
};

export function getDistance2D(a: WorldPoint2D, b: WorldPoint2D) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function createWorldSpatialHelpers({ blockers, worldLimit }: WorldSpatialHelpersOptions) {
  function isInsideWorldBounds(x: number, z: number, radius = 0) {
    return (
      x >= -worldLimit + radius &&
      x <= worldLimit - radius &&
      z >= -worldLimit + radius &&
      z <= worldLimit - radius
    );
  }

  function isBlockedAt(x: number, z: number, radius = 0.35) {
    if (!isInsideWorldBounds(x, z, radius)) return true;
    for (const box of blockers) {
      if (box.active === false) continue;
      if (
        x > box.minX - radius &&
        x < box.maxX + radius &&
        z > box.minZ - radius &&
        z < box.maxZ + radius
      ) {
        return true;
      }
    }
    return false;
  }

  function clampPointToWorld(point: { x: number; y?: number; z: number }, radius = 0) {
    point.x = THREE.MathUtils.clamp(point.x, -worldLimit + radius, worldLimit - radius);
    point.z = THREE.MathUtils.clamp(point.z, -worldLimit + radius, worldLimit - radius);
    point.y = 0;
    return point;
  }

  return {
    isInsideWorldBounds,
    isBlockedAt,
    clampPointToWorld,
  };
}
