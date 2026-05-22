import { z } from "zod";

const optionalPublicEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

export const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_PARTYKIT_HOST: optionalPublicEnvString,
    NEXT_PUBLIC_RTC_ICE_SERVERS: optionalPublicEnvString,
  })
  .strict();

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export const DEFAULT_PARTYKIT_HOST = "127.0.0.1:1999";

function pickPublicEnv() {
  return {
    NEXT_PUBLIC_PARTYKIT_HOST: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    NEXT_PUBLIC_RTC_ICE_SERVERS: process.env.NEXT_PUBLIC_RTC_ICE_SERVERS,
  };
}

export function readPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse(pickPublicEnv());
  return parsed.success ? parsed.data : {};
}
