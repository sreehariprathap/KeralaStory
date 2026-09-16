import { describe, expect, it } from 'vitest';
import { interpolateHeading, interpolateVec3 } from '../../src/game/network/transformInterpolation';

describe('multiplayer transform interpolation', () => {
  it('interpolates vectors at the requested fraction', () => {
    expect(interpolateVec3([0, 2, 10], [10, 4, 20], .25)).toEqual([2.5, 2.5, 12.5]);
  });

  it('takes the shortest heading arc across negative pi', () => {
    const value = interpolateHeading(Math.PI - .1, -Math.PI + .1, .5);
    expect(Math.abs(Math.abs(value) - Math.PI)).toBeLessThan(.001);
  });
});
