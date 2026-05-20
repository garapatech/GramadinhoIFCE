export const AVATAR_STORAGE_KEY = "gramadinho.avatar";

export const DEFAULT_AVATAR = Object.freeze({
  shirt: "#2f855a",
  pants: "#24364d",
  shoes: "#1a1a1a",
  skin: "#f0c3a5",
  backpack: "#b85a31",
  hair: "#3a2516",
  backpackEnabled: true,
  glasses: false,
});

function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim();
  const match = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return fallback;
  return `#${match[1].toLowerCase()}`;
}

export function normalizeAvatar(input = {}) {
  return {
    shirt: normalizeHexColor(input.shirt, DEFAULT_AVATAR.shirt),
    pants: normalizeHexColor(input.pants, DEFAULT_AVATAR.pants),
    shoes: normalizeHexColor(input.shoes, DEFAULT_AVATAR.shoes),
    skin: normalizeHexColor(input.skin, DEFAULT_AVATAR.skin),
    backpack: normalizeHexColor(input.backpack, DEFAULT_AVATAR.backpack),
    hair: normalizeHexColor(input.hair, DEFAULT_AVATAR.hair),
    backpackEnabled: input.backpackEnabled !== false,
    glasses: input.glasses === true,
  };
}

function cloneAvatar(avatar) {
  return { ...normalizeAvatar(avatar) };
}

export function getDefaultAvatar() {
  return cloneAvatar(DEFAULT_AVATAR);
}

export function readStoredAvatar() {
  if (typeof window === "undefined") {
    return getDefaultAvatar();
  }

  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return getDefaultAvatar();
    return cloneAvatar(JSON.parse(raw));
  } catch {
    return getDefaultAvatar();
  }
}

export function writeStoredAvatar(avatar) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AVATAR_STORAGE_KEY,
      JSON.stringify(normalizeAvatar(avatar))
    );
  } catch {}
}

function hexToInt(hex) {
  return Number.parseInt(hex.slice(1), 16);
}

export function avatarToGameAppearance(avatar) {
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
