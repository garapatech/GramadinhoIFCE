import type { CameraController } from "@/game/camera";
import type { DevToolsController } from "@/game/devtools";
import type { EmoteKind } from "@/features/game/emotes";

type InputEvent = KeyboardEvent | MouseEvent | WheelEvent;

type GameInputBindingsContext = {
  cameraController: CameraController;
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
  clearKeys: () => void;
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
  clearKeys,
}: GameInputBindingsContext): GameInputBindings {
  const keydownHandler = (event: KeyboardEvent) => {
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    if (devTools.handleKeyDown(event)) return;
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    if (event.code === "Space" && isSwimmingPlayerControlled()) {
      event.preventDefault();
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
    if (event.code === "KeyE") onQueueInteract();
    if (event.code === "Space") {
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
  };

  const keyupHandler = (event: KeyboardEvent) => {
    if (shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    onReleaseKey(event.code);
  };

  const mousedownHandler = (event: MouseEvent) => {
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    if (devTools.handlePointerDown(event)) return;
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    if (cameraController.mode !== "orbit" || shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    cameraController.beginDrag(event.clientX, event.clientY);
  };

  const mousemoveHandler = (event: MouseEvent) => {
    if (devTools.handlePointerMove(event)) return;
    if (cameraController.mode !== "orbit" || !cameraController.dragActive || shouldIgnoreInputEvent(event, shouldIgnoreKeys))
      return;
    cameraController.dragTo(event.clientX, event.clientY);
  };

  const mouseupHandler = (event: MouseEvent) => {
    if (devTools.handlePointerUp(event)) return;
    cameraController.endDrag();
  };

  const contextmenuHandler = (event: MouseEvent) => {
    event.preventDefault();
    cameraController.endDrag();
  };

  const wheelHandler = (event: WheelEvent) => {
    if (isAmbientAudioEnabled()) ensureAmbientAudio();
    if (cameraController.mode !== "orbit" || shouldIgnoreInputEvent(event, shouldIgnoreKeys)) return;
    event.preventDefault();
    cameraController.zoomBy(event.deltaY);
  };

  const blurHandler = () => {
    clearKeys();
    cameraController.endDrag();
  };

  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keyup", keyupHandler);
  window.addEventListener("mousedown", mousedownHandler);
  window.addEventListener("mousemove", mousemoveHandler);
  window.addEventListener("mouseup", mouseupHandler);
  window.addEventListener("contextmenu", contextmenuHandler);
  window.addEventListener("wheel", wheelHandler, { passive: false });
  window.addEventListener("blur", blurHandler);

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
    },
  };
}
