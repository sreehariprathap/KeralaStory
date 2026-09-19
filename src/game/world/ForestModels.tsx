import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { Box3, BufferAttribute, Color, Mesh, MeshStandardMaterial, Object3D, Vector3, type BufferGeometry, type InstancedMesh, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Forest trees and rocks split out of the low-poly packs by scripts/split-forest-assets.mjs.
 * weight is how often a tree turns up; size scales the site's nominal tree height for that shape
 * (a bush sits lower than a pine); tint darkens over-bright source greens.
 */
export interface ForestModel { id: string; url: string; weight: number; size: number; tint?: string; light?: boolean }

const tree = (id: string, weight: number, size: number, extra: Partial<ForestModel> = {}): ForestModel =>
  ({ id, url: `/assets/trees/forest/${id}.glb`, weight, size, ...extra });

/** Lowland and mid-hill broadleaf forest: rounded crowns first, a few palms, pines and old snags. */
export const BROADLEAF_FOREST: ForestModel[] = [
  tree('round-broadleaf', 5, 1, { light: true }),
  tree('wide-canopy', 4, .95, { light: true }),
  tree('layered-bush', 3, .8, { light: true }),
  tree('box-canopy', 3, 1.05),
  tree('twisted', 3, .9),
  tree('acacia-pair', 1, 1),
  tree('cypress', 2, 1, { light: true }),
  tree('palm', 2, 1.2),
  tree('drooping-palm', 1, 1.15),
  tree('pine', 1, 1.05, { light: true, tint: '#b8c9a4' }),
  tree('gnarled-dead', .4, .85),
];

/** Shola hill forest: dense evergreen crowns with tall conifers and cypress on the upper slopes. */
export const SHOLA_FOREST: ForestModel[] = [
  tree('round-broadleaf', 4, 1, { light: true }),
  tree('wide-canopy', 3, .95, { light: true }),
  tree('layered-bush', 3, .8, { light: true }),
  tree('box-canopy', 2, 1.05),
  tree('twisted', 2, .9),
  tree('cypress', 3, 1, { light: true }),
];
/** Tall, narrow shapes for the emergent trees that stand above the shola canopy. */
export const SHOLA_EMERGENT: ForestModel[] = [
  tree('tall-pine', 3, 1, { tint: '#9fb28b' }),
  tree('slim-pine', 2, .95, { tint: '#9fb28b' }),
  tree('pine', 2, 1, { light: true, tint: '#b8c9a4' }),
  tree('cypress', 2, .9, { light: true }),
];

export const FOREST_ROCKS: ForestModel[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: `rock-${i + 1}`, url: `/assets/rocks/forest/rock-${i + 1}.glb`, weight: 1, size: 1 })),
  { id: 'boulder', url: '/assets/rocks/forest/boulder.glb', weight: 2, size: 1 },
];

/** Stable 0..1 from an integer and a salt, for choosing shapes without disturbing a site's RNG stream. */
export function hash01(n: number, salt = 0) {
  let t = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x7feb352d); t = Math.imul(t ^ (t >>> 15), 0x846ca68b);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Weighted pick; low tier restricts itself to the light (few-hundred-triangle) shapes. */
export function pickModel(models: ForestModel[], roll: number, lightOnly = false) {
  const pool = lightOnly && models.some(m => m.light) ? models.filter(m => m.light) : models;
  const total = pool.reduce((sum, m) => sum + m.weight, 0);
  let r = roll * total;
  for (const m of pool) if ((r -= m.weight) < 0) return m;
  return pool[pool.length - 1];
}

export type ForestModelInstance = {
  position: [number, number, number];
  yaw: number;
  /** Metres per normalized unit on each axis. */
  scale: [number, number, number];
  /** 0..1 brightness jitter so neighbouring copies do not read as clones. */
  shade: number;
};

export type ForestModelGroup = { model: ForestModel; items: ForestModelInstance[] };

/**
 * Buckets placed instances by their chosen model id, in catalog order, dropping unused models.
 * Catalogs may share a model; it is still drawn once.
 */
export function bucketByModel(models: ForestModel[], entries: { model: ForestModel; item: ForestModelInstance }[]): ForestModelGroup[] {
  const groups = new Map<string, ForestModelGroup>();
  for (const m of models) if (!groups.has(m.id)) groups.set(m.id, { model: m, items: [] });
  entries.forEach(({ model, item }) => groups.get(model.id)!.items.push(item));
  return [...groups.values()].filter(g => g.items.length > 0);
}

type Part = { geometry: BufferGeometry; material: Material };

/**
 * Loads one split model and instances it. Untextured materials are baked into vertex colours and
 * merged, so a whole tree is one draw call; textured parts keep their material.
 * normalize: 'height' makes the model 1 unit tall; 'footprint' makes its widest horizontal
 * half-extent 1 unit, keeping its proportions (for rocks).
 */
export const ForestModelMesh = memo(function ForestModelMesh({ model, data, normalize = 'height', shadows = true }: {
  model: ForestModel; data: ForestModelInstance[]; normalize?: 'height' | 'footprint'; shadows?: boolean;
}) {
  const gltf = useLoader(GLTFLoader, model.url);
  const parts = useMemo<Part[]>(() => {
    gltf.scene.updateMatrixWorld(true);
    const plain: BufferGeometry[] = [], textured: Part[] = [], bounds = new Box3();
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(object.matrixWorld);
      bounds.expandByObject(new Mesh(geometry));
      const material = (Array.isArray(object.material) ? object.material[0] : object.material) as MeshStandardMaterial;
      if (material.map) { textured.push({ geometry, material }); return; }
      // Bake the flat material colour per vertex, keeping only what the merged material reads.
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      const count = flat.attributes.position.count, colors = new Float32Array(count * 3), c = material.color ?? new Color('#fff');
      const source = flat.attributes.color;
      for (let i = 0; i < count; i++) {
        colors[i * 3] = c.r * (source ? source.getX(i) : 1); colors[i * 3 + 1] = c.g * (source ? source.getY(i) : 1); colors[i * 3 + 2] = c.b * (source ? source.getZ(i) : 1);
      }
      for (const name of Object.keys(flat.attributes)) if (name !== 'position') flat.deleteAttribute(name);
      flat.setAttribute('color', new BufferAttribute(colors, 3));
      plain.push(flat);
    });
    const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const unit = normalize === 'height' ? 1 / Math.max(size.y, 1e-3) : 2 / Math.max(size.x, size.z, 1e-3);
    const result: Part[] = [...textured];
    if (plain.length) {
      const merged = mergeGeometries(plain);
      plain.forEach(g => g.dispose());
      result.push({ geometry: merged, material: new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }) });
    }
    result.forEach(part => {
      part.geometry.translate(-center.x, -bounds.min.y, -center.z);
      part.geometry.scale(unit, unit, unit);
      if (!part.geometry.attributes.normal) part.geometry.computeVertexNormals();
    });
    return result;
  }, [gltf.scene, normalize]);

  useEffect(() => () => parts.forEach(part => {
    part.geometry.dispose();
    // Only the merged material is ours; the GLTF cache owns the textured ones.
    if ((part.material as MeshStandardMaterial).vertexColors) part.material.dispose();
  }), [parts]);

  return <group>{parts.map((part, i) => <ForestModelPart key={i} part={part} data={data} tint={model.tint} shadows={shadows}/>)}</group>;
});

function ForestModelPart({ part, data, tint, shadows }: { part: Part; data: ForestModelInstance[]; tint?: string; shadows: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D(), base = new Color(tint ?? '#ffffff'), color = new Color();
    data.forEach((instance, i) => {
      object.position.set(...instance.position);
      object.rotation.set(0, instance.yaw, 0);
      object.scale.set(...instance.scale);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
      mesh.setColorAt(i, color.copy(base).multiplyScalar(.82 + instance.shade * .22));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [data, tint]);
  return <instancedMesh key={data.length} ref={ref} args={[part.geometry, part.material, data.length]} castShadow={shadows} receiveShadow />;
}

/** One instanced mesh per model in use. */
export function ForestModelSet({ groups, normalize, shadows }: {
  groups: ForestModelGroup[]; normalize?: 'height' | 'footprint'; shadows?: boolean;
}) {
  return <>{groups.map(g => <ForestModelMesh key={g.model.id} model={g.model} data={g.items} normalize={normalize} shadows={shadows}/>)}</>;
}
