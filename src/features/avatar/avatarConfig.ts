import {
  DEFAULT_AVATAR,
  createDefaultAvatar,
  normalizeAvatar,
  parseStoredAvatar,
  serializeStoredAvatar,
  type Avatar,
} from "@/shared/schemas/avatar";

export const AVATAR_STORAGE_KEY = "gramadinho.avatar";

export { DEFAULT_AVATAR, normalizeAvatar, type Avatar };

function hexToInt(hex: string) {
  return Number.parseInt(hex.slice(1), 16);
}

export function getDefaultAvatar(): Avatar {
  return createDefaultAvatar();
}

export function readStoredAvatar(): Avatar {
  if (typeof window === "undefined") {
    return getDefaultAvatar();
  }

  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    return parseStoredAvatar(raw);
  } catch {
    return getDefaultAvatar();
  }
}

export function writeStoredAvatar(avatar: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(AVATAR_STORAGE_KEY, serializeStoredAvatar(avatar));
  } catch {
    // Ignore storage failures; the menu must keep working offline and in private mode.
  }
}

export function avatarToGameAppearance(avatar: unknown) {
  const normalized = normalizeAvatar(avatar);

  return {
    shirtColor: hexToInt(normalized.shirt),
    pantsColor: hexToInt(normalized.pants),
    shoesColor: hexToInt(normalized.shoes),
    skinColor: hexToInt(normalized.skin),
    backpackColor: hexToInt(normalized.backpack),
    hairColor: hexToInt(normalized.hair),
    backpack: normalized.backpackEnabled,
    glasses: normalized.glasses,
    scale: 1,
  };
}
