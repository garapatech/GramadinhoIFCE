import type { CameraController } from "@/game/camera";
import type { DevToolsController } from "@/game/devtools";
import type { EmoteKind } from "@/features/game/emotes";

type InputEvent = KeyboardEvent | MouseEvent | PointerEvent | WheelEvent;

type GameInputBindingsContext = {
  cameraController: CameraController;
  cameraSurface: HTMLElement;
  devTools: DevToolsController;
  ensureAmbientAudio: () => void;
  isAmbientAudioEnabled: () => boolean;
  shouldIgnoreKeys: (event: InputEvent) => boolean;
  onPressKey: (code: string) => void;
  onReleaseKey: (code: string) => void;
  isSwimmingPlayerControlled: () => boolean;
  queueSwimmingStroke: () => void;
  queueSwimmingCancel: () => void;
  isEspectroSecretActive: () => boolean;
  queueEspectroThrow: () => void;
  onToggleCameraFocus: () => void;
  onQueueInteract: () => void;
  onQueueJump: () => void;
  onQueueEmote: (kind: EmoteKind) => void;
  onQueuePvpThrow: () => void;
  onQueueItemUse?: () => void;
  onQueueUmbrellaUse?: () => void;
  clearKeys: () => void;
  // Câmera da mesa de pôquer: arraste/zoom giram a vista em volta da mesa.
  isPokerSeated?: () => boolean;
  onPokerCameraDragStart?: (clientX: number, clientY: number) => void;
  onPokerCameraDragMove?: (clientX: number, clientY: number) => void;
  onPokerCameraDragEnd?: () => void;
  onPokerCameraZoom?: (deltaY: number) => void;
};

export type GameInputBindings = {
  destroy(): void;
};

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    !!target.closest("input, textarea, select, [contenteditable='true']")
  );
}

function shouldIgnoreInputEvent(event: InputEvent, shouldIgnoreKeys: (event: InputEvent) => boolean) {
  if (event && isEditableEventTarget(event.target)) return true;
  return shouldIgnoreKeys(event);
}

export function createGameInputBindings({
  cameraController,
  cameraSurface,
  devTools,
  ensureAmbientAudio,
  isAmbientAudioEnabled,
  shouldIgnoreKeys,
  onPressKey,
  onReleaseKey,
  isSwimmingPlayerControlled,
  queueSwimmingStroke,
  queueSwimmingCancel,
  isEspectroSecretActive,
  queueEspectroThrow,
  onToggleCameraFocus,
  onQueueInteract,
  onQueueJump,
  onQueueEmote,
  onQueuePvpThrow,
  onQueueItemUse,
  onQueueUmbrellaUse,
  clearKeys,
  isPokerSeated,
  onPokerCameraDragStart,
  onPokerCameraDragMove,
  onPokerCameraDragEnd,
  onPokerCameraZoom,
}: GameInputBindingsContext): GameInputBindings {
  let swimSpaceArmed = true;
  const cameraTouches = new Map<number, { x: number; y: number }>();
  let cameraTouchDragId: number | null = null;
  let cameraPinchDistance = 0;

  function beginViewDrag(clientX: number, clientY: number) {
    cameraSurface.classList.add("is-camera-dragging");
    if (isPokerSeated?.()) {
      onPokerCameraDragStart?.(clientX, clientY);
      return;
    }
    cameraController.beginDrag(clientX, clientY);
  }

  function moveViewDrag(clientX: number, clientY: number) {
    if (isPokerSeated?.()) {
      onPokerCameraDragMove?.(clientX, clientY);
      return;
    }
    cameraController.dragTo(clientX, clientY);
  }

  function endViewDrag() {
    cameraSurface.classList.remove("is-camera-dragging");
    onPokerCameraDragEnd?.();
    cameraController.endDrag();
  }

  const keydownHandler = (event: KeyboardEvent) => {
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    if (devTools.handleKeyDown(event)) return;
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    if (event.code === "Space" && isSwimmingPlayerControlled()) {
      event.preventDefault();
      if (event.repeat || !swimSpaceArmed) return;
      swimSpaceArmed = false;
      queueSwimmingStroke();
      return;
    }
    if (event.code === "KeyE" && isSwimmingPlayerControlled()) {
      event.preventDefault();
      queueSwimmingCancel();
      return;
    }
    if (event.code === "KeyQ" && isEspectroSecretActive()) {
      event.preventDefault();
      queueEspectroThrow();
      return;
    }
    onPressKey(event.code);
    if (event.code === "KeyC" && !event.repeat) {
      event.preventDefault();
      cameraController.toggleMode();
    }
    if (event.code === "KeyF" && !event.repeat) {
      event.preventDefault();
      onToggleCameraFocus();
    }
    if (event.code === "KeyE" && !event.repeat) onQueueInteract();
    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      onQueueJump();
    }
    if (event.code === "KeyG") onQueueEmote(event.shiftKey ? "glitch" : "dance");
    if (event.code === "Digit1") onQueueEmote("laugh");
    if (event.code === "Digit2") onQueueEmote("sixseven");
    if (event.code === "Digit3") onQueueEmote("wave");
    if (event.code === "Digit4") onQueueEmote("point");
    if (event.code === "Digit5") onQueueEmote("cheer");
    if (event.code === "KeyQ" && !event.repeat) {
      event.preventDefault();
      onQueuePvpThrow();
    }
    if (event.code === "KeyR" && !event.repeat) {
      event.preventDefault();
      onQueueItemUse?.();
    }
    if (event.code === "KeyU" && !event.repeat) {
      event.preventDefault();
      onQueueUmbrellaUse?.();
    }
  };

  const keyupHandler = (event: KeyboardEvent) => {
    if (event.code === "Space") swimSpaceArmed = true;
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    onReleaseKey(event.code);
  };

  const mousedownHandler = (event: MouseEvent) => {
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    if (devTools.handlePointerDown(event)) return;
    if (event.button !== 2 || event.target !== cameraSurface) return;
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    event.preventDefault();
    beginViewDrag(event.clientX, event.clientY);
  };

  const mousemoveHandler = (event: MouseEvent) => {
    if (devTools.handlePointerMove(event)) return;
    if (!cameraController.dragActive && !isPokerSeated?.()) return;
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    moveViewDrag(event.clientX, event.clientY);
  };

  const mouseupHandler = (event: MouseEvent) => {
    if (devTools.handlePointerUp(event)) return;
    if (event.button === 2 || cameraController.dragActive || isPokerSeated?.()) endViewDrag();
  };

  const contextmenuHandler = (event: MouseEvent) => {
    if (event.target !== cameraSurface && !cameraController.dragActive) return;
    event.preventDefault();
    endViewDrag();
  };

  const wheelHandler = (event: WheelEvent) => {
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    if (event.target !== cameraSurface || shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    if (isPokerSeated?.()) {
      event.preventDefault();
      onPokerCameraZoom?.(event.deltaY);
      return;
    }
    event.preventDefault();
    cameraController.zoomBy(event.deltaY);
  };

  function getPinchDistance() {
    const points = [...cameraTouches.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  const pointerdownHandler = (event: PointerEvent) => {
    if (event.pointerType === "mouse" || event.target !== cameraSurface) return;
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    const bounds = cameraSurface.getBoundingClientRect();
    if (cameraTouches.size === 0 && event.clientX < bounds.left + bounds.width * 0.35) return;
    if (cameraTouches.size >= 2) return;

    event.preventDefault();
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    cameraTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    cameraSurface.setPointerCapture?.(event.pointerId);

    if (cameraTouches.size === 1) {
      cameraTouchDragId = event.pointerId;
      cameraPinchDistance = 0;
      beginViewDrag(event.clientX, event.clientY);
    } else {
      cameraTouchDragId = null;
      endViewDrag();
      cameraPinchDistance = getPinchDistance();
    }
  };

  const pointermoveHandler = (event: PointerEvent) => {
    if (event.pointerType === "mouse" || !cameraTouches.has(event.pointerId)) return;
    event.preventDefault();
    cameraTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (cameraTouches.size === 1 && cameraTouchDragId === event.pointerId) {
      moveViewDrag(event.clientX, event.clientY);
      return;
    }

    if (cameraTouches.size === 2) {
      const nextDistance = getPinchDistance();
      if (cameraPinchDistance > 0 && nextDistance > 0) {
        const delta = (cameraPinchDistance - nextDistance) * 2;
        if (isPokerSeated?.()) onPokerCameraZoom?.(delta);
        else cameraController.zoomBy(delta);
      }
      cameraPinchDistance = nextDistance;
    }
  };

  function finishCameraTouch(event: PointerEvent) {
    if (event.pointerType === "mouse" || !cameraTouches.has(event.pointerId)) return;
    event.preventDefault();
    cameraTouches.delete(event.pointerId);
    if (cameraSurface.hasPointerCapture?.(event.pointerId)) {
      cameraSurface.releasePointerCapture?.(event.pointerId);
    }
    endViewDrag();
    cameraPinchDistance = 0;

    const remaining = cameraTouches.entries().next().value as
      | [number, { x: number; y: number }]
      | undefined;
    if (remaining) {
      cameraTouchDragId = remaining[0];
      beginViewDrag(remaining[1].x, remaining[1].y);
    } else {
      cameraTouchDragId = null;
    }
  }

  const blurHandler = () => {
    swimSpaceArmed = true;
    clearKeys();
    cameraTouches.clear();
    cameraTouchDragId = null;
    cameraPinchDistance = 0;
    endViewDrag();
  };

  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keyup", keyupHandler);
  window.addEventListener("mousedown", mousedownHandler);
  window.addEventListener("mousemove", mousemoveHandler);
  window.addEventListener("mouseup", mouseupHandler);
  window.addEventListener("contextmenu", contextmenuHandler);
  window.addEventListener("wheel", wheelHandler, { passive: false });
  window.addEventListener("blur", blurHandler);
  cameraSurface.addEventListener("pointerdown", pointerdownHandler, { passive: false });
  cameraSurface.addEventListener("pointermove", pointermoveHandler, { passive: false });
  cameraSurface.addEventListener("pointerup", finishCameraTouch, { passive: false });
  cameraSurface.addEventListener("pointercancel", finishCameraTouch, { passive: false });

  return {
    destroy() {
      window.removeEventListener("keydown", keydownHandler);
      window.removeEventListener("keyup", keyupHandler);
      window.removeEventListener("mousedown", mousedownHandler);
      window.removeEventListener("mousemove", mousemoveHandler);
      window.removeEventListener("mouseup", mouseupHandler);
      window.removeEventListener("contextmenu", contextmenuHandler);
      window.removeEventListener("wheel", wheelHandler);
      window.removeEventListener("blur", blurHandler);
      cameraSurface.removeEventListener("pointerdown", pointerdownHandler);
      cameraSurface.removeEventListener("pointermove", pointermoveHandler);
      cameraSurface.removeEventListener("pointerup", finishCameraTouch);
      cameraSurface.removeEventListener("pointercancel", finishCameraTouch);
      cameraTouches.clear();
      endViewDrag();
    },
  };
}
