import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Vec3 } from '../../contracts';
import type { NpcDefinition } from './npcDefinitions';

export function NpcCharacter({ definition, position }: { definition: NpcDefinition; position: Vec3 }) {
  const root = useRef<Group>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    if (!root.current) return;
    phase.current += delta * 3;
    root.current.position.set(position[0], position[1], position[2]);
    root.current.rotation.z = Math.sin(phase.current) * 0.03;
  });
  return (
    <group ref={root}>
      <mesh position={[0, 0.55, 0]} castShadow><capsuleGeometry args={[0.22, 0.5, 4, 8]}/><meshStandardMaterial color={definition.cloth}/></mesh>
      <mesh position={[0, 1.02, 0]} castShadow><sphereGeometry args={[0.16, 16, 16]}/><meshStandardMaterial color={definition.skin}/></mesh>
      <mesh position={[-0.08, 1.16, 0]} rotation={[0, 0, -0.4]} castShadow><coneGeometry args={[0.03, 0.12, 8]}/><meshStandardMaterial color={definition.horn}/></mesh>
      <mesh position={[0.08, 1.16, 0]} rotation={[0, 0, 0.4]} castShadow><coneGeometry args={[0.03, 0.12, 8]}/><meshStandardMaterial color={definition.horn}/></mesh>
    </group>
  );
}
