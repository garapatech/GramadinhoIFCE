import { useEffect, useState } from "react";

export function useGameOverlayVisibility() {
  const [chatVisible, setChatVisible] = useState(true);
  const [playersVisible, setPlayersVisible] = useState(false);

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
  };
}
