import { Suspense, useEffect, useMemo, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { AnimationMixer, Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { configureLegacyAssetMaterials } from '../render/legacyAssetMaterials';

export const PLANE_MODEL_URL = '/assets/flight/stylized_ww1_plane.glb';
/** Wingspan of the normalised model (m). */
const WINGSPAN_M = 9;
/** Turns the model so its nose points along +z, the pilot's forward. */
const MODEL_YAW = 0;

export interface PlaneMotion { throttle: number }

function Model({ motion }: { motion?: RefObject<PlaneMotion> }) {
  const gltf = useLoader(GLTFLoader, PLANE_MODEL_URL, configureLegacyAssetMaterials);
  const { root, mixer } = useMemo(() => {
    const scene = clone(gltf.scene);
    scene.rotation.y = MODEL_YAW;
    const root = new Group();
    root.add(scene);
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root, true), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
    const scale = WINGSPAN_M / Math.max(size.x, 1e-6);
    // Wheels (the model's lowest point) at the origin, centred over it in plan.
    scene.position.set(-center.x, -box.min.y, -center.z);
    root.scale.setScalar(scale);
    scene.traverse(object => { if ('isMesh' in object) { object.castShadow = true; object.frustumCulled = false; } });
    const mixer = gltf.animations.length ? new AnimationMixer(scene) : null;
    gltf.animations.forEach(clip => mixer!.clipAction(clip).play());
    return { root, mixer };
  }, [gltf]);
  useEffect(() => () => { mixer?.stopAllAction(); }, [mixer]);
  // The baked clip spins the propeller: idle when parked, racing at full throttle.
  useFrame((_, delta) => { mixer?.update(Math.min(delta, .1) * (motion?.current ? .15 + motion.current.throttle * 1.6 : 0)); });
  return <primitive object={root} dispose={null}/>;
}

/** The WW1 biplane, origin between the wheels, nose toward +z. */
export function PlaneVisual({ motion }: { motion?: RefObject<PlaneMotion> }) {
  return <Suspense fallback={null}><Model motion={motion}/></Suspense>;
}
