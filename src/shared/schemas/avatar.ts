import { z } from "zod";

export const AvatarVersion = 1 as const;

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/)
  .transform((value) => `#${value.replace(/^#/, "").toLowerCase()}`);

export const avatarSchema = z
  .object({
    shirt: hexColorSchema,
    pants: hexColorSchema,
    shoes: hexColorSchema,
    skin: hexColorSchema,
    backpack: hexColorSchema,
    hair: hexColorSchema,
    backpackEnabled: z.boolean(),
    glasses: z.boolean(),
  })
  .strict();

export const avatarStorageSchema = z
  .object({
    version: z.literal(AvatarVersion),
    avatar: avatarSchema,
  })
  .strict();

export type Avatar = z.infer<typeof avatarSchema>;
export type AvatarStorage = z.infer<typeof avatarStorageSchema>;

export const DEFAULT_AVATAR: Avatar = {
  shirt: "#2f855a",
  pants: "#24364d",
  shoes: "#1a1a1a",
  skin: "#f0c3a5",
  backpack: "#b85a31",
  hair: "#3a2516",
  backpackEnabled: true,
  glasses: false,
};

function parseHexColor(value: unknown, fallback: string) {
  const result = hexColorSchema.safeParse(value);
  return result.success ? result.data : fallback;
}

export function normalizeAvatar(input: unknown): Avatar {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    shirt: parseHexColor(source.shirt, DEFAULT_AVATAR.shirt),
    pants: parseHexColor(source.pants, DEFAULT_AVATAR.pants),
    shoes: parseHexColor(source.shoes, DEFAULT_AVATAR.shoes),
    skin: parseHexColor(source.skin, DEFAULT_AVATAR.skin),
    backpack: parseHexColor(source.backpack, DEFAULT_AVATAR.backpack),
    hair: parseHexColor(source.hair, DEFAULT_AVATAR.hair),
    backpackEnabled: source.backpackEnabled !== false,
    glasses: source.glasses === true,
  }
}

export function createDefaultAvatar(): Avatar {
  return { ...DEFAULT_AVATAR };
}

export function parseStoredAvatar(raw: string | null | undefined): Avatar {
  if (!raw) {
    return createDefaultAvatar();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const wrapped = avatarStorageSchema.safeParse(parsed);
    if (wrapped.success) {
      return { ...wrapped.data.avatar };
    }

    return normalizeAvatar(parsed);
  } catch {
    return createDefaultAvatar();
  }
}

export function serializeStoredAvatar(avatar: unknown): string {
  const normalized = normalizeAvatar(avatar);
  const payload: AvatarStorage = {
    version: AvatarVersion,
    avatar: normalized,
  };

  return JSON.stringify(payload);
}
