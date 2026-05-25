import { create } from "zustand";

type BooleanUpdater = boolean | ((current: boolean) => boolean);

function resolveBooleanUpdate(next: BooleanUpdater, current: boolean) {
  return typeof next === "function" ? next(current) : next;
}

export type GameOverlayVisibilityStore = {
  chatVisible: boolean;
  playersVisible: boolean;
  setChatVisible: (next: BooleanUpdater) => void;
  setPlayersVisible: (next: BooleanUpdater) => void;
  hideOverlays: () => void;
};

export const useGameOverlayVisibilityStore = create<GameOverlayVisibilityStore>((set) => ({
  chatVisible: true,
  playersVisible: false,
  setChatVisible: (next) =>
    set((state) => ({
      chatVisible: resolveBooleanUpdate(next, state.chatVisible),
    })),
  setPlayersVisible: (next) =>
    set((state) => ({
      playersVisible: resolveBooleanUpdate(next, state.playersVisible),
    })),
  hideOverlays: () =>
    set({
      chatVisible: false,
      playersVisible: false,
    }),
}));
