import * as THREE from "three";

export type CameraMode = "follow" | "orbit";

export interface CameraFocusTarget {
  kind: string;
  id: string;
  position: THREE.Vector3;
  label: string;
}

export type CameraCollisionBox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  active?: boolean;
};

export type CameraUpdateContext = {
  dt?: number;
  speed?: number;
  activity?: string;
  swimming?: boolean;
  jumping?: boolean;
  sitting?: boolean;
  blockers?: readonly CameraCollisionBox[];
};

export interface CameraController {
  mode: CameraMode;
  orbitYaw: number;
  orbitPitch: number;
  orbitDistance: number;
  dragActive: boolean;
  dragX: number;
  dragY: number;
  focusTarget: CameraFocusTarget | null;
  clearFocus(): void;
  setFocus(target: CameraFocusTarget | null | undefined): void;
  setMode(nextMode: CameraMode): void;
  toggleMode(): void;
  beginDrag(clientX: number, clientY: number): void;
  dragTo(clientX: number, clientY: number): void;
  endDrag(): void;
  zoomBy(deltaY: number): void;
  getOrbitCenter(playerPosition: THREE.Vector3, isRemotePlayerActive: (id: string) => boolean): THREE.Vector3;
  updateCamera(
    camera: THREE.PerspectiveCamera,
    playerPosition: THREE.Vector3,
    isRemotePlayerActive: (id: string) => boolean,
    context?: CameraUpdateContext,
  ): void;
}

const desiredPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const smoothLookAt = new THREE.Vector3();
const collisionStart = new THREE.Vector3();
const collisionDirection = new THREE.Vector3();

function segmentBoxEntryT(
  start: THREE.Vector3,
  end: THREE.Vector3,
  box: CameraCollisionBox,
  padding: number,
) {
  if (box.active === false) return null;

  const minX = box.minX - padding;
  const maxX = box.maxX + padding;
  const minZ = box.minZ - padding;
  const maxZ = box.maxZ + padding;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  let entry = 0;
  let exit = 1;

  for (const [origin, delta, min, max] of [
    [start.x, dx, minX, maxX],
    [start.z, dz, minZ, maxZ],
  ] as const) {
    if (Math.abs(delta) < 1e-6) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const inv = 1 / delta;
    let t1 = (min - origin) * inv;
    let t2 = (max - origin) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    entry = Math.max(entry, t1);
    exit = Math.min(exit, t2);
    if (entry > exit) return null;
  }

  if (exit < 0 || entry > 1) return null;
  const hitT = THREE.MathUtils.clamp(entry, 0, 1);
  const hitY = THREE.MathUtils.lerp(start.y, end.y, hitT);
  const minY = box.minY ?? -0.5;
  const maxY = box.maxY ?? 8.5;
  return hitY >= minY && hitY <= maxY ? hitT : null;
}

function resolveCameraCollision(
  target: THREE.Vector3,
  wanted: THREE.Vector3,
  blockers: readonly CameraCollisionBox[],
) {
  collisionStart.copy(target);
  collisionDirection.copy(wanted).sub(target);
  let nearestT = 1;

  for (const blocker of blockers) {
    const hitT = segmentBoxEntryT(collisionStart, wanted, blocker, 0.34);
    if (hitT !== null && hitT < nearestT) nearestT = hitT;
  }

  if (nearestT >= 1) return wanted;
  const safeT = THREE.MathUtils.clamp(nearestT - 0.045, 0.16, 1);
  wanted.copy(collisionStart).addScaledVector(collisionDirection, safeT);
  wanted.y = Math.max(wanted.y, target.y + 1.15);
  return wanted;
}

export function createCameraController(): CameraController {
  let mode: CameraMode = "orbit";
  let orbitYaw = Math.PI / 4;
  let orbitPitch = 0.38;
  let orbitDistance = 13.5;
  let dragActive = false;
  let dragX = 0;
  let dragY = 0;
  let focusTarget: CameraFocusTarget | null = null;
  let initialized = false;

  function clearFocus() {
    focusTarget = null;
  }

  function setFocus(target: CameraFocusTarget | null | undefined) {
    if (!target) {
      clearFocus();
      return;
    }
    focusTarget = {
      kind: target.kind,
      id: target.id || "",
      position: target.position,
      label: target.label || "Alvo",
    };
  }

  function getOrbitCenter(playerPosition: THREE.Vector3, isRemotePlayerActive: (id: string) => boolean) {
    if (mode !== "orbit" || !focusTarget) return playerPosition;
    if (focusTarget.kind === "remote" && !isRemotePlayerActive(focusTarget.id)) {
      clearFocus();
      return playerPosition;
    }
    return focusTarget.position || playerPosition;
  }

  function setMode(nextMode: CameraMode) {
    if (mode === nextMode) return;
    mode = nextMode;
    dragActive = false;
    initialized = false;
    if (mode !== "orbit") clearFocus();
  }

  function toggleMode() {
    setMode(mode === "follow" ? "orbit" : "follow");
  }

  function beginDrag(clientX: number, clientY: number) {
    if (mode !== "orbit") setMode("orbit");
    dragActive = true;
    dragX = clientX;
    dragY = clientY;
  }

  function dragTo(clientX: number, clientY: number) {
    if (mode !== "orbit" || !dragActive) return;
    const dx = clientX - dragX;
    const dy = clientY - dragY;
    dragX = clientX;
    dragY = clientY;
    orbitYaw -= dx * 0.005;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch - dy * 0.0042, 0.1, 1.16);
  }

  function endDrag() {
    dragActive = false;
  }

  function zoomBy(deltaY: number) {
    if (mode !== "orbit") setMode("orbit");
    orbitDistance = THREE.MathUtils.clamp(orbitDistance + deltaY * 0.014, 4.5, 28);
  }

  function updateCamera(
    camera: THREE.PerspectiveCamera,
    playerPosition: THREE.Vector3,
    isRemotePlayerActive: (id: string) => boolean,
    context: CameraUpdateContext = {},
  ) {
    const dt = THREE.MathUtils.clamp(context.dt ?? 1 / 60, 1 / 240, 0.05);
    const activity = context.activity || "idle";
    const running = activity === "running" || activity === "riding";
    const swimming = context.swimming === true;
    const sitting = context.sitting === true || activity === "sitting";
    const center = mode === "orbit"
      ? getOrbitCenter(playerPosition, isRemotePlayerActive)
      : playerPosition;

    const targetHeight = swimming ? 0.72 : sitting ? 1.05 : 1.35;
    desiredLookAt.set(center.x, center.y + targetHeight, center.z);

    if (mode === "orbit") {
      const horizontalDistance = Math.cos(orbitPitch) * orbitDistance;
      const verticalOffset = Math.sin(orbitPitch) * orbitDistance;
      desiredPosition.set(
        center.x + Math.cos(orbitYaw) * horizontalDistance,
        center.y + targetHeight + verticalOffset,
        center.z + Math.sin(orbitYaw) * horizontalDistance,
      );
    } else {
      const followDistance = swimming ? 10.5 : sitting ? 8.2 : running ? 16.2 : 14.2;
      const height = swimming ? 7.2 : sitting ? 6.4 : running ? 13.7 : 12.2;
      const yaw = Math.PI / 4;
      desiredPosition.set(
        center.x + Math.cos(yaw) * followDistance,
        center.y + height + (context.jumping ? 0.7 : 0),
        center.z + Math.sin(yaw) * followDistance,
      );
    }

    if (context.blockers?.length) {
      resolveCameraCollision(desiredLookAt, desiredPosition, context.blockers);
    }

    if (!initialized) {
      camera.position.copy(desiredPosition);
      smoothLookAt.copy(desiredLookAt);
      initialized = true;
    } else {
      const positionResponse = dragActive ? 18 : running ? 6.4 : 8.2;
      const positionAlpha = 1 - Math.exp(-dt * positionResponse);
      const lookAlpha = 1 - Math.exp(-dt * (dragActive ? 16 : 10.5));
      camera.position.lerp(desiredPosition, positionAlpha);
      smoothLookAt.lerp(desiredLookAt, lookAlpha);
    }

    const targetFov = swimming ? 44 : running ? 46 : sitting ? 40 : 42;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 3.8));
    camera.updateProjectionMatrix();
    camera.lookAt(smoothLookAt);
  }

  return {
    get mode() { return mode; },
    get orbitYaw() { return orbitYaw; },
    get orbitPitch() { return orbitPitch; },
    get orbitDistance() { return orbitDistance; },
    get dragActive() { return dragActive; },
    get dragX() { return dragX; },
    get dragY() { return dragY; },
    get focusTarget() { return focusTarget; },
    clearFocus,
    setFocus,
    setMode,
    toggleMode,
    beginDrag,
    dragTo,
    endDrag,
    zoomBy,
    getOrbitCenter,
    updateCamera,
  };
}
