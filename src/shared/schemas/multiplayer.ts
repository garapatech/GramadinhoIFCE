import { z } from "zod";
import { avatarSchema } from "@/shared/schemas/avatar";

export const playerActivitySchema = z.enum([
  "idle",
  "walking",
  "running",
  "crouching",
  "sitting",
  "riding",
  "emoting",
]);

export const sharedEntityKindSchema = z.enum(["bike"]);

export const playerSnapshotSchema = z
  .object({
    id: z.string().min(1).max(128),
    nick: z.string().min(1).max(16),
    avatar: avatarSchema,
    x: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    activity: playerActivitySchema,
    jumpY: z.number().finite(),
    voiceEnabled: z.boolean(),
    voiceMuted: z.boolean(),
  })
  .strict();

export const sharedEntityStateSchema = z
  .object({
    id: z.string().min(1).max(96),
    kind: sharedEntityKindSchema,
    x: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    mountedBy: z.string().min(1).max(128).nullable(),
  })
  .strict();

export const npcAnimSchema = z.enum([
  "idle",
  "walk",
  "run",
  "sit",
  "dance",
  "celebrate",
]);

export const npcStateSchema = z
  .object({
    id: z.string().min(1).max(96),
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    anim: npcAnimSchema,
  })
  .strict();

export const chatMessageSchema = z
  .object({
    id: z.string().min(1).max(128),
    nick: z.string().min(1).max(16),
    text: z.string().min(1).max(240),
    ts: z.number().finite(),
  })
  .strict();

const rtcSessionDescriptionSchema = z
  .object({
    type: z.enum(["offer", "answer"]),
    sdp: z.string().min(1).max(30_000),
  })
  .strict();

const rtcIceCandidateSchema = z
  .object({
    candidate: z.string().min(1).max(8_000),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().int().nullable().optional(),
    usernameFragment: z.string().optional(),
  })
  .strict();

export const voiceSignalSchema = z
  .object({
    description: rtcSessionDescriptionSchema.optional(),
    candidate: rtcIceCandidateSchema.optional(),
  })
  .strict()
  .refine((value) => value.description || value.candidate, {
    message: "voice signal needs a description or candidate",
  });

export const pvpMatchIdSchema = z.string().min(1).max(64);

export const spectatorSpawnSchema = z
  .object({
    seed: z.string().min(1).max(96),
    spawnIndex: z.number().int().nonnegative(),
    expiresAt: z.number().finite(),
  })
  .strict();

export const socketOutboundJoinSchema = z
  .object({
    type: z.literal("join"),
    nick: z.string().min(1).max(16),
    avatar: avatarSchema,
    x: z.number().finite().optional(),
    z: z.number().finite().optional(),
    ry: z.number().finite().optional(),
  })
  .strict();

export const socketOutboundStateSchema = z
  .object({
    type: z.literal("state"),
    x: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    activity: playerActivitySchema,
    jumpY: z.number().finite(),
  })
  .strict();

export const socketOutboundEntityStateSchema = z
  .object({
    type: z.literal("entity-state"),
    id: z.string().min(1).max(96),
    kind: sharedEntityKindSchema,
    x: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    mounted: z.boolean().optional(),
  })
  .strict();

export const socketOutboundNpcStateSchema = z
  .object({
    type: z.literal("npc-state"),
    npcs: z.array(npcStateSchema).max(32),
  })
  .strict();

export const socketOutboundChatSchema = z
  .object({
    type: z.literal("chat"),
    text: z.string().min(1).max(240),
  })
  .strict();

export const socketOutboundEmoteSchema = z
  .object({
    type: z.literal("emote"),
    kind: z.string().min(1).max(20),
    duration: z.number().finite().optional(),
  })
  .strict();

export const socketOutboundReactionSchema = z
  .object({
    type: z.literal("reaction"),
    targetKey: z.string().min(1).max(96),
    kind: z.string().min(1).max(20).default("like"),
  })
  .strict();

export const socketOutboundVoiceReadySchema = z
  .object({
    type: z.literal("voice-ready"),
    enabled: z.boolean(),
    muted: z.boolean(),
  })
  .strict();

export const socketOutboundPvpChallengeSchema = z
  .object({
    type: z.literal("pvp-challenge"),
    to: z.string().min(1).max(128),
  })
  .strict();

export const socketOutboundPvpRespondSchema = z
  .object({
    type: z.literal("pvp-respond"),
    matchId: pvpMatchIdSchema,
    accepted: z.boolean(),
  })
  .strict();

export const socketOutboundPvpThrowSchema = z
  .object({
    type: z.literal("pvp-throw"),
    matchId: pvpMatchIdSchema,
    dx: z.number().finite(),
    dz: z.number().finite(),
    x: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();

export const socketOutboundPvpHitSchema = z
  .object({
    type: z.literal("pvp-hit"),
    matchId: pvpMatchIdSchema,
    victim: z.string().min(1).max(128),
  })
  .strict();

export const socketOutboundPvpQuitSchema = z
  .object({
    type: z.literal("pvp-quit"),
    matchId: pvpMatchIdSchema,
  })
  .strict();

export const socketOutboundEspectroConsumedSchema = z
  .object({
    type: z.literal("espectro-consumed"),
    seed: z.string().min(1).max(96),
  })
  .strict();

export const socketOutboundVoiceSignalSchema = z
  .object({
    type: z.literal("voice-signal"),
    target: z.string().min(1).max(128),
    signal: voiceSignalSchema,
  })
  .strict();

export const socketOutboundMessageSchema = z.discriminatedUnion("type", [
  socketOutboundJoinSchema,
  socketOutboundStateSchema,
  socketOutboundEntityStateSchema,
  socketOutboundNpcStateSchema,
  socketOutboundChatSchema,
  socketOutboundEmoteSchema,
  socketOutboundReactionSchema,
  socketOutboundVoiceReadySchema,
  socketOutboundPvpChallengeSchema,
  socketOutboundPvpRespondSchema,
  socketOutboundPvpThrowSchema,
  socketOutboundPvpHitSchema,
  socketOutboundPvpQuitSchema,
  socketOutboundEspectroConsumedSchema,
  socketOutboundVoiceSignalSchema,
]);

const socketPlayerStateSchema = playerSnapshotSchema;

const socketInitMessageSchema = z
  .object({
    type: z.literal("init"),
    you: z.string().min(1).max(128),
    players: z.array(socketPlayerStateSchema),
    entities: z.array(sharedEntityStateSchema),
    npcAuthority: z.string().min(1).max(128).nullable(),
    npcs: z.array(npcStateSchema),
    history: z.array(chatMessageSchema),
    espectro: spectatorSpawnSchema.nullable(),
    serverNow: z.number().finite(),
  })
  .strict();

const socketClockMessageSchema = z
  .object({
    type: z.literal("clock"),
    serverNow: z.number().finite(),
  })
  .strict();

const socketJoinMessageSchema = z
  .object({
    type: z.literal("join"),
    player: socketPlayerStateSchema,
  })
  .strict();

const socketStateMessageSchema = z
  .object({
    type: z.literal("state"),
    id: z.string().min(1).max(128),
    x: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    activity: playerActivitySchema,
    jumpY: z.number().finite(),
  })
  .strict();

const socketEntityStateMessageSchema = z
  .object({
    type: z.literal("entity-state"),
    id: z.string().min(1).max(96),
    kind: sharedEntityKindSchema,
    x: z.number().finite(),
    z: z.number().finite(),
    ry: z.number().finite(),
    speed: z.number().finite(),
    mountedBy: z.string().min(1).max(128).nullable(),
  })
  .strict();

const socketNpcAuthorityMessageSchema = z
  .object({
    type: z.literal("npc-authority"),
    id: z.string().min(1).max(128).nullable(),
  })
  .strict();

const socketNpcStateMessageSchema = z
  .object({
    type: z.literal("npc-state"),
    npcs: z.array(npcStateSchema),
  })
  .strict();

const socketLeaveMessageSchema = z
  .object({
    type: z.literal("leave"),
    id: z.string().min(1).max(128),
  })
  .strict();

const socketEmoteMessageSchema = z
  .object({
    type: z.literal("emote"),
    id: z.string().min(1).max(128),
    kind: z.string().min(1).max(20),
    duration: z.number().finite(),
  })
  .strict();

const socketVoiceReadyMessageSchema = z
  .object({
    type: z.literal("voice-ready"),
    id: z.string().min(1).max(128),
    nick: z.string().min(1).max(16),
    enabled: z.boolean(),
    muted: z.boolean(),
  })
  .strict();

const socketVoiceSignalMessageSchema = z
  .object({
    type: z.literal("voice-signal"),
    from: z.string().min(1).max(128),
    target: z.string().min(1).max(128),
    signal: voiceSignalSchema,
  })
  .strict();

const socketChatMessageSchema = chatMessageSchema.extend({
  type: z.literal("chat"),
});

const socketPvpChallengeMessageSchema = z
  .object({
    type: z.literal("pvp-challenge"),
    matchId: pvpMatchIdSchema,
    from: z.string().min(1).max(128),
    fromNick: z.string().min(1).max(16),
  })
  .strict();

const socketPvpStartMessageSchema = z
  .object({
    type: z.literal("pvp-start"),
    matchId: pvpMatchIdSchema,
    playerA: z.string().min(1).max(128),
    playerB: z.string().min(1).max(128),
    nickA: z.string().min(1).max(16),
    nickB: z.string().min(1).max(16),
  })
  .strict();

const socketPvpDeclinedMessageSchema = z
  .object({
    type: z.literal("pvp-declined"),
    matchId: pvpMatchIdSchema,
    opponentNick: z.string().min(1).max(16),
  })
  .strict();

const socketPvpCancelledMessageSchema = z
  .object({
    type: z.literal("pvp-cancelled"),
    matchId: pvpMatchIdSchema,
  })
  .strict();

const socketPvpThrowMessageSchema = z
  .object({
    type: z.literal("pvp-throw"),
    matchId: pvpMatchIdSchema,
    from: z.string().min(1).max(128),
    dx: z.number().finite(),
    dz: z.number().finite(),
    x: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();

const socketPvpHitMessageSchema = z
  .object({
    type: z.literal("pvp-hit"),
    matchId: pvpMatchIdSchema,
    victim: z.string().min(1).max(128),
    hitsOnA: z.number().int().nonnegative(),
    hitsOnB: z.number().int().nonnegative(),
  })
  .strict();

const socketPvpEndMessageSchema = z
  .object({
    type: z.literal("pvp-end"),
    matchId: pvpMatchIdSchema,
    winner: z.string().min(1).max(128),
    loser: z.string().min(1).max(128),
    winnerNick: z.string().min(1).max(16),
    loserNick: z.string().min(1).max(16),
    hitsOnA: z.number().int().nonnegative(),
    hitsOnB: z.number().int().nonnegative(),
    forfeit: z.boolean().optional(),
  })
  .strict();

const socketEspectroSpawnMessageSchema = z
  .object({
    type: z.literal("espectro-spawn"),
    espectro: spectatorSpawnSchema,
  })
  .strict();

const socketEspectroDespawnMessageSchema = z
  .object({
    type: z.literal("espectro-despawn"),
  })
  .strict();

const socketReactionMessageSchema = z
  .object({
    type: z.literal("reaction"),
    id: z.string().min(1).max(128),
    targetKey: z.string().min(1).max(96),
    targetId: z.string().min(1).max(128),
    kind: z.string().min(1).max(20),
  })
  .strict();

export const socketInboundMessageSchema = z.discriminatedUnion("type", [
  socketInitMessageSchema,
  socketClockMessageSchema,
  socketJoinMessageSchema,
  socketStateMessageSchema,
  socketEntityStateMessageSchema,
  socketNpcAuthorityMessageSchema,
  socketNpcStateMessageSchema,
  socketLeaveMessageSchema,
  socketEmoteMessageSchema,
  socketVoiceReadyMessageSchema,
  socketVoiceSignalMessageSchema,
  socketChatMessageSchema,
  socketPvpChallengeMessageSchema,
  socketPvpStartMessageSchema,
  socketPvpDeclinedMessageSchema,
  socketPvpCancelledMessageSchema,
  socketPvpThrowMessageSchema,
  socketPvpHitMessageSchema,
  socketPvpEndMessageSchema,
  socketEspectroSpawnMessageSchema,
  socketEspectroDespawnMessageSchema,
  socketReactionMessageSchema,
]);

export const socketConnectionEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connected") }).strict(),
  z.object({ type: z.literal("disconnected") }).strict(),
  z.object({ type: z.literal("error") }).strict(),
]);

export const multiplayerEventSchema = z.union([
  socketConnectionEventSchema,
  socketInboundMessageSchema,
]);

export type PlayerActivity = z.infer<typeof playerActivitySchema>;
export type PlayerSnapshot = z.infer<typeof playerSnapshotSchema>;
export type SharedEntityState = z.infer<typeof sharedEntityStateSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type VoiceSignal = z.infer<typeof voiceSignalSchema>;
export type SocketOutboundMessage = z.infer<typeof socketOutboundMessageSchema>;
export type SocketInboundMessage = z.infer<typeof socketInboundMessageSchema>;
export type MultiplayerEvent = z.infer<typeof multiplayerEventSchema>;

export function parseInboundSocketMessage(raw: unknown): SocketInboundMessage | null {
  const parsed = socketInboundMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseOutboundSocketMessage(raw: unknown): SocketOutboundMessage | null {
  const parsed = socketOutboundMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function serializeOutboundSocketMessage(
  message: SocketOutboundMessage
): string | null {
  const parsed = socketOutboundMessageSchema.safeParse(message);
  return parsed.success ? JSON.stringify(parsed.data) : null;
}
