import * as THREE from "three";
import { avatarToGameAppearance, type Avatar } from "@/features/avatar/avatarConfig";
import { disposeObject3D } from "@/game/disposeObject3D";

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
  materials: {
    skin: THREE.MeshStandardMaterial;
    shirt: THREE.MeshStandardMaterial;
    shirtFront: THREE.MeshStandardMaterial;
    pants: THREE.MeshStandardMaterial;
    shoes: THREE.MeshStandardMaterial;
    backpack: THREE.MeshStandardMaterial;
    hair: THREE.MeshStandardMaterial;
    brow: THREE.MeshStandardMaterial;
    nose: THREE.MeshStandardMaterial;
    mouth: THREE.MeshStandardMaterial;
    cheek: THREE.MeshStandardMaterial;
  };
  accessories: {
    backpack: THREE.Group;
    glasses: THREE.Group;
  };
};

function markCastShadow(root: THREE.Object3D) {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      (obj as THREE.Mesh).castShadow = true;
    }
  });
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
    accentColor,
    hairStyle,
    outfitStyle,
    faceStyle,
    headShape,
    accessory,
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
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.76 });

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
  if (outfitStyle === "sport") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, 0.045), accentMat);
    stripe.position.set(0, 0.48, 0.36);
    torso.add(stripe);
  } else if (outfitStyle === "jacket") {
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.58, 0.045), accentMat);
      lapel.position.set(side * 0.13, 0.5, 0.365);
      lapel.rotation.z = side * 0.16;
      torso.add(lapel);
    }
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 18), shirtMat);
  collar.position.y = 0.92;
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.2, 0.78, 1);
  torso.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skinMat);
  neck.position.y = 1.02;
  torso.add(neck);

  const backpackGroup = new THREE.Group();
  backpackGroup.visible = backpack;
  torso.add(backpackGroup);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.22), backpackMat);
  pack.position.set(0, 0.5, -0.34);
  pack.castShadow = true;
  backpackGroup.add(pack);
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.08), backpackMat);
  strapL.position.set(-0.2, 0.55, -0.2);
  backpackGroup.add(strapL);
  const strapR = strapL.clone();
  strapR.position.x = 0.2;
  backpackGroup.add(strapR);

  const head = new THREE.Group();
  head.position.set(0, 1.16, 0.02);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.39, 26, 24), skinMat);
  if (headShape === "oval") skull.scale.set(0.94, 1.18, 0.92);
  else if (headShape === "wide") skull.scale.set(1.13, 1.02, 0.96);
  else skull.scale.set(1.02, 1.08, 0.95);
  skull.castShadow = true;
  head.add(skull);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.405, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.86),
    hairMat
  );
  hair.position.set(0, 0.15, -0.035);
  hair.scale.set(1.04, 0.78, 1.02);
  hair.visible = hairStyle === "short" || hairStyle === "bun";
  head.add(hair);

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), hairMat);
  hairBack.position.set(0, -0.08, -0.27);
  hairBack.scale.set(1.18, 1.08, 0.82);
  hairBack.visible = hairStyle === "short" || hairStyle === "bun";
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
    bang.visible = hairStyle === "short" || hairStyle === "bun";
    head.add(bang);
  }

  if (hairStyle === "curly") {
    for (const [x, y, z] of [[-0.27, .2, 0], [-.12, .33, .02], [.05, .35, 0], [.22, .28, 0], [.3, .09, -.05], [-.3, .05, -.05], [0, .27, -.28]]) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(.135, 12, 10), hairMat);
      curl.position.set(x, y, z);
      head.add(curl);
    }
  } else if (hairStyle === "mohawk") {
    for (let index = 0; index < 5; index += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(.1, .3, 10), hairMat);
      spike.position.set(0, .37, -.2 + index * .1);
      head.add(spike);
    }
  } else if (hairStyle === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(.19, 16, 14), hairMat);
    bun.position.set(0, .2, -.36);
    head.add(bun);
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
  if (faceStyle === "smile") mouth.scale.set(1.28, .9, 1);
  head.add(mouth);
  if (faceStyle === "freckles") {
    const freckleMat = new THREE.MeshBasicMaterial({ color: 0x8a573f });
    for (const side of [-1, 1]) for (let index = 0; index < 3; index += 1) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 5), freckleMat);
      dot.position.set(side * (.13 + index * .035), -.05 + (index % 2) * .025, .385);
      head.add(dot);
    }
  }

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

  const glassesGroup = new THREE.Group();
  glassesGroup.visible = glasses;
  head.add(glassesGroup);

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
  glassesGroup.add(leftLens);
  const rightLens = leftLens.clone();
  rightLens.position.x = 0.12;
  glassesGroup.add(rightLens);
  const innerGeo = new THREE.CircleGeometry(0.082, 16);
  const leftGlass = new THREE.Mesh(innerGeo, lensMat);
  leftGlass.position.set(-0.13, 0.06, 0.367);
  glassesGroup.add(leftGlass);
  const rightGlass = leftGlass.clone();
  rightGlass.position.x = 0.12;
  glassesGroup.add(rightGlass);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), frameMat);
  bridge.position.set(0, 0.06, 0.365);
  glassesGroup.add(bridge);

  if (accessory === "headphones") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.36, .035, 8, 24, Math.PI), accentMat);
    band.position.set(0, .08, -.02);
    band.rotation.z = Math.PI;
    head.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .07, 14), accentMat);
      cup.position.set(side * .37, 0, 0);
      cup.rotation.z = Math.PI / 2;
      head.add(cup);
    }
  } else if (accessory === "cap") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.415, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
    cap.position.y = .18;
    cap.scale.y = .62;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(.34, .035, .22), accentMat);
    brim.position.set(0, .2, .36);
    head.add(brim);
  } else if (accessory === "beanie") {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(.42, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.7), accentMat);
    beanie.position.y = .18;
    beanie.scale.y = .8;
    head.add(beanie);
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
    materials: {
      skin: skinMat,
      shirt: shirtMat,
      shirtFront: shirtFront.material as THREE.MeshStandardMaterial,
      pants: pantsMat,
      shoes: shoesMat,
      backpack: backpackMat,
      hair: hairMat,
      brow: browMat,
      nose: nose.material as THREE.MeshStandardMaterial,
      mouth: mouthMat,
      cheek: cheekMat,
    },
    accessories: {
      backpack: backpackGroup,
      glasses: glassesGroup,
    },
  };
}

export function buildAvatarPreviewRig(avatar: Avatar): AvatarPreviewRig {
  return buildCharacter(avatarToGameAppearance(avatar));
}

export function applyAvatarPreviewAppearance(rig: AvatarPreviewRig, avatar: Avatar) {
  const appearance = avatarToGameAppearance(avatar);

  rig.materials.skin.color.setHex(appearance.skinColor);
  rig.materials.shirt.color.setHex(appearance.shirtColor);
  rig.materials.shirtFront.color
    .copy(new THREE.Color(appearance.shirtColor))
    .offsetHSL(0, -0.05, 0.12);
  rig.materials.pants.color.setHex(appearance.pantsColor);
  rig.materials.shoes.color.setHex(appearance.shoesColor);
  rig.materials.backpack.color.setHex(appearance.backpackColor);
  rig.materials.hair.color.setHex(appearance.hairColor);
  rig.materials.brow.color.setHex(appearance.hairColor);
  rig.materials.nose.color.setHex(appearance.skinColor);
  rig.materials.mouth.color.setHex(0x7f3030);
  rig.materials.cheek.color.setHex(0xe08a8a);
  rig.accessories.backpack.visible = appearance.backpack;
  rig.accessories.glasses.visible = appearance.glasses;
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
  disposeObject3D(rig.group);
}
