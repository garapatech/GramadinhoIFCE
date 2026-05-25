import { z } from "zod";
import { playerActivitySchema } from "@/shared/schemas/multiplayer";

export const ambientAudioStateSchema = z
  .object({
    enabled: z.boolean(),
    label: z.enum(["ativo", "desligado"]),
  })
  .strict();

export type AmbientAudioState = z.infer<typeof ambientAudioStateSchema>;

export const defaultAmbientAudioState: AmbientAudioState = {
  enabled: true,
  label: "ativo",
};

export const playerStatusStateSchema = z
  .object({
    kind: playerActivitySchema,
    label: z.string().trim().min(1).max(24),
    detail: z.string().trim().min(1).max(80),
  })
  .strict();

export type PlayerStatusState = z.infer<typeof playerStatusStateSchema>;

export const defaultPlayerStatusState: PlayerStatusState = {
  kind: "idle",
  label: "parado",
  detail: "vagando pelo campus",
};
