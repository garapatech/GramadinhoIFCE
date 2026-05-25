import type { AtmosphereState } from "@/game/atmosphere";
import type { EmoteKind } from "@/features/game/emotes";
import type { AmbientAudioState, PlayerStatusState } from "@/shared/schemas/gameUi";
import type { SocketOutboundMessage } from "@/shared/schemas/multiplayer";

export interface BootGameOptions {
  container?: HTMLElement | null;
  nickname?: string;
  avatar?: unknown;
  shouldIgnoreKeys?: (event: Event) => boolean;
  getWorldTime?: () => number;
  onLocalState?: (state: Omit<Extract<SocketOutboundMessage, { type: "state" }>, "type">) => void;
  onLocalEntityState?: (
    state: Omit<Extract<SocketOutboundMessage, { type: "entity-state" }>, "type">
  ) => void;
  onNpcState?: (
    npcs: Extract<SocketOutboundMessage, { type: "npc-state" }>["npcs"]
  ) => void;
  onAtmosphereChange?: (state: AtmosphereState) => void;
  onAudioStateChange?: (state: AmbientAudioState) => void;
  onPlayerStateChange?: (state: PlayerStatusState) => void;
  onEmote?: (emote: { kind: EmoteKind; duration: number }) => void;
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
