import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { carFootprint, resolveClearFeet } from '../src/game/vehicle/clearance';

describe('car footprint', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('reproduces the current probe for the 3.8 m reference car', () => {
    expect(carFootprint('admin')).toEqual({ halfX: .9, halfZ: 1.9 });
  });

  it('widens for a wide vehicle and lengthens with the body, not the belly box', () => {
    expect(carFootprint('willys-buggy')).toEqual({ halfX: 1.05, halfZ: 2 });
    expect(carFootprint('supercar')).toEqual({ halfX: 1.05, halfZ: 2.2 });
  });

  // resolveClearFeet also queries the real world content (isTravelAllowed, needsSafeReset),
  // so the probe has to sit somewhere the game actually allows a car, not at the origin.
  // (0, -460) on a 76 m pad is the spot tests/bicycleClearance.test.ts uses.
  it('rejects a slot the default car footprint accepts when a wider one is asked for', () => {
    const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, 75.5, -460));
    // Two walls 2.2 m apart: a .9 m half-width car fits between them, a 1.25 m half-width bus does not.
    for (const x of [-1.2, 1.2]) world.createCollider(RAPIER.ColliderDesc.cuboid(.1, 2, 6).setTranslation(x, 78, -460));
    world.step();
    expect(resolveClearFeet(world, null, 0, -460, 76, 'car', 0)).not.toBeNull();
    expect(resolveClearFeet(world, null, 0, -460, 76, 'car', 0, { halfX: 1.25, halfZ: 1.9 })).toBeNull();
    world.free();
  });
});
