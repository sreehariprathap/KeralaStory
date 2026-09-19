import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBikePhysics } from '../src/game/vehicle/bikePhysics';
import { BIKE_MODELS, type BikeModelId } from '../src/content/assets/bikeProfiles';

const DT = 1 / 60;
const models = BIKE_MODELS.map(m => m.id) as BikeModelId[];
const worlds: RAPIER.World[] = [];

beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });

function fixture(model: BikeModelId, options: { slope?: boolean; groundHalfSize?: number } = {}) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  worlds.push(world);
  const groundDesc = RAPIER.ColliderDesc.cuboid(options.groundHalfSize ?? 150, 0.2, options.groundHalfSize ?? 150).setTranslation(0, -0.2, 0);
  if (options.slope) groundDesc.setRotation({ x: Math.sin(Math.PI / 36), y: 0, z: 0, w: Math.cos(Math.PI / 36) });
  world.createCollider(groundDesc);
  const bike = createBikePhysics(world, [0, 2, 0], Math.PI, model);
  const step = (forward = 0, steer = 0, brake = false, handbrake = false, occupied = true) => {
    bike.step({ forward, steer, brake, handbrake }, DT, occupied);
    world.step();
  };
  return { world, bike, step };
}

describe('real Rapier bike physics', () => {
  for (const model of models) {
    it(`${model} settles with tyre contact on flat ground`, () => {
      const { bike, step } = fixture(model);
      for (let frame = 0; frame < 180; frame++) step();
      expect(bike.motion.grounded).toBe(true);
      expect(Number.isFinite(bike.body.translation().y)).toBe(true);
    });

    it(`${model} climbs a ten degree incline through real tyre contact`, () => {
      const { bike, step } = fixture(model, { slope: true });
      for (let frame = 0; frame < 180; frame++) step();
      const startZ = bike.body.translation().z;
      for (let frame = 0; frame < 180; frame++) step(1);
      expect(bike.body.translation().z).toBeGreaterThan(startZ + 1);
    });

    it(`${model} hop() applies an upward impulse only while grounded`, () => {
      const { bike, step } = fixture(model);
      for (let frame = 0; frame < 60; frame++) step();
      const beforeVy = bike.body.linvel().y;
      bike.hop();
      expect(bike.body.linvel().y).toBeGreaterThan(beforeVy + 1);
      // Airborne: a second hop is a no-op. Step until the wheels actually leave the ground.
      for (let frame = 0; frame < 30 && bike.motion.grounded; frame++) step();
      expect(bike.motion.grounded).toBe(false);
      const airborneVy = bike.body.linvel().y;
      bike.hop();
      expect(bike.body.linvel().y).toBeCloseTo(airborneVy, 1);
    });

    it(`${model} disposal removes the chassis and vehicle controller`, () => {
      const { world, bike } = fixture(model);
      const handle = bike.body.handle;
      expect(world.bodies.contains(handle)).toBe(true);
      bike.dispose();
      expect(world.bodies.contains(handle)).toBe(false);
    });
  }

  it('swings the tail out under the handbrake for a drift', () => {
    const yaw = (handbrake: boolean) => {
      const { bike, step } = fixture('yamaha', { groundHalfSize: 300 });
      for (let frame = 0; frame < 240; frame++) step(1, 0, false, false);
      const before = bike.sample();
      for (let frame = 0; frame < 40; frame++) step(0, 1, false, handbrake);
      return Math.abs(Math.atan2(Math.sin(bike.sample() - before), Math.cos(bike.sample() - before)));
    };
    expect(yaw(true)).toBeGreaterThan(yaw(false) * 1.2);
  });
});
