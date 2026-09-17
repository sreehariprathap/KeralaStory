import { Bone, Object3D, Quaternion, Vector3 } from 'three';
import type { AvatarMotion } from './ExplorerAvatar';

/** In-place locomotion for Nick and the fitted character skeletons. */
export type CharacterRig = 'nick' | 'kid-boy' | 'little-girl' | 'uniform' | 'relaxed' | 'fitted' | 'appu';
export function createNickAnimation(root: Object3D, rig: CharacterRig = 'nick') {
  const parts = ['Hip', 'Knee', 'Shoulder', 'Elbow'] as const;
  const joints: { bone: Bone; part: typeof parts[number]; side: number; rest: Quaternion; previous: Quaternion }[] = [];
  const point = new Vector3();
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof Bone)) return;
    const appu = rig === 'appu' ? object.name.match(/^J_Bip_([LR])_(UpperLeg|LowerLeg|UpperArm|LowerArm)_\d+$/) : null;
    const match = appu ? ['', ({UpperLeg:'Hip',LowerLeg:'Knee',UpperArm:'Shoulder',LowerArm:'Elbow'} as Record<string,string>)[appu[2]], appu[1]] : object.name.match(rig === 'nick' ? /Nick:?(Hip|Knee|Shoulder|Elbow)_([LR])_0\d+$/ : /Kerala(Hip|Knee|Shoulder|Elbow)_([LR])_0\d+$/);
    if (!match) return;
    root.worldToLocal(object.getWorldPosition(point));
    joints.push({ bone: object, part: match[1] as typeof parts[number], side: Math.sign(point.x) || 1, rest: object.quaternion.clone(), previous: object.quaternion.clone() });
  });
  if (joints.length !== 8) throw new Error(`${rig} is missing the expected limb bones.`);
  // Parent joints must be posed before their children.
  joints.sort((a, b) => parts.indexOf(a.part) - parts.indexOf(b.part));
  const x = new Vector3(1, 0, 0), z = new Vector3(0, 0, 1);
  const rootRotation = new Quaternion(), parentRotation = new Quaternion();
  const deltaRotation = new Quaternion(), drop = new Quaternion(), target = new Quaternion();
  let phase = 0, stride = 0;
  // Rest-pose thigh pivot height in the caller's (already scaled) root space; used to seat riders.
  const hips = joints.filter(joint => joint.part === 'Hip');
  const hipHeight = hips.reduce((sum, joint) => sum + root.worldToLocal(joint.bone.getWorldPosition(point)).y * root.scale.y, 0) / hips.length;
  return {
    hipHeight,
    update(delta: number, motion: AvatarMotion) {
      const dt = Math.max(0, Math.min(delta, .05));
      const speed = Number.isFinite(motion.speed) ? Math.max(0, motion.speed) : 0;
      stride += (Math.min(speed / 4.5, 1) - stride) * (1 - Math.exp(-12 * dt));
      if (speed > .05 || motion.riding) phase += dt * (motion.riding ? 6 : 5 + speed * 1.4);
      root.getWorldQuaternion(rootRotation);
      for (const joint of joints) joint.bone.quaternion.copy(joint.rest);
      root.updateMatrixWorld(true);
      for (const joint of joints) {
        const wave = Math.sin(phase + (joint.side < 0 ? Math.PI : 0));
        let bend = 0;
        if (motion.riding) {
          // The torso is pitched forward by `lean`; pull the thighs forward by the same amount so they stay put.
          const lean = motion.lean ?? 0, pedal = motion.pedaling === false ? 0 : 1;
          bend = joint.part === 'Hip' ? -1.05 - lean + wave * .25 * pedal : joint.part === 'Knee' ? 1.25 - wave * .3 * pedal : joint.part === 'Shoulder' ? -.9 - lean * 1.2 : lean > 0 ? -.15 : -.3;
        } else if (!motion.grounded) {
          bend = joint.part === 'Hip' ? joint.side * .25 : joint.part === 'Knee' ? .5 : joint.part === 'Shoulder' ? -.55 : -.35;
        } else {
          bend = joint.part === 'Hip' ? wave * stride * .65 : joint.part === 'Knee' ? Math.max(0, -wave) * stride * .95 : joint.part === 'Shoulder' ? -wave * stride * .5 : -.12 - stride * .35;
        }
        deltaRotation.setFromAxisAngle(x, bend);
        if (joint.part === 'Shoulder') deltaRotation.multiply(drop.setFromAxisAngle(z, -joint.side * (rig === 'relaxed' ? 0 : rig === 'kid-boy' ? .62 : 1.35)));
        joint.bone.parent!.getWorldQuaternion(parentRotation);
        // Express the character-space rotation in this bone parent's coordinate frame.
        target.copy(parentRotation).invert().multiply(rootRotation).multiply(deltaRotation);
        target.multiply(drop.copy(rootRotation).invert()).multiply(parentRotation).multiply(joint.rest);
        joint.previous.slerp(target, delta === 0 ? 1 : 1 - Math.exp(-18 * dt));
        joint.bone.quaternion.copy(joint.previous);
        joint.bone.updateMatrixWorld(true);
      }
    },
  };
}
