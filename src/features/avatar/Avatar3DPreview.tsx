"use client";

import { memo } from "react";
import { ContactShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { Avatar } from "@/features/avatar/avatarConfig";
import { useAvatarPreviewAnimation } from "@/features/avatar/useAvatarPreviewAnimation";
import { useAvatarPreviewRig } from "@/features/avatar/useAvatarPreviewRig";

type Avatar3DPreviewProps = {
  avatar: Avatar;
};

const AvatarPreviewScene = memo(function AvatarPreviewScene({ avatar }: Avatar3DPreviewProps) {
  const rig = useAvatarPreviewRig(avatar);
  useAvatarPreviewAnimation(rig);

  return (
    <>
      <hemisphereLight args={[0xfff3d6, 0x6f9c7b, 0.85]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1} color={0xfff1cd} />
      <directionalLight position={[-3, 2.5, -2.5]} intensity={0.45} color={0xbcd7ff} />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.38}
        scale={4.5}
        blur={2.4}
        far={3.5}
        resolution={256}
      />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.22}
          luminanceThreshold={0.78}
          luminanceSmoothing={0.22}
        />
        <Vignette eskil={false} offset={0.12} darkness={0.28} />
      </EffectComposer>
      <primitive object={rig.group} />
    </>
  );
});

function Avatar3DPreview({ avatar }: Avatar3DPreviewProps) {
  return (
    <div className="avatar-3d-stage" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 26, position: [0, 1.45, 7.2], near: 0.1, far: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <AvatarPreviewScene
          key={`${avatar.hairStyle}-${avatar.outfitStyle}-${avatar.faceStyle}-${avatar.headShape}-${avatar.accessory}-${avatar.accent}`}
          avatar={avatar}
        />
      </Canvas>
    </div>
  );
}

export default memo(Avatar3DPreview);
