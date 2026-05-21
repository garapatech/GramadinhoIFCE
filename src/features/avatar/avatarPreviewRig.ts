import * as THREE from "three";
import { avatarToGameAppearance, type Avatar } from "@/features/avatar/avatarConfig";

export type AvatarPreviewRefs = {
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
};

export type AvatarPreviewRig = {
  group: THREE.Group;
  refs: AvatarPreviewRefs;
  disposables: Array<THREE.BufferGeometry | THREE.Material>;
};

function markCastShadow(root: THREE.Object3D) {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      (obj as THREE.Mesh).castShadow = true;
    }
  });
}

function collectDisposables(root: THREE.Object3D) {
  const disposables = new Set<THREE.BufferGeometry | THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) disposables.add(mesh.geometry);
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => disposables.add(material));
      } else {
        disposables.add(mesh.material);
      }
    }
  });

  return Array.from(disposables);
}

function buildCharacter(appearance: ReturnType<typeof avatarToGameAppearance>): AvatarPreviewRig {
  const {
    shirtColor,
    pantsColor,
    shoesColor,
    skinColor,
    backpackColor,
    hairColor,
    backpack,
    glasses,
  } = appearance;

  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.92 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.98 });
  const shoesMat = new THREE.MeshStandardMaterial({ color: shoesColor, roughness: 1 });
  const backpackMat = new THREE.MeshStandardMaterial({ color: backpackColor, roughness: 1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7f3030, roughness: 0.6 });
  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xe08a8a,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
  });

  const torso = new THREE.Group();
  torso.position.set(0, 1.0, 0);
  root.add(torso);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.46, 6, 16), shirtMat);
  body.position.y = 0.45;
  body.scale.set(1.14, 0.92, 0.9);
  body.castShadow = true;
  torso.add(body);

  const shirtFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.62, 0.035),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(shirtColor).offsetHSL(0, -0.05, 0.12).getHex(),
      roughness: 0.92,
    })
  );
  shirtFront.position.set(0, 0.48, 0.33);
  torso.add(shirtFront);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 18), shirtMat);
  collar.position.y = 0.92;
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.2, 0.78, 1);
  torso.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skinMat);
  neck.position.y = 1.02;
  torso.add(neck);

  if (backpack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.22), backpackMat);
    pack.position.set(0, 0.5, -0.34);
    pack.castShadow = true;
    torso.add(pack);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.08), backpackMat);
    strapL.position.set(-0.2, 0.55, -0.2);
    torso.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.2;
    torso.add(strapR);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.16, 0.02);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.39, 26, 24), skinMat);
  skull.scale.set(1.02, 1.08, 0.95);
  skull.castShadow = true;
  head.add(skull);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.405, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.86),
    hairMat
  );
  hair.position.set(0, 0.15, -0.035);
  hair.scale.set(1.04, 0.78, 1.02);
  head.add(hair);

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), hairMat);
  hairBack.position.set(0, -0.08, -0.27);
  hairBack.scale.set(1.18, 1.08, 0.82);
  head.add(hairBack);

  const bangGeo = new THREE.SphereGeometry(0.075, 10, 8);
  for (const [x, y, z, rz, rx] of [
    [-0.22, 0.22, 0.2, 0.18, 0.12],
    [-0.08, 0.25, 0.235, 0.04, 0.08],
    [0.08, 0.25, 0.235, -0.04, 0.08],
    [0.22, 0.22, 0.2, -0.18, 0.12],
  ]) {
    const bang = new THREE.Mesh(bangGeo, hairMat);
    bang.position.set(x, y, z);
    bang.scale.set(1.18, 0.62, 0.55);
    bang.rotation.z = rz;
    bang.rotation.x = rx;
    head.add(bang);
  }

  const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), eyeWhiteMat);
  leftEyeWhite.position.set(-0.135, 0.055, 0.352);
  leftEyeWhite.scale.set(1.06, 0.9, 0.48);
  head.add(leftEyeWhite);
  const rightEyeWhite = leftEyeWhite.clone();
  rightEyeWhite.position.x = 0.12;
  head.add(rightEyeWhite);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 10), eyeMat);
  leftEye.position.set(-0.135, 0.052, 0.402);
  head.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.12;
  head.add(rightEye);

  const browMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.019, 0.018), browMat);
  leftBrow.position.set(-0.135, 0.155, 0.366);
  leftBrow.rotation.z = 0.12;
  head.add(leftBrow);
  const rightBrow = leftBrow.clone();
  rightBrow.position.x = 0.12;
  rightBrow.rotation.z = -0.12;
  head.add(rightBrow);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 8), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.018, 0.392);
  head.add(nose);

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.011, 8, 18, Math.PI), mouthMat);
  mouth.position.set(0, -0.135, 0.392);
  mouth.rotation.x = -0.08;
  mouth.scale.y = 0.72;
  head.add(mouth);

  const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), cheekMat);
  leftCheek.position.set(-0.225, -0.075, 0.335);
  leftCheek.scale.set(1.12, 0.72, 0.32);
  head.add(leftCheek);
  const rightCheek = leftCheek.clone();
  rightCheek.position.x = 0.2;
  head.add(rightCheek);

  const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), skinMat);
  leftEar.scale.set(0.6, 1, 0.4);
  leftEar.position.set(-0.36, -0.01, 0.02);
  head.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.32;
  head.add(rightEar);

  if (glasses) {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.5,
      metalness: 0.4,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xa9d8ef,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    });
    const lensGeo = new THREE.TorusGeometry(0.09, 0.012, 8, 18);
    const leftLens = new THREE.Mesh(lensGeo, frameMat);
    leftLens.position.set(-0.13, 0.06, 0.365);
    head.add(leftLens);
    const rightLens = leftLens.clone();
    rightLens.position.x = 0.12;
    head.add(rightLens);
    const innerGeo = new THREE.CircleGeometry(0.082, 16);
    const leftGlass = new THREE.Mesh(innerGeo, lensMat);
    leftGlass.position.set(-0.13, 0.06, 0.367);
    head.add(leftGlass);
    const rightGlass = leftGlass.clone();
    rightGlass.position.x = 0.12;
    head.add(rightGlass);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), frameMat);
    bridge.position.set(0, 0.06, 0.365);
    head.add(bridge);
  }

  function buildArm(side: "left" | "right") {
    const sign = side === "left" ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.48, 0.88, 0);
    shoulder.rotation.z = sign * 0.12;
    torso.add(shoulder);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), shirtMat);
    shoulder.add(shoulderBall);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 5, 12), shirtMat);
    upperArm.position.y = -0.25;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.48;
    shoulder.add(elbow);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), shirtMat);
    elbowBall.scale.set(1.05, 0.82, 1.05);
    elbow.add(elbowBall);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.36, 5, 12), skinMat);
    forearm.position.y = -0.27;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
    hand.position.y = -0.59;
    hand.scale.set(0.95, 1.12, 0.78);
    elbow.add(hand);

    return { shoulder, elbow };
  }

  function buildLeg(side: "left" | "right") {
    const sign = side === "left" ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.18, 1.05, 0);
    root.add(hip);

    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), pantsMat);
    hip.add(hipBall);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.42, 12), pantsMat);
    thigh.position.y = -0.225;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);

    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), pantsMat);
    knee.add(kneeBall);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 12), pantsMat);
    shin.position.y = -0.225;
    knee.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.5), shoesMat);
    foot.position.set(0, -0.48, 0.1);
    knee.add(foot);

    return { hip, knee };
  }

  const leftArm = buildArm("left");
  const rightArm = buildArm("right");
  const leftLeg = buildLeg("left");
  const rightLeg = buildLeg("right");

  markCastShadow(root);

  return {
    group: root,
    refs: {
      torso,
      head,
      leftShoulder: leftArm.shoulder,
      leftElbow: leftArm.elbow,
      rightShoulder: rightArm.shoulder,
      rightElbow: rightArm.elbow,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee,
    },
    disposables: collectDisposables(root),
  };
}

export function buildAvatarPreviewRig(avatar: Avatar): AvatarPreviewRig {
  return buildCharacter(avatarToGameAppearance(avatar));
}

export function applyAvatarPreviewIdlePose(refs: AvatarPreviewRefs, time: number) {
  const breath = Math.sin(time * 1.6) * 0.05;
  refs.leftShoulder.rotation.x = -0.04 + breath * 0.35;
  refs.rightShoulder.rotation.x = -0.04 - breath * 0.35;
  refs.leftElbow.rotation.x = 0.14 + breath * 0.25;
  refs.rightElbow.rotation.x = 0.14 + breath * 0.25;
  refs.leftHip.rotation.x = 0;
  refs.rightHip.rotation.x = 0;
  refs.leftKnee.rotation.x = 0.05;
  refs.rightKnee.rotation.x = 0.05;
  refs.head.rotation.x = Math.sin(time * 0.8) * 0.04;
  refs.torso.position.y = 1.0 + Math.sin(time * 1.6) * 0.012;
}

export function disposeAvatarPreviewRig(rig: AvatarPreviewRig) {
  rig.disposables.forEach((disposable) => disposable.dispose());
}
