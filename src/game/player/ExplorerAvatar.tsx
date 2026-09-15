import { useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ExplorerProfile } from '../../contracts';

export interface AvatarMotion { speed: number; grounded: boolean; riding?: boolean }
interface Props {
  profile: ExplorerProfile;
  moving?: boolean;
  reducedMotion?: boolean;
  speed?: number;
  grounded?: boolean;
  motion?: RefObject<AvatarMotion>;
}

/** Original procedural proportion/animation preview; not the approved rigged GLB asset. Root at feet, forward +Z. */
export function ExplorerAvatar({ profile, moving = false, reducedMotion = false, speed, grounded = true, motion }: Props) {
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const phase = useRef(0);
  const stride = useRef(0);
  const skin = profile.colors.skin;
  const hair = profile.colors.hair;
  const cloth = profile.colors.clothing;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.06);
    const actualSpeed = motion?.current.speed ?? speed ?? (moving ? 3.1 : 0);
    const onGround = motion?.current.grounded ?? grounded;
    phase.current += dt * (actualSpeed > 4 ? 12 : 8.5);
    const amount = Math.min(actualSpeed / 4.5, 1) * (onGround ? 0.66 : 0.18);
    stride.current += (amount - stride.current) * (1 - Math.exp(-12 * dt));
    const swing = Math.sin(phase.current) * stride.current;
    if(motion?.current.riding){
      if(leftLeg.current)leftLeg.current.rotation.x=-.65+Math.sin(phase.current)*.3;
      if(rightLeg.current)rightLeg.current.rotation.x=-.65-Math.sin(phase.current)*.3;
      if(leftArm.current)leftArm.current.rotation.x=-1;
      if(rightArm.current)rightArm.current.rotation.x=-1;
      if(torso.current)torso.current.position.y=0;
      return;
    }
    if (leftLeg.current) leftLeg.current.rotation.x = onGround ? swing : -0.25;
    if (rightLeg.current) rightLeg.current.rotation.x = onGround ? -swing : 0.3;
    if (leftArm.current) leftArm.current.rotation.x = onGround ? -swing * 0.85 : -0.55;
    if (rightArm.current) rightArm.current.rotation.x = onGround ? swing * 0.85 : -0.55;
    if (torso.current) torso.current.position.y = reducedMotion ? 0 : Math.sin(phase.current * 0.5) * 0.006 * (1 - stride.current);
  });

  return <group name="procedural-traveler-preview">
    <group ref={torso}>
      {/* Soft fitted travel tunic, ivory collar and a woven diagonal bag strap. */}
      <mesh position={[0, 1.015, 0]} castShadow><cylinderGeometry args={[0.185, 0.21, 0.45, 10]} /><meshToonMaterial color={cloth} /></mesh>
      <mesh position={[0, 0.79, 0]} castShadow><cylinderGeometry args={[0.208, 0.24, 0.15, 10]} /><meshToonMaterial color={cloth} /></mesh>
      <mesh position={[0, 0.858, 0]}><cylinderGeometry args={[0.213, 0.213, 0.047, 10]} /><meshToonMaterial color="#503b2d" /></mesh>
      <mesh position={[0, 1.253, 0]}><cylinderGeometry args={[0.074, 0.09, 0.105, 10]} /><meshToonMaterial color={skin} /></mesh>
      <mesh position={[0, 1.215, 0]} rotation={[0, 0, 0.06]}><torusGeometry args={[0.09, 0.033, 5, 12]} /><meshToonMaterial color="#eee0ba" /></mesh>
      <mesh position={[0, 1.022, 0.183]} rotation={[0, 0, -0.53]}><boxGeometry args={[0.045, 0.48, 0.026]} /><meshToonMaterial color="#c59e66" /></mesh>
      <mesh position={[0.214, 0.844, 0.025]} rotation={[0, 0, 0.06]} castShadow><boxGeometry args={[0.15, 0.21, 0.18]} /><meshToonMaterial color="#936540" /></mesh>
      <mesh position={[0, 1.022, -0.17]} castShadow><boxGeometry args={[0.28, 0.34, 0.15]} /><meshToonMaterial color="#a38554" /></mesh>
      <mesh position={[0, 1.165, -0.26]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.075, 0.075, 0.35, 9]} /><meshToonMaterial color="#bec096" /></mesh>

      {/* Roughly six heads tall. Large almond eye shapes retain a restrained anime read. */}
      <group position={[0, 1.45, 0]}>
        <mesh castShadow scale={[0.174, 0.219, 0.163]}><sphereGeometry args={[1, 16, 12]} /><meshToonMaterial color={skin} /></mesh>
        <mesh position={[0, 0.072, -0.03]} scale={[0.184, 0.178, 0.163]} castShadow><sphereGeometry args={[1, 12, 9]} /><meshToonMaterial color={hair} /></mesh>
        {[-1, 1].map(side => <group key={side}>
          <mesh position={[side * 0.17, -0.018, 0]} scale={[0.037, 0.065, 0.034]}><sphereGeometry args={[1, 8, 8]} /><meshToonMaterial color={skin} /></mesh>
          <mesh position={[side * 0.076, 0.013, 0.148]} rotation={[0, side * 0.2, side * 0.06]} scale={[0.048, 0.036, 0.014]}><sphereGeometry args={[1, 12, 8]} /><meshToonMaterial color="#fff5de" /></mesh>
          <mesh position={[side * 0.074, 0.013, 0.16]} scale={[0.024, 0.03, 0.009]}><sphereGeometry args={[1, 10, 8]} /><meshToonMaterial color="#463b28" /></mesh>
          <mesh position={[side * 0.074, 0.012, 0.166]} scale={[0.011, 0.024, 0.004]}><sphereGeometry args={[1, 8, 8]} /><meshToonMaterial color="#171d18" /></mesh>
          <mesh position={[side * 0.074 - 0.007, 0.025, 0.171]}><sphereGeometry args={[0.007, 6, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[side * 0.074, 0.06, 0.145]} rotation={[0, 0, -side * 0.12]}><boxGeometry args={[0.074, 0.012, 0.014]} /><meshToonMaterial color={hair} /></mesh>
          <mesh position={[side * 0.155, 0.045, 0.04]} rotation={[0, 0, side * 0.12]} scale={[0.04, 0.13, 0.08]} castShadow><sphereGeometry args={[1, 8, 6]} /><meshToonMaterial color={hair} /></mesh>
        </group>)}
        {[[-0.115, 0.14, 0.107, -0.34], [-0.057, 0.155, 0.137, -0.18], [0.024, 0.164, 0.14, 0.3], [0.106, 0.155, 0.11, 0.55]].map(([x,y,z,angle], i) =>
          <mesh key={i} position={[x,y,z]} rotation={[0.1, 0, angle + Math.PI]} castShadow><coneGeometry args={[0.066, 0.175, 5]} /><meshToonMaterial color={hair} /></mesh>)}
        <mesh position={[0, -0.025, 0.161]} scale={[0.021, 0.031, 0.028]}><sphereGeometry args={[1, 8, 6]} /><meshToonMaterial color={skin} /></mesh>
        <mesh position={[0, -0.094, 0.145]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.031, 0.005, 4, 10, Math.PI]} /><meshToonMaterial color="#794536" /></mesh>
      </group>

      {[-1, 1].map(side => <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.225, 1.2, 0]} rotation={[0, 0, side * 0.1]}>
        <mesh position={[0, -0.11, 0]} castShadow><capsuleGeometry args={[0.083, 0.12, 4, 8]} /><meshToonMaterial color={cloth} /></mesh>
        <mesh position={[0, -0.32, 0]} castShadow><capsuleGeometry args={[0.053, 0.21, 4, 8]} /><meshToonMaterial color={skin} /></mesh>
        <mesh position={[0, -0.48, 0.012]} scale={[0.061, 0.08, 0.044]} castShadow><sphereGeometry args={[1, 8, 6]} /><meshToonMaterial color={skin} /></mesh>
      </group>)}
    </group>
    {[-1, 1].map(side => <group key={side} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.105, 0.77, 0]}>
      <mesh position={[0, -0.265, 0]} castShadow><capsuleGeometry args={[0.093, 0.39, 4, 8]} /><meshToonMaterial color="#e0cfaa" /></mesh>
      <mesh position={[0, -0.602, 0]} castShadow><cylinderGeometry args={[0.066, 0.057, 0.16, 8]} /><meshToonMaterial color={skin} /></mesh>
      <mesh position={[0, -0.714, 0.046]} scale={[0.079, 0.053, 0.135]} castShadow><sphereGeometry args={[1, 10, 6]} /><meshToonMaterial color="#513e2e" /></mesh>
      <mesh position={[0, -0.685, 0.068]} rotation={[-0.15, 0, 0]}><boxGeometry args={[0.143, 0.035, 0.048]} /><meshToonMaterial color="#9c7950" /></mesh>
    </group>)}
  </group>;
}
