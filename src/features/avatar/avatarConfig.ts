import {
  DEFAULT_AVATAR,
  normalizeAvatar,
  parseStoredAvatar,
  serializeStoredAvatar,
  type Avatar,
} from "@/shared/schemas/avatar";
import { readLocalStorageItem, writeLocalStorageItem } from "@/shared/storage/localStorage";

export const AVATAR_STORAGE_KEY = "gramadinho.avatar";

export { DEFAULT_AVATAR, normalizeAvatar, type Avatar };

function hexToInt(hex: string) {
  return Number.parseInt(hex.slice(1), 16);
}

export function readStoredAvatar(): Avatar {
  return parseStoredAvatar(readLocalStorageItem(AVATAR_STORAGE_KEY));
}

export function writeStoredAvatar(avatar: unknown) {
  writeLocalStorageItem(AVATAR_STORAGE_KEY, serializeStoredAvatar(avatar));
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
    accentColor: hexToInt(normalized.accent),
    backpack: normalized.backpackEnabled,
    glasses: normalized.glasses,
    hairStyle: normalized.hairStyle,
    outfitStyle: normalized.outfitStyle,
    faceStyle: normalized.faceStyle,
    headShape: normalized.headShape,
    accessory: normalized.accessory,
    scale: 1,
  };
}
