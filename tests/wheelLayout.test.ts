import { describe, expect, it } from 'vitest';
import { engineForceShare, isRearWheel } from '../src/game/vehicle/wheelLayout';
import { VEHICLE_PROFILES } from '../src/content/assets/vehicleProfiles';
import type { VehicleWheel } from '../src/content/assets/vehicleProfiles';

const at = (x: number, z: number): VehicleWheel => ({ x, y: .3, z, radius: .3, nodes: [] });

describe('rear axle detection', () => {
  it('reads the axle off the wheel geometry, not its index', () => {
    expect(isRearWheel(at(.8, 1.2))).toBe(false);
    expect(isRearWheel(at(.8, -1.2))).toBe(true);
  });

  it('agrees with the index rule it replaces for every existing car', () => {
    for (const id of ['admin', 'muscle', 'car-carton', 'fennec', 'bronco', 'golf-gti', 'sports-coupe', 'supercar', 'toy-car', 'cyberpunk'] as const) {
      VEHICLE_PROFILES[id].wheels.forEach((wheel, index) => expect(isRearWheel(wheel), `${id}[${index}]`).toBe(index >= 2));
    }
  });
});

describe('engine force distribution', () => {
  it('reproduces the current .2/.3 split for a four-wheel car', () => {
    const shares = engineForceShare([at(.8, 1.2), at(-.8, 1.2), at(.8, -1.2), at(-.8, -1.2)]);
    expect(shares).toEqual([.2, .2, .3, .3]);
  });

  it('splits the same axle shares across a dual rear axle', () => {
    const shares = engineForceShare([at(.9, 2.7), at(-.9, 2.7), at(1, -1.8), at(.75, -1.8), at(-.75, -1.8), at(-1, -1.8)]);
    expect(shares).toEqual([.2, .2, .15, .15, .15, .15]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
  });
});
