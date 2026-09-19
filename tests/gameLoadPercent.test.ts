import { describe, expect, it } from 'vitest';
import { displayPercent } from '../src/features/shell/loadPercent';

describe('load screen percent', () => {
  it('starts at zero and reaches 100 only when leaving', () => {
    expect(displayPercent(0, 0, false)).toBe(0);
    expect(displayPercent(1, 600_000, false)).toBe(95);
    expect(displayPercent(0.2, 1000, true)).toBe(100);
  });

  it('keeps moving after downloads finish while the world compiles', () => {
    const downloaded = displayPercent(1, 1500, false);
    expect(downloaded).toBeGreaterThanOrEqual(70);
    expect(displayPercent(1, 6000, false)).toBeGreaterThan(downloaded);
    expect(displayPercent(1, 12000, false)).toBeGreaterThan(displayPercent(1, 6000, false));
  });

  it('never goes backwards as time and progress grow', () => {
    let previous = 0;
    for (let step = 0; step <= 40; step++) {
      const value = displayPercent(Math.min(1, step / 20), step * 500, false);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});
