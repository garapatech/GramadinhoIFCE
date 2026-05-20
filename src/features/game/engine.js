import * as THREE from "three";
import { avatarToGameAppearance } from "@/features/avatar/avatarConfig";

export function bootGame(opts = {}) {
  const container = opts.container;
  if (!container) throw new Error("bootGame: container is required");
  const localNickname = opts.nickname || "Visitante";
  const onLocalState = typeof opts.onLocalState === "function" ? opts.onLocalState : () => {};
  const onLocalEntityState =
    typeof opts.onLocalEntityState === "function" ? opts.onLocalEntityState : () => {};
  const onNpcState = typeof opts.onNpcState === "function" ? opts.onNpcState : () => {};
  const onAtmosphereChange = typeof opts.onAtmosphereChange === "function" ? opts.onAtmosphereChange : () => {};
  const onCameraModeChange = typeof opts.onCameraModeChange === "function" ? opts.onCameraModeChange : () => {};
  const onAudioStateChange = typeof opts.onAudioStateChange === "function" ? opts.onAudioStateChange : () => {};
  const onPlayerStateChange = typeof opts.onPlayerStateChange === "function" ? opts.onPlayerStateChange : () => {};
  const onEmote = typeof opts.onEmote === "function" ? opts.onEmote : () => {};
  const onMediaBoothInteract = typeof opts.onMediaBoothInteract === "function" ? opts.onMediaBoothInteract : () => {};
  const shouldIgnoreKeys = typeof opts.shouldIgnoreKeys === "function" ? opts.shouldIgnoreKeys : () => false;
  const getWorldTime = typeof opts.getWorldTime === "function" ? opts.getWorldTime : null;
  const broadcastEmote = (kind, duration) => onEmote({ kind, duration });

  const canvas = container.querySelector('[data-game="scene"]');
  const statusEl = container.querySelector('[data-game="status"]');
  const speechEl = container.querySelector('[data-game="speech"]');
  const speechBodyEl = container.querySelector('[data-game="speech-body"]');
  const speechNameEl = container.querySelector('[data-game="speech-name"]');
  const speechHintEl = container.querySelector('[data-game="speech-hint"]');
  const minimapCanvas = container.querySelector('[data-game="minimap-canvas"]');
  const minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;

  const errorHandler = (event) => {
    if (statusEl) {
      statusEl.textContent = `Erro na cena: ${event.message}`;
      statusEl.style.opacity = "1";
      statusEl.dataset.active = "1";
    }
  };
  window.addEventListener("error", errorHandler);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7d7f7);
scene.fog = new THREE.Fog(0xa7d7f7, 45, 180);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0xa7d7f7, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
camera.position.set(-22, 18, 54);
let cameraMode = "follow";
let cameraOrbitYaw = Math.PI / 4;
let cameraOrbitPitch = 0.68;
let cameraOrbitDistance = 28.5;
let cameraDragActive = false;
let cameraDragX = 0;
let cameraDragY = 0;
let cameraFocusTarget = null;
let ambientAudioEnabled = true;
let audioContext = null;
let audioMasterGain = null;
let audioWindSource = null;
let audioWindFilter = null;
let audioWindGain = null;
let audioMurmurSource = null;
let audioMurmurFilter = null;
let audioMurmurGain = null;
let audioRadioSource = null;
let audioRadioFilter = null;
let audioRadioGain = null;
let audioNextBirdAt = 0;
let audioNextRadioAt = 0;
let audioFootstepSide = 1;
let audioStateKey = "";

function emitCameraModeChange() {
  onCameraModeChange({
    mode: cameraMode,
    label: cameraMode === "follow" ? "travada" : "livre",
    focusLabel: cameraMode === "orbit" && cameraFocusTarget ? cameraFocusTarget.label : "",
  });
}

function clearCameraFocus() {
  if (!cameraFocusTarget) return;
  cameraFocusTarget = null;
  emitCameraModeChange();
}

function setCameraFocus(target) {
  if (!target) {
    clearCameraFocus();
    return;
  }

  const nextFocus = {
    kind: target.kind,
    id: target.id || "",
    position: target.position,
    label: target.label || "Alvo",
  };

  if (
    cameraFocusTarget &&
    cameraFocusTarget.kind === nextFocus.kind &&
    cameraFocusTarget.id === nextFocus.id &&
    cameraFocusTarget.position === nextFocus.position &&
    cameraFocusTarget.label === nextFocus.label
  ) {
    return;
  }

  cameraFocusTarget = nextFocus;
  emitCameraModeChange();
}

function getCameraOrbitCenter() {
  if (cameraMode !== "orbit") return player.position;
  if (!cameraFocusTarget) return player.position;
  if (cameraFocusTarget.kind === "remote" && !remotePlayers.has(cameraFocusTarget.id)) {
    clearCameraFocus();
    return player.position;
  }
  return cameraFocusTarget.position || player.position;
}

function emitAudioStateChange() {
  const audioState = {
    enabled: ambientAudioEnabled,
    label: ambientAudioEnabled ? "ativo" : "desligado",
  };
  const audioKey = `${audioState.enabled}:${audioState.label}`;
  if (audioKey === audioStateKey) return;
  audioStateKey = audioKey;
  onAudioStateChange(audioState);
}

function setCameraMode(nextMode) {
  if (cameraMode === nextMode) return;
  cameraMode = nextMode;
  cameraDragActive = false;
  if (cameraMode !== "orbit") {
    clearCameraFocus();
  } else {
    emitCameraModeChange();
  }
}

function toggleCameraMode() {
  setCameraMode(cameraMode === "follow" ? "orbit" : "follow");
}

emitCameraModeChange();
emitAudioStateChange();

function disconnectAudioNode(node) {
  if (!node) return;
  try {
    node.disconnect?.();
  } catch {}
}

function stopAudioNode(node) {
  if (!node) return;
  try {
    node.stop?.();
  } catch {}
  disconnectAudioNode(node);
}

function createNoiseBuffer(context, durationSeconds = 2) {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createAmbientLayer(context, filterType, frequency, q, baseGain) {
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, 2.5);
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gain = context.createGain();
  gain.gain.value = baseGain;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  source.start();

  return { source, filter, gain };
}

function ensureAmbientAudio() {
  if (!ambientAudioEnabled) return false;
  if (!audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;
    try {
      audioContext = new AudioContextCtor();
    } catch {
      return false;
    }
    audioMasterGain = audioContext.createGain();
    audioMasterGain.gain.value = 0.0;
    audioMasterGain.connect(audioContext.destination);
  }

  if (!audioWindSource) {
    const windLayer = createAmbientLayer(audioContext, "bandpass", 280, 0.85, 0.001);
    audioWindSource = windLayer.source;
    audioWindFilter = windLayer.filter;
    audioWindGain = windLayer.gain;
  }

  if (!audioMurmurSource) {
    const murmurLayer = createAmbientLayer(audioContext, "lowpass", 820, 0.45, 0.0006);
    audioMurmurSource = murmurLayer.source;
    audioMurmurFilter = murmurLayer.filter;
    audioMurmurGain = murmurLayer.gain;
  }

  if (!audioRadioSource) {
    const radioLayer = createAmbientLayer(audioContext, "bandpass", 1180, 1.25, 0.00018);
    audioRadioSource = radioLayer.source;
    audioRadioFilter = radioLayer.filter;
    audioRadioGain = radioLayer.gain;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  audioMasterGain.gain.setTargetAtTime(0.42, audioContext.currentTime, 0.08);
  if (audioNextBirdAt <= 0) {
    audioNextBirdAt = audioContext.currentTime + 1.5;
  }
  if (audioNextRadioAt <= 0) {
    audioNextRadioAt = audioContext.currentTime + rand(9, 18);
  }
  return true;
}

function chirpBird(now, strength) {
  if (!audioContext || !audioMasterGain) return;
  const osc = audioContext.createOscillator();
  osc.type = "triangle";
  const filter = audioContext.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1300;
  const gain = audioContext.createGain();
  const peak = 0.018 + strength * 0.018;

  osc.frequency.setValueAtTime(1620 + Math.random() * 720, now);
  osc.frequency.exponentialRampToValueAtTime(1200 + Math.random() * 420, now + 0.11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  osc.start(now);
  osc.stop(now + 0.22);
  osc.onended = () => {
    disconnectAudioNode(osc);
    disconnectAudioNode(filter);
    disconnectAudioNode(gain);
  };
}

function playFootstepSound(surface, running = false) {
  if (!ambientAudioEnabled || !audioContext || audioContext.state !== "running" || !audioMasterGain) return;

  const now = audioContext.currentTime;
  const config = surface === "corridor"
    ? { filterType: "bandpass", frequency: 920, q: 1.15, duration: 0.16, noiseGain: 0.013, thumpGain: 0.010, thumpFrequency: 124, highpass: 240 }
    : surface === "cement"
      ? { filterType: "highpass", frequency: 1450, q: 0.55, duration: 0.11, noiseGain: 0.016, thumpGain: 0.014, thumpFrequency: 92, highpass: 340 }
      : { filterType: "bandpass", frequency: 560, q: 0.82, duration: 0.15, noiseGain: 0.011, thumpGain: 0.008, thumpFrequency: 108, highpass: 180 };

  const stepSource = audioContext.createBufferSource();
  stepSource.buffer = createNoiseBuffer(audioContext, config.duration);

  const stepFilter = audioContext.createBiquadFilter();
  stepFilter.type = config.filterType;
  stepFilter.frequency.value = config.frequency;
  stepFilter.Q.value = config.q;

  const stepGain = audioContext.createGain();
  const peak = config.noiseGain * (running ? 1.28 : 1.0);
  stepGain.gain.setValueAtTime(0.0001, now);
  stepGain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
  stepGain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

  const thump = audioContext.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(config.thumpFrequency + (running ? 12 : 0), now);
  thump.frequency.exponentialRampToValueAtTime(Math.max(40, config.thumpFrequency * 0.72), now + 0.06);

  const thumpGain = audioContext.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(config.thumpGain * (running ? 1.1 : 1), now + 0.01);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

  const pan = audioContext.createStereoPanner?.();
  if (pan) {
    audioFootstepSide *= -1;
    pan.pan.value = audioFootstepSide * (running ? 0.18 : 0.12);
  }

  const stepOutput = pan || stepGain;
  stepSource.connect(stepFilter);
  stepFilter.connect(stepGain);
  stepGain.connect(stepOutput === stepGain ? audioMasterGain : stepOutput);
  if (pan) {
    pan.connect(audioMasterGain);
  }
  thump.connect(thumpGain);
  thumpGain.connect(audioMasterGain);

  stepSource.start(now);
  stepSource.stop(now + config.duration + 0.02);
  thump.start(now);
  thump.stop(now + 0.1);

  stepSource.onended = () => {
    disconnectAudioNode(stepSource);
    disconnectAudioNode(stepFilter);
    disconnectAudioNode(stepGain);
    if (pan) disconnectAudioNode(pan);
  };
  thump.onended = () => {
    disconnectAudioNode(thump);
    disconnectAudioNode(thumpGain);
  };
}

function playBusArrivalSound(strength = 1) {
  if (!ambientAudioEnabled || !audioContext || audioContext.state !== "running" || !audioMasterGain) return;

  const now = audioContext.currentTime;
  const busGain = audioContext.createGain();
  busGain.gain.setValueAtTime(0.0001, now);
  busGain.gain.exponentialRampToValueAtTime(0.018 + strength * 0.014, now + 0.04);
  busGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

  const rumble = audioContext.createOscillator();
  rumble.type = "sawtooth";
  rumble.frequency.setValueAtTime(58 + strength * 6, now);
  rumble.frequency.exponentialRampToValueAtTime(34 + strength * 3, now + 0.5);

  const rumbleFilter = audioContext.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 170;
  rumbleFilter.Q.value = 0.8;

  const hiss = audioContext.createBufferSource();
  hiss.buffer = createNoiseBuffer(audioContext, 0.45);

  const hissFilter = audioContext.createBiquadFilter();
  hissFilter.type = "bandpass";
  hissFilter.frequency.value = 1380;
  hissFilter.Q.value = 0.95;

  const hissGain = audioContext.createGain();
  hissGain.gain.setValueAtTime(0.0001, now);
  hissGain.gain.exponentialRampToValueAtTime(0.009 + strength * 0.007, now + 0.03);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  const pan = audioContext.createStereoPanner?.();
  if (pan) {
    pan.pan.value = Math.max(-0.2, Math.min(0.2, (Math.random() * 0.4 - 0.2) * strength));
  }

  const output = pan || busGain;
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(busGain);
  busGain.connect(output === busGain ? audioMasterGain : output);
  if (pan) {
    pan.connect(audioMasterGain);
  }

  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(audioMasterGain);

  rumble.start(now);
  rumble.stop(now + 0.7);
  hiss.start(now + 0.02);
  hiss.stop(now + 0.34);

  rumble.onended = () => {
    disconnectAudioNode(rumble);
    disconnectAudioNode(rumbleFilter);
    disconnectAudioNode(busGain);
    if (pan) disconnectAudioNode(pan);
  };
  hiss.onended = () => {
    disconnectAudioNode(hiss);
    disconnectAudioNode(hissFilter);
    disconnectAudioNode(hissGain);
  };
}

function playCampusRadioJingle(now, intensity = 1) {
  if (!audioContext || !audioMasterGain) return;

  const notes = [659.25, 783.99, 988.0];
  const durations = [0.08, 0.09, 0.12];
  let start = now;
  for (let i = 0; i < notes.length; i += 1) {
    const osc = audioContext.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(notes[i], start);
    osc.frequency.exponentialRampToValueAtTime(notes[i] * 1.02, start + durations[i] * 0.8);

    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 980 + i * 260;
    filter.Q.value = 1.3;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.010 + intensity * 0.004, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durations[i]);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioMasterGain);
    osc.start(start);
    osc.stop(start + durations[i] + 0.02);

    osc.onended = () => {
      disconnectAudioNode(osc);
      disconnectAudioNode(filter);
      disconnectAudioNode(gain);
    };

    start += durations[i] + 0.035;
  }
}

function updateAmbientAudio(time, state) {
  if (!ambientAudioEnabled) return;
  ensureAmbientAudio();
  if (!audioContext || audioContext.state !== "running") return;

  const now = audioContext.currentTime;
  const daylight = state.daylight;
  const weather = state.weather || {};
  const windLevel = 0.004 + weather.wind * 0.02 + weather.cloudMix * 0.003 + weather.rain * 0.006;
  const murmurLevel = state.label === "fim de aula"
    ? 0.009
    : daylight > 0.35
      ? 0.004 + weather.cloudMix * 0.0025
      : 0.0025;

  if (audioWindGain) {
    audioWindGain.gain.setTargetAtTime(windLevel, now, 0.12);
  }

  if (audioWindFilter) {
    audioWindFilter.frequency.setTargetAtTime(220 + weather.wind * 110, now, 0.12);
  }

  if (audioMurmurGain) {
    audioMurmurGain.gain.setTargetAtTime(murmurLevel, now, 0.2);
  }

  if (audioMurmurFilter) {
    audioMurmurFilter.frequency.setTargetAtTime(daylight > 0.4 ? 860 : 620, now, 0.2);
  }

  if (audioRadioGain) {
    const radioLevel =
      0.00008 +
      daylight * 0.00016 +
      (state.label === "fim de aula" ? 0.00012 : 0) +
      (state.weather.rain > 0 ? -0.00002 : 0);
    audioRadioGain.gain.setTargetAtTime(Math.max(0.00005, radioLevel), now, 0.18);
  }

  if (audioRadioFilter) {
    audioRadioFilter.frequency.setTargetAtTime(920 + daylight * 260 + state.weather.cloudMix * 80, now, 0.16);
    audioRadioFilter.Q.setTargetAtTime(1.05 + state.weather.rain * 0.25, now, 0.16);
  }

  if (now >= audioNextRadioAt) {
    const radioWindow =
      daylight > 0.55
        ? 0.34
        : daylight > 0.15
          ? 0.18
          : 0.05;
    if (Math.random() < radioWindow) {
      playCampusRadioJingle(now, daylight);
    }
    audioNextRadioAt = now + rand(18, 42);
  }

  if (now >= audioNextBirdAt) {
    const birdWindow = weather.rain > 0.1 ? 0 : daylight > 0.04 ? Math.min(1, 0.12 + daylight * 0.7) : 0.02;
    if (Math.random() < birdWindow) {
      chirpBird(now, daylight);
    }
    const nextDelay = weather.rain > 0.1
      ? rand(10, 18)
      : daylight > 0.6
        ? rand(2.4, 5.4)
        : daylight > 0.2
          ? rand(4.5, 8.5)
          : rand(11, 19);
    audioNextBirdAt = now + nextDelay;
  }
}

function pointInRotatedRect(x, z, rect) {
  const dx = x - rect.x;
  const dz = z - rect.z;
  const angle = -(rect.rotation || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  return Math.abs(localX) <= rect.width / 2 && Math.abs(localZ) <= rect.depth / 2;
}

function getGroundSurfaceAt(x, z) {
  for (const path of mapFeatures.paths) {
    if (pointInRotatedRect(x, z, path)) {
      return path.surface || "cement";
    }
  }
  return "grass";
}

function setAmbientAudioEnabled(nextEnabled) {
  ambientAudioEnabled = true;
  if (!ensureAmbientAudio()) {
    ambientAudioEnabled = true;
  }
  emitAudioStateChange();
}

function toggleAmbientAudio() {
  setAmbientAudioEnabled(true);
}

const ambient = new THREE.HemisphereLight(0xdff3ff, 0x5a7c4f, 1.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(28, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.width = 1024;
sun.shadow.mapSize.height = 1024;
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

scene.add(new THREE.AmbientLight(0x88aa88, 0.35));

const DAY_CYCLE_SECONDS = 360;
const WEATHER_CYCLE_SECONDS = 480;
const atmosphereSnapshot = {
  clock: "",
  label: "",
  mood: "",
  weather: "",
  weatherLabel: "",
  wind: 0
};
let lastAtmosphereKey = "";
const daySkyColor = new THREE.Color(0xa7d7f7);
const duskSkyColor = new THREE.Color(0x9a8bc8);
const nightSkyColor = new THREE.Color(0x4f6687);
const dayFogColor = new THREE.Color(0xa7d7f7);
const duskFogColor = new THREE.Color(0x8f7fab);
const nightFogColor = new THREE.Color(0x596f8c);
const dayGroundColor = new THREE.Color(0x6ea34e);
const duskGroundColor = new THREE.Color(0x55783f);
const nightGroundColor = new THREE.Color(0x557a5e);
const clearSkyColor = new THREE.Color(0xb8e3fb);
const cloudySkyColor = new THREE.Color(0x9db8d4);
const rainSkyColor = new THREE.Color(0x74879f);
const clearFogColor = new THREE.Color(0xb8dff5);
const cloudyFogColor = new THREE.Color(0x98afc4);
const rainFogColor = new THREE.Color(0x6f8199);
const wetGroundColor = new THREE.Color(0x496a53);
const tempWeatherSkyColor = new THREE.Color();
const tempWeatherFogColor = new THREE.Color();
const tempSkyColor = new THREE.Color();
const tempFogColor = new THREE.Color();
const tempGroundColor = new THREE.Color();

function formatClock(minutes) {
  const safe = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const mins = String(Math.floor(safe % 60)).padStart(2, "0");
  return `${hours}:${mins}`;
}

function getAtmosphereState(time) {
  const dayPhase = (time % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
  const campusMinutes = (6 * 60 + Math.round(dayPhase * 24 * 60)) % (24 * 60);
  const hours = campusMinutes / 60;

  let daylight = 0;
  if (hours >= 6 && hours < 18) {
    daylight = Math.sin(((hours - 6) / 12) * Math.PI);
  }

  let label = "noite";
  let mood = "calmo";
  if (hours >= 6 && hours < 10) {
    label = "manhã";
    mood = daylight > 0.35 ? "acordando" : "calmo";
  } else if (hours >= 10 && hours < 14) {
    label = "meio-dia";
    mood = "movido";
  } else if (hours >= 14 && hours < 18) {
    label = "fim de aula";
    mood = "dourado";
  }

  return {
    clock: formatClock(campusMinutes),
    label,
    mood,
    daylight,
  };
}

function getWeatherState(time) {
  const phase = (time % WEATHER_CYCLE_SECONDS) / WEATHER_CYCLE_SECONDS;
  const cloudMix = Math.max(0, Math.min(1, phase < 0.48 ? phase / 0.48 : phase < 0.72 ? 1 : (1 - phase) / 0.28));
  let kind = "sol";
  let label = "ensolarado";
  let wind = 0.08;
  let rain = 0;

  if (phase >= 0.48 && phase < 0.72) {
    kind = "nublado";
    label = "nublado";
    wind = 0.24;
  } else if (phase >= 0.72 && phase < 0.88) {
    kind = "chuva";
    label = "chuva";
    wind = 0.58;
    rain = 1;
  } else if (phase >= 0.88) {
    kind = "vento";
    label = "vento";
    wind = 0.38;
  }

  return {
    kind,
    label,
    wind,
    rain,
    cloudMix
  };
}

function applyAtmosphere(state) {
  const duskMix = Math.min(Math.max(1 - state.daylight * 1.2, 0), 1);
  const nightMix = state.daylight <= 0 ? 1 : Math.max(0, 1 - state.daylight * 1.8);

  tempWeatherSkyColor.copy(clearSkyColor).lerp(cloudySkyColor, state.weather.cloudMix).lerp(rainSkyColor, state.weather.rain * 0.85);
  tempWeatherFogColor.copy(clearFogColor).lerp(cloudyFogColor, state.weather.cloudMix).lerp(rainFogColor, state.weather.rain * 0.9);
  const skyColor = tempSkyColor.copy(daySkyColor).lerp(tempWeatherSkyColor, 0.42).lerp(duskSkyColor, duskMix * 0.45).lerp(nightSkyColor, nightMix * 0.72);
  const fogColor = tempFogColor.copy(dayFogColor).lerp(tempWeatherFogColor, 0.38).lerp(duskFogColor, duskMix * 0.45).lerp(nightFogColor, nightMix * 0.72);
  const groundColor = tempGroundColor.copy(dayGroundColor).lerp(duskGroundColor, duskMix * 0.45).lerp(nightGroundColor, nightMix * 0.68);

  scene.background.copy(skyColor);
  scene.fog.color.copy(fogColor);
  renderer.setClearColor(skyColor, 1);

  const weatherDim = state.weather.rain * 0.22 + state.weather.cloudMix * 0.08;
  ambient.intensity = Math.max(0.88, 0.82 + state.daylight * 1.45 - weatherDim);
  ambient.color.setHex(state.daylight > 0.45 ? (state.weather.rain ? 0xa8bfd6 : 0xdff3ff) : 0xb9c8e8);

  sun.intensity = Math.max(0.34, 0.32 + state.daylight * 2.2 - state.weather.rain * 0.45 - state.weather.cloudMix * 0.18);
  sun.color.setHex(state.daylight > 0.5 ? (state.weather.rain ? 0xe4e8f4 : 0xfff4d6) : state.daylight > 0.1 ? 0xffcab4 : 0xc9d7ff);
  sun.position.set(28 - state.daylight * 10, 18 + state.daylight * 28, 18 + state.daylight * 8);

  ground.material.color.copy(groundColor).lerp(wetGroundColor, state.weather.rain * 0.12 + groundWetness * 0.08);
  ground.material.roughness = THREE.MathUtils.clamp(1 - state.weather.rain * 0.16 - groundWetness * 0.08, 0.72, 1);

  for (const lamp of streetLamps) {
    lamp.power = 0;
    lamp.point.intensity = 0;
    lamp.point.visible = false;
    lamp.head.material.emissiveIntensity = 0.08;
    lamp.head.material.color.setHex(0xf2f4d8);
    if (lamp.cone) {
      lamp.cone.visible = false;
      lamp.cone.material.opacity = 0;
    }
    if (lamp.pool) {
      lamp.pool.visible = false;
      lamp.pool.material.opacity = 0;
    }
  }

  const atmosphereKey = `${state.clock}|${state.label}|${state.mood}|${state.weather.kind}`;
  if (atmosphereKey !== lastAtmosphereKey) {
    lastAtmosphereKey = atmosphereKey;
    atmosphereSnapshot.clock = state.clock;
    atmosphereSnapshot.label = state.label;
    atmosphereSnapshot.mood = state.mood;
    atmosphereSnapshot.weather = state.weather.kind;
    atmosphereSnapshot.weatherLabel = state.weather.label;
    atmosphereSnapshot.wind = state.weather.wind;
    onAtmosphereChange({ ...atmosphereSnapshot });
  }
}

function updateWeatherFX(dt, time, state) {
  const weatherPulse = Math.max(0, Math.min(1, state.weather.rain ? 1 : state.weather.cloudMix * 0.7));
  const wind = state.weather.wind + (state.daylight > 0 ? Math.sin(time * 0.12) * 0.05 : 0.02);
  const randomIn = (min, max) => min + (max - min) * Math.random();

  groundWetness = THREE.MathUtils.clamp(
    groundWetness + state.weather.rain * dt * 1.4 - dt * (state.weather.cloudMix > 0.5 ? 0.01 : 0.035),
    0,
    1
  );

  for (let i = 0; i < cloudSprites.length; i += 1) {
    const cloud = cloudSprites[i];
    const data = cloud.userData;
    cloud.position.x += (data.drift + wind * 0.35) * 0.018;
    if (cloud.position.x > 82) cloud.position.x = -82;
    if (cloud.position.x < -82) cloud.position.x = 82;
    cloud.position.y = data.baseY + Math.sin(time * 0.18 + data.phase) * (0.4 + weatherPulse * 0.7);
    const scalePulse = 1 + weatherPulse * 0.22 + Math.sin(time * 0.12 + data.phase) * 0.02;
    cloud.scale.set(data.baseScale * 1.5 * scalePulse, data.baseScale * scalePulse, 1);
    cloud.material.opacity = 0.54 + weatherPulse * 0.24;
    cloud.material.color.setHex(state.weather.rain ? 0xe3ebf5 : state.weather.cloudMix > 0.4 ? 0xf4f7fb : 0xffffff);
  }

  if (state.weather.rain > 0.08) {
    const centerX = player.position.x;
    const centerZ = player.position.z;
    const rainSpan = 28;
    const rainTop = player.position.y + 21;
    const rainSpeed = 12 + state.weather.rain * 11 + state.weather.cloudMix * 3;
    for (let i = 0; i < rainCount; i += 1) {
      const idx = i * 3;
      if (rainPositions[idx + 1] > rainTop || rainPositions[idx + 1] === 0) {
        rainPositions[idx] = centerX + randomIn(-rainSpan, rainSpan);
        rainPositions[idx + 1] = rainTop - randomIn(0, 18);
        rainPositions[idx + 2] = centerZ + randomIn(-rainSpan, rainSpan);
        rainVelocities[i] = rainSpeed * randomIn(0.72, 1.22);
      }

      rainPositions[idx] += wind * 0.12;
      rainPositions[idx + 1] -= rainVelocities[i] * 0.016;
      rainPositions[idx + 2] += wind * 0.04;

      if (rainPositions[idx + 1] < player.position.y - 2) {
        rainPositions[idx] = centerX + randomIn(-rainSpan, rainSpan);
        rainPositions[idx + 1] = rainTop + randomIn(0, 8);
        rainPositions[idx + 2] = centerZ + randomIn(-rainSpan, rainSpan);
        rainVelocities[i] = rainSpeed * randomIn(0.72, 1.22);
      }
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }
  rainField.visible = state.weather.rain > 0.08;
  rainField.position.set(0, 0, 0);

  for (const tree of weatherTrees) {
    tree.rotation.z = Math.sin(time * 0.75 + tree.userData.windPhase) * (0.012 + state.weather.wind * 0.06);
    tree.rotation.x = Math.cos(time * 0.52 + tree.userData.windPhase) * (0.006 + state.weather.wind * 0.03);
  }

  const puddleBaseOpacity = Math.max(0, groundWetness - 0.06);
  for (const puddle of puddles) {
    const phase = puddle.userData.phase || 0;
    const shimmer = 0.015 * Math.sin(time * 2.4 + phase) + 0.01 * Math.sin(time * 4.9 + phase * 1.7);
    const size = puddle.userData.baseRadius * (1 + groundWetness * 0.06 + shimmer);
    puddle.scale.setScalar(size / puddle.userData.baseRadius);
    puddle.material.opacity = puddleBaseOpacity * (0.18 + Math.max(0, Math.sin(time * 1.7 + phase)) * 0.05);
    puddle.material.roughness = 0.12 + (1 - groundWetness) * 0.1;
    puddle.material.emissiveIntensity = 0.05 + groundWetness * 0.16;
  }
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seeded = mulberry32(9917);
function rand(min, max) {
  return min + (max - min) * seeded();
}

function createGrassTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6ea34e";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 16000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * 2.5;
    const h = 1 + Math.random() * 2.5;
    const g = 95 + Math.random() * 55;
    ctx.fillStyle = `rgba(${40 + Math.random() * 20}, ${g}, ${35 + Math.random() * 16}, ${0.06 + Math.random() * 0.1})`;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.anisotropy = 8;
  return texture;
}

function createWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9eb0b6";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#5d7881";
  ctx.fillRect(4, 4, 120, 120);
  for (let y = 12; y < 120; y += 22) {
    for (let x = 12; x < 120; x += 18) {
      const lit = Math.random() > 0.42;
      ctx.fillStyle = lit ? "#d7e8f2" : "#37505a";
      ctx.fillRect(x, y, 10, 14);
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createNoticeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const noticeLines = [
    "Biblioteca aberta ate 21h",
    "Mutirao do gramado: sexta",
    "Sala de convivencia: bloco central",
    "Se chover, o corredor vira atalho de lenda",
    "A jardineira passa de novo em poucos minutos",
    "Quem chegar cedo encontra sombra e fofoca"
  ];

  const weatherLines = {
    rain: [
      "Leve guarda-chuva, o gramado agradece",
      "Poça nova perto do bloco central",
      "Chuva surpresa bagunça a saida da aula"
    ],
    cloudy: [
      "Nuvem de tarde, clima de corredor",
      "Dia bom pra andar sem pressa",
      "Se pintar vento, as arvores fazem barulho"
    ],
    night: [
      "Noite calma, luzes acesas perto dos blocos",
      "Campus em modo baixo volume",
      "Se ouvir eco, talvez seja so o patio"
    ]
  };

  function clearBoard(accentColor) {
    ctx.fillStyle = "#f2e7d8";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = accentColor;
    ctx.fillRect(14, 14, 484, 228);
    ctx.fillStyle = "#f7f2e9";
    ctx.fillRect(22, 22, 468, 212);
  }

  function drawLines(title, lines, accentColor, footer) {
    clearBoard(accentColor);
    ctx.fillStyle = accentColor;
    ctx.font = "bold 34px Arial";
    ctx.fillText(title, 44, 72);
    ctx.font = "22px Arial";
    lines.forEach((line, index) => {
      ctx.fillText(line, 44, 122 + index * 36);
    });
    if (footer) {
      ctx.fillStyle = "#567061";
      ctx.font = "18px Arial";
      ctx.fillText(footer, 44, 226);
    }
    texture.needsUpdate = true;
  }

  function pickLine(bucket, time, offset = 0) {
    if (!bucket.length) return "";
    return bucket[Math.abs(Math.floor(time / 12 + offset)) % bucket.length];
  }

  function update(time = 0, state = {}) {
    const weatherKind = state.weather?.kind || "";
    const isRainy = weatherKind === "rain" || (state.weather?.rain ?? 0) > 0.08;
    const isCloudy = weatherKind === "cloudy" || (state.weather?.cloudMix ?? 0) > 0.35;
    const isNight = (state.daylight ?? 1) < 0.26;
    const baseLines = [
      `Agora: ${state.clock || "--:--"} • ${state.label || "campus"}`,
      state.weatherLabel ? `Clima: ${state.weatherLabel}` : "Clima: observando o patio",
      pickLine(noticeLines, time, state.daylight || 0)
    ];

    if (isRainy) {
      drawLines("Aviso de chuva", [
        `Agora: ${state.clock || "--:--"} • ${state.label || "campus"}`,
        state.weatherLabel ? `Clima: ${state.weatherLabel}` : "Clima: chuva ligeira",
        pickLine(weatherLines.rain, time, 1)
      ], "#2a5d7d", "Poças podem aparecer depois da chuva");
      return;
    }

    if (isNight) {
      drawLines("Aviso noturno", [
        `Agora: ${state.clock || "--:--"} • ${state.label || "campus"}`,
        state.weatherLabel ? `Clima: ${state.weatherLabel}` : "Clima: noite tranquila",
        pickLine(weatherLines.night, time, 2)
      ], "#5d6dc9", "Campus em modo baixo volume");
      return;
    }

    drawLines(isCloudy ? "Avisos do Campus" : "Mural Vivo", [
      baseLines[0],
      baseLines[1],
      pickLine(isCloudy ? weatherLines.cloudy : noticeLines, time, 0.5)
    ], isCloudy ? "#345c4a" : "#234634", isCloudy ? "O mural muda com o clima" : "Volte mais tarde para outro recado");
  }

  update(0, { clock: "07:30", label: "manhã", weatherLabel: "ensolarado", daylight: 0.82, weather: { kind: "clear", rain: 0, cloudMix: 0 } });

  return {
    texture,
    update
  };
}

function createBusSignTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f5efe2";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#1f6f43";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
  ctx.fillStyle = "#1f6f43";
  ctx.font = "bold 31px Arial";
  ctx.fillText("JARDINEIRA", 18, 47);
  ctx.font = "20px Arial";
  ctx.fillText("IFCE", 101, 72);
  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

function createCampusBannerTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, c.width, c.height);
  gradient.addColorStop(0, "#184d34");
  gradient.addColorStop(0.55, "#1d6a45");
  gradient.addColorStop(1, "#f3d24d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (let i = -120; i < 620; i += 52) {
    ctx.beginPath();
    ctx.moveTo(i, 18);
    ctx.lineTo(i + 78, 18);
    ctx.lineTo(i + 118, 238);
    ctx.lineTo(i + 40, 238);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 488, 232);

  ctx.fillStyle = "#f8f6ef";
  ctx.font = "bold 70px Arial";
  ctx.fillText("IFCE", 42, 106);
  ctx.font = "bold 28px Arial";
  ctx.fillText("campus gramadinho", 44, 154);
  ctx.font = "22px Arial";
  ctx.fillText("vento, jardineira e conversa de corredor", 44, 190);

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

function createCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  const fillBlob = (x, y, r, alpha) => {
    const gradient = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  fillBlob(78, 58, 30, 0.9);
  fillBlob(108, 46, 36, 0.95);
  fillBlob(140, 60, 32, 0.92);
  fillBlob(172, 54, 26, 0.88);
  fillBlob(126, 68, 42, 0.7);

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

const grass = createGrassTexture();
const windowTexture = createWindowTexture();
const noticeTexture = createNoticeTexture();
const busSignTexture = createBusSignTexture();
const campusBannerTexture = createCampusBannerTexture();

const world = new THREE.Group();
scene.add(world);

const blockers = [];
const mapFeatures = {
  buildings: [],
  paths: [],
  trees: []
};
const interactables = [];
const streetLamps = [];
const decorativeProps = [];
const cameraFrustum = new THREE.Frustum();
const cameraMatrix = new THREE.Matrix4();
const tempSphere = new THREE.Sphere();
const ENTITY_CULL_DIST = {
  npc: 40,
  duck: 30,
  pigeon: 28,
  interactable: 36,
  remote: 42,
  bus: 56
};
const weatherTrees = [];
const buses = [];
const puddles = [];
let groundWetness = 0;
const cloudTexture = createCloudTexture();
const cloudLayer = new THREE.Group();
scene.add(cloudLayer);
const cloudSprites = [];
const rainCount = 900;
const rainPositions = new Float32Array(rainCount * 3);
const rainVelocities = new Float32Array(rainCount);
const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
const rainMaterial = new THREE.PointsMaterial({
  color: 0xd9efff,
  size: 0.13,
  transparent: true,
  opacity: 0.34,
  depthWrite: false
});
const rainField = new THREE.Points(rainGeometry, rainMaterial);
rainField.frustumCulled = false;
scene.add(rainField);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
  new THREE.MeshStandardMaterial({
    map: grass,
    roughness: 1,
    metalness: 0
  })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

function createPuddle(x, z, radius, phase = 0) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8dc7e6,
      transparent: true,
      opacity: 0,
      roughness: 0.14,
      metalness: 0.32,
      emissive: 0x15324a,
      emissiveIntensity: 0.08,
      depthWrite: false
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.041, z);
  mesh.renderOrder = 2;
  mesh.userData = {
    baseRadius: radius,
    phase
  };
  world.add(mesh);
  puddles.push(mesh);
  return mesh;
}

createPuddle(-8, -5, 1.9, 0.15);
createPuddle(16, 7, 1.6, 1.35);
createPuddle(-19, 16, 2.1, 2.2);
createPuddle(8, 21, 1.45, 0.85);
createPuddle(24, -12, 1.55, 2.95);
createPuddle(-27, 9, 1.75, 1.8);

const walkways = new THREE.Group();
world.add(walkways);

function createCloudSprite(x, y, z, scale, drift, phase) {
  const cloud = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: cloudTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      fog: false
    })
  );
  cloud.position.set(x, y, z);
  cloud.scale.set(scale * 1.5, scale, 1);
  cloud.userData = { drift, phase, baseY: y, baseScale: scale };
  cloudLayer.add(cloud);
  cloudSprites.push(cloud);
  return cloud;
}

for (let i = 0; i < 7; i += 1) {
  const x = rand(-70, 70);
  const y = rand(18, 28);
  const z = rand(-34, 34);
  const scale = rand(10, 20);
  const drift = rand(0.15, 0.36);
  const phase = rand(0, Math.PI * 2);
  createCloudSprite(x, y, z, scale, drift, phase);
}

function addPath(width, depth, x, z, rotation = 0, surface = "cement") {
  mapFeatures.paths.push({ width, depth, x, z, rotation, surface });
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      color: 0xc8c1b2,
      roughness: 1,
      metalness: 0
    })
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, 0.03, z);
  path.receiveShadow = true;
  walkways.add(path);
}

addPath(84, 6, 0, -8);
addPath(6, 66, -10, 10);
addPath(32, 5, 20, 16, Math.PI / 12);
addPath(26, 5, -28, 18, -Math.PI / 14);
addPath(18, 4, 2, 28, 0, "corridor");

function createBlocker(minX, maxX, minZ, maxZ, options = {}) {
  const blocker = {
    minX,
    maxX,
    minZ,
    maxZ,
    active: options.active !== false,
  };
  blockers.push(blocker);
  return blocker;
}

function addBuilding({ x, z, width, depth, height, color, roof, name }) {
  mapFeatures.buildings.push({ x, z, width, depth, color, roof });
  const group = new THREE.Group();
  const wallThickness = 0.38;
  const doorWidth = THREE.MathUtils.clamp(width * 0.18, 2.2, Math.max(2.2, width - 4));
  const doorHeight = Math.min(height - 0.8, 2.65);
  const facadeDepth = depth / 2 - wallThickness / 2;
  const sideDepth = Math.max(0.8, depth - wallThickness * 2);
  const sideWallHeight = height;
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    map: windowTexture,
    roughness: 0.92,
    metalness: 0.03,
    transparent: true,
    opacity: 1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: roof,
    roughness: 1,
    transparent: true,
    opacity: 1,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf3f0e7,
    roughness: 0.8,
    transparent: true,
    opacity: 1,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe7decc,
    roughness: 0.98,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x6c4a2e,
    roughness: 0.92,
    transparent: true,
    opacity: 1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xb7aa8d,
    roughness: 0.95,
  });
  const shellMeshes = [];
  const frontSegmentWidth = Math.max(0.9, (width - doorWidth) / 2);

  function addShell(geometry, material, px, py, pz) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shellMeshes.push(mesh);
    return mesh;
  }

  addShell(
    new THREE.BoxGeometry(width, sideWallHeight, wallThickness),
    bodyMat,
    0,
    sideWallHeight / 2,
    -depth / 2 + wallThickness / 2
  );
  addShell(
    new THREE.BoxGeometry(wallThickness, sideWallHeight, sideDepth),
    bodyMat,
    -width / 2 + wallThickness / 2,
    sideWallHeight / 2,
    0
  );
  addShell(
    new THREE.BoxGeometry(wallThickness, sideWallHeight, sideDepth),
    bodyMat,
    width / 2 - wallThickness / 2,
    sideWallHeight / 2,
    0
  );
  addShell(
    new THREE.BoxGeometry(frontSegmentWidth, sideWallHeight, wallThickness),
    bodyMat,
    -doorWidth / 2 - frontSegmentWidth / 2,
    sideWallHeight / 2,
    facadeDepth
  );
  addShell(
    new THREE.BoxGeometry(frontSegmentWidth, sideWallHeight, wallThickness),
    bodyMat,
    doorWidth / 2 + frontSegmentWidth / 2,
    sideWallHeight / 2,
    facadeDepth
  );
  addShell(
    new THREE.BoxGeometry(doorWidth, Math.max(0.7, height - doorHeight), wallThickness),
    bodyMat,
    0,
    doorHeight + Math.max(0.7, height - doorHeight) / 2,
    facadeDepth
  );

  const top = addShell(
    new THREE.BoxGeometry(width + 0.3, 0.7, depth + 0.3),
    roofMat,
    0,
    height + 0.35,
    0
  );

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1.8, width - 0.7), 0.08, Math.max(1.8, depth - 0.7)),
    floorMat
  );
  floor.position.set(0, 0.04, 0);
  floor.receiveShadow = true;
  group.add(floor);

  const innerCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1.4, width - 2.4), 0.03, Math.max(1.4, depth - 2.2)),
    new THREE.MeshStandardMaterial({ color: 0xb8d7c0, roughness: 1 })
  );
  innerCarpet.position.set(0, 0.09, -0.12);
  group.add(innerCarpet);

  const innerBench = new THREE.Mesh(
    new THREE.BoxGeometry(Math.min(4, width - 2.8), 0.22, 0.54),
    accentMat
  );
  innerBench.position.set(0, 0.5, -Math.max(1.4, depth * 0.22));
  innerBench.castShadow = true;
  group.add(innerBench);

  const interiorLight = new THREE.PointLight(0xfff0c4, 0.32, Math.max(width, depth) * 1.4, 2);
  interiorLight.position.set(0, height - 0.9, 0);
  group.add(interiorLight);

  if (name) {
    const sign = addShell(
      new THREE.BoxGeometry(Math.min(width * 0.7, 10), 1.2, 0.3),
      frameMat,
      0,
      height * 0.65,
      depth / 2 + 0.18
    );
    sign.castShadow = true;
  }

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-doorWidth / 2, 0, facadeDepth + 0.03);
  group.add(leftDoorPivot);

  const leftDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth / 2 - 0.04, doorHeight, 0.08),
    doorMat
  );
  leftDoor.position.set((doorWidth / 2 - 0.04) / 2, doorHeight / 2, 0);
  leftDoor.castShadow = true;
  leftDoorPivot.add(leftDoor);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(doorWidth / 2, 0, facadeDepth + 0.03);
  group.add(rightDoorPivot);

  const rightDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth / 2 - 0.04, doorHeight, 0.08),
    doorMat
  );
  rightDoor.position.set(-(doorWidth / 2 - 0.04) / 2, doorHeight / 2, 0);
  rightDoor.castShadow = true;
  rightDoorPivot.add(rightDoor);

  group.position.set(x, 0, z);
  world.add(group);

  createBlocker(
    x - width / 2 - 0.9,
    x + width / 2 + 0.9,
    z - depth / 2 - wallThickness,
    z - depth / 2 + wallThickness
  );
  createBlocker(
    x - width / 2 - wallThickness,
    x - width / 2 + wallThickness,
    z - depth / 2,
    z + depth / 2
  );
  createBlocker(
    x + width / 2 - wallThickness,
    x + width / 2 + wallThickness,
    z - depth / 2,
    z + depth / 2
  );
  createBlocker(
    x - width / 2,
    x - doorWidth / 2,
    z + depth / 2 - wallThickness,
    z + depth / 2 + wallThickness
  );
  createBlocker(
    x + doorWidth / 2,
    x + width / 2,
    z + depth / 2 - wallThickness,
    z + depth / 2 + wallThickness
  );
  const doorBlocker = createBlocker(
    x - doorWidth / 2,
    x + doorWidth / 2,
    z + depth / 2 - wallThickness,
    z + depth / 2 + 0.5
  );

  let doorOpen = false;
  let doorAngle = 0;
  const maxDoorAngle = Math.PI * 0.62;

  function thresholdOccupied() {
    return (
      Math.abs(player.position.x - x) < doorWidth * 0.7 &&
      Math.abs(player.position.z - (z + depth / 2 - 0.1)) < 1.6
    );
  }

  interactables.push({
    kind: "door",
    label: name ? `Porta do ${name}` : "Porta",
    radius: 2.8,
    position: new THREE.Vector3(x, 0, z + depth / 2 - 0.2),
    root: group,
    npcDisabled: () => true,
    interact() {
      if (doorOpen) {
        if (thresholdOccupied()) {
          speak("Saia um pouco do vão para fechar a porta.", name || "Porta");
          return;
        }
        doorOpen = false;
        speak("A porta fechou com um clique seco.", name || "Porta");
        return;
      }
      doorOpen = true;
      speak(`A porta de ${name || "estrutura"} está aberta. Pode entrar.`, name || "Porta");
    },
    update(dt) {
      const targetAngle = doorOpen ? maxDoorAngle : 0;
      doorAngle = THREE.MathUtils.lerp(doorAngle, targetAngle, Math.min(1, dt * 7.5));
      leftDoorPivot.rotation.y = -doorAngle;
      rightDoorPivot.rotation.y = doorAngle;
      doorBlocker.active = doorAngle < maxDoorAngle * 0.55;

      const inside =
        player.position.x > x - width / 2 + wallThickness + 0.12 &&
        player.position.x < x + width / 2 - wallThickness - 0.12 &&
        player.position.z > z - depth / 2 + wallThickness + 0.12 &&
        player.position.z < z + depth / 2 - wallThickness - 0.12;
      const opacity = inside ? 0.18 : 1;

      bodyMat.opacity = opacity;
      bodyMat.depthWrite = opacity > 0.92;
      roofMat.opacity = inside ? 0.14 : 1;
      roofMat.depthWrite = !inside;
      frameMat.opacity = opacity;
      frameMat.depthWrite = opacity > 0.92;
      doorMat.opacity = inside ? 0.22 : 1;
      doorMat.depthWrite = !inside;

      for (const mesh of shellMeshes) {
        mesh.visible = true;
      }
      top.visible = true;
    }
  });
}

addBuilding({ x: 0, z: -28, width: 26, depth: 12, height: 7, color: 0xdbe0dd, roof: 0x8b3d2c, name: "bloco central" });
addBuilding({ x: -26, z: -16, width: 18, depth: 10, height: 5.5, color: 0xcfd7cc, roof: 0x6c7f56, name: "sala norte" });
addBuilding({ x: 25, z: -14, width: 17, depth: 10, height: 5.5, color: 0xd6d2c8, roof: 0x8a6b4c, name: "laboratorio" });
addBuilding({ x: 18, z: 24, width: 16, depth: 9, height: 5, color: 0xc8d0da, roof: 0x4a6278, name: "biblioteca" });
addBuilding({ x: -21, z: 26, width: 13, depth: 8, height: 4.5, color: 0xddddcf, roof: 0x64725f, name: "secretaria" });
addBuilding({ x: 0, z: 10, width: 10, depth: 8, height: 4.2, color: 0xe3dad0, roof: 0x715142, name: "atelier" });

function createTree() {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 2.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1 })
  );
  trunk.position.y = 1.4;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x44753e, roughness: 1 })
  );
  crown.position.y = 3.2;
  crown.castShadow = true;
  tree.add(crown);
  return tree;
}

for (let i = 0; i < 86; i += 1) {
  const tree = createTree();
  const side = i % 4;
  let x = rand(-64, 64);
  let z = rand(-64, 64);
  if (side === 0) z = rand(-66, -48);
  if (side === 1) z = rand(48, 66);
  if (side === 2) x = rand(-66, -48);
  if (side === 3) x = rand(48, 66);
  tree.position.set(x, 0, z);
  tree.rotation.y = rand(0, Math.PI * 2);
  tree.userData.windPhase = rand(0, Math.PI * 2);
  world.add(tree);
  mapFeatures.trees.push({ x, z });
  weatherTrees.push(tree);
}

function createCharacter({
  shirtColor,
  pantsColor,
  shoesColor,
  skinColor,
  backpackColor,
  hairColor = 0x3a2516,
  scale = 1,
  backpack = true,
  glasses = false
}) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const faceMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.96 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.98 });
  const shoes = new THREE.MeshStandardMaterial({ color: shoesColor, roughness: 1 });
  const backpackMat = new THREE.MeshStandardMaterial({ color: backpackColor, roughness: 1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });

  const torso = new THREE.Group();
  torso.position.set(0, 1.0, 0);
  root.add(torso);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.46, 6, 16), shirt);
  body.position.y = 0.45;
  body.scale.set(1.14, 0.92, 0.9);
  body.castShadow = true;
  torso.add(body);

  const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.035), new THREE.MeshStandardMaterial({
    color: new THREE.Color(shirtColor).offsetHSL(0, -0.05, 0.12).getHex(),
    roughness: 0.92
  }));
  shirtFront.position.set(0, 0.48, 0.33);
  torso.add(shirtFront);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 18), shirt);
  collar.position.y = 0.92;
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.2, 0.78, 1);
  torso.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skin);
  neck.position.y = 1.02;
  neck.castShadow = true;
  torso.add(neck);

  if (backpack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.22), backpackMat);
    pack.position.set(0, 0.5, -0.34);
    pack.castShadow = true;
    torso.add(pack);

    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.08), backpackMat);
    strapL.position.set(-0.2, 0.55, -0.2);
    torso.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.2;
    torso.add(strapR);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.16, 0.02);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.39, 26, 24), skin);
  skull.scale.set(1.02, 1.08, 0.95);
  skull.castShadow = true;
  head.add(skull);

  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), faceMat);
  facePatch.position.set(0, -0.04, 0.21);
  facePatch.scale.set(0.95, 1.05, 0.46);
  facePatch.castShadow = false;
  head.add(facePatch);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.405, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.86), hairMat);
  hair.position.set(0, 0.15, -0.035);
  hair.scale.set(1.04, 0.78, 1.02);
  hair.castShadow = true;
  head.add(hair);

  const bangGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const bangData = [
    [-0.22, 0.22, 0.2, 0.18, 0.12],
    [-0.08, 0.25, 0.235, 0.04, 0.08],
    [0.08, 0.25, 0.235, -0.04, 0.08],
    [0.22, 0.22, 0.2, -0.18, 0.12],
  ];
  for (const [x, y, z, rz, rx] of bangData) {
    const bang = new THREE.Mesh(bangGeo, hairMat);
    bang.position.set(x, y, z);
    bang.scale.set(1.18, 0.62, 0.55);
    bang.rotation.z = rz;
    bang.rotation.x = rx;
    bang.castShadow = true;
    head.add(bang);
  }

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), hairMat);
  hairBack.position.set(0, -0.08, -0.27);
  hairBack.scale.set(1.18, 1.08, 0.82);
  head.add(hairBack);

  const leftSideHair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMat);
  leftSideHair.position.set(-0.34, 0.02, -0.02);
  leftSideHair.scale.set(0.58, 1.22, 0.72);
  head.add(leftSideHair);
  const rightSideHair = leftSideHair.clone();
  rightSideHair.position.x = 0.28;
  head.add(rightSideHair);

  const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), skin);
  leftEar.scale.set(0.6, 1, 0.4);
  leftEar.position.set(-0.36, -0.01, 0.02);
  head.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.32;
  head.add(rightEar);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), eyeWhiteMat);
  leftEyeWhite.position.set(-0.135, 0.055, 0.352);
  leftEyeWhite.scale.set(1.06, 0.9, 0.48);
  head.add(leftEyeWhite);
  const rightEyeWhite = leftEyeWhite.clone();
  rightEyeWhite.position.x = 0.12;
  head.add(rightEyeWhite);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 10), eyeMat);
  leftEye.position.set(-0.135, 0.052, 0.402);
  head.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.12;
  head.add(rightEye);

  const browMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const leftSpark = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), eyeWhiteMat);
  leftSpark.position.set(-0.146, 0.067, 0.428);
  head.add(leftSpark);
  const rightSpark = leftSpark.clone();
  rightSpark.position.x = 0.115;
  head.add(rightSpark);

  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.019, 0.018), browMat);
  leftBrow.position.set(-0.135, 0.155, 0.366);
  leftBrow.rotation.z = 0.12;
  head.add(leftBrow);
  const rightBrow = leftBrow.clone();
  rightBrow.position.x = 0.12;
  rightBrow.rotation.z = -0.12;
  head.add(rightBrow);

  const noseMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 8), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.018, 0.392);
  head.add(nose);

  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7f3030, roughness: 0.6 });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.011, 8, 18, Math.PI), mouthMat);
  mouth.position.set(0, -0.135, 0.392);
  mouth.rotation.x = -0.08;
  mouth.scale.y = 0.72;
  head.add(mouth);

  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xe08a8a, roughness: 1, transparent: true, opacity: 0.55
  });
  const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), cheekMat);
  leftCheek.position.set(-0.225, -0.075, 0.335);
  leftCheek.scale.set(1.12, 0.72, 0.32);
  head.add(leftCheek);
  const rightCheek = leftCheek.clone();
  rightCheek.position.x = 0.2;
  head.add(rightCheek);

  if (glasses) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xa9d8ef, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55
    });
    const lensGeo = new THREE.TorusGeometry(0.09, 0.012, 8, 18);
    const leftLens = new THREE.Mesh(lensGeo, frameMat);
    leftLens.position.set(-0.13, 0.06, 0.365);
    head.add(leftLens);
    const rightLens = leftLens.clone();
    rightLens.position.x = 0.12;
    head.add(rightLens);

    const innerGeo = new THREE.CircleGeometry(0.082, 16);
    const leftGlass = new THREE.Mesh(innerGeo, lensMat);
    leftGlass.position.set(-0.13, 0.06, 0.367);
    head.add(leftGlass);
    const rightGlass = leftGlass.clone();
    rightGlass.position.x = 0.12;
    head.add(rightGlass);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), frameMat);
    bridge.position.set(0, 0.06, 0.365);
    head.add(bridge);

    const templeGeo = new THREE.BoxGeometry(0.16, 0.012, 0.012);
    const leftTemple = new THREE.Mesh(templeGeo, frameMat);
    leftTemple.position.set(-0.25, 0.06, 0.25);
    leftTemple.rotation.y = 0.4;
    head.add(leftTemple);
    const rightTemple = leftTemple.clone();
    rightTemple.position.x = 0.22;
    rightTemple.rotation.y = -0.4;
    head.add(rightTemple);
  }

  function buildArm(side) {
    const sign = side === "left" ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.48, 0.88, 0);
    shoulder.rotation.z = sign * 0.12;
    shoulder.rotation.x = -0.03;
    torso.add(shoulder);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), shirt);
    shoulderBall.castShadow = true;
    shoulder.add(shoulderBall);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 5, 12), shirt);
    upperArm.position.y = -0.25;
    upperArm.rotation.z = sign * 0.02;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.48;
    shoulder.add(elbow);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), shirt);
    elbowBall.scale.set(1.05, 0.82, 1.05);
    elbowBall.castShadow = true;
    elbow.add(elbowBall);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.36, 5, 12), skin);
    forearm.position.y = -0.27;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.073, 10, 8), skin);
    wrist.position.y = -0.49;
    wrist.scale.set(1, 0.8, 1);
    elbow.add(wrist);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
    hand.position.y = -0.59;
    hand.scale.set(0.95, 1.12, 0.78);
    hand.castShadow = true;
    elbow.add(hand);

    for (const x of [-0.045, 0, 0.045]) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.065, 3, 6), skin);
      finger.position.set(x, -0.68, 0.02);
      finger.castShadow = true;
      elbow.add(finger);
    }

    return { shoulder, elbow };
  }

  const leftArm = buildArm("left");
  const rightArm = buildArm("right");

  function buildLeg(side) {
    const sign = side === "left" ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.18, 1.05, 0);
    root.add(hip);

    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), pants);
    hipBall.castShadow = true;
    hip.add(hipBall);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.42, 12), pants);
    thigh.position.y = -0.225;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);

    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), pants);
    kneeBall.castShadow = true;
    knee.add(kneeBall);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 12), pants);
    shin.position.y = -0.225;
    shin.castShadow = true;
    knee.add(shin);

    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pants);
    ankle.position.y = -0.44;
    ankle.scale.set(1, 0.72, 1);
    ankle.castShadow = true;
    knee.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.5), shoes);
    foot.position.set(0, -0.48, 0.1);
    foot.castShadow = true;
    knee.add(foot);

    const heelCap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), shoes);
    heelCap.position.set(0, -0.47, -0.1);
    heelCap.scale.set(1.2, 0.7, 0.9);
    knee.add(heelCap);

    return { hip, knee };
  }

  const leftLeg = buildLeg("left");
  const rightLeg = buildLeg("right");

  return {
    group: root,
    refs: {
      torso,
      head,
      leftShoulder: leftArm.shoulder,
      leftElbow: leftArm.elbow,
      rightShoulder: rightArm.shoulder,
      rightElbow: rightArm.elbow,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee
    }
  };
}

function animateWalk(refs, walkPhase, intensity) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const armSwing = Math.sin(walkPhase) * 1.0 * k;
  const legSwing = Math.sin(walkPhase) * 0.85 * k;

  refs.leftShoulder.rotation.x = -0.03;
  refs.rightShoulder.rotation.x = -0.03;
  refs.leftShoulder.rotation.z = -0.01;
  refs.rightShoulder.rotation.z = 0.01;
  refs.leftElbow.rotation.x = 0.1 + armSwing * 0.82;
  refs.rightElbow.rotation.x = 0.1 - armSwing * 0.82;

  refs.leftHip.rotation.x = -legSwing;
  refs.rightHip.rotation.x = legSwing;
  refs.leftKnee.rotation.x = Math.max(0, legSwing) * 1.2;
  refs.rightKnee.rotation.x = Math.max(0, -legSwing) * 1.2;

  refs.torso.rotation.y = -armSwing * 0.14;
  refs.head.rotation.y = armSwing * 0.07;
  refs.head.rotation.x = Math.sin(walkPhase * 2) * 0.05;
}

function setRestPose(refs, time, offset = 0) {
  const breath = Math.sin(time * 1.6 + offset) * 0.05;
  refs.leftShoulder.rotation.x = -0.04 + breath * 0.35;
  refs.rightShoulder.rotation.x = -0.04 - breath * 0.35;
  refs.leftElbow.rotation.x = 0.14 + breath * 0.25;
  refs.rightElbow.rotation.x = 0.14 + breath * 0.25;
  refs.leftHip.rotation.x = 0;
  refs.rightHip.rotation.x = 0;
  refs.leftKnee.rotation.x = 0.05;
  refs.rightKnee.rotation.x = 0.05;
  refs.torso.rotation.y = Math.sin(time * 0.6 + offset) * 0.04;
  refs.head.rotation.y = Math.sin(time * 0.5 + offset * 1.3) * 0.18;
  refs.head.rotation.x = Math.sin(time * 0.8 + offset) * 0.04;
}

function animateCelebrate(refs, time, intensity = 1) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const bounce = Math.sin(time * 7.5) * 0.18 * k;
  const armLift = 1.05 + Math.abs(Math.sin(time * 6.5)) * 0.4 * k;
  refs.leftShoulder.rotation.x = -0.88 - bounce;
  refs.rightShoulder.rotation.x = -0.88 - bounce;
  refs.leftShoulder.rotation.z = 0.22 + Math.sin(time * 4.2) * 0.12 * k;
  refs.rightShoulder.rotation.z = -0.22 - Math.sin(time * 4.2) * 0.12 * k;
  refs.leftElbow.rotation.x = armLift;
  refs.rightElbow.rotation.x = armLift;
  refs.leftElbow.rotation.z = Math.sin(time * 5.1) * 0.08 * k;
  refs.rightElbow.rotation.z = -Math.sin(time * 5.1) * 0.08 * k;
  refs.leftHip.rotation.x = bounce * 0.15;
  refs.rightHip.rotation.x = bounce * 0.15;
  refs.leftKnee.rotation.x = 0.15 + Math.max(0, bounce) * 0.45;
  refs.rightKnee.rotation.x = 0.15 + Math.max(0, bounce) * 0.45;
  refs.torso.rotation.x = 0.1 + bounce * 0.45;
  refs.torso.rotation.y = Math.sin(time * 3.8) * 0.18 * k;
  refs.head.rotation.x = -0.08 + Math.sin(time * 8.2) * 0.04 * k;
  refs.head.rotation.y = Math.sin(time * 3.8) * 0.14 * k;
  refs.head.rotation.z = Math.sin(time * 6.9) * 0.1 * k;
}

function setSittingPose(refs) {
  refs.leftShoulder.rotation.x = -0.08;
  refs.rightShoulder.rotation.x = -0.08;
  refs.leftElbow.rotation.x = 0.42;
  refs.rightElbow.rotation.x = 0.42;
  refs.leftHip.rotation.x = -Math.PI / 2.2;
  refs.rightHip.rotation.x = -Math.PI / 2.2;
  refs.leftKnee.rotation.x = Math.PI / 2.3;
  refs.rightKnee.rotation.x = Math.PI / 2.3;
  refs.torso.rotation.y = 0;
  refs.head.rotation.x = -0.05;
  refs.head.rotation.y = 0;
}

function animateRun(refs, walkPhase, intensity) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const armSwing = Math.sin(walkPhase) * 1.6 * k;
  const legSwing = Math.sin(walkPhase) * 1.35 * k;
  refs.leftShoulder.rotation.x = -0.08;
  refs.rightShoulder.rotation.x = -0.08;
  refs.leftShoulder.rotation.z = 0.1;
  refs.rightShoulder.rotation.z = -0.1;
  refs.leftElbow.rotation.x = 0.45 + armSwing * 1.35;
  refs.rightElbow.rotation.x = 0.45 - armSwing * 1.35;
  refs.leftElbow.rotation.z = 0.03;
  refs.rightElbow.rotation.z = -0.03;
  refs.leftHip.rotation.x = -legSwing;
  refs.rightHip.rotation.x = legSwing;
  refs.leftKnee.rotation.x = Math.max(0, legSwing) * 1.7;
  refs.rightKnee.rotation.x = Math.max(0, -legSwing) * 1.7;
  refs.torso.rotation.x = 0.12 * k;
  refs.torso.rotation.y = -armSwing * 0.12;
  refs.head.rotation.x = 0.02 - Math.sin(walkPhase * 2) * 0.03;
  refs.head.rotation.y = armSwing * 0.05;
}

function setCrouchPose(refs, time, intensity) {
  const wobble = Math.sin(time * 6) * 0.06 * intensity;
  refs.leftShoulder.rotation.x = 0.12 + wobble;
  refs.rightShoulder.rotation.x = 0.12 - wobble;
  refs.leftElbow.rotation.x = 0.88;
  refs.rightElbow.rotation.x = 0.88;
  refs.leftHip.rotation.x = -0.9 - wobble * 0.4;
  refs.rightHip.rotation.x = -0.9 + wobble * 0.4;
  refs.leftKnee.rotation.x = 1.6;
  refs.rightKnee.rotation.x = 1.6;
  refs.torso.rotation.x = 0.35;
  refs.torso.rotation.y = wobble * 0.3;
  refs.head.rotation.x = -0.15;
  refs.head.rotation.y = wobble * 0.3;
}

function resetRigPose(refs) {
  for (const key of Object.keys(refs)) {
    const obj = refs[key];
    if (obj && obj.rotation) obj.rotation.set(0, 0, 0);
  }
}

function animateDance(refs, time) {
  const t = time * 4.2;
  const sway = Math.sin(t);
  const bob = Math.sin(t * 2) * 0.08;
  refs.leftShoulder.rotation.x = -1.18 + sway * 0.18;
  refs.rightShoulder.rotation.x = -1.18 - sway * 0.18;
  refs.leftShoulder.rotation.y = 0;
  refs.rightShoulder.rotation.y = 0;
  refs.leftShoulder.rotation.z = 0.4 + Math.cos(t) * 0.12;
  refs.rightShoulder.rotation.z = -0.4 - Math.cos(t) * 0.12;
  refs.leftElbow.rotation.x = 0.95 + Math.sin(t + 0.5) * 0.16;
  refs.rightElbow.rotation.x = 0.95 - Math.sin(t + 0.5) * 0.16;
  refs.leftElbow.rotation.z = 0.04;
  refs.rightElbow.rotation.z = -0.04;
  refs.leftHip.rotation.x = sway * 0.16;
  refs.rightHip.rotation.x = -sway * 0.16;
  refs.leftKnee.rotation.x = 0.12 + Math.max(0, sway) * 0.18;
  refs.rightKnee.rotation.x = 0.12 + Math.max(0, -sway) * 0.18;
  refs.torso.rotation.x = 0;
  refs.torso.rotation.y = sway * 0.16;
  refs.torso.rotation.z = sway * 0.06;
  refs.head.rotation.y = sway * 0.16;
  refs.head.rotation.x = bob;
  refs.head.rotation.z = sway * 0.04;
}

function animateSixSeven(refs, time, offset = 0) {
  const t = time * 5.4 + offset;
  const wave = Math.sin(t);
  refs.leftShoulder.rotation.x = -0.14;
  refs.rightShoulder.rotation.x = -0.14;
  refs.leftShoulder.rotation.y = 0;
  refs.rightShoulder.rotation.y = 0;
  refs.leftShoulder.rotation.z = -0.2;
  refs.rightShoulder.rotation.z = 0.2;
  refs.leftElbow.rotation.x = -1.18 + wave * 0.58;
  refs.rightElbow.rotation.x = -1.18 - wave * 0.58;
  refs.leftElbow.rotation.y = 0;
  refs.rightElbow.rotation.y = 0;
  refs.leftElbow.rotation.z = -0.08;
  refs.rightElbow.rotation.z = 0.08;
  refs.leftHip.rotation.x = Math.max(0, -wave) * 0.08;
  refs.rightHip.rotation.x = Math.max(0, wave) * 0.08;
  refs.leftKnee.rotation.x = 0.08 + Math.max(0, wave) * 0.12;
  refs.rightKnee.rotation.x = 0.08 + Math.max(0, -wave) * 0.12;
  refs.torso.rotation.y = wave * 0.08;
  refs.torso.rotation.z = wave * 0.04;
  refs.head.rotation.y = -wave * 0.1;
  refs.head.rotation.x = -0.02 + Math.sin(t * 2) * 0.025;
}

function animateGlitch(refs, time, intensity = 1, offset = 0) {
  const wobble = Math.sin(time * 26 + offset) * 0.18 * intensity;
  const snap = Math.sin(time * 41 + offset * 0.7) * 0.08 * intensity;
  const jitter = Math.sin(time * 55 + offset * 1.9) * 0.05 * intensity;

  refs.torso.rotation.y = wobble * 0.8;
  refs.torso.rotation.z = snap * 0.7;
  refs.head.rotation.y = wobble * 1.2;
  refs.head.rotation.x = snap * 0.9;
  refs.head.rotation.z = jitter;
  refs.leftShoulder.rotation.x += wobble * 0.25;
  refs.rightShoulder.rotation.x -= wobble * 0.25;
  refs.leftShoulder.rotation.z = snap * 0.45;
  refs.rightShoulder.rotation.z = -snap * 0.45;
  refs.leftElbow.rotation.x += jitter * 0.9;
  refs.rightElbow.rotation.x -= jitter * 0.9;
  refs.leftHip.rotation.x += snap * 0.35;
  refs.rightHip.rotation.x -= snap * 0.35;
  refs.leftKnee.rotation.z = wobble * 0.22;
  refs.rightKnee.rotation.z = -wobble * 0.22;
}

const playerRig = createCharacter(avatarToGameAppearance(opts.avatar));
const player = playerRig.group;
world.add(player);
player.position.set(-40, 0, 38);

function createNameLabel(text, color = "#fff8dc", accent = "#62ff9f") {
  const canvasEl = document.createElement("canvas");
  const padding = 28;
  const fontSize = 56;
  const ctx2 = canvasEl.getContext("2d");
  ctx2.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const metrics = ctx2.measureText(text);
  canvasEl.width = Math.max(256, Math.ceil(metrics.width) + padding * 2);
  canvasEl.height = fontSize + padding * 2;
  const c = canvasEl.getContext("2d");
  c.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";

  const r = 28;
  const w = canvasEl.width;
  const h = canvasEl.height;
  c.fillStyle = "rgba(14, 24, 16, 0.78)";
  c.beginPath();
  c.moveTo(r, 4);
  c.lineTo(w - r, 4);
  c.quadraticCurveTo(w - 4, 4, w - 4, r + 4);
  c.lineTo(w - 4, h - r - 4);
  c.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
  c.lineTo(r, h - 4);
  c.quadraticCurveTo(4, h - 4, 4, h - r - 4);
  c.lineTo(4, r + 4);
  c.quadraticCurveTo(4, 4, r, 4);
  c.closePath();
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = accent;
  c.stroke();

  c.fillStyle = color;
  c.shadowColor = "rgba(0,0,0,0.6)";
  c.shadowBlur = 6;
  c.fillText(text, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvasEl.width / canvasEl.height;
  const baseHeight = 0.55;
  sprite.scale.set(baseHeight * aspect, baseHeight, 1);
  sprite.position.y = 2.72;
  sprite.renderOrder = 999;
  return sprite;
}

let localLabel = createNameLabel(localNickname, "#fff8dc", "#62ff9f");
player.add(localLabel);

function disposeMaterial(material, seenMaterials, seenTextures) {
  if (!material || seenMaterials.has(material)) return;
  seenMaterials.add(material);
  for (const key of [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap",
  ]) {
    const texture = material[key];
    if (texture && !seenTextures.has(texture)) {
      seenTextures.add(texture);
      texture.dispose?.();
    }
  }
  material.dispose?.();
}

function disposeObject3D(object) {
  if (!object) return;
  const seenGeometries = new Set();
  const seenMaterials = new Set();
  const seenTextures = new Set();
  object.traverse?.((node) => {
    if (node.geometry && !seenGeometries.has(node.geometry)) {
      seenGeometries.add(node.geometry);
      node.geometry.dispose?.();
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      disposeMaterial(material, seenMaterials, seenTextures);
    }
  });
}

function disposeSprite(sprite) {
  disposeObject3D(sprite);
}

const remotePlayers = new Map();
const sharedBikes = new Map();
let sharedBikeCount = 0;

function getFallbackRemoteAppearance(id = "") {
  const palette = hashPalette(id);
  return {
    shirtColor: palette.shirt ?? 0x4f9bd3,
    pantsColor: palette.pants ?? 0x2a3540,
    shoesColor: 0x202020,
    skinColor: 0xeec39c,
    backpackColor: 0x9b6b3a,
    hairColor: 0x3a2516,
    scale: 1,
    backpack: true,
    glasses: false,
  };
}

function createRemoteRig(nickname, appearance) {
  const rig = createCharacter(appearance || getFallbackRemoteAppearance());
  const label = createNameLabel(nickname || "Player", "#fff8dc", "#f6b94b");
  rig.group.add(label);
  return { rig, label };
}

function hashPalette(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  const c = new THREE.Color().setHSL(hue / 360, 0.55, 0.5);
  const c2 = new THREE.Color().setHSL(((hue + 40) % 360) / 360, 0.4, 0.25);
  return { shirt: c.getHex(), pants: c2.getHex() };
}

function addRemotePlayer(state) {
  if (!state || !state.id) return;
  if (remotePlayers.has(state.id)) {
    updateRemotePlayer(state);
    return;
  }
  const appearance = state.avatar ? avatarToGameAppearance(state.avatar) : getFallbackRemoteAppearance(state.id);
  const { rig, label } = createRemoteRig(state.nick, appearance);
  const group = rig.group;
  group.position.set(state.x ?? 0, 0, state.z ?? 0);
  group.rotation.y = state.ry ?? 0;
  world.add(group);
  const mapColor = state.avatar?.shirt || `#${appearance.shirtColor.toString(16).padStart(6, "0")}`;
  remotePlayers.set(state.id, {
    id: state.id,
    nick: state.nick,
    avatar: state.avatar || null,
    rig,
    group,
    label,
    mapColor,
    targetX: group.position.x,
    targetZ: group.position.z,
    targetRy: group.rotation.y,
    speed: 0,
    activity: state.activity || "idle",
    jumpY: typeof state.jumpY === "number" ? state.jumpY : 0,
    walkPhase: 0,
    ridePhase: 0,
    celebrateTimer: 0,
    celebrateSeed: Math.random() * Math.PI * 2,
    glitchTimer: 0,
    glitchSeed: Math.random() * Math.PI * 2
  });
}

function updateRemotePlayer(state) {
  const r = remotePlayers.get(state.id);
  if (!r) {
    addRemotePlayer(state);
    return;
  }
  if (typeof state.x === "number") r.targetX = state.x;
  if (typeof state.z === "number") r.targetZ = state.z;
  if (typeof state.ry === "number") r.targetRy = state.ry;
  if (typeof state.speed === "number") r.speed = state.speed;
  if (typeof state.activity === "string") r.activity = state.activity;
  if (typeof state.jumpY === "number") r.jumpY = Math.max(0, state.jumpY);
}

function removeRemotePlayer(id) {
  const r = remotePlayers.get(id);
  if (!r) return;
  for (const bike of sharedBikes.values()) {
    if (bike.remoteMountedBy === id) {
      bike.remoteMountedBy = null;
      bike.remoteSpeed = 0;
    }
  }
  clearChatBubblesFor(id);
  world.remove(r.group);
  disposeObject3D(r.group);
  remotePlayers.delete(id);
}

function updateSharedEntity(state) {
  if (!state?.id || state.kind !== "bike") return;
  const bike = sharedBikes.get(state.id);
  if (!bike || playerState.ridingBike === bike) return;
  if (typeof state.x === "number") bike.targetX = state.x;
  if (typeof state.z === "number") bike.targetZ = state.z;
  if (typeof state.ry === "number") bike.targetRy = state.ry;
  if (typeof state.speed === "number") bike.remoteSpeed = state.speed;
  bike.remoteMountedBy = typeof state.mountedBy === "string" ? state.mountedBy : null;
  bike.hasSharedState = true;
}

function setRemoteNick(id, nick) {
  const r = remotePlayers.get(id);
  if (!r) return;
  r.group.remove(r.label);
  disposeSprite(r.label);
  const newLabel = createNameLabel(nick || "Player", "#fff8dc", "#f6b94b");
  r.group.add(newLabel);
  r.label = newLabel;
  r.nick = nick;
}

function setLocalNick(nick) {
  player.remove(localLabel);
  disposeSprite(localLabel);
  localLabel = createNameLabel(nick || "Você", "#fff8dc", "#62ff9f");
  player.add(localLabel);
}

const chatBubbles = new Map(); // pid -> [{sprite, ttl, height, group}]
const BUBBLE_TTL = 15;
const EMOTE_TTL = 2.4;
const REACTION_TTL = 1.6;
const EMOTE_GLYPHS = {
  dance: "🕺",
  laugh: "😂",
  point: "👉",
  sixseven: "🤲",
  wave: "👋",
  cheer: "🎉",
  glitch: "🫨",
  stop: "✋",
  like: "👍",
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createSpeechBubble(text) {
  const padX = 46;
  const padY = 36;
  const fontSize = 60;
  const maxTextWidth = 760;
  const lineHeight = fontSize * 1.18;
  const tailHeight = 26;

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const lines = wrapText(measure, text, maxTextWidth);

  const textWidth = Math.min(
    maxTextWidth,
    Math.max(...lines.map((l) => measure.measureText(l).width))
  );
  const w = Math.ceil(textWidth + padX * 2);
  const h = Math.ceil(lines.length * lineHeight + padY * 2 + tailHeight);

  const canvasEl = document.createElement("canvas");
  canvasEl.width = w;
  canvasEl.height = h;
  const c = canvasEl.getContext("2d");
  c.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  c.textBaseline = "middle";
  c.textAlign = "center";
  c.lineJoin = "round";
  c.shadowColor = "rgba(0, 0, 0, 0.42)";
  c.shadowBlur = 10;
  c.shadowOffsetY = 3;

  const bodyH = h - tailHeight;
  const r = 30;
  c.fillStyle = "rgba(255, 255, 248, 1)";
  c.strokeStyle = "rgba(12, 24, 16, 0.98)";
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(r, 2);
  c.lineTo(w - r, 2);
  c.quadraticCurveTo(w - 2, 2, w - 2, r + 2);
  c.lineTo(w - 2, bodyH - r);
  c.quadraticCurveTo(w - 2, bodyH, w - r, bodyH);
  c.lineTo(w / 2 + 14, bodyH);
  c.lineTo(w / 2, bodyH + tailHeight - 2);
  c.lineTo(w / 2 - 14, bodyH);
  c.lineTo(r, bodyH);
  c.quadraticCurveTo(2, bodyH, 2, bodyH - r);
  c.lineTo(2, r + 2);
  c.quadraticCurveTo(2, 2, r, 2);
  c.closePath();
  c.fill();
  c.stroke();

  c.shadowColor = "transparent";
  c.fillStyle = "#07140b";
  for (let i = 0; i < lines.length; i += 1) {
    const y = padY + lineHeight / 2 + i * lineHeight;
    c.fillText(lines[i], w / 2, y);
  }

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  const baseHeight = 1.45;
  const aspect = w / h;
  sprite.scale.set(baseHeight * aspect, baseHeight, 1);
  sprite.renderOrder = 1000;
  return sprite;
}

function layoutBubblesFor(pid) {
  const list = chatBubbles.get(pid);
  if (!list) return;
  let y = 3.45;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    list[i].sprite.position.y = y;
    y += list[i].sprite.scale.y + 0.12;
  }
}

function pushBubble(target, text, ttl = BUBBLE_TTL) {
  if (!text) return;
  let group = null;
  let key = null;
  if (typeof target === "string") {
    key = target;
    if (target === "__local__") {
      group = player;
    } else {
      const r = remotePlayers.get(target);
      if (!r) return;
      group = r.group;
    }
  } else if (target && target.group) {
    key = target.key || target.id || target.group.uuid;
    group = target.group;
  } else {
    return;
  }
  const sprite = createSpeechBubble(text);
  group.add(sprite);
  if (!chatBubbles.has(key)) chatBubbles.set(key, []);
  const list = chatBubbles.get(key);
  list.push({ sprite, ttl, group });
  if (list.length > 4) {
    const old = list.shift();
    group.remove(old.sprite);
    disposeSprite(old.sprite);
  }
  layoutBubblesFor(key);
}

function pushChatBubble(playerId, text) {
  pushBubble(playerId, text, BUBBLE_TTL);
}

function pushEmoteBubble(playerId, kind) {
  const glyph = EMOTE_GLYPHS[kind] || "✨";
  pushBubble(playerId, glyph, EMOTE_TTL);
}

function pushReactionBubble(playerId, kind = "like") {
  const glyph = EMOTE_GLYPHS[kind] || "👍";
  pushBubble(playerId, glyph, REACTION_TTL);
}

function clearChatBubblesFor(playerId) {
  const list = chatBubbles.get(playerId);
  if (!list) return;
  for (const b of list) {
    b.group.remove(b.sprite);
    disposeSprite(b.sprite);
  }
  chatBubbles.delete(playerId);
}

function updateBubbles(dt) {
  for (const [pid, list] of chatBubbles) {
    let changed = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      list[i].ttl -= dt;
      if (list[i].ttl <= 0) {
        list[i].group.remove(list[i].sprite);
        disposeSprite(list[i].sprite);
        list.splice(i, 1);
        changed = true;
      } else if (list[i].ttl < 0.8) {
        list[i].sprite.material.opacity = Math.max(0, list[i].ttl / 0.8);
      }
    }
    if (list.length === 0) chatBubbles.delete(pid);
    else if (changed) layoutBubblesFor(pid);
  }
}

function updateRemotes(dt, time) {
  for (const r of remotePlayers.values()) {
    const jumpY = Math.max(0, r.jumpY || 0);
    if (r.glitchTimer && r.glitchTimer > 0) {
      r.glitchTimer -= dt;
      setRestPose(r.rig.refs, time, r.glitchSeed || 0);
      animateGlitch(r.rig.refs, time, 1, r.glitchSeed || 0);
      r.group.position.y = jumpY + Math.sin(time * 14 + (r.glitchSeed || 0)) * 0.06;
      continue;
    }
    if (r.celebrateTimer && r.celebrateTimer > 0) {
      r.celebrateTimer -= dt;
      animateCelebrate(r.rig.refs, time + (r.celebrateSeed || 0), 1);
      r.group.position.y = jumpY + Math.abs(Math.sin((time + (r.celebrateSeed || 0)) * 9)) * 0.08;
      continue;
    }
    if (r.sixSevenTimer && r.sixSevenTimer > 0) {
      r.sixSevenTimer -= dt;
      animateSixSeven(r.rig.refs, time, r.sixSevenSeed || 0);
      r.group.position.y = jumpY + Math.abs(Math.sin((time + (r.sixSevenSeed || 0)) * 4.8)) * 0.025;
      if (r.sixSevenTimer <= 0) resetRigPose(r.rig.refs);
      continue;
    }
    if (r.danceTimer && r.danceTimer > 0) {
      r.danceTimer -= dt;
      animateDance(r.rig.refs, time + (r.phaseOffset || 0));
      r.group.position.y = jumpY + Math.abs(Math.sin((time + (r.phaseOffset || 0)) * 8)) * 0.08;
      continue;
    }
    const lerp = Math.min(1, dt * 12);
    r.group.position.x += (r.targetX - r.group.position.x) * lerp;
    r.group.position.z += (r.targetZ - r.group.position.z) * lerp;
    r.group.rotation.y = lerpAngle(r.group.rotation.y, r.targetRy, lerp);
    if (r.activity === "sitting") {
      setSittingPose(r.rig.refs);
      r.group.position.y = 0;
      continue;
    }
    if (r.activity === "crouching") {
      setCrouchPose(r.rig.refs, time, 1);
      r.group.position.y = -0.22;
      continue;
    }
    if (r.activity === "riding") {
      r.ridePhase += Math.max(0.85, r.speed * 0.95) * dt;
      applyBikeRidePose(r.rig.refs, r.ridePhase, Math.min(r.speed / 10, 1), 0);
      r.group.position.y = 0.18 + Math.abs(Math.sin(r.ridePhase)) * 0.02 * Math.min(r.speed / 9, 1);
      continue;
    }
    const isRun = r.speed > 8;
    const speedRef = isRun ? 12.5 : 7.2;
    const intensity = Math.min(r.speed / speedRef, 1);
    if (intensity > 0.06) {
      r.walkPhase += dt * (isRun ? 9.5 : 5.5 + r.speed * 0.6);
      if (isRun) animateRun(r.rig.refs, r.walkPhase, intensity);
      else animateWalk(r.rig.refs, r.walkPhase, intensity);
      r.group.position.y = jumpY + Math.abs(Math.sin(r.walkPhase)) * 0.05 * intensity;
    } else {
      setRestPose(r.rig.refs, time);
      r.group.position.y = jumpY + Math.sin(time * 1.6) * 0.012;
    }
  }
}

function triggerNearbyDance() {
  const RADIUS = 6;
  for (const npc of npcs) {
    if (getDistance2D(player.position, npc.group.position) <= RADIUS) {
      npc.dancing = true;
      npc.danceTimer = 4.0;
      npc.pose = null;
      npc.focus = null;
    }
  }
  for (const r of remotePlayers.values()) {
    if (getDistance2D(player.position, r.group.position) <= RADIUS) {
      r.danceTimer = 4.0;
    }
  }
  triggerNearbyReaction(player.position, "cheer", { skipLocal: true });
}

function triggerNearbyCelebrate(origin, duration = 3.2, options = {}) {
  const RADIUS = 6.5;
  const skipLocal = options.skipLocal === true;
  const skipRemoteId = options.skipRemoteId || "";
  for (const npc of npcs) {
    if (getDistance2D(origin, npc.group.position) <= RADIUS) {
      npc.dancing = false;
      npc.danceTimer = 0;
      npc.celebrateTimer = duration;
      npc.pose = null;
      npc.focus = null;
    }
  }
  for (const r of remotePlayers.values()) {
    if (r.id === skipRemoteId) continue;
    if (getDistance2D(origin, r.group.position) <= RADIUS) {
      r.danceTimer = 0;
      r.celebrateTimer = duration;
      r.celebrateSeed = Math.random() * Math.PI * 2;
    }
  }
  triggerNearbyReaction(origin, "cheer", { skipLocal, skipRemoteId });
}

function triggerNearbyReaction(origin, kind = "like", options = {}) {
  const RADIUS = 6.25;
  const skipLocal = options.skipLocal === true;
  const skipRemoteId = options.skipRemoteId || "";

  for (const npc of npcs) {
    if (getDistance2D(origin, npc.group.position) <= RADIUS) {
      pushReactionBubble({ group: npc.group, key: npc.bubbleKey }, kind);
    }
  }

  for (const r of remotePlayers.values()) {
    if (r.id === skipRemoteId) continue;
    if (getDistance2D(origin, r.group.position) <= RADIUS) {
      pushReactionBubble(r.id, kind);
    }
  }

  if (!skipLocal && getDistance2D(origin, player.position) <= RADIUS) {
    pushReactionBubble("__local__", kind);
  }
}

function triggerLocalEmote(kind = "dance", duration = 8.0) {
  if (kind === "stop") {
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.glitchTimer = 0;
    playerState.celebrateTimer = 0;
    playerState.sixSevenTimer = 0;
    resetRigPose(playerRig.refs);
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("stop", 0);
    return;
  }

  if (kind === "glitch") {
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.celebrateTimer = 0;
    playerState.sixSevenTimer = 0;
    playerState.glitchTimer = duration || 2.2;
    playerState.glitchSeed = Math.random() * Math.PI * 2;
    resetRigPose(playerRig.refs);
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("glitch", duration || 2.2);
    return;
  }

  if (kind === "cheer") {
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.glitchTimer = 0;
    playerState.sixSevenTimer = 0;
    playerState.celebrateTimer = duration || 3.2;
    playerState.celebrateSeed = Math.random() * Math.PI * 2;
    resetRigPose(playerRig.refs);
    triggerNearbyCelebrate(player.position, playerState.celebrateTimer, { skipLocal: true });
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("cheer", playerState.celebrateTimer);
    return;
  }

  if (kind === "dance") {
    playerState.celebrateTimer = 0;
    playerState.glitchTimer = 0;
    playerState.sixSevenTimer = 0;
    if (playerState.dancing) {
      playerState.dancing = false;
      resetRigPose(playerRig.refs);
      pushEmoteBubble("__local__", kind);
      broadcastEmote?.("stop", 0);
      return;
    }
    playerState.dancing = true;
    playerState.danceTimer = duration;
    triggerNearbyDance();
    pushEmoteBubble("__local__", kind);
    broadcastEmote?.("dance", duration);
    return;
  }

  if (kind === "sixseven") {
    if (playerState.sixSevenTimer > 0) {
      playerState.sixSevenTimer = 0;
      resetRigPose(playerRig.refs);
      broadcastEmote?.("stop", 0);
      return;
    }
    playerState.dancing = false;
    playerState.danceTimer = 0;
    playerState.celebrateTimer = 0;
    playerState.glitchTimer = 0;
    playerState.sixSevenTimer = duration || 3.4;
    playerState.sixSevenSeed = Math.random() * Math.PI * 2;
    resetRigPose(playerRig.refs);
    broadcastEmote?.(kind, playerState.sixSevenTimer);
    return;
  }

  pushEmoteBubble("__local__", kind);
  if (kind === "laugh" || kind === "wave" || kind === "point") {
    triggerNearbyReaction(player.position, kind, { skipLocal: true });
  }
  broadcastEmote?.(kind, duration);
}

function triggerReaction(targetId, kind = "like") {
  if (!targetId) return;
  pushReactionBubble(targetId, kind);
}

function triggerRemoteEmote(playerId, kind, duration) {
  const r = remotePlayers.get(playerId);
  if (!r) return;
  if (kind === "dance") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = duration || 8.0;
    r.sixSevenTimer = 0;
    r.celebrateTimer = 0;
    r.phaseOffset = Math.random() * Math.PI * 2;
    triggerNearbyReaction(r.group.position, "cheer", { skipRemoteId: playerId });
    for (const npc of npcs) {
      if (getDistance2D(r.group.position, npc.group.position) <= 6) {
        npc.dancing = true;
        npc.danceTimer = duration || 8.0;
        npc.pose = null;
        npc.focus = null;
      }
    }
  } else if (kind === "cheer") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.sixSevenTimer = 0;
    r.glitchTimer = 0;
    r.celebrateSeed = Math.random() * Math.PI * 2;
    r.celebrateTimer = duration || 3.2;
    triggerNearbyCelebrate(r.group.position, r.celebrateTimer, { skipRemoteId: playerId });
  } else if (kind === "glitch") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.sixSevenTimer = 0;
    r.celebrateTimer = 0;
    r.glitchSeed = Math.random() * Math.PI * 2;
    r.glitchTimer = duration || 2.2;
  } else if (kind === "stop") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.sixSevenTimer = 0;
    r.glitchTimer = 0;
    r.celebrateTimer = 0;
    resetRigPose(r.rig.refs);
  } else if (kind === "sixseven") {
    pushEmoteBubble(playerId, kind);
    r.danceTimer = 0;
    r.glitchTimer = 0;
    r.celebrateTimer = 0;
    r.sixSevenTimer = duration || 3.4;
    r.sixSevenSeed = Math.random() * Math.PI * 2;
  } else {
    pushEmoteBubble(playerId, kind);
  }
}

function triggerRemoteReaction(playerId, kind = "like") {
  const r = remotePlayers.get(playerId);
  if (!r) return;
  pushReactionBubble(playerId, kind);
}

const spawnBeacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.28, 3.2, 12),
  new THREE.MeshStandardMaterial({ color: 0x31d17c, emissive: 0x1d8b52, emissiveIntensity: 0.35, roughness: 0.5 })
);
spawnBeacon.position.set(-40, 1.6, 38);
spawnBeacon.castShadow = true;
world.add(spawnBeacon);

const spawnGlow = new THREE.PointLight(0x62ff9f, 1.2, 10, 2);
spawnGlow.position.set(-40, 2.2, 38);
world.add(spawnGlow);

const playerState = {
  sitting: false,
  sitTimer: 0,
  sitTarget: null,
  sitLabel: "",
  sitEndMessage: "",
  sitEndSpeaker: "Banco",
  ridingBike: null,
  dancing: false,
  danceTimer: 0,
  sixSevenTimer: 0,
  sixSevenSeed: 0,
  celebrateTimer: 0,
  celebrateSeed: 0,
  glitchTimer: 0,
  glitchSeed: 0,
  jumping: false,
  jumpY: 0,
  jumpVel: 0
};
const playerActivitySnapshot = {
  kind: "idle",
  label: "parado",
  detail: "vagando pelo campus"
};
let lastPlayerActivityKey = "";

function emitPlayerActivity(nextActivity) {
  const key = `${nextActivity.kind}|${nextActivity.label}|${nextActivity.detail}`;
  if (key === lastPlayerActivityKey) return;
  lastPlayerActivityKey = key;
  playerActivitySnapshot.kind = nextActivity.kind;
  playerActivitySnapshot.label = nextActivity.label;
  playerActivitySnapshot.detail = nextActivity.detail;
  onPlayerStateChange({ ...playerActivitySnapshot });
}

function updatePlayerActivity(nextActivity) {
  emitPlayerActivity(nextActivity);
}

function createBench(x, z, rotation = 0) {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6440, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x5f6d71, roughness: 0.85 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.52), wood);
  seat.position.y = 0.62;
  seat.castShadow = true;
  bench.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 0.16), wood);
  back.position.set(0, 1.1, -0.18);
  back.rotation.x = -0.12;
  back.castShadow = true;
  bench.add(back);

  const supportLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), metal);
  supportLeft.position.set(-1.1, 0.36, 0.18);
  supportLeft.castShadow = true;
  bench.add(supportLeft);

  const supportRight = supportLeft.clone();
  supportRight.position.x = 1.1;
  bench.add(supportRight);

  bench.position.set(x, 0, z);
  bench.rotation.y = rotation;
  world.add(bench);

  const seatOffset = new THREE.Vector3(0, 0, 0.1).applyEuler(new THREE.Euler(0, rotation, 0));
  const sitSpot = new THREE.Vector3(x, 0, z).add(seatOffset);

  const interaction = {
    kind: "bench",
    label: "Banco",
    radius: 3.2,
    position: new THREE.Vector3(x, 0, z),
    root: bench,
    npcApproachPosition: sitSpot.clone(),
    npcDuration: 2.6,
    interact() {
      if (playerState.sitting) return;
      playerState.sitting = true;
      playerState.sitTimer = 2.6;
      playerState.sitTarget = {
        position: sitSpot.clone(),
        rotation: rotation + Math.PI
      };
      speak("Sentando para descansar um pouco.", "Banco");
    },
    npcInteract(npc) {
      npc.pose = {
        type: "sit",
        position: sitSpot.clone(),
        rotation: rotation + Math.PI
      };
    },
    update() {
      const pulse = 1 + Math.sin(clock.elapsedTime * 3.5) * 0.02;
      seat.scale.y = pulse;
    }
  };
  interactables.push(interaction);
}

function createFountain(x, z) {
  const fountain = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.4, 0.55, 18),
    new THREE.MeshStandardMaterial({ color: 0xb9c4c7, roughness: 0.9 })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  fountain.add(base);

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: 0x94a5ad, roughness: 0.7 })
  );
  basin.position.y = 0.55;
  basin.castShadow = true;
  fountain.add(basin);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.1, 18),
    new THREE.MeshStandardMaterial({
      color: 0x6dbad6,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.05
    })
  );
  water.position.y = 0.95;
  fountain.add(water);

  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.18, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x9be4ff, transparent: true, opacity: 0.65 })
  );
  jet.position.y = 1.4;
  fountain.add(jet);

  fountain.position.set(x, 0, z);
  world.add(fountain);

  let pulse = 0;
  function pulseWater() {
    pulse = 1;
  }
  interactables.push({
    kind: "fountain",
    label: "Fonte",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    root: fountain,
    npcApproachRadius: 2.2,
    npcDuration: 1.7,
    interact() {
      pulseWater();
      speak("A agua respinga e refresca o caminho.", "Fonte");
    },
    npcInteract() {
      pulseWater();
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 1.2);
      water.scale.y = 1 + pulse * 0.4;
      water.material.opacity = 0.78 + pulse * 0.2;
      jet.scale.y = 1 + pulse * 0.7;
      jet.material.opacity = 0.4 + pulse * 0.35;
      fountain.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.02;
    }
  });
}

function createNoticeBoard(x, z, rotation = 0) {
  const board = new THREE.Group();
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 2.3, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 })
  );
  stand.position.y = 1.15;
  stand.castShadow = true;
  board.add(stand);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.1, 0.15),
    new THREE.MeshStandardMaterial({
      map: noticeTexture.texture,
      color: 0xffffff,
      roughness: 0.9
    })
  );
  panel.position.set(0, 2.05, 0.15);
  panel.castShadow = true;
  board.add(panel);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(4.35, 2.25, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x4a3829, roughness: 1 })
  );
  frame.position.set(0, 2.05, 0.07);
  board.add(frame);

  board.position.set(x, 0, z);
  board.rotation.y = rotation;
  world.add(board);

  let pulse = 0;
  interactables.push({
    kind: "board",
    label: "Painel de avisos",
    radius: 3.1,
    position: new THREE.Vector3(x, 0, z),
    root: board,
    npcApproachRadius: 1.8,
    npcDuration: 2.1,
    interact() {
      pulse = 1;
      speak("Biblioteca ate 21h. Mutirao do gramado sexta.", "Painel de avisos");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 1.3);
      frame.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.01 + pulse * 0.035);
    }
  });
}

function createCampusBanner(x, z, rotation = 0) {
  const banner = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 });
  const clothMat = new THREE.MeshStandardMaterial({
    map: campusBannerTexture,
    roughness: 0.9,
    side: THREE.DoubleSide
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 10), poleMat);
  pole.position.y = 1.9;
  pole.castShadow = true;
  banner.add(pole);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c3, roughness: 0.6 })
  );
  cap.position.y = 3.85;
  cap.castShadow = true;
  banner.add(cap);

  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5, 10, 4), clothMat);
  cloth.geometry.translate(1.6, 0, 0);
  cloth.position.set(0.1, 2.35, 0.02);
  cloth.rotation.y = Math.PI / 2;
  cloth.castShadow = true;
  banner.add(cloth);

  const anchor = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x8f7d66, roughness: 0.9 })
  );
  anchor.position.set(0.12, 2.42, 0.0);
  anchor.castShadow = true;
  banner.add(anchor);

  banner.position.set(x, 0, z);
  banner.rotation.y = rotation;
  world.add(banner);

  const clothGeometry = cloth.geometry;
  const clothPositions = clothGeometry.attributes.position;
  const basePositions = new Float32Array(clothPositions.array);
  const phase = rand(0, Math.PI * 2);

  decorativeProps.push({
    update(dt, time) {
      const wind = Math.max(0.12, atmosphereSnapshot.wind * 0.9 + 0.08);
      const sway = 0.04 + wind * 0.16;
      for (let i = 0; i < clothPositions.count; i += 1) {
        const index = i * 3;
        const baseX = basePositions[index];
        const xRatio = baseX / 3.2;
        const wave = Math.sin(time * 4.2 + phase + xRatio * 8.5) * sway * xRatio;
        clothPositions.array[index + 2] = basePositions[index + 2] + wave;
        clothPositions.array[index + 1] =
          basePositions[index + 1] + Math.sin(time * 1.9 + phase + xRatio * 4.5) * wind * 0.018;
      }
      clothPositions.needsUpdate = true;
      cloth.rotation.z = Math.sin(time * 1.3 + phase) * wind * 0.03;
      pole.rotation.z = Math.sin(time * 0.8 + phase) * wind * 0.01;
    }
  });
}

function createBall(x, z) {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      roughness: 0.9,
      metalness: 0.05
    })
  );
  ball.castShadow = true;
  ball.position.set(x, 0.32, z);
  world.add(ball);

  const velocity = new THREE.Vector2(0, 0);
  let lift = 0;
  const position = new THREE.Vector3(x, 0, z);
  function kickBall(source) {
    const push = new THREE.Vector2(ball.position.x - source.x, ball.position.z - source.z);
    if (push.lengthSq() < 0.001) push.set(0, -1);
    push.normalize().multiplyScalar(5.2);
    velocity.add(push);
    lift = 0.24;
  }

  interactables.push({
    kind: "ball",
    label: "Bola",
    radius: 2.2,
    position,
    root: ball,
    npcApproachRadius: 0.95,
    npcDuration: 0.9,
    interact() {
      kickBall(player.position);
      speak("A bola sai rolando pelo gramado.", "Bola");
    },
    npcInteract(npc) {
      kickBall(npc.group.position);
    },
    update(dt) {
      ball.position.x += velocity.x * dt;
      ball.position.z += velocity.y * dt;
      velocity.multiplyScalar(Math.max(0, 1 - dt * 2.3));
      ball.position.x = THREE.MathUtils.clamp(ball.position.x, -66, 66);
      ball.position.z = THREE.MathUtils.clamp(ball.position.z, -66, 66);
      lift = Math.max(0, lift - dt * 0.6);
      ball.position.y = 0.32 + Math.sin(clock.elapsedTime * 9) * lift * 0.05;
      position.set(ball.position.x, 0, ball.position.z);
    }
  });
}

function createBike(x, z, rotation = 0) {
  const bike = new THREE.Group();
  const frameColor = new THREE.MeshStandardMaterial({ color: 0x214d7a, roughness: 0.8 });
  const wheelColor = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 1 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x5a3f26, roughness: 0.85 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcad4dc, roughness: 0.35, metalness: 0.6 });
  const wheelRadius = 0.42;
  const rearZ = -0.86;
  const frontZ = 0.86;
  const tubeUp = new THREE.Vector3(0, 1, 0);

  function addTubeBetween(from, to, radius, material) {
    const direction = to.clone().sub(from);
    const length = direction.length();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
    tube.position.copy(from).addScaledVector(direction, 0.5);
    tube.quaternion.setFromUnitVectors(tubeUp, direction.normalize());
    tube.castShadow = true;
    bike.add(tube);
    return tube;
  }

  const wheelA = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.065, 12, 20), wheelColor);
  wheelA.rotation.y = Math.PI / 2;
  wheelA.position.set(0, wheelRadius, frontZ);
  wheelA.castShadow = true;
  bike.add(wheelA);

  const wheelB = wheelA.clone();
  wheelB.position.z = rearZ;
  bike.add(wheelB);

  const rearHub = new THREE.Vector3(0, wheelRadius, rearZ);
  const frontHub = new THREE.Vector3(0, wheelRadius, frontZ);
  const crankPos = new THREE.Vector3(0, 0.52, -0.02);
  const seatCluster = new THREE.Vector3(0, 1.06, -0.24);
  const headCluster = new THREE.Vector3(0, 1.03, 0.58);
  const handleAnchor = new THREE.Vector3(0, 1.16, 0.8);

  addTubeBetween(seatCluster, headCluster, 0.045, frameColor);
  addTubeBetween(headCluster, crankPos, 0.045, frameColor);
  addTubeBetween(crankPos, seatCluster, 0.04, frameColor);
  addTubeBetween(rearHub, crankPos, 0.035, frameColor);
  addTubeBetween(rearHub, seatCluster, 0.032, frameColor);
  addTubeBetween(frontHub, headCluster, 0.035, chromeMat);
  addTubeBetween(headCluster, handleAnchor, 0.03, chromeMat);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), chromeMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.copy(handleAnchor);
  handle.castShadow = true;
  bike.add(handle);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.38), seatMat);
  seat.position.set(0, 1.18, -0.32);
  seat.castShadow = true;
  bike.add(seat);

  const crank = new THREE.Group();
  crank.position.copy(crankPos);
  bike.add(crank);

  const crankHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), chromeMat);
  crankHub.rotation.z = Math.PI / 2;
  crankHub.castShadow = true;
  crank.add(crankHub);

  const pedalArmLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), chromeMat);
  pedalArmLeft.position.set(-0.11, 0.17, 0);
  crank.add(pedalArmLeft);

  const pedalArmRight = pedalArmLeft.clone();
  pedalArmRight.position.set(0.11, -0.17, 0);
  crank.add(pedalArmRight);

  const pedalLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.08), frameColor);
  pedalLeft.position.set(-0.16, 0.35, 0);
  pedalLeft.castShadow = true;
  crank.add(pedalLeft);

  const pedalRight = pedalLeft.clone();
  pedalRight.position.set(0.16, -0.35, 0);
  crank.add(pedalRight);

  const mudguardA = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.05, 0.02, 8, 18, Math.PI), frameColor);
  mudguardA.rotation.y = Math.PI / 2;
  mudguardA.position.set(0, wheelRadius + 0.08, frontZ);
  mudguardA.castShadow = true;
  bike.add(mudguardA);

  const mudguardB = mudguardA.clone();
  mudguardB.position.z = rearZ;
  bike.add(mudguardB);

  bike.position.set(x, 0, z);
  bike.rotation.y = rotation;
  world.add(bike);

  const bikeState = {
    group: bike,
    position: bike.position,
    wheels: [wheelA, wheelB],
    handle,
    crank,
    seat,
    wheelRadius,
    mounted: false,
    syncId: `bike:${sharedBikeCount++}`,
    wheelSpin: 0,
    pedalPhase: 0,
    wheelieAmount: 0,
    wheelieTimer: 0,
    facingYaw: rotation,
    targetX: x,
    targetZ: z,
    targetRy: rotation,
    remoteMountedBy: null,
    remoteSpeed: 0,
    hasSharedState: false,
    emitState: null,
    mount: null,
    dismount: null,
  };
  sharedBikes.set(bikeState.syncId, bikeState);

  function emitBikeState(mounted = bikeState.mounted) {
    onLocalEntityState({
      id: bikeState.syncId,
      kind: "bike",
      x: bike.position.x,
      z: bike.position.z,
      ry: bike.rotation.y,
      speed: mounted ? playerVelocity.length() : 0,
      mounted,
    });
  }
  bikeState.emitState = emitBikeState;

  function findDismountSpot() {
    const candidateOffsets = [
      new THREE.Vector3(0.95, 0, 0.75),
      new THREE.Vector3(-0.95, 0, 0.75),
      new THREE.Vector3(0, 0, 1.25),
      new THREE.Vector3(0, 0, -1.25),
    ];
    for (const offset of candidateOffsets) {
      const worldOffset = offset.clone().applyEuler(new THREE.Euler(0, bike.rotation.y, 0));
      const candidate = new THREE.Vector3(
        player.position.x + worldOffset.x,
        0,
        player.position.z + worldOffset.z
      );
      if (!isBlockedAt(candidate.x, candidate.z, 0.62)) {
        return candidate;
      }
    }
    return null;
  }

  function mountBike() {
    if (playerState.sitting) return;
    if (bikeState.remoteMountedBy) {
      speak("Essa bicicleta ja esta sendo usada por outro player.", "Bicicleta");
      return;
    }
    if (playerState.ridingBike === bikeState) return;
    player.position.set(bike.position.x, 0, bike.position.z);
    if (playerVelocity.lengthSq() < 0.01) {
      player.rotation.y = bike.rotation.y;
    }
    playerState.ridingBike = bikeState;
    bikeState.mounted = true;
    playerState.jumping = false;
    playerState.jumpY = 0;
    playerState.jumpVel = 0;
    playerVelocity.multiplyScalar(0.2);
    emitBikeState(true);
    speak("Voce subiu na bicicleta. Pedale com WASD e use E longe de objetos para descer.", "Bicicleta");
  }

  function dismountBike() {
    if (playerState.ridingBike !== bikeState) return false;
    const spot = findDismountSpot();
    if (!spot) {
      speak("Nao ha espaco para descer da bicicleta aqui.", "Bicicleta");
      return false;
    }
    player.position.set(spot.x, 0, spot.z);
    bike.position.set(spot.x - 0.38, 0, spot.z - 0.12);
    bike.rotation.y = player.rotation.y - 0.42;
    bike.rotation.x = 0;
    bikeState.facingYaw = bike.rotation.y;
    bikeState.wheelieAmount = 0;
    bikeState.wheelieTimer = 0;
    bikeState.mounted = false;
    playerState.ridingBike = null;
    player.rotation.x = 0;
    playerVelocity.set(0, 0);
    emitBikeState(false);
    speak("Voce desceu da bicicleta.", "Bicicleta");
    return true;
  }

  bikeState.mount = mountBike;
  bikeState.dismount = dismountBike;

  let spinImpulse = 0;
  interactables.push({
    kind: "bike",
    label: "Bicicleta",
    radius: 2.4,
    position: bike.position,
    root: bike,
    npcApproachRadius: 1.25,
    npcDuration: 1.3,
    isDisabledForPlayer: () => playerState.ridingBike === bikeState || !!bikeState.remoteMountedBy,
    npcDisabled: () => bikeState.mounted || !!bikeState.remoteMountedBy,
    interact() {
      if (playerState.ridingBike === bikeState) {
        dismountBike();
        return;
      }
      mountBike();
    },
    npcInteract() {
      if (bikeState.mounted) return;
      spinImpulse += Math.PI / 10;
    },
    update(dt) {
      if (bikeState.mounted) {
        const wheelieAngle = bikeState.wheelieAmount * 0.52;
        const wheelieLift = Math.sin(wheelieAngle) * 0.86;
        bike.position.set(player.position.x, wheelieLift, player.position.z);
        bike.rotation.x = -wheelieAngle;
        bike.rotation.y = player.rotation.y;
        bikeState.facingYaw = bike.rotation.y;
        wheelA.rotation.x = bikeState.wheelSpin;
        wheelB.rotation.x = bikeState.wheelSpin;
        crank.rotation.x = bikeState.pedalPhase;
        handle.rotation.y = THREE.MathUtils.clamp(playerVelocity.length() * 0.015, -0.08, 0.08);
        spinImpulse = 0;
        return;
      }
      if (bikeState.remoteMountedBy) {
        const lerp = Math.min(1, dt * 12);
        bike.position.x += (bikeState.targetX - bike.position.x) * lerp;
        bike.position.z += (bikeState.targetZ - bike.position.z) * lerp;
        bike.rotation.y = lerpAngle(bike.rotation.y, bikeState.targetRy, lerp);
        bikeState.facingYaw = bike.rotation.y;
        bikeState.wheelSpin += bikeState.remoteSpeed * dt / Math.max(0.2, bikeState.wheelRadius);
        bikeState.pedalPhase += bikeState.remoteSpeed * dt * 0.95;
        wheelA.rotation.x = bikeState.wheelSpin;
        wheelB.rotation.x = bikeState.wheelSpin;
        crank.rotation.x = bikeState.pedalPhase;
        handle.rotation.y = THREE.MathUtils.clamp(bikeState.remoteSpeed * 0.01, -0.08, 0.08);
        bike.rotation.x = THREE.MathUtils.lerp(bike.rotation.x, 0, Math.min(1, dt * 8));
        bike.position.y = 0;
        spinImpulse = 0;
        return;
      }
      if (bikeState.hasSharedState) {
        const lerp = Math.min(1, dt * 8);
        bike.position.x += (bikeState.targetX - bike.position.x) * lerp;
        bike.position.z += (bikeState.targetZ - bike.position.z) * lerp;
        bike.rotation.y = lerpAngle(bike.rotation.y, bikeState.targetRy, lerp);
      }
      spinImpulse *= Math.max(0, 1 - dt * 3.4);
      bike.rotation.x = THREE.MathUtils.lerp(bike.rotation.x, 0, Math.min(1, dt * 8));
      bike.rotation.y += spinImpulse * dt * 6;
      bike.position.y = Math.sin(clock.elapsedTime * 2) * 0.02;
      wheelA.rotation.x += spinImpulse * dt * 12;
      wheelB.rotation.x += spinImpulse * dt * 12;
      crank.rotation.x += spinImpulse * dt * 7;
    }
  });
}

function createCampusBus(routePoints) {
  const bus = new THREE.Group();
  const wheelRadius = 0.34;
  const busSpeed = 6.2;
  const TAU = Math.PI * 2;
  const upperBodyMat = new THREE.MeshStandardMaterial({ color: 0xf7f4ea, roughness: 0.78 });
  const lowerBodyMat = new THREE.MeshStandardMaterial({ color: 0x23824c, roughness: 0.84 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x155b36, roughness: 0.74 });
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x333b37, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2a6, emissive: 0xffdf78, emissiveIntensity: 0.22, roughness: 0.42 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xc73535, emissive: 0x8b1515, emissiveIntensity: 0.18, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8dc4e6,
    transparent: true,
    opacity: 0.72,
    roughness: 0.2,
    metalness: 0.08
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 1 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xe3e0d2, roughness: 0.68 });

  const bodyShell = new THREE.Group();
  bus.add(bodyShell);

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.95, 1.98), lowerBodyMat);
  lowerBody.position.y = 0.98;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  bodyShell.add(lowerBody);

  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.95, 1.9), upperBodyMat);
  upperBody.position.y = 1.93;
  upperBody.castShadow = true;
  upperBody.receiveShadow = true;
  bodyShell.add(upperBody);

  const beltLine = new THREE.Mesh(new THREE.BoxGeometry(5.44, 0.08, 2.04), trimMat);
  beltLine.position.y = 1.45;
  beltLine.castShadow = true;
  bodyShell.add(beltLine);

  const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(5.12, 0.14, 1.92), trimMat);
  lowerTrim.position.y = 0.66;
  lowerTrim.castShadow = true;
  bodyShell.add(lowerTrim);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.98, 0.22, 1.86), upperBodyMat);
  roof.position.y = 2.5;
  roof.castShadow = true;
  bodyShell.add(roof);

  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.78, 1.56), glassMat);
  windowBand.position.set(0.14, 1.72, 0);
  bodyShell.add(windowBand);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.92, 1.5), glassMat);
  windshield.position.set(2.58, 1.68, 0);
  bodyShell.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.92, 1.5), glassMat);
  rearWindow.position.set(-2.56, 1.68, 0);
  bodyShell.add(rearWindow);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ map: busSignTexture, roughness: 0.8 })
  );
  sign.position.set(1.12, 2.13, 1.03);
  sign.castShadow = true;
  bodyShell.add(sign);

  const frontSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.42, 1.12),
    new THREE.MeshStandardMaterial({ map: busSignTexture, roughness: 0.8 })
  );
  frontSign.position.set(2.72, 2.05, 0);
  frontSign.castShadow = true;
  bodyShell.add(frontSign);

  const sideAccent = new THREE.Mesh(new THREE.BoxGeometry(5.18, 0.1, 0.12), trimMat);
  sideAccent.position.set(0, 2.02, 1.03);
  bodyShell.add(sideAccent);

  const doorSeamA = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.55, 0.05), trimMat);
  doorSeamA.position.set(1.52, 1.2, 1.06);
  bodyShell.add(doorSeamA);

  const doorSeamB = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.55, 0.05), trimMat);
  doorSeamB.position.set(0.9, 1.2, 1.06);
  bodyShell.add(doorSeamB);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 1.72), bumperMat);
  frontBumper.position.set(2.76, 0.55, 0);
  frontBumper.castShadow = true;
  bodyShell.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 1.72), bumperMat);
  rearBumper.position.set(-2.76, 0.55, 0);
  rearBumper.castShadow = true;
  bodyShell.add(rearBumper);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.62), bumperMat);
  grille.position.set(2.79, 0.88, 0);
  bodyShell.add(grille);

  for (const z of [-0.58, 0.58]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.26), lightMat);
    headlight.position.set(2.81, 0.95, z);
    bodyShell.add(headlight);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.22), tailLightMat);
    tailLight.position.set(-2.81, 0.92, z);
    bodyShell.add(tailLight);
  }

  const wheelPositions = [
    [-1.65, 0.42, 0.92],
    [1.65, 0.42, 0.92],
    [-1.65, 0.42, -0.92],
    [1.65, 0.42, -0.92]
  ];
  const wheels = [];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Group();
    wheel.position.set(x, y, z);

    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 10, 18), wheelMat);
    tire.castShadow = true;
    wheel.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    wheel.add(hub);

    wheel.castShadow = true;
    bus.add(wheel);
    wheels.push(wheel);
  }

  const route = routePoints.map((point) => ({
    position: new THREE.Vector3(point.x, 0, point.z),
    dwell: point.dwell ?? 1.0
  }));
  const routeSegments = route.map((point, index) => {
    const next = route[(index + 1) % route.length];
    const dx = next.position.x - point.position.x;
    const dz = next.position.z - point.position.z;
    const length = Math.max(0.0001, Math.hypot(dx, dz));
    return {
      index,
      start: point.position,
      end: next.position,
      dx,
      dz,
      length,
      yaw: Math.atan2(dx, dz),
      travelDuration: length / busSpeed,
    };
  });
  const cycleDuration = routeSegments.reduce(
    (total, segment) => total + route[segment.index].dwell + segment.travelDuration,
    0
  );
  const seatAnchor = new THREE.Vector3();
  const initialPathYaw = routeSegments[0]?.yaw ?? Math.PI / 2;
  bus.rotation.y = routeYawToBusYaw(initialPathYaw);
  const state = {
    group: bus,
    route,
    routeSegments,
    routeIndex: 0,
    segmentProgress: 0,
    dwellTimer: route[0]?.dwell ?? 1.2,
    speed: busSpeed,
    currentSpeed: 0,
    wheelSpin: 0,
    seatAnchor,
    facingYaw: bus.rotation.y,
    position: bus.position,
    rideBeacon: 0,
    crowdCount: 0,
    crowdLabel: "livre",
    crowdComplaintCooldown: 0,
    activeStopIndex: -1,
    routeReady: false,
  };

  function clamp01(value) {
    return THREE.MathUtils.clamp(value, 0, 1);
  }

  function easeVehicleProgress(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function routeYawToBusYaw(routeYaw) {
    return routeYaw - Math.PI / 2;
  }

  function updateSeatAnchor() {
    seatAnchor.set(0.18, 1.18, 0.04).applyEuler(new THREE.Euler(0, bus.rotation.y, 0)).add(bus.position);
  }

  function sampleRouteAtTime(time) {
    if (!cycleDuration) {
      return {
        position: route[0]?.position || new THREE.Vector3(),
        pathYaw: Math.PI / 2,
        visualYaw: routeYawToBusYaw(Math.PI / 2),
        routeIndex: 0,
        dwellTimer: 0,
        segmentProgress: 0,
        currentSpeed: 0,
        wheelSpin: 0,
      };
    }

    const normalized = ((time % cycleDuration) + cycleDuration) % cycleDuration;
    let cursor = 0;
    let traveledDistance = 0;

    for (const segment of routeSegments) {
      const dwellDuration = route[segment.index].dwell;
      if (normalized < cursor + dwellDuration) {
        const previousSegment = routeSegments[(segment.index - 1 + routeSegments.length) % routeSegments.length];
        const dwellProgress = dwellDuration <= 0.0001
          ? 1
          : (dwellDuration - (cursor + dwellDuration - normalized)) / dwellDuration;
        const pathYaw = lerpAngle(previousSegment?.yaw ?? segment.yaw, segment.yaw, easeVehicleProgress(dwellProgress));
        return {
          position: segment.start,
          pathYaw,
          visualYaw: routeYawToBusYaw(pathYaw),
          routeIndex: segment.index,
          dwellTimer: cursor + dwellDuration - normalized,
          segmentProgress: 0,
          currentSpeed: 0,
          wheelSpin: (traveledDistance / wheelRadius) % TAU,
        };
      }
      cursor += dwellDuration;

      const travelEnd = cursor + segment.travelDuration;
      if (normalized < travelEnd) {
        const rawProgress = segment.travelDuration <= 0.0001 ? 1 : (normalized - cursor) / segment.travelDuration;
        const progress = easeVehicleProgress(rawProgress);
        const segmentProgress = segment.length * progress;
        const speedFactor = 6 * rawProgress * (1 - rawProgress);
        return {
          position: new THREE.Vector3(
            segment.start.x + segment.dx * progress,
            0,
            segment.start.z + segment.dz * progress
          ),
          pathYaw: segment.yaw,
          visualYaw: routeYawToBusYaw(segment.yaw),
          routeIndex: segment.index,
          dwellTimer: 0,
          segmentProgress,
          currentSpeed: busSpeed * speedFactor,
          wheelSpin: ((traveledDistance + segmentProgress) / wheelRadius) % TAU,
        };
      }
      cursor = travelEnd;
      traveledDistance += segment.length;
    }

    const fallback = routeSegments[0];
    return {
      position: fallback?.start || new THREE.Vector3(),
      pathYaw: fallback?.yaw ?? Math.PI / 2,
      visualYaw: routeYawToBusYaw(fallback?.yaw ?? Math.PI / 2),
      routeIndex: 0,
      dwellTimer: route[0]?.dwell ?? 0,
      segmentProgress: 0,
      currentSpeed: 0,
      wheelSpin: 0,
    };
  }

  function moveAlongRoute(dt, time) {
    const sample = sampleRouteAtTime(time);
    const yawDelta = ((((sample.visualYaw - bus.rotation.y) % TAU) + Math.PI * 3) % TAU) - Math.PI;
    const turnLerp = Math.min(1, dt * (sample.currentSpeed > 0.2 ? 5.4 : 3.2));
    const acceleration = dt > 0 ? (sample.currentSpeed - state.currentSpeed) / dt : 0;
    const movingFactor = THREE.MathUtils.clamp(sample.currentSpeed / busSpeed, 0, 1.4);

    state.routeIndex = sample.routeIndex;
    state.segmentProgress = sample.segmentProgress;
    state.dwellTimer = sample.dwellTimer;
    state.wheelSpin = sample.wheelSpin;
    state.currentSpeed = sample.currentSpeed;

    bus.position.copy(sample.position);
    bus.rotation.y = lerpAngle(bus.rotation.y, sample.visualYaw, turnLerp);
    bus.rotation.z = THREE.MathUtils.lerp(
      bus.rotation.z,
      THREE.MathUtils.clamp(-yawDelta * movingFactor * 0.18, -0.075, 0.075),
      Math.min(1, dt * 5.5)
    );
    bus.rotation.x = THREE.MathUtils.lerp(
      bus.rotation.x,
      THREE.MathUtils.clamp(-acceleration * 0.012, -0.05, 0.05),
      Math.min(1, dt * 4.6)
    );
    state.facingYaw = bus.rotation.y;
    bus.position.y =
      movingFactor * (Math.sin(time * 7.4) * 0.018 + Math.sin(time * 13.1) * 0.006) +
      (state.dwellTimer > 0 ? Math.sin(time * 2.1) * 0.006 : 0);

    for (const wheel of wheels) {
      wheel.rotation.z = -state.wheelSpin;
    }
    if (state.dwellTimer > 0) {
      state.rideBeacon = Math.max(state.rideBeacon, 0.2);
    }
    const stopIndex = state.dwellTimer > 0 ? state.routeIndex : -1;
    if (!state.routeReady) {
      state.activeStopIndex = stopIndex;
      state.routeReady = true;
    } else if (stopIndex !== state.activeStopIndex) {
      if (stopIndex >= 0) {
        playBusArrivalSound(0.8 + state.crowdCount * 0.1);
      }
      state.activeStopIndex = stopIndex;
    }
    updateSeatAnchor();
  }

  function updateCrowdState(dt) {
    state.crowdCount = countNearbyHumans(bus.position, 5.6);
    state.crowdLabel = state.crowdCount >= 3
      ? "lotado"
      : state.crowdCount >= 2
        ? "quase lotado"
        : "livre";
    state.crowdComplaintCooldown = Math.max(0, state.crowdComplaintCooldown - dt);
  }

  world.add(bus);
  buses.push(state);

  const busInteractable = {
    kind: "bus",
    label: "Jardineira",
    radius: 4.6,
    position: bus.position,
    root: bus,
    npcApproachRadius: 1.2,
    npcDuration: 5.8,
    interact() {
      if (playerState.sitting) return;
      state.rideBeacon = 1.2;
      if (state.crowdCount >= 3) {
        if (state.crowdComplaintCooldown <= 0) {
          speak("Chegou tarde. Essa jardineira ja lotou. Espera a proxima.", "Motorista");
          state.crowdComplaintCooldown = 5.5;
        }
        return;
      }
      if (state.crowdCount >= 2) {
        speak("Vai apertado, mas ainda cabe mais um.", "Motorista");
      }
      enterSitState(
        {
          position: seatAnchor,
          rotation: bus.rotation.y + Math.PI
        },
        {
          duration: 5.8,
          label: "jardineira",
          endMessage: "Voce desceu da jardineira na parada seguinte.",
          endSpeaker: "Jardineira"
        }
      );
      speak("Voce embarcou na jardineira do campus.", "Jardineira");
    },
    update(dt, time) {
      moveAlongRoute(dt, time);
      updateCrowdState(dt);
      busInteractable.crowdLabel = state.crowdLabel;
      busInteractable.crowdCount = state.crowdCount;
      state.rideBeacon = Math.max(0, state.rideBeacon - dt * 0.75);
      const suspensionPulse = (state.currentSpeed / busSpeed) * Math.sin(time * 8.2) * 0.006;
      bodyShell.scale.y = 1 + suspensionPulse + state.rideBeacon * 0.01 + state.crowdCount * 0.004;
      roof.position.y = 2.5 + Math.sin(time * 3.5) * 0.01 * (state.currentSpeed / busSpeed);
      sign.scale.setScalar(1 + state.rideBeacon * 0.05 + state.crowdCount * 0.02);
    }
  };
  busInteractable.crowdLabel = state.crowdLabel;
  busInteractable.crowdCount = state.crowdCount;
  interactables.push(busInteractable);
}

function createLamp(x, z) {
  const lamp = new THREE.Group();
  const lampState = {
    head: null,
    point: null,
    cone: null,
    pool: null,
    power: 0,
    phase: rand(0, Math.PI * 2)
  };
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 4.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.9 })
  );
  pole.position.y = 2.1;
  pole.castShadow = true;
  lamp.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.9 })
  );
  arm.position.set(0.46, 4.02, 0);
  arm.castShadow = true;
  lamp.add(arm);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf2f4d8, emissive: 0xf7f1b0, emissiveIntensity: 0.55 })
  );
  head.position.set(1.0, 4.0, 0);
  head.castShadow = true;
  lamp.add(head);
  lampState.head = head;

  const point = new THREE.PointLight(0xffe8a3, 0, 12, 2);
  point.position.set(1.0, 4.0, 0);
  lamp.add(point);
  lampState.point = point;

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.05, 4.8, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe6a3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );
  cone.position.set(1.0, 1.82, 0);
  cone.renderOrder = 2;
  cone.visible = false;
  lamp.add(cone);
  lampState.cone = cone;

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(4.25, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffdf8a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(1.0, 0.025, 0);
  pool.renderOrder = 1;
  pool.visible = false;
  lamp.add(pool);
  lampState.pool = pool;

  lamp.position.set(x, 0, z);
  lamp.visible = false;
  world.add(lamp);
  streetLamps.push(lampState);

  interactables.push({
    kind: "lamp",
    label: "Poste",
    radius: 0,
    position: new THREE.Vector3(x, 0, z),
    root: lamp,
    npcApproachRadius: 1.1,
    npcDuration: 1.1,
    interact() {
      speak("Os postes acendem automaticamente quando anoitece.", "Poste");
    },
    update() {
      const pulse = 0.04 + Math.sin(clock.elapsedTime * 5 + lampState.phase) * 0.02;
      head.material.emissiveIntensity = 0.08 + lampState.power * 1.9 + pulse * Math.max(0.1, lampState.point.intensity);
    }
  });
}

function createSnackCart(x, z, rotation = 0) {
  const cart = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x7a4c27, roughness: 0.95 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.9 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 });

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.4), clothMat);
  roof.position.y = 2.1;
  roof.castShadow = true;
  cart.add(roof);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.05), frameMat);
  body.position.y = 1.05;
  body.castShadow = true;
  cart.add(body);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.28), clothMat);
  awning.position.set(0, 1.58, 0.58);
  awning.castShadow = true;
  cart.add(awning);

  for (const sx of [-0.72, 0.72]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 14), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(sx, 0.22, 0);
    wheel.castShadow = true;
    cart.add(wheel);
  }

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.4, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  );
  sign.position.set(0, 1.8, 0.78);
  sign.castShadow = true;
  cart.add(sign);

  cart.position.set(x, 0, z);
  cart.rotation.y = rotation;
  world.add(cart);

  let pulse = 0;
  interactables.push({
    kind: "snack",
    label: "Carrinho",
    radius: 2.8,
    position: new THREE.Vector3(x, 0, z),
    root: cart,
    npcApproachRadius: 1.35,
    npcDuration: 1.8,
    interact() {
      pulse = 1;
      speak("O carrinho tem um cheirinho bom de lanche.", "Carrinho");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.4);
      cart.position.y = Math.sin(time * 2.2) * 0.02;
      sign.scale.setScalar(1 + pulse * 0.08);
    }
  });
}

function createReadingTable(x, z, rotation = 0) {
  const table = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8e6a45, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x62727d, roughness: 0.9 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 1.25), wood);
  top.position.y = 0.92;
  top.castShadow = true;
  table.add(top);

  const legPositions = [
    [-1.02, 0.45, -0.48],
    [1.02, 0.45, -0.48],
    [-1.02, 0.45, 0.48],
    [1.02, 0.45, 0.48]
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), metal);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    table.add(leg);
  }

  const books = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.12, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x4b7bd1, roughness: 0.85 })
  );
  books.position.set(-0.15, 1.08, 0);
  books.castShadow = true;
  table.add(books);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95 })
  );
  lamp.position.set(0.58, 1.34, -0.22);
  lamp.castShadow = true;
  table.add(lamp);

  table.position.set(x, 0, z);
  table.rotation.y = rotation;
  world.add(table);

  let pulse = 0;
  interactables.push({
    kind: "table",
    label: "Mesa",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    root: table,
    npcApproachRadius: 1.6,
    npcDuration: 2.4,
    interact() {
      pulse = 1;
      speak("Mesa boa para revisar anotações e combinar planos.", "Mesa");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.2);
      table.position.y = Math.sin(time * 1.9) * 0.015;
      books.rotation.z = Math.sin(time * 2.7) * 0.04 + pulse * 0.08;
    }
  });
}

function createInfoKiosk(x, z, rotation = 0) {
  const kiosk = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x6c7f56, roughness: 0.96 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.5, 0.28), baseMat);
  stand.position.y = 1.25;
  stand.castShadow = true;
  kiosk.add(stand);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.6, 0.16), boardMat);
  sign.position.set(0, 2.15, 0.14);
  sign.castShadow = true;
  kiosk.add(sign);

  const footer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 0.32), baseMat);
  footer.position.set(0, 0.38, 0.1);
  footer.castShadow = true;
  kiosk.add(footer);

  kiosk.position.set(x, 0, z);
  kiosk.rotation.y = rotation;
  world.add(kiosk);

  let pulse = 0;
  interactables.push({
    kind: "kiosk",
    label: "Quiosque",
    radius: 3,
    position: new THREE.Vector3(x, 0, z),
    root: kiosk,
    npcApproachRadius: 1.7,
    npcDuration: 1.9,
    interact() {
      pulse = 1;
      speak("O quiosque mostra o caminho mais movimentado do campus.", "Quiosque");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.5);
      sign.scale.setScalar(1 + pulse * 0.06);
      kiosk.rotation.y = rotation + Math.sin(time * 0.35) * 0.02;
    }
  });
}

function createBikeRack(x, z, rotation = 0) {
  const rack = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f6d71, roughness: 0.9 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 1 });

  for (let i = -1; i <= 1; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 2.4), mat);
    bar.position.set(i * 0.55, 0.5, 0);
    bar.castShadow = true;
    rack.add(bar);
  }

  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 16), tireMat);
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(0, 0.42, 0.95);
  wheel.castShadow = true;
  rack.add(wheel);

  rack.position.set(x, 0, z);
  rack.rotation.y = rotation;
  world.add(rack);

  let pulse = 0;
  interactables.push({
    kind: "bike",
    label: "Bicicletário",
    radius: 2.7,
    position: new THREE.Vector3(x, 0, z),
    root: rack,
    npcApproachRadius: 1.35,
    npcDuration: 1.4,
    interact() {
      pulse = 1;
      speak("O bicicletário está pronto para a próxima corrida.", "Bicicletário");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.6);
      rack.position.y = Math.sin(time * 2.4) * 0.012;
      wheel.rotation.x = time * 0.6 + pulse * 0.3;
    }
  });
}

function createMusicTotem(x, z, rotation = 0) {
  const booth = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4d35, roughness: 0.95 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x2e4e3c, roughness: 0.7 });
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf6b94b,
    emissive: 0xb86f16,
    emissiveIntensity: 0.35,
    roughness: 0.55
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xa8ffda,
    emissive: 0x62ff9f,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.85
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.42, 12), woodMat);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  booth.add(base);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.1), shellMat);
  body.position.y = 1.48;
  body.castShadow = true;
  booth.add(body);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.56, 0.08), accentMat);
  panel.position.set(0, 2.05, 0.6);
  panel.castShadow = true;
  booth.add(panel);

  const screenGlow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.04), glowMat);
  screenGlow.position.set(0, 2.06, 0.66);
  booth.add(screenGlow);

  for (const side of [-1, 1]) {
    const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24), speakerMat);
    speaker.rotation.x = Math.PI / 2;
    speaker.position.set(side * 0.4, 1.45, 0.6);
    speaker.castShadow = true;
    booth.add(speaker);

    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16), accentMat);
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(side * 0.4, 1.82, 0.6);
    booth.add(tweeter);
  }

  const beacon = new THREE.PointLight(0x62ff9f, 0.6, 7, 2);
  beacon.position.set(0, 2.35, 0.85);
  booth.add(beacon);

  booth.position.set(x, 0, z);
  booth.rotation.y = rotation;
  world.add(booth);

  let pulse = 0;
  interactables.push({
    kind: "music",
    label: "Radio do campus",
    radius: 3.2,
    position: new THREE.Vector3(x, 0, z),
    root: booth,
    npcApproachRadius: 1.35,
    npcDuration: 1.5,
    interact() {
      pulse = 1;
      onMediaBoothInteract();
      speak("Cole um link do YouTube ou Spotify para tocar na radio.", "Radio do campus");
    },
    npcInteract() {
      pulse = Math.max(pulse, 0.35);
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.4);
      const shimmer = Math.sin(time * 4.2) * 0.08;
      booth.position.y = Math.sin(time * 2.2) * 0.016;
      panel.scale.setScalar(1 + pulse * 0.05 + shimmer * 0.15);
      screenGlow.material.opacity = 0.56 + pulse * 0.2 + Math.max(0, shimmer) * 0.18;
      accentMat.emissiveIntensity = 0.3 + pulse * 0.35;
      glowMat.emissiveIntensity = 0.5 + pulse * 0.45;
      beacon.intensity = 0.55 + pulse * 0.7 + Math.max(0, shimmer) * 0.12;
    }
  });
}

function createWaterStation(x, z, rotation = 0) {
  const station = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7b9cb2, roughness: 0.8 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x9be4ff, transparent: true, opacity: 0.75 });

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.8, 12), mat);
  column.position.y = 0.9;
  column.castShadow = true;
  station.add(column);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.24, 0.7), mat);
  top.position.y = 1.9;
  top.castShadow = true;
  station.add(top);

  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 10), glowMat);
  stream.position.set(0, 1.35, 0.34);
  station.add(stream);

  station.position.set(x, 0, z);
  station.rotation.y = rotation;
  world.add(station);

  let pulse = 0;
  interactables.push({
    kind: "fountain",
    label: "Bebedouro",
    radius: 2.5,
    position: new THREE.Vector3(x, 0, z),
    root: station,
    npcApproachRadius: 1.15,
    npcDuration: 1.2,
    interact() {
      pulse = 1;
      speak("Um gole de água gelada ajuda a voltar pro ritmo.", "Bebedouro");
    },
    npcInteract() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.8);
      station.position.y = Math.sin(time * 2.8) * 0.012;
      stream.material.opacity = 0.55 + pulse * 0.25;
    }
  });
}

createBench(-15, 8, Math.PI / 2);
createBench(11, 12, -Math.PI / 3);
createFountain(6, -2);
createNoticeBoard(-31, 9, Math.PI / 2);
createCampusBanner(-38, 16, Math.PI / 2);
createBall(-4, 16);
createBike(24, 4, -Math.PI / 2);
createCampusBus([
  { x: -54, z: 38, dwell: 1.7 },
  { x: -8, z: 44, dwell: 0.8 },
  { x: 42, z: 42, dwell: 1.0 },
  { x: 58, z: 10, dwell: 0.9 },
  { x: 58, z: -42, dwell: 1.4 },
  { x: -52, z: -42, dwell: 1.2 },
  { x: -60, z: -6, dwell: 0.8 }
]);
createSnackCart(20, -20, Math.PI / 2);
createReadingTable(-10, 28, -Math.PI / 4);
createInfoKiosk(2, -34, 0);
createBikeRack(-24, -26, Math.PI / 2);
createMusicTotem(-18, -4, Math.PI / 2);
createWaterStation(30, 24, -Math.PI / 2);
createBench(34, 18, -Math.PI / 2);
createBench(-32, 20, Math.PI / 2);
createNoticeBoard(28, -10, 0);
createBall(16, 28);
createBall(-18, 30);

function createDuck(x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = Math.random() * Math.PI * 2;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4dd55, roughness: 0.85 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe6c443, roughness: 0.88 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf48b25, roughness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), bodyMat);
  body.scale.set(1, 0.88, 1.35);
  body.position.y = 0.42;
  body.castShadow = true;
  root.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 8), bodyMat);
  tail.position.set(0, 0.46, -0.4);
  tail.rotation.x = -Math.PI / 2.4;
  tail.castShadow = true;
  root.add(tail);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.2, 10), bodyMat);
  neck.position.set(0, 0.6, 0.22);
  neck.rotation.x = 0.45;
  neck.castShadow = true;
  root.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.74, 0.32);
  root.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), bodyMat);
  skull.castShadow = true;
  head.add(skull);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 10), beakMat);
  beak.position.set(0, -0.02, 0.2);
  beak.rotation.x = Math.PI / 2;
  beak.castShadow = true;
  head.add(beak);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
  leftEye.position.set(-0.08, 0.05, 0.13);
  head.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.08;
  head.add(rightEye);

  const wingGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.scale.set(0.35, 0.55, 1);
  leftWing.position.set(-0.27, 0.44, 0);
  leftWing.castShadow = true;
  root.add(leftWing);
  const rightWing = leftWing.clone();
  rightWing.position.x = 0.27;
  root.add(rightWing);

  const footGeo = new THREE.BoxGeometry(0.1, 0.04, 0.16);
  const leftFoot = new THREE.Mesh(footGeo, beakMat);
  leftFoot.position.set(-0.1, 0.04, 0.1);
  leftFoot.castShadow = true;
  root.add(leftFoot);
  const rightFoot = leftFoot.clone();
  rightFoot.position.x = 0.1;
  root.add(rightFoot);

  world.add(root);

  return { group: root, head, leftWing, rightWing, leftFoot, rightFoot };
}

const DUCK_LINE =
  "Os outros pretendentes ao trono eram SkekUng o lider militar do imperio que ansiava pelo trono, e isso no livro fica bem claro, e SkekZok o lider espiritual.";

const ducks = [];
const pigeons = [];

function createDuckEntity(x, z) {
  const visuals = createDuck(x, z);
  const state = {
    name: "Pato",
    kind: "duck",
    group: visuals.group,
    visuals,
    radius: 2.4,
    home: new THREE.Vector3(x, 0, z),
    target: new THREE.Vector3(x, 0, z),
    waitTimer: 0.5 + Math.random() * 1.5,
    hopPhase: Math.random() * Math.PI * 2,
    hopSpeed: 5.2 + Math.random() * 1.4,
    speed: 1.3,
    lines: [DUCK_LINE],
    lastLineIndex: -1,
    previewLine: DUCK_LINE,
    nearby: false,
    pause: 0,
    talkCooldown: 0,
    mapColor: "#f4dd55"
  };
  ducks.push(state);
  return state;
}

function updateDuck(duck, dt, time) {
  duck.talkCooldown = Math.max(0, duck.talkCooldown - dt);

  if (duck.pause > 0) {
    duck.pause -= dt;
    duck.group.position.y = THREE.MathUtils.lerp(duck.group.position.y, 0, 0.2);
    duck.visuals.leftWing.rotation.z = 0.25;
    duck.visuals.rightWing.rotation.z = -0.25;
    duck.visuals.head.rotation.y = Math.sin(time * 4) * 0.25;
    return;
  }

  const dx = duck.target.x - duck.group.position.x;
  const dz = duck.target.z - duck.group.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.25) {
    duck.waitTimer -= dt;
    if (duck.waitTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.6 + Math.random() * 3.4;
      duck.target.set(
        duck.home.x + Math.cos(angle) * r,
        0,
        duck.home.z + Math.sin(angle) * r
      );
      duck.waitTimer = 0.4 + Math.random() * 1.4;
    }
    duck.group.position.y = THREE.MathUtils.lerp(duck.group.position.y, 0, 0.25);
    duck.visuals.leftWing.rotation.z = 0.22;
    duck.visuals.rightWing.rotation.z = -0.22;
    duck.visuals.head.rotation.x = Math.sin(time * 2 + duck.hopPhase) * 0.1;
    return;
  }

  duck.hopPhase += dt * duck.hopSpeed;
  const hop = Math.max(0, Math.sin(duck.hopPhase));
  duck.group.position.y = hop * 0.48;

  const moveScale = 0.25 + hop * 1.4;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  duck.group.position.x += dirX * duck.speed * dt * moveScale;
  duck.group.position.z += dirZ * duck.speed * dt * moveScale;
  duck.group.rotation.y = lerpAngle(duck.group.rotation.y, Math.atan2(dirX, dirZ), 0.25);

  duck.visuals.leftWing.rotation.z = 0.2 + hop * 0.8;
  duck.visuals.rightWing.rotation.z = -0.2 - hop * 0.8;
  duck.visuals.head.rotation.x = -hop * 0.2;
  duck.group.rotation.x = hop * 0.12;
}

function createPigeon(x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = Math.random() * Math.PI * 2;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9099a6, roughness: 0.94 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x6d7480, roughness: 0.92 });
  const neckMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c2, roughness: 0.9 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xd99332, roughness: 0.72 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
  body.scale.set(1.22, 0.92, 1.5);
  body.position.y = 0.24;
  body.castShadow = true;
  root.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), neckMat);
  chest.scale.set(0.95, 0.78, 1.18);
  chest.position.set(0, 0.33, 0.18);
  chest.castShadow = true;
  root.add(chest);

  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.28);
  root.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), neckMat);
  skull.castShadow = true;
  head.add(skull);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), beakMat);
  beak.position.set(0, -0.01, 0.09);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
  eye.position.set(0.04, 0.02, 0.07);
  head.add(eye);
  const eye2 = eye.clone();
  eye2.position.x = -0.04;
  head.add(eye2);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.68), wingMat);
  leftWing.position.set(-0.2, 0.29, 0.02);
  leftWing.rotation.z = 0.28;
  leftWing.castShadow = true;
  root.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.68), wingMat);
  rightWing.position.set(0.2, 0.29, 0.02);
  rightWing.rotation.z = -0.28;
  rightWing.castShadow = true;
  root.add(rightWing);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), wingMat);
  tail.position.set(0, 0.23, -0.28);
  tail.rotation.x = -Math.PI / 2.2;
  tail.castShadow = true;
  root.add(tail);

  const footGeo = new THREE.BoxGeometry(0.03, 0.04, 0.12);
  const leftFoot = new THREE.Mesh(footGeo, beakMat);
  leftFoot.position.set(-0.05, 0.03, 0.05);
  leftFoot.castShadow = true;
  root.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, beakMat);
  rightFoot.position.set(0.05, 0.03, 0.05);
  rightFoot.castShadow = true;
  root.add(rightFoot);

  world.add(root);
  return { group: root, head, leftWing, rightWing };
}

function choosePigeonTarget(pigeon, spread = 3.4) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(1.4, spread);
    const candidate = new THREE.Vector3(
      pigeon.home.x + Math.cos(angle) * distance,
      0,
      pigeon.home.z + Math.sin(angle) * distance
    );
    clampPointToWorld(candidate, 0.45);
    if (!isBlockedAt(candidate.x, candidate.z, 0.35)) {
      return candidate;
    }
  }

  return pigeon.home.clone();
}

function createPigeonEntity(x, z) {
  const visuals = createPigeon(x, z);
  const state = {
    name: "Pombo",
    kind: "pigeon",
    group: visuals.group,
    visuals,
    radius: 1.55,
    home: new THREE.Vector3(x, 0, z),
    target: new THREE.Vector3(x, 0, z),
    wanderTimer: 0.35 + Math.random() * 1.1,
    fleeTimer: 0,
    flapPhase: Math.random() * Math.PI * 2,
    speed: 0.92 + Math.random() * 0.34,
    mapColor: "#c4cad3",
    nearby: false
  };
  pigeons.push(state);
  return state;
}

function updatePigeon(pigeon, dt, time) {
  const playerDistance = getDistance2D(player.position, pigeon.group.position);
  const startled =
    playerDistance < 2.5 ||
    (playerVelocity.length() > 2.2 && playerDistance < 7);

  if (startled && pigeon.fleeTimer <= 0) {
    const awayX = pigeon.group.position.x - player.position.x;
    const awayZ = pigeon.group.position.z - player.position.z;
    const len = Math.hypot(awayX, awayZ) || 1;
    const fleeDistance = 4.5 + rand(0, 4.5);
    const candidate = new THREE.Vector3(
      pigeon.group.position.x + (awayX / len) * fleeDistance,
      0,
      pigeon.group.position.z + (awayZ / len) * fleeDistance
    );
    clampPointToWorld(candidate, 0.45);
    if (isBlockedAt(candidate.x, candidate.z, 0.35)) {
      candidate.copy(choosePigeonTarget(pigeon, 4.2));
    }
    pigeon.target.copy(candidate);
    pigeon.fleeTimer = 0.8 + rand(0, 0.8);
    pigeon.wanderTimer = 0.45 + rand(0, 0.9);
  }

  pigeon.flapPhase += dt * (pigeon.fleeTimer > 0 ? 14 : 4.6);

  if (pigeon.fleeTimer > 0) {
    pigeon.fleeTimer = Math.max(0, pigeon.fleeTimer - dt);
    const dx = pigeon.target.x - pigeon.group.position.x;
    const dz = pigeon.target.z - pigeon.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      pigeon.fleeTimer = 0;
      pigeon.wanderTimer = 0.35 + rand(0, 0.9);
      pigeon.target.copy(choosePigeonTarget(pigeon, 3.6));
    } else {
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const move = pigeon.speed * dt * 2.5;
      pigeon.group.position.x += dirX * move;
      pigeon.group.position.z += dirZ * move;
      pigeon.group.rotation.y = lerpAngle(pigeon.group.rotation.y, Math.atan2(dirX, dirZ), 0.32);
      pigeon.group.position.y = 0.26 + Math.sin(pigeon.flapPhase * 1.2) * 0.18;
      const flap = 0.55 + Math.max(0, Math.sin(pigeon.flapPhase)) * 0.9;
      pigeon.visuals.leftWing.rotation.z = 0.32 + flap;
      pigeon.visuals.rightWing.rotation.z = -0.32 - flap;
      pigeon.visuals.head.rotation.x = -0.12 + Math.sin(pigeon.flapPhase * 0.8) * 0.08;
      pigeon.group.rotation.x = Math.sin(pigeon.flapPhase * 0.8) * 0.18;
      return;
    }
  }

  const dx = pigeon.target.x - pigeon.group.position.x;
  const dz = pigeon.target.z - pigeon.group.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.18) {
    pigeon.wanderTimer -= dt;
    pigeon.group.position.y = THREE.MathUtils.lerp(pigeon.group.position.y, 0, 0.18);
    pigeon.visuals.leftWing.rotation.z = 0.18;
    pigeon.visuals.rightWing.rotation.z = -0.18;
    pigeon.visuals.head.rotation.x = Math.sin(time * 4 + pigeon.flapPhase) * 0.06;
    if (pigeon.wanderTimer <= 0) {
      pigeon.target.copy(choosePigeonTarget(pigeon));
      pigeon.wanderTimer = 0.5 + Math.random() * 1.1;
    }
    return;
  }

  const dirX = dx / dist;
  const dirZ = dz / dist;
  const bob = Math.max(0, Math.sin(pigeon.flapPhase));
  const move = pigeon.speed * dt * (0.48 + bob * 0.08);
  pigeon.group.position.x += dirX * move;
  pigeon.group.position.z += dirZ * move;
  pigeon.group.rotation.y = lerpAngle(pigeon.group.rotation.y, Math.atan2(dirX, dirZ), 0.2);
  pigeon.group.position.y = bob * 0.035;
  pigeon.visuals.leftWing.rotation.z = 0.14 + bob * 0.12;
  pigeon.visuals.rightWing.rotation.z = -0.14 - bob * 0.12;
  pigeon.visuals.head.rotation.x = Math.sin(time * 3.8 + pigeon.flapPhase) * 0.05;
  pigeon.group.rotation.x = bob * 0.06;
}

function pickRandomLine(npc) {
  if (!npc.lines || npc.lines.length === 0) return "...";
  if (npc.lines.length === 1) {
    npc.lastLineIndex = 0;
    return npc.lines[0];
  }
  let idx;
  do {
    idx = Math.floor(Math.random() * npc.lines.length);
  } while (idx === npc.lastLineIndex);
  npc.lastLineIndex = idx;
  return npc.lines[idx];
}

function getNpcReactionLine(npc, human, distance) {
  const nick = human?.nick || "você";
  const mood = npc.personality || "curious";
  if (mood === "shy") {
    return distance < 5
      ? `Oi, ${nick}... eu já passo depois.`
      : `Vou só observar de longe, ${nick}.`;
  }
  if (mood === "athletic") {
    return human?.speed > 5
      ? `Boa passada, ${nick}. Vamos manter o ritmo.`
      : `Se quiser acelerar, eu acompanho.`;
  }
  if (mood === "busy") {
    return `Anotado, ${nick}. Já volto pra falar.`;
  }
  if (mood === "friendly") {
    return distance < 6
      ? `Ei, ${nick}! Chegou bem na hora.`
      : `Opa, ${nick}. Passa aqui depois.`;
  }
  if (mood === "gossipy") {
    return distance < 6
      ? `Ei, ${nick}... tem coisa acontecendo ali na praça.`
      : `Se vir alguém correndo, me conta depois, ${nick}.`;
  }
  return distance < 6
    ? `Ei, ${nick}, achei você no mapa.`
    : `Percebi movimento por aqui, ${nick}.`;
}

function getNpcChatterDelay(npc) {
  const mood = npc.personality || "curious";
  if (mood === "friendly") return rand(8, 14);
  if (mood === "curious") return rand(10, 16);
  if (mood === "busy") return rand(14, 22);
  if (mood === "athletic") return rand(16, 24);
  if (mood === "shy") return rand(18, 28);
  if (mood === "gossipy") return rand(6, 12);
  return rand(12, 20);
}

function findNearestHuman(position, maxDistance = 18) {
  let best = null;
  let bestDistance = maxDistance;

  const localDistance = getDistance2D(position, player.position);
  if (localDistance <= bestDistance) {
    best = {
      id: "__local__",
      nick: localNickname,
      position: player.position,
      speed: playerVelocity.length(),
      distance: localDistance,
      isLocal: true
    };
    bestDistance = localDistance;
  }

  for (const r of remotePlayers.values()) {
    const distance = getDistance2D(position, r.group.position);
    if (distance > bestDistance) continue;
    best = {
      id: r.id,
      nick: r.nick,
      position: r.group.position,
      speed: r.speed || 0,
      distance,
      isLocal: false
    };
    bestDistance = distance;
  }

  return best;
}

function countNearbyHumans(position, maxDistance = 18) {
  let count = 0;

  if (getDistance2D(position, player.position) <= maxDistance) {
    count += 1;
  }

  for (const r of remotePlayers.values()) {
    if (getDistance2D(position, r.group.position) <= maxDistance) {
      count += 1;
    }
  }

  return count;
}

function setNpcReactionTarget(npc, human) {
  const dx = npc.group.position.x - human.position.x;
  const dz = npc.group.position.z - human.position.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;
  const style = npc.personality || "curious";

  if (style === "shy") {
    npc.moveTarget.set(
      npc.group.position.x + nx * (5.5 + rand(0, 2.2)),
      0,
      npc.group.position.z + nz * (5.5 + rand(0, 2.2))
    );
    return;
  }

  if (style === "athletic") {
    const side = rand(-1, 1) >= 0 ? 1 : -1;
    npc.moveTarget.set(
      human.position.x + nx * 1.6 + side * nz * 1.8,
      0,
      human.position.z + nz * 1.6 - side * nx * 1.8
    );
    return;
  }

  if (style === "busy") {
    npc.moveTarget.set(
      npc.home.x + rand(-2.5, 2.5),
      0,
      npc.home.z + rand(-2.5, 2.5)
    );
    return;
  }

  npc.moveTarget.set(
    human.position.x + nx * (1.8 + rand(0, 1.2)),
    0,
    human.position.z + nz * (1.8 + rand(0, 1.2))
  );
}

function createNpc(config) {
  const rig = createCharacter(config.colors);
  const npc = rig.group;
  world.add(npc);
  npc.position.set(config.start.x, 0, config.start.z);
  const home = new THREE.Vector3(config.start.x, 0, config.start.z);
  const anchors = config.path.map(({ x, z }) => new THREE.Vector3(x, 0, z));
  const id = `npc:${npcs.length}`;

  const state = {
    id,
    name: config.name,
    rig,
    group: npc,
    path: config.path,
    anchors,
    home,
    speed: config.speed,
    lines: config.lines,
    lastLineIndex: -1,
    previewLine: config.lines[0],
    nearby: false,
    pause: 0,
    talkCooldown: 0,
    radius: 3.2,
    phaseOffset: rand(0, Math.PI * 2),
    celebrateTimer: 0,
    mapColor: `#${config.colors.shirtColor.toString(16).padStart(6, "0")}`,
    interests: { ...(config.interests || {}) },
    state: "idle",
    stateTimer: 0.4 + rand(0, 1.4),
    moveTarget: home.clone(),
    focus: null,
    pose: null,
    lastInteraction: null,
    personality: config.personality || "curious",
    bubbleKey: `npc:${config.name}`,
    awarenessRadius: config.awarenessRadius || 18,
    reactionRadius: config.reactionRadius || 7,
    reactionCooldown: rand(0.8, 2.6),
    reactionTimer: 0,
    reactionHuman: null,
    chatterCooldown: getNpcChatterDelay(config),
    thinkRadius: config.thinkRadius || 44,
    renderRadius: config.renderRadius || 38,
    slowThinkTimer: rand(0, 0.6),
    targetX: npc.position.x,
    targetY: npc.position.y,
    targetZ: npc.position.z,
    targetRy: npc.rotation.y,
    netAnim: "idle",
    hasNetState: false,
  };
  state.previewLine = pickRandomLine(state);

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: config.colors.shirtColor, emissive: config.colors.shirtColor, emissiveIntensity: 0.15 })
  );
  marker.position.y = 2.85;
  npc.add(marker);
  state.marker = marker;
  npcById.set(id, state);
  npcs.push(state);
  return state;
}

const npcs = [];
const npcById = new Map();
let npcAuthorityActive = false;
createNpc({
  name: "Ana",
  start: { x: -2, z: 18 },
  speed: 2.1,
  personality: "friendly",
  path: [
    { x: -2, z: 18 },
    { x: 8, z: 18 },
    { x: 11, z: 9 },
    { x: 1, z: 7 }
  ],
  lines: [
    "Hoje o gramado esta bem movimentado.",
    "Se precisar, o painel ali mostra os avisos do campus.",
    "Esse banco perto da fonte e um bom ponto para descansar.",
    "Eu tava te procurando, viu? Achei que ia perder a aula.",
    "Reparou no pato la perto da fonte? Acho que ele me julga."
  ],
  interests: {
    bench: 1.3,
    fountain: 1.15,
    board: 1.2
  },
  colors: {
    shirtColor: 0x4363d8,
    pantsColor: 0x23344b,
    shoesColor: 0x202020,
    skinColor: 0xe8b992,
    hairColor: 0x1c1410,
    backpackColor: 0x7e4ab8,
    backpack: true,
    scale: 0.98
  }
});

createNpc({
  name: "Rafael",
  start: { x: 22, z: -6 },
  speed: 1.8,
  personality: "busy",
  path: [
    { x: 22, z: -6 },
    { x: 26, z: 6 },
    { x: 18, z: 17 },
    { x: 11, z: 4 }
  ],
  lines: [
    "Estou fazendo uma ronda pelo campus.",
    "A bicicleta ficou bem ali ao lado da pista.",
    "O fluxo entre os blocos fica melhor quando a rota esta livre.",
    "Se ver alguem perdido, manda pra coordenacao no bloco central.",
    "Faz tempo que nao vejo o pessoal usar a bola, da uma chutada la."
  ],
  interests: {
    bike: 1.35,
    lamp: 1.05,
    board: 1.1
  },
  colors: {
    shirtColor: 0xb85a31,
    pantsColor: 0x3a3d46,
    shoesColor: 0x202020,
    skinColor: 0xc98c62,
    hairColor: 0x2b1a0d,
    backpackColor: 0x566d54,
    backpack: false,
    scale: 1
  }
});

createNpc({
  name: "Prof. Lucia",
  start: { x: -20, z: 21 },
  speed: 1.35,
  personality: "curious",
  path: [
    { x: -20, z: 21 },
    { x: -10, z: 26 },
    { x: -5, z: 17 },
    { x: -13, z: 12 }
  ],
  lines: [
    "Passe no mural para ver os avisos mais recentes.",
    "A fonte e a area de convivio costumam ficar cheias no fim da tarde.",
    "Esse mapa ajuda a ler o espaco com mais rapidez.",
    "Hoje a turma esta agitada, deve ser o calor.",
    "Lembre de devolver o livro antes de sexta, ta?"
  ],
  interests: {
    board: 1.45,
    fountain: 1.15,
    bench: 1.05
  },
  colors: {
    shirtColor: 0x6a4c93,
    pantsColor: 0x34495e,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf1c7aa,
    hairColor: 0x5c3a22,
    backpackColor: 0x9b5e4d,
    backpack: true,
    glasses: true,
    scale: 1
  }
});

createNpc({
  name: "Bruno",
  start: { x: 30, z: 12 },
  speed: 2.55,
  personality: "athletic",
  path: [
    { x: 30, z: 12 },
    { x: 22, z: 22 },
    { x: 6, z: 30 },
    { x: 18, z: 4 }
  ],
  lines: [
    "Hoje o treino e na quadra dos fundos, depois da fonte.",
    "Quem chega cedo pega aquela sombra boa la perto do banco.",
    "Eu uso a bicicleta pra cortar caminho ate o bloco central.",
    "Topa correr um pouco comigo? So mais uma volta.",
    "O Seu Diego ja avisou pra nao pisar no gramado novo."
  ],
  interests: {
    ball: 1.45,
    bike: 1.25,
    fountain: 0.95
  },
  colors: {
    shirtColor: 0xe74c3c,
    pantsColor: 0x2c3e50,
    shoesColor: 0xf5f5f5,
    skinColor: 0xd4a07a,
    hairColor: 0x111111,
    backpackColor: 0x111111,
    backpack: false,
    scale: 1.05
  }
});

createNpc({
  name: "Camila",
  start: { x: -34, z: 12 },
  speed: 1.45,
  personality: "curious",
  path: [
    { x: -34, z: 12 },
    { x: -22, z: 6 },
    { x: -12, z: 14 },
    { x: -30, z: 22 }
  ],
  lines: [
    "A biblioteca esta com novos titulos de engenharia esta semana.",
    "Se quiser sala silenciosa, suba pro segundo andar do bloco.",
    "Os avisos do mural costumam vir direto da coordenacao.",
    "Eu gosto de ler perto da fonte no fim da tarde.",
    "Voce ja conheceu o pato? Ele tem opinioes fortes sobre fantasia."
  ],
  interests: {
    board: 1.4,
    fountain: 1.2,
    bench: 1.1
  },
  colors: {
    shirtColor: 0x16a085,
    pantsColor: 0x4a3328,
    shoesColor: 0x202020,
    skinColor: 0xefcaa6,
    hairColor: 0x261612,
    backpackColor: 0x342f1a,
    backpack: true,
    glasses: true,
    scale: 0.96
  }
});

createNpc({
  name: "Seu Diego",
  start: { x: 6, z: 36 },
  speed: 1.2,
  personality: "busy",
  path: [
    { x: 6, z: 36 },
    { x: -8, z: 34 },
    { x: -2, z: 22 },
    { x: 12, z: 28 }
  ],
  lines: [
    "Acabei de aparar essa parte do gramado, da pra sentar a vontade.",
    "Quando chove forte, o caminho do meio fica meio escorregadio.",
    "A bola sempre acaba parando perto da fonte, ja reparou?",
    "Cuidem das arvores novas que plantamos ali na bordinha.",
    "Os patos aparecem cedo, gostam do orvalho no gramado."
  ],
  interests: {
    bench: 1.25,
    fountain: 1.3,
    ball: 1.15
  },
  colors: {
    shirtColor: 0xf1c40f,
    pantsColor: 0x6b4226,
    shoesColor: 0x3d2c1c,
    skinColor: 0xb98552,
    hairColor: 0x4a3a2a,
    backpackColor: 0x6c4a2e,
    backpack: false,
    glasses: true,
    scale: 1.04
  }
});

createNpc({
  name: "Helena",
  start: { x: 14, z: -18 },
  speed: 1.55,
  personality: "friendly",
  path: [
    { x: 14, z: -18 },
    { x: 4, z: -2 },
    { x: -6, z: 4 },
    { x: 0, z: -16 }
  ],
  lines: [
    "Estou rascunhando o bloco central pra aula de artes visuais.",
    "A iluminacao no fim da tarde fica perfeita aqui na fonte.",
    "Voce ja viu o mural novo do corredor B? Vale o desvio.",
    "Topa posar pra um esboco rapido? E so um minuto.",
    "O Seu Diego me deixou desenhar os patos hoje cedo."
  ],
  interests: {
    fountain: 1.35,
    board: 1.2,
    bike: 0.95
  },
  colors: {
    shirtColor: 0xff7ab6,
    pantsColor: 0x35506b,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf4d2b8,
    hairColor: 0x7a3b1c,
    backpackColor: 0x2a3142,
    backpack: true,
    scale: 0.97
  }
});

const lucas = createNpc({
  name: "Lucas",
  start: { x: 12, z: 6 },
  speed: 5.5,
  personality: "athletic",
  path: [
    { x: 14, z: 8 },
    { x: -10, z: -4 },
    { x: -20, z: 22 },
    { x: 22, z: 18 },
    { x: 2, z: -22 }
  ],
  lines: ["Preciso terminar meu TCC!"],
  interests: {
    board: 0.4
  },
  colors: {
    shirtColor: 0x2b6cb0,
    pantsColor: 0x2a3540,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf4d2b8,
    hairColor: 0xc0461a,
    backpackColor: 0x6b3a1a,
    backpack: false,
    scale: 1
  }
});
lucas.running = true;
lucas.holdingBucket = true;
{
  const bucketGroup = new THREE.Group();
  bucketGroup.position.set(0, 1.25, 0.55);
  lucas.group.add(bucketGroup);
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.7, metalness: 0.3 });
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.24, 0.5, 16, 1, true),
    bucketMat
  );
  bucket.castShadow = true;
  bucketGroup.add(bucket);
  const bucketBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16),
    bucketMat
  );
  bucketBottom.position.y = -0.25;
  bucketGroup.add(bucketBottom);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x5fb5e6, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.9 })
  );
  water.position.y = 0.2;
  bucketGroup.add(water);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.022, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.5 })
  );
  handle.position.y = 0.26;
  handle.rotation.x = Math.PI / 2;
  bucketGroup.add(handle);
lucas.bucketGroup = bucketGroup;
}

createNpc({
  name: "Sofia",
  start: { x: -8, z: -22 },
  speed: 1.25,
  personality: "shy",
  awarenessRadius: 20,
  reactionRadius: 6,
  path: [
    { x: -8, z: -22 },
    { x: -2, z: -12 },
    { x: -12, z: -6 },
    { x: -18, z: -18 }
  ],
  lines: [
    "Eu prefiro ficar perto da mesa, mas posso me aproximar.",
    "Se o player chega correndo, eu dou espaço.",
    "O gramado está melhor quando a movimentação é leve.",
    "Tem um quiosque novo ali; vou observar de longe."
  ],
  interests: {
    table: 1.6,
    kiosk: 1.15,
    bench: 1.1
  },
  colors: {
    shirtColor: 0x7bdff2,
    pantsColor: 0x3f4c63,
    shoesColor: 0x202020,
    skinColor: 0xf0c7a7,
    hairColor: 0x3a2516,
    backpackColor: 0x5f7c8a,
    backpack: true,
    scale: 0.96
  }
});

createNpc({
  name: "Marcos",
  start: { x: 34, z: -18 },
  speed: 2.05,
  personality: "friendly",
  awarenessRadius: 22,
  reactionRadius: 8,
  path: [
    { x: 34, z: -18 },
    { x: 24, z: -4 },
    { x: 18, z: -20 },
    { x: 30, z: 8 }
  ],
  lines: [
    "Se você vier falar comigo, eu já viro na sua direção.",
    "Esse mapa é ótimo pra achar o ponto de encontro.",
    "Eu sempre paro no carrinho antes de seguir o caminho.",
    "O player correu? Então eu corro pra acompanhar."
  ],
  interests: {
    snack: 1.4,
    kiosk: 1.15,
    board: 1.05
  },
  colors: {
    shirtColor: 0x2bb673,
    pantsColor: 0x34495e,
    shoesColor: 0x1e1e1e,
    skinColor: 0xd8a272,
    hairColor: 0x111111,
    backpackColor: 0x7c4a1e,
    backpack: false,
    scale: 1
  }
});

createNpc({
  name: "Yara",
  start: { x: 18, z: 30 },
  speed: 1.7,
  personality: "busy",
  awarenessRadius: 16,
  reactionRadius: 6,
  path: [
    { x: 18, z: 30 },
    { x: 4, z: 34 },
    { x: 2, z: 20 },
    { x: 14, z: 18 }
  ],
  lines: [
    "Estou indo e voltando entre a mesa e o painel.",
    "Se eu passar perto de você, é porque estou no meu trajeto.",
    "Os novos objetos deixaram o espaço mais vivo.",
    "O player chamou atenção? Eu olho, mas continuo andando."
  ],
  interests: {
    table: 1.35,
    board: 1.25,
    fountain: 1.05
  },
  colors: {
    shirtColor: 0xff8c42,
    pantsColor: 0x2b3947,
    shoesColor: 0x111111,
    skinColor: 0xf0c1a0,
    hairColor: 0x6d3c17,
    backpackColor: 0x515151,
    backpack: true,
    scale: 0.98
  }
});

createNpc({
  name: "Tiago",
  start: { x: -28, z: -24 },
  speed: 2.3,
  personality: "athletic",
  awarenessRadius: 24,
  reactionRadius: 9,
  path: [
    { x: -28, z: -24 },
    { x: -18, z: -10 },
    { x: -4, z: -18 },
    { x: -14, z: -30 }
  ],
  lines: [
    "Se o player acelerar, eu já entro na disputa.",
    "Bora cruzar o gramado até o bicicletário.",
    "Eu reajo rápido quando alguém passa perto.",
    "A corrida só começa depois do aviso do painel."
  ],
  interests: {
    bike: 1.45,
    lamp: 1.1,
    ball: 1.35
  },
  colors: {
    shirtColor: 0xe84855,
    pantsColor: 0x263238,
    shoesColor: 0xf1f1f1,
    skinColor: 0xc99264,
    hairColor: 0x111111,
    backpackColor: 0x2f2f2f,
    backpack: false,
    scale: 1.03
  }
});

createNpc({
  name: "Nina",
  start: { x: 0, z: -10 },
  speed: 1.95,
  personality: "gossipy",
  awarenessRadius: 21,
  reactionRadius: 7,
  path: [
    { x: 0, z: -10 },
    { x: 10, z: -8 },
    { x: 14, z: 2 },
    { x: 2, z: 2 }
  ],
  lines: [
    "Eu sigo quem estiver mais ativo no gramado.",
    "Se o player passa por aqui, eu mudo a rota.",
    "Tem muito objeto novo pra explorar.",
    "A mesa e o quiosque viraram meus pontos favoritos."
  ],
  interests: {
    kiosk: 1.3,
    snack: 1.2,
    table: 1.15,
    fountain: 1.1
  },
  colors: {
    shirtColor: 0x7c5cff,
    pantsColor: 0x304050,
    shoesColor: 0x1a1a1a,
    skinColor: 0xf1c6aa,
    hairColor: 0x261612,
    backpackColor: 0x8aa1a8,
    backpack: true,
    scale: 0.97
  }
});

createNpc({
  name: "Joana",
  start: { x: -38, z: 2 },
  speed: 1.55,
  personality: "friendly",
  awarenessRadius: 23,
  reactionRadius: 8,
  path: [
    { x: -38, z: 2 },
    { x: -28, z: 10 },
    { x: -20, z: 0 },
    { x: -30, z: -10 }
  ],
  lines: [
    "Eu gosto quando o player passa perto e aciona uma conversa.",
    "O painel de avisos ficou mais fácil de ler agora.",
    "Tem muita coisa nova no campus hoje.",
    "Se quiser companhia, eu acompanho até a mesa."
  ],
  interests: {
    board: 1.5,
    bench: 1.2,
    table: 1.25
  },
  colors: {
    shirtColor: 0x27ae60,
    pantsColor: 0x3e4a59,
    shoesColor: 0x1b1b1b,
    skinColor: 0xf0c9a6,
    hairColor: 0x4a2f17,
    backpackColor: 0x6c7f56,
    backpack: true,
    glasses: true,
    scale: 0.99
  }
});

function getNpcNetAnim(npc) {
  if (npc.pose?.type === "sit") return "sit";
  if (npc.dancing && npc.danceTimer > 0) return "dance";
  if (npc.celebrateTimer && npc.celebrateTimer > 0) return "celebrate";
  if (npc.state === "wander" || npc.state === "approach" || npc.state === "react") {
    return npc.running ? "run" : "walk";
  }
  return "idle";
}

function serializeNpcStates() {
  return npcs.map((npc) => ({
    id: npc.id,
    x: npc.group.position.x,
    y: npc.group.position.y,
    z: npc.group.position.z,
    ry: npc.group.rotation.y,
    speed: npc.speed,
    anim: getNpcNetAnim(npc),
  }));
}

function setNpcAuthority(active) {
  npcAuthorityActive = active === true;
}

function applyNpcSnapshots(snapshots = []) {
  if (npcAuthorityActive) return;
  for (const snapshot of snapshots) {
    const npc = npcById.get(snapshot?.id);
    if (!npc) continue;
    if (typeof snapshot.x === "number") npc.targetX = snapshot.x;
    if (typeof snapshot.y === "number") npc.targetY = snapshot.y;
    if (typeof snapshot.z === "number") npc.targetZ = snapshot.z;
    if (typeof snapshot.ry === "number") npc.targetRy = snapshot.ry;
    npc.netAnim = typeof snapshot.anim === "string" ? snapshot.anim : "idle";
    npc.speed = typeof snapshot.speed === "number" ? snapshot.speed : npc.speed;
    npc.hasNetState = true;
  }
}

function updateNpcFromSnapshot(npc, dt, time) {
  if (!npc.hasNetState) {
    applyNpcPose(npc, time);
    return;
  }

  const lerp = Math.min(1, dt * 12);
  npc.group.position.x += (npc.targetX - npc.group.position.x) * lerp;
  npc.group.position.y += (npc.targetY - npc.group.position.y) * lerp;
  npc.group.position.z += (npc.targetZ - npc.group.position.z) * lerp;
  npc.group.rotation.y = lerpAngle(npc.group.rotation.y, npc.targetRy, lerp);

  if (npc.netAnim === "sit") {
    setSittingPose(npc.rig.refs);
    return;
  }
  if (npc.netAnim === "dance") {
    animateDance(npc.rig.refs, time + npc.phaseOffset);
    return;
  }
  if (npc.netAnim === "celebrate") {
    animateCelebrate(npc.rig.refs, time + npc.phaseOffset, 1);
    return;
  }
  if (npc.netAnim === "run") {
    const runPhase = time * (8 + npc.speed * 0.5) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 4.0, 1);
    animateRun(npc.rig.refs, runPhase, intensity);
    if (npc.holdingBucket) {
      const r = npc.rig.refs;
      r.leftShoulder.rotation.x = -1.35;
      r.rightShoulder.rotation.x = -1.35;
      r.leftShoulder.rotation.z = 0.35;
      r.rightShoulder.rotation.z = -0.35;
      r.leftElbow.rotation.x = 0.6;
      r.rightElbow.rotation.x = 0.6;
      r.torso.rotation.x = 0.22;
    }
    return;
  }
  if (npc.netAnim === "walk") {
    const walkPhase = time * (4 + npc.speed * 0.9) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 1.4, 1);
    animateWalk(npc.rig.refs, walkPhase, intensity);
    return;
  }

  setRestPose(npc.rig.refs, time, npc.phaseOffset);
}

createDuckEntity(7, 1);
createDuckEntity(4, -4);
createDuckEntity(9, -3);
createDuckEntity(-12, 30);
createDuckEntity(-2, 32);
createDuckEntity(18, 20);
createDuckEntity(-20, 20);
createPigeonEntity(4.6, -1.8);
createPigeonEntity(6.8, -3.1);
createPigeonEntity(8.5, -1.2);
createPigeonEntity(7.2, 0.8);

const devRaycaster = new THREE.Raycaster();
const devPointerNdc = new THREE.Vector2();
const devGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const devGroundPoint = new THREE.Vector3();
const devDragOffset = new THREE.Vector3();
const devObjectWorldPosition = new THREE.Vector3();
const devParentLocalPosition = new THREE.Vector3();
const devSelectionBox = new THREE.BoxHelper(world, 0x62ff9f);
devSelectionBox.visible = false;
devSelectionBox.renderOrder = 1000;
devSelectionBox.material.depthTest = false;
scene.add(devSelectionBox);

const devOverlay = document.createElement("div");
devOverlay.className = "dev-tools-panel";
devOverlay.hidden = true;
container.appendChild(devOverlay);

const devPointer = {
  cssX: 0,
  cssY: 0,
  deviceX: 0,
  deviceY: 0,
  worldX: 0,
  worldZ: 0,
  hasWorld: false,
};
let devMode = false;
let devSelected = null;
let devDragging = false;
let devSelectionMoved = false;

const DEV_GAMEPLAY_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyE",
  "Space",
  "KeyG",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
]);

function formatDevNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function escapeDevText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCanvasPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const cssX = THREE.MathUtils.clamp(event.clientX - rect.left, 0, width);
  const cssY = THREE.MathUtils.clamp(event.clientY - rect.top, 0, height);
  const pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : window.devicePixelRatio || 1;

  devPointer.cssX = cssX;
  devPointer.cssY = cssY;
  devPointer.deviceX = cssX * pixelRatio;
  devPointer.deviceY = cssY * pixelRatio;
  devPointerNdc.set((cssX / width) * 2 - 1, -(cssY / height) * 2 + 1);
  return devPointer;
}

function updateDevGroundPoint(event) {
  getCanvasPointer(event);
  devRaycaster.setFromCamera(devPointerNdc, camera);
  const hit = devRaycaster.ray.intersectPlane(devGroundPlane, devGroundPoint);
  devPointer.hasWorld = !!hit;
  if (hit) {
    devPointer.worldX = hit.x;
    devPointer.worldZ = hit.z;
  }
  return hit;
}

function getDevTargetWorldPosition(target, out = devObjectWorldPosition) {
  if (!target?.object) return out.set(0, 0, 0);
  return target.object.getWorldPosition(out);
}

function findBikeStateByGroup(group) {
  for (const bike of sharedBikes.values()) {
    if (bike.group === group) return bike;
  }
  return null;
}

function collectDevTargets() {
  const targets = [];
  const seen = new Set();

  function addTarget({ object, label, kind, entityType, entity, position, pickRadius = 1.8 }) {
    if (!object || seen.has(object.uuid)) return;
    seen.add(object.uuid);
    targets.push({
      object,
      label: label || kind || object.name || "Objeto",
      kind: kind || "objeto",
      entityType,
      entity,
      position,
      pickRadius,
    });
  }

  addTarget({
    object: player,
    label: "Jogador local",
    kind: "player",
    entityType: "player",
    entity: player,
    position: player.position,
    pickRadius: 1.4,
  });

  for (const item of interactables) {
    if (!item?.root || item.kind === "door" || item.kind === "bus") continue;
    addTarget({
      object: item.root,
      label: item.label,
      kind: item.kind || "interagivel",
      entityType: "interactable",
      entity: item,
      position: item.position,
      pickRadius: Math.max(1.4, item.radius || item.npcApproachRadius || 1.8),
    });
  }

  for (const npc of npcs) {
    addTarget({
      object: npc.group,
      label: npc.name,
      kind: "npc",
      entityType: "npc",
      entity: npc,
      position: npc.group.position,
      pickRadius: 1.6,
    });
  }

  for (const duck of ducks) {
    addTarget({
      object: duck.group,
      label: duck.name,
      kind: "duck",
      entityType: "duck",
      entity: duck,
      position: duck.group.position,
      pickRadius: 1.2,
    });
  }

  for (const pigeon of pigeons) {
    addTarget({
      object: pigeon.group,
      label: pigeon.name,
      kind: "pigeon",
      entityType: "pigeon",
      entity: pigeon,
      position: pigeon.group.position,
      pickRadius: 1,
    });
  }

  return targets;
}

function resolveDevTargetFromObject(object, targetByUuid) {
  let current = object;
  while (current) {
    const target = targetByUuid.get(current.uuid);
    if (target) return target;
    current = current.parent;
  }
  return null;
}

function pickDevTarget(event) {
  const groundHit = updateDevGroundPoint(event);
  const targets = collectDevTargets();
  const targetByUuid = new Map();
  const roots = [];

  for (const target of targets) {
    target.object.traverse?.((node) => targetByUuid.set(node.uuid, target));
    roots.push(target.object);
  }

  devRaycaster.setFromCamera(devPointerNdc, camera);
  const hits = devRaycaster.intersectObjects(roots, true);
  for (const hit of hits) {
    const target = resolveDevTargetFromObject(hit.object, targetByUuid);
    if (target) return target;
  }

  if (!groundHit) return null;

  let fallback = null;
  let fallbackDistance = Infinity;
  for (const target of targets) {
    const position = getDevTargetWorldPosition(target);
    const distance = Math.hypot(position.x - groundHit.x, position.z - groundHit.z);
    if (distance <= target.pickRadius && distance < fallbackDistance) {
      fallback = target;
      fallbackDistance = distance;
    }
  }
  return fallback;
}

function applyDevMove(target, worldX, worldZ) {
  if (!target?.object) return;
  const x = THREE.MathUtils.clamp(worldX, -68, 68);
  const z = THREE.MathUtils.clamp(worldZ, -68, 68);

  if (target.object.parent) {
    devParentLocalPosition.set(x, 0, z);
    target.object.parent.worldToLocal(devParentLocalPosition);
    target.object.position.x = devParentLocalPosition.x;
    target.object.position.z = devParentLocalPosition.z;
  } else {
    target.object.position.x = x;
    target.object.position.z = z;
  }

  if (target.position) {
    target.position.x = x;
    target.position.z = z;
  }

  if (target.entityType === "npc" && target.entity) {
    target.entity.home.set(x, 0, z);
    target.entity.moveTarget.set(x, 0, z);
    target.entity.targetX = x;
    target.entity.targetZ = z;
    target.entity.pause = 0.6;
    target.entity.focus = null;
    target.entity.pose = null;
  } else if ((target.entityType === "duck" || target.entityType === "pigeon") && target.entity) {
    target.entity.home.set(x, 0, z);
    target.entity.target.set(x, 0, z);
    target.entity.waitTimer = 0.4;
    target.entity.wanderTimer = 0.4;
    target.entity.fleeTimer = 0;
  } else if (target.entityType === "interactable" && target.entity) {
    const bike = findBikeStateByGroup(target.object);
    if (bike) {
      bike.targetX = x;
      bike.targetZ = z;
      bike.hasSharedState = false;
      bike.emitState?.(false);
    }
  }

  if (target.entityType === "player") {
    playerVelocity.set(0, 0);
  }

  devSelectionMoved = true;
  updateDevSelectionBox();
  updateDevOverlay();
}

function moveDevSelectionBy(dx, dz) {
  if (!devSelected) return false;
  const position = getDevTargetWorldPosition(devSelected);
  applyDevMove(devSelected, position.x + dx, position.z + dz);
  return true;
}

function setDevSelected(target) {
  devSelected = target;
  devSelectionMoved = false;
  updateDevSelectionBox();
  updateDevOverlay();
}

function updateDevSelectionBox() {
  if (!devSelected?.object || !devMode) {
    devSelectionBox.visible = false;
    return;
  }
  devSelectionBox.setFromObject(devSelected.object);
  devSelectionBox.visible = true;
}

function updateDevCursor() {
  if (!canvas?.style) return;
  if (!devMode) {
    canvas.style.cursor = "";
    return;
  }
  canvas.style.cursor = devDragging ? "grabbing" : devSelected ? "grab" : "crosshair";
}

function updateDevOverlay() {
  if (!devMode) {
    devOverlay.hidden = true;
    return;
  }

  devOverlay.hidden = false;
  const selectedPosition = devSelected ? getDevTargetWorldPosition(devSelected) : null;
  const selectedLabel = devSelected
    ? `${devSelected.label} (${devSelected.kind})`
    : "nenhum";
  const selectedLine = selectedPosition
    ? `pos x ${formatDevNumber(selectedPosition.x)} / z ${formatDevNumber(selectedPosition.z)}`
    : "clique em um objeto para selecionar";

  devOverlay.innerHTML = `
    <div class="dev-tools-title">Modo desenvolvedor</div>
    <div class="dev-tools-grid">
      <span>pixel CSS</span><strong>${formatDevNumber(devPointer.cssX, 0)}, ${formatDevNumber(devPointer.cssY, 0)}</strong>
      <span>pixel canvas</span><strong>${formatDevNumber(devPointer.deviceX, 0)}, ${formatDevNumber(devPointer.deviceY, 0)}</strong>
      <span>mundo</span><strong>${devPointer.hasWorld ? `x ${formatDevNumber(devPointer.worldX)} / z ${formatDevNumber(devPointer.worldZ)}` : "--"}</strong>
      <span>seleção</span><strong>${escapeDevText(selectedLabel)}</strong>
      <span>posição</span><strong>${selectedLine}</strong>
    </div>
    <div class="dev-tools-help">
      F2 liga/desliga · clique e arraste move · setas ajustam · Shift = passo maior · Alt = fino · Esc limpa
    </div>
    ${devSelectionMoved ? `<div class="dev-tools-copy">Use x ${formatDevNumber(selectedPosition?.x)} / z ${formatDevNumber(selectedPosition?.z)} no código se quiser persistir.</div>` : ""}
  `;
}

function setDevMode(nextMode) {
  devMode = nextMode === true;
  devDragging = false;
  cameraDragActive = false;
  keys.clear();
  if (!devMode) {
    setDevSelected(null);
  }
  updateDevCursor();
  updateDevSelectionBox();
  updateDevOverlay();
}

function handleDevKeyDown(event) {
  if (event.code === "F2" && !event.repeat) {
    event.preventDefault();
    setDevMode(!devMode);
    return true;
  }

  if (!devMode) return false;

  if (event.code === "Escape") {
    event.preventDefault();
    setDevSelected(null);
    return true;
  }

  const nudgeStep = event.altKey ? 0.05 : event.shiftKey ? 1 : 0.25;
  const nudgeByCode = {
    ArrowUp: [0, -nudgeStep],
    ArrowDown: [0, nudgeStep],
    ArrowLeft: [-nudgeStep, 0],
    ArrowRight: [nudgeStep, 0],
  };
  const nudge = nudgeByCode[event.code];
  if (nudge) {
    event.preventDefault();
    moveDevSelectionBy(nudge[0], nudge[1]);
    return true;
  }

  if (DEV_GAMEPLAY_KEYS.has(event.code)) {
    event.preventDefault();
    return true;
  }

  return false;
}

function handleDevPointerDown(event) {
  if (!devMode || event.button !== 0) return false;
  event.preventDefault();
  event.stopPropagation();
  const hit = updateDevGroundPoint(event);
  const target = pickDevTarget(event);
  setDevSelected(target);

  if (target && hit) {
    const position = getDevTargetWorldPosition(target);
    devDragOffset.set(position.x - hit.x, 0, position.z - hit.z);
    devDragging = true;
  }

  updateDevCursor();
  return true;
}

function handleDevPointerMove(event) {
  if (!devMode) return false;
  const hit = updateDevGroundPoint(event);

  if (devDragging && devSelected && hit) {
    event.preventDefault();
    applyDevMove(devSelected, hit.x + devDragOffset.x, hit.z + devDragOffset.z);
    return true;
  }

  updateDevOverlay();
  return false;
}

function handleDevPointerUp(event) {
  if (!devMode || !devDragging) return false;
  event.preventDefault();
  devDragging = false;
  updateDevCursor();
  updateDevOverlay();
  return true;
}

const inputVector = new THREE.Vector2();
const cameraGroundBasis = {
  forward: new THREE.Vector2(),
  right: new THREE.Vector2(),
};
const playerWorldInput = new THREE.Vector2();
const mobileInput = {
  x: 0,
  y: 0,
  running: false,
};

function getInputVector() {
  const keyX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const keyZ = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  const x = THREE.MathUtils.clamp(keyX + mobileInput.x, -1, 1);
  const z = THREE.MathUtils.clamp(keyZ + mobileInput.y, -1, 1);
  return inputVector.set(x, z);
}

function setMobileInput(nextInput = {}) {
  if (typeof nextInput.x === "number") {
    mobileInput.x = THREE.MathUtils.clamp(nextInput.x, -1, 1);
  }
  if (typeof nextInput.y === "number") {
    mobileInput.y = THREE.MathUtils.clamp(nextInput.y, -1, 1);
  }
  if (typeof nextInput.running === "boolean") {
    mobileInput.running = nextInput.running;
  }
  if (ambientAudioEnabled) ensureAmbientAudio();
}

function queueMobileInteract() {
  interactQueued = true;
  if (ambientAudioEnabled) ensureAmbientAudio();
}

function queueMobileJump() {
  jumpQueued = true;
  if (ambientAudioEnabled) ensureAmbientAudio();
}

function getCameraGroundBasis() {
  const forward = cameraGroundBasis.forward.set(
    player.position.x - camera.position.x,
    player.position.z - camera.position.z
  );
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, -1);
  } else {
    forward.normalize();
  }
  cameraGroundBasis.right.set(-forward.y, forward.x);
  return cameraGroundBasis;
}

const keys = new Set();
let interactQueued = false;
let jumpQueued = false;
let queuedEmoteKind = null;
const keydownHandler = (event) => {
  if (ambientAudioEnabled) ensureAmbientAudio();
  if (handleDevKeyDown(event)) return;
  if (shouldIgnoreKeys(event)) return;
  keys.add(event.code);
  if (event.code === "KeyC" && !event.repeat) {
    event.preventDefault();
    toggleCameraMode();
  }
  if (event.code === "KeyF" && !event.repeat) {
    event.preventDefault();
    toggleCameraFocus();
  }
  if (event.code === "KeyE") interactQueued = true;
  if (event.code === "Space") {
    event.preventDefault();
    jumpQueued = true;
  }
  if (event.code === "KeyG") queuedEmoteKind = event.shiftKey ? "glitch" : "dance";
  if (event.code === "Digit1") queuedEmoteKind = "laugh";
  if (event.code === "Digit2") queuedEmoteKind = "sixseven";
  if (event.code === "Digit3") queuedEmoteKind = "wave";
  if (event.code === "Digit4") queuedEmoteKind = "point";
  if (event.code === "Digit5") queuedEmoteKind = "cheer";
};
const keyupHandler = (event) => keys.delete(event.code);
const mousedownHandler = (event) => {
  if (ambientAudioEnabled) ensureAmbientAudio();
  if (handleDevPointerDown(event)) return;
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  if (cameraMode !== "orbit" || shouldIgnoreKeys()) return;
  cameraDragActive = true;
  cameraDragX = event.clientX;
  cameraDragY = event.clientY;
};
const mousemoveHandler = (event) => {
  if (handleDevPointerMove(event)) return;
  if (cameraMode !== "orbit" || !cameraDragActive || shouldIgnoreKeys()) return;
  const dx = event.clientX - cameraDragX;
  const dy = event.clientY - cameraDragY;
  cameraDragX = event.clientX;
  cameraDragY = event.clientY;
  cameraOrbitYaw -= dx * 0.0055;
  cameraOrbitPitch = THREE.MathUtils.clamp(cameraOrbitPitch - dy * 0.0045, 0.22, 1.08);
};
const mouseupHandler = (event) => {
  if (handleDevPointerUp(event)) return;
  cameraDragActive = false;
};
const contextmenuHandler = (event) => {
  event.preventDefault();
  cameraDragActive = false;
};
const wheelHandler = (event) => {
  if (ambientAudioEnabled) ensureAmbientAudio();
  if (cameraMode !== "orbit" || shouldIgnoreKeys()) return;
  event.preventDefault();
  cameraOrbitDistance = THREE.MathUtils.clamp(cameraOrbitDistance + event.deltaY * 0.02, 16, 38);
};
window.addEventListener("keydown", keydownHandler);
window.addEventListener("keyup", keyupHandler);
window.addEventListener("mousedown", mousedownHandler);
window.addEventListener("mousemove", mousemoveHandler);
window.addEventListener("mouseup", mouseupHandler);
window.addEventListener("contextmenu", contextmenuHandler);
window.addEventListener("wheel", wheelHandler, { passive: false });
const blurHandler = () => keys.clear();
const resetCameraDrag = () => {
  cameraDragActive = false;
};
window.addEventListener("blur", blurHandler);
window.addEventListener("blur", resetCameraDrag);

function showSpeech(text, speaker, hint) {
  if (!speechEl) return;
  if (speechBodyEl) speechBodyEl.textContent = text;
  if (speechNameEl) speechNameEl.textContent = speaker || "Aviso";
  if (speechHintEl) speechHintEl.textContent = hint || "[E]";
  speechEl.classList.add("visible");
}

function hideSpeech() {
  if (!speechEl) return;
  speechEl.classList.remove("visible");
}

function speak(text, speaker) {
  if (!speechEl) {
    pushBubble("__local__", text, 3.2);
    return;
  }
  showSpeech(text, speaker, "");
  speechEl.dataset.locked = "1";
  speechEl.dataset.ttl = "2.6";
}

function setStatus(text) {
  if (!statusEl) return;
  if (!text) {
    statusEl.textContent = "";
    statusEl.style.opacity = "0";
    statusEl.dataset.active = "0";
    return;
  }
  statusEl.textContent = text;
  statusEl.style.opacity = "1";
  statusEl.dataset.active = "1";
}

function clearSpeech() {
  if (!speechEl) return;
  if (speechEl.dataset.locked === "1") return;
  hideSpeech();
}

function releaseSpeechLock(dt) {
  if (!speechEl) return;
  if (speechEl.dataset.ttl) {
    const ttl = Math.max(0, Number(speechEl.dataset.ttl) - dt);
    speechEl.dataset.ttl = String(ttl);
    if (ttl <= 0) {
      speechEl.dataset.locked = "0";
      hideSpeech();
      delete speechEl.dataset.ttl;
    }
  }
}

const playerVelocity = new THREE.Vector2();
const facing = new THREE.Vector2(0, -1);
let playerFootstepDistance = 0;
const playerRadius = 0.55;
const npcRadius = 0.48;
const worldLimit = 68;
const maxSpeed = 7.2;
const accel = 22;
const drag = 10;
const clock = new THREE.Clock();

function clampPlayerToWorld(radius = playerRadius) {
  player.position.x = THREE.MathUtils.clamp(player.position.x, -worldLimit + radius, worldLimit - radius);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -worldLimit + radius, worldLimit - radius);
}

function resolveCollisions(axis, radius = playerRadius) {
  for (const box of blockers) {
    if (box.active === false) continue;
    const px = player.position.x;
    const pz = player.position.z;
    const minX = box.minX - radius;
    const maxX = box.maxX + radius;
    const minZ = box.minZ - radius;
    const maxZ = box.maxZ + radius;
    if (!(px > minX && px < maxX && pz > minZ && pz < maxZ)) continue;

    if (axis === "x") {
      player.position.x = px < (box.minX + box.maxX) / 2 ? minX : maxX;
      playerVelocity.x = 0;
    } else {
      player.position.z = pz < (box.minZ + box.maxZ) / 2 ? minZ : maxZ;
      playerVelocity.y = 0;
    }
  }
}

function enterSitState(target, options = {}) {
  playerState.sitting = true;
  playerState.sitTimer = options.duration ?? 2.6;
  playerState.sitTarget = target;
  playerState.sitLabel = options.label ?? "banco";
  playerState.sitEndMessage = options.endMessage ?? "Voce se levantou do banco.";
  playerState.sitEndSpeaker = options.endSpeaker ?? "Banco";
}

function applyBikeRidePose(refs, pedalPhase, intensity = 1, steering = 0, wheelie = 0) {
  const lean = steering * 0.16;
  refs.leftShoulder.rotation.x = -0.72 + wheelie * 0.24;
  refs.rightShoulder.rotation.x = -0.72 + wheelie * 0.24;
  refs.leftShoulder.rotation.z = 0.08 + lean;
  refs.rightShoulder.rotation.z = -0.08 + lean;
  refs.leftElbow.rotation.x = 0.58 - steering * 0.08 + wheelie * 0.16;
  refs.rightElbow.rotation.x = 0.58 + steering * 0.08 + wheelie * 0.16;
  refs.leftElbow.rotation.z = 0.05;
  refs.rightElbow.rotation.z = -0.05;

  const pedal = Math.sin(pedalPhase) * 0.72 * intensity;
  const oppositePedal = Math.sin(pedalPhase + Math.PI) * 0.72 * intensity;
  refs.leftHip.rotation.x = -1.1 + pedal * 0.52;
  refs.rightHip.rotation.x = -1.1 + oppositePedal * 0.52;
  refs.leftKnee.rotation.x = 1.42 + Math.max(0, -pedal) * 0.68;
  refs.rightKnee.rotation.x = 1.42 + Math.max(0, -oppositePedal) * 0.68;
  refs.torso.rotation.x = 0.14 - wheelie * 0.22;
  refs.torso.rotation.y = lean;
  refs.head.rotation.x = -0.06 + wheelie * 0.12;
  refs.head.rotation.y = steering * 0.12;
}

function updatePlayer(dt, time) {
  if (playerState.sitting) {
    interactQueued = false;
    playerFootstepDistance = 0;
    updatePlayerActivity({
      kind: "sitting",
      label: "sentado",
      detail: `no ${playerState.sitLabel || "banco"}`
    });
    playerState.sitTimer -= dt;
    if (playerState.sitTarget) {
      player.position.lerp(playerState.sitTarget.position, 0.12);
      player.rotation.y = lerpAngle(player.rotation.y, playerState.sitTarget.rotation, 0.12);
    }
    if (playerState.sitTimer <= 0) {
      playerState.sitting = false;
      playerState.sitTarget = null;
      speak(playerState.sitEndMessage || "Voce se levantou.", playerState.sitEndSpeaker || "Banco");
      playerState.sitLabel = "";
      playerState.sitEndMessage = "";
      playerState.sitEndSpeaker = "Banco";
    }
    setSittingPose(playerRig.refs);
    return;
  }

  const mountedBike = playerState.ridingBike;
  if (mountedBike) {
    if (queuedEmoteKind) queuedEmoteKind = null;
    const wheelieQueued = jumpQueued || keys.has("Space");
    jumpQueued = false;
    playerState.jumping = false;
    playerState.jumpVel = 0;
    playerState.jumpY = 0;

    const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight") || mobileInput.running;
    const input = getInputVector();
    const moving = input.lengthSq() > 0;
    const isBoosting = shiftHeld && moving;
    const speedBeforeMove = playerVelocity.length();
    const wheelieRequested = wheelieQueued && speedBeforeMove > 3.8;
    if (wheelieRequested) {
      mountedBike.wheelieTimer = Math.max(mountedBike.wheelieTimer, keys.has("Space") ? 0.18 : 0.9);
    }
    updatePlayerActivity({
      kind: "riding",
      label: mountedBike.wheelieAmount > 0.22 || wheelieRequested ? "dando grau" : "pedalando",
      detail: mountedBike.wheelieAmount > 0.22 || wheelieRequested
        ? "levantando a roda da frente"
        : isBoosting ? "acelerando na bicicleta" : moving ? "rodando pelo campus" : "equilibrando a bicicleta",
    });

    const targetMaxSpeed = moving ? (isBoosting ? 18.5 : 12.8) : 0;
    const targetAccel = isBoosting ? 30 : 22;
    const bikeDrag = moving ? 0.985 : Math.max(0, 1 - drag * 1.35 * dt);
    const cameraBasis = getCameraGroundBasis();

    if (moving) {
      input.normalize();
      const worldInput = playerWorldInput.set(0, 0)
        .addScaledVector(cameraBasis.right, input.x)
        .addScaledVector(cameraBasis.forward, -input.y);
      if (worldInput.lengthSq() > 0.0001) {
        worldInput.normalize();
        playerVelocity.addScaledVector(worldInput, targetAccel * dt);
        facing.copy(worldInput);
      }
    } else {
      playerVelocity.multiplyScalar(bikeDrag);
    }

    const speed = playerVelocity.length();
    if (targetMaxSpeed > 0 && speed > targetMaxSpeed) {
      playerVelocity.setLength(targetMaxSpeed);
    }
    mountedBike.wheelieTimer = Math.max(0, mountedBike.wheelieTimer - dt);
    const wheelieSpeedFactor = THREE.MathUtils.clamp((speed - 3.2) / 7.5, 0, 1);
    const targetWheelie = mountedBike.wheelieTimer > 0 ? wheelieSpeedFactor : 0;
    mountedBike.wheelieAmount = THREE.MathUtils.lerp(
      mountedBike.wheelieAmount,
      targetWheelie,
      Math.min(1, dt * (targetWheelie > 0 ? 7.5 : 5.2))
    );
    if (mountedBike.wheelieAmount > 0.15) {
      playerVelocity.multiplyScalar(1 - mountedBike.wheelieAmount * 0.24 * dt);
    }

    const collisionRadius = 0.82;
    player.position.x += playerVelocity.x * dt;
    resolveCollisions("x", collisionRadius);
    player.position.z += playerVelocity.y * dt;
    resolveCollisions("z", collisionRadius);
    clampPlayerToWorld(collisionRadius);

    if (facing.lengthSq() > 0.001) {
      const angle = Math.atan2(facing.x, facing.y);
      player.rotation.y = lerpAngle(player.rotation.y, angle, 0.14);
    }

    mountedBike.wheelSpin += speed * dt / Math.max(0.2, mountedBike.wheelRadius);
    mountedBike.pedalPhase += speed * dt * 0.95;
    const wheelieAngle = mountedBike.wheelieAmount * 0.52;
    const wheelieLift = Math.sin(wheelieAngle) * 0.86;
    mountedBike.group.position.set(player.position.x, wheelieLift, player.position.z);
    mountedBike.group.rotation.x = -wheelieAngle;
    mountedBike.group.rotation.y = player.rotation.y;
    for (const wheel of mountedBike.wheels) {
      wheel.rotation.x = mountedBike.wheelSpin;
    }
    mountedBike.crank.rotation.x = mountedBike.pedalPhase;

    const steering = THREE.MathUtils.clamp(playerVelocity.length() > 0.1 ? playerVelocity.x * 0.05 : 0, -1, 1);
    applyBikeRidePose(playerRig.refs, mountedBike.pedalPhase, Math.min(speed / 10, 1), steering, mountedBike.wheelieAmount);
    player.rotation.x = -mountedBike.wheelieAmount * 0.28;
    player.position.y = 0.18 + wheelieLift + Math.abs(Math.sin(mountedBike.pedalPhase)) * 0.02 * Math.min(speed / 9, 1);
    playerFootstepDistance = 0;
    return;
  }
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, 0, Math.min(1, dt * 9));

  if (queuedEmoteKind) {
    const queuedDuration =
      queuedEmoteKind === "dance" ? 8.0 :
      queuedEmoteKind === "glitch" ? 2.2 :
      queuedEmoteKind === "cheer" ? 3.2 :
      queuedEmoteKind === "sixseven" ? 3.4 :
      2.4;
    triggerLocalEmote(queuedEmoteKind, queuedDuration);
  }
  queuedEmoteKind = null;

  if (playerState.glitchTimer > 0) {
    playerState.glitchTimer -= dt;
    updatePlayerActivity({
      kind: "emoting",
      label: "bugando",
      detail: "desmaiando no lag do campus"
    });
    playerVelocity.set(0, 0);
    playerFootstepDistance = 0;
    setRestPose(playerRig.refs, time, playerState.glitchSeed || 0);
    animateGlitch(playerRig.refs, time, 1, playerState.glitchSeed || 0);
    player.position.y = playerState.jumpY + Math.sin(time * 14 + (playerState.glitchSeed || 0)) * 0.06;
    if (playerState.glitchTimer <= 0) {
      resetRigPose(playerRig.refs);
    }
    return;
  }

  if (playerState.celebrateTimer > 0) {
    playerState.celebrateTimer -= dt;
    updatePlayerActivity({
      kind: "emoting",
      label: "comemorando",
      detail: "soltando um caos feliz"
    });
    playerVelocity.set(0, 0);
    playerFootstepDistance = 0;
    animateCelebrate(playerRig.refs, time + (playerState.celebrateSeed || 0), 1);
    player.position.y = playerState.jumpY + Math.abs(Math.sin((time + (playerState.celebrateSeed || 0)) * 9)) * 0.08;
    if (playerState.celebrateTimer <= 0) {
      resetRigPose(playerRig.refs);
    }
    return;
  }

  if (playerState.sixSevenTimer > 0) {
    const moveCheck = getInputVector();
    if (moveCheck.lengthSq() > 0) {
      playerState.sixSevenTimer = 0;
      resetRigPose(playerRig.refs);
      broadcastEmote?.("stop", 0);
      playerFootstepDistance = 0;
    } else {
      playerState.sixSevenTimer -= dt;
      updatePlayerActivity({
        kind: "emoting",
        label: "67",
        detail: "balançando os braços no seis sete"
      });
      playerVelocity.set(0, 0);
      playerFootstepDistance = 0;
      animateSixSeven(playerRig.refs, time, playerState.sixSevenSeed || 0);
      player.position.y = playerState.jumpY + Math.abs(Math.sin((time + (playerState.sixSevenSeed || 0)) * 4.8)) * 0.025;
      if (playerState.sixSevenTimer <= 0) {
        resetRigPose(playerRig.refs);
      }
      return;
    }
  }

  if (playerState.dancing) {
    updatePlayerActivity({
      kind: "emoting",
      label: "dançando",
      detail: "em emote"
    });
    const moveCheck = getInputVector();
    if (moveCheck.lengthSq() > 0) {
      playerState.dancing = false;
      resetRigPose(playerRig.refs);
      broadcastEmote?.("stop", 0);
      playerFootstepDistance = 0;
    } else {
      playerState.danceTimer -= dt;
      playerVelocity.set(0, 0);
      playerFootstepDistance = 0;
      animateDance(playerRig.refs, time);
      player.position.y = playerState.jumpY + Math.abs(Math.sin(time * 8)) * 0.08;
      if (playerState.danceTimer <= 0) {
        playerState.dancing = false;
        resetRigPose(playerRig.refs);
      }
      return;
    }
  }

  const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight") || mobileInput.running;
  const input = getInputVector();
  const moving = input.lengthSq() > 0;
  const isCrouching = shiftHeld && !moving;
  const isRunning = shiftHeld && moving;
  updatePlayerActivity({
    kind: isRunning ? "running" : isCrouching ? "crouching" : moving ? "walking" : "idle",
    label: isRunning ? "correndo" : isCrouching ? "agachado" : moving ? "andando" : "parado",
    detail: isRunning ? "acelerando pelo campus" : isCrouching ? "bem baixinho" : moving ? "explorando o gramado" : "observando o campus"
  });
  const targetMaxSpeed = isCrouching ? 2.4 : isRunning ? 12.5 : maxSpeed;
  const targetAccel = isRunning ? accel * 1.6 : accel;
  const cameraBasis = getCameraGroundBasis();

  if (jumpQueued && !playerState.jumping && !isCrouching) {
    playerState.jumping = true;
    playerState.jumpVel = 8.2;
  }
  jumpQueued = false;

  if (moving) {
    input.normalize();
    const worldInput = playerWorldInput.set(0, 0)
      .addScaledVector(cameraBasis.right, input.x)
      .addScaledVector(cameraBasis.forward, -input.y);
    if (worldInput.lengthSq() > 0.0001) {
      worldInput.normalize();
      playerVelocity.addScaledVector(worldInput, targetAccel * dt);
      facing.copy(worldInput);
    }
  } else {
    const decay = Math.max(0, 1 - drag * dt);
    playerVelocity.multiplyScalar(decay);
  }

  const speed = playerVelocity.length();
  if (speed > targetMaxSpeed) playerVelocity.setLength(targetMaxSpeed);

  player.position.x += playerVelocity.x * dt;
  resolveCollisions("x");
  player.position.z += playerVelocity.y * dt;
  resolveCollisions("z");
  clampPlayerToWorld();

  const grounded = !playerState.jumping;
  const surface = getGroundSurfaceAt(player.position.x, player.position.z);
  if (!moving || isCrouching || !grounded || speed < 0.9) {
    playerFootstepDistance = 0;
  } else {
    playerFootstepDistance += speed * dt;
    const stepSpacing = isRunning ? 1.25 : 1.95;
    if (playerFootstepDistance >= stepSpacing) {
      playerFootstepDistance %= stepSpacing;
      playFootstepSound(surface, isRunning);
    }
  }

  if (facing.lengthSq() > 0.001) {
    const angle = Math.atan2(facing.x, facing.y);
    player.rotation.y = lerpAngle(player.rotation.y, angle, 0.16);
  }

  if (playerState.jumping) {
    playerState.jumpVel -= 22 * dt;
    playerState.jumpY += playerState.jumpVel * dt;
    if (playerState.jumpY <= 0) {
      playerState.jumpY = 0;
      playerState.jumpVel = 0;
      playerState.jumping = false;
    }
  }

  const speedRef = isRunning ? 12.5 : maxSpeed;
  const intensity = Math.min(speed / speedRef, 1);

  if (isCrouching) {
    setCrouchPose(playerRig.refs, time, 1);
    player.position.y = playerState.jumpY - 0.22;
  } else if (intensity > 0.06) {
    const walkPhase = time * (isRunning ? 9.5 : 5.5) + speed * 0.6;
    if (isRunning) animateRun(playerRig.refs, walkPhase, intensity);
    else animateWalk(playerRig.refs, walkPhase, intensity);
    player.position.y = playerState.jumpY + Math.abs(Math.sin(walkPhase)) * 0.05 * intensity;
  } else {
    setRestPose(playerRig.refs, time);
    player.position.y = playerState.jumpY + Math.sin(time * 1.6) * 0.012;
  }
}

function getDistance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function refreshCameraFrustum() {
  camera.updateMatrixWorld();
  cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  cameraFrustum.setFromProjectionMatrix(cameraMatrix);
}

function isWithinCamera(entity, radius, maxDistance) {
  const dx = entity.position.x - player.position.x;
  const dz = entity.position.z - player.position.z;
  if (dx * dx + dz * dz > maxDistance * maxDistance) return false;

  tempSphere.center.set(entity.position.x, entity.position.y ?? 0, entity.position.z);
  tempSphere.radius = radius;
  return cameraFrustum.intersectsSphere(tempSphere);
}

function updateRenderableVisibility(entity, radius, maxDistance) {
  if (devMode) {
    if (entity.visible !== true) entity.visible = true;
    return true;
  }
  const visible = isWithinCamera(entity, radius, maxDistance);
  if (entity.visible !== visible) entity.visible = visible;
  return visible;
}

function isInsideWorldBounds(x, z, radius = 0) {
  return (
    x >= -worldLimit + radius &&
    x <= worldLimit - radius &&
    z >= -worldLimit + radius &&
    z <= worldLimit - radius
  );
}

function isBlockedAt(x, z, radius = npcRadius) {
  if (!isInsideWorldBounds(x, z, radius)) return true;
  for (const box of blockers) {
    if (box.active === false) continue;
    if (
      x > box.minX - radius &&
      x < box.maxX + radius &&
      z > box.minZ - radius &&
      z < box.maxZ + radius
    ) {
      return true;
    }
  }
  return false;
}

function clampPointToWorld(point, radius = 0) {
  point.x = THREE.MathUtils.clamp(point.x, -worldLimit + radius, worldLimit - radius);
  point.z = THREE.MathUtils.clamp(point.z, -worldLimit + radius, worldLimit - radius);
  point.y = 0;
  return point;
}

function setNpcRestState(npc, time) {
  setRestPose(npc.rig.refs, time, npc.phaseOffset);
  npc.group.position.y = Math.sin(time * 1.6 + npc.phaseOffset) * 0.012;
}

function applyNpcPose(npc, time) {
  if (npc.pose?.type === "sit") {
    npc.group.position.lerp(npc.pose.position, 0.12);
    npc.group.rotation.y = lerpAngle(npc.group.rotation.y, npc.pose.rotation, 0.12);
    npc.group.position.y = 0;
    setSittingPose(npc.rig.refs);
    return;
  }
  setNpcRestState(npc, time);
}

function applyNpcAttention(npc, human, time) {
  if (!human || npc.dancing || npc.pause > 0) return;

  const distance = human.distance ?? getDistance2D(npc.group.position, human.position);
  const closeness = THREE.MathUtils.clamp(1 - distance / (npc.awarenessRadius * 1.15), 0, 1);
  if (closeness <= 0) return;

  const refs = npc.rig.refs;
  const dx = human.position.x - npc.group.position.x;
  const dz = human.position.z - npc.group.position.z;
  const targetYaw = Math.atan2(dx, dz);
  const yawOffset = THREE.MathUtils.clamp(targetYaw - npc.group.rotation.y, -0.75, 0.75);
  const lookStrength = closeness * (npc.state === "interact" ? 0.85 : npc.state === "react" ? 1 : 0.7);

  refs.torso.rotation.y += yawOffset * 0.08 * lookStrength;
  refs.head.rotation.y += yawOffset * 0.22 * lookStrength;
  refs.head.rotation.x += THREE.MathUtils.clamp(0.16 - distance * 0.01, -0.14, 0.14) * lookStrength;
  refs.head.rotation.z += Math.sin(time * 2.8 + npc.phaseOffset) * 0.015 * lookStrength;
}

function pickNpcWanderTarget(npc) {
  const anchors = npc.anchors.length ? npc.anchors : [npc.home];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const anchor = anchors[Math.floor(rand(0, anchors.length))];
    const angle = rand(0, Math.PI * 2);
    const distance = rand(2.4, 8.6);
    const candidate = new THREE.Vector3(
      anchor.x + Math.cos(angle) * distance,
      0,
      anchor.z + Math.sin(angle) * distance
    );
    clampPointToWorld(candidate, npcRadius);
    if (!isBlockedAt(candidate.x, candidate.z, npcRadius)) {
      return candidate;
    }
  }

  for (const anchor of anchors) {
    if (!isBlockedAt(anchor.x, anchor.z, npcRadius)) {
      return anchor.clone();
    }
  }

  return npc.home.clone();
}

function isInteractableAvailableForPlayer(item) {
  return item?.isDisabledForPlayer?.() !== true;
}

function isInteractableAvailableForNpc(item) {
  return item?.npcDisabled?.() !== true;
}

function pickNpcInteractable(npc) {
  const baseInterest = {
    bench: 1.1,
    fountain: 1.05,
    board: 1,
    ball: 0.95,
    bike: 0.75,
    lamp: 0.45,
    snack: 1.08,
    table: 1.18,
    kiosk: 0.82,
    bus: 0.12
  };
  const candidates = [];

  for (const item of interactables) {
    if (!isInteractableAvailableForNpc(item)) continue;
    if (item.kind === "bus") continue;
    const distance = getDistance2D(npc.group.position, item.position);
    if (distance > 30) continue;

    const itemInterest = baseInterest[item.kind] ?? 0.75;
    const personalInterest = npc.interests[item.kind] ?? 1;
    const distanceBonus = 1 - Math.min(distance / 24, 1);
    const noveltyPenalty = npc.lastInteraction === item ? 0.3 : 0;
    const score =
      itemInterest * personalInterest +
      distanceBonus * 0.85 +
      rand(-0.16, 0.22) -
      noveltyPenalty;

    if (score > 0.94) {
      candidates.push({ item, score });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].item;
}

function getNpcApproachPoint(npc, item) {
  if (item.npcApproachPosition) {
    return item.npcApproachPosition.clone();
  }

  const approachRadius = item.npcApproachRadius ?? Math.max(0.9, item.radius * 0.55);
  let baseAngle = Math.atan2(
    npc.group.position.z - item.position.z,
    npc.group.position.x - item.position.x
  );
  if (!Number.isFinite(baseAngle)) {
    baseAngle = rand(0, Math.PI * 2);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const offset = attempt === 0 ? 0 : rand(-1.25, 1.25);
    const angle = baseAngle + offset;
    const candidate = new THREE.Vector3(
      item.position.x + Math.cos(angle) * approachRadius,
      0,
      item.position.z + Math.sin(angle) * approachRadius
    );
    clampPointToWorld(candidate, npcRadius);
    if (!isBlockedAt(candidate.x, candidate.z, npcRadius)) {
      return candidate;
    }
  }

  return pickNpcWanderTarget(npc);
}

function enterNpcIdle(npc, min = 0.35, max = 1.3) {
  npc.state = "idle";
  npc.stateTimer = min + rand(0, Math.max(0.05, max - min));
  npc.focus = null;
  npc.pose = null;
}

function chooseNextNpcAction(npc) {
  npc.pose = null;

  const interactChance =
    npc.personality === "busy"
      ? 0.72
      : npc.personality === "friendly" || npc.personality === "gossipy"
        ? 0.66
        : 0.58;
  if (rand(0, 1) < interactChance) {
    const focus = pickNpcInteractable(npc);
    if (focus) {
      npc.state = "approach";
      npc.focus = focus;
      npc.stateTimer = 5.5 + rand(0, 3.2);
      npc.moveTarget.copy(getNpcApproachPoint(npc, focus));
      return;
    }
  }

  npc.state = "wander";
  npc.focus = null;
  npc.stateTimer = 4 + rand(0, 3.8);
  npc.moveTarget.copy(pickNpcWanderTarget(npc));
}

function moveNpcTowards(npc, target, dt, time, arrivalRadius = 0.3) {
  const dx = target.x - npc.group.position.x;
  const dz = target.z - npc.group.position.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= arrivalRadius) {
    setNpcRestState(npc, time);
    return "reached";
  }

  const dirX = dx / distance;
  const dirZ = dz / distance;
  const speedBoost = npc.state === "react" ? 1.28 : npc.running ? 1.18 : 1.08;
  const step = Math.min(distance - arrivalRadius, npc.speed * speedBoost * dt);
  const nextX = npc.group.position.x + dirX * step;
  const nextZ = npc.group.position.z + dirZ * step;

  let moved = false;
  if (!isBlockedAt(nextX, nextZ, npcRadius)) {
    npc.group.position.x = nextX;
    npc.group.position.z = nextZ;
    moved = true;
  } else if (!isBlockedAt(nextX, npc.group.position.z, npcRadius)) {
    npc.group.position.x = nextX;
    moved = true;
  } else if (!isBlockedAt(npc.group.position.x, nextZ, npcRadius)) {
    npc.group.position.z = nextZ;
    moved = true;
  }

  if (!moved) {
    setNpcRestState(npc, time);
    return "blocked";
  }

  npc.group.rotation.y = lerpAngle(npc.group.rotation.y, Math.atan2(dirX, dirZ), 0.18);

  if (npc.running) {
    const walkPhase = time * (8 + npc.speed * 0.5) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 4.0, 1);
    animateRun(npc.rig.refs, walkPhase, intensity);
    if (npc.holdingBucket) {
      const r = npc.rig.refs;
      r.leftShoulder.rotation.x = -1.35;
      r.rightShoulder.rotation.x = -1.35;
      r.leftShoulder.rotation.z = 0.35;
      r.rightShoulder.rotation.z = -0.35;
      r.leftElbow.rotation.x = 0.6;
      r.rightElbow.rotation.x = 0.6;
      r.torso.rotation.x = 0.22;
    }
    npc.group.position.y = Math.abs(Math.sin(walkPhase)) * 0.06 * intensity;
  } else {
    const walkPhase = time * (4 + npc.speed * 0.9) + npc.phaseOffset;
    const intensity = Math.min(npc.speed / 1.4, 1);
    animateWalk(npc.rig.refs, walkPhase, intensity);
    npc.group.position.y = Math.abs(Math.sin(walkPhase)) * 0.035 * intensity;
  }

  return distance - step <= arrivalRadius + 0.02 ? "reached" : "moving";
}

function getNearestTarget() {
  let best = null;
  let bestDistance = Infinity;

  for (const npc of npcs) {
    const distance = getDistance2D(player.position, npc.group.position);
    if (distance < npc.radius && distance < bestDistance) {
      best = npc;
      bestDistance = distance;
    }
  }

  for (const duck of ducks) {
    const distance = getDistance2D(player.position, duck.group.position);
    if (distance < duck.radius && distance < bestDistance) {
      best = duck;
      bestDistance = distance;
    }
  }

  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const distance = getDistance2D(player.position, item.position);
    if (distance < item.radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }

  return best;
}

function getNearestCameraFocusTarget(maxDistance = 28) {
  let best = null;
  let bestDistance = Infinity;

  for (const r of remotePlayers.values()) {
    const distance = getDistance2D(player.position, r.group.position);
    if (distance < maxDistance && distance < bestDistance) {
      best = {
        kind: "remote",
        id: r.id,
        position: r.group.position,
        label: r.nick || "Player",
      };
      bestDistance = distance;
    }
  }

  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const distance = getDistance2D(player.position, item.position);
    if (distance < maxDistance && distance < bestDistance) {
      best = {
        kind: "point",
        id: item.kind || item.label || "point",
        position: item.position,
        label: item.label || "Ponto",
      };
      bestDistance = distance;
    }
  }

  return best;
}

function toggleCameraFocus() {
  if (cameraMode !== "orbit") return;
  if (cameraFocusTarget) {
    clearCameraFocus();
    return;
  }

  const target = getNearestCameraFocusTarget();
  if (target) setCameraFocus(target);
}

function formatDistanceMeters(distance) {
  const rounded = Math.max(0, Math.round(distance * 10) / 10);
  return `${String(rounded).replace(".", ",")}m`;
}

function formatSeconds(seconds) {
  const safe = Math.max(0, seconds);
  return `${Math.ceil(safe)}s`;
}

function getNearestInteractable(maxDistance = 7) {
  let best = null;
  let bestDistance = maxDistance;

  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const distance = getDistance2D(player.position, item.position);
    if (distance > bestDistance) continue;
    best = { item, distance };
    bestDistance = distance;
  }

  return best;
}

function updateNpc(npc, dt, time) {
  npc.talkCooldown = Math.max(0, npc.talkCooldown - dt);
  npc.reactionCooldown = Math.max(0, npc.reactionCooldown - dt);
  npc.chatterCooldown = Math.max(0, npc.chatterCooldown - dt);
  npc.slowThinkTimer = Math.max(0, npc.slowThinkTimer - dt);
  const playerDistance = getDistance2D(player.position, npc.group.position);
  const human = findNearestHuman(npc.group.position, npc.awarenessRadius);

  if (
    playerDistance > npc.thinkRadius &&
    npc.state === "idle" &&
    npc.pause <= 0 &&
    !npc.dancing
  ) {
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);
    if (npc.slowThinkTimer > 0) return;
    npc.slowThinkTimer = 0.18 + rand(0, 0.25);
  }

  if (
    human &&
    npc.reactionCooldown <= 0 &&
    npc.state !== "interact" &&
    npc.state !== "approach"
  ) {
    const shouldReact =
      human.distance <= npc.reactionRadius ||
      (human.speed > 5 && human.distance <= npc.awarenessRadius * 0.9) ||
      (npc.personality === "friendly" && human.distance <= npc.reactionRadius + 2) ||
      (npc.personality === "curious" && human.distance <= npc.reactionRadius + 3) ||
      (npc.personality === "gossipy" && human.distance <= npc.reactionRadius + 3);

    if (shouldReact) {
      npc.state = "react";
      npc.reactionTimer = 0.85 + rand(0, 0.95);
      npc.reactionHuman = human;
      npc.focus = null;
      npc.pose = null;
      npc.reactionCooldown = 1.8 + rand(0, 1.8);
      setNpcReactionTarget(npc, human);
    }
  }

  if (npc.dancing && npc.danceTimer > 0) {
    npc.danceTimer -= dt;
    animateDance(npc.rig.refs, time + npc.phaseOffset);
    npc.group.position.y = Math.abs(Math.sin((time + npc.phaseOffset) * 8)) * 0.06;
    if (npc.danceTimer <= 0) {
      npc.dancing = false;
      resetRigPose(npc.rig.refs);
      npc.pause = 0.4;
    }
    return;
  }

  if (npc.celebrateTimer && npc.celebrateTimer > 0) {
    npc.celebrateTimer -= dt;
    animateCelebrate(npc.rig.refs, time + npc.phaseOffset, 1);
    npc.group.position.y = Math.abs(Math.sin((time + npc.phaseOffset) * 9)) * 0.08;
    if (npc.celebrateTimer <= 0) {
      resetRigPose(npc.rig.refs);
      npc.pause = 0.35;
    }
    return;
  }

  if (npc.state === "react") {
    npc.reactionTimer -= dt;
    const currentHuman = findNearestHuman(npc.group.position, npc.awarenessRadius);
    if (!currentHuman) {
      enterNpcIdle(npc, 0.2, 0.7);
      npc.reactionHuman = null;
      return;
    }

    npc.reactionHuman = currentHuman;
    setNpcReactionTarget(npc, currentHuman);
    const chase = npc.personality === "athletic" ? 1.35 : 1.05;
    const result = moveNpcTowards(npc, npc.moveTarget, dt * chase, time, 0.32);

    npc.group.rotation.y = lerpAngle(
      npc.group.rotation.y,
      Math.atan2(
        currentHuman.position.x - npc.group.position.x,
        currentHuman.position.z - npc.group.position.z
      ),
      0.16
    );

    if (result === "blocked") {
      setNpcReactionTarget(npc, currentHuman);
    }

    applyNpcAttention(npc, currentHuman, time);
    if (npc.reactionTimer <= 0 || currentHuman.distance > npc.awarenessRadius * 1.15) {
      enterNpcIdle(npc, 0.25, 0.9);
      npc.reactionHuman = null;
    }
    return;
  }

  if (npc.pause > 0) {
    npc.pause -= dt;
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);
    return;
  }

  if (npc.state === "idle") {
    if (npc.running && npc.stateTimer > 0.15) npc.stateTimer = 0.15;
    npc.stateTimer -= dt;
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);
    if (npc.stateTimer <= 0) {
      if (npc.running) {
        npc.state = "wander";
        npc.stateTimer = 4 + rand(0, 2);
        npc.moveTarget.copy(pickNpcWanderTarget(npc));
      } else {
        chooseNextNpcAction(npc);
      }
    }
    return;
  }

  if (npc.state === "wander") {
    npc.stateTimer -= dt;
    const result = moveNpcTowards(npc, npc.moveTarget, dt, time, 0.26);
    applyNpcAttention(npc, human, time);
    if (result === "reached") {
      enterNpcIdle(npc, 0.25, 1);
    } else if (result === "blocked") {
      npc.moveTarget.copy(pickNpcWanderTarget(npc));
      npc.stateTimer = Math.max(npc.stateTimer, 1.1);
    } else if (npc.stateTimer <= 0) {
      enterNpcIdle(npc, 0.25, 0.8);
    }
    return;
  }

  if (npc.state === "approach") {
    npc.stateTimer -= dt;

    if (!npc.focus) {
      enterNpcIdle(npc, 0.2, 0.8);
      return;
    }

    if (
      npc.focus.kind === "ball" ||
      !npc.focus.npcApproachPosition &&
      getDistance2D(npc.moveTarget, npc.focus.position) > npc.focus.npcApproachRadius + 0.35
    ) {
      npc.moveTarget.copy(getNpcApproachPoint(npc, npc.focus));
    }

    const result = moveNpcTowards(npc, npc.moveTarget, dt, time, 0.26);
    applyNpcAttention(npc, human, time);
    if (result === "reached") {
      npc.state = "interact";
      npc.stateTimer = npc.focus.npcDuration ?? 1.2;
      npc.lastInteraction = npc.focus;
      npc.focus.npcInteract?.(npc);
    } else if (result === "blocked") {
      npc.moveTarget.copy(getNpcApproachPoint(npc, npc.focus));
      npc.stateTimer -= dt * 1.5;
    }

    if (npc.stateTimer <= 0) {
      enterNpcIdle(npc, 0.3, 1.1);
    }
    return;
  }

  if (npc.state === "interact") {
    npc.stateTimer -= dt;
    applyNpcPose(npc, time);
    applyNpcAttention(npc, human, time);

    if (!npc.pose && npc.focus?.position) {
      const lookX = npc.focus.position.x - npc.group.position.x;
      const lookZ = npc.focus.position.z - npc.group.position.z;
      if (lookX * lookX + lookZ * lookZ > 0.001) {
        npc.group.rotation.y = lerpAngle(
          npc.group.rotation.y,
          Math.atan2(lookX, lookZ),
          0.14
        );
      }
    }

    if (npc.stateTimer <= 0) {
      enterNpcIdle(npc, 0.5, 1.5);
    }
    return;
  }

  enterNpcIdle(npc, 0.35, 1.1);
}

function updateInteractionUI() {
  if (playerState.sitting) {
    const rideLabel = playerState.sitLabel || "banco";
    setStatus(`No ${rideLabel} • faltam ${formatSeconds(playerState.sitTimer)} para descer.`);
    clearSpeech();
    return;
  }

  for (const npc of npcs) {
    const inRange = getDistance2D(player.position, npc.group.position) < npc.radius;
    if (inRange && !npc.nearby) {
      npc.previewLine = pickRandomLine(npc);
    }
    npc.nearby = inRange;
  }
  for (const duck of ducks) {
    duck.nearby = getDistance2D(player.position, duck.group.position) < duck.radius;
  }

  const target = getNearestTarget();
  if (!target) {
    if (playerState.ridingBike) {
      setStatus("Na bicicleta • Space/Pular da grau • Shift acelera • E desce.");
      clearSpeech();
      return;
    }
    const nearestInteractable = getNearestInteractable();
    const weatherText = atmosphereSnapshot.weatherLabel ? ` • ${atmosphereSnapshot.weatherLabel}` : "";
    if (nearestInteractable) {
      const busCrowdText = nearestInteractable.item.kind === "bus" && nearestInteractable.item.crowdLabel
        ? ` • ${nearestInteractable.item.crowdLabel}`
        : "";
      setStatus(
        `Perto de ${nearestInteractable.item.label}${busCrowdText} • ${formatDistanceMeters(nearestInteractable.distance)} para interagir.`
      );
    } else {
      setStatus(
        `WASD ou setas para mover. E para interagir. • ${atmosphereSnapshot.clock} ${atmosphereSnapshot.label}${weatherText}`
      );
    }
    clearSpeech();
    return;
  }

  if (target.lines) {
    if (speechEl && speechEl.dataset.locked !== "1") {
      showSpeech(target.previewLine, target.name, "[E] falar");
    }
    return;
  }

  const crowdText = target.kind === "bus" && target.crowdLabel ? ` • ${target.crowdLabel}` : "";
  setStatus(`${target.label}${crowdText} • ${formatDistanceMeters(getDistance2D(player.position, target.position))}`);
  clearSpeech();
}

function syncEntityVisibility() {
  for (const npc of npcs) {
    updateRenderableVisibility(npc.group, 1.8, Math.min(npc.renderRadius, ENTITY_CULL_DIST.npc));
  }
  for (const duck of ducks) {
    updateRenderableVisibility(duck.group, 1.4, ENTITY_CULL_DIST.duck);
  }
  for (const pigeon of pigeons) {
    updateRenderableVisibility(pigeon.group, 1.0, ENTITY_CULL_DIST.pigeon);
  }
  for (const bus of buses) {
    updateRenderableVisibility(bus.group, 2.4, ENTITY_CULL_DIST.bus);
  }
  for (const item of interactables) {
    updateRenderableVisibility(item.root || item.group || item, 2.2, ENTITY_CULL_DIST.interactable);
  }
  for (const r of remotePlayers.values()) {
    updateRenderableVisibility(r.group, 1.8, ENTITY_CULL_DIST.remote);
  }
}

function handleInteraction() {
  if (!interactQueued) return;
  interactQueued = false;
  if (playerState.sitting) return;
  const target = getNearestTarget();
  if (!target) {
    if (playerState.ridingBike?.mounted) {
      playerState.ridingBike.dismount?.();
    }
    return;
  }

  if (target.lines) {
    const line = pickRandomLine(target);
    target.previewLine = line;
    target.pause = 1.2;
    target.talkCooldown = 0.5;
    pushBubble({ group: target.group, key: target.bubbleKey }, line, 4.2);
    target.group.rotation.y = lerpAngle(target.group.rotation.y, Math.atan2(player.position.x - target.group.position.x, player.position.z - target.group.position.z), 0.35);
    return;
  }

  if (typeof target.interact === "function") {
    target.interact();
  }
}

const MINIMAP_WORLD = 140;
const MINIMAP_SIZE = 220;
const MINIMAP_SCALE = MINIMAP_SIZE / MINIMAP_WORLD;

function hexFromInt(value) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function worldToMapX(x) {
  return MINIMAP_SIZE / 2 + x * MINIMAP_SCALE;
}

function worldToMapY(z) {
  return MINIMAP_SIZE / 2 + z * MINIMAP_SCALE;
}

function drawMinimap() {
  if (!minimapCtx) return;
  const ctx = minimapCtx;
  const size = MINIMAP_SIZE;
  const half = size / 2;
  const inset = 5;
  const contentInset = 10;

  ctx.clearRect(0, 0, size, size);

  roundedRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, 18);
  const background = ctx.createRadialGradient(half - 8, half - 10, 18, half, half, half);
  background.addColorStop(0, "#8fd46f");
  background.addColorStop(0.56, "#6ea34e");
  background.addColorStop(1, "#4f7c38");
  ctx.fillStyle = background;
  ctx.fill();

  ctx.save();
  roundedRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, 18);
  ctx.clip();

  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i += 1) {
    const x = half + i * 28;
    ctx.beginPath();
    ctx.moveTo(x, contentInset);
    ctx.lineTo(x, size - contentInset);
    ctx.stroke();

    const y = half + i * 28;
    ctx.beginPath();
    ctx.moveTo(contentInset, y);
    ctx.lineTo(size - contentInset, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(38, 66, 37, 0.48)";
  for (const tree of mapFeatures.trees) {
    const mx = worldToMapX(tree.x);
    const my = worldToMapY(tree.z);
    ctx.beginPath();
    ctx.arc(mx, my, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const path of mapFeatures.paths) {
    ctx.save();
    ctx.translate(worldToMapX(path.x), worldToMapY(path.z));
    ctx.rotate(path.rotation || 0);
    const w = path.width * MINIMAP_SCALE;
    const h = path.depth * MINIMAP_SCALE;
    ctx.fillStyle = path.surface === "corridor" ? "#b7ae9c" : "#d1c8b9";
    ctx.strokeStyle = path.surface === "corridor" ? "rgba(78, 69, 57, 0.34)" : "rgba(78, 69, 57, 0.22)";
    ctx.lineWidth = 1;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (path.surface === "corridor") {
      ctx.strokeStyle = "rgba(255, 248, 220, 0.45)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 1, 0);
      ctx.lineTo(w / 2 - 1, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const b of mapFeatures.buildings) {
    const mx = worldToMapX(b.x);
    const my = worldToMapY(b.z);
    const w = b.width * MINIMAP_SCALE;
    const h = b.depth * MINIMAP_SCALE;
    ctx.fillStyle = hexFromInt(b.color);
    ctx.fillRect(mx - w / 2, my - h / 2, w, h);
    ctx.strokeStyle = "rgba(40, 58, 42, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
    ctx.fillStyle = hexFromInt(b.roof);
    ctx.fillRect(mx - w / 2 + 1, my - h / 2 + 1, w - 2, 3);
  }

  ctx.fillStyle = "#f7d36a";
  for (const item of interactables) {
    if (!isInteractableAvailableForPlayer(item)) continue;
    const mx = worldToMapX(item.position.x);
    const my = worldToMapY(item.position.z);
    ctx.beginPath();
    ctx.moveTo(mx, my - 3.2);
    ctx.lineTo(mx + 3.2, my);
    ctx.lineTo(mx, my + 3.2);
    ctx.lineTo(mx - 3.2, my);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (const r of remotePlayers.values()) {
    const rmx = worldToMapX(r.group.position.x);
    const rmy = worldToMapY(r.group.position.z);
    ctx.fillStyle = r.mapColor || "#ffe28f";
    ctx.strokeStyle = "rgba(255, 248, 220, 0.7)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(rmx, rmy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const npc of npcs) {
    const mx = worldToMapX(npc.group.position.x);
    const my = worldToMapY(npc.group.position.z);
    ctx.fillStyle = npc.mapColor || "#ffffff";
    ctx.beginPath();
    ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (const duck of ducks) {
    const mx = worldToMapX(duck.group.position.x);
    const my = worldToMapY(duck.group.position.z);
    ctx.fillStyle = duck.mapColor;
    ctx.beginPath();
    ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (const pigeon of pigeons) {
    const mx = worldToMapX(pigeon.group.position.x);
    const my = worldToMapY(pigeon.group.position.z);
    ctx.fillStyle = pigeon.mapColor;
    ctx.beginPath();
    ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  for (const bus of buses) {
    const mx = worldToMapX(bus.position.x);
    const my = worldToMapY(bus.position.z);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(-bus.facingYaw);
    ctx.fillStyle = "#23824c";
    ctx.strokeStyle = "#f7f4ea";
    ctx.lineWidth = 1;
    ctx.fillRect(-4, -2.3, 8, 4.6);
    ctx.strokeRect(-4, -2.3, 8, 4.6);
    ctx.restore();
  }

  const pmx = worldToMapX(player.position.x);
  const pmy = worldToMapY(player.position.z);
  const angle = Math.atan2(facing.x, facing.y);

  ctx.save();
  ctx.translate(pmx, pmy);
  ctx.fillStyle = "rgba(98, 255, 159, 0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(pmx, pmy);
  ctx.rotate(-angle);
  ctx.shadowColor = "rgba(98, 255, 159, 0.45)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#62ff9f";
  ctx.strokeStyle = "rgba(17, 46, 27, 0.85)";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(-4.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentInset - 2, contentInset - 2, size - (contentInset - 2) * 2, size - (contentInset - 2) * 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
  ctx.font = "900 11px Nunito, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", size - 22, 22);
  ctx.strokeStyle = "rgba(23, 68, 43, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size - 22, 30);
  ctx.lineTo(size - 22, 44);
  ctx.stroke();

  ctx.restore();
}

function updateCamera() {
  if (cameraMode === "orbit") {
    const orbitCenter = getCameraOrbitCenter();
    const horizontalDistance = Math.cos(cameraOrbitPitch) * cameraOrbitDistance;
    const verticalOffset = Math.sin(cameraOrbitPitch) * cameraOrbitDistance;
    camera.position.set(
      orbitCenter.x + Math.cos(cameraOrbitYaw) * horizontalDistance,
      orbitCenter.y + 4.5 + verticalOffset,
      orbitCenter.z + Math.sin(cameraOrbitYaw) * horizontalDistance
    );
  } else {
    camera.position.set(player.position.x + 14, player.position.y + 18, player.position.z + 14);
  }
  const lookAtTarget = cameraMode === "orbit" && cameraFocusTarget ? getCameraOrbitCenter() : player.position;
  camera.lookAt(lookAtTarget.x, 1.25, lookAtTarget.z);
}

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const resizeHandler = () => resize();
window.addEventListener("resize", resizeHandler);
resize();

let rafId = 0;
let running = true;
let netAccumulator = 0;
let minimapTimer = 0;
const NET_INTERVAL = 0.08; // ~12.5 Hz

function tick() {
  if (!running) return;
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = getWorldTime ? getWorldTime() : clock.elapsedTime;
  const atmosphereState = getAtmosphereState(time);
  const weatherState = getWeatherState(time);
  const combinedState = { ...atmosphereState, weather: weatherState };
  applyAtmosphere(combinedState);
  updateWeatherFX(dt, time, combinedState);
  noticeTexture.update(time, combinedState);
  updateAmbientAudio(time, combinedState);

  releaseSpeechLock(dt);
  updatePlayer(dt, time);
  handleInteraction();

  for (const npc of npcs) {
    if (npcAuthorityActive) updateNpc(npc, dt, time);
    else updateNpcFromSnapshot(npc, dt, time);
  }

  for (const duck of ducks) {
    updateDuck(duck, dt, time);
  }

  for (const pigeon of pigeons) {
    updatePigeon(pigeon, dt, time);
  }

  for (const item of interactables) {
    item.update?.(dt, time);
  }

  for (const prop of decorativeProps) {
    prop.update?.(dt, time);
  }

  updateRemotes(dt, time);
  updateBubbles(dt);

  netAccumulator += dt;
  if (netAccumulator >= NET_INTERVAL) {
    netAccumulator = 0;
    onLocalState({
      x: player.position.x,
      z: player.position.z,
      ry: player.rotation.y,
      speed: playerVelocity.length(),
      activity: playerActivitySnapshot.kind,
      jumpY: playerState.jumpY,
    });
    if (npcAuthorityActive) {
      onNpcState(serializeNpcStates());
    }
    if (playerState.ridingBike?.mounted) {
      const mountedBike = playerState.ridingBike;
      const wheelieAngle = mountedBike.wheelieAmount * 0.52;
      mountedBike.position.set(player.position.x, Math.sin(wheelieAngle) * 0.86, player.position.z);
      mountedBike.group.rotation.x = -wheelieAngle;
      mountedBike.group.rotation.y = player.rotation.y;
      playerState.ridingBike.emitState?.(true);
    }
  }

  updateInteractionUI();
  updateCamera();
  refreshCameraFrustum();
  syncEntityVisibility();
  updateDevSelectionBox();
  minimapTimer += dt;
  if (minimapTimer >= 0.1) {
    minimapTimer = 0;
    drawMinimap();
  }
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(tick);
}

tick();

function destroy() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  ambientAudioEnabled = false;
  window.removeEventListener("keydown", keydownHandler);
  window.removeEventListener("keyup", keyupHandler);
  window.removeEventListener("mousedown", mousedownHandler);
  window.removeEventListener("mousemove", mousemoveHandler);
  window.removeEventListener("mouseup", mouseupHandler);
  window.removeEventListener("contextmenu", contextmenuHandler);
  window.removeEventListener("wheel", wheelHandler);
  window.removeEventListener("blur", blurHandler);
  window.removeEventListener("blur", resetCameraDrag);
  window.removeEventListener("resize", resizeHandler);
  window.removeEventListener("error", errorHandler);
  devOverlay.remove();
  scene.remove(devSelectionBox);
  disposeObject3D(devSelectionBox);
  stopAudioNode(audioWindSource);
  stopAudioNode(audioMurmurSource);
  audioWindSource = null;
  audioWindFilter = null;
  audioWindGain = null;
  audioMurmurSource = null;
  audioMurmurFilter = null;
  audioMurmurGain = null;
  audioNextBirdAt = 0;
  if (audioContext) {
    audioContext.close?.().catch(() => {});
  }
  audioContext = null;
  audioMasterGain = null;
  disposeObject3D(scene);
  renderer.dispose?.();
}

  return {
    destroy,
    addRemotePlayer,
    updateRemotePlayer,
    removeRemotePlayer,
    setNpcAuthority,
    applyNpcSnapshots,
    setRemoteNick,
    setLocalNick,
    updateSharedEntity,
    pushChatBubble,
    pushReactionBubble,
    triggerLocalEmote,
    triggerReaction,
    triggerRemoteEmote,
    triggerRemoteReaction,
    toggleAmbientAudio,
    setMobileInput,
    queueMobileInteract,
    queueMobileJump,
    toggleCameraMode
  };
}

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}
