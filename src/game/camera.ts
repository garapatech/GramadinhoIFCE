import * as THREE from "three";

export type CameraMode = "follow" | "orbit";

export interface CameraFocusTarget {
  kind: string;
  id: string;
  position: THREE.Vector3;
  label: string;
}

export interface CameraModeState {
  mode: CameraMode;
  label: string;
  focusLabel: string;
}

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
    isRemotePlayerActive: (id: string) => boolean
  ): void;
}

export function createCameraController(onCameraModeChange: (state: CameraModeState) => void): CameraController {
  let mode: CameraMode = "follow";
  let orbitYaw = Math.PI / 4;
  let orbitPitch = 0.68;
  let orbitDistance = 28.5;
  let dragActive = false;
  let dragX = 0;
  let dragY = 0;
  let focusTarget: CameraFocusTarget | null = null;

  function emitCameraModeChange() {
    onCameraModeChange({
      mode,
      label: mode === "follow" ? "travada" : "livre",
      focusLabel: mode === "orbit" && focusTarget ? focusTarget.label : "",
    });
  }

  function clearFocus() {
    if (!focusTarget) return;
    focusTarget = null;
    emitCameraModeChange();
  }

  function setFocus(target: CameraFocusTarget | null | undefined) {
    if (!target) {
      clearFocus();
      return;
    }

    const nextFocus = {
      kind: target.kind,
      id: target.id || "",
      position: target.position,
      label: target.label || "Alvo",
    };

    if (
      focusTarget &&
      focusTarget.kind === nextFocus.kind &&
      focusTarget.id === nextFocus.id &&
      focusTarget.position === nextFocus.position &&
      focusTarget.label === nextFocus.label
    ) {
      return;
    }

    focusTarget = nextFocus;
    emitCameraModeChange();
  }

  function getOrbitCenter(playerPosition: THREE.Vector3, isRemotePlayerActive: (id: string) => boolean) {
    if (mode !== "orbit") return playerPosition;
    if (!focusTarget) return playerPosition;
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
    if (mode !== "orbit") {
      clearFocus();
    } else {
      emitCameraModeChange();
    }
  }

  function toggleMode() {
    setMode(mode === "follow" ? "orbit" : "follow");
  }

  function beginDrag(clientX: number, clientY: number) {
    if (mode !== "orbit") return;
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
    orbitYaw -= dx * 0.0055;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch - dy * 0.0045, 0.22, 1.08);
  }

  function endDrag() {
    dragActive = false;
  }

  function zoomBy(deltaY: number) {
    if (mode !== "orbit") return;
    orbitDistance = THREE.MathUtils.clamp(orbitDistance + deltaY * 0.02, 16, 38);
  }

  function updateCamera(
    camera: THREE.PerspectiveCamera,
    playerPosition: THREE.Vector3,
    isRemotePlayerActive: (id: string) => boolean
  ) {
    if (mode === "orbit") {
      const orbitCenter = getOrbitCenter(playerPosition, isRemotePlayerActive);
      const horizontalDistance = Math.cos(orbitPitch) * orbitDistance;
      const verticalOffset = Math.sin(orbitPitch) * orbitDistance;
      camera.position.set(
        orbitCenter.x + Math.cos(orbitYaw) * horizontalDistance,
        orbitCenter.y + 4.5 + verticalOffset,
        orbitCenter.z + Math.sin(orbitYaw) * horizontalDistance
      );
    } else {
      camera.position.set(playerPosition.x + 14, playerPosition.y + 18, playerPosition.z + 14);
    }

    const lookAtTarget = mode === "orbit" && focusTarget ? getOrbitCenter(playerPosition, isRemotePlayerActive) : playerPosition;
    camera.lookAt(lookAtTarget.x, 1.25, lookAtTarget.z);
  }

  emitCameraModeChange();

  return {
    get mode() {
      return mode;
    },
    get orbitYaw() {
      return orbitYaw;
    },
    get orbitPitch() {
      return orbitPitch;
    },
    get orbitDistance() {
      return orbitDistance;
    },
    get dragActive() {
      return dragActive;
    },
    get dragX() {
      return dragX;
    },
    get dragY() {
      return dragY;
    },
    get focusTarget() {
      return focusTarget;
    },
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
