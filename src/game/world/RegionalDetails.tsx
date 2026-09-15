import { useMemo, useRef } from 'react';
import { CylinderGeometry, Group, SphereGeometry, TorusGeometry } from 'three';
import { useFrame } from '@react-three/fiber';
import { terrainHeight } from '../../content/world/definition';
import { BANANA_GROUPS, CARDAMOM_GROUPS, FISHING_DETAILS, SPICE_SUPPORTS, SPICE_VINES } from '../../content/zones/prototypeDetails';

type Props = { animated: boolean; quality: 'low' | 'medium' | 'high' };

function SpiceGarden({ quality, animated }: { quality: Props['quality']; animated: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => { if (animated && group.current) group.current.position.y = Math.sin(clock.elapsedTime * 0.45) * 0.012; });
  const pole = useMemo(() => new CylinderGeometry(0.045, 0.055, 2.2, 6), []);
  const vine = useMemo(() => new CylinderGeometry(0.025, 0.035, 1.7, 5), []);
  const leaf = useMemo(() => new SphereGeometry(0.18, 6, 4), []);
  const banana = useMemo(() => new SphereGeometry(0.32, 7, 4), []);
  return <group ref={group}>
    {SPICE_SUPPORTS.map((item, i) => <mesh key={`pole-${i}`} geometry={pole} material-color="#775539" position={[item.x, terrainHeight(item.x, item.z) + 1.1, item.z]} rotation={[0, item.rotation ?? 0, 0]} />)}
    {quality !== 'low' && SPICE_VINES.map((item, i) => <mesh key={`vine-${i}`} geometry={vine} material-color="#39704a" position={[item.x, terrainHeight(item.x, item.z) + 1.1, item.z]} rotation={[0.25, i * 1.3, 0.25]} scale={item.scale ?? 1} />)}
    {quality !== 'low' && CARDAMOM_GROUPS.map((item, i) => <mesh key={`cardamom-${i}`} geometry={leaf} material-color={i % 2 ? '#628b4b' : '#759957'} position={[item.x, terrainHeight(item.x, item.z) + 0.28, item.z]} scale={item.scale ?? 1} />)}
    {quality === 'high' && BANANA_GROUPS.map((item, i) => <mesh key={`banana-${i}`} geometry={banana} material-color={i % 2 ? '#739848' : '#86a454'} position={[item.x, terrainHeight(item.x, item.z) + 1, item.z]} scale={[0.7, 2, 0.7]} />)}
  </group>;
}

function FishingSpot({ x, z, facing }: typeof FISHING_DETAILS[number]) {
  const y = terrainHeight(x, z);
  const body = useMemo(() => new CylinderGeometry(0.18, 0.23, 0.75, 7), []);
  const head = useMemo(() => new SphereGeometry(0.2, 8, 6), []);
  const net = useMemo(() => new TorusGeometry(0.42, 0.025, 5, 16), []);
  return <group position={[x, y, z]} rotation={[0, facing, 0]}>
    <mesh geometry={body} material-color="#b46d4f" position={[0, 0.62, 0]} rotation={[0.2, 0, 0]} />
    <mesh geometry={head} material-color="#b98162" position={[0, 1.15, 0]} />
    <mesh geometry={new CylinderGeometry(0.018, 0.018, 2.3, 5)} material-color="#6c4c32" position={[0.7, 0.75, -0.15]} rotation={[0, 0, -0.35]} />
    <mesh geometry={net} material-color="#d0b57c" position={[-0.55, 0.35, 0.25]} rotation={[Math.PI / 2, 0.25, 0]} />
  </group>;
}

export function RegionalDetails({ animated, quality }: Props) {
  return <group name="regional-details-prototype" userData={{ prototype: true, animated }}>
    <SpiceGarden quality={quality} animated={animated} />
    {quality !== 'low' && FISHING_DETAILS.map((spot) => <FishingSpot key={spot.id} {...spot} />)}
  </group>;
}

export type { Props as RegionalDetailsProps };
