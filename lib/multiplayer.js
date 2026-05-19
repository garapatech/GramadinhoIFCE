import PartySocket from "partysocket";

const ROOM = "gramadinho-main";

export function connectMultiplayer({ nickname, onEvent, host }) {
  const partyHost =
    host ||
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
    "127.0.0.1:1999";

  const socket = new PartySocket({
    host: partyHost,
    room: ROOM,
  });

  let joinedNick = nickname;
  let openOnce = false;

  socket.addEventListener("open", () => {
    openOnce = true;
    socket.send(
      JSON.stringify({
        type: "join",
        nick: joinedNick,
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

  function sendChat(text) {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "chat", text }));
  }

  function sendEmote(kind, duration) {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "emote", kind, duration }));
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
    sendChat,
    sendEmote,
    sendVoiceReady,
    sendVoiceSignal,
    close,
    get socket() { return socket; },
    isOpen: () => openOnce,
  };
}
