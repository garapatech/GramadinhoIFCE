const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const INITIAL_STATE = {
  supported: true,
  ready: false,
  enabled: false,
  muted: false,
  status: "idle",
  error: "",
  peerCount: 0,
  speakerCount: 0,
  receivingCount: 0,
  peers: [],
};

function getBrowserSupport() {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function getIceServers() {
  const raw = process.env.NEXT_PUBLIC_RTC_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_ICE_SERVERS;
  } catch {
    const urls = raw
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    return urls.length > 0 ? [{ urls }] : DEFAULT_ICE_SERVERS;
  }
}

function serializeDescription(description) {
  if (!description) return null;
  return {
    type: description.type,
    sdp: description.sdp,
  };
}

function serializeCandidate(candidate) {
  if (!candidate) return null;
  if (typeof candidate.toJSON === "function") return candidate.toJSON();
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  };
}

function getErrorMessage(error) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "Permissao do microfone negada.";
  }
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "Nenhum microfone encontrado.";
  }
  if (error?.name === "NotReadableError") {
    return "O microfone ja esta em uso.";
  }
  return "Nao foi possivel ativar o microfone.";
}

export function getInitialVoiceState() {
  return {
    ...INITIAL_STATE,
    supported: getBrowserSupport(),
    peers: [],
  };
}

export function createVoiceChat({ onChange, sendReady, sendSignal } = {}) {
  let localId = "";
  let localStream = null;
  let enabled = false;
  let muted = false;
  let status = "idle";
  let error = "";
  let closed = false;

  const supported = getBrowserSupport();
  const iceServers = getIceServers();
  const knownPlayers = new Map();
  const peers = new Map();

  function snapshot() {
    const peerList = Array.from(peers.values()).map((peer) => ({
      id: peer.id,
      nick: knownPlayers.get(peer.id)?.nick || "Player",
      status: peer.status,
      hasAudio: !!peer.hasRemoteStream,
      autoplayBlocked: !!peer.autoplayBlocked,
    }));
    const speakerCount = Array.from(knownPlayers.values()).filter(
      (player) => player.voiceEnabled && player.id !== localId
    ).length;
    const receivingCount = peerList.filter((peer) => peer.hasAudio).length;
    const blocked = peerList.some((peer) => peer.autoplayBlocked);
    const activeCount = peerList.filter(
      (peer) => peer.hasAudio || peer.status === "connected"
    ).length;

    let visibleStatus = status;
    if (blocked) {
      visibleStatus = "blocked";
    } else if (!enabled && receivingCount > 0) {
      visibleStatus = "listening";
    } else if (!enabled && speakerCount > 0) {
      visibleStatus = "connecting";
    }

    return {
      supported,
      ready: !!localId,
      enabled,
      muted,
      status: visibleStatus,
      error,
      peerCount: activeCount,
      speakerCount,
      receivingCount,
      peers: peerList,
    };
  }

  function emit() {
    onChange?.(snapshot());
  }

  function setState(nextStatus, nextError = "") {
    status = nextStatus;
    error = nextError;
    emit();
  }

  function normalizePlayer(player) {
    if (!player?.id || player.id === localId) return null;
    const previous = knownPlayers.get(player.id) || {};
    return {
      id: player.id,
      nick: player.nick || previous.nick || "Player",
      voiceEnabled: player.voiceEnabled === true || previous.voiceEnabled === true,
      voiceMuted: player.voiceMuted === true,
    };
  }

  function rememberPlayer(player) {
    const normalized = normalizePlayer(player);
    if (!normalized) return null;
    knownPlayers.set(normalized.id, normalized);
    return normalized;
  }

  function shouldInitiate(remoteId) {
    if (!localId) return true;
    return localId.localeCompare(remoteId) < 0;
  }

  function shouldCallPlayer(player) {
    if (!enabled || !localStream || !player) return false;
    if (!player.voiceEnabled) return true;
    return shouldInitiate(player.id);
  }

  function markPeer(peer, nextStatus) {
    if (!peer || peer.status === nextStatus) return;
    peer.status = nextStatus;
    emit();
  }

  function addLocalTracks(peer) {
    if (!peer || !localStream) return false;
    let added = false;
    for (const track of localStream.getAudioTracks()) {
      if (peer.localTrackIds.has(track.id)) continue;
      peer.pc.addTrack(track, localStream);
      peer.localTrackIds.add(track.id);
      added = true;
    }
    return added;
  }

  function attachRemoteAudio(peer, stream) {
    if (!stream || typeof document === "undefined") return;

    let audio = peer.audioEl;
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.voicePeer = peer.id;
      audio.style.display = "none";
      document.body.appendChild(audio);
      peer.audioEl = audio;
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    peer.hasRemoteStream = true;
    peer.autoplayBlocked = false;

    const playPromise = audio.play?.();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        peer.autoplayBlocked = true;
        markPeer(peer, "blocked");
      });
    }

    emit();
  }

  function removeRemoteAudio(peer) {
    if (!peer?.audioEl) return;
    try {
      peer.audioEl.pause();
      peer.audioEl.srcObject = null;
      peer.audioEl.remove();
    } catch {}
    peer.audioEl = null;
  }

  function closePeer(id) {
    const peer = peers.get(id);
    if (!peer) return;
    peers.delete(id);
    removeRemoteAudio(peer);
    try {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.oniceconnectionstatechange = null;
      peer.pc.close();
    } catch {}
    emit();
  }

  async function flushCandidates(peer) {
    if (!peer.pc.remoteDescription) return;
    while (peer.pendingCandidates.length > 0) {
      const candidate = peer.pendingCandidates.shift();
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch {}
    }
  }

  async function createOffer(peer) {
    if (!enabled || !localStream || peer.makingOffer) return;
    if (peer.pc.signalingState !== "stable") return;

    addLocalTracks(peer);
    peer.makingOffer = true;
    markPeer(peer, "calling");
    try {
      const offer = await peer.pc.createOffer();
      if (peer.pc.signalingState !== "stable") return;
      await peer.pc.setLocalDescription(offer);
      sendSignal?.(peer.id, {
        description: serializeDescription(peer.pc.localDescription),
      });
    } catch {
      markPeer(peer, "failed");
    } finally {
      peer.makingOffer = false;
    }
  }

  function ensurePeer(remoteId, initiator = false) {
    if (!supported || !remoteId || remoteId === localId || closed) return null;

    const player = knownPlayers.get(remoteId);
    if (!enabled && !player?.voiceEnabled) return null;

    const existing = peers.get(remoteId);
    if (existing && existing.pc.connectionState !== "closed") {
      const addedTracks = addLocalTracks(existing);
      if (
        (initiator || addedTracks) &&
        enabled &&
        existing.pc.signalingState === "stable"
      ) {
        void createOffer(existing);
      }
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers });
    const peer = {
      id: remoteId,
      pc,
      status: "connecting",
      pendingCandidates: [],
      makingOffer: false,
      hasRemoteStream: false,
      autoplayBlocked: false,
      audioEl: null,
      remoteStream: null,
      localTrackIds: new Set(),
    };

    peers.set(remoteId, peer);
    addLocalTracks(peer);

    pc.onicecandidate = (event) => {
      const candidate = serializeCandidate(event.candidate);
      if (!candidate) return;
      sendSignal?.(remoteId, { candidate });
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || peer.remoteStream || new MediaStream();
      if (!event.streams?.[0] && !stream.getTracks().includes(event.track)) {
        stream.addTrack(event.track);
      }
      peer.remoteStream = stream;
      attachRemoteAudio(peer, stream);
    };

    pc.onconnectionstatechange = () => {
      const next = pc.connectionState;
      if (next === "connected") {
        markPeer(peer, "connected");
      } else if (next === "failed") {
        markPeer(peer, "failed");
        const playerState = knownPlayers.get(remoteId);
        closePeer(remoteId);
        if (!closed && shouldCallPlayer(playerState)) {
          window.setTimeout(() => {
            const latest = knownPlayers.get(remoteId);
            if (!closed && shouldCallPlayer(latest)) {
              ensurePeer(remoteId, true);
            }
          }, 900);
        }
      } else if (next === "disconnected") {
        markPeer(peer, "disconnected");
      } else if (next === "closed") {
        closePeer(remoteId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "checking") markPeer(peer, "connecting");
      if (pc.iceConnectionState === "completed") markPeer(peer, "connected");
    };

    emit();
    if (initiator && enabled) void createOffer(peer);
    return peer;
  }

  function connectKnownPlayers() {
    if (!enabled || !localStream) return;
    for (const player of knownPlayers.values()) {
      ensurePeer(player.id, shouldCallPlayer(player));
    }
  }

  async function handleSignal(event) {
    const from = event?.from;
    if (!from || from === localId) return;
    if (event.target && event.target !== localId) return;
    if (!supported) return;

    const signal = event.signal || {};
    const previous = knownPlayers.get(from) || {};
    knownPlayers.set(from, {
      id: from,
      nick: event.nick || previous.nick || "Player",
      voiceEnabled: true,
      voiceMuted: previous.voiceMuted === true,
    });

    const peer = ensurePeer(from, false);
    if (!peer || !signal) return;

    try {
      if (signal.description) {
        const description = signal.description;

        if (description.type === "offer") {
          const polite = !shouldInitiate(from);
          const offerCollision =
            peer.makingOffer || peer.pc.signalingState !== "stable";
          if (offerCollision && !polite) return;

          if (offerCollision) {
            await Promise.all([
              peer.pc.setLocalDescription({ type: "rollback" }),
              peer.pc.setRemoteDescription(description),
            ]);
          } else {
            await peer.pc.setRemoteDescription(description);
          }
          await flushCandidates(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          sendSignal?.(from, {
            description: serializeDescription(peer.pc.localDescription),
          });
          markPeer(peer, "answering");
          return;
        }

        if (
          description.type === "answer" &&
          peer.pc.signalingState === "have-local-offer"
        ) {
          await peer.pc.setRemoteDescription(description);
          await flushCandidates(peer);
          markPeer(peer, "connecting");
          return;
        }
      }

      if (signal.candidate) {
        const candidate = new RTCIceCandidate(signal.candidate);
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(candidate);
        } else {
          peer.pendingCandidates.push(candidate);
        }
      }
    } catch {
      markPeer(peer, "failed");
    }
  }

  async function start() {
    if (enabled || status === "requesting") return;
    if (!supported) {
      setState("error", "Voz indisponivel neste navegador.");
      return;
    }
    if (!localId) {
      setState("error", "Aguarde a conexao do jogo.");
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (closed) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      localStream = stream;
      enabled = true;
      muted = false;
      status = "connected";
      error = "";
      for (const track of localStream.getAudioTracks()) track.enabled = true;
      sendReady?.({ enabled: true, muted: false });
      connectKnownPlayers();
      emit();
    } catch (err) {
      localStream = null;
      enabled = false;
      muted = false;
      setState("error", getErrorMessage(err));
    }
  }

  function setMuted(nextMuted) {
    if (!localStream || !enabled) return;
    muted = !!nextMuted;
    for (const track of localStream.getAudioTracks()) {
      track.enabled = !muted;
    }
    sendReady?.({ enabled: true, muted });
    emit();
  }

  function stop(options = {}) {
    const notify = options.notify !== false;
    if (notify && enabled) sendReady?.({ enabled: false, muted: false });

    for (const id of Array.from(peers.keys())) closePeer(id);
    if (localStream) {
      for (const track of localStream.getTracks()) track.stop();
    }

    localStream = null;
    enabled = false;
    muted = false;
    status = "idle";
    error = "";
    emit();
  }

  async function unlockAudio() {
    const blockedPeers = Array.from(peers.values()).filter(
      (peer) => peer.audioEl && peer.autoplayBlocked
    );
    if (blockedPeers.length === 0) return;

    await Promise.allSettled(
      blockedPeers.map(async (peer) => {
        try {
          await peer.audioEl.play();
          peer.autoplayBlocked = false;
          if (peer.status === "blocked") peer.status = "connected";
        } catch {}
      })
    );
    emit();
  }

  function handleReady(event) {
    const id = event?.id;
    if (!id || id === localId) return;

    const previous = knownPlayers.get(id) || {};
    const next = {
      id,
      nick: event.nick || previous.nick || "Player",
      voiceEnabled: event.enabled === true,
      voiceMuted: event.muted === true,
    };
    knownPlayers.set(id, next);

    if (!next.voiceEnabled) {
      closePeer(id);
      emit();
      return;
    }

    if (enabled) {
      ensurePeer(id, shouldCallPlayer(next));
    }
    emit();
  }

  function setLocalId(id) {
    localId = id || "";
    for (const playerId of Array.from(knownPlayers.keys())) {
      if (playerId === localId) knownPlayers.delete(playerId);
    }
    emit();
  }

  function syncPlayers(players = []) {
    const seen = new Set();
    for (const player of players) {
      const normalized = rememberPlayer(player);
      if (normalized) seen.add(normalized.id);
    }
    for (const id of Array.from(knownPlayers.keys())) {
      if (!seen.has(id)) {
        knownPlayers.delete(id);
        closePeer(id);
      }
    }
    connectKnownPlayers();
    emit();
  }

  function addPlayer(player) {
    const normalized = rememberPlayer(player);
    if (normalized && enabled) {
      ensurePeer(normalized.id, shouldCallPlayer(normalized));
    }
    emit();
  }

  function removePlayer(id) {
    knownPlayers.delete(id);
    closePeer(id);
    emit();
  }

  function close() {
    closed = true;
    stop({ notify: true });
    knownPlayers.clear();
    emit();
  }

  emit();

  return {
    start,
    stop,
    close,
    setMuted,
    unlockAudio,
    setLocalId,
    syncPlayers,
    addPlayer,
    removePlayer,
    handleReady,
    handleSignal,
  };
}
