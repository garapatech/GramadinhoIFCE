import * as THREE from "three";
import type { AtmosphereState } from "@/game/atmosphere";
import type { CameraFocusTarget } from "@/game/camera";
import { getDistance2D } from "@/game/world/spatial";

export interface PlayerPositionSource {
  position?: THREE.Vector3;
  group?: {
    position: THREE.Vector3;
  };
  radius: number;
}

export interface PlayerInteractable extends PlayerPositionSource {
  kind?: string;
  label?: string;
  crowdLabel?: string;
  lines?: unknown[];
  previewLine?: string;
  bubbleKey?: string;
  name?: string;
  interact?: () => void;
  pause?: number;
  talkCooldown?: number;
}

export interface CameraFocusSource {
  id: string;
  nick?: string;
  group: {
    position: THREE.Vector3;
  };
}

export interface NearestInteractable<TItem> {
  item: TItem;
  distance: number;
}

function getEntityPosition<TItem extends PlayerPositionSource>(entity: TItem) {
  return entity.position || entity.group?.position || null;
}

export function getNearestTarget(
  playerPosition: THREE.Vector3,
  npcs: Iterable<PlayerPositionSource>,
  ducks: Iterable<PlayerPositionSource>,
  interactables: Iterable<PlayerInteractable>,
  isInteractableAvailableForPlayer: (item: PlayerInteractable) => boolean
) {
  let best: PlayerInteractable | null = null;
  let bestDistance = Infinity;

  for (const npc of npcs) {
    const position = getEntityPosition(npc);
    if (!position) continue;
    const distance = getDistance2D(playerPosition, position);
    if (distance < npc.radius && distance < bestDistance) {
      best = npc;
      bestDistance = distance;
    }
  }

  for (const duck of ducks) {
    const position = getEntityPosition(duck);
    if (!position) continue;
    const distance = getDistance2D(playerPosition, position);
    if (distance < duck.radius && distance < bestDistance) {
      best = duck;
      bestDistance = distance;
    }
  }

  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const distance = getDistance2D(playerPosition, item.position ?? item.group?.position ?? playerPosition);
    if (distance < item.radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }

  return best;
}

export function getNearestCameraFocusTarget(
  playerPosition: THREE.Vector3,
  remotePlayers: Iterable<CameraFocusSource>,
  interactables: Iterable<PlayerInteractable>,
  isInteractableAvailableForPlayer: (item: PlayerInteractable) => boolean
) {
  let best: CameraFocusTarget | null = null;
  let bestDistance = Infinity;

  for (const remotePlayer of remotePlayers) {
    const distance = getDistance2D(playerPosition, remotePlayer.group.position);
    if (distance < bestDistance) {
      best = {
        kind: "remote",
        id: remotePlayer.id,
        position: remotePlayer.group.position,
        label: remotePlayer.nick || "Player",
      };
      bestDistance = distance;
    }
  }

  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const distance = getDistance2D(playerPosition, item.position ?? item.group?.position ?? playerPosition);
    if (distance < 28 && distance < bestDistance) {
      best = {
        kind: "point",
        id: item.kind || item.label || "point",
        position: item.position ?? item.group?.position ?? playerPosition,
        label: item.label || "Ponto",
      };
      bestDistance = distance;
    }
  }

  return best;
}

export function getNearestInteractable(
  playerPosition: THREE.Vector3,
  interactables: Iterable<PlayerInteractable>,
  isInteractableAvailableForPlayer: (item: PlayerInteractable) => boolean,
  maxDistance = 7
): NearestInteractable<PlayerInteractable> | null {
  let best: PlayerInteractable | null = null;
  let bestDistance = maxDistance;

  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const distance = getDistance2D(playerPosition, item.position ?? item.group?.position ?? playerPosition);
    if (distance > bestDistance) continue;
    best = item;
    bestDistance = distance;
  }

  return best ? { item: best, distance: bestDistance } : null;
}

export function formatDistanceMeters(distance: number) {
  const rounded = Math.max(0, Math.round(distance * 10) / 10);
  return `${String(rounded).replace(".", ",")}m`;
}

export function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.ceil(safe)}s`;
}

export function getRidingBikeStatus() {
  return "Na bicicleta • Space/Pular da grau • Shift acelera • E desce.";
}

export function getNoTargetStatus(
  currentAtmosphereState: Pick<AtmosphereState, "clock" | "label" | "weatherLabel">,
  nearestInteractable: NearestInteractable<PlayerInteractable> | null
) {
  if (nearestInteractable) {
    const busCrowdText =
      nearestInteractable.item.kind === "bus" && nearestInteractable.item.crowdLabel
        ? ` • ${nearestInteractable.item.crowdLabel}`
        : "";
    return `Perto de ${nearestInteractable.item.label}${busCrowdText} • ${formatDistanceMeters(nearestInteractable.distance)} para interagir.`;
  }

  const weatherText = currentAtmosphereState.weatherLabel ? ` • ${currentAtmosphereState.weatherLabel}` : "";
  return `WASD ou setas para mover. E para interagir. • ${currentAtmosphereState.clock} ${currentAtmosphereState.label}${weatherText}`;
}

export function getTargetStatus(
  playerPosition: THREE.Vector3,
  target: {
    position?: THREE.Vector3;
    group?: {
      position: THREE.Vector3;
    };
    label?: string;
    kind?: string;
    crowdLabel?: string;
  }
) {
  const crowdText = target.kind === "bus" && target.crowdLabel ? ` • ${target.crowdLabel}` : "";
  const targetPosition = target.position ?? target.group?.position ?? playerPosition;
  return `${target.label || "Ponto"}${crowdText} • ${formatDistanceMeters(getDistance2D(playerPosition, targetPosition))}`;
}
