"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chat from "./Chat";
import { bootGame } from "../lib/game";
import { connectMultiplayer } from "../lib/multiplayer";

export default function GameView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nick = (searchParams.get("nick") || "").trim() || "Visitante";

  const containerRef = useRef(null);
  const gameApiRef = useRef(null);
  const multiplayerRef = useRef(null);
  const localIdRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [connection, setConnection] = useState("connecting");
  const [chatFocused, setChatFocused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [atmosphere, setAtmosphere] = useState({
    label: "manhã",
    clock: "06:00",
    mood: "claro",
    weatherLabel: "ensolarado",
  });
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
  const chatFocusedRef = useRef(false);
  const serverNowRef = useRef(null);
  const serverSyncedAtRef = useRef(null);
  const emoteBar = [
    { kind: "dance", label: "Dançar", short: "G", glyph: "🕺" },
    { kind: "laugh", label: "Rir", short: "1", glyph: "😂" },
    { kind: "think", label: "Pensar", short: "2", glyph: "🤔" },
    { kind: "wave", label: "Acenar", short: "3", glyph: "👋" },
    { kind: "point", label: "Apontar", short: "4", glyph: "👉" },
    { kind: "cheer", label: "Comemorar", short: "5", glyph: "🎉" },
  ];

  function getEmoteDuration(kind) {
    if (kind === "dance") return 8.0;
    if (kind === "glitch") return 2.2;
    if (kind === "cheer") return 3.2;
    return 2.4;
  }

  function decorateMessage(message) {
    return {
      ...message,
      key: `${message.id}:${message.ts}`,
      likeCount: message.likeCount || 0,
    };
  }

  function bumpLikeCount(targetKey) {
    setChatMessages((prev) =>
      prev.map((message) =>
        message.key === targetKey
          ? { ...message, likeCount: (message.likeCount || 0) + 1 }
          : message
      )
    );
  }

  useEffect(() => {
    chatFocusedRef.current = chatFocused;
  }, [chatFocused]);

  useEffect(() => {
    let cancelled = false;
    let game = null;
    let multiplayer = null;

    function boot() {
      if (cancelled || !containerRef.current) return;

      multiplayer = connectMultiplayer({
        nickname: nick,
        onEvent: (event) => {
          if (event.type === "connected") {
            setConnection("connected");
          } else if (event.type === "disconnected") {
            setConnection("disconnected");
          } else if (event.type === "error") {
            setConnection("error");
          } else if (event.type === "init") {
            localIdRef.current = event.you;
            if (typeof event.serverNow === "number") {
              serverNowRef.current = event.serverNow;
              serverSyncedAtRef.current = Date.now();
            }
            if (event.history) {
              setChatMessages(event.history.map((m) => decorateMessage(m)));
            }
            if (game && event.players) {
              for (const p of event.players) {
                if (p.id !== event.you) game.addRemotePlayer(p);
              }
            }
          } else if (event.type === "clock") {
            if (typeof event.serverNow === "number") {
              serverNowRef.current = event.serverNow;
              serverSyncedAtRef.current = Date.now();
            }
          } else if (event.type === "join") {
            if (game && event.player) game.addRemotePlayer(event.player);
          } else if (event.type === "state") {
            if (game) game.updateRemotePlayer(event);
          } else if (event.type === "leave") {
            if (game) game.removeRemotePlayer(event.id);
          } else if (event.type === "emote") {
            if (game) game.triggerRemoteEmote(event.id, event.kind, event.duration);
          } else if (event.type === "chat") {
            setChatMessages((prev) => {
              const next = [...prev, decorateMessage(event)];
              return next.length > 80 ? next.slice(next.length - 80) : next;
            });
            if (game && event.id !== "__system__" && event.text) {
              const target =
                event.id === localIdRef.current ? "__local__" : event.id;
              game.pushChatBubble(target, event.text);
            }
          } else if (event.type === "reaction") {
            if (!event.targetId) return;
            if (event.targetKey) {
              bumpLikeCount(event.targetKey);
            }
            if (game && event.targetId !== "__system__") {
              const target =
                event.targetId === localIdRef.current ? "__local__" : event.targetId;
              if (target === "__local__") game.triggerReaction?.(target, event.kind || "like");
              else game.triggerRemoteReaction?.(target, event.kind || "like");
            }
          }
        },
      });
      multiplayerRef.current = multiplayer;

      game = bootGame({
        container: containerRef.current,
        nickname: nick,
        shouldIgnoreKeys: () => chatFocusedRef.current,
        getWorldTime: () => {
          const serverNow = serverNowRef.current;
          const syncedAt = serverSyncedAtRef.current;
          if (typeof serverNow === "number" && typeof syncedAt === "number") {
            return (serverNow + (Date.now() - syncedAt)) / 1000;
          }
          return Date.now() / 1000;
        },
        onLocalState: (state) => {
          multiplayer.sendState(state);
        },
        onAtmosphereChange: setAtmosphere,
        onCameraModeChange: setCameraMode,
        onAudioStateChange: setAudioState,
        onPlayerStateChange: setPlayerState,
        onEmote: (emote) => {
          multiplayer.sendEmote(emote.kind, emote.duration);
        },
      });
      gameApiRef.current = game;
    }

    boot();

    return () => {
      cancelled = true;
      try {
        gameApiRef.current?.destroy?.();
      } catch {}
      try {
        multiplayerRef.current?.close?.();
      } catch {}
      gameApiRef.current = null;
      multiplayerRef.current = null;
    };
  }, [nick]);

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

  return (
    <div id="app" ref={containerRef}>
      <div className="hud">
        <div className="hud-brand">
          <span className="hud-nick">{nick}</span>
          <span className="hud-campus">Gramadinho IFCE</span>
        </div>
        <div className="hud-stack">
          <div className="hud-row">
            <span className="hud-time" title={`Campus ${atmosphere.label} • clima ${atmosphere.mood}`}>
              {atmosphere.clock} • {atmosphere.label}
            </span>
            <span className="hud-state" title={`Estado atual do campus: ${atmosphere.mood}`}>
              {atmosphere.mood}
            </span>
            <span className="hud-weather" title={`Clima atual do campus: ${atmosphere.weatherLabel}`}>
              {atmosphere.weatherLabel}
            </span>
          </div>
          <div className="hud-row hud-row-actions">
            <span
              className={`hud-player hud-player-${playerState.kind}`}
              title={`Estado do player: ${playerState.detail}`}
            >
              {playerState.label}
            </span>
            <span
              className="hud-camera"
              title="C alterna entre câmera travada e livre. F foca o alvo mais próximo no modo livre"
            >
              câmera {cameraMode.label}{cameraMode.focusLabel ? ` • foco ${cameraMode.focusLabel}` : ""}
            </span>
            <span className="hud-audio hud-audio-on" title="Som ambiente do campus e rádio interna sempre ativos">
              som {audioState.label}
            </span>
          </div>
        </div>
      </div>
      <div className="status-box" data-game="status" aria-live="polite"></div>
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
      <div className="speech" data-game="speech" aria-live="polite">
        <div className="speech-header">
          <span className="speech-name" data-game="speech-name">Aviso</span>
          <span className="speech-hint" data-game="speech-hint">[E]</span>
        </div>
        <div className="speech-body" data-game="speech-body"></div>
      </div>
      <canvas data-game="scene"></canvas>

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

      <button
        type="button"
        onClick={() => router.push("/")}
        className="menu-back"
      >
        ← Menu
      </button>
    </div>
  );
}
