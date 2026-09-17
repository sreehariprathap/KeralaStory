import { Box3, BufferGeometry, Mesh, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Part { geometry: BufferGeometry; material: Material }

/** Bakes one model (or one named node of it) into unit height with its base at the origin, merged into one geometry per material. */
export function buildVariant(scene: Object3D, node: string | undefined, url: string): Part[] {
  scene.updateMatrixWorld(true);
  const root = node ? scene.getObjectByName(node) : scene;
  if (!root) throw new Error(`Variant ${node} missing in ${url}`);
  const byMaterial = new Map<Material, BufferGeometry[]>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(object.matrixWorld);
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), geometry]);
  });
  if (!byMaterial.size) throw new Error(`Variant has no mesh: ${url} ${node ?? ''}`);
  const parts = [...byMaterial].map(([material, pieces]) => ({ material, geometry: mergePieces(pieces) }));
  const bounds = new Box3();
  parts.forEach(part => { part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!); });
  const height = Math.max(bounds.max.y - bounds.min.y, .001);
  // Anchor at the trunk foot (the lowest vertices), not the bounds centre, so leaning models stand on their base.
  let sx = 0, sz = 0, n = 0;
  for (const { geometry } of parts) {
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (p.getY(i) <= bounds.min.y + height * .04) { sx += p.getX(i); sz += p.getZ(i); n++; }
  }
  const baseX = n ? sx / n : (bounds.min.x + bounds.max.x) / 2, baseZ = n ? sz / n : (bounds.min.z + bounds.max.z) / 2;
  for (const { geometry } of parts) {
    geometry.translate(-baseX, -bounds.min.y, -baseZ);
    geometry.scale(1 / height, 1 / height, 1 / height);
    geometry.computeBoundingSphere();
  }
  return parts;
}

export function mergePieces(pieces: BufferGeometry[]): BufferGeometry {
  if (pieces.length === 1) return pieces[0];
  const indexed = pieces.every(g => g.index);
  const shared = Object.keys(pieces[0].attributes).filter(name => pieces.every(g => g.getAttribute(name)));
  const prepared = pieces.map(g => {
    const source = indexed ? g : g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(source.attributes)) if (!shared.includes(name)) source.deleteAttribute(name);
    source.morphAttributes = {};
    return source;
  });
  return mergeGeometries(prepared, false) ?? prepared[0];
}
