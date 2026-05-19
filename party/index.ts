import type * as Party from "partykit/server";

type PlayerState = {
  id: string;
  nick: string;
  x: number;
  z: number;
  ry: number;
  speed: number;
  voiceEnabled: boolean;
  voiceMuted: boolean;
};

type ChatMsg = {
  id: string;
  nick: string;
  text: string;
  ts: number;
};

const CHAT_HISTORY_LIMIT = 60;
const MAX_NICK = 16;
const MAX_TEXT = 240;
const MAX_SIGNAL_SDP = 30_000;
const MAX_SIGNAL_CANDIDATE = 8_000;

function sanitize(input: unknown, limit: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, limit);
}

function sanitizeVoiceSignal(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const raw = input as any;
  const signal: any = {};

  if (raw.description && typeof raw.description === "object") {
    const type = raw.description.type;
    const sdp = raw.description.sdp;
    if (
      (type === "offer" || type === "answer") &&
      typeof sdp === "string" &&
      sdp.length <= MAX_SIGNAL_SDP
    ) {
      signal.description = { type, sdp };
    }
  }

  if (raw.candidate && typeof raw.candidate === "object") {
    const candidate = raw.candidate.candidate;
    if (typeof candidate === "string" && candidate.length <= MAX_SIGNAL_CANDIDATE) {
      signal.candidate = {
        candidate,
        sdpMid:
          typeof raw.candidate.sdpMid === "string" || raw.candidate.sdpMid === null
            ? raw.candidate.sdpMid
            : undefined,
        sdpMLineIndex:
          typeof raw.candidate.sdpMLineIndex === "number"
            ? raw.candidate.sdpMLineIndex
            : undefined,
        usernameFragment:
          typeof raw.candidate.usernameFragment === "string"
            ? raw.candidate.usernameFragment
            : undefined,
      };
    }
  }

  return signal.description || signal.candidate ? signal : null;
}

export default class GameRoom implements Party.Server {
  players = new Map<string, PlayerState>();
  history: ChatMsg[] = [];

  constructor(readonly room: Party.Room) {}

  onRequest() {
    return Response.json({
      ok: true,
      room: this.room.id,
      players: this.players.size,
    });
  }

  onConnect(conn: Party.Connection) {
    conn.send(
      JSON.stringify({
        type: "init",
        you: conn.id,
        players: Array.from(this.players.values()),
        history: this.history.slice(-30),
      })
    );
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: any;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "join") {
      const nick = sanitize(msg.nick, MAX_NICK) || "Anon";
      const state: PlayerState = {
        id: sender.id,
        nick,
        x: typeof msg.x === "number" ? msg.x : -40,
        z: typeof msg.z === "number" ? msg.z : 38,
        ry: typeof msg.ry === "number" ? msg.ry : 0,
        speed: 0,
        voiceEnabled: false,
        voiceMuted: false,
      };
      this.players.set(sender.id, state);
      this.room.broadcast(JSON.stringify({ type: "join", player: state }), [sender.id]);
      const sysMsg: ChatMsg = {
        id: "__system__",
        nick: "sistema",
        text: `${nick} entrou no gramado`,
        ts: Date.now(),
      };
      this.history.push(sysMsg);
      this.trim();
      this.room.broadcast(JSON.stringify({ type: "chat", ...sysMsg }));
      return;
    }

    if (msg.type === "state") {
      const cur = this.players.get(sender.id);
      if (!cur) return;
      if (typeof msg.x === "number") cur.x = msg.x;
      if (typeof msg.z === "number") cur.z = msg.z;
      if (typeof msg.ry === "number") cur.ry = msg.ry;
      if (typeof msg.speed === "number") cur.speed = msg.speed;
      this.room.broadcast(
        JSON.stringify({
          type: "state",
          id: sender.id,
          x: cur.x,
          z: cur.z,
          ry: cur.ry,
          speed: cur.speed,
        }),
        [sender.id]
      );
      return;
    }

    if (msg.type === "emote") {
      this.room.broadcast(
        JSON.stringify({
          type: "emote",
          id: sender.id,
          kind: typeof msg.kind === "string" ? msg.kind.slice(0, 20) : "dance",
          duration: typeof msg.duration === "number" ? Math.min(10, msg.duration) : 4,
        }),
        [sender.id]
      );
      return;
    }

    if (msg.type === "voice-ready") {
      const player = this.players.get(sender.id);
      if (!player) return;
      player.voiceEnabled = msg.enabled === true;
      player.voiceMuted = player.voiceEnabled && msg.muted === true;
      this.room.broadcast(
        JSON.stringify({
          type: "voice-ready",
          id: sender.id,
          nick: player.nick,
          enabled: player.voiceEnabled,
          muted: player.voiceMuted,
        }),
        [sender.id]
      );
      return;
    }

    if (msg.type === "voice-signal") {
      if (!this.players.has(sender.id)) return;
      const target = sanitize(msg.target, 128);
      if (!target || target === sender.id) return;
      const signal = sanitizeVoiceSignal(msg.signal);
      if (!signal) return;
      this.room.broadcast(
        JSON.stringify({
          type: "voice-signal",
          from: sender.id,
          target,
          signal,
        }),
        [sender.id]
      );
      return;
    }

    if (msg.type === "chat") {
      const player = this.players.get(sender.id);
      const text = sanitize(msg.text, MAX_TEXT);
      if (!text) return;
      const nick = player?.nick || sanitize(msg.nick, MAX_NICK) || "Anon";
      const chat: ChatMsg = {
        id: sender.id,
        nick,
        text,
        ts: Date.now(),
      };
      this.history.push(chat);
      this.trim();
      this.room.broadcast(JSON.stringify({ type: "chat", ...chat }));
      return;
    }
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    this.room.broadcast(JSON.stringify({ type: "leave", id: conn.id }));
    if (player) {
      const sysMsg: ChatMsg = {
        id: "__system__",
        nick: "sistema",
        text: `${player.nick} saiu do gramado`,
        ts: Date.now(),
      };
      this.history.push(sysMsg);
      this.trim();
      this.room.broadcast(JSON.stringify({ type: "chat", ...sysMsg }));
    }
  }

  trim() {
    if (this.history.length > CHAT_HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - CHAT_HISTORY_LIMIT);
    }
  }
}

GameRoom satisfies Party.Worker;
