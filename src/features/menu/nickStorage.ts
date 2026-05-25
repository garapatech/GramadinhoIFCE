import { nickSchema } from "@/shared/schemas/nick";
import { readLocalStorageItem, writeLocalStorageItem } from "@/shared/storage/localStorage";

const STORAGE_KEY = "gramadinho.nick";

export function readStoredNick() {
  const saved = readLocalStorageItem(STORAGE_KEY);
  if (!saved) {
    return "";
  }

  const parsed = nickSchema.safeParse(saved);
  return parsed.success ? parsed.data : "";
}

export function writeStoredNick(nick: string) {
  writeLocalStorageItem(STORAGE_KEY, nick.trim());
}
