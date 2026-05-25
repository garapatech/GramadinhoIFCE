"use client";

import { useEffect, useState } from "react";
import { readStoredAvatar, writeStoredAvatar, type Avatar } from "@/features/avatar/avatarConfig";

export function useStoredAvatar() {
  const [avatar, setAvatar] = useState<Avatar>(readStoredAvatar);

  useEffect(() => {
    writeStoredAvatar(avatar);
  }, [avatar]);

  return [avatar, setAvatar] as const;
}
