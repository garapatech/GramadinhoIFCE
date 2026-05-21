import { atmosphereWeatherStateSchema, type AtmosphereState } from "@/shared/schemas/atmosphere";

export type { AtmosphereState } from "@/shared/schemas/atmosphere";

export const DAY_CYCLE_SECONDS = 360;
export const WEATHER_CYCLE_SECONDS = 480;

export function formatClock(minutes: number) {
  const safe = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const mins = String(Math.floor(safe % 60)).padStart(2, "0");
  return `${hours}:${mins}`;
}

export function getWeatherState(time: number) {
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

  return atmosphereWeatherStateSchema.parse({
    kind,
    label,
    wind,
    rain,
    cloudMix,
  });
}

export function getAtmosphereState(time: number): AtmosphereState {
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

  const weather = getWeatherState(time);

  return {
    clock: formatClock(campusMinutes),
    label,
    mood,
    daylight,
    weatherLabel: weather.label,
    weather,
  };
}

export function getAtmosphereStateKey(state: AtmosphereState) {
  return `${state.clock}|${state.label}|${state.mood}|${state.weather.kind}`;
}
