import { describe, expect, it } from 'vitest';
import { followHeading } from '../src/game/camera/followHeading';

describe('camera heading follow', () => {
  it('takes the shortest angular path across the wrap boundary', () => {
    const next = followHeading(Math.PI - .05, Math.PI - .2, 1 / 60);
    expect(next).toBeGreaterThan(Math.PI - .05);
  });

  it('converges smoothly to the travel heading without snapping', () => {
    let azimuth = 0;
    for (let i = 0; i < 120; i++) azimuth = followHeading(azimuth, Math.PI / 2, 1 / 60);
    expect(azimuth).toBeCloseTo(-Math.PI / 2, 2);
    const first = followHeading(0, Math.PI / 2, 1 / 60);
    expect(Math.abs(first)).toBeLessThan(Math.PI / 2);
  });
});
