import { z } from "zod";
import { chatMessageSchema, playerActivitySchema } from "@/shared/schemas/multiplayer";

export type GameChatMessage = z.infer<typeof chatMessageSchema> & {
  key: string;
  likeCount: number;
};

export type GamePlayerActivity = z.infer<typeof playerActivitySchema>;

export type GameOnlinePlayer = {
  id: string;
  nick: string;
  activity: GamePlayerActivity;
  voiceEnabled: boolean;
  voiceMuted: boolean;
  isYou: boolean;
};

type ChatMessageLike = z.infer<typeof chatMessageSchema>;
type OnlinePlayerLike = {
  id?: string | null;
  nick?: string | null;
  activity?: GamePlayerActivity | null;
  voiceEnabled?: boolean | null;
  voiceMuted?: boolean | null;
};

export function decorateChatMessage(message: ChatMessageLike): GameChatMessage {
  return {
    ...message,
    key: `${message.id}:${message.ts}`,
    likeCount: 0,
  };
}

export function normalizeOnlinePlayer(player: OnlinePlayerLike, localId: string | null): GameOnlinePlayer | null {
  if (!player?.id) return null;
  return {
    id: player.id,
    nick: player.nick || "Player",
    activity: player.activity || "idle",
    voiceEnabled: player.voiceEnabled === true,
    voiceMuted: player.voiceMuted === true,
    isYou: player.id === localId,
  };
}

export function upsertOnlinePlayer(
  current: GameOnlinePlayer[],
  player: OnlinePlayerLike,
  localId: string | null
) {
  const nextPlayer = normalizeOnlinePlayer(player, localId);
  if (!nextPlayer) return current;

  const exists = current.some((entry) => entry.id === nextPlayer.id);
  const next = exists
    ? current.map((entry) => {
        if (entry.id !== nextPlayer.id) return entry;
        const needsUpdate = Object.keys(nextPlayer).some(
          (key) => entry[key as keyof GameOnlinePlayer] !== nextPlayer[key as keyof GameOnlinePlayer]
        );
        return needsUpdate ? { ...entry, ...nextPlayer } : entry;
      })
    : [...current, nextPlayer];

  if (!exists) {
    return next.sort((a, b) => Number(b.isYou) - Number(a.isYou) || a.nick.localeCompare(b.nick));
  }

  return next;
}

export function patchOnlinePlayer(
  current: GameOnlinePlayer[],
  id: string | null | undefined,
  patch: Partial<Pick<GameOnlinePlayer, "activity" | "voiceEnabled" | "voiceMuted">>
) {
  if (!id) return current;

  let changed = false;
  let found = false;
  const next = current.map((entry) => {
    if (entry.id !== id) return entry;
    found = true;
    const needsUpdate = Object.keys(patch).some(
      (key) => entry[key as keyof typeof patch] !== patch[key as keyof typeof patch]
    );
    if (!needsUpdate) return entry;
    changed = true;
    return { ...entry, ...patch };
  });

  return found && changed ? next : current;
}

export function removeOnlinePlayer(current: GameOnlinePlayer[], id: string | null | undefined) {
  if (!id) return current;
  return current.filter((player) => player.id !== id);
}

type PvpBaseState = {
  matchId: string;
  opponentId: string | null;
  opponentNick: string | null;
  myHits: number;
  opponentHits: number;
  side: "A" | "B" | null;
  winner: string | null;
  loser: string | null;
  winnerNick: string | null;
  forfeit: boolean;
  countdownVal?: number;
};

export type GamePvpState =
  | (PvpBaseState & { phase: "incoming" })
  | (PvpBaseState & { phase: "countdown" })
  | (PvpBaseState & { phase: "playing" })
  | (PvpBaseState & { phase: "ended" });

type PvpStartEventLike = {
  matchId: string;
  playerA: string;
  playerB: string;
  nickA: string;
  nickB: string;
};

type PvpEndEventLike = {
  matchId: string;
  winner: string;
  loser: string;
  winnerNick: string;
  loserNick: string;
  forfeit?: boolean | null;
};

function createPvpBaseState(matchId: string, opponentId: string | null, opponentNick: string | null): PvpBaseState {
  return {
    matchId,
    opponentId,
    opponentNick,
    myHits: 0,
    opponentHits: 0,
    side: null,
    winner: null,
    loser: null,
    winnerNick: null,
    forfeit: false,
  };
}

export function createIncomingPvpState(matchId: string, opponentId: string, opponentNick: string): GamePvpState {
  return {
    phase: "incoming",
    ...createPvpBaseState(matchId, opponentId, opponentNick),
  };
}

export function createStartedPvpState(event: PvpStartEventLike, localId: string | null) {
  const side: "A" | "B" = event.playerA === localId ? "A" : "B";
  const opponentId = side === "A" ? event.playerB : event.playerA;
  const opponentNick = side === "A" ? event.nickB : event.nickA;

  const state: GamePvpState = {
    phase: "countdown",
    ...createPvpBaseState(event.matchId, opponentId, opponentNick),
    side,
    countdownVal: 3,
  };

  return {
    state,
    side,
    opponentId,
    opponentNick,
  };
}

export function createEndedPvpState(event: PvpEndEventLike, localId: string | null): GamePvpState {
  return {
    phase: "ended",
    ...createPvpBaseState(
      event.matchId,
      event.loser === localId ? event.winner : event.loser,
      event.loser === localId ? event.winnerNick : event.loserNick
    ),
    winner: event.winner,
    loser: event.loser,
    winnerNick: event.winnerNick,
    forfeit: event.forfeit === true,
  };
}
