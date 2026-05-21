import type * as Party from "partykit/server";
import { parseOutboundSocketMessage } from "@/shared/schemas/multiplayer";

type PlayerState = {
  id: string;
  nick: string;
  avatar: AvatarState;
  x: number;
  z: number;
  ry: number;
  speed: number;
  activity: PlayerActivity;
  jumpY: number;
  voiceEnabled: boolean;
  voiceMuted: boolean;
};

type PlayerActivity =
  | "idle"
  | "walking"
  | "running"
  | "crouching"
  | "sitting"
  | "riding"
  | "emoting";

type SharedEntityKind = "bike";

type SharedEntityState = {
  id: string;
  kind: SharedEntityKind;
  x: number;
  z: number;
  ry: number;
  speed: number;
  mountedBy: string | null;
};

type NpcAnim = "idle" | "walk" | "run" | "sit" | "dance" | "celebrate";

type NpcState = {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  speed: number;
  anim: NpcAnim;
};

type AvatarState = {
  shirt: string;
  pants: string;
  shoes: string;
  skin: string;
  backpack: string;
  hair: string;
  backpackEnabled: boolean;
  glasses: boolean;
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
const PVP_MAX_HITS = 3;

type PvPStatus = "pending" | "active" | "ended";

type PvPMatch = {
  id: string;
  playerA: string;
  playerB: string;
  nickA: string;
  nickB: string;
  hitsOnA: number;
  hitsOnB: number;
  status: PvPStatus;
};

type EspectroEvent = {
  seed: string;
  spawnIndex: number;
  expiresAt: number;
};
const MAX_SIGNAL_SDP = 30_000;
const MAX_SIGNAL_CANDIDATE = 8_000;
const MAX_ENTITY_ID = 96;
const MAX_NPC_ID = 96;
const MAX_NPCS = 32;
const ESPECTRO_SPAWN_POINT_COUNT = 6;
const ESPECTRO_SPAWN_HOUR = 3;
const ESPECTRO_SPAWN_MINUTE = 33;
const ESPECTRO_DESPAWN_HOUR = 4;
const DEFAULT_AVATAR: AvatarState = {
  shirt: "#2f855a",
  pants: "#24364d",
  shoes: "#1a1a1a",
  skin: "#f0c3a5",
  backpack: "#b85a31",
  hair: "#3a2516",
  backpackEnabled: true,
  glasses: false,
};

function sanitize(input: unknown, limit: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, limit);
}

function sanitizeHexColor(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const match = input.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function sanitizeAvatar(input: unknown): AvatarState {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    shirt: sanitizeHexColor(raw.shirt, DEFAULT_AVATAR.shirt),
    pants: sanitizeHexColor(raw.pants, DEFAULT_AVATAR.pants),
    shoes: sanitizeHexColor(raw.shoes, DEFAULT_AVATAR.shoes),
    skin: sanitizeHexColor(raw.skin, DEFAULT_AVATAR.skin),
    backpack: sanitizeHexColor(raw.backpack, DEFAULT_AVATAR.backpack),
    hair: sanitizeHexColor(raw.hair, DEFAULT_AVATAR.hair),
    backpackEnabled: raw.backpackEnabled !== false,
    glasses: raw.glasses === true,
  };
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

function sanitizeActivity(input: unknown): PlayerActivity {
  switch (input) {
    case "walking":
    case "running":
    case "crouching":
    case "sitting":
    case "riding":
    case "emoting":
      return input;
    default:
      return "idle";
  }
}

function sanitizeEntityKind(input: unknown): SharedEntityKind | null {
  return input === "bike" ? "bike" : null;
}

function sanitizeJumpY(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return 0;
  return Math.max(0, Math.min(4, input));
}

function sanitizeFiniteNumber(input: unknown, fallback = 0, min = -256, max = 256): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return fallback;
  return Math.max(min, Math.min(max, input));
}

function sanitizeNpcAnim(input: unknown): NpcAnim {
  switch (input) {
    case "walk":
    case "run":
    case "sit":
    case "dance":
    case "celebrate":
      return input;
    default:
      return "idle";
  }
}

function sanitizeNpcStates(input: unknown): NpcState[] {
  if (!Array.isArray(input)) return [];
  const result: NpcState[] = [];

  for (const item of input.slice(0, MAX_NPCS)) {
    const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const id = sanitize(raw?.id, MAX_NPC_ID);
    if (!id) continue;
    result.push({
      id,
      x: sanitizeFiniteNumber(raw?.x, 0, -128, 128),
      y: sanitizeFiniteNumber(raw?.y, 0, -8, 8),
      z: sanitizeFiniteNumber(raw?.z, 0, -128, 128),
      ry: sanitizeFiniteNumber(raw?.ry, 0, -Math.PI * 4, Math.PI * 4),
      speed: sanitizeFiniteNumber(raw?.speed, 0, 0, 32),
      anim: sanitizeNpcAnim(raw?.anim),
    });
  }

  return result;
}

export default class GameRoom implements Party.Server {
  players = new Map<string, PlayerState>();
  entities = new Map<string, SharedEntityState>();
  npcStates: NpcState[] = [];
  npcAuthority: string | null = null;
  history: ChatMsg[] = [];
  clockTimer: ReturnType<typeof setInterval> | null = null;
  pvpMatches = new Map<string, PvPMatch>();
  pvpCounter = 0;
  espectro: EspectroEvent | null = null;
  espectroBlockedDayKey: string | null = null;

  constructor(readonly room: Party.Room) {}

  maybeUpdateEspectro(now = Date.now()) {
    const serverDate = new Date(now);
    const dayKey = `${serverDate.getFullYear()}-${serverDate.getMonth() + 1}-${serverDate.getDate()}`;

    if (this.espectro && this.espectro.expiresAt <= now) {
      this.espectro = null;
      this.room.broadcast(JSON.stringify({ type: "espectro-despawn" }));
    }

    const minutes = serverDate.getHours() * 60 + serverDate.getMinutes();
    const spawnStartMinutes = ESPECTRO_SPAWN_HOUR * 60 + ESPECTRO_SPAWN_MINUTE;
    const despawnMinutes = ESPECTRO_DESPAWN_HOUR * 60;
    const isWindow = minutes >= spawnStartMinutes && minutes < despawnMinutes;

    if (!isWindow) {
      if (this.espectroBlockedDayKey === dayKey && minutes >= despawnMinutes) {
        this.espectroBlockedDayKey = null;
      }
      return;
    }
    if (this.espectro || this.espectroBlockedDayKey === dayKey) return;

    const despawnAt = new Date(serverDate);
    despawnAt.setHours(ESPECTRO_DESPAWN_HOUR, 0, 0, 0);

    this.espectro = {
      seed: `${now.toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`,
      spawnIndex: Math.floor(Math.random() * ESPECTRO_SPAWN_POINT_COUNT),
      expiresAt: despawnAt.getTime(),
    };
    this.room.broadcast(JSON.stringify({ type: "espectro-spawn", espectro: this.espectro }));
  }

  onRequest() {
    return Response.json({
      ok: true,
      room: this.room.id,
      players: this.players.size,
    });
  }

  onConnect(conn: Party.Connection) {
    this.maybeUpdateEspectro(Date.now());
    conn.send(
      JSON.stringify({
        type: "init",
        you: conn.id,
        players: Array.from(this.players.values()),
        entities: Array.from(this.entities.values()),
        npcAuthority: this.npcAuthority,
        npcs: this.npcStates,
        history: this.history.slice(-30),
        espectro: this.espectro && this.espectro.expiresAt > Date.now() ? this.espectro : null,
        serverNow: Date.now(),
      })
    );
    if (!this.clockTimer) {
      this.clockTimer = setInterval(() => {
        const now = Date.now();
        this.maybeUpdateEspectro(now);
        this.room.broadcast(
          JSON.stringify({
            type: "clock",
            serverNow: now,
          })
        );
      }, 2000);
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return;
    }
    const msg = parseOutboundSocketMessage(raw);
    if (!msg) return;

    if (msg.type === "join") {
      const nick = sanitize(msg.nick, MAX_NICK) || "Anon";
      const state: PlayerState = {
        id: sender.id,
        nick,
        avatar: sanitizeAvatar(msg.avatar),
        x: typeof msg.x === "number" ? msg.x : -40,
        z: typeof msg.z === "number" ? msg.z : 38,
        ry: typeof msg.ry === "number" ? msg.ry : 0,
        speed: 0,
        activity: "idle",
        jumpY: 0,
        voiceEnabled: false,
        voiceMuted: false,
      };
      this.players.set(sender.id, state);
      if (!this.npcAuthority) {
        this.npcAuthority = sender.id;
        this.room.broadcast(
          JSON.stringify({
            type: "npc-authority",
            id: this.npcAuthority,
          })
        );
      }
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

    if (msg.type === "npc-state") {
      if (!this.players.has(sender.id) || sender.id !== this.npcAuthority) return;
      this.npcStates = sanitizeNpcStates(msg.npcs);
      this.room.broadcast(
        JSON.stringify({
          type: "npc-state",
          npcs: this.npcStates,
        }),
        [sender.id]
      );
      return;
    }

    if (msg.type === "state") {
      const cur = this.players.get(sender.id);
      if (!cur) return;
      if (typeof msg.x === "number") cur.x = msg.x;
      if (typeof msg.z === "number") cur.z = msg.z;
      if (typeof msg.ry === "number") cur.ry = msg.ry;
      if (typeof msg.speed === "number") cur.speed = msg.speed;
      cur.activity = sanitizeActivity(msg.activity);
      cur.jumpY = sanitizeJumpY(msg.jumpY);
      this.room.broadcast(
        JSON.stringify({
          type: "state",
          id: sender.id,
          x: cur.x,
          z: cur.z,
          ry: cur.ry,
          speed: cur.speed,
          activity: cur.activity,
          jumpY: cur.jumpY,
        }),
        [sender.id]
      );
      return;
    }

    if (msg.type === "entity-state") {
      if (!this.players.has(sender.id)) return;
      const kind = sanitizeEntityKind(msg.kind);
      const id = sanitize(msg.id, MAX_ENTITY_ID);
      if (!kind || !id) return;

      const prev = this.entities.get(id);
      const next: SharedEntityState = {
        id,
        kind,
        x: typeof msg.x === "number" ? msg.x : prev?.x ?? 0,
        z: typeof msg.z === "number" ? msg.z : prev?.z ?? 0,
        ry: typeof msg.ry === "number" ? msg.ry : prev?.ry ?? 0,
        speed: typeof msg.speed === "number" ? msg.speed : prev?.speed ?? 0,
        mountedBy: msg.mounted === true ? sender.id : null,
      };

      this.entities.set(id, next);
      this.room.broadcast(
        JSON.stringify({
          type: "entity-state",
          ...next,
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

    if (msg.type === "reaction") {
      const targetKey = sanitize(msg.targetKey, 96);
      if (!targetKey) return;
      const targetId = targetKey.includes(":")
        ? targetKey.slice(0, targetKey.lastIndexOf(":"))
        : targetKey;
      this.room.broadcast(
        JSON.stringify({
          type: "reaction",
          id: sender.id,
          targetKey,
          targetId,
          kind: typeof msg.kind === "string" ? msg.kind.slice(0, 20) : "like",
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
      this.room.getConnection(target)?.send(
        JSON.stringify({
          type: "voice-signal",
          from: sender.id,
          target,
          signal,
        })
      );
      return;
    }

    if (msg.type === "pvp-challenge") {
      const challenger = this.players.get(sender.id);
      if (!challenger) return;
      const to = sanitize(msg.to, 128);
      if (!to || to === sender.id || !this.players.has(to)) return;
      const busy = [...this.pvpMatches.values()].some(
        (m) => m.status !== "ended" && (m.playerA === sender.id || m.playerB === sender.id || m.playerA === to || m.playerB === to)
      );
      if (busy) return;
      const matchId = `pvp-${++this.pvpCounter}`;
      const match: PvPMatch = {
        id: matchId,
        playerA: sender.id,
        playerB: to,
        nickA: challenger.nick,
        nickB: this.players.get(to)!.nick,
        hitsOnA: 0,
        hitsOnB: 0,
        status: "pending",
      };
      this.pvpMatches.set(matchId, match);
      this.room.getConnection(to)?.send(JSON.stringify({
        type: "pvp-challenge",
        matchId,
        from: sender.id,
        fromNick: challenger.nick,
      }));
      return;
    }

    if (msg.type === "pvp-respond") {
      const matchId = sanitize(msg.matchId, 64);
      const match = this.pvpMatches.get(matchId);
      if (!match || match.status !== "pending" || match.playerB !== sender.id) return;
      if (msg.accepted !== true) {
        match.status = "ended";
        this.room.getConnection(match.playerA)?.send(JSON.stringify({
          type: "pvp-declined",
          matchId,
          opponentNick: match.nickB,
        }));
        return;
      }
      match.status = "active";
      const startMsg = JSON.stringify({
        type: "pvp-start",
        matchId,
        playerA: match.playerA,
        playerB: match.playerB,
        nickA: match.nickA,
        nickB: match.nickB,
      });
      this.room.getConnection(match.playerA)?.send(startMsg);
      this.room.getConnection(match.playerB)?.send(startMsg);
      return;
    }

    if (msg.type === "pvp-throw") {
      const matchId = sanitize(msg.matchId, 64);
      const match = this.pvpMatches.get(matchId);
      if (!match || match.status !== "active") return;
      if (match.playerA !== sender.id && match.playerB !== sender.id) return;
      const opponent = match.playerA === sender.id ? match.playerB : match.playerA;
      const dx = sanitizeFiniteNumber(msg.dx, 0, -1, 1);
      const dz = sanitizeFiniteNumber(msg.dz, 0, -1, 1);
      const x = sanitizeFiniteNumber(msg.x, 0, -128, 128);
      const z = sanitizeFiniteNumber(msg.z, 0, -128, 128);
      this.room.getConnection(opponent)?.send(JSON.stringify({
        type: "pvp-throw",
        matchId,
        from: sender.id,
        dx, dz, x, z,
      }));
      return;
    }

    if (msg.type === "pvp-hit") {
      const matchId = sanitize(msg.matchId, 64);
      const match = this.pvpMatches.get(matchId);
      if (!match || match.status !== "active") return;
      if (match.playerA !== sender.id && match.playerB !== sender.id) return;
      const victim = sanitize(msg.victim, 128);
      if (victim !== match.playerA && victim !== match.playerB) return;
      if (victim === sender.id) return;
      if (victim === match.playerA) {
        match.hitsOnA = Math.min(match.hitsOnA + 1, PVP_MAX_HITS);
      } else {
        match.hitsOnB = Math.min(match.hitsOnB + 1, PVP_MAX_HITS);
      }
      if (match.hitsOnA >= PVP_MAX_HITS || match.hitsOnB >= PVP_MAX_HITS) {
        match.status = "ended";
        const aWon = match.hitsOnB >= PVP_MAX_HITS;
        const winner = aWon ? match.playerA : match.playerB;
        const loser = aWon ? match.playerB : match.playerA;
        const winnerNick = aWon ? match.nickA : match.nickB;
        const loserNick = aWon ? match.nickB : match.nickA;
        const endMsg = JSON.stringify({
          type: "pvp-end",
          matchId,
          winner,
          loser,
          winnerNick,
          loserNick,
          hitsOnA: match.hitsOnA,
          hitsOnB: match.hitsOnB,
        });
        this.room.getConnection(match.playerA)?.send(endMsg);
        this.room.getConnection(match.playerB)?.send(endMsg);
        const sysMsg: ChatMsg = {
          id: "__system__",
          nick: "sistema",
          text: `🏐 ${winnerNick} venceu ${loserNick} no queimado!`,
          ts: Date.now(),
        };
        this.history.push(sysMsg);
        this.trim();
        this.room.broadcast(JSON.stringify({ type: "chat", ...sysMsg }));
      } else {
        const hitMsg = JSON.stringify({
          type: "pvp-hit",
          matchId,
          victim,
          hitsOnA: match.hitsOnA,
          hitsOnB: match.hitsOnB,
        });
        this.room.getConnection(match.playerA)?.send(hitMsg);
        this.room.getConnection(match.playerB)?.send(hitMsg);
      }
      return;
    }

    if (msg.type === "pvp-quit") {
      const matchId = sanitize(msg.matchId, 64);
      const match = this.pvpMatches.get(matchId);
      if (!match || match.status !== "active") return;
      if (match.playerA !== sender.id && match.playerB !== sender.id) return;
      this._endPvpByForfeit(match, sender.id);
      return;
    }

    if (msg.type === "espectro-consumed") {
      if (!this.players.has(sender.id) || !this.espectro) return;
      const seed = sanitize(msg.seed, 96);
      if (!seed || seed !== this.espectro.seed) return;
      const now = new Date();
      this.espectroBlockedDayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      this.espectro = null;
      this.room.broadcast(JSON.stringify({ type: "espectro-despawn" }));
      return;
    }

    if (msg.type === "chat") {
      const player = this.players.get(sender.id);
      const text = sanitize(msg.text, MAX_TEXT);
      if (!text) return;
      const nick = player?.nick || "Anon";
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

  _endPvpByForfeit(match: PvPMatch, quitterId: string) {
    match.status = "ended";
    const aQuit = match.playerA === quitterId;
    const winner = aQuit ? match.playerB : match.playerA;
    const winnerNick = aQuit ? match.nickB : match.nickA;
    const loserNick = aQuit ? match.nickA : match.nickB;
    const endMsg = JSON.stringify({
      type: "pvp-end",
      matchId: match.id,
      winner,
      loser: quitterId,
      winnerNick,
      loserNick,
      hitsOnA: match.hitsOnA,
      hitsOnB: match.hitsOnB,
      forfeit: true,
    });
    this.room.getConnection(match.playerA)?.send(endMsg);
    this.room.getConnection(match.playerB)?.send(endMsg);
  }

  onClose(conn: Party.Connection) {
    for (const match of this.pvpMatches.values()) {
      if (match.status === "pending" && match.playerA === conn.id) {
        match.status = "ended";
        this.room.getConnection(match.playerB)?.send(JSON.stringify({ type: "pvp-cancelled", matchId: match.id }));
      } else if (match.status === "active" && (match.playerA === conn.id || match.playerB === conn.id)) {
        this._endPvpByForfeit(match, conn.id);
      }
    }
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    this.room.broadcast(JSON.stringify({ type: "leave", id: conn.id }));
    for (const entity of this.entities.values()) {
      if (entity.mountedBy !== conn.id) continue;
      entity.mountedBy = null;
      this.room.broadcast(
        JSON.stringify({
          type: "entity-state",
          ...entity,
        })
      );
    }
    if (this.npcAuthority === conn.id) {
      const nextAuthority = this.players.keys().next();
      this.npcAuthority = nextAuthority.done ? null : nextAuthority.value;
      if (!this.npcAuthority) {
        this.npcStates = [];
      }
      this.room.broadcast(
        JSON.stringify({
          type: "npc-authority",
          id: this.npcAuthority,
        })
      );
    }
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
    if (this.players.size === 0 && this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  trim() {
    if (this.history.length > CHAT_HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - CHAT_HISTORY_LIMIT);
    }
  }
}

GameRoom satisfies Party.Worker;
