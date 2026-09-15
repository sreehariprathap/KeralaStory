import { Bone, Object3D, Quaternion, Vector3 } from 'three';
import type { AvatarMotion } from './ExplorerAvatar';

/** Bone-name tolerant walk cycle for imported anime rigs with non-Nick naming. */
export function createGenericSkeletonAnimation(root: Object3D) {
  const joints: { bone: Bone; side: number; rest: Quaternion }[] = [];
  const point = new Vector3();
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof Bone) || !/(arm|leg|thigh|calf|shoulder|upperarm|forearm|hip)/i.test(object.name)) return;
    object.getWorldPosition(point);
    joints.push({ bone: object, side: Math.sign(point.x) || (joints.length % 2 ? -1 : 1), rest: object.quaternion.clone() });
  });
  let phase = 0;
  const axis = new Vector3(1, 0, 0);
  const delta = new Quaternion();
  return { update(dt: number, motion: AvatarMotion) {
    const step = Math.max(0, Math.min(dt, .05));
    const speed = Math.max(0, Number.isFinite(motion.speed) ? motion.speed : 0);
    if (speed > .05 || motion.riding) phase += step * (motion.riding ? 6 : 5 + speed * 1.4);
    const stride = Math.min(speed / 4.5, 1);
    joints.forEach((joint, index) => {
      const wave = Math.sin(phase + (joint.side < 0 ? Math.PI : 0));
      const isArm = /(arm|shoulder|forearm)/i.test(joint.bone.name);
      const bend = motion.riding ? (isArm ? -.65 : .45) : !motion.grounded ? (isArm ? -.45 : .35) : wave * stride * (isArm ? -.35 : .65);
      delta.setFromAxisAngle(axis, bend);
      joint.bone.quaternion.copy(joint.rest).multiply(delta);
      if (index > 64) return;
    });
  } };
}
