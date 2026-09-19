import { EnvironmentAsset } from '../render/EnvironmentAsset';
import { ExpansionSign } from './ExpansionSign';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { V2_ASSET_PROFILES } from '../../content/assets/v2AssetProfiles';
import { WaterPark } from './WaterPark';
import { terrainHeight } from '../../content/world/definition';

type V3 = readonly [number, number, number];
import { TOWN_BUILDINGS, buildingGround, parkPoolLayout, v2DressingBoxes, type Building } from '../../content/world/v2Dressing';

const fuelProfile = V2_ASSET_PROFILES.find(asset => asset.id === 'fuel-station')!;


function House({ building }: { building: Building }) {
  const ground = buildingGround(building);
  const y = ground.max;
  return <group position={[building.x, y, building.z]}>
    <mesh position={[0, building.height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[building.width, building.height, building.depth]} />
      <meshStandardMaterial color={building.wall} roughness={.94} />
    </mesh>
    <mesh position={[0, building.height + .72, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[Math.max(building.width, building.depth) * .68, 1.45, 4]} />
      <meshStandardMaterial color={building.roof} roughness={1} />
    </mesh>
    <mesh position={[0, .12, 0]} receiveShadow>
      <boxGeometry args={[building.width + .6, .24, building.depth + .6]} />
      <meshStandardMaterial color="#a98569" roughness={1} />
    </mesh>
    <mesh position={[0, -(ground.max - ground.min) / 2, 0]} receiveShadow><boxGeometry args={[building.width, Math.max(.05, ground.max - ground.min), building.depth]} /><meshStandardMaterial color="#a98569" roughness={1}/></mesh>
    {building.label && <ExpansionSign position={[0, building.height * .62, building.depth / 2 + .08]} label={building.label} width={Math.min(4.2, building.width - 1)} />}
  </group>;
}

function BuildingFallback({ color = '#e5d7b3', roof = '#aa573c' }: { color?: string; roof?: string }) {
  return <group>
    <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[8, 3, 7]} /><meshStandardMaterial color={color} roughness={1} /></mesh>
    <mesh position={[0, 3.65, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[5.2, 1.3, 4]} /><meshStandardMaterial color={roof} roughness={1} /></mesh>
  </group>;
}

function FuelStation() {
  const x = -392, z = -106, y = terrainHeight(x, z);
  return <group name="chalakkudy-fuel-station" position={[x, y, z]}>
    <EnvironmentAsset profile={fuelProfile} fallback={<BuildingFallback color="#f0dfb5" roof="#bf5b3e" />} />
    <mesh position={[0, .06, 0]} receiveShadow><boxGeometry args={[14, .12, 11]} /><meshStandardMaterial color="#8f8b75" roughness={1} /></mesh>
    <mesh position={[0, 2.7, -3.6]} castShadow><boxGeometry args={[7, 4.8, .18]} /><meshStandardMaterial color="#f4e8cc" roughness={1} /></mesh>
    <ExpansionSign position={[0, 3, -3.72]} label="Petrol Pump · ചാലക്കുടി" width={5.2} />
  </group>;
}

function ParkPool() {
  const { x: cx, z: cz, y, width, depth } = parkPoolLayout();
  return <group name="silver-storm-pool">
    <mesh position={[cx, y + .12, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width, depth]} /><meshStandardMaterial color="#55b8c2" roughness={.18} metalness={.08} /></mesh>
    <mesh position={[cx, y + .42, cz - depth / 2 - .7]} castShadow><boxGeometry args={[width + 2, .7, 1.4]} /><meshStandardMaterial color="#f1d2a3" roughness={1} /></mesh>
    <mesh position={[cx, y + .42, cz + depth / 2 + .7]} castShadow><boxGeometry args={[width + 2, .7, 1.4]} /><meshStandardMaterial color="#f1d2a3" roughness={1} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[cx + side * (width / 2 + .7), y + .42, cz]} castShadow><boxGeometry args={[1.4, .7, depth]} /><meshStandardMaterial color="#f1d2a3" roughness={1}/></mesh>)}
  </group>;
}

function SilverStorm() {
  return <group name="silver-storm">
    <WaterPark />
    <ParkPool />
  </group>;
}

function PalmRow({ positions }: { positions: readonly V3[] }) {
  return <>{positions.map(([x, , z], index) => {
    const y = terrainHeight(x, z);
    return <group key={index} position={[x, y, z]}>
      <mesh position={[0, 2.2, 0]} castShadow><cylinderGeometry args={[.16, .28, 4.4, 7]} /><meshStandardMaterial color="#79563d" roughness={1} /></mesh>
      <mesh position={[0, 4.5, 0]} castShadow><sphereGeometry args={[1.05, 7, 5]} /><meshStandardMaterial color="#5f873e" roughness={1} /></mesh>
    </group>;
  })}</>;
}

export function V2WorldDressing() {
  return <group name="v2-town-and-park-dressing">
    <RigidBody type="fixed" colliders={false}>
      {v2DressingBoxes().map(box => <CuboidCollider key={box.id} position={box.position} rotation={box.rotation} args={[box.size[0] / 2, box.size[1] / 2, box.size[2] / 2]} />)}
    </RigidBody>
    {TOWN_BUILDINGS.map(building => <House key={building.id} building={building} />)}
    <FuelStation />
    <SilverStorm />
    {/* Chalakkudy's and Malakkappara's street palms were removed: shops and the bus stand stand there now. */}
    <PalmRow positions={[[ 72, 0, -645 ]]} />
  </group>;
}
