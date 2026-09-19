import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_GROUND, V2_ROUTES, isTravelAllowed, terrainHeight } from '../src/content/world/definition';
import { createCarPhysics } from '../src/game/vehicle/carPhysics';

const road = V2_ROUTES.find(route => route.id === 'malakkappara-road')!;

describe('the bus on the Malakkappara forest road', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('is allowed to drive the whole road', () => {
    for (const point of road.points) expect(isTravelAllowed('car', point[0], point[2]), `${point[0]},${point[2]}`).toBe(true);
  });

  it('pulls away from a standing start and keeps its wheels on the road', { timeout: 120_000 }, () => {
    const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    world.timestep = 1 / 60;
    for (const chunk of EXPANSION_GROUND.chunks) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(chunk.vertices), new Uint32Array(chunk.indices)).setFriction(.9));
    }
    const start = road.points[0], next = road.points[1];
    const heading = Math.atan2(next[0] - start[0], -(next[2] - start[2]));
    const car = createCarPhysics(world, [start[0], terrainHeight(start[0], start[2]) + .5, start[2]], heading, 'bus');
    let airborne = 0;
    for (let step = 0; step < 900; step++) {
      car.step({ forward: 1, steer: 0, brake: false }, 1 / 60, true);
      world.step(); car.sample();
      if (!car.motion.grounded) airborne++;
    }
    const travelled = Math.hypot(car.body.translation().x - start[0], car.body.translation().z - start[2]);
    expect(travelled).toBeGreaterThan(40);
    expect(airborne / 900).toBeLessThan(.1);
    car.dispose(); world.free();
  });
});
