"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chat from "@/features/chat/Chat";
import MediaPlayerPanel from "@/features/media/MediaPlayerPanel";
import VoiceChat from "@/features/multiplayer/VoiceChat";
import { readStoredAvatar } from "@/features/avatar/avatarConfig";
import { bootGame } from "@/features/game/engine";
import { connectMultiplayer } from "@/features/multiplayer/client";
import { createVoiceChat, getInitialVoiceState } from "@/features/multiplayer/voice";

const ACTIVITY_LABEL = {
  idle: "parado",
  walking: "andando",
  running: "correndo",
  crouching: "agachado",
  sitting: "sentado",
  riding: "pedalando",
  emoting: "emote",
};

export default function GameView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nick = (searchParams.get("nick") || "").trim() || "Visitante";

  const containerRef = useRef(null);
  const gameApiRef = useRef(null);
  const multiplayerRef = useRef(null);
  const voiceRef = useRef(null);
  const localIdRef = useRef(null);
  const npcAuthorityIdRef = useRef(null);
  const npcSnapshotRef = useRef([]);
  const biribaSnapshotRef = useRef(null);
  const joystickRef = useRef(null);
  const joystickPointerRef = useRef(null);
  const mobileRunRef = useRef(false);
  const mobileLayoutAppliedRef = useRef(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [voiceState, setVoiceState] = useState(getInitialVoiceState);
  const [connection, setConnection] = useState("connecting");
  const [chatFocused, setChatFocused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [playersVisible, setPlayersVisible] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [avatar, setAvatar] = useState(null);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [mediaFocused, setMediaFocused] = useState(false);
  const [pvpState, setPvpState] = useState(null);
  // pvpState shape:
  // null | { phase: 'incoming'|'countdown'|'playing'|'ended',
  //          matchId, opponentId, opponentNick,
  //          myHits, opponentHits, side,
  //          winner, loser, winnerNick, forfeit }
  const pvpStateRef = useRef(null);
  const [mobileMode, setMobileMode] = useState(false);
  const [portraitLocked, setPortraitLocked] = useState(false);
  const [orientationMessage, setOrientationMessage] = useState("");
  const [stick, setStick] = useState({ active: false, x: 0, y: 0 });
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
  const [biribaNotice, setBiribaNotice] = useState("");
  const biribaNoticeTimerRef = useRef(null);
  const chatFocusedRef = useRef(false);
  const mediaFocusedRef = useRef(false);
  const serverNowRef = useRef(null);
  const serverSyncedAtRef = useRef(null);
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

  function isTouchViewport() {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 900
    );
  }

  function refreshMobileViewport() {
    if (typeof window === "undefined") return;
    const nextMobileMode = isTouchViewport();
    const nextPortraitLocked = nextMobileMode && window.innerHeight > window.innerWidth;
    setMobileMode(nextMobileMode);
    setPortraitLocked(nextPortraitLocked);
    if (nextMobileMode && !mobileLayoutAppliedRef.current) {
      mobileLayoutAppliedRef.current = true;
      setChatVisible(false);
      setPlayersVisible(false);
    }
  }

  async function requestLandscape({ preferFullscreen = true } = {}) {
    if (typeof window === "undefined") return;
    if (!isTouchViewport()) return;

    setOrientationMessage("Abrindo em tela horizontal...");
    try {
      if (
        preferFullscreen &&
        document.fullscreenEnabled &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        await document.documentElement.requestFullscreen();
      }
    } catch {}

    try {
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock("landscape");
        setOrientationMessage("Tela horizontal ativa.");
      } else {
        setOrientationMessage("Gire o aparelho para jogar.");
      }
    } catch {
      setOrientationMessage("Gire o aparelho para jogar.");
    }

    window.setTimeout(refreshMobileViewport, 120);
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

  function upsertOnlinePlayer(player) {
    if (!player?.id) return;
    setOnlinePlayers((prev) => {
      const nextPlayer = {
        id: player.id,
        nick: player.nick || "Player",
        activity: player.activity || "idle",
        voiceEnabled: player.voiceEnabled === true,
        voiceMuted: player.voiceMuted === true,
        isYou: player.id === localIdRef.current,
      };
      let changed = false;
      const exists = prev.some((entry) => entry.id === player.id);
      const next = exists
        ? prev.map((entry) => {
            if (entry.id !== player.id) return entry;
            const needsUpdate = Object.keys(nextPlayer).some(
              (key) => entry[key] !== nextPlayer[key]
            );
            if (!needsUpdate) return entry;
            changed = true;
            return { ...entry, ...nextPlayer };
          })
        : [...prev, nextPlayer];
      if (exists && !changed) return prev;
      return next.sort((a, b) => Number(b.isYou) - Number(a.isYou) || a.nick.localeCompare(b.nick));
    });
  }

  function patchOnlinePlayer(id, patch) {
    if (!id) return;
    setOnlinePlayers((prev) => {
      let changed = false;
      let found = false;
      const next = prev.map((entry) => {
        if (entry.id !== id) return entry;
        found = true;
        const needsUpdate = Object.keys(patch).some(
          (key) => entry[key] !== patch[key]
        );
        if (!needsUpdate) return entry;
        changed = true;
        return { ...entry, ...patch };
      });
      return found && changed ? next : prev;
    });
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
      if (biribaNoticeTimerRef.current) {
        clearTimeout(biribaNoticeTimerRef.current);
        biribaNoticeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setAvatar(readStoredAvatar());
  }, []);

  useEffect(() => {
    refreshMobileViewport();
    window.setTimeout(() => requestLandscape({ preferFullscreen: false }), 160);

    const onFirstPointer = () => {
      requestLandscape({ preferFullscreen: true });
    };
    const onViewportChange = () => {
      refreshMobileViewport();
    };

    window.addEventListener("pointerdown", onFirstPointer, { once: true, passive: true });
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);
    return () => {
      window.removeEventListener("pointerdown", onFirstPointer);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== "Tab") return;
      e.preventDefault();
      setPlayersVisible(true);
    }

    function onKeyUp(e) {
      if (e.code !== "Tab") return;
      e.preventDefault();
      setPlayersVisible(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!avatar) return undefined;
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
        avatar,
        onEvent: (event) => {
          if (event.type === "connected") {
            setConnection("connected");
          } else if (event.type === "disconnected") {
            setConnection("disconnected");
          } else if (event.type === "error") {
            setConnection("error");
          } else if (event.type === "init") {
            localIdRef.current = event.you;
            setOnlinePlayers([
              {
                id: event.you,
                nick,
                activity: "idle",
                voiceEnabled: false,
                voiceMuted: false,
                isYou: true,
              },
              ...(Array.isArray(event.players) ? event.players : [])
                .filter((player) => player?.id && player.id !== event.you)
                .map((player) => ({
                  id: player.id,
                  nick: player.nick || "Player",
                  activity: player.activity || "idle",
                  voiceEnabled: player.voiceEnabled === true,
                  voiceMuted: player.voiceMuted === true,
                  isYou: false,
                })),
            ]);
            npcAuthorityIdRef.current =
              typeof event.npcAuthority === "string" ? event.npcAuthority : null;
            npcSnapshotRef.current = Array.isArray(event.npcs) ? event.npcs : [];
            biribaSnapshotRef.current = event.biriba || null;
            if (typeof event.serverNow === "number") {
              serverNowRef.current = event.serverNow;
              serverSyncedAtRef.current = Date.now();
            }
            voice?.setLocalId(event.you);
            voice?.syncPlayers(event.players || []);
            if (event.history) {
              setChatMessages(event.history.map((m) => decorateMessage(m)));
            }
            if (game && event.players) {
              for (const p of event.players) {
                if (p.id !== event.you) game.addRemotePlayer(p);
              }
            }
            if (game && event.entities) {
              for (const entity of event.entities) {
                game.updateSharedEntity?.(entity);
              }
            }
            if (game && event.biriba) {
              game.biribaSpawn?.(event.biriba);
            }
            if (game) {
              game.setNpcAuthority?.(npcAuthorityIdRef.current === event.you);
              game.applyNpcSnapshots?.(npcSnapshotRef.current);
            }
          } else if (event.type === "clock") {
            if (typeof event.serverNow === "number") {
              serverNowRef.current = event.serverNow;
              serverSyncedAtRef.current = Date.now();
            }
          } else if (event.type === "join") {
            upsertOnlinePlayer(event.player);
            if (game && event.player) game.addRemotePlayer(event.player);
            if (event.player) voice?.addPlayer(event.player);
          } else if (event.type === "state") {
            patchOnlinePlayer(event.id, { activity: event.activity || "idle" });
            if (game) game.updateRemotePlayer(event);
          } else if (event.type === "entity-state") {
            if (game) game.updateSharedEntity?.(event);
          } else if (event.type === "npc-authority") {
            npcAuthorityIdRef.current =
              typeof event.id === "string" ? event.id : null;
            if (game && localIdRef.current) {
              game.setNpcAuthority?.(npcAuthorityIdRef.current === localIdRef.current);
            }
          } else if (event.type === "npc-state") {
            npcSnapshotRef.current = Array.isArray(event.npcs) ? event.npcs : [];
            if (game) game.applyNpcSnapshots?.(npcSnapshotRef.current);
          } else if (event.type === "leave") {
            setOnlinePlayers((prev) => prev.filter((player) => player.id !== event.id));
            if (game) game.removeRemotePlayer(event.id);
            voice?.removePlayer(event.id);
          } else if (event.type === "emote") {
            if (game) game.triggerRemoteEmote(event.id, event.kind, event.duration);
          } else if (event.type === "voice-ready") {
            patchOnlinePlayer(event.id, {
              voiceEnabled: event.enabled === true,
              voiceMuted: event.muted === true,
            });
            voice?.handleReady(event);
          } else if (event.type === "voice-signal") {
            voice?.handleSignal(event);
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
          } else if (event.type === "pvp-challenge") {
            setPvpState({
              phase: "incoming",
              matchId: event.matchId,
              opponentId: event.from,
              opponentNick: event.fromNick,
              myHits: 0,
              opponentHits: 0,
              side: null,
              winner: null,
              loser: null,
              winnerNick: null,
              forfeit: false,
            });
          } else if (event.type === "pvp-start") {
            const myId = localIdRef.current;
            const side = event.playerA === myId ? "A" : "B";
            const opponentId = side === "A" ? event.playerB : event.playerA;
            const opponentNick = side === "A" ? event.nickB : event.nickA;
            const newMatch = {
              phase: "countdown",
              matchId: event.matchId,
              opponentId,
              opponentNick,
              myHits: 0,
              opponentHits: 0,
              side,
              winner: null,
              loser: null,
              winnerNick: null,
              forfeit: false,
            };
            setPvpState(newMatch);
            pvpStateRef.current = newMatch;
            if (game) {
              game.pvpSetMatch({ matchId: event.matchId, opponentId, side });
              game.pvpTeleportToArena(side);
            }
            // countdown 3 → 2 → 1 → GO
            let count = 3;
            const tick = setInterval(() => {
              count -= 1;
              if (count <= 0) {
                clearInterval(tick);
                setPvpState((prev) => prev ? { ...prev, phase: "playing" } : prev);
              } else {
                setPvpState((prev) => prev ? { ...prev, countdownVal: count } : prev);
              }
            }, 1000);
            setPvpState((prev) => prev ? { ...prev, countdownVal: 3 } : prev);
          } else if (event.type === "pvp-declined") {
            setPvpState(null);
            if (game) game.pvpSetMatch(null);
          } else if (event.type === "pvp-cancelled") {
            setPvpState(null);
            if (game) game.pvpSetMatch(null);
          } else if (event.type === "pvp-throw") {
            if (game) game.pvpShowThrow(event.matchId, event.from, event.x, event.z, event.dx, event.dz);
          } else if (event.type === "pvp-hit") {
            const myId = localIdRef.current;
            const cur = pvpStateRef.current;
            if (!cur || cur.matchId !== event.matchId) return;
            const isAMe = cur.side === "A" ? myId : cur.opponentId;
            const myHits = event.victim === myId ? (cur.myHits + 1) : cur.myHits;
            const opponentHits = event.victim !== myId ? (cur.opponentHits + 1) : cur.opponentHits;
            if (event.victim === myId && game) game.pvpShowHit("__local__");
            setPvpState((prev) => prev ? { ...prev, myHits, opponentHits } : prev);
          } else if (event.type === "pvp-end") {
            const myId = localIdRef.current;
            if (game) {
              game.pvpSetMatch(null);
              game.pvpReturnFromArena();
            }
            setPvpState({
              phase: "ended",
              matchId: event.matchId,
              opponentId: null,
              opponentNick: event.loser === myId ? event.winnerNick : event.loserNick,
              myHits: 0,
              opponentHits: 0,
              side: null,
              winner: event.winner,
              loser: event.loser,
              winnerNick: event.winnerNick,
              forfeit: event.forfeit === true,
            });
          } else if (event.type === "biriba-spawn") {
            biribaSnapshotRef.current = event.biriba || null;
            const notice = {
              id: "__system__",
              nick: "sistema",
              text: "biriba está no campus",
              ts: Date.now(),
            };
            setChatMessages((prev) => {
              const next = [...prev, decorateMessage(notice)];
              return next.length > 80 ? next.slice(next.length - 80) : next;
            });
            setBiribaNotice("biriba está no campus");
            if (biribaNoticeTimerRef.current) clearTimeout(biribaNoticeTimerRef.current);
            biribaNoticeTimerRef.current = setTimeout(() => {
              setBiribaNotice("");
              biribaNoticeTimerRef.current = null;
            }, 4500);
            if (game && event.biriba) game.biribaSpawn?.(event.biriba);
          } else if (event.type === "biriba-despawn") {
            biribaSnapshotRef.current = null;
            if (game) game.biribaDespawn?.();
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
          patchOnlinePlayer(localIdRef.current, { activity: state.activity || "idle" });
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
        onPvpThrow: (matchId, dx, dz, x, z) => {
          multiplayer.sendPvpThrow(matchId, dx, dz, x, z);
        },
        onPvpHit: (matchId, victimId) => {
          multiplayer.sendPvpHit(matchId, victimId);
        },
        onBiribaConsumed: (seed) => {
          multiplayer.sendBiribaConsumed?.(seed);
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
      if (biribaSnapshotRef.current) {
        game.biribaSpawn?.(biribaSnapshotRef.current);
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

  function updateMobileStick(event) {
    const joystick = joystickRef.current;
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2 - 18);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let x = (event.clientX - centerX) / radius;
    let y = (event.clientY - centerY) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setStick({ active: true, x, y });
    gameApiRef.current?.setMobileInput?.({ x, y, running: mobileRunRef.current });
  }

  function clearMobileStick() {
    joystickPointerRef.current = null;
    setStick({ active: false, x: 0, y: 0 });
    gameApiRef.current?.setMobileInput?.({ x: 0, y: 0, running: mobileRunRef.current });
  }

  function handleJoystickPointerDown(event) {
    event.preventDefault();
    joystickPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateMobileStick(event);
  }

  function handleJoystickPointerMove(event) {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    updateMobileStick(event);
  }

  function handleJoystickPointerUp(event) {
    if (joystickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    clearMobileStick();
  }

  function setMobileRun(active) {
    mobileRunRef.current = active;
    gameApiRef.current?.setMobileInput?.({ running: active });
  }

  function handleMobileAction(event, action) {
    event.preventDefault();
    if (action === "jump") {
      gameApiRef.current?.queueMobileJump?.();
    } else if (action === "interact") {
      gameApiRef.current?.queueMobileInteract?.();
    } else if (action === "camera") {
      gameApiRef.current?.toggleCameraMode?.();
    }
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
    setPvpState(null);
  }

  function handlePvpQuit() {
    const cur = pvpStateRef.current;
    if (!cur || cur.phase === "ended") return;
    multiplayerRef.current?.sendPvpQuit?.(cur.matchId);
    if (gameApiRef.current) {
      gameApiRef.current.pvpSetMatch(null);
      gameApiRef.current.pvpReturnFromArena();
    }
    setPvpState(null);
  }

  function handlePvpDismiss() {
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
          <div className="players-panel" role="dialog" aria-label="Jogadores online">
            <div className="players-panel-head">
              <span>Jogadores online</span>
              <strong>{onlinePlayers.length}</strong>
            </div>
            <div className="players-list">
              {onlinePlayers.map((player) => (
                <div key={player.id} className={`players-row${player.isYou ? " you" : ""}`}>
                  <span className="players-dot" aria-hidden="true" />
                  <span className="players-name">{player.nick}{player.isYou ? " (você)" : ""}</span>
                  <span className="players-activity">{ACTIVITY_LABEL[player.activity] || player.activity || "parado"}</span>
                  <span className={`players-voice${player.voiceEnabled ? " on" : ""}`}>
                    {player.voiceEnabled ? (player.voiceMuted ? "mutado" : "voz") : "sem voz"}
                  </span>
                  {!player.isYou && !pvpState && (
                    <button
                      type="button"
                      className="players-pvp-btn"
                      onClick={() => handlePvpChallenge(player.id)}
                      title="Desafiar para queimado"
                    >
                      🏐
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {biribaNotice ? (
          <div className="biriba-notice" role="status" aria-live="polite">
            {biribaNotice}
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
              className={`mobile-joystick${stick.active ? " active" : ""}`}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
            >
              <span
                className="mobile-joystick-knob"
                style={{
                  transform: `translate(${stick.x * 44}px, ${stick.y * 44}px)`,
                }}
              />
            </div>

            <div className="mobile-action-pad">
              <button
                type="button"
                className="mobile-action mobile-action-run"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setMobileRun(true);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  setMobileRun(false);
                }}
                onPointerCancel={(event) => {
                  event.preventDefault();
                  setMobileRun(false);
                }}
                onPointerLeave={(event) => {
                  event.preventDefault();
                  setMobileRun(false);
                }}
              >
                Correr
              </button>
              <button
                type="button"
                className="mobile-action"
                onPointerDown={(event) => handleMobileAction(event, "jump")}
              >
                Pular
              </button>
              <button
                type="button"
                className="mobile-action mobile-action-primary"
                onPointerDown={(event) => handleMobileAction(event, "interact")}
              >
                Ação
              </button>
              <button
                type="button"
                className="mobile-action"
                onPointerDown={(event) => handleMobileAction(event, "camera")}
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
