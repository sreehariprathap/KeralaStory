import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide } from 'three';
import { CHALAKKUDY_STREET, terrainHeight } from '../../content/world/definition';
import { COFFEE_COLLISION_PROFILE, V2_ASSET_PROFILES } from '../../content/assets/v2AssetProfiles';
import { EnvironmentAsset } from '../render/EnvironmentAsset';
import { ExpansionSign } from './ExpansionSign';
import { createTownGeometry } from './townGeometry';

const coffeeProfile = V2_ASSET_PROFILES.find(p => p.id === 'coffee-shop')!;
const coffee = CHALAKKUDY_STREET.buildings.find(b => b.kind === 'coffee')!;

/** First Chalakkudy street only; other towns remain terrain sites. */
export function TownWorld() {
  const geometry = useMemo(() => createTownGeometry(CHALAKKUDY_STREET, terrainHeight), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="chalakkudy-first-street">
    <mesh geometry={geometry} receiveShadow castShadow><meshStandardMaterial vertexColors roughness={.92} side={DoubleSide}/></mesh>
    <RigidBody type="fixed" colliders={false}>
      {CHALAKKUDY_STREET.boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
    <group position={coffee.origin} rotation={[0, coffee.yaw, 0]}>
      <EnvironmentAsset profile={coffeeProfile} fallback={<group name="coffee-loading-or-unavailable">
        <mesh position={[...COFFEE_COLLISION_PROFILE.shellPosition]}><boxGeometry args={[...COFFEE_COLLISION_PROFILE.shellSize]}/><meshStandardMaterial color="#e5d7b3" roughness={1}/></mesh>
        <mesh position={[0, COFFEE_COLLISION_PROFILE.floorSize[1]/2, 0]}><boxGeometry args={[...COFFEE_COLLISION_PROFILE.floorSize]}/><meshStandardMaterial color="#a98569" roughness={1}/></mesh>
      </group>}/>
    </group>
    {CHALAKKUDY_STREET.buildings.filter(b => b.label).map(b => <group key={b.id} position={b.origin} rotation={[0, b.yaw, 0]}>
      <ExpansionSign position={[b.kind === 'coffee' ? 3.2 : 0, b.floorY, b.depth / 2 - .5]} label={b.label} width={b.kind === 'coffee' ? 2.8 : 4.5}/>
    </group>)}
  </group>;
}
