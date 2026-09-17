import { Suspense, useEffect, useMemo, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createNickAnimation, type CharacterRig } from '../player/nickAnimation';
import type { AvatarMotion } from '../player/ExplorerAvatar';
import type { CarModelId } from '../../content/assets/models';
import type { CarMotion } from '../vehicle/carPhysics';
import { createCarWheelAnimation } from '../vehicle/carWheelAnimation';
import { applyVehicleMaterials, removeHiddenVehicleNodes } from '../vehicle/vehicleMaterials';
import { configureLegacyAssetMaterials } from './legacyAssetMaterials';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';

interface Props { url: string; height?: number; length?: number; rotationY?: number; name?: string; motion?: RefObject<AvatarMotion>; animation?: CharacterRig; carModel?: CarModelId; carMotion?: RefObject<CarMotion>; carColor?: string }

function LoadedModel({ url, height, length, rotationY = 0, name, motion, animation, carModel, carMotion, carColor }: Props) {
  const gltf = useLoader(GLTFLoader, url, configureLegacyAssetMaterials);
  const { model, animator, wheelAnimator, ownedMaterials, paintMaterials } = useMemo(() => {
    const root = new Group();
    const scene = clone(gltf.scene);
    if (carModel) removeHiddenVehicleNodes(scene, carModel);
    const { owned: ownedMaterials, paint: paintMaterials } = carModel ? applyVehicleMaterials(scene, carModel) : { owned: [], paint: [] };
    scene.rotation.y += rotationY;
    root.add(scene);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root, true);
    const size = bounds.getSize(new Vector3());
    const profile = carModel ? VEHICLE_PROFILES[carModel] : undefined;
    const scale = height ? height / size.y : profile && !profile.legacyBoundsCap ? profile.length / size.z : Math.min((length ?? 3.8) / size.z, 1.8 / size.x, 1.7 / size.y);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid model bounds: ${url}`);
    root.scale.setScalar(scale);
    scene.position.x -= (bounds.min.x + bounds.max.x) / 2;
    scene.position.y -= bounds.min.y;
    scene.position.z -= (bounds.min.z + bounds.max.z) / 2;
    scene.traverse(object => { if ('isMesh' in object) { object.castShadow = true; object.receiveShadow = true; } });
    const animator = animation ? createNickAnimation(root, animation) : null;
    // Normalization (including root scale and centering) must happen before wheel pivots.
    const wheelAnimator = carModel ? createCarWheelAnimation(root, carModel) : null;
    animator?.update(0, { speed: 0, grounded: true });
    return { model: root, animator, wheelAnimator, ownedMaterials, paintMaterials };
  }, [gltf.scene, height, length, rotationY, url, animation, carModel]);
  useEffect(() => () => ownedMaterials.forEach(material => material.dispose()), [ownedMaterials]);
  useEffect(() => { if (carColor) paintMaterials.forEach(material => material.color.set(carColor)); }, [carColor, paintMaterials]);
  useFrame((_, delta) => {
    animator?.update(delta, motion?.current ?? { speed: 0, grounded: true });
    wheelAnimator?.update(carMotion?.current);
  });
  return <primitive object={model} name={name ?? url} dispose={null}/>;
}
export function ModelAsset(props: Props) {
  return <Suspense fallback={<mesh position={[0,.8,0]} name="model-loading"><boxGeometry args={[.35,1.6,.35]}/><meshStandardMaterial color="#d5aa54" wireframe/></mesh>}><LoadedModel {...props}/></Suspense>;
}
