import { z } from "zod";

export const NICK_MIN_LENGTH = 2;
export const NICK_MAX_LENGTH = 16;

export const nickSchema = z
  .string()
  .trim()
  .min(NICK_MIN_LENGTH, { message: "Seu nick precisa de pelo menos 2 letras." })
  .max(NICK_MAX_LENGTH, { message: "Nick muito grande (máx. 16 caracteres)." });

export type Nick = z.infer<typeof nickSchema>;
