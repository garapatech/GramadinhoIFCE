import PartySocket from "partysocket";
import { normalizeAvatar } from "@/features/avatar/avatarConfig";
import { DEFAULT_PARTYKIT_HOST, readPublicEnv } from "@/shared/schemas/env";
import {
  parseInboundSocketMessage,
  serializeOutboundSocketMessage,
  type MultiplayerEvent,
  type SocketOutboundMessage,
  type VoiceSignal,
} from "@/shared/schemas/multiplayer";

const ROOM = "gramadinho-main";

type ConnectMultiplayerOptions = {
  nickname: string;
  avatar: unknown;
  onEvent: (event: MultiplayerEvent) => void;
  host?: string;
};

type MultiplayerConnection = {
  sendState: (state: Omit<Extract<SocketOutboundMessage, { type: "state" }>, "type">) => void;
  sendEntityState: (
    state: Omit<Extract<SocketOutboundMessage, { type: "entity-state" }>, "type">
  ) => void;
  sendNpcState: (npcs: Extract<SocketOutboundMessage, { type: "npc-state" }>["npcs"]) => void;
  sendChat: (text: string) => void;
  sendEmote: (
    kind: Extract<SocketOutboundMessage, { type: "emote" }>["kind"],
    duration?: number
  ) => void;
  sendReaction: (
    targetKey: string,
    kind?: Extract<SocketOutboundMessage, { type: "reaction" }>["kind"]
  ) => void;
  sendPvpChallenge: (to: string) => void;
  sendPvpRespond: (matchId: string, accepted: boolean) => void;
  sendPvpThrow: (matchId: string, dx: number, dz: number, x: number, z: number) => void;
  sendPvpHit: (matchId: string, victim: string) => void;
  sendPvpQuit: (matchId: string) => void;
  sendEspectroConsumed: (seed: string | number | null | undefined) => void;
  sendVoiceReady: (enabled: boolean, muted?: boolean) => void;
  sendVoiceSignal: (target: string, signal: VoiceSignal) => void;
  close: () => void;
  readonly socket: PartySocket;
  isOpen: () => boolean;
};

function isSocketOpen(socket: PartySocket) {
  return socket.readyState === 1;
}

export function connectMultiplayer({ nickname, avatar, onEvent, host }: ConnectMultiplayerOptions): MultiplayerConnection {
  const publicEnv = readPublicEnv();
  const partyHost = host || publicEnv.NEXT_PUBLIC_PARTYKIT_HOST || DEFAULT_PARTYKIT_HOST;

  const socket = new PartySocket({
    host: partyHost,
    room: ROOM,
  });

  const joinedNick = nickname;
  const joinedAvatar = normalizeAvatar(avatar);
  let openOnce = false;

  function sendMessage(message: SocketOutboundMessage) {
    if (!isSocketOpen(socket)) return false;
    const serialized = serializeOutboundSocketMessage(message);
    if (!serialized) return false;
    socket.send(serialized);
    return true;
  }

  socket.addEventListener("open", () => {
    openOnce = true;
    sendMessage({
      type: "join",
      nick: joinedNick,
      avatar: joinedAvatar,
    });
    onEvent({ type: "connected" });
  });

  socket.addEventListener("close", () => {
    onEvent({ type: "disconnected" });
  });

  socket.addEventListener("error", () => {
    onEvent({ type: "error" });
  });

  socket.addEventListener("message", (raw: MessageEvent) => {
    let msg: unknown;
    try {
      msg = JSON.parse(typeof raw.data === "string" ? raw.data : String(raw.data)) as unknown;
    } catch {
      return;
    }
    const parsed = parseInboundSocketMessage(msg);
    if (!parsed) return;
    onEvent(parsed);
  });

  function sendState(state: Omit<Extract<SocketOutboundMessage, { type: "state" }>, "type">) {
    sendMessage({ type: "state", ...state });
  }

  function sendEntityState(
    state: Omit<Extract<SocketOutboundMessage, { type: "entity-state" }>, "type">
  ) {
    if (!state?.id || !state?.kind) return;
    sendMessage({ type: "entity-state", ...state });
  }

  function sendNpcState(npcs: Extract<SocketOutboundMessage, { type: "npc-state" }>["npcs"]) {
    if (!Array.isArray(npcs)) return;
    sendMessage({ type: "npc-state", npcs });
  }

  function sendChat(text: string) {
    sendMessage({ type: "chat", text });
  }

  function sendEmote(kind: Extract<SocketOutboundMessage, { type: "emote" }>["kind"], duration?: number) {
    sendMessage({ type: "emote", kind, duration });
  }

  function sendReaction(
    targetKey: string,
    kind: Extract<SocketOutboundMessage, { type: "reaction" }>["kind"] = "like"
  ) {
    sendMessage({ type: "reaction", targetKey, kind });
  }

  function sendVoiceReady(enabled: boolean, muted = false) {
    sendMessage({
      type: "voice-ready",
      enabled: enabled === true,
      muted: muted === true,
    });
  }

  function sendPvpChallenge(to: string) {
    if (!to) return;
    sendMessage({ type: "pvp-challenge", to });
  }

  function sendPvpRespond(matchId: string, accepted: boolean) {
    if (!matchId) return;
    sendMessage({ type: "pvp-respond", matchId, accepted });
  }

  function sendPvpThrow(matchId: string, dx: number, dz: number, x: number, z: number) {
    if (!matchId) return;
    sendMessage({ type: "pvp-throw", matchId, dx, dz, x, z });
  }

  function sendPvpHit(matchId: string, victim: string) {
    if (!matchId || !victim) return;
    sendMessage({ type: "pvp-hit", matchId, victim });
  }

  function sendPvpQuit(matchId: string) {
    if (!matchId) return;
    sendMessage({ type: "pvp-quit", matchId });
  }

  function sendEspectroConsumed(seed: string | number | null | undefined) {
    if (seed == null) return;
    sendMessage({ type: "espectro-consumed", seed: String(seed) });
  }

  function sendVoiceSignal(target: string, signal: VoiceSignal) {
    if (!target || !signal) return;
    sendMessage({
      type: "voice-signal",
      target,
      signal,
    });
  }

  function close() {
    try {
      socket.close();
    } catch {
      // Ignore socket shutdown errors during cleanup.
    }
  }

  return {
    sendState,
    sendEntityState,
    sendNpcState,
    sendChat,
    sendEmote,
    sendReaction,
    sendPvpChallenge,
    sendPvpRespond,
    sendPvpThrow,
    sendPvpHit,
    sendPvpQuit,
    sendEspectroConsumed,
    sendVoiceReady,
    sendVoiceSignal,
    close,
    get socket() {
      return socket;
    },
    isOpen: () => openOnce,
  };
}
