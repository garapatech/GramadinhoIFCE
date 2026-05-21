import { z } from "zod";

export const atmosphereWeatherKindSchema = z.enum(["sol", "nublado", "chuva", "vento"]);

export const atmosphereWeatherStateSchema = z
  .object({
    kind: atmosphereWeatherKindSchema,
    label: z.string().min(1).max(32),
    wind: z.number().finite().min(0),
    rain: z.number().finite().min(0),
    cloudMix: z.number().finite().min(0).max(1),
  })
  .strict();

export const atmosphereStateSchema = z
  .object({
    clock: z.string().min(1).max(8),
    label: z.string().min(1).max(24),
    mood: z.string().min(1).max(24),
    daylight: z.number().finite().min(0).max(1),
    weatherLabel: z.string().min(1).max(32),
    weather: atmosphereWeatherStateSchema,
  })
  .strict();

export type AtmosphereWeatherState = z.infer<typeof atmosphereWeatherStateSchema>;
export type AtmosphereState = z.infer<typeof atmosphereStateSchema>;

export const defaultAtmosphereWeatherState: AtmosphereWeatherState = {
  kind: "sol",
  label: "ensolarado",
  wind: 0.08,
  rain: 0,
  cloudMix: 0,
};

export const defaultAtmosphereState: AtmosphereState = {
  clock: "06:00",
  label: "manhã",
  mood: "claro",
  daylight: 0.82,
  weatherLabel: defaultAtmosphereWeatherState.label,
  weather: defaultAtmosphereWeatherState,
};
