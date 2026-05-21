import type { CampusSurface } from "@/game/world/campusLayout";

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

const rand = (min, max) => min + Math.random() * (max - min);

const isAudioRunning = () => !!audioContext && audioContext.state === "running" && !!audioMasterGain;

export function resetGameAudio() {
  ambientAudioEnabled = true;
  audioNextBirdAt = 0;
  audioNextRadioAt = 0;
  audioFootstepSide = 1;
}

export function readAmbientAudioState() {
  return {
    enabled: ambientAudioEnabled,
    label: ambientAudioEnabled ? "ativo" : "desligado",
  };
}

function disconnectAudioNode(node) {
  if (!node) return;
  try {
    node.disconnect?.();
  } catch {}
}

function disconnectAudioNodes(...nodes) {
  for (const node of nodes) {
    disconnectAudioNode(node);
  }
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

export function ensureAmbientAudio() {
  if (!ambientAudioEnabled) return false;
  if (!audioContext) {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
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
    disconnectAudioNodes(osc, filter, gain);
  };
}

function getFootstepSoundConfig(surface: CampusSurface) {
  if (surface === "corridor") {
    return { filterType: "bandpass", frequency: 920, q: 1.15, duration: 0.16, noiseGain: 0.013, thumpGain: 0.01, thumpFrequency: 124, highpass: 240 };
  }

  if (surface === "cement") {
    return { filterType: "highpass", frequency: 1450, q: 0.55, duration: 0.11, noiseGain: 0.016, thumpGain: 0.014, thumpFrequency: 92, highpass: 340 };
  }

  return { filterType: "bandpass", frequency: 560, q: 0.82, duration: 0.15, noiseGain: 0.011, thumpGain: 0.008, thumpFrequency: 108, highpass: 180 };
}

export function playFootstepSound(surface: CampusSurface, running = false) {
  if (!ambientAudioEnabled || !isAudioRunning()) return;

  const now = audioContext.currentTime;
  const config = getFootstepSoundConfig(surface);

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
    disconnectAudioNodes(stepSource, stepFilter, stepGain);
    if (pan) disconnectAudioNode(pan);
  };
  thump.onended = () => {
    disconnectAudioNodes(thump, thumpGain);
  };
}

export function playBusArrivalSound(strength = 1) {
  if (!ambientAudioEnabled || !isAudioRunning()) return;

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
    disconnectAudioNodes(rumble, rumbleFilter, busGain);
    if (pan) disconnectAudioNode(pan);
  };
  hiss.onended = () => {
    disconnectAudioNodes(hiss, hissFilter, hissGain);
  };
}

export function playPoolWaterSound(strength = 0.45) {
  if (!ambientAudioEnabled || !isAudioRunning()) return;

  const now = audioContext.currentTime;
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(audioContext, 0.42);

  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 620 + strength * 430;
  filter.Q.value = 0.62;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.006 + strength * 0.012, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  source.start(now);
  source.stop(now + 0.46);
  source.onended = () => {
    disconnectAudioNodes(source, filter, gain);
  };
}

export function playSwimStrokeSound(strength = 0.5) {
  if (!ambientAudioEnabled || !isAudioRunning()) return;
  playPoolWaterSound(0.72 + strength * 0.35);
}

export function playParanormalSound(strength = 0.5) {
  if (!ambientAudioEnabled || !isAudioRunning()) return;

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.011 + strength * 0.028, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

  const low = audioContext.createOscillator();
  low.type = "sawtooth";
  low.frequency.setValueAtTime(43 + strength * 12, now);
  low.frequency.exponentialRampToValueAtTime(31 + strength * 8, now + 1.0);

  const bend = audioContext.createOscillator();
  bend.type = "sine";
  bend.frequency.setValueAtTime(212 + Math.random() * 90, now);
  bend.frequency.exponentialRampToValueAtTime(96 + Math.random() * 32, now + 0.72);

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380 + strength * 160;
  filter.Q.value = 1.6;

  low.connect(filter);
  bend.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  low.start(now);
  bend.start(now + 0.03);
  low.stop(now + 1.25);
  bend.stop(now + 0.95);
  low.onended = () => {
    disconnectAudioNodes(low, bend, filter, gain);
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
    gain.gain.exponentialRampToValueAtTime(0.01 + intensity * 0.004, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durations[i]);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioMasterGain);
    osc.start(start);
    osc.stop(start + durations[i] + 0.02);

    osc.onended = () => {
      disconnectAudioNodes(osc, filter, gain);
    };

    start += durations[i] + 0.035;
  }
}

export function updateAmbientAudio(time, state) {
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

export function setAmbientAudioEnabled(nextEnabled) {
  ambientAudioEnabled = !!nextEnabled;
  if (ambientAudioEnabled) {
    ensureAmbientAudio();
    if (audioMasterGain && audioContext) {
      audioMasterGain.gain.setTargetAtTime(0.42, audioContext.currentTime, 0.08);
    }
  } else if (audioMasterGain && audioContext) {
    audioMasterGain.gain.setTargetAtTime(0.0, audioContext.currentTime, 0.08);
  }
}

export function toggleAmbientAudio() {
  setAmbientAudioEnabled(!ambientAudioEnabled);
  return ambientAudioEnabled;
}

export function destroyGameAudio() {
  ambientAudioEnabled = false;
  stopAudioNode(audioWindSource);
  stopAudioNode(audioMurmurSource);
  stopAudioNode(audioRadioSource);
  audioWindSource = null;
  audioWindFilter = null;
  audioWindGain = null;
  audioMurmurSource = null;
  audioMurmurFilter = null;
  audioMurmurGain = null;
  audioRadioSource = null;
  audioRadioFilter = null;
  audioRadioGain = null;
  audioNextBirdAt = 0;
  audioNextRadioAt = 0;
  if (audioContext) {
    audioContext.close?.().catch(() => {});
  }
  audioContext = null;
  audioMasterGain = null;
}
