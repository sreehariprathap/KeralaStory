import { BufferGeometry, Group, Mesh, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake static single-material meshes by material and attribute layout. Source buffers stay shared/read-only. */
export function batchStaticAsset(root: Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: Material; sources: Mesh[]; geometries: BufferGeometry[] }>();
  root.traverse(object => {
    if (!(object instanceof Mesh) || 'isSkinnedMesh' in object || Array.isArray(object.material) || object.morphTargetInfluences?.length) return;
    const geometry = object.geometry;
    const layout = Object.keys(geometry.attributes).sort().map(name => `${name}:${geometry.attributes[name].itemSize}:${geometry.attributes[name].normalized}`).join('|');
    const key = `${object.material.uuid}:${layout}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, bucket = { material: object.material, sources: [], geometries: [] });
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    baked.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
    bucket.sources.push(object); bucket.geometries.push(baked);
  });
  const owned: BufferGeometry[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.sources.length < 2) { bucket.geometries.forEach(g => g.dispose()); continue; }
    const geometry = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, bucket.material);
    mesh.name = `batched-${bucket.material.name || 'surface'}`;
    mesh.castShadow = true; mesh.receiveShadow = true;
    bucket.sources.forEach(source => source.removeFromParent());
    root.add(mesh); owned.push(geometry);
  }
  return () => owned.forEach(geometry => geometry.dispose());
}
