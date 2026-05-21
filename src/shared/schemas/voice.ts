import { z } from "zod";

export const voiceStatusSchema = z.enum([
  "idle",
  "listening",
  "requesting",
  "connecting",
  "calling",
  "answering",
  "connected",
  "disconnected",
  "blocked",
  "failed",
  "error",
]);

export const voicePeerSnapshotSchema = z
  .object({
    id: z.string().min(1).max(128),
    nick: z.string().min(1).max(16),
    status: voiceStatusSchema,
    hasAudio: z.boolean(),
    autoplayBlocked: z.boolean(),
  })
  .strict();

export const voiceStateSchema = z
  .object({
    supported: z.boolean(),
    ready: z.boolean(),
    enabled: z.boolean(),
    muted: z.boolean(),
    status: voiceStatusSchema,
    error: z.string(),
    peerCount: z.number().int().nonnegative(),
    speakerCount: z.number().int().nonnegative(),
    receivingCount: z.number().int().nonnegative(),
    peers: z.array(voicePeerSnapshotSchema),
  })
  .strict();

export type VoiceStatus = z.infer<typeof voiceStatusSchema>;
export type VoicePeerSnapshot = z.infer<typeof voicePeerSnapshotSchema>;
export type VoiceState = z.infer<typeof voiceStateSchema>;
