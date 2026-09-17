import { Suspense, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { configureLegacyAssetMaterials } from '../render/legacyAssetMaterials';

export const GLIDER_CANOPY_URL = '/assets/adventure/parachute_-_low_poly.glb';
/**
 * The model carries its own lines and a harness bar at the bottom (about a quarter of the span).
 * At this span the bar is roughly shoulder-wide and the arch stays in the chase camera's frame.
 */
const CANOPY_SPAN_M = 4.2;
/** Top of the pack, where the harness bar rests. */
const PACK_TOP_M = .24;
const OPEN_SECONDS = .6;

export interface GliderPose { bank: number }

function Canopy() {
  const gltf = useLoader(GLTFLoader, GLIDER_CANOPY_URL, configureLegacyAssetMaterials);
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse(object => { object.castShadow = true; object.frustumCulled = false; });
    const box = new Box3().setFromObject(scene), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
    const scale = CANOPY_SPAN_M / Math.max(size.x, size.z);
    // Centre the canopy over the pack with the harness bar (the model's lowest point) at the origin.
    scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    scene.scale.setScalar(scale);
    const root = new Group();
    root.add(scene);
    return root;
  }, [gltf]);
  return <primitive object={model}/>;
}

function Pack() {
  return <group>
    <mesh castShadow position={[0, 0, -.1]}><boxGeometry args={[.36, .48, .22]}/><meshStandardMaterial color="#8a3b24" roughness={.8}/></mesh>
    <mesh position={[0, .2, -.1]}><boxGeometry args={[.38, .08, .24]}/><meshStandardMaterial color="#d9a441" roughness={.7}/></mesh>
    {[-.12, .12].map(x => <mesh key={x} position={[x, -.02, .06]}><boxGeometry args={[.05, .5, .04]}/><meshStandardMaterial color="#2f2a24" roughness={.9}/></mesh>)}
  </group>;
}

interface Props {
  pose: RefObject<GliderPose>;
  /** Height of the pack's centre above the rider's feet. */
  backHeight: number;
  reducedMotion?: boolean;
}

/** Pack on the rider's back plus the canopy flying above it. Rider-local: +Z is forward. */
export function GliderVisual({ pose, backHeight, reducedMotion }: Props) {
  const wing = useRef<Group>(null), opened = useRef(reducedMotion ? 1 : 0);
  useFrame((_, delta) => {
    const group = wing.current;
    if (!group) return;
    opened.current = Math.min(1, opened.current + delta / OPEN_SECONDS);
    const open = 1 - (1 - opened.current) ** 3;
    group.scale.setScalar(.2 + .8 * open);
    // The wing swings out over the turn; positive bank turns right (heading increases).
    const k = 1 - Math.exp(-6 * Math.min(delta, .1));
    group.rotation.z += (-(pose.current?.bank ?? 0) - group.rotation.z) * k;
  });
  return <group position={[0, backHeight, -.17]}>
    <Pack/>
    <group ref={wing} position={[0, PACK_TOP_M, -.1]}>
      <Suspense fallback={null}><Canopy/></Suspense>
    </group>
  </group>;
}
