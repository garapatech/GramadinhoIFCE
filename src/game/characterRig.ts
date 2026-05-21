import * as THREE from "three";

export type CharacterAppearance = {
  shirtColor: number;
  pantsColor: number;
  shoesColor: number;
  skinColor: number;
  backpackColor: number;
  hairColor?: number;
  scale?: number;
  backpack?: boolean;
  glasses?: boolean;
};

export type CharacterRigRefs = {
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

export type CharacterRig = {
  group: THREE.Group;
  refs: CharacterRigRefs;
};

export function createCharacter({
  shirtColor,
  pantsColor,
  shoesColor,
  skinColor,
  backpackColor,
  hairColor = 0x3a2516,
  scale = 1,
  backpack = true,
  glasses = false,
}: CharacterAppearance): CharacterRig {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const faceMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.96 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.98 });
  const shoes = new THREE.MeshStandardMaterial({ color: shoesColor, roughness: 1 });
  const backpackMat = new THREE.MeshStandardMaterial({ color: backpackColor, roughness: 1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });

  const torso = new THREE.Group();
  torso.position.set(0, 1, 0);
  root.add(torso);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.46, 6, 16), shirt);
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

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 18), shirt);
  collar.position.y = 0.92;
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.2, 0.78, 1);
  torso.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skin);
  neck.position.y = 1.02;
  neck.castShadow = true;
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

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.39, 26, 24), skin);
  skull.scale.set(1.02, 1.08, 0.95);
  skull.castShadow = true;
  head.add(skull);

  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), faceMat);
  facePatch.position.set(0, -0.04, 0.21);
  facePatch.scale.set(0.95, 1.05, 0.46);
  facePatch.castShadow = false;
  head.add(facePatch);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.405, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.86),
    hairMat
  );
  hair.position.set(0, 0.15, -0.035);
  hair.scale.set(1.04, 0.78, 1.02);
  hair.castShadow = true;
  head.add(hair);

  const bangGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const bangData = [
    [-0.22, 0.22, 0.2, 0.18, 0.12],
    [-0.08, 0.25, 0.235, 0.04, 0.08],
    [0.08, 0.25, 0.235, -0.04, 0.08],
    [0.22, 0.22, 0.2, -0.18, 0.12],
  ];
  for (const [x, y, z, rz, rx] of bangData) {
    const bang = new THREE.Mesh(bangGeo, hairMat);
    bang.position.set(x, y, z);
    bang.scale.set(1.18, 0.62, 0.55);
    bang.rotation.z = rz;
    bang.rotation.x = rx;
    bang.castShadow = true;
    head.add(bang);
  }

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), hairMat);
  hairBack.position.set(0, -0.08, -0.27);
  hairBack.scale.set(1.18, 1.08, 0.82);
  head.add(hairBack);

  const leftSideHair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMat);
  leftSideHair.position.set(-0.34, 0.02, -0.02);
  leftSideHair.scale.set(0.58, 1.22, 0.72);
  head.add(leftSideHair);
  const rightSideHair = leftSideHair.clone();
  rightSideHair.position.x = 0.28;
  head.add(rightSideHair);

  const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), skin);
  leftEar.scale.set(0.6, 1, 0.4);
  leftEar.position.set(-0.36, -0.01, 0.02);
  head.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.32;
  head.add(rightEar);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
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
  const leftSpark = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), eyeWhiteMat);
  leftSpark.position.set(-0.146, 0.067, 0.428);
  head.add(leftSpark);
  const rightSpark = leftSpark.clone();
  rightSpark.position.x = 0.115;
  head.add(rightSpark);

  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.019, 0.018), browMat);
  leftBrow.position.set(-0.135, 0.155, 0.366);
  leftBrow.rotation.z = 0.12;
  head.add(leftBrow);
  const rightBrow = leftBrow.clone();
  rightBrow.position.x = 0.12;
  rightBrow.rotation.z = -0.12;
  head.add(rightBrow);

  const noseMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 1 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 8), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.018, 0.392);
  head.add(nose);

  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7f3030, roughness: 0.6 });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.011, 8, 18, Math.PI), mouthMat);
  mouth.position.set(0, -0.135, 0.392);
  mouth.rotation.x = -0.08;
  mouth.scale.y = 0.72;
  head.add(mouth);

  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xe08a8a,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
  });
  const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), cheekMat);
  leftCheek.position.set(-0.225, -0.075, 0.335);
  leftCheek.scale.set(1.12, 0.72, 0.32);
  head.add(leftCheek);
  const rightCheek = leftCheek.clone();
  rightCheek.position.x = 0.2;
  head.add(rightCheek);

  if (glasses) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 });
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

    const templeGeo = new THREE.BoxGeometry(0.16, 0.012, 0.012);
    const leftTemple = new THREE.Mesh(templeGeo, frameMat);
    leftTemple.position.set(-0.25, 0.06, 0.25);
    leftTemple.rotation.y = 0.4;
    head.add(leftTemple);
    const rightTemple = leftTemple.clone();
    rightTemple.position.x = 0.22;
    rightTemple.rotation.y = -0.4;
    head.add(rightTemple);
  }

  function buildArm(side: "left" | "right") {
    const sign = side === "left" ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.48, 0.88, 0);
    shoulder.rotation.z = sign * 0.12;
    shoulder.rotation.x = -0.03;
    torso.add(shoulder);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), shirt);
    shoulderBall.castShadow = true;
    shoulder.add(shoulderBall);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 5, 12), shirt);
    upperArm.position.y = -0.25;
    upperArm.rotation.z = sign * 0.02;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.48;
    shoulder.add(elbow);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), shirt);
    elbowBall.scale.set(1.05, 0.82, 1.05);
    elbowBall.castShadow = true;
    elbow.add(elbowBall);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.36, 5, 12), skin);
    forearm.position.y = -0.27;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.073, 10, 8), skin);
    wrist.position.y = -0.49;
    wrist.scale.set(1, 0.8, 1);
    elbow.add(wrist);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
    hand.position.y = -0.59;
    hand.scale.set(0.95, 1.12, 0.78);
    hand.castShadow = true;
    elbow.add(hand);

    for (const x of [-0.045, 0, 0.045]) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.065, 3, 6), skin);
      finger.position.set(x, -0.68, 0.02);
      finger.castShadow = true;
      elbow.add(finger);
    }

    return { shoulder, elbow };
  }

  const leftArm = buildArm("left");
  const rightArm = buildArm("right");

  function buildLeg(side: "left" | "right") {
    const sign = side === "left" ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.18, 1.05, 0);
    root.add(hip);

    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), pants);
    hipBall.castShadow = true;
    hip.add(hipBall);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.42, 12), pants);
    thigh.position.y = -0.225;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);

    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), pants);
    kneeBall.castShadow = true;
    knee.add(kneeBall);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 12), pants);
    shin.position.y = -0.225;
    shin.castShadow = true;
    knee.add(shin);

    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pants);
    ankle.position.y = -0.44;
    ankle.scale.set(1, 0.72, 1);
    ankle.castShadow = true;
    knee.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.5), shoes);
    foot.position.set(0, -0.48, 0.1);
    foot.castShadow = true;
    knee.add(foot);

    const heelCap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), shoes);
    heelCap.position.set(0, -0.47, -0.1);
    heelCap.scale.set(1.2, 0.7, 0.9);
    knee.add(heelCap);

    return { hip, knee };
  }

  const leftLeg = buildLeg("left");
  const rightLeg = buildLeg("right");

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
  };
}

export function animateWalk(refs: CharacterRigRefs, walkPhase: number, intensity: number) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const armSwing = Math.sin(walkPhase) * 1.0 * k;
  const legSwing = Math.sin(walkPhase) * 0.85 * k;

  refs.leftShoulder.rotation.x = -0.03;
  refs.rightShoulder.rotation.x = -0.03;
  refs.leftShoulder.rotation.z = -0.01;
  refs.rightShoulder.rotation.z = 0.01;
  refs.leftElbow.rotation.x = 0.1 + armSwing * 0.82;
  refs.rightElbow.rotation.x = 0.1 - armSwing * 0.82;

  refs.leftHip.rotation.x = -legSwing;
  refs.rightHip.rotation.x = legSwing;
  refs.leftKnee.rotation.x = Math.max(0, legSwing) * 1.2;
  refs.rightKnee.rotation.x = Math.max(0, -legSwing) * 1.2;

  refs.torso.rotation.y = -armSwing * 0.14;
  refs.head.rotation.y = armSwing * 0.07;
  refs.head.rotation.x = Math.sin(walkPhase * 2) * 0.05;
}

export function setRestPose(refs: CharacterRigRefs, time: number, offset = 0) {
  const breath = Math.sin(time * 1.6 + offset) * 0.05;
  refs.leftShoulder.rotation.x = -0.04 + breath * 0.35;
  refs.rightShoulder.rotation.x = -0.04 - breath * 0.35;
  refs.leftElbow.rotation.x = 0.14 + breath * 0.25;
  refs.rightElbow.rotation.x = 0.14 + breath * 0.25;
  refs.leftHip.rotation.x = 0;
  refs.rightHip.rotation.x = 0;
  refs.leftKnee.rotation.x = 0.05;
  refs.rightKnee.rotation.x = 0.05;
  refs.torso.rotation.y = Math.sin(time * 0.6 + offset) * 0.04;
  refs.head.rotation.y = Math.sin(time * 0.5 + offset * 1.3) * 0.18;
  refs.head.rotation.x = Math.sin(time * 0.8 + offset) * 0.04;
}

export function animateCelebrate(refs: CharacterRigRefs, time: number, intensity = 1) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const bounce = Math.sin(time * 7.5) * 0.18 * k;
  const armLift = 1.05 + Math.abs(Math.sin(time * 6.5)) * 0.4 * k;
  refs.leftShoulder.rotation.x = -0.88 - bounce;
  refs.rightShoulder.rotation.x = -0.88 - bounce;
  refs.leftShoulder.rotation.z = 0.22 + Math.sin(time * 4.2) * 0.12 * k;
  refs.rightShoulder.rotation.z = -0.22 - Math.sin(time * 4.2) * 0.12 * k;
  refs.leftElbow.rotation.x = armLift;
  refs.rightElbow.rotation.x = armLift;
  refs.leftElbow.rotation.z = Math.sin(time * 5.1) * 0.08 * k;
  refs.rightElbow.rotation.z = -Math.sin(time * 5.1) * 0.08 * k;
  refs.leftHip.rotation.x = bounce * 0.15;
  refs.rightHip.rotation.x = bounce * 0.15;
  refs.leftKnee.rotation.x = 0.15 + Math.max(0, bounce) * 0.45;
  refs.rightKnee.rotation.x = 0.15 + Math.max(0, bounce) * 0.45;
  refs.torso.rotation.x = 0.1 + bounce * 0.45;
  refs.torso.rotation.y = Math.sin(time * 3.8) * 0.18 * k;
  refs.head.rotation.x = -0.08 + Math.sin(time * 8.2) * 0.04 * k;
  refs.head.rotation.y = Math.sin(time * 3.8) * 0.14 * k;
  refs.head.rotation.z = Math.sin(time * 6.9) * 0.1 * k;
}

export function setSittingPose(refs: CharacterRigRefs) {
  refs.leftShoulder.rotation.x = -0.08;
  refs.rightShoulder.rotation.x = -0.08;
  refs.leftElbow.rotation.x = 0.42;
  refs.rightElbow.rotation.x = 0.42;
  refs.leftHip.rotation.x = -Math.PI / 2.2;
  refs.rightHip.rotation.x = -Math.PI / 2.2;
  refs.leftKnee.rotation.x = Math.PI / 2.3;
  refs.rightKnee.rotation.x = Math.PI / 2.3;
  refs.torso.rotation.y = 0;
  refs.head.rotation.x = -0.05;
  refs.head.rotation.y = 0;
}

export function animateRun(refs: CharacterRigRefs, walkPhase: number, intensity: number) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const armSwing = Math.sin(walkPhase) * 1.6 * k;
  const legSwing = Math.sin(walkPhase) * 1.35 * k;
  refs.leftShoulder.rotation.x = -0.08;
  refs.rightShoulder.rotation.x = -0.08;
  refs.leftShoulder.rotation.z = 0.1;
  refs.rightShoulder.rotation.z = -0.1;
  refs.leftElbow.rotation.x = 0.45 + armSwing * 1.35;
  refs.rightElbow.rotation.x = 0.45 - armSwing * 1.35;
  refs.leftElbow.rotation.z = 0.03;
  refs.rightElbow.rotation.z = -0.03;
  refs.leftHip.rotation.x = -legSwing;
  refs.rightHip.rotation.x = legSwing;
  refs.leftKnee.rotation.x = Math.max(0, legSwing) * 1.7;
  refs.rightKnee.rotation.x = Math.max(0, -legSwing) * 1.7;
  refs.torso.rotation.x = 0.12 * k;
  refs.torso.rotation.y = -armSwing * 0.12;
  refs.head.rotation.x = 0.02 - Math.sin(walkPhase * 2) * 0.03;
  refs.head.rotation.y = armSwing * 0.05;
}

export function setCrouchPose(refs: CharacterRigRefs, time: number, intensity: number) {
  const wobble = Math.sin(time * 6) * 0.06 * intensity;
  refs.leftShoulder.rotation.x = 0.12 + wobble;
  refs.rightShoulder.rotation.x = 0.12 - wobble;
  refs.leftElbow.rotation.x = 0.88;
  refs.rightElbow.rotation.x = 0.88;
  refs.leftHip.rotation.x = -0.9 - wobble * 0.4;
  refs.rightHip.rotation.x = -0.9 + wobble * 0.4;
  refs.leftKnee.rotation.x = 1.6;
  refs.rightKnee.rotation.x = 1.6;
  refs.torso.rotation.x = 0.35;
  refs.torso.rotation.y = wobble * 0.3;
  refs.head.rotation.x = -0.15;
  refs.head.rotation.y = wobble * 0.3;
}

export function resetRigPose(refs: CharacterRigRefs) {
  for (const obj of Object.values(refs)) {
    if (obj && obj.rotation) obj.rotation.set(0, 0, 0);
  }
}

export function animateDance(refs: CharacterRigRefs, time: number) {
  const t = time * 4.2;
  const sway = Math.sin(t);
  const bob = Math.sin(t * 2) * 0.08;
  refs.leftShoulder.rotation.x = -1.18 + sway * 0.18;
  refs.rightShoulder.rotation.x = -1.18 - sway * 0.18;
  refs.leftShoulder.rotation.y = 0;
  refs.rightShoulder.rotation.y = 0;
  refs.leftShoulder.rotation.z = 0.4 + Math.cos(t) * 0.12;
  refs.rightShoulder.rotation.z = -0.4 - Math.cos(t) * 0.12;
  refs.leftElbow.rotation.x = 0.95 + Math.sin(t + 0.5) * 0.16;
  refs.rightElbow.rotation.x = 0.95 - Math.sin(t + 0.5) * 0.16;
  refs.leftElbow.rotation.z = 0.04;
  refs.rightElbow.rotation.z = -0.04;
  refs.leftHip.rotation.x = sway * 0.16;
  refs.rightHip.rotation.x = -sway * 0.16;
  refs.leftKnee.rotation.x = 0.12 + Math.max(0, sway) * 0.18;
  refs.rightKnee.rotation.x = 0.12 + Math.max(0, -sway) * 0.18;
  refs.torso.rotation.x = 0;
  refs.torso.rotation.y = sway * 0.16;
  refs.torso.rotation.z = sway * 0.06;
  refs.head.rotation.y = sway * 0.16;
  refs.head.rotation.x = bob;
  refs.head.rotation.z = sway * 0.04;
}

export function animateSixSeven(refs: CharacterRigRefs, time: number, offset = 0) {
  const t = time * 5.4 + offset;
  const wave = Math.sin(t);
  refs.leftShoulder.rotation.x = -0.14;
  refs.rightShoulder.rotation.x = -0.14;
  refs.leftShoulder.rotation.y = 0;
  refs.rightShoulder.rotation.y = 0;
  refs.leftShoulder.rotation.z = -0.2;
  refs.rightShoulder.rotation.z = 0.2;
  refs.leftElbow.rotation.x = -1.18 + wave * 0.58;
  refs.rightElbow.rotation.x = -1.18 - wave * 0.58;
  refs.leftElbow.rotation.y = 0;
  refs.rightElbow.rotation.y = 0;
  refs.leftElbow.rotation.z = -0.08;
  refs.rightElbow.rotation.z = 0.08;
  refs.leftHip.rotation.x = Math.max(0, -wave) * 0.08;
  refs.rightHip.rotation.x = Math.max(0, wave) * 0.08;
  refs.leftKnee.rotation.x = 0.08 + Math.max(0, wave) * 0.12;
  refs.rightKnee.rotation.x = 0.08 + Math.max(0, -wave) * 0.12;
  refs.torso.rotation.y = wave * 0.08;
  refs.torso.rotation.z = wave * 0.04;
  refs.head.rotation.y = -wave * 0.1;
  refs.head.rotation.x = -0.02 + Math.sin(t * 2) * 0.025;
}

export function animateGlitch(refs: CharacterRigRefs, time: number, intensity = 1, offset = 0) {
  const wobble = Math.sin(time * 26 + offset) * 0.18 * intensity;
  const snap = Math.sin(time * 41 + offset * 0.7) * 0.08 * intensity;
  const jitter = Math.sin(time * 55 + offset * 1.9) * 0.05 * intensity;

  refs.torso.rotation.y = wobble * 0.8;
  refs.torso.rotation.z = snap * 0.7;
  refs.head.rotation.y = wobble * 1.2;
  refs.head.rotation.x = snap * 0.9;
  refs.head.rotation.z = jitter;
  refs.leftShoulder.rotation.x += wobble * 0.25;
  refs.rightShoulder.rotation.x -= wobble * 0.25;
  refs.leftShoulder.rotation.z = snap * 0.45;
  refs.rightShoulder.rotation.z = -snap * 0.45;
  refs.leftElbow.rotation.x += jitter * 0.9;
  refs.rightElbow.rotation.x -= jitter * 0.9;
  refs.leftHip.rotation.x += snap * 0.35;
  refs.rightHip.rotation.x -= snap * 0.35;
  refs.leftKnee.rotation.z = wobble * 0.22;
  refs.rightKnee.rotation.z = -wobble * 0.22;
}
