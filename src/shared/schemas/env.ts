import { z } from "zod";

export const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_PARTYKIT_HOST: z.string().trim().min(1).optional(),
    NEXT_PUBLIC_RTC_ICE_SERVERS: z.string().trim().min(1).optional(),
  })
  .strict();

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export const DEFAULT_PARTYKIT_HOST = "127.0.0.1:1999";

function pickPublicEnv(raw: Record<string, unknown>) {
  return {
    NEXT_PUBLIC_PARTYKIT_HOST: raw.NEXT_PUBLIC_PARTYKIT_HOST,
    NEXT_PUBLIC_RTC_ICE_SERVERS: raw.NEXT_PUBLIC_RTC_ICE_SERVERS,
  };
}

export function readPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse(pickPublicEnv(process.env));
  return parsed.success ? parsed.data : {};
}

