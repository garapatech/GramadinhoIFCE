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
  sendEspectroConsumed: (seed: string | number | null | undefined, outcome?: "lost" | "won") => void;
  sendEspectroDuelStart: (seed: string | number | null | undefined) => void;
  sendEspectroDuelHit: (seed: string | number | null | undefined, sequence: number) => void;
  sendVoiceReady: (enabled: boolean, muted?: boolean) => void;
  sendVoiceSignal: (target: string, signal: VoiceSignal) => void;
  sendMediaSet: (url: string) => void;
  sendMediaControl: (action: "pause" | "resume" | "stop" | "volume", volume?: number) => void;
  sendItemPickup: (itemId: "bat" | "umbrella" | "biriba-ball") => void;
  sendItemUse: (itemId: "bat" | "umbrella" | "biriba-ball", sequence: number, targetId?: string) => void;
  sendSwimChallenge: (to: string) => void;
  sendSwimRespond: (matchId: string, accepted: boolean) => void;
  sendSwimStroke: (matchId: string, sequence: number) => void;
  sendSwimQuit: (matchId: string) => void;
  sendTypingSolo: (computerId: string) => void;
  sendTypingChallenge: (to: string, computerId: string) => void;
  sendTypingRespond: (matchId: string, accepted: boolean) => void;
  sendTypingRoomCreate: (computerId: string) => void;
  sendTypingRoomJoin: (roomId: string) => void;
  sendTypingRoomLeave: (roomId: string) => void;
  sendTypingRoomStart: (roomId: string) => void;
  sendTypingInput: (matchId: string, typed: string, sequence: number) => void;
  sendTypingQuit: (matchId: string) => void;
  sendPokerSit: (seatIndex: number) => void;
  sendPokerStand: () => void;
  sendPokerAction: (
    action: "fold" | "check" | "call" | "raise" | "allin",
    amount?: number
  ) => void;
  sendPokerStart: () => void;
  sendChessSit: (color: "w" | "b") => void;
  sendChessStand: () => void;
  sendChessMove: (
    from: { file: number; rank: number },
    to: { file: number; rank: number },
  ) => void;
  sendChessReset: () => void;
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

  function sendEspectroConsumed(seed: string | number | null | undefined, outcome: "lost" | "won" = "lost") {
    if (seed == null) return;
    sendMessage({ type: "espectro-consumed", seed: String(seed), outcome });
  }

  function sendEspectroDuelStart(seed: string | number | null | undefined) {
    if (seed == null) return;
    sendMessage({ type: "espectro-duel-start", seed: String(seed) });
  }

  function sendEspectroDuelHit(seed: string | number | null | undefined, sequence: number) {
    if (seed == null) return;
    sendMessage({ type: "espectro-duel-hit", seed: String(seed), sequence });
  }

  function sendVoiceSignal(target: string, signal: VoiceSignal) {
    if (!target || !signal) return;
    sendMessage({
      type: "voice-signal",
      target,
      signal,
    });
  }

  function sendMediaSet(url: string) {
    const value = url.trim();
    if (!value) return;
    sendMessage({ type: "media-set", url: value });
  }

  function sendMediaControl(action: "pause" | "resume" | "stop" | "volume", volume?: number) {
    if (action === "volume") {
      if (typeof volume !== "number" || !Number.isFinite(volume)) return;
      sendMessage({ type: "media-control", action, volume: Math.max(0, Math.min(1, volume)) });
      return;
    }
    sendMessage({ type: "media-control", action });
  }

  function sendItemPickup(itemId: "bat" | "umbrella" | "biriba-ball") {
    sendMessage({ type: "item-pickup", itemId });
  }

  function sendItemUse(itemId: "bat" | "umbrella" | "biriba-ball", sequence: number, targetId?: string) {
    sendMessage({ type: "item-use", itemId, sequence, ...(targetId ? { targetId } : {}) });
  }

  function sendSwimChallenge(to: string) {
    if (to) sendMessage({ type: "swim-challenge", to });
  }

  function sendSwimRespond(matchId: string, accepted: boolean) {
    if (matchId) sendMessage({ type: "swim-respond", matchId, accepted });
  }

  function sendSwimStroke(matchId: string, sequence: number) {
    if (matchId) sendMessage({ type: "swim-stroke", matchId, sequence });
  }

  function sendSwimQuit(matchId: string) {
    if (matchId) sendMessage({ type: "swim-quit", matchId });
  }

  function sendTypingSolo(computerId: string) {
    if (computerId) sendMessage({ type: "typing-solo", computerId });
  }

  function sendTypingChallenge(to: string, computerId: string) {
    if (to && computerId) sendMessage({ type: "typing-challenge", to, computerId });
  }

  function sendTypingRespond(matchId: string, accepted: boolean) {
    if (matchId) sendMessage({ type: "typing-respond", matchId, accepted });
  }

  function sendTypingRoomCreate(computerId: string) {
    if (computerId) sendMessage({ type: "typing-room-create", computerId });
  }

  function sendTypingRoomJoin(roomId: string) {
    if (roomId) sendMessage({ type: "typing-room-join", roomId });
  }

  function sendTypingRoomLeave(roomId: string) {
    if (roomId) sendMessage({ type: "typing-room-leave", roomId });
  }

  function sendTypingRoomStart(roomId: string) {
    if (roomId) sendMessage({ type: "typing-room-start", roomId });
  }

  function sendTypingInput(matchId: string, typed: string, sequence: number) {
    if (matchId) sendMessage({ type: "typing-input", matchId, typed, sequence });
  }

  function sendTypingQuit(matchId: string) {
    if (matchId) sendMessage({ type: "typing-quit", matchId });
  }

  function sendPokerSit(seatIndex: number) {
    if (!Number.isInteger(seatIndex) || seatIndex < 0) return;
    sendMessage({ type: "poker-sit", seatIndex });
  }

  function sendPokerStand() {
    sendMessage({ type: "poker-stand" });
  }

  function sendPokerAction(
    action: "fold" | "check" | "call" | "raise" | "allin",
    amount?: number,
  ) {
    if (action === "raise") {
      if (amount == null || !Number.isFinite(amount) || amount <= 0) return;
      sendMessage({ type: "poker-action", action, amount: Math.floor(amount) });
    } else {
      sendMessage({ type: "poker-action", action });
    }
  }

  function sendPokerStart() {
    sendMessage({ type: "poker-start" });
  }

  function sendChessSit(color: "w" | "b") {
    sendMessage({ type: "chess-sit", color });
  }

  function sendChessStand() {
    sendMessage({ type: "chess-stand" });
  }

  function sendChessMove(
    from: { file: number; rank: number },
    to: { file: number; rank: number },
  ) {
    sendMessage({ type: "chess-move", from, to });
  }

  function sendChessReset() {
    sendMessage({ type: "chess-reset" });
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
    sendEspectroDuelStart,
    sendEspectroDuelHit,
    sendVoiceReady,
    sendVoiceSignal,
    sendMediaSet,
    sendMediaControl,
    sendItemPickup,
    sendItemUse,
    sendSwimChallenge,
    sendSwimRespond,
    sendSwimStroke,
    sendSwimQuit,
    sendTypingSolo,
    sendTypingChallenge,
    sendTypingRespond,
    sendTypingRoomCreate,
    sendTypingRoomJoin,
    sendTypingRoomLeave,
    sendTypingRoomStart,
    sendTypingInput,
    sendTypingQuit,
    sendPokerSit,
    sendPokerStand,
    sendPokerAction,
    sendPokerStart,
    sendChessSit,
    sendChessStand,
    sendChessMove,
    sendChessReset,
    close,
    get socket() {
      return socket;
    },
    isOpen: () => openOnce,
  };
}
