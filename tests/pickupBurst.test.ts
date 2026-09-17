import { describe, expect, it } from 'vitest';
import { BURST_SECONDS, burstStep } from '../src/game/collectables/PickupBurst';

describe('pickup burst', () => {
  it('starts at full size and full opacity', () => {
    const start = burstStep(0);
    expect(start?.scale).toBeCloseTo(1, 5);
    expect(start?.opacity).toBeCloseTo(1, 5);
    expect(start?.rise).toBeCloseTo(0, 5);
  });

  it('grows, rises and fades over its life', () => {
    const mid = burstStep(BURST_SECONDS / 2)!;
    expect(mid.scale).toBeGreaterThan(1);
    expect(mid.rise).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.opacity).toBeGreaterThan(0);
  });

  it('is finished once its life is over', () => {
    expect(burstStep(BURST_SECONDS + .01)).toBeNull();
  });
});
