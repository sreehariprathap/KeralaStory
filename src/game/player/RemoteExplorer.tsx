import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ReplicatedPlayerDto, TransformDto } from '@kerala-story/protocol';
import { ExplorerAvatar, type AvatarMotion } from './ExplorerAvatar';
import { GliderVisual, type GliderPose } from '../vehicle/GliderVisual';
import { GLIDER } from '../vehicle/gliderMotor';

interface Props {
  player: ReplicatedPlayerDto;
  /** Returns interpolated feet coordinates, or null after the network stale limit. */
  sample: () => TransformDto | null;
  reducedMotion?: boolean;
}

/** Render-only guest: deliberately has no Rapier body or movement authority. */
export function RemoteExplorer({ player, sample, reducedMotion }: Props) {
  const group = useRef<Group>(null);
  const motion = useRef<AvatarMotion>({ speed: 0, grounded: true });
  const gliderPose = useRef<GliderPose>({ bank: 0 }), lastHeading = useRef<number | null>(null);
  const gliding = player.travel.kind === 'glider';
  const [hipHeight, setHipHeight] = useState(.77);
  useFrame((_, delta) => {
    const transform = sample();
    if (!group.current) return;
    group.current.visible = transform !== null;
    if (!transform) return;
    group.current.position.set(...transform.position);
    group.current.rotation.y = Math.PI - transform.headingRad;
    motion.current.speed = Math.hypot(transform.velocity[0], transform.velocity[2]);
    // Current protocol has velocity, but no grounded bit. This is visual-only inference.
    motion.current.grounded = Math.abs(transform.velocity[1]) < .2;
    motion.current.riding = player.travel.kind !== 'foot';
    motion.current.pedaling = !gliding;
    // Bank is not replicated: infer it from how fast the heading is turning.
    const previous = lastHeading.current ?? transform.headingRad;
    const turnRate = Math.atan2(Math.sin(transform.headingRad - previous), Math.cos(transform.headingRad - previous)) / Math.max(delta, 1e-3);
    lastHeading.current = transform.headingRad;
    const bank = gliding ? Math.max(-1, Math.min(1, turnRate / GLIDER.turnRate)) * GLIDER.maxBank : 0;
    gliderPose.current.bank += (bank - gliderPose.current.bank) * (1 - Math.exp(-4 * Math.min(delta, .1)));
  });
  return <group ref={group} name={`remote-${player.id}`}>
    <ExplorerAvatar profile={{ id: player.id, displayName: player.displayName, ...player.appearance }} motion={motion} reducedMotion={reducedMotion} onHipHeight={setHipHeight} />
    {gliding && <GliderVisual pose={gliderPose} backHeight={hipHeight + .42} reducedMotion={reducedMotion}/>}
  </group>;
}
