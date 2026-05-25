import { useEffect } from "react";
import { useGameOverlayVisibilityStore } from "@/features/game/gameOverlayVisibilityStore";

export function useGameOverlayVisibility() {
  const chatVisible = useGameOverlayVisibilityStore((state) => state.chatVisible);
  const playersVisible = useGameOverlayVisibilityStore((state) => state.playersVisible);
  const setChatVisible = useGameOverlayVisibilityStore((state) => state.setChatVisible);
  const setPlayersVisible = useGameOverlayVisibilityStore((state) => state.setPlayersVisible);
  const hideOverlays = useGameOverlayVisibilityStore((state) => state.hideOverlays);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Tab") return;
      event.preventDefault();
      setPlayersVisible(true);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Tab") return;
      event.preventDefault();
      setPlayersVisible(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return {
    chatVisible,
    playersVisible,
    setChatVisible,
    setPlayersVisible,
    hideOverlays,
  };
}
