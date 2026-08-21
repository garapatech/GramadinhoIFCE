"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chat from "@/features/chat/Chat";
import MediaPlayerPanel from "@/features/media/MediaPlayerPanel";
import VoiceChat from "@/features/multiplayer/VoiceChat";
import { readStoredAvatar } from "@/features/avatar/avatarConfig";
import { bootGame } from "@/features/game/engine";
import OnlinePlayersPanel from "@/features/game/OnlinePlayersPanel";
import PokerHud from "@/features/game/PokerHud";
import ChessHud from "@/features/game/ChessHud";
import SwimmingDuelHud, { type SwimmingDuelState } from "@/features/game/SwimmingDuelHud";
import TypingGamePanel, {
  type TypingIncoming,
  type TypingMatchUi,
} from "@/features/game/TypingGamePanel";
import { createPvpCountdownController } from "@/features/game/pvpCountdown";
import { emoteBar, getEmoteDuration } from "@/features/game/emotes";
import {
  patchOnlinePlayer,
  bumpChatLikeCount,
  type GameConnectionState,
  type GameChatMessage,
  type GameOnlinePlayer,
  type GamePvpState,
} from "@/features/game/gameViewState";
import { createGameViewEventHandler } from "@/features/game/gameViewEvents";
import { useGameOverlayVisibility } from "@/features/game/useGameOverlayVisibility";
import { useMobileViewport } from "@/features/game/useMobileViewport";
import { useMobileControls } from "@/features/game/useMobileControls";
import { connectMultiplayer } from "@/features/multiplayer/client";
import { createVoiceChat, getInitialVoiceState } from "@/features/multiplayer/voice";
import type { GameEngineApi } from "@/features/game/engine";
import { defaultAtmosphereState } from "@/shared/schemas/atmosphere";
import { readPublicEnv } from "@/shared/schemas/env";
import { readGameRouteNick } from "@/shared/schemas/gameRoute";
import {
  defaultAmbientAudioState,
  defaultPlayerStatusState,
  type AmbientAudioState,
  type PlayerStatusState,
} from "@/shared/schemas/gameUi";
import type { SocketInboundMessage } from "@/shared/schemas/multiplayer";
import type { VoiceState } from "@/shared/schemas/voice";

type PokerState = Extract<SocketInboundMessage, { type: "poker-state" }>["state"];
type PokerHoleCards = Extract<SocketInboundMessage, { type: "poker-hole" }>["cards"];
type ChessState = Extract<SocketInboundMessage, { type: "chess-state" }>["state"];
type GlobalMediaState = Extract<SocketInboundMessage, { type: "media-state" }>["state"];
type WorldItemState = Extract<SocketInboundMessage, { type: "item-state" }>["state"];
type TypingRoomState = Extract<SocketInboundMessage, { type: "typing-room-state" }>;
type TypingLobbyRoom = Extract<SocketInboundMessage, { type: "typing-lobby" }>["rooms"][number];

const EMPTY_MEDIA_STATE: GlobalMediaState = {
  url: null,
  provider: null,
  startedBy: null,
  startedByNick: "",
  playing: false,
  paused: false,
  volume: 0.72,
  position: 0,
  startedAt: 0,
  updatedAt: 0,
};

const EMPTY_ITEM_STATE: WorldItemState = {
  batOwnerId: null,
  umbrellaOwners: [],
  openUmbrellas: [],
  biribaBallOwners: [],
};

export default function GameView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nick = readGameRouteNick(searchParams);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameApiRef = useRef<GameEngineApi | null>(null);
  const multiplayerRef = useRef<ReturnType<typeof connectMultiplayer> | null>(null);
  const voiceRef = useRef<ReturnType<typeof createVoiceChat> | null>(null);
  const localIdRef = useRef<string | null>(null);
  const npcAuthorityIdRef = useRef<string | null>(null);
  const npcSnapshotRef = useRef<Extract<SocketInboundMessage, { type: "npc-state" }>["npcs"]>([]);
  const espectroSnapshotRef = useRef<Extract<SocketInboundMessage, { type: "espectro-spawn" }>["espectro"] | null>(null);
  const worldItemStateRef = useRef<WorldItemState>(EMPTY_ITEM_STATE);
  const itemSequenceRef = useRef(0);
  const swimSequenceRef = useRef(0);
  const typingSequenceRef = useRef(0);
  const modalActivityBusyRef = useRef(false);
  const mobileRunRef = useRef<boolean>(false);
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>(getInitialVoiceState);
  const [connection, setConnection] = useState<GameConnectionState>("connecting");
  const [onlinePlayers, setOnlinePlayers] = useState<GameOnlinePlayer[]>([]);
  const [avatar] = useState(() => readStoredAvatar());
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [mediaState, setMediaState] = useState<GlobalMediaState>(EMPTY_MEDIA_STATE);
  const [worldItemState, setWorldItemState] = useState<WorldItemState>(EMPTY_ITEM_STATE);
  const [swimDuel, setSwimDuel] = useState<SwimmingDuelState | null>(null);
  const [typingPanelOpen, setTypingPanelOpen] = useState(false);
  const [typingComputerId, setTypingComputerId] = useState("pc-1");
  const [typingIncoming, setTypingIncoming] = useState<TypingIncoming | null>(null);
  const [typingRoom, setTypingRoom] = useState<TypingRoomState | null>(null);
  const [typingLobby, setTypingLobby] = useState<TypingLobbyRoom[]>([]);
  const [typingMatch, setTypingMatch] = useState<TypingMatchUi | null>(null);
  const [pvpState, setPvpState] = useState<GamePvpState | null>(null);
  const pvpStateRef = useRef<GamePvpState | null>(null);
  const pvpCountdown = useMemo(() => createPvpCountdownController(), []);
  const [atmosphere, setAtmosphere] = useState(defaultAtmosphereState);
  const [audioState, setAudioState] = useState<AmbientAudioState>(defaultAmbientAudioState);
  const [playerState, setPlayerState] = useState<PlayerStatusState>(defaultPlayerStatusState);
  const [espectroNotice, setEspectroNotice] = useState("");
  const [pokerState, setPokerState] = useState<PokerState | null>(null);
  const [pokerHole, setPokerHole] = useState<PokerHoleCards | null>(null);
  const [pokerError, setPokerError] = useState<string | null>(null);
  const [pokerHudOpen, setPokerHudOpen] = useState(false);
  const [chessState, setChessState] = useState<ChessState | null>(null);
  const [chessError, setChessError] = useState<string | null>(null);
  const [chessHudOpen, setChessHudOpen] = useState(false);
  const espectroNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatFocusedRef = useRef(false);
  const mediaFocusedRef = useRef(false);
  const serverNowRef = useRef<number | null>(null);
  const serverSyncedAtRef = useRef<number | null>(null);
  const {
    chatVisible,
    playersVisible,
    setChatVisible,
    hideOverlays,
  } = useGameOverlayVisibility();
  const { mobileMode, orientationMessage, portraitLocked, requestLandscape } = useMobileViewport({
    onFirstMobileLayout: hideOverlays,
  });
  const {
    stick: mobileStick,
    joystickRef,
    handleJoystickPointerDown,
    handleJoystickPointerMove,
    handleJoystickPointerUp,
    setMobileRun: setMobileRunInput,
    handleMobileAction: handleMobileActionInput,
  } = useMobileControls({
    gameApiRef: gameApiRef,
    mobileRunRef,
  });
  useEffect(() => {
    pvpStateRef.current = pvpState;
  }, [pvpState]);

  useEffect(() => {
    modalActivityBusyRef.current = Boolean(
      swimDuel ||
      typingIncoming ||
      typingRoom ||
      (typingMatch && !typingMatch.ended)
    );
  }, [swimDuel, typingIncoming, typingRoom, typingMatch]);

  function getEstimatedServerNow() {
    const serverNow = serverNowRef.current;
    const syncedAt = serverSyncedAtRef.current;
    return typeof serverNow === "number" && typeof syncedAt === "number"
      ? serverNow + (Date.now() - syncedAt)
      : Date.now();
  }

  function showGameplayNotice(message: string) {
    setEspectroNotice(message);
    if (espectroNoticeTimerRef.current) clearTimeout(espectroNoticeTimerRef.current);
    espectroNoticeTimerRef.current = setTimeout(() => {
      setEspectroNotice("");
      espectroNoticeTimerRef.current = null;
    }, 4500);
  }

  function updateWorldItems(next: WorldItemState) {
    const localId = localIdRef.current;
    const gainedBiribaBall = !!localId &&
      !worldItemStateRef.current.biribaBallOwners.includes(localId) &&
      next.biribaBallOwners.includes(localId);
    worldItemStateRef.current = next;
    setWorldItemState(next);
    if (gainedBiribaBall) showGameplayNotice("Você recebeu a Bola Errante do Biriba. Use Q para lançar.");
  }

  function handleGameplayEvent(event: SocketInboundMessage) {
    if (event.type === "swim-challenge") {
      setSwimDuel({ phase: "incoming", ...event });
      return;
    }
    if (event.type === "swim-start") {
      const localId = localIdRef.current;
      const side = event.playerA === localId ? "A" : "B";
      const scores = [
        { playerId: event.playerA, nick: event.nickA, strokes: 0, progress: 0 },
        { playerId: event.playerB, nick: event.nickB, strokes: 0, progress: 0 },
      ];
      swimSequenceRef.current = 0;
      setSwimDuel({ phase: "active", ...event, scores });
      gameApiRef.current?.swimStartNetwork?.({
        matchId: event.matchId,
        side,
        startAt: event.startAt,
        endAt: event.endAt,
      });
      return;
    }
    if (event.type === "swim-progress") {
      setSwimDuel((current) => current?.phase === "active" && current.matchId === event.matchId
        ? { ...current, scores: event.scores }
        : current);
      gameApiRef.current?.swimApplyNetworkProgress?.(event.matchId, event.scores, localIdRef.current);
      return;
    }
    if (event.type === "swim-end") {
      gameApiRef.current?.swimEndNetwork?.(event.matchId);
      setSwimDuel({ phase: "ended", ...event });
      return;
    }
    if (event.type === "swim-declined" || event.type === "swim-cancelled") {
      setSwimDuel(null);
      showGameplayNotice(event.type === "swim-declined" ? `${event.opponentNick} recusou o duelo.` : event.reason);
      return;
    }
    if (event.type === "typing-challenge") {
      setTypingIncoming(event);
      setTypingPanelOpen(true);
      return;
    }
    if (event.type === "typing-lobby") {
      setTypingLobby(event.rooms);
      return;
    }
    if (event.type === "typing-room-state") {
      setTypingRoom(event);
      setTypingPanelOpen(true);
      return;
    }
    if (event.type === "typing-start") {
      typingSequenceRef.current = 0;
      setTypingIncoming(null);
      setTypingRoom(null);
      setTypingPanelOpen(true);
      setTypingMatch({
        start: event,
        ended: null,
        results: event.participants.map((participant) => ({
          ...participant,
          progress: 0,
          timeMs: null,
          accuracy: 100,
          errors: 0,
          wpm: 0,
          cpm: 0,
          rank: null,
          finished: false,
        })),
      });
      return;
    }
    if (event.type === "typing-progress") {
      setTypingMatch((current) => current && current.start.matchId === event.matchId
        ? { ...current, results: event.results }
        : current);
      return;
    }
    if (event.type === "typing-end") {
      setTypingMatch((current) => current && current.start.matchId === event.matchId
        ? { ...current, results: event.results, ended: event }
        : current);
      return;
    }
    if (event.type === "typing-declined" || event.type === "typing-cancelled") {
      setTypingIncoming(null);
      setTypingMatch(null);
      showGameplayNotice(event.type === "typing-declined" ? `${event.opponentNick} recusou o duelo.` : event.reason);
      return;
    }
    if (event.type === "gameplay-error") {
      showGameplayNotice(event.message);
    }
  }

  // Reflete o estado do pôquer na mesa 3D (cartas, fichas, jogadores, pote).
  useEffect(() => {
    const api = gameApiRef.current;
    if (!api?.updatePoker) return;
    const localSeat =
      pokerState?.seats.find(
        (s) => s.playerId && s.playerId === localIdRef.current,
      )?.index ?? null;
    api.updatePoker(pokerState ?? null, pokerHole ?? null, localSeat);
  }, [pokerState, pokerHole]);

  useEffect(() => {
    return () => {
      if (espectroNoticeTimerRef.current) {
        clearTimeout(espectroNoticeTimerRef.current);
        espectroNoticeTimerRef.current = null;
      }
      pvpCountdown.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let game: GameEngineApi | null = null;
    let multiplayer: ReturnType<typeof connectMultiplayer> | null = null;
    let voice: ReturnType<typeof createVoiceChat> | null = null;
    const publicEnv = readPublicEnv();
    const handleMultiplayerEvent = createGameViewEventHandler({
      nick,
      localIdRef,
      npcAuthorityIdRef,
      npcSnapshotRef,
      espectroSnapshotRef,
      serverNowRef,
      serverSyncedAtRef,
      pvpStateRef,
      pvpCountdown,
      espectroNoticeTimerRef,
      getGame: () => gameApiRef.current,
      getVoice: () => voiceRef.current,
      setConnection,
      setOnlinePlayers,
      setChatMessages,
      setPvpState,
      setEspectroNotice,
      setPokerState,
      setPokerHole,
      setPokerError,
      setChessState,
      setChessError,
      setMediaState,
      setWorldItemState: updateWorldItems,
      onGameplayEvent: handleGameplayEvent,
    });

    function boot() {
      if (cancelled || !containerRef.current) return;

      voice = createVoiceChat({
        onChange: setVoiceState,
        sendReady: ({ enabled, muted }) => {
          multiplayer?.sendVoiceReady(enabled, muted);
        },
        sendSignal: (target, signal) => {
          multiplayer?.sendVoiceSignal(target, signal);
        },
      });
      voiceRef.current = voice;

      multiplayer = connectMultiplayer({
        nickname: nick,
        avatar,
        host: publicEnv.NEXT_PUBLIC_PARTYKIT_HOST,
        onEvent: handleMultiplayerEvent,
      });
      multiplayerRef.current = multiplayer;

      game = bootGame({
        container: containerRef.current,
        nickname: nick,
        avatar,
        shouldIgnoreKeys: () => chatFocusedRef.current || mediaFocusedRef.current,
        getWorldTime: () => {
          const serverNow = serverNowRef.current;
          const syncedAt = serverSyncedAtRef.current;
          if (typeof serverNow === "number" && typeof syncedAt === "number") {
            return (serverNow + (Date.now() - syncedAt)) / 1000;
          }
          return Date.now() / 1000;
        },
        onLocalState: (state) => {
          setOnlinePlayers((prev) => patchOnlinePlayer(prev, localIdRef.current, { activity: state.activity || "idle" }));
          multiplayer?.sendState(state);
        },
        onLocalEntityState: (state) => {
          multiplayer?.sendEntityState(state);
        },
        onNpcState: (npcs) => {
          multiplayer?.sendNpcState(npcs);
        },
        onAtmosphereChange: setAtmosphere,
        onAudioStateChange: setAudioState,
        onPlayerStateChange: setPlayerState,
        onEmote: (emote) => {
          multiplayer?.sendEmote(emote.kind, emote.duration);
        },
        onMediaBoothInteract: () => {
          setMediaPanelOpen(true);
        },
        onComputerInteract: (computerId) => {
          setTypingComputerId(computerId);
          setTypingPanelOpen(true);
        },
        onItemPickup: (itemId) => {
          multiplayer?.sendItemPickup?.(itemId);
        },
        onItemUse: (itemId, targetId) => {
          multiplayer?.sendItemUse?.(itemId, ++itemSequenceRef.current, targetId || undefined);
        },
        onSwimStroke: (matchId) => {
          multiplayer?.sendSwimStroke?.(matchId, ++swimSequenceRef.current);
        },
        onSwimQuit: (matchId) => {
          multiplayer?.sendSwimQuit?.(matchId);
          setSwimDuel(null);
        },
        onPokerSeatInteract: (seatIndex) => {
          multiplayer?.sendPokerSit?.(seatIndex);
          setPokerHudOpen(true);
        },
        onChessSeatInteract: (color) => {
          multiplayer?.sendChessSit?.(color);
          setChessHudOpen(true);
        },
        onPvpThrow: (matchId, dx, dz, x, z) => {
          multiplayer?.sendPvpThrow(matchId, dx, dz, x, z);
        },
        onPvpHit: (matchId, victimId) => {
          multiplayer?.sendPvpHit(matchId, victimId);
        },
        onEspectroConsumed: (seed, outcome) => {
          multiplayer?.sendEspectroConsumed?.(seed, outcome);
        },
        onEspectroDuelStart: (seed) => {
          multiplayer?.sendEspectroDuelStart?.(seed);
        },
        onEspectroDuelHit: (seed, sequence) => {
          multiplayer?.sendEspectroDuelHit?.(seed, sequence);
        },
        onSecretDisconnect: () => {
          multiplayerRef.current?.close?.();
          setConnection("disconnected");
          router.push("/");
        },
        canStartBiribaSecret: () => !modalActivityBusyRef.current,
      });
      game.setNpcAuthority?.(
        !!localIdRef.current && npcAuthorityIdRef.current === localIdRef.current
      );
      game.applyNpcSnapshots?.(npcSnapshotRef.current);
      if (espectroSnapshotRef.current) {
        game.espectroSpawn?.(espectroSnapshotRef.current);
      }
      game.applyWorldItems?.(worldItemStateRef.current, localIdRef.current);
      gameApiRef.current = game;
    }

    boot();

    return () => {
      cancelled = true;
      try {
        gameApiRef.current?.destroy?.();
      } catch {}
      try {
        voiceRef.current?.close?.();
      } catch {}
      try {
        multiplayerRef.current?.close?.();
      } catch {}
      gameApiRef.current = null;
      multiplayerRef.current = null;
      voiceRef.current = null;
      pvpCountdown.clear();
    };
  }, [nick, avatar]);

  function handleSendChat(text: string) {
    const trimmed = (text || "").trim();
    if (!trimmed) return false;
    multiplayerRef.current?.sendChat(trimmed);
    return true;
  }

  function handleReactToMessage(message: GameChatMessage) {
    if (!message?.key || !message?.id || message.id === "__system__") return;
    setChatMessages((prev) => bumpChatLikeCount(prev, message.key));
    multiplayerRef.current?.sendReaction?.(message.key, "like");
    const target =
      message.id === localIdRef.current ? "__local__" : message.id;
    gameApiRef.current?.triggerReaction?.(target, "like");
  }

  function handlePvpChallenge(targetId: string) {
    multiplayerRef.current?.sendPvpChallenge?.(targetId);
  }

  function handleSwimChallenge(targetId: string) {
    multiplayerRef.current?.sendSwimChallenge?.(targetId);
    showGameplayNotice("Desafio de natação enviado.");
  }

  function handleSwimAccept() {
    if (swimDuel?.phase !== "incoming") return;
    multiplayerRef.current?.sendSwimRespond?.(swimDuel.matchId, true);
  }

  function handleSwimDecline() {
    if (swimDuel?.phase !== "incoming") return;
    multiplayerRef.current?.sendSwimRespond?.(swimDuel.matchId, false);
    setSwimDuel(null);
  }

  function handleSwimQuit() {
    if (!swimDuel || swimDuel.phase === "ended") return;
    multiplayerRef.current?.sendSwimQuit?.(swimDuel.matchId);
    gameApiRef.current?.swimEndNetwork?.(swimDuel.matchId);
    setSwimDuel(null);
  }

  function closeTypingPanel() {
    if (typingRoom) multiplayerRef.current?.sendTypingRoomLeave?.(typingRoom.roomId);
    setTypingRoom(null);
    setTypingPanelOpen(false);
  }

  function quitTypingMatch() {
    if (typingMatch && !typingMatch.ended) {
      multiplayerRef.current?.sendTypingQuit?.(typingMatch.start.matchId);
    }
    setTypingMatch(null);
    setTypingPanelOpen(false);
  }

  function handlePvpAccept() {
    const cur = pvpStateRef.current;
    if (!cur || cur.phase !== "incoming") return;
    multiplayerRef.current?.sendPvpRespond?.(cur.matchId, true);
  }

  function handlePvpDecline() {
    const cur = pvpStateRef.current;
    if (!cur || cur.phase !== "incoming") return;
    multiplayerRef.current?.sendPvpRespond?.(cur.matchId, false);
    pvpCountdown.clear();
    setPvpState(null);
  }

  function handlePvpQuit() {
    const cur = pvpStateRef.current;
    if (!cur || cur.phase === "ended") return;
    multiplayerRef.current?.sendPvpQuit?.(cur.matchId);
    pvpCountdown.clear();
    if (gameApiRef.current) {
      gameApiRef.current.pvpSetMatch(null);
      gameApiRef.current.pvpReturnFromArena();
    }
    setPvpState(null);
  }

  function handlePvpDismiss() {
    pvpCountdown.clear();
    setPvpState(null);
  }

  function handleStartVoice() {
    voiceRef.current?.start?.();
  }

  function handleStopVoice() {
    voiceRef.current?.stop?.();
  }

  function handleToggleMute() {
    voiceRef.current?.setMuted?.(!voiceState.muted);
  }

  function handleUnlockAudio() {
    voiceRef.current?.unlockAudio?.();
  }

  function handleChatFocusChange(focused: boolean) {
    chatFocusedRef.current = focused;
  }

  function handleMediaFocusChange(focused: boolean) {
    mediaFocusedRef.current = focused;
  }

  return (
    <div
      id="app"
      ref={containerRef}
      className={`game-shell${mobileMode ? " is-mobile" : ""}${portraitLocked ? " is-portrait" : ""}`}
    >
      <canvas data-game="scene"></canvas>

      <div className="game-overlay">
        {playersVisible && (
          <OnlinePlayersPanel
            players={onlinePlayers}
            pvpState={pvpState}
            onChallenge={handlePvpChallenge}
            onSwimChallenge={handleSwimChallenge}
          />
        )}

        {espectroNotice ? (
          <div className="espectro-notice" role="status" aria-live="polite">
            {espectroNotice}
          </div>
        ) : null}

        {(
          worldItemState.batOwnerId === localIdRef.current ||
          worldItemState.umbrellaOwners.includes(localIdRef.current || "") ||
          worldItemState.biribaBallOwners.includes(localIdRef.current || "")
        ) ? (
          <div className="item-hud" aria-label="Itens equipados">
            {worldItemState.batOwnerId === localIdRef.current ? <span>🏏 Taco · R para rebater</span> : null}
            {worldItemState.umbrellaOwners.includes(localIdRef.current || "") ? (
              <span>☂️ Guarda-chuva · U para {worldItemState.openUmbrellas.includes(localIdRef.current || "") ? "fechar" : "abrir"}</span>
            ) : null}
            {worldItemState.biribaBallOwners.includes(localIdRef.current || "") ? (
              <span>🟣 Bola Errante · Q para lançar</span>
            ) : null}
          </div>
        ) : null}

        <div className="game-header-area">
          <div className="game-left-stack">
            <VoiceChat
              voice={voiceState}
              connection={connection}
              onStart={handleStartVoice}
              onStop={handleStopVoice}
              onToggleMute={handleToggleMute}
              onUnlockAudio={handleUnlockAudio}
            />
          </div>

          <div className="game-right-stack">
            <div className="minimap" aria-hidden="true">
              <div className="minimap-head">
                <div className="minimap-title-group">
                  <span className="minimap-kicker">Campus map</span>
                  <strong className="minimap-title">Mapa do campus</strong>
                </div>
                <span className="minimap-compass" title="Norte">N</span>
              </div>
              <canvas data-game="minimap-canvas" width="220" height="220"></canvas>
              <div className="minimap-legend">
                <span><i className="legend-swatch legend-player" /> voce</span>
                <span><i className="legend-swatch legend-remote" /> outros</span>
                <span><i className="legend-swatch legend-path" /> caminho</span>
              </div>
            </div>

            <div className="game-emote-shell">
              <div className="emote-bar" aria-label="Emotes rápidos">
                {emoteBar.map((emote) => (
                  <button
                    key={emote.kind}
                    type="button"
                    className="emote-chip"
                    onClick={() => gameApiRef.current?.triggerLocalEmote?.(emote.kind, getEmoteDuration(emote.kind))}
                    title={`${emote.label} (${emote.short})`}
                  >
                    <span className="emote-glyph" aria-hidden="true">{emote.glyph}</span>
                    <span className="emote-label">{emote.label}</span>
                    <span className="emote-short">{emote.short}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="menu-back"
            >
              ← Menu
            </button>

            <MediaPlayerPanel
              open={mediaPanelOpen}
              state={mediaState}
              getServerNow={getEstimatedServerNow}
              onSetUrl={(url) => multiplayerRef.current?.sendMediaSet?.(url)}
              onControl={(action, volume) => multiplayerRef.current?.sendMediaControl?.(action, volume)}
              onClose={() => setMediaPanelOpen(false)}
              onFocusChange={handleMediaFocusChange}
            />
          </div>
        </div>

        {pokerHudOpen && (
          <PokerHud
            state={pokerState}
            holeCards={pokerHole}
            localId={localIdRef.current}
            errorMessage={pokerError}
            onStand={() => {
              gameApiRef.current?.exitSit?.();
              multiplayerRef.current?.sendPokerStand?.();
              setPokerHole(null);
              setPokerHudOpen(false);
            }}
            onAction={(action, amount) => {
              multiplayerRef.current?.sendPokerAction?.(action, amount);
            }}
            onDismissError={() => setPokerError(null)}
          />
        )}

        {chessHudOpen && (
          <ChessHud
            state={chessState}
            localId={localIdRef.current}
            errorMessage={chessError}
            onSit={(color) => {
              multiplayerRef.current?.sendChessSit?.(color);
            }}
            onStand={() => {
              gameApiRef.current?.exitSit?.();
              multiplayerRef.current?.sendChessStand?.();
              setChessHudOpen(false);
            }}
            onMove={(from, to) => {
              multiplayerRef.current?.sendChessMove?.(from, to);
            }}
            onReset={() => {
              multiplayerRef.current?.sendChessReset?.();
            }}
            onDismissError={() => setChessError(null)}
          />
        )}

        <div className="game-bottom-row">
          <Chat
            messages={chatMessages}
            onSend={handleSendChat}
            onReact={handleReactToMessage}
            onFocusChange={handleChatFocusChange}
            connection={connection}
            myNick={nick}
            visible={chatVisible}
            onToggleVisible={() => setChatVisible((v) => !v)}
          />
        </div>

        {mobileMode && (
          <div className="mobile-controls" aria-label="Controles mobile">
            <div
              ref={joystickRef}
              className={`mobile-joystick${mobileStick.active ? " active" : ""}`}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
            >
              <span
                className="mobile-joystick-knob"
                style={{
                  transform: `translate(${mobileStick.x * 44}px, ${mobileStick.y * 44}px)`,
                }}
              />
            </div>

            <div className="mobile-action-pad">
              <button
                type="button"
                className="mobile-action mobile-action-run"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setMobileRunInput(true);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  setMobileRunInput(false);
                }}
                onPointerCancel={(event) => {
                  event.preventDefault();
                  setMobileRunInput(false);
                }}
                onPointerLeave={(event) => {
                  event.preventDefault();
                  setMobileRunInput(false);
                }}
              >
                Correr
              </button>
              <button
                type="button"
                className="mobile-action"
                onPointerDown={(event) => handleMobileActionInput(event, "jump")}
              >
                Pular
              </button>
              <button
                type="button"
                className="mobile-action mobile-action-primary"
                onPointerDown={(event) => handleMobileActionInput(event, "interact")}
              >
                Ação
              </button>
              {pvpState?.phase === "playing" && (
                <button
                  type="button"
                  className="mobile-action mobile-action-primary"
                  onPointerDown={(event) => { event.preventDefault(); gameApiRef.current?.queueMobilePvpThrow?.(); }}
                >
                  🏐 Lançar
                </button>
              )}
              {pvpState?.phase !== "playing" && worldItemState.biribaBallOwners.includes(localIdRef.current || "") && (
                <button
                  type="button"
                  className="mobile-action mobile-action-primary"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    gameApiRef.current?.queueMobilePvpThrow?.();
                  }}
                >
                  Lançar bola
                </button>
              )}
              {worldItemState.batOwnerId === localIdRef.current && (
                <button
                  type="button"
                  className="mobile-action mobile-action-primary"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    gameApiRef.current?.queueMobileItemUse?.();
                  }}
                >
                  Usar taco
                </button>
              )}
              {worldItemState.umbrellaOwners.includes(localIdRef.current || "") && (
                <button
                  type="button"
                  className="mobile-action"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    gameApiRef.current?.queueMobileUmbrellaUse?.();
                  }}
                >
                  {worldItemState.openUmbrellas.includes(localIdRef.current || "") ? "Fechar ☂" : "Abrir ☂"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PvP: desafio recebido */}
      {pvpState?.phase === "incoming" && (
        <div className="pvp-overlay pvp-challenge-overlay" role="dialog" aria-label="Desafio de queimado">
          <div className="pvp-card">
            <span className="pvp-card-icon">🏐</span>
            <strong className="pvp-card-title">Desafio de Queimado!</strong>
            <span className="pvp-card-sub">{pvpState.opponentNick} te desafiou para uma partida</span>
            <div className="pvp-card-actions">
              <button type="button" className="pvp-btn pvp-btn-accept" onClick={handlePvpAccept}>Aceitar</button>
              <button type="button" className="pvp-btn pvp-btn-decline" onClick={handlePvpDecline}>Recusar</button>
            </div>
          </div>
        </div>
      )}

      {/* PvP: contagem regressiva */}
      {pvpState?.phase === "countdown" && (
        <div className="pvp-overlay pvp-countdown-overlay">
          <div className="pvp-countdown-card">
            <span className="pvp-countdown-vs">{nick} <em>vs</em> {pvpState.opponentNick}</span>
            <span className="pvp-countdown-num">{pvpState.countdownVal ?? "3"}</span>
            <span className="pvp-countdown-hint">Prepare-se! Pressione Q para lançar a bola</span>
          </div>
        </div>
      )}

      {/* PvP: HUD durante a partida */}
      {pvpState?.phase === "playing" && (
        <div className="pvp-hud">
          <div className="pvp-hud-side pvp-hud-mine">
            <span className="pvp-hud-name">{nick}</span>
            <span className="pvp-hud-hits">
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={`pvp-hit-dot${i < pvpState.myHits ? " burned" : ""}`}>●</span>
              ))}
            </span>
          </div>
          <div className="pvp-hud-center">🏐</div>
          <div className="pvp-hud-side pvp-hud-opponent">
            <span className="pvp-hud-name">{pvpState.opponentNick}</span>
            <span className="pvp-hud-hits">
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={`pvp-hit-dot${i < pvpState.opponentHits ? " burned" : ""}`}>●</span>
              ))}
            </span>
          </div>
          <button type="button" className="pvp-quit-btn" onClick={handlePvpQuit} title="Desistir">✕</button>
        </div>
      )}

      {/* PvP: fim de partida */}
      {pvpState?.phase === "ended" && (
        <div className="pvp-overlay pvp-end-overlay" role="dialog" aria-label="Resultado da partida">
          <div className="pvp-card">
            <span className="pvp-card-icon">{pvpState.winner === localIdRef.current ? "🏆" : "💀"}</span>
            <strong className="pvp-card-title">
              {pvpState.winner === localIdRef.current ? "Você venceu!" : "Você perdeu!"}
            </strong>
            <span className="pvp-card-sub">
              {pvpState.forfeit
                ? (pvpState.winner === localIdRef.current ? `${pvpState.opponentNick} desistiu` : "Você desistiu")
                : `${pvpState.winnerNick} ganhou a partida`}
            </span>
            <button type="button" className="pvp-btn pvp-btn-accept" onClick={handlePvpDismiss}>Fechar</button>
          </div>
        </div>
      )}

      <SwimmingDuelHud
        state={swimDuel}
        localId={localIdRef.current}
        getServerNow={getEstimatedServerNow}
        onAccept={handleSwimAccept}
        onDecline={handleSwimDecline}
        onQuit={handleSwimQuit}
        onDismiss={() => setSwimDuel(null)}
      />

      <TypingGamePanel
        open={typingPanelOpen}
        computerId={typingComputerId}
        localId={localIdRef.current}
        players={onlinePlayers}
        incoming={typingIncoming}
        room={typingRoom}
        lobby={typingLobby}
        match={typingMatch}
        getServerNow={getEstimatedServerNow}
        onClose={closeTypingPanel}
        onSolo={() => multiplayerRef.current?.sendTypingSolo?.(typingComputerId)}
        onChallenge={(playerId) => multiplayerRef.current?.sendTypingChallenge?.(playerId, typingComputerId)}
        onRespond={(accepted) => {
          if (!typingIncoming) return;
          multiplayerRef.current?.sendTypingRespond?.(typingIncoming.matchId, accepted);
          if (!accepted) setTypingIncoming(null);
        }}
        onCreateRoom={() => multiplayerRef.current?.sendTypingRoomCreate?.(typingComputerId)}
        onJoinRoom={(roomId) => multiplayerRef.current?.sendTypingRoomJoin?.(roomId)}
        onLeaveRoom={() => {
          if (typingRoom) multiplayerRef.current?.sendTypingRoomLeave?.(typingRoom.roomId);
          setTypingRoom(null);
        }}
        onStartRoom={() => {
          if (typingRoom) multiplayerRef.current?.sendTypingRoomStart?.(typingRoom.roomId);
        }}
        onInput={(typed) => {
          if (!typingMatch || typingMatch.ended) return;
          multiplayerRef.current?.sendTypingInput?.(typingMatch.start.matchId, typed, ++typingSequenceRef.current);
        }}
        onQuitMatch={quitTypingMatch}
      />

      {mobileMode && portraitLocked && (
        <div className="mobile-orientation-gate" role="dialog" aria-label="Tela horizontal">
          <div className="mobile-orientation-card">
            <strong>Tela horizontal</strong>
            <span>{orientationMessage || "Gire o aparelho para jogar."}</span>
            <button
              type="button"
              onClick={() => requestLandscape({ preferFullscreen: true })}
            >
              Virar tela
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
