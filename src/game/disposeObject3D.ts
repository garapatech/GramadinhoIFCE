import * as THREE from "three";

function disposeMaterial(
  material: THREE.Material,
  seenMaterials: Set<THREE.Material>,
  seenTextures: Set<THREE.Texture>
) {
  if (seenMaterials.has(material)) return;
  seenMaterials.add(material);

  for (const key of [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "displacementMap",
    "emissiveMap",
    "envMap",
    "lightMap",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
  ] as const) {
    const texture = (material as THREE.Material & Record<string, unknown>)[key];
    if (texture instanceof THREE.Texture && !seenTextures.has(texture)) {
      seenTextures.add(texture);
      texture.dispose();
    }
  }

  material.dispose();
}

export function disposeObject3D(object: THREE.Object3D | null | undefined) {
  if (!object) return;

  const seenGeometries = new Set<THREE.BufferGeometry>();
  const seenMaterials = new Set<THREE.Material>();
  const seenTextures = new Set<THREE.Texture>();

  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry && !seenGeometries.has(mesh.geometry)) {
      seenGeometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material) {
        disposeMaterial(material, seenMaterials, seenTextures);
      }
    }
  });
}
