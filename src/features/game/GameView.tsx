"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chat from "@/features/chat/Chat";
import MediaPlayerPanel from "@/features/media/MediaPlayerPanel";
import VoiceChat from "@/features/multiplayer/VoiceChat";
import { readStoredAvatar } from "@/features/avatar/avatarConfig";
import { bootGame } from "@/features/game/engine";
import OnlinePlayersPanel from "@/features/game/OnlinePlayersPanel";
import PokerHud from "@/features/game/PokerHud";
import ChessHud from "@/features/game/ChessHud";
import { createPvpCountdownController } from "@/features/game/pvpCountdown";
import {
  patchOnlinePlayer,
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
import { defaultAtmosphereState } from "@/shared/schemas/atmosphere";
import { readPublicEnv } from "@/shared/schemas/env";
import { readGameRouteNick } from "@/shared/schemas/gameRoute";

export default function GameView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nick = readGameRouteNick(searchParams);

  const containerRef = useRef(null);
  const gameApiRef = useRef(null);
  const multiplayerRef = useRef(null);
  const voiceRef = useRef(null);
  const localIdRef = useRef(null);
  const npcAuthorityIdRef = useRef(null);
  const npcSnapshotRef = useRef([]);
  const espectroSnapshotRef = useRef(null);
  const mobileRunRef = useRef(false);
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState(getInitialVoiceState);
  const [connection, setConnection] = useState("connecting");
  const [chatFocused, setChatFocused] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<GameOnlinePlayer[]>([]);
  const [avatar, setAvatar] = useState(null);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [mediaFocused, setMediaFocused] = useState(false);
  const [pvpState, setPvpState] = useState<GamePvpState | null>(null);
  const pvpStateRef = useRef<GamePvpState | null>(null);
  const pvpCountdownRef = useRef<ReturnType<typeof createPvpCountdownController> | null>(null);
  const [atmosphere, setAtmosphere] = useState(defaultAtmosphereState);
  const [cameraMode, setCameraMode] = useState({
    mode: "follow",
    label: "travada",
    focusLabel: "",
  });
  const [audioState, setAudioState] = useState({
    enabled: true,
    label: "ativo",
  });
  const [playerState, setPlayerState] = useState({
    kind: "idle",
    label: "parado",
    detail: "vagando pelo campus",
  });
  const [espectroNotice, setEspectroNotice] = useState("");
  const [pokerState, setPokerState] = useState(null);
  const [pokerHole, setPokerHole] = useState(null);
  const [pokerError, setPokerError] = useState(null);
  const [pokerHudOpen, setPokerHudOpen] = useState(false);
  const [chessState, setChessState] = useState(null);
  const [chessError, setChessError] = useState(null);
  const [chessHudOpen, setChessHudOpen] = useState(false);
  const espectroNoticeTimerRef = useRef(null);
  const chatFocusedRef = useRef(false);
  const mediaFocusedRef = useRef(false);
  const serverNowRef = useRef(null);
  const serverSyncedAtRef = useRef(null);
  const {
    chatVisible,
    playersVisible,
    setChatVisible,
    setPlayersVisible,
  } = useGameOverlayVisibility();
  const { mobileMode, orientationMessage, portraitLocked, requestLandscape } = useMobileViewport({
    onFirstMobileLayout: () => {
      setChatVisible(false);
      setPlayersVisible(false);
    },
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
  const emoteBar = [
    { kind: "dance", label: "Dançar", short: "G", glyph: "🕺" },
    { kind: "laugh", label: "Rir", short: "1", glyph: "😂" },
    { kind: "sixseven", label: "67", short: "2", glyph: "🤲" },
    { kind: "wave", label: "Acenar", short: "3", glyph: "👋" },
    { kind: "point", label: "Apontar", short: "4", glyph: "👉" },
    { kind: "cheer", label: "Comemorar", short: "5", glyph: "🎉" },
  ];

  function getEmoteDuration(kind) {
    if (kind === "dance") return 8.0;
    if (kind === "sixseven") return 3.4;
    if (kind === "glitch") return 2.2;
    if (kind === "cheer") return 3.2;
    return 2.4;
  }

  useEffect(() => {
    pvpStateRef.current = pvpState;
  }, [pvpState]);

  useEffect(() => {
    chatFocusedRef.current = chatFocused;
  }, [chatFocused]);

  useEffect(() => {
    mediaFocusedRef.current = mediaFocused;
  }, [mediaFocused]);

  useEffect(() => {
    return () => {
      if (espectroNoticeTimerRef.current) {
        clearTimeout(espectroNoticeTimerRef.current);
        espectroNoticeTimerRef.current = null;
      }
      pvpCountdownRef.current?.clear();
    };
  }, []);

  if (!pvpCountdownRef.current) {
    pvpCountdownRef.current = createPvpCountdownController();
  }

  useEffect(() => {
    setAvatar(readStoredAvatar());
  }, []);

  useEffect(() => {
    if (!avatar) return undefined;
    let cancelled = false;
    let game = null;
    let multiplayer = null;
    let voice = null;
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
      pvpCountdownRef,
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
          multiplayer.sendState(state);
        },
        onLocalEntityState: (state) => {
          multiplayer.sendEntityState(state);
        },
        onNpcState: (npcs) => {
          multiplayer.sendNpcState(npcs);
        },
        onAtmosphereChange: setAtmosphere,
        onCameraModeChange: setCameraMode,
        onAudioStateChange: setAudioState,
        onPlayerStateChange: setPlayerState,
        onEmote: (emote) => {
          multiplayer.sendEmote(emote.kind, emote.duration);
        },
        onMediaBoothInteract: () => {
          setMediaPanelOpen(true);
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
          multiplayer.sendPvpThrow(matchId, dx, dz, x, z);
        },
        onPvpHit: (matchId, victimId) => {
          multiplayer.sendPvpHit(matchId, victimId);
        },
        onEspectroConsumed: (seed) => {
          multiplayer.sendEspectroConsumed?.(seed);
        },
        onSecretDisconnect: () => {
          multiplayerRef.current?.close?.();
          setConnection("disconnected");
          router.push("/");
        },
      });
      game.setNpcAuthority?.(
        !!localIdRef.current && npcAuthorityIdRef.current === localIdRef.current
      );
      game.applyNpcSnapshots?.(npcSnapshotRef.current);
      if (espectroSnapshotRef.current) {
        game.espectroSpawn?.(espectroSnapshotRef.current);
      }
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
    };
  }, [nick, avatar]);

  if (!avatar) {
    return <div style={{ color: "#fff", padding: 24 }}>Carregando...</div>;
  }

  function handleSendChat(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return false;
    multiplayerRef.current?.sendChat(trimmed);
    return true;
  }

  function handleReactToMessage(message) {
    if (!message?.key || !message?.id || message.id === "__system__") return;
    setChatMessages((prev) =>
      prev.map((entry) =>
        entry.key === message.key
          ? { ...entry, likeCount: (entry.likeCount || 0) + 1 }
          : entry
      )
    );
    multiplayerRef.current?.sendReaction?.(message.key, "like");
    const target =
      message.id === localIdRef.current ? "__local__" : message.id;
    gameApiRef.current?.triggerReaction?.(target, "like");
  }

  function handlePvpChallenge(targetId) {
    multiplayerRef.current?.sendPvpChallenge?.(targetId);
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
    pvpCountdownRef.current?.clear();
    setPvpState(null);
  }

  function handlePvpQuit() {
    const cur = pvpStateRef.current;
    if (!cur || cur.phase === "ended") return;
    multiplayerRef.current?.sendPvpQuit?.(cur.matchId);
    pvpCountdownRef.current?.clear();
    if (gameApiRef.current) {
      gameApiRef.current.pvpSetMatch(null);
      gameApiRef.current.pvpReturnFromArena();
    }
    setPvpState(null);
  }

  function handlePvpDismiss() {
    pvpCountdownRef.current?.clear();
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
          />
        )}

        {espectroNotice ? (
          <div className="espectro-notice" role="status" aria-live="polite">
            {espectroNotice}
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
              onClose={() => setMediaPanelOpen(false)}
              onFocusChange={setMediaFocused}
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
            onFocusChange={setChatFocused}
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
              <button
                type="button"
                className="mobile-action"
                onPointerDown={(event) => handleMobileActionInput(event, "camera")}
              >
                Câmera
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
