import { EnvironmentAsset } from '../render/EnvironmentAsset';
import { ExpansionSign } from './ExpansionSign';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { V2_ASSET_PROFILES } from '../../content/assets/v2AssetProfiles';
import { V2_LAYOUT, terrainHeight } from '../../content/world/definition';

type V3 = readonly [number, number, number];
type Building = { id: string; x: number; z: number; width: number; depth: number; height: number; wall: string; roof: string; label?: string };

const fuelProfile = V2_ASSET_PROFILES.find(asset => asset.id === 'fuel-station')!;
const parkProfile = V2_ASSET_PROFILES.find(asset => asset.id === 'silver-storm')!;

const TOWN_BUILDINGS: readonly Building[] = [
  { id: 'kodakara-market', x: -250, z: -184, width: 10, depth: 8, height: 3.4, wall: '#e7d7b2', roof: '#a8573d', label: 'Kodakara Market' },
  { id: 'kodakara-bakery', x: -222, z: -184, width: 9, depth: 8, height: 3.2, wall: '#d9bd8a', roof: '#bd7049', label: 'Kodakara Bakery' },
  { id: 'kodakara-house-north', x: -270, z: -228, width: 10, depth: 9, height: 3.1, wall: '#f4e8cc', roof: '#aa573c' },
  { id: 'kodakara-house-south', x: -180, z: -230, width: 10, depth: 9, height: 3.1, wall: '#d5dfb6', roof: '#9d6145' },
  { id: 'malakkappara-tea', x: -532, z: -642, width: 9, depth: 7, height: 3, wall: '#e7d7b2', roof: '#8d583f', label: 'Malakkappara Tea Stop' },
  { id: 'malakkappara-house-west', x: -585, z: -690, width: 10, depth: 8, height: 3.2, wall: '#f4e8cc', roof: '#a8573d' },
  { id: 'malakkappara-house-east', x: -520, z: -712, width: 10, depth: 8, height: 3.2, wall: '#d5dfb6', roof: '#9d6145' },
];

function House({ building }: { building: Building }) {
  const y = terrainHeight(building.x, building.z);
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

function ParkPool({ y }: { y: number }) {
  const [minX, minZ] = [Math.min(...V2_LAYOUT.park.poolFootprint.map(point => point[0])), Math.min(...V2_LAYOUT.park.poolFootprint.map(point => point[1]))];
  const [maxX, maxZ] = [Math.max(...V2_LAYOUT.park.poolFootprint.map(point => point[0])), Math.max(...V2_LAYOUT.park.poolFootprint.map(point => point[1]))];
  const width = maxX - minX, depth = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  return <group name="silver-storm-pool">
    <mesh position={[cx, y + .12, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width, depth]} /><meshStandardMaterial color="#55b8c2" roughness={.18} metalness={.08} /></mesh>
    <mesh position={[cx, y + .42, cz - depth / 2 - .7]} castShadow><boxGeometry args={[width + 2, .7, 1.4]} /><meshStandardMaterial color="#f1d2a3" roughness={1} /></mesh>
    <mesh position={[cx, y + .42, cz + depth / 2 + .7]} castShadow><boxGeometry args={[width + 2, .7, 1.4]} /><meshStandardMaterial color="#f1d2a3" roughness={1} /></mesh>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider position={[cx, y + .35, cz - depth / 2 - .7]} args={[(width + 2) / 2, .35, .7]} />
      <CuboidCollider position={[cx, y + .35, cz + depth / 2 + .7]} args={[(width + 2) / 2, .35, .7]} />
    </RigidBody>
  </group>;
}

function SilverStorm() {
  const [x, , z] = V2_LAYOUT.park.center;
  const y = terrainHeight(x, z);
  return <group name="silver-storm-water-theme-park">
    <group position={[x, y, z]}>
      <EnvironmentAsset profile={parkProfile} fallback={<group name="silver-storm-park-fallback">
        <mesh position={[0, 1.1, 0]} receiveShadow><boxGeometry args={[68, .35, 56]} /><meshStandardMaterial color="#81a65a" roughness={1} /></mesh>
        <mesh position={[-24, 8, -8]} castShadow><cylinderGeometry args={[1.4, 1.8, 15, 10]} /><meshStandardMaterial color="#39aeb2" roughness={.42} /></mesh>
        <mesh position={[-19, 12, -8]} rotation={[0, 0, -.5]} castShadow><cylinderGeometry args={[1.2, 1.2, 18, 10]} /><meshStandardMaterial color="#f08b58" roughness={.55} /></mesh>
        <mesh position={[18, 6, -12]} castShadow><cylinderGeometry args={[1.1, 1.4, 11, 10]} /><meshStandardMaterial color="#e8b653" roughness={.55} /></mesh>
      </group>} />
      <ParkPool y={0} />
      <mesh position={[0, .22, 31]} receiveShadow><boxGeometry args={[48, .12, 10]} /><meshStandardMaterial color="#c1aa78" roughness={1} /></mesh>
      <ExpansionSign position={[0, 3.8, 29.8]} label="Silver Storm · ജല തീം പാർക്ക്" width={7} />
      <RigidBody type="fixed" colliders={false}><CuboidCollider position={[0, .16, 31]} args={[24, .16, 5]} /></RigidBody>
    </group>
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
      {TOWN_BUILDINGS.map(building => <CuboidCollider key={building.id} position={[building.x, terrainHeight(building.x, building.z) + building.height / 2, building.z]} args={[building.width / 2, building.height / 2, building.depth / 2]} />)}
    </RigidBody>
    {TOWN_BUILDINGS.map(building => <House key={building.id} building={building} />)}
    <FuelStation />
    <SilverStorm />
    <PalmRow positions={[[ -332, 0, -88 ], [ -318, 0, -74 ], [ -548, 0, -649 ], [ -518, 0, -658 ], [ 72, 0, -645 ]]} />
  </group>;
}
