import { Quaternion, Vector3 } from 'three';

type Vec = { x: number; y: number; z: number };
type Quat = Vec & { w: number };

/**
 * Renders a manually created Rapier body between its last two fixed steps, so it moves smoothly on
 * displays faster than the 60 Hz physics rate. Sampling depends only on the time passed in, so the
 * camera and the vehicle mesh can sample independently in the same frame and still agree.
 */
export function createPoseInterpolator(stepSeconds: number) {
  const previous = { position: new Vector3(), rotation: new Quaternion() };
  const current = { position: new Vector3(), rotation: new Quaternion() };
  let recordedAtMs = -Infinity;
  let ready = false;
  return {
    get ready() { return ready; },
    /** Call once after every physics step. */
    record(position: Vec, rotation: Quat, nowMs: number) {
      if (!ready) { this.snap(position, rotation, nowMs); return; }
      previous.position.copy(current.position); previous.rotation.copy(current.rotation);
      current.position.set(position.x, position.y, position.z);
      current.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
      recordedAtMs = nowMs;
    },
    /** Teleports and new bodies must not blend from a stale pose. */
    snap(position: Vec, rotation: Quat, nowMs: number) {
      current.position.set(position.x, position.y, position.z);
      current.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
      previous.position.copy(current.position); previous.rotation.copy(current.rotation);
      recordedAtMs = nowMs; ready = true;
    },
    reset() { ready = false; recordedAtMs = -Infinity; },
    sample(nowMs: number, outPosition: Vector3, outRotation?: Quaternion) {
      const alpha = Math.min(1, Math.max(0, (nowMs - recordedAtMs) / (stepSeconds * 1000)));
      outPosition.lerpVectors(previous.position, current.position, alpha);
      if (outRotation) outRotation.slerpQuaternions(previous.rotation, current.rotation, alpha);
      return alpha;
    },
  };
}
export type PoseInterpolator = ReturnType<typeof createPoseInterpolator>;
