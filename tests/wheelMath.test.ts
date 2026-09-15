import { describe, expect, it } from 'vitest';
import { wheelAngle } from '../src/game/vehicle/wheelMath';

describe('wheelAngle', () => {
  it('returns one revolution for circumference distance', () => {
    const radius = 0.35;
    expect(wheelAngle(2 * Math.PI * radius, radius)).toBeCloseTo(2 * Math.PI);
  });
  it('preserves reverse direction', () => expect(wheelAngle(-1, 0.5)).toBe(-2));
  it('rejects invalid dimensions', () => {
    expect(() => wheelAngle(1, 0)).toThrow(RangeError);
    expect(() => wheelAngle(1, -1)).toThrow(RangeError);
    expect(() => wheelAngle(1, Number.NaN)).toThrow(RangeError);
    expect(() => wheelAngle(Number.POSITIVE_INFINITY, 1)).toThrow(RangeError);
  });
});
