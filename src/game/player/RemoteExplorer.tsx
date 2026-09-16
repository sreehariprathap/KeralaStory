import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ReplicatedPlayerDto, TransformDto } from '@kerala-story/protocol';
import { ExplorerAvatar, type AvatarMotion } from './ExplorerAvatar';

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
  useFrame(() => {
    const transform = sample();
    if (!group.current) return;
    group.current.visible = transform !== null;
    if (!transform) return;
    group.current.position.set(...transform.position);
    group.current.rotation.y = Math.PI - transform.headingRad;
    motion.current.speed = Math.hypot(transform.velocity[0], transform.velocity[2]);
    // Current protocol has velocity, but no grounded bit. This is visual-only inference.
    motion.current.grounded = Math.abs(transform.velocity[1]) < .2;
    motion.current.riding = player.travel.kind === 'vehicle';
  });
  return <group ref={group} name={`remote-${player.id}`}>
    <ExplorerAvatar profile={{ id: player.id, displayName: player.displayName, ...player.appearance }} motion={motion} reducedMotion={reducedMotion} />
  </group>;
}
