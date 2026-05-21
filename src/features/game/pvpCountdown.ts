import type { Dispatch, SetStateAction } from "react";
import type { GamePvpState } from "@/features/game/gameViewState";

export type PvpCountdownController = {
  clear: () => void;
  start: (setPvpState: Dispatch<SetStateAction<GamePvpState | null>>) => void;
};

export function createPvpCountdownController(): PvpCountdownController {
  let timer: ReturnType<typeof setInterval> | null = null;

  function clear() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(setPvpState: Dispatch<SetStateAction<GamePvpState | null>>) {
    clear();

    let count = 3;
    timer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clear();
        setPvpState((prev) => (prev ? { ...prev, phase: "playing" } : prev));
        return;
      }

      setPvpState((prev) => (prev ? { ...prev, countdownVal: count } : prev));
    }, 1000);

    setPvpState((prev) => (prev ? { ...prev, countdownVal: 3 } : prev));
  }

  return { clear, start };
}
