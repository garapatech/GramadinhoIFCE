import type { AtmosphereState } from "@/game/atmosphere";
import type { GamePlayerActivity } from "@/features/game/gameViewState";

export interface BootGameOptions {
  container?: any;
  nickname?: string;
  avatar?: unknown;
  shouldIgnoreKeys?: (event: Event) => boolean;
  getWorldTime?: () => number;
  onLocalState?: (state: { activity?: GamePlayerActivity }) => void;
  onLocalEntityState?: (state: unknown) => void;
  onNpcState?: (npcs: unknown[]) => void;
  onAtmosphereChange?: (state: AtmosphereState) => void;
  onCameraModeChange?: (state: { mode: string; label: string; focusLabel: string }) => void;
  onAudioStateChange?: (state: unknown) => void;
  onPlayerStateChange?: (state: unknown) => void;
  onEmote?: (emote: { kind: string; duration: number }) => void;
  onMediaBoothInteract?: () => void;
  onPvpThrow?: (matchId: string, dx: number, dz: number, x: number, z: number) => void;
  onPvpHit?: (matchId: string, victimId: string) => void;
  onEspectroConsumed?: (seed: number) => void;
  onSecretDisconnect?: () => void;
  onPokerSeatInteract?: (seatIndex: number) => void;
  onChessSeatInteract?: (color: "w" | "b") => void;
  // anchor opcional usado pelo engine pra sentar visualmente
}

export interface Blocker {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  active: boolean;
}

export interface BlockerOptions {
  active?: boolean;
}

export interface ReactionOptions {
  skipLocal?: boolean;
  skipRemoteId?: string;
}

export interface MobileInput {
  x: number;
  y: number;
  running: boolean;
}

export interface MobileInputUpdate {
  x?: number;
  y?: number;
  running?: boolean;
}

export interface SitOptions {
  duration?: number;
  label?: string;
  endMessage?: string;
  endSpeaker?: string;
  persistent?: boolean;
}
