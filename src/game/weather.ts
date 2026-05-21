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

export interface WeatherSystemOptions {
  scene: THREE.Scene;
  world: THREE.Group;
  mapFeatures: WeatherMapFeatures;
  rand(min: number, max: number): number;
  getPlayerPosition(): WeatherPlayerPosition;
  disposeObject3D(object: THREE.Object3D): void;
}

export interface WeatherSystem {
  update(dt: number, time: number, state: AtmosphereState): void;
  removeTreesInArea(bounds: WeatherBounds, padding?: number): void;
  getGroundWetness(): number;
  destroy(): void;
}

function createTree() {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 2.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1 })
  );
  trunk.position.y = 1.4;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x44753e, roughness: 1 })
  );
  crown.position.y = 3.2;
  crown.castShadow = true;
  tree.add(crown);
  return tree;
}

function createPuddle(world: THREE.Group, puddles: THREE.Mesh[], x: number, z: number, radius: number, phase = 0) {
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
  );
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
  cloudSprites: THREE.Sprite[],
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
  );
  cloud.position.set(x, y, z);
  cloud.scale.set(scale * 1.5, scale, 1);
  cloud.userData = { drift, phase, baseY: y, baseScale: scale };
  cloudLayer.add(cloud);
  cloudSprites.push(cloud);
  return cloud;
}

export function createWeatherSystem(opts: WeatherSystemOptions): WeatherSystem {
  const { scene, world, mapFeatures, rand, getPlayerPosition, disposeObject3D } = opts;
  const cloudTexture = createCloudTexture();
  const cloudLayer = new THREE.Group();
  scene.add(cloudLayer);

  const weatherTrees: THREE.Group[] = [];
  const puddles: THREE.Mesh[] = [];
  const cloudSprites: THREE.Sprite[] = [];
  let groundWetness = 0;

  const rainCount = 900;
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
    const tree = createTree();
    const side = i % 4;
    let x = rand(-77, 77);
    let z = rand(-77, 77);
    if (side === 0) z = rand(-79, -57);
    if (side === 1) z = rand(57, 79);
    if (side === 2) x = rand(-79, -57);
    if (side === 3) x = rand(57, 79);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand(0, Math.PI * 2);
    tree.userData.windPhase = rand(0, Math.PI * 2);
    world.add(tree);
    mapFeatures.trees.push({ x, z });
    weatherTrees.push(tree);
  }

  function update(dt: number, time: number, state: AtmosphereState) {
    const weatherPulse = Math.max(0, Math.min(1, state.weather.rain ? 1 : state.weather.cloudMix * 0.7));
    const wind = state.weather.wind + (state.daylight > 0 ? Math.sin(time * 0.12) * 0.05 : 0.02);
    const randomIn = (min: number, max: number) => min + (max - min) * Math.random();

    groundWetness = THREE.MathUtils.clamp(
      groundWetness + state.weather.rain * dt * 1.4 - dt * (state.weather.cloudMix > 0.5 ? 0.01 : 0.035),
      0,
      1
    );

    for (let i = 0; i < cloudSprites.length; i += 1) {
      const cloud = cloudSprites[i];
      const data = cloud.userData as {
        drift: number;
        phase: number;
        baseY: number;
        baseScale: number;
      };
      cloud.position.x += (data.drift + wind * 0.35) * 0.018;
      if (cloud.position.x > 82) cloud.position.x = -82;
      if (cloud.position.x < -82) cloud.position.x = 82;
      cloud.position.y = data.baseY + Math.sin(time * 0.18 + data.phase) * (0.4 + weatherPulse * 0.7);
      const scalePulse = 1 + weatherPulse * 0.22 + Math.sin(time * 0.12 + data.phase) * 0.02;
      cloud.scale.set(data.baseScale * 1.5 * scalePulse, data.baseScale * scalePulse, 1);
      cloud.material.opacity = 0.54 + weatherPulse * 0.24;
      cloud.material.color.setHex(state.weather.rain ? 0xe3ebf5 : state.weather.cloudMix > 0.4 ? 0xf4f7fb : 0xffffff);
    }

    if (state.weather.rain > 0.08) {
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

        rainPositions[idx] += wind * 0.12;
        rainPositions[idx + 1] -= rainVelocities[i] * 0.016;
        rainPositions[idx + 2] += wind * 0.04;

        if (rainPositions[idx + 1] < player.y - 2) {
          rainPositions[idx] = centerX + randomIn(-rainSpan, rainSpan);
          rainPositions[idx + 1] = rainTop + randomIn(0, 8);
          rainPositions[idx + 2] = centerZ + randomIn(-rainSpan, rainSpan);
          rainVelocities[i] = rainSpeed * randomIn(0.72, 1.22);
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }

    rainField.visible = state.weather.rain > 0.08;
    rainField.position.set(0, 0, 0);

    for (const tree of weatherTrees) {
      tree.rotation.z = Math.sin(time * 0.75 + tree.userData.windPhase) * (0.012 + state.weather.wind * 0.06);
      tree.rotation.x = Math.cos(time * 0.52 + tree.userData.windPhase) * (0.006 + state.weather.wind * 0.03);
    }

    const puddleBaseOpacity = Math.max(0, groundWetness - 0.06);
    for (const puddle of puddles) {
      const phase = puddle.userData.phase || 0;
      const shimmer = 0.015 * Math.sin(time * 2.4 + phase) + 0.01 * Math.sin(time * 4.9 + phase * 1.7);
      const size = puddle.userData.baseRadius * (1 + groundWetness * 0.06 + shimmer);
      puddle.scale.setScalar(size / puddle.userData.baseRadius);
      puddle.material.opacity = puddleBaseOpacity * (0.18 + Math.max(0, Math.sin(time * 1.7 + phase)) * 0.05);
      puddle.material.roughness = 0.12 + (1 - groundWetness) * 0.1;
      puddle.material.emissiveIntensity = 0.05 + groundWetness * 0.16;
    }
  }

  function removeTreesInArea(bounds: WeatherBounds, padding = 1.6) {
    const minX = bounds.minX - padding;
    const maxX = bounds.maxX + padding;
    const minZ = bounds.minZ - padding;
    const maxZ = bounds.maxZ + padding;

    for (let i = weatherTrees.length - 1; i >= 0; i -= 1) {
      const tree = weatherTrees[i];
      const { x, z } = tree.position;
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
      world.remove(tree);
      disposeObject3D(tree);
      weatherTrees.splice(i, 1);
    }

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

    for (const cloud of cloudSprites) {
      cloudLayer.remove(cloud);
      disposeObject3D(cloud);
    }

    for (const puddle of puddles) {
      world.remove(puddle);
      disposeObject3D(puddle);
    }

    for (const tree of weatherTrees) {
      world.remove(tree);
      disposeObject3D(tree);
    }

    disposeObject3D(rainField);
    cloudTexture.dispose();
  }

  return {
    update,
    removeTreesInArea,
    getGroundWetness,
    destroy,
  };
}
