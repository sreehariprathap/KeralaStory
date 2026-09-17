import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Bone, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createNickAnimation } from '../src/game/player/nickAnimation';
import { CELEBRATE_SECONDS, KICK_SWING_SECONDS, kickSwing, kickWindup, touchPulse, type SoccerMotion } from '../src/game/soccer/soccerMotion';

if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class extends Event { readonly lengthComputable = false; readonly loaded = 0; readonly total = 0; } as unknown as typeof ProgressEvent;
}

async function loadMessi(): Promise<Object3D> {
  const file = readFileSync(resolve(process.cwd(), 'public/assets/characters/lionel_messi_qatar_2022_rigged.glb'));
  const length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  const binary = file.subarray(28 + length);
  for (const key of ['materials', 'textures', 'images', 'samplers']) delete json[key];
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  json.buffers = [{ byteLength: binary.byteLength, uri: `data:application/octet-stream;base64,${binary.toString('base64')}` }];
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}

function bone(root: Object3D, name: string) {
  let found: Bone | undefined;
  root.traverse(object => { if (object instanceof Bone && object.name === name) found = object; });
  if (!found) throw new Error(`${name} missing`);
  return found;
}

const ankleZ = (root: Object3D, side: 'L' | 'R') => { root.updateMatrixWorld(true); return bone(root, `KeralaAnkle_${side}_03`).getWorldPosition(new Vector3()).z; };
const wristY = (root: Object3D, side: 'L' | 'R') => { root.updateMatrixWorld(true); return bone(root, `KeralaWrist_${side}_06`).getWorldPosition(new Vector3()).y; };

describe('soccer motion curves', () => {
  it('winds the kicking leg back, strikes forward past the body, then settles', () => {
    expect(kickWindup(0)).toEqual({ hip: 0, knee: 0 });
    expect(kickWindup(1).hip).toBeGreaterThan(.5);
    const strike = kickSwing(.18, 1)!;
    expect(strike.hip).toBeLessThan(-1.2);
    expect(kickSwing(.18, 0)!.hip).toBeGreaterThan(strike.hip);
    const end = kickSwing(KICK_SWING_SECONDS - 1e-4, 1)!;
    expect(Math.abs(end.hip)).toBeLessThan(.01);
    expect(kickSwing(KICK_SWING_SECONDS, 1)).toBeNull();
    for (let t = 0; t < KICK_SWING_SECONDS; t += .01) {
      const pose = kickSwing(t, .5)!;
      expect(Number.isFinite(pose.hip) && Number.isFinite(pose.knee) && pose.knee >= 0).toBe(true);
    }
  });
  it('pulses a dribble touch only briefly', () => {
    expect(touchPulse(-.1)).toBe(0);
    expect(touchPulse(.13)).toBeGreaterThan(.9);
    expect(touchPulse(1)).toBe(0);
  });
});

describe('Messi football animation', () => {
  const soccer = (): SoccerMotion => ({ active: true, charge: 0, kicks: 0, kickPower: 0, touches: 0, dribbling: false, goals: 0 });

  it('kicks with the left foot: wind-up behind, strike in front', { timeout: 30_000 }, async () => {
    const root = await loadMessi();
    const animator = createNickAnimation(root, 'messi');
    const ball = soccer();
    const motion = { speed: 0, grounded: true, soccer: ball };
    for (let i = 0; i < 30; i++) animator.update(1 / 60, motion);
    const rest = ankleZ(root, 'L');
    ball.charge = 1;
    for (let i = 0; i < 30; i++) animator.update(1 / 60, motion);
    expect(ankleZ(root, 'L')).toBeLessThan(rest - .15);
    expect(Math.abs(ankleZ(root, 'R') - rest)).toBeLessThan(.15);
    ball.charge = 0; ball.kicks++; ball.kickPower = 1;
    for (let i = 0; i < 12; i++) animator.update(1 / 60, motion);
    expect(ankleZ(root, 'L')).toBeGreaterThan(rest + .3);
    for (let i = 0; i < 60; i++) animator.update(1 / 60, motion);
    expect(Math.abs(ankleZ(root, 'L') - rest)).toBeLessThan(.05);
  });

  it('raises both arms after a goal and lowers them again', { timeout: 30_000 }, async () => {
    const root = await loadMessi();
    const animator = createNickAnimation(root, 'messi');
    const ball = soccer();
    const motion = { speed: 0, grounded: true, soccer: ball };
    for (let i = 0; i < 30; i++) animator.update(1 / 60, motion);
    const rest = wristY(root, 'L');
    ball.goals++;
    for (let i = 0; i < 40; i++) animator.update(1 / 60, motion);
    expect(wristY(root, 'L')).toBeGreaterThan(1.7);
    expect(wristY(root, 'R')).toBeGreaterThan(1.7);
    for (let i = 0; i < CELEBRATE_SECONDS * 60; i++) animator.update(1 / 60, motion);
    expect(Math.abs(wristY(root, 'L') - rest)).toBeLessThan(.05);
  });

  it('ignores counters seen before the avatar mounted', { timeout: 30_000 }, async () => {
    const root = await loadMessi();
    const animator = createNickAnimation(root, 'messi');
    const ball = { ...soccer(), goals: 3, kicks: 7 };
    for (let i = 0; i < 30; i++) {
      animator.update(1 / 60, { speed: 0, grounded: true, soccer: ball });
      // Unposed T-pose wrists sit near 1.35 m; a celebration lifts them above the head.
      expect(wristY(root, 'L')).toBeLessThan(1.4);
    }
  });
});
