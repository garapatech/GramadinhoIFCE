import type * as Party from "partykit/server";
import type { SocketOutboundMessage } from "@/shared/schemas/multiplayer";

type PlayerRecord = {
  id: string;
  nick: string;
  x: number;
  z: number;
  ry: number;
  jumpY: number;
  floorY: number;
};

type NpcRecord = {
  id: string;
  x: number;
  y: number;
  z: number;
};

type WorldMessage = Extract<
  SocketOutboundMessage,
  { type: "media-set" | "media-control" | "item-pickup" | "item-use" }
>;

export type GlobalMediaState = {
  url: string | null;
  provider: "youtube" | "spotify" | null;
  startedBy: string | null;
  startedByNick: string;
  playing: boolean;
  paused: boolean;
  volume: number;
  position: number;
  startedAt: number;
  updatedAt: number;
};

const BAT_POSITION = { x: -33.45, z: 58.2 };
const UMBRELLA_POSITION = { x: 1.8, z: 50.7 };
const MUSIC_POSITION = { x: -18, z: -4 };
const MUSIC_START_RADIUS = 5;
const BAT_PICKUP_RADIUS = 3.5;
const UMBRELLA_PICKUP_RADIUS = 4;
const BAT_HIT_RADIUS = 3.15;
const BAT_COOLDOWN_MS = 1_450;
const BIRIBA_BALL_RANGE = 18;
const BIRIBA_BALL_SPEED = 12;
const BIRIBA_BALL_COOLDOWN_MS = 1_150;
const RAGDOLL_IMMUNITY_MS = 3_200;

function distanceSq(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function targetHeight(target: PlayerRecord | NpcRecord) {
  return "floorY" in target ? target.floorY + target.jumpY : target.y;
}

function findTarget(
  id: string | undefined,
  players: ReadonlyMap<string, PlayerRecord>,
  npcs: readonly NpcRecord[],
) {
  if (!id) return null;
  return players.get(id) ?? npcs.find((npc) => npc.id === id) ?? null;
}

function resolveProvider(rawUrl: string): { url: string; provider: "youtube" | "spotify" } | null {
  const value = rawUrl.trim();
  if (/^spotify:(track|album|playlist|episode|show):[A-Za-z0-9]+$/.test(value)) {
    return { url: value, provider: "spotify" };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    return { url: parsed.toString(), provider: "youtube" };
  }
  if (["open.spotify.com", "play.spotify.com"].includes(host)) {
    return { url: parsed.toString(), provider: "spotify" };
  }
  return null;
}

export class SharedWorldSystems {
  media: GlobalMediaState = {
    url: null,
    provider: null,
    startedBy: null,
    startedByNick: "",
    playing: false,
    paused: false,
    volume: 0.72,
    position: 0,
    startedAt: 0,
    updatedAt: Date.now(),
  };

  private batOwnerId: string | null = null;
  private umbrellaOwners = new Set<string>();
  private openUmbrellas = new Set<string>();
  private biribaBallOwners = new Set<string>();
  private lastMediaAction = new Map<string, number>();
  private lastItemAction = new Map<string, number>();
  private lastItemSequence = new Map<string, number>();
  private ragdollImmuneUntil = new Map<string, number>();

  constructor(private readonly room: Party.Room) {}

  itemState() {
    return {
      batOwnerId: this.batOwnerId,
      umbrellaOwners: [...this.umbrellaOwners],
      openUmbrellas: [...this.openUmbrellas],
      biribaBallOwners: [...this.biribaBallOwners],
    };
  }

  grantBiribaBall(playerId: string) {
    const added = !this.biribaBallOwners.has(playerId);
    this.biribaBallOwners.add(playerId);
    this.broadcastItems();
    return added;
  }

  private send(playerId: string, payload: unknown) {
    this.room.getConnection(playerId)?.send(JSON.stringify(payload));
  }

  private error(playerId: string, system: "media" | "item", message: string) {
    this.send(playerId, { type: "gameplay-error", system, message });
  }

  private broadcastMedia() {
    this.room.broadcast(JSON.stringify({ type: "media-state", state: this.media }));
  }

  private broadcastItems() {
    this.room.broadcast(JSON.stringify({ type: "item-state", state: this.itemState() }));
  }

  private currentMediaPosition(now = Date.now()) {
    if (!this.media.playing || this.media.paused) return this.media.position;
    return Math.max(0, this.media.position + (now - this.media.startedAt) / 1000);
  }

  handle(
    message: WorldMessage,
    sender: Party.Connection,
    players: ReadonlyMap<string, PlayerRecord>,
    npcs: readonly NpcRecord[] = [],
  ) {
    const player = players.get(sender.id);
    if (!player) return true;

    if (message.type === "media-set") {
      const now = Date.now();
      if (now - (this.lastMediaAction.get(sender.id) ?? 0) < 1_000) return true;
      this.lastMediaAction.set(sender.id, now);
      if (distanceSq(player, MUSIC_POSITION) > MUSIC_START_RADIUS * MUSIC_START_RADIUS) {
        this.error(sender.id, "media", "Aproxime-se da caixa de som para iniciar uma música.");
        return true;
      }
      const resolved = resolveProvider(message.url);
      if (!resolved) {
        this.error(sender.id, "media", "Use um link HTTPS público do YouTube ou Spotify.");
        return true;
      }
      this.media = {
        url: resolved.url,
        provider: resolved.provider,
        startedBy: sender.id,
        startedByNick: player.nick,
        playing: true,
        paused: false,
        volume: this.media.volume,
        position: 0,
        startedAt: now,
        updatedAt: now,
      };
      this.broadcastMedia();
      return true;
    }

    if (message.type === "media-control") {
      const now = Date.now();
      if (now - (this.lastMediaAction.get(sender.id) ?? 0) < 240) return true;
      this.lastMediaAction.set(sender.id, now);
      if (!this.media.url) return true;
      if (this.media.startedBy && this.media.startedBy !== sender.id && players.has(this.media.startedBy)) {
        this.error(sender.id, "media", "Somente quem iniciou a música pode controlá-la agora.");
        return true;
      }

      if (message.action === "stop") {
        this.media = {
          ...this.media,
          url: null,
          provider: null,
          playing: false,
          paused: false,
          position: 0,
          startedAt: now,
          updatedAt: now,
        };
      } else if (message.action === "pause" && this.media.playing && !this.media.paused) {
        this.media.position = this.currentMediaPosition(now);
        this.media.paused = true;
        this.media.startedAt = now;
        this.media.updatedAt = now;
      } else if (message.action === "resume" && this.media.playing && this.media.paused) {
        this.media.paused = false;
        this.media.startedAt = now;
        this.media.updatedAt = now;
      } else if (message.action === "volume" && typeof message.volume === "number") {
        this.media.volume = Math.max(0, Math.min(1, message.volume));
        this.media.updatedAt = now;
      }
      this.broadcastMedia();
      return true;
    }

    if (message.type === "item-pickup") {
      const now = Date.now();
      const cooldownKey = `${sender.id}:pickup:${message.itemId}`;
      if (now - (this.lastItemAction.get(cooldownKey) ?? 0) < 700) return true;
      this.lastItemAction.set(cooldownKey, now);

      if (message.itemId === "bat") {
        if (this.batOwnerId && this.batOwnerId !== sender.id) {
          this.error(sender.id, "item", "O taco já foi encontrado por outro jogador.");
          return true;
        }
        if (
          distanceSq(player, BAT_POSITION) > BAT_PICKUP_RADIUS * BAT_PICKUP_RADIUS ||
          Math.abs(player.floorY + player.jumpY - 3.6) > 1.4
        ) return true;
        this.batOwnerId = sender.id;
      } else if (message.itemId === "umbrella") {
        if (distanceSq(player, UMBRELLA_POSITION) > UMBRELLA_PICKUP_RADIUS * UMBRELLA_PICKUP_RADIUS) return true;
        this.umbrellaOwners.add(sender.id);
      } else {
        // A bola do Biriba só é concedida pelo resultado validado do duelo.
        return true;
      }
      this.broadcastItems();
      return true;
    }

    if (message.type === "item-use") {
      const sequenceKey = `${sender.id}:${message.itemId}`;
      const previousSequence = this.lastItemSequence.get(sequenceKey) ?? -1;
      if (message.sequence <= previousSequence) return true;
      this.lastItemSequence.set(sequenceKey, message.sequence);
      const now = Date.now();

      if (message.itemId === "umbrella") {
        if (!this.umbrellaOwners.has(sender.id)) return true;
        const actionKey = `${sender.id}:umbrella`;
        if (now - (this.lastItemAction.get(actionKey) ?? 0) < 350) return true;
        this.lastItemAction.set(actionKey, now);
        const open = !this.openUmbrellas.has(sender.id);
        if (open) this.openUmbrellas.add(sender.id);
        else this.openUmbrellas.delete(sender.id);
        this.room.broadcast(JSON.stringify({
          type: "item-action",
          playerId: sender.id,
          itemId: "umbrella",
          action: open ? "open" : "close",
        }));
        this.broadcastItems();
        return true;
      }

      if (message.itemId === "biriba-ball") {
        if (!this.biribaBallOwners.has(sender.id)) return true;
        const actionKey = `${sender.id}:biriba-ball`;
        if (now - (this.lastItemAction.get(actionKey) ?? 0) < BIRIBA_BALL_COOLDOWN_MS) return true;
        const target = findTarget(message.targetId, players, npcs);
        if (!target || target.id === sender.id) return true;
        if (distanceSq(player, target) > BIRIBA_BALL_RANGE * BIRIBA_BALL_RANGE) return true;
        if (Math.abs(player.floorY + player.jumpY - targetHeight(target)) > 2.8) return true;
        const toTargetX = target.x - player.x;
        const toTargetZ = target.z - player.z;
        const distance = Math.max(0.001, Math.hypot(toTargetX, toTargetZ));
        const dx = toTargetX / distance;
        const dz = toTargetZ / distance;
        const facingX = -Math.sin(player.ry);
        const facingZ = -Math.cos(player.ry);
        if (dx * facingX + dz * facingZ < 0.08) return true;
        this.lastItemAction.set(actionKey, now);
        const originX = player.x + dx * 0.85;
        const originZ = player.z + dz * 0.85;
        this.room.broadcast(JSON.stringify({
          type: "item-action",
          playerId: sender.id,
          itemId: "biriba-ball",
          action: "throw",
          targetId: target.id,
          x: originX,
          z: originZ,
          dx,
          dz,
        }));

        const targetX = target.x;
        const targetZ = target.z;
        const travelMs = Math.max(80, Math.min(1_450, (distance / BIRIBA_BALL_SPEED) * 1_000));
        setTimeout(() => {
          const currentTarget = findTarget(target.id, players, npcs);
          if (!currentTarget) return;
          if (Math.hypot(currentTarget.x - targetX, currentTarget.z - targetZ) > 1.45) return;
          const hitAt = Date.now();
          if ((this.ragdollImmuneUntil.get(target.id) ?? 0) > hitAt) return;
          this.ragdollImmuneUntil.set(target.id, hitAt + RAGDOLL_IMMUNITY_MS);
          this.room.broadcast(JSON.stringify({
            type: "ragdoll",
            sourceId: sender.id,
            targetId: target.id,
            duration: 1.25,
          }));
        }, travelMs);
        return true;
      }

      if (this.batOwnerId !== sender.id) return true;
      const actionKey = `${sender.id}:bat`;
      if (now - (this.lastItemAction.get(actionKey) ?? 0) < BAT_COOLDOWN_MS) return true;
      this.lastItemAction.set(actionKey, now);
      this.room.broadcast(JSON.stringify({
        type: "item-action",
        playerId: sender.id,
        itemId: "bat",
        action: "swing",
      }));

      const targetId = message.targetId;
      const target = findTarget(targetId, players, npcs);
      if (!target || target.id === sender.id) return true;
      if (distanceSq(player, target) > BAT_HIT_RADIUS * BAT_HIT_RADIUS) return true;
      if (Math.abs(player.floorY + player.jumpY - targetHeight(target)) > 2.35) return true;
      const toTargetX = target.x - player.x;
      const toTargetZ = target.z - player.z;
      const distance = Math.max(0.001, Math.hypot(toTargetX, toTargetZ));
      const facingX = -Math.sin(player.ry);
      const facingZ = -Math.cos(player.ry);
      if ((toTargetX * facingX + toTargetZ * facingZ) / distance < 0.12) return true;
      if ((this.ragdollImmuneUntil.get(target.id) ?? 0) > now) return true;
      this.ragdollImmuneUntil.set(target.id, now + RAGDOLL_IMMUNITY_MS);
      this.room.broadcast(JSON.stringify({
        type: "ragdoll",
        sourceId: sender.id,
        targetId: target.id,
        duration: 1.65,
      }));
      return true;
    }

    return false;
  }

  disconnect(playerId: string) {
    let itemChanged = false;
    if (this.batOwnerId === playerId) {
      this.batOwnerId = null;
      itemChanged = true;
    }
    if (this.umbrellaOwners.delete(playerId)) itemChanged = true;
    if (this.openUmbrellas.delete(playerId)) itemChanged = true;
    if (this.biribaBallOwners.delete(playerId)) itemChanged = true;
    this.lastMediaAction.delete(playerId);
    this.ragdollImmuneUntil.delete(playerId);
    for (const key of [...this.lastItemAction.keys()]) {
      if (key.startsWith(`${playerId}:`)) this.lastItemAction.delete(key);
    }
    for (const key of [...this.lastItemSequence.keys()]) {
      if (key.startsWith(`${playerId}:`)) this.lastItemSequence.delete(key);
    }
    if (itemChanged) this.broadcastItems();
  }
}
