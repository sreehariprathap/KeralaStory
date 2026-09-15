import { Suspense, useMemo, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createNickAnimation } from '../player/nickAnimation';
import type { AvatarMotion } from '../player/ExplorerAvatar';

interface Props { url: string; height?: number; length?: number; rotationY?: number; name?: string; motion?: RefObject<AvatarMotion>; animation?: 'nick' | 'kid-boy' | 'little-girl' }
function LoadedModel({ url, height, length, rotationY = 0, name, motion, animation }: Props) {
  const gltf = useLoader(GLTFLoader, url);
  const { model, animator } = useMemo(() => {
    const root = new Group();
    const scene = clone(gltf.scene);
    scene.rotation.y += rotationY;
    root.add(scene);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root, true);
    const size = bounds.getSize(new Vector3());
    const scale = height ? height / size.y : Math.min((length ?? 3.8) / size.z, 1.8 / size.x, 1.7 / size.y);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid model bounds: ${url}`);
    root.scale.setScalar(scale);
    scene.position.x -= (bounds.min.x + bounds.max.x) / 2;
    scene.position.y -= bounds.min.y;
    scene.position.z -= (bounds.min.z + bounds.max.z) / 2;
    scene.traverse(object => { if ('isMesh' in object) { object.castShadow = true; object.receiveShadow = true; } });
    const animator = animation ? createNickAnimation(root, animation) : null;
    animator?.update(0, { speed: 0, grounded: true });
    return { model: root, animator };
  }, [gltf.scene, height, length, rotationY, url, animation]);
  useFrame((_, delta) => animator?.update(delta, motion?.current ?? { speed: 0, grounded: true }));
  return <primitive object={model} name={name ?? url} dispose={null}/>;
}
export function ModelAsset(props: Props) {
  return <Suspense fallback={<mesh position={[0,.8,0]} name="model-loading"><boxGeometry args={[.35,1.6,.35]}/><meshStandardMaterial color="#d5aa54" wireframe/></mesh>}><LoadedModel {...props}/></Suspense>;
}
