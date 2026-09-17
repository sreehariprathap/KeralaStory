import { Component, Suspense, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { CylinderCollider, RigidBody, useRapier } from '@react-three/rapier';
import { Box3, BufferGeometry, InstancedMesh, Matrix4, Mesh, Object3D, Vector3, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainHeight } from '../../content/world/definition';
import { bareGroundHeight as groundHeight, terrainCollidersReady } from './terrainProbe';
import { coconutCandidates } from './coconutPlacement';

type Quality = 'low' | 'medium' | 'high';
interface Variant { url: string; node?: string; weight: number; height: readonly [number, number]; heavy?: boolean }

const DIR = '/assets/Coconut-trees';
const PACK = `${DIR}/stylized_palm__coconut_tree_pack.glb`;
/** Weights favour the light models; the ~7k-triangle pack palms are sprinkled in and skipped on low quality. */
const VARIANTS: readonly Variant[] = [
  { url: `${DIR}/coconut_tree.glb`, weight: 30, height: [11, 15] },
  { url: `${DIR}/${encodeURIComponent('coconut_tree (1).glb')}`, weight: 8, height: [11, 15] },
  { url: `${DIR}/low_poly_coconut_1.glb`, weight: 10, height: [10, 14] },
  { url: `${DIR}/low_poly_coconut_2.glb`, weight: 10, height: [9, 13] },
  { url: `${DIR}/low_poly_coconut_3.glb`, weight: 10, height: [9, 13] },
  ...(['PalmTree1', 'PalmTree2', 'PalmTree4', 'PalmTree5'] as const).map(node => ({ url: PACK, node, weight: 1.5, height: [10, 14] as const, heavy: true })),
  { url: PACK, node: 'PalmTree3', weight: 1.5, height: [5, 7], heavy: true },
];
const URLS = [...new Set(VARIANTS.map(v => v.url))];
const SETTINGS: Record<Quality, { radius: number; keepEvery: number; heavy: boolean; shadows: boolean }> = {
  low: { radius: 170, keepEvery: 3, heavy: false, shadows: false },
  medium: { radius: 250, keepEvery: 1, heavy: true, shadows: true },
  // The scene fog is opaque by 285 m, so nothing further away is worth drawing.
  high: { radius: 290, keepEvery: 1, heavy: true, shadows: true },
};
const TRUNK_RADIUS = .28, TRUNK_HALF_HEIGHT = 2;
const REFRESH_DISTANCE = 12;

interface Part { geometry: BufferGeometry; material: Material }
interface Tree { variant: number; position: Vector3; matrix: Matrix4 }

/** Bakes one tree into unit height with its trunk base at the origin, merged into one geometry per material. */
function buildVariant(scene: Object3D, node: string | undefined, url: string): Part[] {
  scene.updateMatrixWorld(true);
  const root = node ? scene.getObjectByName(node) : scene;
  if (!root) throw new Error(`Coconut variant ${node} missing in ${url}`);
  const byMaterial = new Map<Material, BufferGeometry[]>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(object.matrixWorld);
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), geometry]);
  });
  if (!byMaterial.size) throw new Error(`Coconut variant has no mesh: ${url} ${node ?? ''}`);
  const parts = [...byMaterial].map(([material, pieces]) => ({ material, geometry: mergePieces(pieces) }));
  const bounds = new Box3();
  parts.forEach(part => { part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!); });
  const height = Math.max(bounds.max.y - bounds.min.y, .001);
  // Anchor at the trunk foot (the lowest vertices), not the bounds centre, so leaning palms stand on their base.
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

function mergePieces(pieces: BufferGeometry[]): BufferGeometry {
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

function placeTrees(world: ReturnType<typeof useRapier>['world']): Tree[] {
  const candidates = coconutCandidates(VARIANTS.map(v => v.weight), VARIANTS.map(v => v.height));
  const object = new Object3D();
  object.rotation.order = 'YXZ';
  const trees: Tree[] = [];
  for (const c of candidates) {
    const y = groundHeight(world, c.x, c.z);
    if (y === null || Math.abs(y - terrainHeight(c.x, c.z)) > 2) continue;
    // The trunk footprint must also be open ground: this rejects spots against walls, decks and bridges.
    if ([[1.8, 0], [-1.8, 0], [0, 1.8], [0, -1.8]].some(([dx, dz]) => groundHeight(world, c.x + dx, c.z + dz) === null)) continue;
    object.position.set(c.x, y - .05, c.z);
    object.rotation.set(c.lean, c.yaw, 0);
    object.scale.setScalar(c.height);
    object.updateMatrix();
    trees.push({ variant: c.variant, position: object.position.clone(), matrix: object.matrix.clone() });
  }
  return trees;
}

function Groves({ quality }: { quality: Quality }) {
  const { world } = useRapier();
  const gltfs = useLoader(GLTFLoader, URLS);
  const variants = useMemo(() => VARIANTS.map(v => buildVariant(gltfs[URLS.indexOf(v.url)].scene, v.node, v.url)), [gltfs]);
  useEffect(() => () => variants.flat().forEach(part => part.geometry.dispose()), [variants]);
  const [allTrees, setAllTrees] = useState<Tree[] | null>(null);
  const waited = useRef(0);
  const settings = SETTINGS[quality];

  // Terrain colliders mount with the world; wait until both the original and V2 ground answer rays.
  useFrame(() => {
    if (allTrees || ++waited.current % 15) return;
    if (terrainCollidersReady(world) || waited.current > 900) setAllTrees(placeTrees(world));
  });

  const trees = useMemo(() => (allTrees ?? []).filter((tree, i) => i % settings.keepEvery === 0 && (settings.heavy || !VARIANTS[tree.variant].heavy)), [allTrees, settings]);
  const byVariant = useMemo(() => VARIANTS.map((_, index) => trees.filter(tree => tree.variant === index)), [trees]);
  const meshes = useRef<(InstancedMesh | null)[][]>([]);
  const lastCenter = useRef<Vector3 | null>(null);
  useEffect(() => { lastCenter.current = null; }, [byVariant]);

  // Draw only palms near the camera, so the whole-world grove costs a fixed number of draw calls.
  useFrame(({ camera }) => {
    if (!trees.length || (lastCenter.current && lastCenter.current.distanceTo(camera.position) < REFRESH_DISTANCE)) return;
    lastCenter.current = camera.position.clone();
    const r2 = settings.radius * settings.radius;
    byVariant.forEach((list, v) => {
      let count = 0;
      for (const tree of list) {
        const dx = tree.position.x - camera.position.x, dz = tree.position.z - camera.position.z;
        if (dx * dx + dz * dz > r2) continue;
        meshes.current[v]?.forEach(mesh => mesh?.setMatrixAt(count, tree.matrix));
        count++;
      }
      meshes.current[v]?.forEach(mesh => { if (!mesh) return; mesh.count = count; mesh.instanceMatrix.needsUpdate = true; });
    });
  });

  if (!trees.length) return null;
  return <group name="coconut-groves">
    {variants.map((parts, v) => byVariant[v].length > 0 && parts.map((part, p) => (
      <instancedMesh key={`${v}-${p}-${byVariant[v].length}`} args={[part.geometry, part.material, byVariant[v].length]} frustumCulled={false}
        castShadow={settings.shadows} receiveShadow
        ref={mesh => { (meshes.current[v] ??= [])[p] = mesh; if (mesh) { mesh.count = 0; lastCenter.current = null; } }}/>
    )))}
    <RigidBody type="fixed" colliders={false}>
      {trees.map((tree, i) => <CylinderCollider key={i} args={[TRUNK_HALF_HEIGHT, TRUNK_RADIUS]} position={[tree.position.x, tree.position.y + TRUNK_HALF_HEIGHT, tree.position.z]}/>)}
    </RigidBody>
  </group>;
}

class GroveBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Coconut groves unavailable', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Seeded coconut palms across the lowlands. Optional scenery: a load failure never takes the world down. */
export const CoconutGroves = memo(function CoconutGroves({ quality = 'medium' }: { quality?: Quality }) {
  return <GroveBoundary><Suspense fallback={null}><Groves quality={quality}/></Suspense></GroveBoundary>;
});
