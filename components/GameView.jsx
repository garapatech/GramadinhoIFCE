"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chat from "./Chat";
import VoiceChat from "./VoiceChat";
import { bootGame } from "../lib/game";
import { connectMultiplayer } from "../lib/multiplayer";
import { createVoiceChat, getInitialVoiceState } from "../lib/voice";

export default function GameView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nick = (searchParams.get("nick") || "").trim() || "Visitante";

  const containerRef = useRef(null);
  const gameApiRef = useRef(null);
  const multiplayerRef = useRef(null);
  const voiceRef = useRef(null);
  const localIdRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [voiceState, setVoiceState] = useState(getInitialVoiceState);
  const [connection, setConnection] = useState("connecting");
  const [chatFocused, setChatFocused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const chatFocusedRef = useRef(false);

  useEffect(() => {
    chatFocusedRef.current = chatFocused;
  }, [chatFocused]);

  useEffect(() => {
    let cancelled = false;
    let game = null;
    let multiplayer = null;
    let voice = null;

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
        onEvent: (event) => {
          if (event.type === "connected") {
            setConnection("connected");
          } else if (event.type === "disconnected") {
            setConnection("disconnected");
          } else if (event.type === "error") {
            setConnection("error");
          } else if (event.type === "init") {
            localIdRef.current = event.you;
            voice?.setLocalId(event.you);
            voice?.syncPlayers(event.players || []);
            if (event.history) {
              setChatMessages(event.history.map((m) => ({ ...m })));
            }
            if (game && event.players) {
              for (const p of event.players) {
                if (p.id !== event.you) game.addRemotePlayer(p);
              }
            }
          } else if (event.type === "join") {
            if (game && event.player) game.addRemotePlayer(event.player);
            if (event.player) voice?.addPlayer(event.player);
          } else if (event.type === "state") {
            if (game) game.updateRemotePlayer(event);
          } else if (event.type === "leave") {
            if (game) game.removeRemotePlayer(event.id);
            voice?.removePlayer(event.id);
          } else if (event.type === "emote") {
            if (game) game.triggerRemoteEmote(event.id, event.kind, event.duration);
          } else if (event.type === "voice-ready") {
            voice?.handleReady(event);
          } else if (event.type === "voice-signal") {
            voice?.handleSignal(event);
          } else if (event.type === "chat") {
            setChatMessages((prev) => {
              const next = [...prev, event];
              return next.length > 80 ? next.slice(next.length - 80) : next;
            });
            if (game && event.id !== "__system__" && event.text) {
              const target =
                event.id === localIdRef.current ? "__local__" : event.id;
              game.pushChatBubble(target, event.text);
            }
          }
        },
      });
      multiplayerRef.current = multiplayer;

      game = bootGame({
        container: containerRef.current,
        nickname: nick,
        shouldIgnoreKeys: () => chatFocusedRef.current,
        onLocalState: (state) => {
          multiplayer.sendState(state);
        },
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
        voiceRef.current?.close?.();
      } catch {}
      try {
        multiplayerRef.current?.close?.();
      } catch {}
      gameApiRef.current = null;
      multiplayerRef.current = null;
      voiceRef.current = null;
    };
  }, [nick]);

  function handleSendChat(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return false;
    multiplayerRef.current?.sendChat(trimmed);
    return true;
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

  return (
    <div id="app" ref={containerRef}>
      <div className="hud">
        <span className="hud-nick">{nick}</span>
      </div>
      <div className="status-box" data-game="status" aria-live="polite"></div>
      <div className="minimap" aria-hidden="true">
        <canvas data-game="minimap-canvas" width="220" height="220"></canvas>
      </div>
      <div className="speech" data-game="speech" aria-live="polite">
        <div className="speech-header">
          <span className="speech-name" data-game="speech-name">Aviso</span>
          <span className="speech-hint" data-game="speech-hint">[E]</span>
        </div>
        <div className="speech-body" data-game="speech-body"></div>
      </div>
      <canvas data-game="scene"></canvas>

      <VoiceChat
        voice={voiceState}
        connection={connection}
        onStart={handleStartVoice}
        onStop={handleStopVoice}
        onToggleMute={handleToggleMute}
      />

      <Chat
        messages={chatMessages}
        onSend={handleSendChat}
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
