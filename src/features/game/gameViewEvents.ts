import type {
  ChatMessage,
  MultiplayerEvent,
  PlayerSnapshot,
  SharedEntityState,
  SocketInboundMessage,
} from "@/shared/schemas/multiplayer";

type PokerStateMessage = Extract<SocketInboundMessage, { type: "poker-state" }>;
type PokerHoleMessage = Extract<SocketInboundMessage, { type: "poker-hole" }>;
type PokerStatePayload = PokerStateMessage["state"];
type PokerCardPayload = PokerHoleMessage["cards"][number];

type ChessStateMessage = Extract<SocketInboundMessage, { type: "chess-state" }>;
type ChessStatePayload = ChessStateMessage["state"];
import type {
  GamePvpState,
  GameChatMessage,
  GameOnlinePlayer,
  GamePlayerActivity,
} from "@/features/game/gameViewState";
import {
  createEndedPvpState,
  createIncomingPvpState,
  createStartedPvpState,
  decorateChatMessage,
  patchOnlinePlayer,
  removeOnlinePlayer,
  upsertOnlinePlayer,
} from "@/features/game/gameViewState";

type MutableRef<T> = { current: T };
type NpcStateList = Extract<SocketInboundMessage, { type: "npc-state" }>["npcs"];
type SpectatorSpawnState = Extract<SocketInboundMessage, { type: "espectro-spawn" }>["espectro"];
type PvpEndMessage = Extract<SocketInboundMessage, { type: "pvp-end" }>;
type PvpHitMessage = Extract<SocketInboundMessage, { type: "pvp-hit" }>;
type SpectroSpawnMessage = Extract<SocketInboundMessage, { type: "espectro-spawn" }>;
type VoiceReadyMessage = Extract<SocketInboundMessage, { type: "voice-ready" }>;
type VoiceSignalMessage = Extract<SocketInboundMessage, { type: "voice-signal" }>;

type GameApi = {
  addRemotePlayer?: (player: PlayerSnapshot) => void;
  updateSharedEntity?: (entity: SharedEntityState) => void;
  updateRemotePlayer?: (state: Extract<SocketInboundMessage, { type: "state" }>) => void;
  removeRemotePlayer?: (id: string) => void;
  triggerRemoteEmote?: (playerId: string, kind: string, duration: number) => void;
  triggerReaction?: (targetId: string, kind: string) => void;
  triggerRemoteReaction?: (targetId: string, kind: string) => void;
  pvpSetMatch?: (match: { matchId: string; opponentId: string | null; side: "A" | "B" | null } | null) => void;
  pvpTeleportToArena?: (side: "A" | "B") => void;
  pvpReturnFromArena?: () => void;
  pvpShowThrow?: (matchId: string, fromId: string, x: number, z: number, dx: number, dz: number) => void;
  pvpShowHit?: (victimId: string) => void;
  espectroSpawn?: (payload: SpectatorSpawnState) => void;
  espectroDespawn?: () => void;
  applyNpcSnapshots?: (npcs: NpcStateList) => void;
  setNpcAuthority?: (value: boolean) => void;
  pushChatBubble?: (target: string, text: string) => void;
  exitSit?: () => void;
};

type VoiceApi = {
  setLocalId?: (id: string) => void;
  syncPlayers?: (players: PlayerSnapshot[]) => void;
  addPlayer?: (player: PlayerSnapshot) => void;
  removePlayer?: (id: string) => void;
  handleReady?: (event: VoiceReadyMessage) => void;
  handleSignal?: (event: VoiceSignalMessage) => void;
};

type GameViewEventContext = {
  nick: string;
  localIdRef: MutableRef<string | null>;
  npcAuthorityIdRef: MutableRef<string | null>;
  npcSnapshotRef: MutableRef<NpcStateList>;
  espectroSnapshotRef: MutableRef<SpectatorSpawnState | null>;
  serverNowRef: MutableRef<number | null>;
  serverSyncedAtRef: MutableRef<number | null>;
  pvpStateRef: MutableRef<GamePvpState | null>;
  pvpCountdownRef: MutableRef<{
    clear: () => void;
    start: (setPvpState: GameViewEventContext["setPvpState"]) => void;
  } | null>;
  espectroNoticeTimerRef: MutableRef<ReturnType<typeof setTimeout> | null>;
  getGame: () => GameApi | null;
  getVoice: () => VoiceApi | null;
  setConnection: (value: string) => void;
  setOnlinePlayers: (updater: (current: GameOnlinePlayer[]) => GameOnlinePlayer[]) => void;
  setChatMessages: (updater: (current: GameChatMessage[]) => GameChatMessage[]) => void;
  setPvpState: (next: GamePvpState | null | ((prev: GamePvpState | null) => GamePvpState | null)) => void;
  setEspectroNotice: (value: string) => void;
  setPokerState: (value: PokerStatePayload | null) => void;
  setPokerHole: (value: PokerCardPayload[] | null) => void;
  setPokerError: (value: string | null) => void;
  setChessState: (value: ChessStatePayload | null) => void;
  setChessError: (value: string | null) => void;
};

function createPvpMatchUpdate(matchId: string, opponentId: string | null, side: "A" | "B" | null) {
  return { matchId, opponentId, side };
}

function appendChatMessage(
  setChatMessages: GameViewEventContext["setChatMessages"],
  message: ChatMessage
) {
  setChatMessages((prev) => {
    const next = [...prev, decorateChatMessage(message)];
    return next.length > 80 ? next.slice(next.length - 80) : next;
  });
}

function handleEspectroSpawn(context: GameViewEventContext, event: SpectroSpawnMessage) {
  const game = context.getGame();
  context.espectroSnapshotRef.current = event.espectro || null;
  appendChatMessage(context.setChatMessages, {
    id: "__system__",
    nick: "sistema",
    text: "espectro está no campus",
    ts: Date.now(),
  });
  context.setEspectroNotice("espectro está no campus");
  if (context.espectroNoticeTimerRef.current) clearTimeout(context.espectroNoticeTimerRef.current);
  context.espectroNoticeTimerRef.current = setTimeout(() => {
    context.setEspectroNotice("");
    context.espectroNoticeTimerRef.current = null;
  }, 4500);
  if (game && event.espectro) game.espectroSpawn?.(event.espectro);
}

function handlePvpHit(context: GameViewEventContext, event: PvpHitMessage) {
  const current = context.pvpStateRef.current;
  if (!current || current.matchId !== event.matchId) return;
  const myId = context.localIdRef.current;
  const myHits = event.victim === myId ? current.myHits + 1 : current.myHits;
  const opponentHits = event.victim !== myId ? current.opponentHits + 1 : current.opponentHits;
  if (event.victim === myId) {
    context.getGame()?.pvpShowHit?.("__local__");
  }
  context.setPvpState((prev) => (prev ? { ...prev, myHits, opponentHits } : prev));
}

function handlePvpEnd(context: GameViewEventContext, event: PvpEndMessage) {
  const game = context.getGame();
  context.pvpCountdownRef.current?.clear();
  context.espectroNoticeTimerRef.current && clearTimeout(context.espectroNoticeTimerRef.current);
  context.espectroNoticeTimerRef.current = null;
  if (game) {
    game.pvpSetMatch?.(null);
    game.pvpReturnFromArena?.();
  }
  return createEndedPvpState(event, context.localIdRef.current);
}

export function createGameViewEventHandler(context: GameViewEventContext) {
  return function handleGameViewEvent(event: MultiplayerEvent) {
    const game = context.getGame();
    const voice = context.getVoice();

    if (event.type === "connected") {
      context.setConnection("connected");
      return;
    }
    if (event.type === "disconnected") {
      context.setConnection("disconnected");
      return;
    }
    if (event.type === "error") {
      context.setConnection("error");
      return;
    }

    if (event.type === "init") {
      context.localIdRef.current = event.you;
      context.setOnlinePlayers(() => {
        const nextPlayers: GameOnlinePlayer[] = [
          {
            id: event.you,
            nick: context.nick,
            activity: "idle" as GamePlayerActivity,
            voiceEnabled: false,
            voiceMuted: false,
            isYou: true,
          },
          ...(Array.isArray(event.players) ? event.players : [])
            .filter((player) => player?.id && player.id !== event.you)
            .map((player) => ({
              id: player.id,
              nick: player.nick || "Player",
              activity: (player.activity || "idle") as GamePlayerActivity,
              voiceEnabled: player.voiceEnabled === true,
              voiceMuted: player.voiceMuted === true,
              isYou: false,
            })),
        ];
        return nextPlayers;
      });
      context.npcAuthorityIdRef.current =
        typeof event.npcAuthority === "string" ? event.npcAuthority : null;
      context.npcSnapshotRef.current = Array.isArray(event.npcs) ? event.npcs : [];
      context.espectroSnapshotRef.current = event.espectro || null;
      if (typeof event.serverNow === "number") {
        context.serverNowRef.current = event.serverNow;
        context.serverSyncedAtRef.current = Date.now();
      }
      voice?.setLocalId?.(event.you);
      voice?.syncPlayers?.(event.players || []);
      if (event.history) {
        context.setChatMessages(() => event.history.map((message) => decorateChatMessage(message)));
      }
      if (game && event.players) {
        for (const player of event.players) {
          if (player.id !== event.you) game.addRemotePlayer?.(player);
        }
      }
      if (game && event.entities) {
        for (const entity of event.entities) {
          game.updateSharedEntity?.(entity);
        }
      }
      if (game && event.espectro) {
        game.espectroSpawn?.(event.espectro);
      }
      if (game) {
        game.setNpcAuthority?.(context.npcAuthorityIdRef.current === event.you);
        game.applyNpcSnapshots?.(context.npcSnapshotRef.current);
      }
      return;
    }

    if (event.type === "clock") {
      if (typeof event.serverNow === "number") {
        context.serverNowRef.current = event.serverNow;
        context.serverSyncedAtRef.current = Date.now();
      }
      return;
    }

    if (event.type === "join") {
      context.setOnlinePlayers((prev) => upsertOnlinePlayer(prev, event.player, context.localIdRef.current));
      game?.addRemotePlayer?.(event.player);
      voice?.addPlayer?.(event.player);
      return;
    }

    if (event.type === "state") {
      context.setOnlinePlayers((prev) => patchOnlinePlayer(prev, event.id, { activity: event.activity || "idle" }));
      game?.updateRemotePlayer?.(event);
      return;
    }

    if (event.type === "entity-state") {
      game?.updateSharedEntity?.(event);
      return;
    }

    if (event.type === "npc-authority") {
      context.npcAuthorityIdRef.current = typeof event.id === "string" ? event.id : null;
      if (game && context.localIdRef.current) {
        game.setNpcAuthority?.(context.npcAuthorityIdRef.current === context.localIdRef.current);
      }
      return;
    }

    if (event.type === "npc-state") {
      context.npcSnapshotRef.current = Array.isArray(event.npcs) ? event.npcs : [];
      game?.applyNpcSnapshots?.(context.npcSnapshotRef.current);
      return;
    }

    if (event.type === "leave") {
      context.setOnlinePlayers((prev) => removeOnlinePlayer(prev, event.id));
      game?.removeRemotePlayer?.(event.id);
      voice?.removePlayer?.(event.id);
      return;
    }

    if (event.type === "emote") {
      game?.triggerRemoteEmote?.(event.id, event.kind, event.duration);
      return;
    }

    if (event.type === "voice-ready") {
      context.setOnlinePlayers((prev) =>
        patchOnlinePlayer(prev, event.id, {
          voiceEnabled: event.enabled === true,
          voiceMuted: event.muted === true,
        })
      );
      voice?.handleReady?.(event);
      return;
    }

    if (event.type === "voice-signal") {
      voice?.handleSignal?.(event);
      return;
    }

    if (event.type === "chat") {
      appendChatMessage(context.setChatMessages, event);
      if (game && event.id !== "__system__" && event.text) {
        const target = event.id === context.localIdRef.current ? "__local__" : event.id;
        game.pushChatBubble?.(target, event.text);
      }
      return;
    }

    if (event.type === "pvp-challenge") {
      context.setPvpState(createIncomingPvpState(event.matchId, event.from, event.fromNick));
      return;
    }

    if (event.type === "pvp-start") {
      const started = createStartedPvpState(event, context.localIdRef.current);
      context.setPvpState(started.state);
      context.pvpStateRef.current = started.state;
      if (game) {
        game.pvpSetMatch?.(createPvpMatchUpdate(event.matchId, started.opponentId, started.side));
        game.pvpTeleportToArena?.(started.side);
      }
      context.pvpCountdownRef.current?.start(context.setPvpState);
      return;
    }

    if (event.type === "pvp-declined" || event.type === "pvp-cancelled") {
      context.pvpCountdownRef.current?.clear();
      context.setPvpState(null);
      game?.pvpSetMatch?.(null);
      return;
    }

    if (event.type === "pvp-throw") {
      game?.pvpShowThrow?.(event.matchId, event.from, event.x, event.z, event.dx, event.dz);
      return;
    }

    if (event.type === "pvp-hit") {
      handlePvpHit(context, event);
      return;
    }

    if (event.type === "pvp-end") {
      context.setPvpState(handlePvpEnd(context, event));
      return;
    }

    if (event.type === "espectro-spawn") {
      handleEspectroSpawn(context, event);
      return;
    }

    if (event.type === "espectro-despawn") {
      context.espectroSnapshotRef.current = null;
      game?.espectroDespawn?.();
      return;
    }

    if (event.type === "poker-state") {
      context.setPokerState(event.state);
      const localId = context.localIdRef.current;
      const mySeat = localId
        ? event.state.seats.find((s) => s.playerId === localId)
        : null;
      // Fallback: server confirmou que sai (nao tem mais assento) -> garante
      // que o engine tambem saia do sit, mesmo se o botao nao tiver chamado
      // exitSit por algum motivo (HMR antigo, race, etc.).
      if (!mySeat) {
        game?.exitSit?.();
      }
      return;
    }

    if (event.type === "poker-hole") {
      context.setPokerHole(event.cards);
      return;
    }

    if (event.type === "poker-error") {
      context.setPokerError(event.message);
      return;
    }

    if (event.type === "chess-state") {
      context.setChessState(event.state);
      const localId = context.localIdRef.current;
      const stillSeated = !!localId && event.state.seats.some((s) => s.playerId === localId);
      if (!stillSeated) {
        game?.exitSit?.();
      }
      return;
    }

    if (event.type === "chess-error") {
      context.setChessError(event.message);
      return;
    }

    if (event.type === "reaction") {
      if (!event.targetId) return;
      if (event.targetKey) {
        context.setChatMessages((prev) =>
          prev.map((message) =>
            message.key === event.targetKey
              ? { ...message, likeCount: (message.likeCount || 0) + 1 }
              : message
          )
        );
      }
      if (game && event.targetId !== "__system__") {
        const target = event.targetId === context.localIdRef.current ? "__local__" : event.targetId;
        if (target === "__local__") game.triggerReaction?.(target, event.kind || "like");
        else game.triggerRemoteReaction?.(target, event.kind || "like");
      }
    }
  };
}
