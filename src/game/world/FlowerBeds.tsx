import { Component, Suspense, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { InstancedMesh, Matrix4, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { terrainHeight } from '../../content/world/definition';
import { buildVariant } from '../render/bakeVariant';
import { bareGroundHeight, terrainCollidersReady } from './terrainProbe';
import { flowerPatches } from './flowerPlacement';

type Quality = 'low' | 'medium' | 'high';
interface Variant { url: string; node?: string; weight: number; height: readonly [number, number]; heavy?: boolean }

const DIR = '/assets/grass';
const PACK = `${DIR}/flowers_pack_4.glb`;
/** GLTFLoader strips the dots from the pack's node names ("Cylinder.009" → "Cylinder009"). */
const PACK_NODES = ['Cylinder009', 'Cylinder013', 'Cylinder014', 'Cylinder015', 'Cylinder010', 'Cylinder011', 'Cylinder012',
  'Circle009', 'Circle001', 'Circle002', 'Circle003', 'Cylinder002', 'Cylinder007', 'Cylinder008', 'Cylinder', 'Cylinder006'] as const;
const VARIANTS: readonly Variant[] = [
  ...PACK_NODES.map(node => ({ url: PACK, node, weight: 1, height: [.35, .6] as const })),
  { url: `${DIR}/flowers.glb`, weight: 5, height: [.45, .75] },
  // The aster clump is ~95k vertices: drawn only close to the camera, and never on low quality.
  { url: `${DIR}/${encodeURIComponent('flowers (1).glb')}`, weight: 2.5, height: [.6, .95], heavy: true },
];
const URLS = [...new Set(VARIANTS.map(v => v.url))];
const SETTINGS: Record<Quality, { radius: number; heavyRadius: number; keepEvery: number }> = {
  low: { radius: 70, heavyRadius: 0, keepEvery: 2 },
  medium: { radius: 110, heavyRadius: 40, keepEvery: 1 },
  high: { radius: 150, heavyRadius: 60, keepEvery: 1 },
};
const REFRESH_DISTANCE = 8;

interface Flower { variant: number; position: Vector3; matrix: Matrix4 }

function placeFlowers(world: ReturnType<typeof useRapier>['world']): Flower[] {
  const patches = flowerPatches(VARIANTS.map(v => v.weight), VARIANTS.map(v => v.height));
  const object = new Object3D();
  const flowers: Flower[] = [];
  for (const p of patches) {
    const y = bareGroundHeight(world, p.x, p.z);
    // Bare terrain only: no decks, floors, walls or trunks over the bed.
    if (y === null || Math.abs(y - terrainHeight(p.x, p.z)) > .6) continue;
    if ([[.6, 0], [-.6, 0], [0, .6], [0, -.6]].some(([dx, dz]) => bareGroundHeight(world, p.x + dx, p.z + dz) === null)) continue;
    object.position.set(p.x, y - .03, p.z);
    object.rotation.set(0, p.yaw, 0);
    object.scale.setScalar(p.height);
    object.updateMatrix();
    flowers.push({ variant: p.variant, position: object.position.clone(), matrix: object.matrix.clone() });
  }
  return flowers;
}

function Beds({ quality }: { quality: Quality }) {
  const { world } = useRapier();
  const gltfs = useLoader(GLTFLoader, URLS);
  const variants = useMemo(() => VARIANTS.map(v => buildVariant(gltfs[URLS.indexOf(v.url)].scene, v.node, v.url)), [gltfs]);
  useEffect(() => () => variants.flat().forEach(part => part.geometry.dispose()), [variants]);
  const [allFlowers, setAllFlowers] = useState<Flower[] | null>(null);
  const waited = useRef(0);
  const settings = SETTINGS[quality];

  useFrame(() => {
    if (allFlowers || ++waited.current % 15) return;
    if (terrainCollidersReady(world) || waited.current > 900) setAllFlowers(placeFlowers(world));
  });

  const flowers = useMemo(() => (allFlowers ?? []).filter((flower, i) => i % settings.keepEvery === 0 && (settings.heavyRadius > 0 || !VARIANTS[flower.variant].heavy)), [allFlowers, settings]);
  const byVariant = useMemo(() => VARIANTS.map((_, index) => flowers.filter(flower => flower.variant === index)), [flowers]);
  const meshes = useRef<(InstancedMesh | null)[][]>([]);
  const lastCenter = useRef<Vector3 | null>(null);
  useEffect(() => { lastCenter.current = null; }, [byVariant]);

  // Draw only beds near the camera: the whole world's flowers cost a fixed number of draw calls.
  useFrame(({ camera }) => {
    if (!flowers.length || (lastCenter.current && lastCenter.current.distanceTo(camera.position) < REFRESH_DISTANCE)) return;
    lastCenter.current = camera.position.clone();
    byVariant.forEach((list, v) => {
      const radius = VARIANTS[v].heavy ? settings.heavyRadius : settings.radius, r2 = radius * radius;
      let count = 0;
      for (const flower of list) {
        const dx = flower.position.x - camera.position.x, dz = flower.position.z - camera.position.z;
        if (dx * dx + dz * dz > r2) continue;
        meshes.current[v]?.forEach(mesh => mesh?.setMatrixAt(count, flower.matrix));
        count++;
      }
      meshes.current[v]?.forEach(mesh => { if (!mesh) return; mesh.count = count; mesh.instanceMatrix.needsUpdate = true; });
    });
  });

  if (!flowers.length) return null;
  return <group name="flower-beds">
    {variants.map((parts, v) => byVariant[v].length > 0 && parts.map((part, p) => (
      <instancedMesh key={`${v}-${p}-${byVariant[v].length}`} args={[part.geometry, part.material, byVariant[v].length]} frustumCulled={false} receiveShadow
        ref={mesh => { (meshes.current[v] ??= [])[p] = mesh; if (mesh) { mesh.count = 0; lastCenter.current = null; } }}/>
    )))}
  </group>;
}

class BedsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Flower beds unavailable', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Seeded flower beds under the trees and across the summit meadows. Optional scenery: a load failure never takes the world down. */
export const FlowerBeds = memo(function FlowerBeds({ quality = 'medium' }: { quality?: Quality }) {
  return <BedsBoundary><Suspense fallback={null}><Beds quality={quality}/></Suspense></BedsBoundary>;
});
