export type EmoteKind =
  | "dance"
  | "laugh"
  | "sixseven"
  | "wave"
  | "point"
  | "cheer"
  | "glitch"
  | "stop";

export type EmoteChip = {
  kind: Exclude<EmoteKind, "stop">;
  label: string;
  short: string;
  glyph: string;
};

export const emoteBar = [
  { kind: "dance", label: "Dançar", short: "G", glyph: "🕺" },
  { kind: "laugh", label: "Rir", short: "1", glyph: "😂" },
  { kind: "sixseven", label: "67", short: "2", glyph: "🤲" },
  { kind: "wave", label: "Acenar", short: "3", glyph: "👋" },
  { kind: "point", label: "Apontar", short: "4", glyph: "👉" },
  { kind: "cheer", label: "Comemorar", short: "5", glyph: "🎉" },
] as const satisfies readonly EmoteChip[];

const emoteDurations: Record<EmoteKind, number> = {
  dance: 8.0,
  laugh: 2.4,
  sixseven: 3.4,
  wave: 2.4,
  point: 2.4,
  cheer: 3.2,
  glitch: 2.2,
  stop: 0,
};

export function getEmoteDuration(kind: EmoteKind) {
  return emoteDurations[kind] ?? 2.4;
}
