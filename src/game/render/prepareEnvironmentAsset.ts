import { Box3, Color, Group, Mesh, Vector3, type Material, type Object3D } from 'three';
import { batchStaticAsset } from './batchStaticAsset';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { V2AssetProfile } from '../../content/assets/v2AssetProfiles';

/** Never modifies cached source transforms/materials, and never disposes shared textures. */
export function prepareEnvironmentAsset(source: Object3D, profile: V2AssetProfile) {
  const scene = clone(source);
  for (const pattern of profile.removePatterns ?? []) {
    const matches: Object3D[] = [];
    scene.traverse(node => { if (pattern.test(node.name)) matches.push(node); });
    if (!matches.length) throw new Error(`${profile.id}: missing extraction pattern ${pattern}`);
    matches.forEach(node => node.removeFromParent());
  }
  for (const name of profile.removeNodes) {
    const node = scene.getObjectByName(name);
    if (!node || !node.parent) throw new Error(`${profile.id}: missing extraction node ${name}`);
    node.removeFromParent();
  }
  const rotated = new Group(); rotated.rotation.y = profile.rotationY; rotated.add(scene);
  const centered = new Group(); centered.add(rotated);
  const root = new Group(); root.add(centered); root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root, true), sourceSize = bounds.getSize(new Vector3());
  const scale = profile.sizeM / sourceSize[profile.sizeAxis];
  if (bounds.isEmpty() || !sourceSize.toArray().every(Number.isFinite) || !Number.isFinite(scale) || scale <= 0) {
    throw new Error(`${profile.id}: invalid model bounds`);
  }
  const groundOffsetLocal = (profile.groundOffsetM ?? 0) / scale;
  const offsetXLocal = (profile.offsetXM ?? 0) / scale;
  const offsetZLocal = (profile.offsetZM ?? 0) / scale;
  centered.position.set(
    -(bounds.min.x + bounds.max.x) / 2 + offsetXLocal,
    -bounds.min.y + groundOffsetLocal,
    -(bounds.min.z + bounds.max.z) / 2 + offsetZLocal,
  );
  root.scale.setScalar(scale); root.updateMatrixWorld(true);
  const { saturationBoost = 0, lightnessBoost = 0 } = profile;
  const hsl = { h: 0, s: 0, l: 0 };
  const boostColor = (color: Color) => {
    color.getHSL(hsl);
    color.setHSL(hsl.h, Math.min(1, Math.max(0, hsl.s + saturationBoost)), Math.min(1, Math.max(0, hsl.l + lightnessBoost)));
  };
  const owned = new Map<Material, Material>();
  let meshes = 0, triangles = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3;
    const copy = (material: Material) => {
      if (!owned.has(material)) {
        const cloned = material.clone();
        if ((saturationBoost || lightnessBoost) && 'color' in cloned && cloned.color instanceof Color) boostColor(cloned.color);
        owned.set(material, cloned);
      }
      return owned.get(material)!;
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    object.castShadow = true; object.receiveShadow = true;
  });
  const disposeBatch = profile.batchStatic ? batchStaticAsset(root) : undefined;
  let drawMeshes = 0; root.traverse(object => { if (object instanceof Mesh) drawMeshes++; });
  return { root, drawMeshes, size: sourceSize.multiplyScalar(scale), meshes, triangles: Math.round(triangles),
    dispose: () => { disposeBatch?.(); owned.forEach(material => material.dispose()); } };
}
