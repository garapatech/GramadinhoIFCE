import PartySocket from "partysocket";
import { normalizeAvatar } from "@/features/avatar/avatarConfig";

const ROOM = "gramadinho-main";

export function connectMultiplayer({ nickname, avatar, onEvent, host }) {
  const partyHost =
    host ||
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
    "127.0.0.1:1999";

  const socket = new PartySocket({
    host: partyHost,
    room: ROOM,
  });

  let joinedNick = nickname;
  let joinedAvatar = normalizeAvatar(avatar);
  let openOnce = false;

  socket.addEventListener("open", () => {
    openOnce = true;
    socket.send(
      JSON.stringify({
        type: "join",
        nick: joinedNick,
        avatar: joinedAvatar,
      })
    );
    onEvent({ type: "connected" });
  });

  socket.addEventListener("close", () => {
    onEvent({ type: "disconnected" });
  });

  socket.addEventListener("error", () => {
    onEvent({ type: "error" });
  });

  socket.addEventListener("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.data);
    } catch {
      return;
    }
    onEvent(msg);
  });

  function sendState(state) {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "state", ...state }));
  }

  function sendEntityState(state) {
    if (socket.readyState !== 1 || !state?.id || !state?.kind) return;
    socket.send(JSON.stringify({ type: "entity-state", ...state }));
  }

  function sendNpcState(npcs) {
    if (socket.readyState !== 1 || !Array.isArray(npcs)) return;
    socket.send(JSON.stringify({ type: "npc-state", npcs }));
  }

  function sendChat(text) {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "chat", text }));
  }

  function sendEmote(kind, duration) {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "emote", kind, duration }));
  }

  function sendReaction(targetKey, kind = "like") {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "reaction", targetKey, kind }));
  }

  function sendVoiceReady(enabled, muted = false) {
    if (socket.readyState !== 1) return;
    socket.send(
      JSON.stringify({
        type: "voice-ready",
        enabled: enabled === true,
        muted: muted === true,
      })
    );
  }

  function sendPvpChallenge(to) {
    if (socket.readyState !== 1 || !to) return;
    socket.send(JSON.stringify({ type: "pvp-challenge", to }));
  }

  function sendPvpRespond(matchId, accepted) {
    if (socket.readyState !== 1 || !matchId) return;
    socket.send(JSON.stringify({ type: "pvp-respond", matchId, accepted }));
  }

  function sendPvpThrow(matchId, dx, dz, x, z) {
    if (socket.readyState !== 1 || !matchId) return;
    socket.send(JSON.stringify({ type: "pvp-throw", matchId, dx, dz, x, z }));
  }

  function sendPvpHit(matchId, victim) {
    if (socket.readyState !== 1 || !matchId || !victim) return;
    socket.send(JSON.stringify({ type: "pvp-hit", matchId, victim }));
  }

  function sendPvpQuit(matchId) {
    if (socket.readyState !== 1 || !matchId) return;
    socket.send(JSON.stringify({ type: "pvp-quit", matchId }));
  }

  function sendVoiceSignal(target, signal) {
    if (socket.readyState !== 1 || !target || !signal) return;
    socket.send(
      JSON.stringify({
        type: "voice-signal",
        target,
        signal,
      })
    );
  }

  function close() {
    try {
      socket.close();
    } catch {}
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
    sendVoiceReady,
    sendVoiceSignal,
    close,
    get socket() { return socket; },
    isOpen: () => openOnce,
  };
}
