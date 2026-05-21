import { useRef, useState, type MutableRefObject } from "react";

type MobileStickState = {
  active: boolean;
  x: number;
  y: number;
};

type MobileGameApi = {
  setMobileInput?: (next: { x?: number; y?: number; running?: boolean }) => void;
  queueMobileJump?: () => void;
  queueMobileInteract?: () => void;
  toggleCameraMode?: () => void;
  queueMobilePvpThrow?: () => void;
};

type UseMobileControlsOptions = {
  gameApiRef: MutableRefObject<MobileGameApi | null>;
  mobileRunRef: MutableRefObject<boolean>;
};

type MobileAction = "jump" | "interact" | "camera";

type PointerLike = {
  clientX: number;
  clientY: number;
  preventDefault: () => void;
  currentTarget: {
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
    getBoundingClientRect: () => DOMRect;
  };
  pointerId: number;
};

export function useMobileControls({ gameApiRef, mobileRunRef }: UseMobileControlsOptions) {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickPointerRef = useRef<number | null>(null);
  const [stick, setStick] = useState<MobileStickState>({ active: false, x: 0, y: 0 });

  function sendMobileInput(next: Partial<MobileStickState>) {
    gameApiRef.current?.setMobileInput?.({
      x: next.x ?? stick.x,
      y: next.y ?? stick.y,
      running: mobileRunRef.current,
    });
  }

  function updateMobileStick(event: PointerLike) {
    const joystick = joystickRef.current;
    if (!joystick) return;

    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2 - 18);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let x = (event.clientX - centerX) / radius;
    let y = (event.clientY - centerY) / radius;
    const length = Math.hypot(x, y);

    if (length > 1) {
      x /= length;
      y /= length;
    }

    setStick({ active: true, x, y });
    gameApiRef.current?.setMobileInput?.({ x, y, running: mobileRunRef.current });
  }

  function clearMobileStick() {
    joystickPointerRef.current = null;
    setStick({ active: false, x: 0, y: 0 });
    gameApiRef.current?.setMobileInput?.({ x: 0, y: 0, running: mobileRunRef.current });
  }

  function handleJoystickPointerDown(event: PointerLike) {
    event.preventDefault();
    joystickPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateMobileStick(event);
  }

  function handleJoystickPointerMove(event: PointerLike) {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    updateMobileStick(event);
  }

  function handleJoystickPointerUp(event: PointerLike) {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    clearMobileStick();
  }

  function setMobileRun(active: boolean) {
    mobileRunRef.current = active;
    sendMobileInput({});
  }

  function handleMobileAction(event: { preventDefault: () => void }, action: MobileAction) {
    event.preventDefault();

    if (action === "jump") {
      gameApiRef.current?.queueMobileJump?.();
    } else if (action === "interact") {
      gameApiRef.current?.queueMobileInteract?.();
    } else if (action === "camera") {
      gameApiRef.current?.toggleCameraMode?.();
    }
  }

  return {
    stick,
    joystickRef,
    handleJoystickPointerDown,
    handleJoystickPointerMove,
    handleJoystickPointerUp,
    setMobileRun,
    handleMobileAction,
  };
}
