import type * as Party from "partykit/server";
import { parseOutboundSocketMessage } from "@/shared/schemas/multiplayer";
import { PokerTable, type PokerActionKind } from "./poker";
import { ChessTable, type ChessColor } from "./chess";
import { SwimmingRaces } from "./swimming";
import { TypingGames } from "./typing";
import { SharedWorldSystems } from "./worldSystems";
import { CAMPUS_SPAWN, CAMPUS_WALL_LIMIT } from "@/game/world/campusLayout";

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
  floorY: number;
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
  | "swimming"
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
  accent: string;
  hairStyle: "short" | "curly" | "mohawk" | "bun";
  outfitStyle: "classic" | "jacket" | "sport";
  faceStyle: "classic" | "freckles" | "smile";
  headShape: "round" | "oval" | "wide";
  accessory: "none" | "headphones" | "cap" | "beanie";
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
const PVP_CHALLENGE_TIMEOUT_MS = 25_000;
const SERVER_WORLD_LIMIT = 105;

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
  lastThrowA: PvPThrowRecord | null;
  lastThrowB: PvPThrowRecord | null;
  expiresAt: number;
};

type PvPThrowRecord = {
  at: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  claimed: boolean;
};

type EspectroEvent = {
  seed: string;
  spawnIndex: number;
  expiresAt: number;
  mode: "foot" | "bike";
};
type BiribaDuelRecord = {
  seed: string;
  startedAt: number;
  hits: number;
  lastHitAt: number;
  lastSequence: number;
};
const MAX_ENTITY_ID = 96;
const MAX_NPC_ID = 96;
const MAX_NPCS = 32;
const ESPECTRO_SPAWN_POINT_COUNT = 6;
const ESPECTRO_SPAWN_HOUR = 3;
const ESPECTRO_SPAWN_MINUTE = 33;
const ESPECTRO_DESPAWN_HOUR = 4;
const BIRIBA_BIKE_CHANCE = 0.01;
const BIRIBA_BIKE_MIN_ATTEMPT_MS = 3 * 60_000;
const BIRIBA_BIKE_MAX_ATTEMPT_MS = 6 * 60_000;
const BIRIBA_BIKE_EVENT_MS = 75_000;
const BIRIBA_BIKE_COOLDOWN_MS = 45 * 60_000;
const MANUAL_BIRIBA_COOLDOWN_MS = 90_000;
const MANUAL_BIRIBA_DURATION_MS = 4 * 60_000;
const BIRIBA_DUEL_REQUIRED_HITS = 5;
const BIRIBA_DUEL_MIN_HIT_GAP_MS = 420;
// Cinco arremessos legítimos já exigem cadência, viagem da bola e a esquiva
// do Biriba. A margem impede pacotes instantâneos sem rejeitar uma vitória
// excepcionalmente rápida depois da animação de entrada.
const BIRIBA_DUEL_MIN_WIN_MS = 3_500;
const HIDDEN_BIRIBA_COMMAND = "/vigilia 0333";
const DEFAULT_AVATAR: AvatarState = {
  shirt: "#2f855a",
  pants: "#24364d",
  shoes: "#1a1a1a",
  skin: "#f0c3a5",
  backpack: "#b85a31",
  hair: "#3a2516",
  backpackEnabled: true,
  glasses: false,
  accent: "#f6b94b",
  hairStyle: "short",
  outfitStyle: "classic",
  faceStyle: "classic",
  headShape: "round",
  accessory: "none",
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
    accent: sanitizeHexColor(raw.accent, DEFAULT_AVATAR.accent),
    hairStyle: (["short", "curly", "mohawk", "bun"] as const).includes(raw.hairStyle as any)
      ? raw.hairStyle as AvatarState["hairStyle"]
      : DEFAULT_AVATAR.hairStyle,
    outfitStyle: (["classic", "jacket", "sport"] as const).includes(raw.outfitStyle as any)
      ? raw.outfitStyle as AvatarState["outfitStyle"]
      : DEFAULT_AVATAR.outfitStyle,
    faceStyle: (["classic", "freckles", "smile"] as const).includes(raw.faceStyle as any)
      ? raw.faceStyle as AvatarState["faceStyle"]
      : DEFAULT_AVATAR.faceStyle,
    headShape: (["round", "oval", "wide"] as const).includes(raw.headShape as any)
      ? raw.headShape as AvatarState["headShape"]
      : DEFAULT_AVATAR.headShape,
    accessory: (["none", "headphones", "cap", "beanie"] as const).includes(raw.accessory as any)
      ? raw.accessory as AvatarState["accessory"]
      : DEFAULT_AVATAR.accessory,
  };
}

function sanitizeActivity(input: unknown): PlayerActivity {
  switch (input) {
    case "walking":
    case "running":
    case "crouching":
    case "sitting":
    case "riding":
    case "swimming":
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
  biribaDuels = new Map<string, BiribaDuelRecord>();
  espectroBlockedDayKey: string | null = null;
  poker = new PokerTable(6);
  chess = new ChessTable();
  swimming: SwimmingRaces;
  typing: TypingGames;
  worldSystems: SharedWorldSystems;
  nextBiribaBikeAttemptAt = 0;
  biribaBikeCooldownUntil = 0;
  lastManualBiribaSummonAt = 0;

  constructor(readonly room: Party.Room) {
    this.worldSystems = new SharedWorldSystems(room);
    this.swimming = new SwimmingRaces(room, (playerId) =>
      this.isPvpBusy(playerId) ||
      this.typing?.isBusy(playerId) === true ||
      this.isTableBusy(playerId) ||
      this.isTraversalBusy(playerId)
    );
    this.typing = new TypingGames(room, (playerId) =>
      this.isPvpBusy(playerId) ||
      this.swimming.isBusy(playerId) ||
      this.isTableBusy(playerId) ||
      this.isTraversalBusy(playerId)
    );
  }

  isPvpBusy(playerId: string) {
    return [...this.pvpMatches.values()].some(
      (match) => match.status !== "ended" && (match.playerA === playerId || match.playerB === playerId)
    );
  }

  isTableBusy(playerId: string) {
    return (
      this.poker.seats.some((seat) => seat.playerId === playerId) ||
      this.chess.seats.w.playerId === playerId ||
      this.chess.seats.b.playerId === playerId
    );
  }

  private isTraversalBusy(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return false;
    const outsideCampus =
      Math.abs(player.x) > CAMPUS_WALL_LIMIT + 0.5 ||
      Math.abs(player.z) > CAMPUS_WALL_LIMIT + 0.5;
    return player.floorY > 3.85 || (outsideCampus && player.floorY > 0.25);
  }

  private isProtectedActivityBusy(playerId: string) {
    return (
      this.isPvpBusy(playerId) ||
      this.swimming?.isBusy(playerId) === true ||
      this.typing?.isBusy(playerId) === true ||
      this.isTableBusy(playerId)
    );
  }

  private expirePendingPvp(now = Date.now()) {
    for (const [matchId, match] of this.pvpMatches) {
      if (match.status !== "pending" || match.expiresAt > now) continue;
      const payload = JSON.stringify({
        type: "pvp-cancelled",
        matchId,
        reason: "O desafio expirou.",
      });
      this.room.getConnection(match.playerA)?.send(payload);
      this.room.getConnection(match.playerB)?.send(payload);
      this.pvpMatches.delete(matchId);
    }
  }

  isActivityBusy(playerId: string) {
    return (
      this.isProtectedActivityBusy(playerId) ||
      this.isTraversalBusy(playerId)
    );
  }

  private sendSystem(conn: Party.Connection, text: string) {
    conn.send(JSON.stringify({
      type: "chat",
      id: "__system__",
      nick: "sistema",
      text,
      ts: Date.now(),
    }));
  }

  private spawnBiriba(mode: "foot" | "bike", expiresAt: number, now = Date.now()) {
    this.biribaDuels.clear();
    this.espectro = {
      seed: `${now.toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`,
      spawnIndex: Math.floor(Math.random() * ESPECTRO_SPAWN_POINT_COUNT),
      expiresAt,
      mode,
    };
    this.room.broadcast(JSON.stringify({ type: "espectro-spawn", espectro: this.espectro }));
  }

  private scheduleNextBikeAttempt(now: number, quick = false) {
    const min = quick ? 75_000 : BIRIBA_BIKE_MIN_ATTEMPT_MS;
    const max = quick ? 150_000 : BIRIBA_BIKE_MAX_ATTEMPT_MS;
    this.nextBiribaBikeAttemptAt = now + min + Math.random() * (max - min);
  }

  private maybeTryBiribaBike(now = Date.now()) {
    if (this.espectro?.mode === "bike" && this.players.size !== 1) {
      this.espectro = null;
      this.biribaDuels.clear();
      this.room.broadcast(JSON.stringify({ type: "espectro-despawn" }));
      this.scheduleNextBikeAttempt(now);
      return;
    }
    if (this.players.size !== 1 || this.espectro || now < this.biribaBikeCooldownUntil) return;
    if (!this.nextBiribaBikeAttemptAt) {
      this.scheduleNextBikeAttempt(now, true);
      return;
    }
    if (now < this.nextBiribaBikeAttemptAt) return;

    this.scheduleNextBikeAttempt(now);
    if (Math.random() >= BIRIBA_BIKE_CHANCE) return;
    this.biribaBikeCooldownUntil = now + BIRIBA_BIKE_COOLDOWN_MS;
    this.spawnBiriba("bike", now + BIRIBA_BIKE_EVENT_MS, now);
  }

  broadcastChessState() {
    this.room.broadcast(
      JSON.stringify({ type: "chess-state", state: this.chess.publicState() })
    );
  }

  chessSendError(conn: Party.Connection, message: string) {
    conn.send(JSON.stringify({ type: "chess-error", message }));
  }

  broadcastPokerState() {
    this.room.broadcast(
      JSON.stringify({ type: "poker-state", state: this.poker.publicState() })
    );
  }

  sendPokerHole(connId: string) {
    const conn = this.room.getConnection(connId);
    if (!conn) return;
    const cards = this.poker.getHoleCards(connId);
    if (!cards || cards.length !== 2) return;
    const seat = this.poker.seats.find((s) => s.playerId === connId);
    if (!seat) return;
    conn.send(
      JSON.stringify({
        type: "poker-hole",
        seatIndex: seat.index,
        cards,
      })
    );
  }

  broadcastAllHoleCards() {
    for (const seat of this.poker.seats) {
      if (seat.playerId && seat.holeCards.length === 2) {
        this.sendPokerHole(seat.playerId);
      }
    }
  }

  pokerSendError(conn: Party.Connection, message: string) {
    conn.send(JSON.stringify({ type: "poker-error", message }));
  }

  tryStartPokerHand() {
    if (this.poker.tryStartHand()) {
      this.broadcastAllHoleCards();
      this.broadcastPokerState();
    }
  }

  maybeUpdateEspectro(now = Date.now()) {
    const serverDate = new Date(now);
    const dayKey = `${serverDate.getFullYear()}-${serverDate.getMonth() + 1}-${serverDate.getDate()}`;

    if (this.espectro && this.espectro.expiresAt <= now) {
      this.espectro = null;
      this.biribaDuels.clear();
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
      mode: "foot",
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
        media: this.worldSystems.media,
        items: this.worldSystems.itemState(),
        serverNow: Date.now(),
      })
    );
    // Estado atual da mesa de poker (inclui nada de cartas privadas)
    conn.send(
      JSON.stringify({ type: "poker-state", state: this.poker.publicState() })
    );
    // Estado atual do xadrez
    conn.send(
      JSON.stringify({ type: "chess-state", state: this.chess.publicState() })
    );
    this.typing.sendLobby(conn.id);
    if (!this.clockTimer) {
      this.clockTimer = setInterval(() => {
        const now = Date.now();
        this.maybeUpdateEspectro(now);
        this.maybeTryBiribaBike(now);
        this.expirePendingPvp(now);
        this.room.broadcast(
          JSON.stringify({
            type: "clock",
            serverNow: now,
          })
        );
        // Auto-deal proxima mao de poker quando chegou a hora
        if (
          this.poker.phase === "waiting" &&
          this.poker.nextHandAt !== null &&
          now >= this.poker.nextHandAt &&
          this.poker.canStartHand()
        ) {
          this.tryStartPokerHand();
        }
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
        x: sanitizeFiniteNumber(msg.x, CAMPUS_SPAWN.x, -CAMPUS_WALL_LIMIT - 10, CAMPUS_WALL_LIMIT + 10),
        z: sanitizeFiniteNumber(msg.z, CAMPUS_SPAWN.z, -CAMPUS_WALL_LIMIT - 10, CAMPUS_WALL_LIMIT + 10),
        ry: sanitizeFiniteNumber(msg.ry, 0, -Math.PI * 4, Math.PI * 4),
        speed: 0,
        activity: "idle",
        jumpY: 0,
        floorY: 0,
        voiceEnabled: false,
        voiceMuted: false,
      };
      this.players.set(sender.id, state);
      this.maybeTryBiribaBike(Date.now());
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

    if (
      msg.type === "media-set" ||
      msg.type === "media-control" ||
      msg.type === "item-pickup" ||
      msg.type === "item-use"
    ) {
      if (
        (msg.type === "item-pickup" || msg.type === "item-use") &&
        this.isActivityBusy(sender.id)
      ) {
        sender.send(JSON.stringify({
          type: "gameplay-error",
          system: "item",
          message: "Termine a atividade atual antes de usar esse item.",
        }));
        return;
      }
      if (
        msg.type === "item-use" &&
        (msg.itemId === "bat" || msg.itemId === "biriba-ball") &&
        msg.targetId &&
        this.isProtectedActivityBusy(msg.targetId)
      ) {
        sender.send(JSON.stringify({
          type: "gameplay-error",
          system: "item",
          message: "Esse jogador está protegido enquanto participa de um minigame.",
        }));
        return;
      }
      this.worldSystems.handle(msg, sender, this.players, this.npcStates);
      return;
    }

    if (
      msg.type === "swim-challenge" ||
      msg.type === "swim-respond" ||
      msg.type === "swim-stroke" ||
      msg.type === "swim-quit"
    ) {
      this.swimming.handle(msg, sender, this.players);
      return;
    }

    if (
      msg.type === "typing-solo" ||
      msg.type === "typing-challenge" ||
      msg.type === "typing-respond" ||
      msg.type === "typing-room-create" ||
      msg.type === "typing-room-join" ||
      msg.type === "typing-room-leave" ||
      msg.type === "typing-room-start" ||
      msg.type === "typing-input" ||
      msg.type === "typing-quit"
    ) {
      this.typing.handle(msg, sender, this.players);
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
      cur.x = sanitizeFiniteNumber(msg.x, cur.x, -SERVER_WORLD_LIMIT, SERVER_WORLD_LIMIT);
      cur.z = sanitizeFiniteNumber(msg.z, cur.z, -SERVER_WORLD_LIMIT, SERVER_WORLD_LIMIT);
      cur.ry = sanitizeFiniteNumber(msg.ry, cur.ry, -Math.PI * 4, Math.PI * 4);
      cur.speed = sanitizeFiniteNumber(msg.speed, cur.speed, 0, 24);
      cur.activity = sanitizeActivity(msg.activity);
      cur.jumpY = sanitizeJumpY(msg.jumpY);
      cur.floorY = sanitizeFiniteNumber(msg.floorY, cur.floorY, 0, 64);
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
          floorY: cur.floorY,
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
      if (prev?.mountedBy && prev.mountedBy !== sender.id) return;
      const next: SharedEntityState = {
        id,
        kind,
        x: sanitizeFiniteNumber(msg.x, prev?.x ?? 0, -CAMPUS_WALL_LIMIT - 10, CAMPUS_WALL_LIMIT + 10),
        z: sanitizeFiniteNumber(msg.z, prev?.z ?? 0, -CAMPUS_WALL_LIMIT - 10, CAMPUS_WALL_LIMIT + 10),
        ry: sanitizeFiniteNumber(msg.ry, prev?.ry ?? 0, -Math.PI * 4, Math.PI * 4),
        speed: sanitizeFiniteNumber(msg.speed, prev?.speed ?? 0, 0, 24),
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
      this.room.getConnection(target)?.send(
        JSON.stringify({
          type: "voice-signal",
          from: sender.id,
          target,
          signal: msg.signal,
        })
      );
      return;
    }

    if (msg.type === "pvp-challenge") {
      const challenger = this.players.get(sender.id);
      if (!challenger) return;
      const to = sanitize(msg.to, 128);
      if (!to || to === sender.id || !this.players.has(to)) return;
      const busy = this.isActivityBusy(sender.id) || this.isActivityBusy(to);
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
        lastThrowA: null,
        lastThrowB: null,
        expiresAt: Date.now() + PVP_CHALLENGE_TIMEOUT_MS,
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
        this.pvpMatches.delete(matchId);
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
      const player = this.players.get(sender.id);
      if (!player) return;
      let dx = sanitizeFiniteNumber(msg.dx, 0, -1, 1);
      let dz = sanitizeFiniteNumber(msg.dz, 0, -1, 1);
      const x = sanitizeFiniteNumber(msg.x, 0, -128, 128);
      const z = sanitizeFiniteNumber(msg.z, 0, -128, 128);
      const directionLength = Math.hypot(dx, dz);
      if (directionLength < 0.7 || Math.hypot(x - player.x, z - player.z) > 1.8) return;
      dx /= directionLength;
      dz /= directionLength;
      const now = Date.now();
      const previous = match.playerA === sender.id ? match.lastThrowA : match.lastThrowB;
      if (previous && now - previous.at < 430) return;
      const record: PvPThrowRecord = { at: now, x, z, dx, dz, claimed: false };
      if (match.playerA === sender.id) match.lastThrowA = record;
      else match.lastThrowB = record;
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
      const throwRecord = match.playerA === sender.id ? match.lastThrowA : match.lastThrowB;
      const victimState = this.players.get(victim);
      if (!throwRecord || throwRecord.claimed || !victimState) return;
      const elapsed = (Date.now() - throwRecord.at) / 1000;
      if (elapsed < 0 || elapsed > 2.45) return;
      const travel = Math.min(2.2, elapsed) * 11;
      const endX = throwRecord.x + throwRecord.dx * travel;
      const endZ = throwRecord.z + throwRecord.dz * travel;
      const segmentX = endX - throwRecord.x;
      const segmentZ = endZ - throwRecord.z;
      const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ || 1;
      const projection = Math.max(0, Math.min(1,
        ((victimState.x - throwRecord.x) * segmentX + (victimState.z - throwRecord.z) * segmentZ) / segmentLengthSq,
      ));
      const closestX = throwRecord.x + segmentX * projection;
      const closestZ = throwRecord.z + segmentZ * projection;
      if (Math.hypot(victimState.x - closestX, victimState.z - closestZ) > 1.35) return;
      throwRecord.claimed = true;
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
        this.pvpMatches.delete(matchId);
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

    if (msg.type === "espectro-duel-start") {
      if (!this.players.has(sender.id) || !this.espectro || this.espectro.mode !== "foot") return;
      const seed = sanitize(msg.seed, 96);
      if (!seed || seed !== this.espectro.seed || this.isProtectedActivityBusy(sender.id)) return;
      const current = this.biribaDuels.get(sender.id);
      if (current?.seed === seed) return;
      this.biribaDuels.set(sender.id, {
        seed,
        startedAt: Date.now(),
        hits: 0,
        lastHitAt: 0,
        lastSequence: 0,
      });
      return;
    }

    if (msg.type === "espectro-duel-hit") {
      const duel = this.biribaDuels.get(sender.id);
      const seed = sanitize(msg.seed, 96);
      const now = Date.now();
      if (!duel || !this.espectro || seed !== duel.seed || seed !== this.espectro.seed) return;
      if (msg.sequence <= duel.lastSequence || msg.sequence > BIRIBA_DUEL_REQUIRED_HITS) return;
      if (now - duel.startedAt < 700 || now - duel.lastHitAt < BIRIBA_DUEL_MIN_HIT_GAP_MS) return;
      duel.lastSequence = msg.sequence;
      duel.lastHitAt = now;
      duel.hits = Math.min(BIRIBA_DUEL_REQUIRED_HITS, duel.hits + 1);
      return;
    }

    if (msg.type === "espectro-consumed") {
      if (!this.players.has(sender.id) || !this.espectro) return;
      const seed = sanitize(msg.seed, 96);
      if (!seed || seed !== this.espectro.seed) return;
      if (msg.outcome === "won") {
        const duel = this.biribaDuels.get(sender.id);
        const nowMs = Date.now();
        if (
          !duel ||
          duel.seed !== seed ||
          duel.hits < BIRIBA_DUEL_REQUIRED_HITS ||
          nowMs - duel.startedAt < BIRIBA_DUEL_MIN_WIN_MS
        ) {
          sender.send(JSON.stringify({
            type: "gameplay-error",
            system: "item",
            message: "O resultado da queimada não pôde ser validado.",
          }));
          return;
        }
        this.worldSystems.grantBiribaBall(sender.id);
        this.sendSystem(sender, "Biriba deixou uma Bola Errante para você. Use Q para lançar fora da quadra.");
      }
      this.biribaDuels.clear();
      const now = new Date();
      this.espectroBlockedDayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      this.espectro = null;
      this.room.broadcast(JSON.stringify({ type: "espectro-despawn" }));
      return;
    }

    if (msg.type === "poker-sit") {
      const player = this.players.get(sender.id);
      if (!player) return;
      const alreadySeated = this.poker.seats.some((seat) => seat.playerId === sender.id);
      if (!alreadySeated && this.isActivityBusy(sender.id)) {
        this.pokerSendError(sender, "Termine a atividade atual antes de sentar.");
        return;
      }
      const res = this.poker.sit(msg.seatIndex, sender.id, player.nick);
      if (!res.ok) {
        this.pokerSendError(sender, res.error ?? "Erro");
        return;
      }
      this.broadcastPokerState();
      if (this.poker.canStartHand() && this.poker.phase === "waiting") {
        // Pequeno delay pra dar tempo de outros sentarem
        this.poker.nextHandAt = Date.now() + 3500;
      }
      return;
    }

    if (msg.type === "poker-stand") {
      const changed = this.poker.stand(sender.id);
      if (changed) {
        // Se a mao acabou por nao ter mais jogadores, broadcast hole/state
        if (this.poker.phase === "waiting" && this.poker.lastWinners.length > 0) {
          this.broadcastAllHoleCards();
        }
        this.broadcastPokerState();
      }
      return;
    }

    if (msg.type === "poker-action") {
      const res = this.poker.action(
        sender.id,
        msg.action as PokerActionKind,
        msg.amount,
      );
      if (res.ok === false) {
        this.pokerSendError(sender, res.error);
        return;
      }
      // Se mao acabou em showdown ou todos foldaram, hole cards podem ser
      // reveladas — broadcast pra todos
      if (res.handEnded) {
        this.broadcastAllHoleCards();
      }
      this.broadcastPokerState();
      return;
    }

    if (msg.type === "poker-start") {
      this.tryStartPokerHand();
      return;
    }

    if (msg.type === "chess-sit") {
      const player = this.players.get(sender.id);
      if (!player) return;
      const alreadySeated =
        this.chess.seats.w.playerId === sender.id || this.chess.seats.b.playerId === sender.id;
      if (!alreadySeated && this.isActivityBusy(sender.id)) {
        this.chessSendError(sender, "Termine a atividade atual antes de sentar.");
        return;
      }
      const res = this.chess.sit(msg.color as ChessColor, sender.id, player.nick);
      if (!res.ok) {
        this.chessSendError(sender, res.error ?? "Erro");
        return;
      }
      this.broadcastChessState();
      return;
    }

    if (msg.type === "chess-stand") {
      const changed = this.chess.stand(sender.id);
      if (changed) this.broadcastChessState();
      return;
    }

    if (msg.type === "chess-move") {
      const res = this.chess.move(sender.id, msg.from, msg.to);
      if (res.ok === false) {
        this.chessSendError(sender, res.error);
        return;
      }
      this.broadcastChessState();
      return;
    }

    if (msg.type === "chess-reset") {
      this.chess.resetIfFinished();
      this.broadcastChessState();
      return;
    }

    if (msg.type === "chat") {
      const player = this.players.get(sender.id);
      const text = sanitize(msg.text, MAX_TEXT);
      if (!text) return;
      if (text.toLocaleLowerCase("pt-BR") === HIDDEN_BIRIBA_COMMAND) {
        if (!player) return;
        const now = Date.now();
        if (now - this.lastManualBiribaSummonAt < MANUAL_BIRIBA_COOLDOWN_MS) {
          this.sendSystem(sender, "O sinal ainda está ecoando. Tente novamente em instantes.");
          return;
        }
        if (this.espectro) {
          this.sendSystem(sender, "O sinal respondeu: Biriba já está no mapa.");
          return;
        }
        this.lastManualBiribaSummonAt = now;
        this.spawnBiriba("foot", now + MANUAL_BIRIBA_DURATION_MS, now);
        this.sendSystem(sender, "Um ruído baixo atravessou o campus...");
        return;
      }
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
    this.pvpMatches.delete(match.id);
  }

  onClose(conn: Party.Connection) {
    this.swimming.disconnect(conn.id);
    this.typing.disconnect(conn.id);
    this.worldSystems.disconnect(conn.id);
    this.biribaDuels.delete(conn.id);
    for (const match of [...this.pvpMatches.values()]) {
      if (match.status === "pending" && (match.playerA === conn.id || match.playerB === conn.id)) {
        match.status = "ended";
        const otherId = match.playerA === conn.id ? match.playerB : match.playerA;
        this.room.getConnection(otherId)?.send(JSON.stringify({
          type: "pvp-cancelled",
          matchId: match.id,
          reason: "O outro jogador desconectou.",
        }));
        this.pvpMatches.delete(match.id);
      } else if (match.status === "active" && (match.playerA === conn.id || match.playerB === conn.id)) {
        this._endPvpByForfeit(match, conn.id);
      }
    }
    // Desocupa lugar na mesa de poker, se sentado
    if (this.poker.stand(conn.id)) {
      this.broadcastPokerState();
    }
    // Desocupa lugar no xadrez, se sentado
    if (this.chess.stand(conn.id)) {
      this.broadcastChessState();
    }
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    this.maybeTryBiribaBike(Date.now());
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
      this.nextBiribaBikeAttemptAt = 0;
    }
  }

  trim() {
    if (this.history.length > CHAT_HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - CHAT_HISTORY_LIMIT);
    }
  }
}

GameRoom satisfies Party.Worker;
