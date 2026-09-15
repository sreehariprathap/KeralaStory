import { Suspense, useMemo, type RefObject } from 'react';
import { useLoader } from '@react-three/fiber';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

interface Props { url: string; height?: number; length?: number; rotationY?: number; name?: string; motion?: RefObject<{ speed: number; grounded: boolean }> }
function LoadedModel({ url, height, length, rotationY = 0, name }: Props) {
  const gltf = useLoader(GLTFLoader, url);
  const model = useMemo(() => {
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
    return root;
  }, [gltf.scene, height, length, rotationY, url]);
  return <primitive object={model} name={name ?? url} dispose={null}/>;
}
export function ModelAsset(props: Props) {
  return <Suspense fallback={<mesh position={[0,.8,0]} name="model-loading"><boxGeometry args={[.35,1.6,.35]}/><meshStandardMaterial color="#d5aa54" wireframe/></mesh>}><LoadedModel {...props}/></Suspense>;
}
