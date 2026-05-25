"use client";

import { useFrame } from "@react-three/fiber";
import { applyAvatarPreviewIdlePose, type AvatarPreviewRig } from "@/features/avatar/avatarPreviewRig";

export function useAvatarPreviewAnimation(rig: AvatarPreviewRig) {
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    rig.group.rotation.y = Math.sin(time * 0.55) * 0.7;
    applyAvatarPreviewIdlePose(rig.refs, time);
  });
}
