import { beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createCarPhysics } from '../src/game/vehicle/carPhysics';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS } from '../src/game/player/controllerMath';
import { configureTravelCollider } from '../src/game/player/travelCollider';

beforeAll(async () => { await RAPIER.init(); });

it.each(['admin', 'muscle'] as const)('%s stays stable when the explorer enters without driving input', model => {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, .2, 100).setTranslation(0, -.2, 0));
    const car = createCarPhysics(world, [0, 0, 0], Math.PI, model);
    const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .84, -3));
    const shape = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), player);
    for (let frame = 0; frame < 240; frame++) {
      car.step({ forward: 0, steer: 0, brake: false }, 1 / 60, false);
      world.step();
    }
    const parked = car.body.translation();
    // Exercise repeated entry/exit with the same collider, as the live controller does.
    for (let entry = 0; entry < 3; entry++) {
      configureTravelCollider(shape, 'car');
      player.setTranslation(car.body.translation(), true);
      player.setNextKinematicTranslation(car.body.translation());
      for (let frame = 0; frame < 300; frame++) {
        car.step({ forward: 0, steer: 0, brake: false }, 1 / 60, true);
        world.step();
        player.setTranslation(car.body.translation(), true);
        player.setNextKinematicTranslation(car.body.translation());
        const p = car.body.translation();
        expect(Math.hypot(p.x - parked.x, p.z - parked.z)).toBeLessThan(.05);
        expect(Math.abs(p.y - parked.y)).toBeLessThan(.05);
        const q = car.body.rotation();
        expect(1 - 2 * (q.x * q.x + q.z * q.z)).toBeGreaterThan(.99);
      }
      player.setTranslation({ x: 3, y: .84, z: 0 }, true);
      player.setNextKinematicTranslation({ x: 3, y: .84, z: 0 });
      configureTravelCollider(shape, 'foot');
      world.step();
      expect(shape.isEnabled()).toBe(true);
      expect(shape.isSensor()).toBe(false);
      expect(shape.shape.type).toBe(RAPIER.ShapeType.Capsule);
      configureTravelCollider(shape, 'bicycle');
      // Bikes now have their own solid physics chassis (see bikePhysics.ts), so the character's own
      // collider gets the same passenger-sensor treatment cars and planes already have.
      expect(shape.isEnabled()).toBe(false);
      expect(shape.isSensor()).toBe(true);
      expect(shape.shape.type).toBe(RAPIER.ShapeType.Cuboid);
    }
  } finally { world.free(); }
});
