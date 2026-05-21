import { useEffect, useRef, useState } from "react";

type RequestLandscapeOptions = {
  preferFullscreen?: boolean;
};

type UseMobileViewportOptions = {
  onFirstMobileLayout?: () => void;
};

function isTouchViewport() {
  if (typeof window === "undefined") return false;

  const touchMatch = window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches;
  const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;

  return Boolean(touchMatch || touchPoints > 0 || window.innerWidth <= 900);
}

export function useMobileViewport(options: UseMobileViewportOptions = {}) {
  const { onFirstMobileLayout } = options;
  const onFirstMobileLayoutRef = useRef(onFirstMobileLayout);
  const mobileLayoutAppliedRef = useRef(false);
  const [mobileMode, setMobileMode] = useState(false);
  const [portraitLocked, setPortraitLocked] = useState(false);
  const [orientationMessage, setOrientationMessage] = useState("");

  useEffect(() => {
    onFirstMobileLayoutRef.current = onFirstMobileLayout;
  }, [onFirstMobileLayout]);

  function refreshMobileViewport() {
    if (typeof window === "undefined") return;

    const nextMobileMode = isTouchViewport();
    const nextPortraitLocked = nextMobileMode && window.innerHeight > window.innerWidth;

    setMobileMode(nextMobileMode);
    setPortraitLocked(nextPortraitLocked);

    if (nextMobileMode && !mobileLayoutAppliedRef.current) {
      mobileLayoutAppliedRef.current = true;
      onFirstMobileLayoutRef.current?.();
    }
  }

  async function requestLandscape({ preferFullscreen = true }: RequestLandscapeOptions = {}) {
    if (typeof window === "undefined") return;
    if (!isTouchViewport()) return;

    setOrientationMessage("Abrindo em tela horizontal...");

    try {
      if (
        preferFullscreen &&
        document.fullscreenEnabled &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Keep the fallback orientation prompt below.
    }

    try {
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock("landscape");
        setOrientationMessage("Tela horizontal ativa.");
      } else {
        setOrientationMessage("Gire o aparelho para jogar.");
      }
    } catch {
      setOrientationMessage("Gire o aparelho para jogar.");
    }

    window.setTimeout(refreshMobileViewport, 120);
  }

  useEffect(() => {
    refreshMobileViewport();
    const timer = window.setTimeout(() => requestLandscape({ preferFullscreen: false }), 160);

    const onFirstPointer = () => {
      requestLandscape({ preferFullscreen: true });
    };

    const onViewportChange = () => {
      refreshMobileViewport();
    };

    window.addEventListener("pointerdown", onFirstPointer, { once: true, passive: true });
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onFirstPointer);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
    };
  }, []);

  return {
    mobileMode,
    orientationMessage,
    portraitLocked,
    requestLandscape,
  };
}
