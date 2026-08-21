import * as THREE from "three";
import { createCloudTexture } from "@/game/campusTextures";
import { type AtmosphereState } from "@/game/atmosphere";

type WeatherMapPoint = {
  x: number;
  z: number;
};

type WeatherMapFeatures = {
  trees: WeatherMapPoint[];
};

type WeatherBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type WeatherPlayerPosition = {
  x: number;
  y: number;
  z: number;
};

type WeatherPuddleUserData = {
  baseRadius: number;
  phase: number;
};

type WeatherCloudUserData = {
  drift: number;
  phase: number;
  baseY: number;
  baseScale: number;
};

type WeatherTreeUserData = {
  windPhase: number;
};

type WeatherPuddleMesh = THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial> & {
  userData: WeatherPuddleUserData;
};

type WeatherCloudSprite = THREE.Sprite & {
  userData: WeatherCloudUserData;
};

type WeatherTreeInstance = WeatherTreeUserData & {
  x: number;
  z: number;
  yaw: number;
};

type WeatherTreeResources = {
  trunkGeometry: THREE.CylinderGeometry;
  trunkMaterial: THREE.MeshStandardMaterial;
  crownGeometry: THREE.SphereGeometry;
  crownMaterial: THREE.MeshStandardMaterial;
};

export interface WeatherSystemOptions {
  scene: THREE.Scene;
  world: THREE.Group;
  mapFeatures: WeatherMapFeatures;
  rand(min: number, max: number): number;
  getPlayerPosition(): WeatherPlayerPosition;
  disposeObject3D(object: THREE.Object3D): void;
  lowPowerMode?: boolean;
}

export interface WeatherSystem {
  update(dt: number, time: number, state: AtmosphereState): void;
  removeTreesInArea(bounds: WeatherBounds, padding?: number): void;
  getGroundWetness(): number;
  destroy(): void;
}

function createPuddle(
  world: THREE.Group,
  puddles: WeatherPuddleMesh[],
  x: number,
  z: number,
  radius: number,
  phase = 0
) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8dc7e6,
      transparent: true,
      opacity: 0,
      roughness: 0.14,
      metalness: 0.32,
      emissive: 0x15324a,
      emissiveIntensity: 0.08,
      depthWrite: false,
    })
  ) as WeatherPuddleMesh;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.041, z);
  mesh.renderOrder = 2;
  mesh.userData = {
    baseRadius: radius,
    phase,
  };
  world.add(mesh);
  puddles.push(mesh);
  return mesh;
}

function createCloudSprite(
  cloudLayer: THREE.Group,
  cloudSprites: WeatherCloudSprite[],
  x: number,
  y: number,
  z: number,
  scale: number,
  drift: number,
  phase: number,
  cloudTexture: THREE.Texture
) {
  const cloud = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: cloudTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      fog: false,
    })
  ) as WeatherCloudSprite;
  cloud.position.set(x, y, z);
  cloud.scale.set(scale * 1.5, scale, 1);
  cloud.userData = { drift, phase, baseY: y, baseScale: scale };
  cloudLayer.add(cloud);
  cloudSprites.push(cloud);
  return cloud;
}

export function createWeatherSystem(opts: WeatherSystemOptions): WeatherSystem {
  const { scene, world, mapFeatures, rand, getPlayerPosition, disposeObject3D, lowPowerMode = false } = opts;
  const cloudTexture = createCloudTexture();
  const cloudLayer = new THREE.Group();
  scene.add(cloudLayer);

  const weatherTrees: WeatherTreeInstance[] = [];
  const treeResources: WeatherTreeResources = {
    trunkGeometry: new THREE.CylinderGeometry(0.38, 0.48, 2.8, 8),
    trunkMaterial: new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1 }),
    crownGeometry: new THREE.SphereGeometry(1.6, 10, 10),
    crownMaterial: new THREE.MeshStandardMaterial({ color: 0x44753e, roughness: 1 }),
  };
  const treeLayer = new THREE.Group();
  treeLayer.name = "weather.trees";
  const treeTrunks = new THREE.InstancedMesh(
    treeResources.trunkGeometry,
    treeResources.trunkMaterial,
    86,
  );
  const treeCrowns = new THREE.InstancedMesh(
    treeResources.crownGeometry,
    treeResources.crownMaterial,
    86,
  );
  treeTrunks.castShadow = false;
  treeTrunks.receiveShadow = true;
  treeCrowns.castShadow = false;
  treeCrowns.receiveShadow = true;
  treeTrunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  treeCrowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  treeLayer.add(treeTrunks, treeCrowns);
  world.add(treeLayer);
  for (const object of [treeLayer, treeTrunks, treeCrowns]) {
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  }
  const treeRoot = new THREE.Object3D();
  const treeInstanceMatrix = new THREE.Matrix4();
  const trunkLocalMatrix = new THREE.Matrix4().makeTranslation(0, 1.4, 0);
  const crownLocalMatrix = new THREE.Matrix4().makeTranslation(0, 3.2, 0);
  let lastTreeUpdateAt = -Infinity;
  let lastTreeWind = 0;

  function syncTreeInstances(time: number, wind: number, updateBounds = false) {
    treeTrunks.count = weatherTrees.length;
    treeCrowns.count = weatherTrees.length;
    for (let index = 0; index < weatherTrees.length; index += 1) {
      const tree = weatherTrees[index];
      treeRoot.position.set(tree.x, 0, tree.z);
      treeRoot.rotation.set(
        Math.cos(time * 0.52 + tree.windPhase) * (0.006 + wind * 0.03),
        tree.yaw,
        Math.sin(time * 0.75 + tree.windPhase) * (0.012 + wind * 0.06),
      );
      treeRoot.updateMatrix();
      treeInstanceMatrix.multiplyMatrices(treeRoot.matrix, trunkLocalMatrix);
      treeTrunks.setMatrixAt(index, treeInstanceMatrix);
      treeInstanceMatrix.multiplyMatrices(treeRoot.matrix, crownLocalMatrix);
      treeCrowns.setMatrixAt(index, treeInstanceMatrix);
    }
    treeTrunks.instanceMatrix.needsUpdate = true;
    treeCrowns.instanceMatrix.needsUpdate = true;
    if (updateBounds) {
      treeTrunks.computeBoundingSphere();
      treeCrowns.computeBoundingSphere();
    }
  }
  const puddles: WeatherPuddleMesh[] = [];
  const cloudSprites: WeatherCloudSprite[] = [];
  let groundWetness = 0;

  const rainCount = lowPowerMode ? 420 : 700;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainVelocities = new Float32Array(rainCount);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.PointsMaterial({
    color: 0xd9efff,
    size: 0.13,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const rainField = new THREE.Points(rainGeometry, rainMaterial);
  rainField.frustumCulled = false;
  rainField.visible = false;
  rainField.updateMatrix();
  rainField.matrixAutoUpdate = false;
  scene.add(rainField);

  for (let i = 0; i < 6; i += 1) {
    createPuddle(
      world,
      puddles,
      [-8, 16, -19, 8, 24, -27][i],
      [-5, 7, 16, 21, -12, 9][i],
      [1.9, 1.6, 2.1, 1.45, 1.55, 1.75][i],
      [0.15, 1.35, 2.2, 0.85, 2.95, 1.8][i]
    );
  }

  for (let i = 0; i < 7; i += 1) {
    const x = rand(-70, 70);
    const y = rand(18, 28);
    const z = rand(-34, 34);
    const scale = rand(10, 20);
    const drift = rand(0.15, 0.36);
    const phase = rand(0, Math.PI * 2);
    createCloudSprite(cloudLayer, cloudSprites, x, y, z, scale, drift, phase, cloudTexture);
  }

  for (let i = 0; i < 86; i += 1) {
    const side = i % 4;
    let x = rand(-77, 77);
    let z = rand(-77, 77);
    if (side === 0) z = rand(-79, -57);
    if (side === 1) z = rand(57, 79);
    if (side === 2) x = rand(-79, -57);
    if (side === 3) x = rand(57, 79);
    weatherTrees.push({
      x,
      z,
      yaw: rand(0, Math.PI * 2),
      windPhase: rand(0, Math.PI * 2),
    });
    mapFeatures.trees.push({ x, z });
  }
  syncTreeInstances(0, 0, true);

  let ambientVisualAccumulator = 0;
  let rainVisualAccumulator = 0;
  let rainWasVisible = false;
  const randomIn = (min: number, max: number) => min + (max - min) * Math.random();

  function update(dt: number, time: number, state: AtmosphereState) {
    const weatherPulse = Math.max(0, Math.min(1, state.weather.rain ? 1 : state.weather.cloudMix * 0.7));
    const wind = state.weather.wind + (state.daylight > 0 ? Math.sin(time * 0.12) * 0.05 : 0.02);

    groundWetness = THREE.MathUtils.clamp(
      groundWetness + state.weather.rain * dt * 1.4 - dt * (state.weather.cloudMix > 0.5 ? 0.01 : 0.035),
      0,
      1
    );

    ambientVisualAccumulator += dt;
    const ambientVisualInterval = lowPowerMode ? 1 / 15 : 1 / 20;
    const updateAmbientVisuals = ambientVisualAccumulator >= ambientVisualInterval;
    if (updateAmbientVisuals) {
      const visualDt = ambientVisualAccumulator;
      ambientVisualAccumulator = 0;
      const cloudColor = state.weather.rain ? 0xe3ebf5 : state.weather.cloudMix > 0.4 ? 0xf4f7fb : 0xffffff;
      for (let i = 0; i < cloudSprites.length; i += 1) {
        const cloud = cloudSprites[i];
        const data = cloud.userData;
        cloud.position.x += (data.drift + wind * 0.35) * visualDt;
        if (cloud.position.x > 82) cloud.position.x = -82;
        if (cloud.position.x < -82) cloud.position.x = 82;
        cloud.position.y = data.baseY + Math.sin(time * 0.18 + data.phase) * (0.4 + weatherPulse * 0.7);
        const scalePulse = 1 + weatherPulse * 0.22 + Math.sin(time * 0.12 + data.phase) * 0.02;
        cloud.scale.set(data.baseScale * 1.5 * scalePulse, data.baseScale * scalePulse, 1);
        cloud.material.opacity = 0.54 + weatherPulse * 0.24;
        cloud.material.color.setHex(cloudColor);
      }
    }

    const raining = state.weather.rain > 0.08;
    rainVisualAccumulator += dt;
    const rainInterval = lowPowerMode ? 1 / 24 : 1 / 30;
    if (raining && (rainVisualAccumulator >= rainInterval || !rainWasVisible)) {
      const rainDt = Math.min(0.08, Math.max(rainVisualAccumulator, 1 / 60));
      rainVisualAccumulator = 0;
      const player = getPlayerPosition();
      const centerX = player.x;
      const centerZ = player.z;
      const rainSpan = 28;
      const rainTop = player.y + 21;
      const rainSpeed = 12 + state.weather.rain * 11 + state.weather.cloudMix * 3;
      for (let i = 0; i < rainCount; i += 1) {
        const idx = i * 3;
        if (rainPositions[idx + 1] > rainTop || rainPositions[idx + 1] === 0) {
          rainPositions[idx] = centerX + randomIn(-rainSpan, rainSpan);
          rainPositions[idx + 1] = rainTop - randomIn(0, 18);
          rainPositions[idx + 2] = centerZ + randomIn(-rainSpan, rainSpan);
          rainVelocities[i] = rainSpeed * randomIn(0.72, 1.22);
        }

        rainPositions[idx] += wind * 7.2 * rainDt;
        rainPositions[idx + 1] -= rainVelocities[i] * rainDt;
        rainPositions[idx + 2] += wind * 2.4 * rainDt;

        if (rainPositions[idx + 1] < player.y - 2) {
          rainPositions[idx] = centerX + randomIn(-rainSpan, rainSpan);
          rainPositions[idx + 1] = rainTop + randomIn(0, 8);
          rainPositions[idx + 2] = centerZ + randomIn(-rainSpan, rainSpan);
          rainVelocities[i] = rainSpeed * randomIn(0.72, 1.22);
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }

    if (raining !== rainWasVisible) {
      rainWasVisible = raining;
      rainField.visible = raining;
    }
    if (!raining) rainVisualAccumulator = Math.min(rainVisualAccumulator, rainInterval);

    if (time - lastTreeUpdateAt >= (lowPowerMode ? 1 / 15 : 1 / 24)) {
      lastTreeUpdateAt = time;
      lastTreeWind = state.weather.wind;
      syncTreeInstances(time, lastTreeWind);
    }

    if (updateAmbientVisuals) {
      const puddleBaseOpacity = Math.max(0, groundWetness - 0.06);
      for (const puddle of puddles) {
        const phase = puddle.userData.phase;
        const shimmer = 0.015 * Math.sin(time * 2.4 + phase) + 0.01 * Math.sin(time * 4.9 + phase * 1.7);
        const size = puddle.userData.baseRadius * (1 + groundWetness * 0.06 + shimmer);
        puddle.scale.setScalar(size / puddle.userData.baseRadius);
        puddle.material.opacity = puddleBaseOpacity * (0.18 + Math.max(0, Math.sin(time * 1.7 + phase)) * 0.05);
        puddle.material.roughness = 0.12 + (1 - groundWetness) * 0.1;
        puddle.material.emissiveIntensity = 0.05 + groundWetness * 0.16;
      }
    }
  }

  function removeTreesInArea(bounds: WeatherBounds, padding = 1.6) {
    const minX = bounds.minX - padding;
    const maxX = bounds.maxX + padding;
    const minZ = bounds.minZ - padding;
    const maxZ = bounds.maxZ + padding;

    for (let i = weatherTrees.length - 1; i >= 0; i -= 1) {
      const tree = weatherTrees[i];
      const { x, z } = tree;
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
      weatherTrees.splice(i, 1);
    }
    syncTreeInstances(lastTreeUpdateAt > 0 ? lastTreeUpdateAt : 0, lastTreeWind, true);

    mapFeatures.trees = mapFeatures.trees.filter(
      (tree) => tree.x < minX || tree.x > maxX || tree.z < minZ || tree.z > maxZ
    );
  }

  function getGroundWetness() {
    return groundWetness;
  }

  function destroy() {
    scene.remove(cloudLayer);
    scene.remove(rainField);
    disposeObject3D(cloudLayer);

    for (const puddle of puddles) {
      world.remove(puddle);
      disposeObject3D(puddle);
    }

    world.remove(treeLayer);

    treeResources.trunkGeometry.dispose();
    treeResources.trunkMaterial.dispose();
    treeResources.crownGeometry.dispose();
    treeResources.crownMaterial.dispose();

    disposeObject3D(rainField);
  }

  return {
    update,
    removeTreesInArea,
    getGroundWetness,
    destroy,
  };
}
