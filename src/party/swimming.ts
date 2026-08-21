import type * as Party from "partykit/server";
import type { SocketOutboundMessage } from "@/shared/schemas/multiplayer";

type PlayerRecord = {
  id: string;
  nick: string;
};

type SwimMessage = Extract<
  SocketOutboundMessage,
  { type: "swim-challenge" | "swim-respond" | "swim-stroke" | "swim-quit" }
>;

type SwimStatus = "pending" | "active";

type SwimCompetitor = {
  playerId: string;
  nick: string;
  strokes: number;
  lastSequence: number;
  lastStrokeAt: number;
};

type SwimMatch = {
  id: string;
  status: SwimStatus;
  playerA: SwimCompetitor;
  playerB: SwimCompetitor;
  startAt: number;
  endAt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const COUNTDOWN_MS = 3_200;
const RACE_DURATION_MS = 10_000;
const CHALLENGE_TIMEOUT_MS = 25_000;
const MIN_STROKE_INTERVAL_MS = 85;
const VISUAL_STROKE_TARGET = 40;

export class SwimmingRaces {
  private matches = new Map<string, SwimMatch>();
  private counter = 0;

  constructor(
    private readonly room: Party.Room,
    private readonly isUnavailable: (playerId: string) => boolean,
  ) {}

  isBusy(playerId: string) {
    for (const match of this.matches.values()) {
      if (match.playerA.playerId === playerId || match.playerB.playerId === playerId) return true;
    }
    return false;
  }

  private send(playerId: string, payload: unknown) {
    this.room.getConnection(playerId)?.send(JSON.stringify(payload));
  }

  private sendBoth(match: SwimMatch, payload: unknown) {
    const encoded = JSON.stringify(payload);
    this.room.getConnection(match.playerA.playerId)?.send(encoded);
    this.room.getConnection(match.playerB.playerId)?.send(encoded);
  }

  private error(playerId: string, message: string) {
    this.send(playerId, { type: "gameplay-error", system: "swim", message });
  }

  private score(competitor: SwimCompetitor) {
    return {
      playerId: competitor.playerId,
      nick: competitor.nick,
      strokes: competitor.strokes,
      progress: Math.min(1, competitor.strokes / VISUAL_STROKE_TARGET),
    };
  }

  private scores(match: SwimMatch) {
    return [this.score(match.playerA), this.score(match.playerB)] as const;
  }

  private remove(match: SwimMatch) {
    if (match.timer) clearTimeout(match.timer);
    match.timer = null;
    this.matches.delete(match.id);
  }

  private finish(match: SwimMatch, reason: "timeout" | "forfeit" | "cancelled", forcedWinnerId?: string | null) {
    if (!this.matches.has(match.id)) return;
    const scores = this.scores(match);
    let winnerId: string | null = forcedWinnerId ?? null;
    if (forcedWinnerId === undefined) {
      if (match.playerA.strokes > match.playerB.strokes) winnerId = match.playerA.playerId;
      if (match.playerB.strokes > match.playerA.strokes) winnerId = match.playerB.playerId;
    }
    const tie = winnerId === null && match.playerA.strokes === match.playerB.strokes;
    this.sendBoth(match, {
      type: "swim-end",
      matchId: match.id,
      scores,
      winnerId,
      tie,
      reason,
    });
    this.remove(match);
  }

  handle(message: SwimMessage, sender: Party.Connection, players: ReadonlyMap<string, PlayerRecord>) {
    if (message.type === "swim-challenge") {
      const challenger = players.get(sender.id);
      const opponent = players.get(message.to);
      if (!challenger || !opponent || opponent.id === sender.id) return true;
      if (
        this.isBusy(sender.id) ||
        this.isBusy(opponent.id) ||
        this.isUnavailable(sender.id) ||
        this.isUnavailable(opponent.id)
      ) {
        this.error(sender.id, "Um dos jogadores já está em outra atividade.");
        return true;
      }
      const id = `swim-${++this.counter}-${Date.now().toString(36)}`;
      const match: SwimMatch = {
        id,
        status: "pending",
        playerA: { playerId: challenger.id, nick: challenger.nick, strokes: 0, lastSequence: -1, lastStrokeAt: 0 },
        playerB: { playerId: opponent.id, nick: opponent.nick, strokes: 0, lastSequence: -1, lastStrokeAt: 0 },
        startAt: 0,
        endAt: 0,
        timer: null,
      };
      this.matches.set(id, match);
      match.timer = setTimeout(() => {
        if (!this.matches.has(id) || match.status !== "pending") return;
        this.sendBoth(match, {
          type: "swim-cancelled",
          matchId: id,
          reason: "O desafio expirou.",
        });
        this.remove(match);
      }, CHALLENGE_TIMEOUT_MS);
      this.send(opponent.id, {
        type: "swim-challenge",
        matchId: id,
        from: challenger.id,
        fromNick: challenger.nick,
      });
      return true;
    }

    const match = this.matches.get(message.matchId);
    if (!match) return true;
    const isA = match.playerA.playerId === sender.id;
    const isB = match.playerB.playerId === sender.id;
    if (!isA && !isB) return true;

    if (message.type === "swim-respond") {
      if (match.status !== "pending" || !isB) return true;
      if (!message.accepted) {
        this.send(match.playerA.playerId, {
          type: "swim-declined",
          matchId: match.id,
          opponentNick: match.playerB.nick,
        });
        this.remove(match);
        return true;
      }
      if (this.isUnavailable(match.playerA.playerId) || this.isUnavailable(match.playerB.playerId)) {
        this.sendBoth(match, { type: "swim-cancelled", matchId: match.id, reason: "Um jogador iniciou outra atividade." });
        this.remove(match);
        return true;
      }
      if (match.timer) clearTimeout(match.timer);
      match.timer = null;
      match.status = "active";
      match.startAt = Date.now() + COUNTDOWN_MS;
      match.endAt = match.startAt + RACE_DURATION_MS;
      this.sendBoth(match, {
        type: "swim-start",
        matchId: match.id,
        playerA: match.playerA.playerId,
        playerB: match.playerB.playerId,
        nickA: match.playerA.nick,
        nickB: match.playerB.nick,
        startAt: match.startAt,
        endAt: match.endAt,
      });
      match.timer = setTimeout(() => this.finish(match, "timeout"), COUNTDOWN_MS + RACE_DURATION_MS + 30);
      return true;
    }

    if (message.type === "swim-stroke") {
      if (match.status !== "active") return true;
      const now = Date.now();
      if (now < match.startAt || now > match.endAt) return true;
      const competitor = isA ? match.playerA : match.playerB;
      if (message.sequence <= competitor.lastSequence) return true;
      competitor.lastSequence = message.sequence;
      if (competitor.lastStrokeAt > 0 && now - competitor.lastStrokeAt < MIN_STROKE_INTERVAL_MS) return true;
      competitor.lastStrokeAt = now;
      competitor.strokes += 1;
      this.sendBoth(match, {
        type: "swim-progress",
        matchId: match.id,
        scores: this.scores(match),
        serverNow: now,
      });
      return true;
    }

    if (message.type === "swim-quit") {
      if (match.status === "pending") {
        const other = isA ? match.playerB : match.playerA;
        this.send(other.playerId, { type: "swim-cancelled", matchId: match.id, reason: "O desafio foi cancelado." });
        this.remove(match);
        return true;
      }
      const winner = isA ? match.playerB.playerId : match.playerA.playerId;
      this.finish(match, "forfeit", winner);
      return true;
    }

    return false;
  }

  disconnect(playerId: string) {
    for (const match of [...this.matches.values()]) {
      const isA = match.playerA.playerId === playerId;
      const isB = match.playerB.playerId === playerId;
      if (!isA && !isB) continue;
      const other = isA ? match.playerB : match.playerA;
      if (match.status === "active") {
        this.finish(match, "forfeit", other.playerId);
      } else {
        this.send(other.playerId, {
          type: "swim-cancelled",
          matchId: match.id,
          reason: "O outro jogador desconectou.",
        });
        this.remove(match);
      }
    }
  }

  destroy() {
    for (const match of this.matches.values()) {
      if (match.timer) clearTimeout(match.timer);
    }
    this.matches.clear();
  }
}
