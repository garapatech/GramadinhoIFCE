import { z } from "zod";
import { avatarSchema } from "@/shared/schemas/avatar";

export const playerActivitySchema = z.enum([
  "idle",
  "walking",
  "running",
  "crouching",
  "sitting",
  "riding",
  "swimming",
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
    floorY: z.number().finite().min(0).max(64).default(0),
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
    mode: z.enum(["foot", "bike"]).default("foot"),
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
    floorY: z.number().finite().min(0).max(64).default(0),
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
    outcome: z.enum(["lost", "won"]).default("lost"),
  })
  .strict();

export const socketOutboundEspectroDuelStartSchema = z
  .object({
    type: z.literal("espectro-duel-start"),
    seed: z.string().min(1).max(96),
  })
  .strict();

export const socketOutboundEspectroDuelHitSchema = z
  .object({
    type: z.literal("espectro-duel-hit"),
    seed: z.string().min(1).max(96),
    sequence: z.number().int().positive().max(32),
  })
  .strict();

export const socketOutboundVoiceSignalSchema = z
  .object({
    type: z.literal("voice-signal"),
    target: z.string().min(1).max(128),
    signal: voiceSignalSchema,
  })
  .strict();

// ---- Rádio global ----
export const globalMediaStateSchema = z
  .object({
    url: z.string().max(2048).nullable(),
    provider: z.enum(["youtube", "spotify"]).nullable(),
    startedBy: z.string().min(1).max(128).nullable(),
    startedByNick: z.string().max(16),
    playing: z.boolean(),
    paused: z.boolean(),
    volume: z.number().finite().min(0).max(1),
    position: z.number().finite().nonnegative(),
    startedAt: z.number().finite(),
    updatedAt: z.number().finite(),
  })
  .strict();

export const socketOutboundMediaSetSchema = z
  .object({
    type: z.literal("media-set"),
    url: z.string().trim().min(1).max(2048),
  })
  .strict();

export const socketOutboundMediaControlSchema = z
  .object({
    type: z.literal("media-control"),
    action: z.enum(["pause", "resume", "stop", "volume"]),
    volume: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

// ---- Itens compartilhados ----
export const usableItemIdSchema = z.enum(["bat", "umbrella", "biriba-ball"]);

export const worldItemStateSchema = z
  .object({
    batOwnerId: z.string().min(1).max(128).nullable(),
    umbrellaOwners: z.array(z.string().min(1).max(128)).max(64),
    openUmbrellas: z.array(z.string().min(1).max(128)).max(64),
    biribaBallOwners: z.array(z.string().min(1).max(128)).max(64),
  })
  .strict();

export const socketOutboundItemPickupSchema = z
  .object({
    type: z.literal("item-pickup"),
    itemId: usableItemIdSchema,
  })
  .strict();

export const socketOutboundItemUseSchema = z
  .object({
    type: z.literal("item-use"),
    itemId: usableItemIdSchema,
    targetId: z.string().min(1).max(128).optional(),
    sequence: z.number().int().nonnegative().max(1_000_000_000),
  })
  .strict();

// ---- Duelo de natação ----
export const swimScoreSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    nick: z.string().min(1).max(16),
    strokes: z.number().int().nonnegative(),
    progress: z.number().finite().min(0).max(1),
  })
  .strict();

export const socketOutboundSwimChallengeSchema = z
  .object({
    type: z.literal("swim-challenge"),
    to: z.string().min(1).max(128),
  })
  .strict();

export const socketOutboundSwimRespondSchema = z
  .object({
    type: z.literal("swim-respond"),
    matchId: pvpMatchIdSchema,
    accepted: z.boolean(),
  })
  .strict();

export const socketOutboundSwimStrokeSchema = z
  .object({
    type: z.literal("swim-stroke"),
    matchId: pvpMatchIdSchema,
    sequence: z.number().int().nonnegative().max(1_000_000_000),
  })
  .strict();

export const socketOutboundSwimQuitSchema = z
  .object({
    type: z.literal("swim-quit"),
    matchId: pvpMatchIdSchema,
  })
  .strict();

// ---- Minigame de digitação ----
export const typingModeSchema = z.enum(["solo", "duel", "room"]);
export const typingResultSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    nick: z.string().min(1).max(16),
    progress: z.number().finite().min(0).max(1),
    timeMs: z.number().int().nonnegative().nullable(),
    accuracy: z.number().finite().min(0).max(100),
    errors: z.number().int().nonnegative(),
    wpm: z.number().finite().nonnegative(),
    cpm: z.number().finite().nonnegative(),
    rank: z.number().int().positive().nullable(),
    finished: z.boolean(),
  })
  .strict();

export const typingRoomSummarySchema = z
  .object({
    roomId: z.string().min(1).max(64),
    hostId: z.string().min(1).max(128),
    hostNick: z.string().min(1).max(16),
    participantCount: z.number().int().min(1).max(8),
    open: z.boolean(),
  })
  .strict();

export const socketOutboundTypingSoloSchema = z
  .object({
    type: z.literal("typing-solo"),
    computerId: z.string().min(1).max(48),
  })
  .strict();

export const socketOutboundTypingChallengeSchema = z
  .object({
    type: z.literal("typing-challenge"),
    to: z.string().min(1).max(128),
    computerId: z.string().min(1).max(48),
  })
  .strict();

export const socketOutboundTypingRespondSchema = z
  .object({
    type: z.literal("typing-respond"),
    matchId: pvpMatchIdSchema,
    accepted: z.boolean(),
  })
  .strict();

export const socketOutboundTypingRoomCreateSchema = z
  .object({
    type: z.literal("typing-room-create"),
    computerId: z.string().min(1).max(48),
  })
  .strict();

export const socketOutboundTypingRoomJoinSchema = z
  .object({
    type: z.literal("typing-room-join"),
    roomId: z.string().min(1).max(64),
  })
  .strict();

export const socketOutboundTypingRoomLeaveSchema = z
  .object({
    type: z.literal("typing-room-leave"),
    roomId: z.string().min(1).max(64),
  })
  .strict();

export const socketOutboundTypingRoomStartSchema = z
  .object({
    type: z.literal("typing-room-start"),
    roomId: z.string().min(1).max(64),
  })
  .strict();

export const socketOutboundTypingInputSchema = z
  .object({
    type: z.literal("typing-input"),
    matchId: pvpMatchIdSchema,
    typed: z.string().max(360),
    sequence: z.number().int().nonnegative().max(1_000_000_000),
  })
  .strict();

export const socketOutboundTypingQuitSchema = z
  .object({
    type: z.literal("typing-quit"),
    matchId: pvpMatchIdSchema,
  })
  .strict();

// ---- Pôquer ----
export const pokerSuitSchema = z.enum(["S", "H", "D", "C"]);
export const pokerCardSchema = z
  .object({
    rank: z.number().int().min(2).max(14),
    suit: pokerSuitSchema,
  })
  .strict();

export const pokerPhaseSchema = z.enum([
  "waiting",
  "preflop",
  "flop",
  "turn",
  "river",
  "showdown",
]);

export const pokerActionKindSchema = z.enum([
  "fold",
  "check",
  "call",
  "raise",
  "allin",
]);

export const pokerSeatPublicSchema = z
  .object({
    index: z.number().int().min(0).max(15),
    playerId: z.string().min(1).max(128).nullable(),
    nick: z.string().max(16),
    chips: z.number().int().nonnegative(),
    inHand: z.boolean(),
    folded: z.boolean(),
    allIn: z.boolean(),
    betThisRound: z.number().int().nonnegative(),
    totalBetInHand: z.number().int().nonnegative(),
    hasActedThisRound: z.boolean(),
    showCards: z.array(pokerCardSchema).nullable(),
  })
  .strict();

export const pokerWinnerSummarySchema = z
  .object({
    seatIndex: z.number().int().min(0).max(15),
    nick: z.string().max(16),
    amount: z.number().int().nonnegative(),
    handName: z.string().max(40),
    cards: z.array(pokerCardSchema),
  })
  .strict();

export const pokerPublicStateSchema = z
  .object({
    phase: pokerPhaseSchema,
    seats: z.array(pokerSeatPublicSchema),
    pot: z.number().int().nonnegative(),
    community: z.array(pokerCardSchema),
    currentBet: z.number().int().nonnegative(),
    minRaise: z.number().int().nonnegative(),
    toActIndex: z.number().int().min(0).max(15).nullable(),
    dealerIndex: z.number().int().min(0).max(15).nullable(),
    smallBlindIndex: z.number().int().min(0).max(15).nullable(),
    bigBlindIndex: z.number().int().min(0).max(15).nullable(),
    smallBlind: z.number().int().nonnegative(),
    bigBlind: z.number().int().nonnegative(),
    lastWinners: z.array(pokerWinnerSummarySchema),
    log: z.array(z.string().max(120)),
  })
  .strict();

export const socketOutboundPokerSitSchema = z
  .object({
    type: z.literal("poker-sit"),
    seatIndex: z.number().int().min(0).max(15),
  })
  .strict();

export const socketOutboundPokerStandSchema = z
  .object({ type: z.literal("poker-stand") })
  .strict();

export const socketOutboundPokerActionSchema = z
  .object({
    type: z.literal("poker-action"),
    action: pokerActionKindSchema,
    amount: z.number().int().nonnegative().optional(),
  })
  .strict();

export const socketOutboundPokerStartSchema = z
  .object({ type: z.literal("poker-start") })
  .strict();

// ---- Xadrez ----
export const chessColorSchema = z.enum(["w", "b"]);
export const chessPieceKindSchema = z.enum(["P", "N", "B", "R", "Q", "K"]);
export const chessPieceSchema = z
  .object({ color: chessColorSchema, kind: chessPieceKindSchema })
  .strict();
export const chessSquareSchema = z
  .object({
    file: z.number().int().min(0).max(7),
    rank: z.number().int().min(0).max(7),
  })
  .strict();
export const chessPhaseSchema = z.enum(["waiting", "playing", "ended"]);
export const chessSeatPublicSchema = z
  .object({
    color: chessColorSchema,
    playerId: z.string().min(1).max(128).nullable(),
    nick: z.string().max(16),
  })
  .strict();
export const chessMoveRecordSchema = z
  .object({
    piece: chessPieceKindSchema,
    from: chessSquareSchema,
    to: chessSquareSchema,
    captured: chessPieceKindSchema.nullable(),
    promoted: chessPieceKindSchema.nullable(),
    san: z.string().max(20),
  })
  .strict();
export const chessPublicStateSchema = z
  .object({
    phase: chessPhaseSchema,
    seats: z.array(chessSeatPublicSchema).length(2),
    board: z.array(z.array(chessPieceSchema.nullable()).length(8)).length(8),
    turn: chessColorSchema,
    moves: z.array(chessMoveRecordSchema),
    capturedByWhite: z.array(chessPieceKindSchema),
    capturedByBlack: z.array(chessPieceKindSchema),
    inCheck: chessColorSchema.nullable(),
    result: z.enum(["white", "black", "draw"]).nullable(),
    resultReason: z.string().max(40).nullable(),
    log: z.array(z.string().max(120)),
  })
  .strict();

export const socketOutboundChessSitSchema = z
  .object({
    type: z.literal("chess-sit"),
    color: chessColorSchema,
  })
  .strict();

export const socketOutboundChessStandSchema = z
  .object({ type: z.literal("chess-stand") })
  .strict();

export const socketOutboundChessMoveSchema = z
  .object({
    type: z.literal("chess-move"),
    from: chessSquareSchema,
    to: chessSquareSchema,
  })
  .strict();

export const socketOutboundChessResetSchema = z
  .object({ type: z.literal("chess-reset") })
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
  socketOutboundEspectroDuelStartSchema,
  socketOutboundEspectroDuelHitSchema,
  socketOutboundVoiceSignalSchema,
  socketOutboundMediaSetSchema,
  socketOutboundMediaControlSchema,
  socketOutboundItemPickupSchema,
  socketOutboundItemUseSchema,
  socketOutboundSwimChallengeSchema,
  socketOutboundSwimRespondSchema,
  socketOutboundSwimStrokeSchema,
  socketOutboundSwimQuitSchema,
  socketOutboundTypingSoloSchema,
  socketOutboundTypingChallengeSchema,
  socketOutboundTypingRespondSchema,
  socketOutboundTypingRoomCreateSchema,
  socketOutboundTypingRoomJoinSchema,
  socketOutboundTypingRoomLeaveSchema,
  socketOutboundTypingRoomStartSchema,
  socketOutboundTypingInputSchema,
  socketOutboundTypingQuitSchema,
  socketOutboundPokerSitSchema,
  socketOutboundPokerStandSchema,
  socketOutboundPokerActionSchema,
  socketOutboundPokerStartSchema,
  socketOutboundChessSitSchema,
  socketOutboundChessStandSchema,
  socketOutboundChessMoveSchema,
  socketOutboundChessResetSchema,
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
    media: globalMediaStateSchema,
    items: worldItemStateSchema,
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
    floorY: z.number().finite().min(0).max(64).default(0),
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
    reason: z.string().min(1).max(160).optional(),
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

const socketMediaStateMessageSchema = z
  .object({
    type: z.literal("media-state"),
    state: globalMediaStateSchema,
  })
  .strict();

const socketItemStateMessageSchema = z
  .object({
    type: z.literal("item-state"),
    state: worldItemStateSchema,
  })
  .strict();

const socketItemActionMessageSchema = z
  .object({
    type: z.literal("item-action"),
    playerId: z.string().min(1).max(128),
    itemId: usableItemIdSchema,
    action: z.enum(["swing", "open", "close", "throw"]),
    targetId: z.string().min(1).max(128).optional(),
    x: z.number().finite().optional(),
    z: z.number().finite().optional(),
    dx: z.number().finite().optional(),
    dz: z.number().finite().optional(),
  })
  .strict();

const socketRagdollMessageSchema = z
  .object({
    type: z.literal("ragdoll"),
    sourceId: z.string().min(1).max(128),
    targetId: z.string().min(1).max(128),
    duration: z.number().finite().min(0.2).max(4),
  })
  .strict();

const socketSwimChallengeMessageSchema = z
  .object({
    type: z.literal("swim-challenge"),
    matchId: pvpMatchIdSchema,
    from: z.string().min(1).max(128),
    fromNick: z.string().min(1).max(16),
  })
  .strict();

const socketSwimStartMessageSchema = z
  .object({
    type: z.literal("swim-start"),
    matchId: pvpMatchIdSchema,
    playerA: z.string().min(1).max(128),
    playerB: z.string().min(1).max(128),
    nickA: z.string().min(1).max(16),
    nickB: z.string().min(1).max(16),
    startAt: z.number().finite(),
    endAt: z.number().finite(),
  })
  .strict();

const socketSwimProgressMessageSchema = z
  .object({
    type: z.literal("swim-progress"),
    matchId: pvpMatchIdSchema,
    scores: z.array(swimScoreSchema).length(2),
    serverNow: z.number().finite(),
  })
  .strict();

const socketSwimEndMessageSchema = z
  .object({
    type: z.literal("swim-end"),
    matchId: pvpMatchIdSchema,
    scores: z.array(swimScoreSchema).length(2),
    winnerId: z.string().min(1).max(128).nullable(),
    tie: z.boolean(),
    reason: z.enum(["timeout", "forfeit", "cancelled"]),
  })
  .strict();

const socketSwimDeclinedMessageSchema = z
  .object({
    type: z.literal("swim-declined"),
    matchId: pvpMatchIdSchema,
    opponentNick: z.string().min(1).max(16),
  })
  .strict();

const socketSwimCancelledMessageSchema = z
  .object({
    type: z.literal("swim-cancelled"),
    matchId: pvpMatchIdSchema,
    reason: z.string().max(120),
  })
  .strict();

const socketTypingChallengeMessageSchema = z
  .object({
    type: z.literal("typing-challenge"),
    matchId: pvpMatchIdSchema,
    from: z.string().min(1).max(128),
    fromNick: z.string().min(1).max(16),
  })
  .strict();

const socketTypingRoomStateMessageSchema = z
  .object({
    type: z.literal("typing-room-state"),
    roomId: z.string().min(1).max(64),
    hostId: z.string().min(1).max(128),
    hostNick: z.string().min(1).max(16),
    participants: z.array(z.object({
      playerId: z.string().min(1).max(128),
      nick: z.string().min(1).max(16),
    }).strict()).min(1).max(8),
    open: z.boolean(),
  })
  .strict();

const socketTypingLobbyMessageSchema = z
  .object({
    type: z.literal("typing-lobby"),
    rooms: z.array(typingRoomSummarySchema).max(32),
  })
  .strict();

const socketTypingStartMessageSchema = z
  .object({
    type: z.literal("typing-start"),
    matchId: pvpMatchIdSchema,
    mode: typingModeSchema,
    text: z.string().min(1).max(320),
    startAt: z.number().finite(),
    deadlineAt: z.number().finite(),
    participants: z.array(z.object({
      playerId: z.string().min(1).max(128),
      nick: z.string().min(1).max(16),
    }).strict()).min(1).max(8),
  })
  .strict();

const socketTypingProgressMessageSchema = z
  .object({
    type: z.literal("typing-progress"),
    matchId: pvpMatchIdSchema,
    results: z.array(typingResultSchema).min(1).max(8),
    serverNow: z.number().finite(),
  })
  .strict();

const socketTypingEndMessageSchema = z
  .object({
    type: z.literal("typing-end"),
    matchId: pvpMatchIdSchema,
    mode: typingModeSchema,
    winnerId: z.string().min(1).max(128).nullable(),
    results: z.array(typingResultSchema).min(1).max(8),
    reason: z.enum(["completed", "timeout", "forfeit", "cancelled"]),
  })
  .strict();

const socketTypingDeclinedMessageSchema = z
  .object({
    type: z.literal("typing-declined"),
    matchId: pvpMatchIdSchema,
    opponentNick: z.string().min(1).max(16),
  })
  .strict();

const socketTypingCancelledMessageSchema = z
  .object({
    type: z.literal("typing-cancelled"),
    matchId: pvpMatchIdSchema,
    reason: z.string().max(120),
  })
  .strict();

const socketGameplayErrorMessageSchema = z
  .object({
    type: z.literal("gameplay-error"),
    system: z.enum(["media", "item", "swim", "typing"]),
    message: z.string().max(160),
  })
  .strict();

const socketPokerStateMessageSchema = z
  .object({
    type: z.literal("poker-state"),
    state: pokerPublicStateSchema,
  })
  .strict();

const socketPokerHoleMessageSchema = z
  .object({
    type: z.literal("poker-hole"),
    seatIndex: z.number().int().min(0).max(15),
    cards: z.array(pokerCardSchema).length(2),
  })
  .strict();

const socketPokerErrorMessageSchema = z
  .object({
    type: z.literal("poker-error"),
    message: z.string().max(160),
  })
  .strict();

const socketChessStateMessageSchema = z
  .object({
    type: z.literal("chess-state"),
    state: chessPublicStateSchema,
  })
  .strict();

const socketChessErrorMessageSchema = z
  .object({
    type: z.literal("chess-error"),
    message: z.string().max(160),
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
  socketMediaStateMessageSchema,
  socketItemStateMessageSchema,
  socketItemActionMessageSchema,
  socketRagdollMessageSchema,
  socketSwimChallengeMessageSchema,
  socketSwimStartMessageSchema,
  socketSwimProgressMessageSchema,
  socketSwimEndMessageSchema,
  socketSwimDeclinedMessageSchema,
  socketSwimCancelledMessageSchema,
  socketTypingChallengeMessageSchema,
  socketTypingRoomStateMessageSchema,
  socketTypingLobbyMessageSchema,
  socketTypingStartMessageSchema,
  socketTypingProgressMessageSchema,
  socketTypingEndMessageSchema,
  socketTypingDeclinedMessageSchema,
  socketTypingCancelledMessageSchema,
  socketGameplayErrorMessageSchema,
  socketPokerStateMessageSchema,
  socketPokerHoleMessageSchema,
  socketPokerErrorMessageSchema,
  socketChessStateMessageSchema,
  socketChessErrorMessageSchema,
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
