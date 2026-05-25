import { z } from "zod";
import { nickSchema } from "@/shared/schemas/nick";

export const GAME_ROUTE_DEFAULT_NICK = "Visitante";
export const gameRouteQuerySchema = z
  .object({
    nick: nickSchema.optional(),
  })
  .strict();

export type GameRouteQuery = z.infer<typeof gameRouteQuerySchema>;

function readSearchParam(searchParams, key) {
  if (!searchParams || typeof searchParams.get !== "function") return undefined;
  const value = searchParams.get(key);
  return value === null ? undefined : value;
}

export function readGameRouteNick(searchParams) {
  const parsed = gameRouteQuerySchema.safeParse({
    nick: readSearchParam(searchParams, "nick"),
  });

  return parsed.success ? parsed.data.nick || GAME_ROUTE_DEFAULT_NICK : GAME_ROUTE_DEFAULT_NICK;
}
