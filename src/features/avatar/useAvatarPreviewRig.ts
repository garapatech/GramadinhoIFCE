"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { Avatar } from "@/features/avatar/avatarConfig";
import {
  applyAvatarPreviewAppearance,
  buildAvatarPreviewRig,
  disposeAvatarPreviewRig,
} from "@/features/avatar/avatarPreviewRig";

export function useAvatarPreviewRig(avatar: Avatar) {
  const [rig] = useState(() => buildAvatarPreviewRig(avatar));

  useLayoutEffect(() => {
    applyAvatarPreviewAppearance(rig, avatar);
  }, [avatar, rig]);

  useEffect(() => () => disposeAvatarPreviewRig(rig), [rig]);

  return rig;
}
