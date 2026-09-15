import type { Object3D } from 'three';
import type { AvatarMotion } from './ExplorerAvatar';

/** Gentle whole-model locomotion for legacy meshes that have no skin or bones. */
export function createStaticAvatarAnimation(root: Object3D) {
  let phase = 0;
  const baseY = root.position.y;
  return { update(delta: number, motion: AvatarMotion) {
    const dt = Math.max(0, Math.min(delta, .05));
    if (motion.speed > .05 || motion.riding) phase += dt * (motion.riding ? 6 : 5);
    const stride = Math.min(Math.max(motion.speed, 0) / 4.5, 1);
    root.position.y = baseY + Math.sin(phase) * .018 * (stride || (motion.grounded ? .2 : .6));
    root.rotation.z = Math.sin(phase * .5) * .012 * stride;
  } };
}
