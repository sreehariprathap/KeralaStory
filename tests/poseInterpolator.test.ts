import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createPoseInterpolator } from '../src/game/vehicle/poseInterpolator';

const identity = { x: 0, y: 0, z: 0, w: 1 };
const yaw = (angle: number) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });

describe('vehicle pose interpolation', () => {
  it('blends between the last two physics steps by elapsed time', () => {
    const pose = createPoseInterpolator(1 / 60);
    pose.record({ x: 0, y: 0, z: 0 }, identity, 1000);
    pose.record({ x: 0, y: 0, z: 1 }, yaw(Math.PI / 2), 1000);
    const out = new Vector3(), rotation = new Quaternion();
    expect(pose.sample(1000, out, rotation)).toBe(0);
    expect(out.z).toBeCloseTo(0);
    pose.sample(1000 + 1000 / 120, out, rotation);
    expect(out.z).toBeCloseTo(.5);
    expect(rotation.angleTo(new Quaternion(0, 0, 0, 1))).toBeCloseTo(Math.PI / 4);
    pose.sample(1000 + 1000 / 30, out);
    expect(out.z).toBeCloseTo(1);
  });

  it('advances monotonically across 120 Hz frames with 60 Hz steps', () => {
    const pose = createPoseInterpolator(1 / 60);
    const out = new Vector3(), rendered: number[] = [];
    let physicsZ = 0;
    pose.record({ x: 0, y: 0, z: physicsZ }, identity, 0);
    for (let frame = 1; frame <= 12; frame++) {
      const now = frame * 1000 / 120;
      rendered.push(pose.sample(now, out) >= 0 ? out.z : NaN);
      if (frame % 2 === 0) { physicsZ += 1; pose.record({ x: 0, y: 0, z: physicsZ }, identity, now); }
    }
    for (let i = 1; i < rendered.length; i++) expect(rendered[i]).toBeGreaterThanOrEqual(rendered[i - 1]);
    const steps = rendered.slice(1).map((z, i) => z - rendered[i]);
    expect(Math.max(...steps.slice(2)) - Math.min(...steps.slice(2))).toBeLessThan(.01);
  });

  it('does not blend across a snap or before the first record', () => {
    const pose = createPoseInterpolator(1 / 60);
    expect(pose.ready).toBe(false);
    pose.record({ x: 5, y: 0, z: 0 }, identity, 0);
    expect(pose.ready).toBe(true);
    pose.record({ x: 6, y: 0, z: 0 }, identity, 10);
    pose.snap({ x: 100, y: 0, z: 0 }, identity, 12);
    const out = new Vector3();
    pose.sample(13, out);
    expect(out.x).toBe(100);
    pose.reset();
    expect(pose.ready).toBe(false);
  });
});
