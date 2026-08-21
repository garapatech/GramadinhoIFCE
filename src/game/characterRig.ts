import * as THREE from "three";
import { mergeStaticMeshesByMaterial } from "@/game/mergeStaticMeshes";

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
  accentColor?: number;
  hairStyle?: "short" | "curly" | "mohawk" | "bun";
  outfitStyle?: "classic" | "jacket" | "sport";
  faceStyle?: "classic" | "freckles" | "smile";
  headShape?: "round" | "oval" | "wide";
  accessory?: "none" | "headphones" | "cap" | "beanie";
};

export type CharacterRigRefs = {
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  leftHand: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightHand: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
};

export type CharacterRig = {
  group: THREE.Group;
  refs: CharacterRigRefs;
};

function mergeStaticJointMeshes(group: THREE.Group) {
  const meshes: THREE.Mesh[] = [];
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh)) continue;
    if (!child.visible) {
      group.remove(child);
      continue;
    }
    meshes.push(child);
  }
  mergeStaticMeshesByMaterial(group, meshes);
}

function blendRotation(
  object: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  blend = 0.3,
) {
  const alpha = THREE.MathUtils.clamp(blend, 0, 1);
  object.rotation.x = THREE.MathUtils.lerp(object.rotation.x, x, alpha);
  object.rotation.y = THREE.MathUtils.lerp(object.rotation.y, y, alpha);
  object.rotation.z = THREE.MathUtils.lerp(object.rotation.z, z, alpha);
}

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
  accentColor = 0xf6b94b,
  hairStyle = "short",
  outfitStyle = "classic",
  faceStyle = "classic",
  headShape = "round",
  accessory = "none",
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
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.78 });

  const torso = new THREE.Group();
  torso.position.set(0, 1, 0);
  root.add(torso);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.46, 5, 12), shirt);
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

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 12), shirt);
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

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.39, 18, 16), skin);
  const headScale = headShape === "oval"
    ? [0.94, 1.18, 0.92]
    : headShape === "wide" ? [1.13, 1.02, 0.96] : [1.02, 1.08, 0.95];
  skull.scale.set(headScale[0], headScale[1], headScale[2]);
  skull.castShadow = true;
  head.add(skull);

  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), faceMat);
  facePatch.position.set(0, -0.04, 0.21);
  facePatch.scale.set(0.95, 1.05, 0.46);
  facePatch.castShadow = false;
  head.add(facePatch);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.405, 18, 14, 0, Math.PI * 2, 0, Math.PI / 1.86),
    hairMat
  );
  hair.position.set(0, 0.15, -0.035);
  hair.scale.set(1.04, 0.78, 1.02);
  hair.castShadow = true;
  hair.visible = hairStyle === "short" || hairStyle === "bun";
  head.add(hair);

  const bangGeo = new THREE.SphereGeometry(0.075, 8, 6);
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
    bang.visible = hairStyle === "short" || hairStyle === "bun";
    head.add(bang);
  }

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 9), hairMat);
  hairBack.position.set(0, -0.08, -0.27);
  hairBack.scale.set(1.18, 1.08, 0.82);
  hairBack.visible = hairStyle === "short" || hairStyle === "bun";
  head.add(hairBack);

  const leftSideHair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), hairMat);
  leftSideHair.position.set(-0.34, 0.02, -0.02);
  leftSideHair.scale.set(0.58, 1.22, 0.72);
  leftSideHair.visible = hairStyle === "short" || hairStyle === "bun";
  head.add(leftSideHair);
  const rightSideHair = leftSideHair.clone();
  rightSideHair.position.x = 0.28;
  head.add(rightSideHair);

  if (hairStyle === "curly") {
    const curlGeo = new THREE.SphereGeometry(0.13, 10, 8);
    for (const [x, y, z] of [
      [-0.28, 0.2, 0], [-0.14, 0.32, 0.02], [0.02, 0.35, 0], [0.19, 0.3, -0.01],
      [0.31, 0.16, -0.03], [-0.3, 0.04, -0.08], [0.28, 0.01, -0.1], [0, 0.28, -0.27],
    ]) {
      const curl = new THREE.Mesh(curlGeo, hairMat);
      curl.position.set(x, y, z);
      curl.scale.set(1, 0.9, 0.9);
      curl.castShadow = true;
      head.add(curl);
    }
  } else if (hairStyle === "mohawk") {
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), hairMat);
      spike.position.set(0, 0.37, -0.2 + i * 0.1);
      spike.rotation.x = -0.18 + i * 0.08;
      spike.castShadow = true;
      head.add(spike);
    }
  } else if (hairStyle === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), hairMat);
    bun.position.set(0, 0.2, -0.36);
    bun.castShadow = true;
    head.add(bun);
  }

  const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 7), skin);
  leftEar.scale.set(0.6, 1, 0.4);
  leftEar.position.set(-0.36, -0.01, 0.02);
  head.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.32;
  head.add(rightEar);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeWhiteMat);
  leftEyeWhite.position.set(-0.135, 0.055, 0.352);
  leftEyeWhite.scale.set(1.06, 0.9, 0.48);
  head.add(leftEyeWhite);
  const rightEyeWhite = leftEyeWhite.clone();
  rightEyeWhite.position.x = 0.12;
  head.add(rightEyeWhite);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 7), eyeMat);
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
  if (faceStyle === "smile") mouth.scale.set(1.28, 0.9, 1);
  head.add(mouth);

  if (faceStyle === "freckles") {
    const freckleMat = new THREE.MeshBasicMaterial({ color: 0x8a573f });
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index += 1) {
        const freckle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), freckleMat);
        freckle.position.set(side * (0.13 + index * 0.035), -0.05 + (index % 2) * 0.025, 0.385);
        head.add(freckle);
      }
    }
  }

  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xe08a8a,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
  });
  const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), cheekMat);
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
    const lensGeo = new THREE.TorusGeometry(0.09, 0.012, 6, 12);
    const leftLens = new THREE.Mesh(lensGeo, frameMat);
    leftLens.position.set(-0.13, 0.06, 0.365);
    head.add(leftLens);
    const rightLens = leftLens.clone();
    rightLens.position.x = 0.12;
    head.add(rightLens);

    const innerGeo = new THREE.CircleGeometry(0.082, 12);
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

  if (accessory === "headphones") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 16, Math.PI), accentMat);
    band.position.set(0, 0.08, -0.02);
    band.rotation.z = Math.PI;
    head.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 10), accentMat);
      cup.position.set(side * 0.37, 0, 0);
      cup.rotation.z = Math.PI / 2;
      head.add(cup);
    }
  } else if (accessory === "cap") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.415, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
    cap.position.y = 0.18;
    cap.scale.y = 0.62;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.22), accentMat);
    brim.position.set(0, 0.2, 0.36);
    head.add(brim);
  } else if (accessory === "beanie") {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), accentMat);
    beanie.position.y = 0.18;
    beanie.scale.y = 0.8;
    head.add(beanie);
  }

  function buildArm(side: "left" | "right") {
    const sign = side === "left" ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.48, 0.88, 0);
    shoulder.rotation.z = sign * 0.12;
    shoulder.rotation.x = -0.03;
    torso.add(shoulder);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), shirt);
    shoulderBall.castShadow = true;
    shoulder.add(shoulderBall);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 4, 9), shirt);
    upperArm.position.y = -0.25;
    upperArm.rotation.z = sign * 0.02;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.48;
    shoulder.add(elbow);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.105, 9, 7), shirt);
    elbowBall.scale.set(1.05, 0.82, 1.05);
    elbowBall.castShadow = true;
    elbow.add(elbowBall);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.36, 4, 9), skin);
    forearm.position.y = -0.27;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.073, 8, 6), skin);
    wrist.position.y = -0.49;
    wrist.scale.set(1, 0.8, 1);
    elbow.add(wrist);

    const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), skin);
    handMesh.position.y = -0.59;
    handMesh.scale.set(0.95, 1.12, 0.78);
    handMesh.castShadow = true;
    elbow.add(handMesh);

    for (const x of [-0.045, 0, 0.045]) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.065, 3, 5), skin);
      finger.position.set(x, -0.68, 0.02);
      finger.castShadow = true;
      elbow.add(finger);
    }

    // Ponto de pega estável para itens. Ele acompanha toda a cadeia do braço,
    // sem obrigar cada item a adivinhar a distância entre cotovelo e mão.
    const hand = new THREE.Group();
    hand.position.set(0, -0.62, 0.02);
    elbow.add(hand);

    return { shoulder, elbow, hand };
  }

  const leftArm = buildArm("left");
  const rightArm = buildArm("right");

  function buildLeg(side: "left" | "right") {
    const sign = side === "left" ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.18, 1.05, 0);
    root.add(hip);

    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), pants);
    hipBall.castShadow = true;
    hip.add(hipBall);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.42, 10), pants);
    thigh.position.y = -0.225;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);

    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 7), pants);
    kneeBall.castShadow = true;
    knee.add(kneeBall);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 10), pants);
    shin.position.y = -0.225;
    shin.castShadow = true;
    knee.add(shin);

    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pants);
    ankle.position.y = -0.44;
    ankle.scale.set(1, 0.72, 1);
    ankle.castShadow = true;
    knee.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.5), shoes);
    foot.position.set(0, -0.48, 0.1);
    foot.castShadow = true;
    knee.add(foot);

    const heelCap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 7), shoes);
    heelCap.position.set(0, -0.47, -0.1);
    heelCap.scale.set(1.2, 0.7, 0.9);
    knee.add(heelCap);

    return { hip, knee };
  }

  const leftLeg = buildLeg("left");
  const rightLeg = buildLeg("right");

  // Cada articulação continua animável, mas suas peças imóveis com o mesmo
  // material são enviadas à GPU em uma única chamada de desenho.
  for (const joint of [
    torso,
    head,
    leftArm.shoulder,
    leftArm.elbow,
    rightArm.shoulder,
    rightArm.elbow,
    leftLeg.hip,
    leftLeg.knee,
    rightLeg.hip,
    rightLeg.knee,
  ]) {
    mergeStaticJointMeshes(joint);
  }

  // As articulacoes continuam dinamicas; as pecas dentro delas nunca mudam
  // de transformacao local e nao precisam recalcular matrizes a cada frame.
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });

  return {
    group: root,
    refs: {
      torso,
      head,
      leftShoulder: leftArm.shoulder,
      leftElbow: leftArm.elbow,
      leftHand: leftArm.hand,
      rightShoulder: rightArm.shoulder,
      rightElbow: rightArm.elbow,
      rightHand: rightArm.hand,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee,
    },
  };
}

export function animateWalk(refs: CharacterRigRefs, walkPhase: number, intensity: number) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const stride = Math.sin(walkPhase);
  const nextStride = Math.sin(walkPhase + 0.42);
  const vertical = Math.cos(walkPhase * 2);
  const armSwing = stride * 0.72 * k;
  const legSwing = stride * 0.82 * k;
  const blend = 0.28;

  // Braço e perna opostos avançam juntos. O balanço nasce no ombro; o
  // cotovelo só flexiona na volta, como numa caminhada humana.
  blendRotation(refs.leftShoulder, armSwing - 0.05, 0, -0.035, blend);
  blendRotation(refs.rightShoulder, -armSwing - 0.05, 0, 0.035, blend);
  blendRotation(refs.leftElbow, 0.18 + Math.max(0, -nextStride) * 0.3 * k, 0, -0.025, blend);
  blendRotation(refs.rightElbow, 0.18 + Math.max(0, nextStride) * 0.3 * k, 0, 0.025, blend);
  blendRotation(refs.leftHip, -legSwing, 0, -0.018 * k, blend);
  blendRotation(refs.rightHip, legSwing, 0, 0.018 * k, blend);
  blendRotation(refs.leftKnee, 0.04 + Math.max(0, legSwing) * 0.92, 0, 0, blend);
  blendRotation(refs.rightKnee, 0.04 + Math.max(0, -legSwing) * 0.92, 0, 0, blend);
  blendRotation(refs.torso, 0.018 - vertical * 0.018 * k, -stride * 0.09 * k, -stride * 0.025 * k, blend);
  blendRotation(refs.head, -vertical * 0.018 * k, stride * 0.045 * k, stride * 0.012 * k, blend);
}

export function setRestPose(refs: CharacterRigRefs, time: number, offset = 0) {
  const breath = Math.sin(time * 1.6 + offset) * 0.05;
  const blend = 0.16;
  blendRotation(refs.leftShoulder, -0.04 + breath * 0.35, 0, 0, blend);
  blendRotation(refs.rightShoulder, -0.04 - breath * 0.35, 0, 0, blend);
  blendRotation(refs.leftElbow, 0.14 + breath * 0.25, 0, 0, blend);
  blendRotation(refs.rightElbow, 0.14 + breath * 0.25, 0, 0, blend);
  blendRotation(refs.leftHip, 0, 0, 0, blend);
  blendRotation(refs.rightHip, 0, 0, 0, blend);
  blendRotation(refs.leftKnee, 0.05, 0, 0, blend);
  blendRotation(refs.rightKnee, 0.05, 0, 0, blend);
  blendRotation(refs.torso, 0, Math.sin(time * 0.6 + offset) * 0.04, 0, blend);
  blendRotation(
    refs.head,
    Math.sin(time * 0.8 + offset) * 0.04,
    Math.sin(time * 0.5 + offset * 1.3) * 0.18,
    0,
    blend,
  );
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

export function setSittingPose(refs: CharacterRigRefs, time = 0, blend = 0.22) {
  const breath = Math.sin(time * 1.45) * 0.025;
  blendRotation(refs.leftShoulder, -0.12 + breath, 0, -0.025, blend);
  blendRotation(refs.rightShoulder, -0.12 - breath, 0, 0.025, blend);
  blendRotation(refs.leftElbow, 0.48, 0, -0.02, blend);
  blendRotation(refs.rightElbow, 0.48, 0, 0.02, blend);
  blendRotation(refs.leftHip, -Math.PI / 2.16, 0, -0.025, blend);
  blendRotation(refs.rightHip, -Math.PI / 2.16, 0, 0.025, blend);
  blendRotation(refs.leftKnee, Math.PI / 2.24, 0, 0, blend);
  blendRotation(refs.rightKnee, Math.PI / 2.24, 0, 0, blend);
  blendRotation(refs.torso, 0.04 + breath * 0.3, 0, 0, blend);
  blendRotation(refs.head, -0.04 + breath * 0.15, Math.sin(time * 0.42) * 0.04, 0, blend);
}

export function animateRun(refs: CharacterRigRefs, walkPhase: number, intensity: number) {
  const k = Math.min(Math.max(intensity, 0), 1);
  const armSwing = Math.sin(walkPhase) * 1.6 * k;
  const legSwing = Math.sin(walkPhase) * 1.35 * k;
  const blend = 0.38;
  blendRotation(refs.leftShoulder, -0.08, 0, 0.1, blend);
  blendRotation(refs.rightShoulder, -0.08, 0, -0.1, blend);
  blendRotation(refs.leftElbow, 0.45 + armSwing * 1.35, 0, 0.03, blend);
  blendRotation(refs.rightElbow, 0.45 - armSwing * 1.35, 0, -0.03, blend);
  blendRotation(refs.leftHip, -legSwing, 0, 0, blend);
  blendRotation(refs.rightHip, legSwing, 0, 0, blend);
  blendRotation(refs.leftKnee, Math.max(0, legSwing) * 1.7, 0, 0, blend);
  blendRotation(refs.rightKnee, Math.max(0, -legSwing) * 1.7, 0, 0, blend);
  blendRotation(refs.torso, 0.12 * k, -armSwing * 0.12, 0, blend);
  blendRotation(refs.head, 0.02 - Math.sin(walkPhase * 2) * 0.03, armSwing * 0.05, 0, blend);
}

export function animateJump(refs: CharacterRigRefs, verticalVelocity: number) {
  const rising = THREE.MathUtils.clamp(verticalVelocity / 8.2, -1, 1);
  const tuck = rising >= 0 ? 0.2 + rising * 0.22 : 0.42 + Math.abs(rising) * 0.18;
  blendRotation(refs.leftShoulder, -0.42 + rising * 0.12, 0, -0.08, 0.28);
  blendRotation(refs.rightShoulder, -0.42 + rising * 0.12, 0, 0.08, 0.28);
  blendRotation(refs.leftElbow, 0.58, 0, 0, 0.28);
  blendRotation(refs.rightElbow, 0.58, 0, 0, 0.28);
  blendRotation(refs.leftHip, -tuck, 0, 0, 0.28);
  blendRotation(refs.rightHip, -tuck * 0.86, 0, 0, 0.28);
  blendRotation(refs.leftKnee, tuck * 1.55, 0, 0, 0.28);
  blendRotation(refs.rightKnee, tuck * 1.38, 0, 0, 0.28);
  blendRotation(refs.torso, rising >= 0 ? -0.04 : 0.08, 0, 0, 0.24);
  blendRotation(refs.head, rising >= 0 ? 0.04 : -0.03, 0, 0, 0.24);
}

export function animateLanding(refs: CharacterRigRefs, intensity: number) {
  const k = THREE.MathUtils.clamp(intensity, 0, 1);
  blendRotation(refs.leftHip, -0.42 * k, 0, 0, 0.34);
  blendRotation(refs.rightHip, -0.42 * k, 0, 0, 0.34);
  blendRotation(refs.leftKnee, 0.82 * k, 0, 0, 0.34);
  blendRotation(refs.rightKnee, 0.82 * k, 0, 0, 0.34);
  blendRotation(refs.leftShoulder, 0.16 * k, 0, -0.04, 0.28);
  blendRotation(refs.rightShoulder, 0.16 * k, 0, 0.04, 0.28);
  blendRotation(refs.torso, 0.18 * k, 0, 0, 0.3);
  blendRotation(refs.head, -0.08 * k, 0, 0, 0.3);
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
