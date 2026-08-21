import type * as Party from "partykit/server";
import type { SocketOutboundMessage } from "@/shared/schemas/multiplayer";

type PlayerRecord = { id: string; nick: string };

type TypingMessage = Extract<
  SocketOutboundMessage,
  {
    type:
      | "typing-solo"
      | "typing-challenge"
      | "typing-respond"
      | "typing-room-create"
      | "typing-room-join"
      | "typing-room-leave"
      | "typing-room-start"
      | "typing-input"
      | "typing-quit";
  }
>;

type TypingMode = "solo" | "duel" | "room";

type TypingParticipant = {
  playerId: string;
  nick: string;
  typed: string;
  progress: number;
  errorCount: number;
  lastSequence: number;
  lastInputAt: number;
  finishedAt: number | null;
  rank: number | null;
  connected: boolean;
};

type TypingMatch = {
  id: string;
  mode: TypingMode;
  status: "pending" | "active";
  participants: TypingParticipant[];
  text: string;
  startAt: number;
  deadlineAt: number;
  winnerId: string | null;
  nextRank: number;
  timer: ReturnType<typeof setTimeout> | null;
};

type TypingRoom = {
  id: string;
  hostId: string;
  members: Array<{ playerId: string; nick: string }>;
  computerId: string;
};

const PHRASES = [
  "O gramado fica mais bonito quando todo mundo cuida do campus.",
  "Cinco computadores aguardam os digitadores mais rápidos do bloco.",
  "Entre uma aula e outra, a praça vira ponto de encontro dos estudantes.",
  "A biblioteca guarda histórias, projetos e boas ideias para compartilhar.",
  "Quem mantém o ritmo e a precisão chega primeiro sem atropelar as palavras.",
  "No laboratório, cada tecla transforma uma ideia pequena em algo concreto.",
  "O vento atravessa as árvores enquanto os corredores mudam de movimento.",
  "Programar também é revisar, testar e corrigir com bastante paciência.",
  "Uma boa equipe conversa, divide tarefas e nunca deixa a partida travada.",
  "A chuva passou cedo e deixou os caminhos do campus com cheiro de terra.",
  "O relógio marcou a largada, mas a calma ainda vale mais que a pressa.",
  "Cada erro corrigido ensina um atalho novo para a próxima tentativa.",
  "As luzes do Bloco 3 continuam acesas durante a última prática da noite.",
  "Digitar bem exige atenção ao texto, regularidade e mãos relaxadas.",
  "O melhor resultado combina velocidade, precisão e um pouco de estratégia.",
  "Depois da contagem regressiva, todos recebem exatamente a mesma frase.",
] as const;

const SOLO_COUNTDOWN_MS = 650;
const MULTIPLAYER_COUNTDOWN_MS = 3_200;
const CHALLENGE_TIMEOUT_MS = 25_000;
const MATCH_TIMEOUT_MS = 75_000;
const ROOM_FINISH_GRACE_MS = 8_000;
const MIN_INPUT_INTERVAL_MS = 24;
const MAX_COMPLETION_CPS = 14;
const VALID_COMPUTERS = new Set(["pc-1", "pc-2", "pc-3", "pc-4", "pc-5"]);

export class TypingGames {
  private matches = new Map<string, TypingMatch>();
  private rooms = new Map<string, TypingRoom>();
  private matchCounter = 0;
  private roomCounter = 0;
  private phraseCursor = Math.floor(Math.random() * PHRASES.length);

  constructor(
    private readonly room: Party.Room,
    private readonly isUnavailable: (playerId: string) => boolean,
  ) {}

  private send(playerId: string, payload: unknown) {
    this.room.getConnection(playerId)?.send(JSON.stringify(payload));
  }

  private sendPlayers(playerIds: string[], payload: unknown) {
    const encoded = JSON.stringify(payload);
    for (const playerId of playerIds) this.room.getConnection(playerId)?.send(encoded);
  }

  private error(playerId: string, message: string) {
    this.send(playerId, { type: "gameplay-error", system: "typing", message });
  }

  private nextPhrase() {
    const phrase = PHRASES[this.phraseCursor % PHRASES.length];
    this.phraseCursor = (this.phraseCursor + 5) % PHRASES.length;
    return phrase;
  }

  private participant(player: PlayerRecord): TypingParticipant {
    return {
      playerId: player.id,
      nick: player.nick,
      typed: "",
      progress: 0,
      errorCount: 0,
      lastSequence: -1,
      lastInputAt: 0,
      finishedAt: null,
      rank: null,
      connected: true,
    };
  }

  private validComputer(computerId: string) {
    return VALID_COMPUTERS.has(computerId);
  }

  isBusy(playerId: string, exceptMatchId = "") {
    for (const match of this.matches.values()) {
      if (match.id === exceptMatchId) continue;
      if (match.participants.some((participant) => participant.playerId === playerId)) return true;
    }
    for (const room of this.rooms.values()) {
      if (room.members.some((member) => member.playerId === playerId)) return true;
    }
    return false;
  }

  private isPlayerUnavailable(playerId: string, exceptMatchId = "") {
    return this.isBusy(playerId, exceptMatchId) || this.isUnavailable(playerId);
  }

  private roomSummary(room: TypingRoom) {
    const host = room.members.find((member) => member.playerId === room.hostId) ?? room.members[0];
    return {
      roomId: room.id,
      hostId: host.playerId,
      hostNick: host.nick,
      participantCount: room.members.length,
      open: true,
    };
  }

  private lobbyPayload() {
    return {
      type: "typing-lobby",
      rooms: [...this.rooms.values()].map((room) => this.roomSummary(room)).slice(0, 32),
    };
  }

  sendLobby(playerId: string) {
    this.send(playerId, this.lobbyPayload());
  }

  private broadcastLobby() {
    this.room.broadcast(JSON.stringify(this.lobbyPayload()));
  }

  private broadcastRoom(room: TypingRoom) {
    const host = room.members.find((member) => member.playerId === room.hostId) ?? room.members[0];
    if (!host) return;
    this.sendPlayers(room.members.map((member) => member.playerId), {
      type: "typing-room-state",
      roomId: room.id,
      hostId: host.playerId,
      hostNick: host.nick,
      participants: room.members,
      open: true,
    });
  }

  private result(match: TypingMatch, participant: TypingParticipant, now = Date.now()) {
    const elapsedMs = participant.finishedAt
      ? participant.finishedAt - match.startAt
      : Math.max(1, now - match.startAt);
    const elapsedMinutes = Math.max(elapsedMs / 60_000, 1 / 600);
    const correctCharacters = participant.finishedAt
      ? match.text.length
      : Math.round(participant.progress * match.text.length);
    const accuracy = correctCharacters === 0
      ? participant.errorCount === 0 ? 100 : 0
      : (correctCharacters / (correctCharacters + participant.errorCount)) * 100;
    return {
      playerId: participant.playerId,
      nick: participant.nick,
      progress: participant.progress,
      timeMs: participant.finishedAt ? Math.max(0, elapsedMs) : null,
      accuracy: Math.max(0, Math.min(100, accuracy)),
      errors: participant.errorCount,
      wpm: Math.max(0, (correctCharacters / 5) / elapsedMinutes),
      cpm: Math.max(0, correctCharacters / elapsedMinutes),
      rank: participant.rank,
      finished: participant.finishedAt !== null,
    };
  }

  private results(match: TypingMatch, now = Date.now()) {
    return match.participants
      .map((participant) => this.result(match, participant, now))
      .sort((a, b) => {
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
        if (a.rank !== null) return -1;
        if (b.rank !== null) return 1;
        return b.progress - a.progress || a.errors - b.errors;
      });
  }

  private sendMatch(match: TypingMatch, payload: unknown) {
    this.sendPlayers(
      match.participants.filter((participant) => participant.connected).map((participant) => participant.playerId),
      payload,
    );
  }

  private broadcastProgress(match: TypingMatch, now = Date.now()) {
    this.sendMatch(match, {
      type: "typing-progress",
      matchId: match.id,
      results: this.results(match, now),
      serverNow: now,
    });
  }

  private clearTimer(match: TypingMatch) {
    if (match.timer) clearTimeout(match.timer);
    match.timer = null;
  }

  private removeMatch(match: TypingMatch) {
    this.clearTimer(match);
    this.matches.delete(match.id);
  }

  private finish(
    match: TypingMatch,
    reason: "completed" | "timeout" | "forfeit" | "cancelled",
    forcedWinnerId?: string | null,
  ) {
    if (!this.matches.has(match.id)) return;
    const rankedWinner = match.participants.find((participant) => participant.rank === 1)?.playerId ?? null;
    const winnerId = forcedWinnerId === undefined ? (match.winnerId || rankedWinner) : forcedWinnerId;
    this.sendMatch(match, {
      type: "typing-end",
      matchId: match.id,
      mode: match.mode,
      winnerId,
      results: this.results(match),
      reason,
    });
    this.removeMatch(match);
  }

  private scheduleDeadline(
    match: TypingMatch,
    deadlineAt = match.deadlineAt,
    reason: "completed" | "timeout" = "timeout",
  ) {
    this.clearTimer(match);
    const delay = Math.max(0, deadlineAt - Date.now() + 25);
    match.timer = setTimeout(() => this.finish(match, reason), delay);
  }

  private startMatch(match: TypingMatch, countdownMs: number) {
    match.status = "active";
    match.startAt = Date.now() + countdownMs;
    match.deadlineAt = match.startAt + MATCH_TIMEOUT_MS;
    this.sendMatch(match, {
      type: "typing-start",
      matchId: match.id,
      mode: match.mode,
      text: match.text,
      startAt: match.startAt,
      deadlineAt: match.deadlineAt,
      participants: match.participants.map(({ playerId, nick }) => ({ playerId, nick })),
    });
    this.scheduleDeadline(match);
  }

  private makeMatch(mode: TypingMode, players: PlayerRecord[]) {
    const id = `typing-${++this.matchCounter}-${Date.now().toString(36)}`;
    const match: TypingMatch = {
      id,
      mode,
      status: mode === "duel" ? "pending" : "active",
      participants: players.map((player) => this.participant(player)),
      text: this.nextPhrase(),
      startAt: 0,
      deadlineAt: 0,
      winnerId: null,
      nextRank: 1,
      timer: null,
    };
    this.matches.set(id, match);
    return match;
  }

  private countNewErrors(previous: string, next: string, expected: string) {
    let errors = 0;
    for (let index = 0; index < next.length; index += 1) {
      if (
        next[index] !== expected[index] &&
        (index >= previous.length || previous[index] !== next[index])
      ) errors += 1;
    }
    return errors;
  }

  private correctPrefixLength(typed: string, expected: string) {
    const limit = Math.min(typed.length, expected.length);
    let index = 0;
    while (index < limit && typed[index] === expected[index]) index += 1;
    return index;
  }

  handle(message: TypingMessage, sender: Party.Connection, players: ReadonlyMap<string, PlayerRecord>) {
    const senderPlayer = players.get(sender.id);
    if (!senderPlayer) return true;

    if (message.type === "typing-solo") {
      if (!this.validComputer(message.computerId)) return true;
      if (this.isPlayerUnavailable(sender.id)) {
        this.error(sender.id, "Termine a atividade atual antes de iniciar outra prova.");
        return true;
      }
      const match = this.makeMatch("solo", [senderPlayer]);
      this.startMatch(match, SOLO_COUNTDOWN_MS);
      return true;
    }

    if (message.type === "typing-challenge") {
      if (!this.validComputer(message.computerId)) return true;
      const opponent = players.get(message.to);
      if (!opponent || opponent.id === sender.id) return true;
      if (this.isPlayerUnavailable(sender.id) || this.isPlayerUnavailable(opponent.id)) {
        this.error(sender.id, "Um dos jogadores já está em outra atividade.");
        return true;
      }
      const match = this.makeMatch("duel", [senderPlayer, opponent]);
      match.timer = setTimeout(() => {
        if (!this.matches.has(match.id) || match.status !== "pending") return;
        this.sendMatch(match, {
          type: "typing-cancelled",
          matchId: match.id,
          reason: "O desafio expirou.",
        });
        this.removeMatch(match);
      }, CHALLENGE_TIMEOUT_MS);
      this.send(opponent.id, {
        type: "typing-challenge",
        matchId: match.id,
        from: sender.id,
        fromNick: senderPlayer.nick,
      });
      return true;
    }

    if (message.type === "typing-room-create") {
      if (!this.validComputer(message.computerId)) return true;
      if (this.isPlayerUnavailable(sender.id)) {
        this.error(sender.id, "Saia da atividade atual antes de criar uma sala.");
        return true;
      }
      const id = `type-room-${++this.roomCounter}-${Date.now().toString(36)}`;
      const room: TypingRoom = {
        id,
        hostId: sender.id,
        members: [{ playerId: sender.id, nick: senderPlayer.nick }],
        computerId: message.computerId,
      };
      this.rooms.set(id, room);
      this.broadcastRoom(room);
      this.broadcastLobby();
      return true;
    }

    if (message.type === "typing-room-join") {
      const room = this.rooms.get(message.roomId);
      if (!room) {
        this.error(sender.id, "Essa sala não está mais disponível.");
        return true;
      }
      if (room.members.some((member) => member.playerId === sender.id)) return true;
      if (room.members.length >= 8 || this.isPlayerUnavailable(sender.id)) {
        this.error(sender.id, room.members.length >= 8 ? "A sala está cheia." : "Você já está em outra atividade.");
        return true;
      }
      room.members.push({ playerId: sender.id, nick: senderPlayer.nick });
      this.broadcastRoom(room);
      this.broadcastLobby();
      return true;
    }

    if (message.type === "typing-room-leave") {
      const room = this.rooms.get(message.roomId);
      if (!room) return true;
      room.members = room.members.filter((member) => member.playerId !== sender.id);
      if (room.members.length === 0) {
        this.rooms.delete(room.id);
      } else {
        if (room.hostId === sender.id) room.hostId = room.members[0].playerId;
        this.broadcastRoom(room);
      }
      this.broadcastLobby();
      return true;
    }

    if (message.type === "typing-room-start") {
      const room = this.rooms.get(message.roomId);
      if (!room || room.hostId !== sender.id) return true;
      if (room.members.length < 2) {
        this.error(sender.id, "Convide pelo menos mais uma pessoa antes de iniciar.");
        return true;
      }
      const roomPlayers = room.members
        .map((member) => players.get(member.playerId))
        .filter((player): player is PlayerRecord => !!player);
      if (roomPlayers.length < 2) {
        this.error(sender.id, "Não há participantes conectados suficientes.");
        return true;
      }
      this.rooms.delete(room.id);
      this.broadcastLobby();
      const match = this.makeMatch("room", roomPlayers);
      this.startMatch(match, MULTIPLAYER_COUNTDOWN_MS);
      return true;
    }

    const match = this.matches.get(message.matchId);
    if (!match) return true;
    const participant = match.participants.find((entry) => entry.playerId === sender.id);
    if (!participant) return true;

    if (message.type === "typing-respond") {
      if (match.mode !== "duel" || match.status !== "pending" || match.participants[1]?.playerId !== sender.id) return true;
      if (!message.accepted) {
        this.send(match.participants[0].playerId, {
          type: "typing-declined",
          matchId: match.id,
          opponentNick: participant.nick,
        });
        this.removeMatch(match);
        return true;
      }
      if (match.participants.some((entry) => this.isPlayerUnavailable(entry.playerId, match.id))) {
        this.sendMatch(match, { type: "typing-cancelled", matchId: match.id, reason: "Um jogador iniciou outra atividade." });
        this.removeMatch(match);
        return true;
      }
      this.startMatch(match, MULTIPLAYER_COUNTDOWN_MS);
      return true;
    }

    if (message.type === "typing-input") {
      if (match.status !== "active" || participant.finishedAt !== null) return true;
      const now = Date.now();
      if (now < match.startAt || now > match.deadlineAt) return true;
      if (message.sequence <= participant.lastSequence) return true;
      participant.lastSequence = message.sequence;
      if (participant.lastInputAt > 0 && now - participant.lastInputAt < MIN_INPUT_INTERVAL_MS) return true;
      participant.lastInputAt = now;

      const typed = message.typed.slice(0, match.text.length + 8);
      const elapsedMs = now - match.startAt;
      const maximumPlausibleLength = Math.floor((elapsedMs / 1000) * MAX_COMPLETION_CPS) + 3;
      if (typed.length > maximumPlausibleLength) return true;
      participant.errorCount += this.countNewErrors(participant.typed, typed, match.text);
      participant.typed = typed;
      const correctPrefix = this.correctPrefixLength(typed, match.text);
      participant.progress = Math.min(1, correctPrefix / match.text.length);

      const minimumCompletionMs = (match.text.length / MAX_COMPLETION_CPS) * 1000;
      if (typed === match.text && elapsedMs >= minimumCompletionMs) {
        participant.finishedAt = now;
        participant.progress = 1;
        participant.rank = match.nextRank++;
        if (!match.winnerId) match.winnerId = participant.playerId;
      }

      this.broadcastProgress(match, now);

      if (participant.finishedAt !== null) {
        if (match.mode === "solo" || match.mode === "duel") {
          this.finish(match, "completed");
        } else {
          const connected = match.participants.filter((entry) => entry.connected);
          if (connected.every((entry) => entry.finishedAt !== null)) {
            this.finish(match, "completed");
          } else if (participant.rank === 1) {
            this.scheduleDeadline(match, Math.min(match.deadlineAt, now + ROOM_FINISH_GRACE_MS), "completed");
          }
        }
      }
      return true;
    }

    if (message.type === "typing-quit") {
      if (match.status === "pending") {
        const other = match.participants.find((entry) => entry.playerId !== sender.id);
        if (other) this.send(other.playerId, { type: "typing-cancelled", matchId: match.id, reason: "O desafio foi cancelado." });
        this.removeMatch(match);
        return true;
      }
      if (match.mode === "duel") {
        const other = match.participants.find((entry) => entry.playerId !== sender.id && entry.connected);
        this.finish(match, "forfeit", other?.playerId ?? null);
      } else if (match.mode === "solo") {
        this.finish(match, "cancelled", null);
      } else {
        participant.connected = false;
        const remaining = match.participants.filter((entry) => entry.connected);
        if (remaining.length === 0 || remaining.every((entry) => entry.finishedAt !== null)) {
          this.finish(match, "forfeit");
        } else {
          this.broadcastProgress(match);
        }
      }
      return true;
    }

    return false;
  }

  disconnect(playerId: string) {
    let lobbyChanged = false;
    for (const room of [...this.rooms.values()]) {
      if (!room.members.some((member) => member.playerId === playerId)) continue;
      room.members = room.members.filter((member) => member.playerId !== playerId);
      lobbyChanged = true;
      if (room.members.length === 0) {
        this.rooms.delete(room.id);
      } else {
        if (room.hostId === playerId) room.hostId = room.members[0].playerId;
        this.broadcastRoom(room);
      }
    }
    if (lobbyChanged) this.broadcastLobby();

    for (const match of [...this.matches.values()]) {
      const participant = match.participants.find((entry) => entry.playerId === playerId);
      if (!participant) continue;
      if (match.status === "pending") {
        const other = match.participants.find((entry) => entry.playerId !== playerId);
        if (other) this.send(other.playerId, {
          type: "typing-cancelled",
          matchId: match.id,
          reason: "O outro jogador desconectou.",
        });
        this.removeMatch(match);
      } else if (match.mode === "duel") {
        const other = match.participants.find((entry) => entry.playerId !== playerId && entry.connected);
        this.finish(match, "forfeit", other?.playerId ?? null);
      } else if (match.mode === "solo") {
        this.removeMatch(match);
      } else {
        participant.connected = false;
        const remaining = match.participants.filter((entry) => entry.connected);
        if (remaining.length === 0 || remaining.every((entry) => entry.finishedAt !== null)) {
          this.finish(match, "forfeit");
        } else {
          this.broadcastProgress(match);
        }
      }
    }
  }

  destroy() {
    for (const match of this.matches.values()) this.clearTimer(match);
    this.matches.clear();
    this.rooms.clear();
  }
}
