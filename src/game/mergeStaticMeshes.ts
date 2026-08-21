import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function mergeStaticMeshesByMaterial(
  parent: THREE.Object3D,
  meshes: readonly THREE.Mesh[],
) {
  const result: THREE.Mesh[] = [];
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();

  for (const mesh of meshes) {
    if (mesh.parent !== parent || Array.isArray(mesh.material)) {
      result.push(mesh);
      continue;
    }
    const bucket = buckets.get(mesh.material) ?? [];
    bucket.push(mesh);
    buckets.set(mesh.material, bucket);
  }

  for (const [material, bucket] of buckets) {
    if (bucket.length < 2) {
      result.push(bucket[0]);
      continue;
    }

    const geometries = bucket.map((mesh) => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(geometries, false);
    for (const source of geometries) source.dispose();
    if (!geometry) {
      result.push(...bucket);
      continue;
    }

    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = bucket.some((mesh) => mesh.castShadow);
    merged.receiveShadow = bucket.some((mesh) => mesh.receiveShadow);
    merged.renderOrder = Math.max(...bucket.map((mesh) => mesh.renderOrder));
    parent.remove(...bucket);
    parent.add(merged);
    result.push(merged);
  }

  for (const mesh of result) {
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
  }

  return result;
}
