import { describe, expect, it } from 'vitest';
import { requiredFarPlane, summitBlend } from '../src/game/camera/panoramaMath';

describe('requiredFarPlane', () => {
  it('applies the margin to the most distant target', () => {
    expect(requiredFarPlane([0, 0, 0], [[3, 4, 0]], 1.2)).toBe(6);
  });

  it('clamps the result to one', () => {
    expect(requiredFarPlane([1, 2, 3], [[1, 2, 3]], 1)).toBe(1);
  });

  it('rejects invalid inputs', () => {
    expect(() => requiredFarPlane([0, 0], [[0, 0, 0]], 1)).toThrow(RangeError);
    expect(() => requiredFarPlane([0, 0, 0], [], 1)).toThrow(RangeError);
    expect(() => requiredFarPlane([0, 0, Number.NaN], [[0, 0, 0]], 1)).toThrow(RangeError);
    expect(() => requiredFarPlane([0, 0, 0], [[0, 0]], 1)).toThrow(RangeError);
    expect(() => requiredFarPlane([0, 0, 0], [[0, 0, 0]], 0.99)).toThrow(RangeError);
    expect(() => requiredFarPlane([0, 0, 0], [[0, 0, 0]], Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('summitBlend', () => {
  it('returns smoothstep endpoints and midpoint', () => {
    expect(summitBlend(0, 0, 10)).toBe(0);
    expect(summitBlend(5, 0, 10)).toBe(0.5);
    expect(summitBlend(10, 0, 10)).toBe(1);
  });

  it('clamps heights outside the blend interval', () => {
    expect(summitBlend(-1, 0, 10)).toBe(0);
    expect(summitBlend(11, 0, 10)).toBe(1);
  });

  it('rejects non-finite values and an invalid interval', () => {
    expect(() => summitBlend(Number.NaN, 0, 10)).toThrow(RangeError);
    expect(() => summitBlend(1, Number.NEGATIVE_INFINITY, 10)).toThrow(RangeError);
    expect(() => summitBlend(1, 0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => summitBlend(1, 10, 10)).toThrow(RangeError);
    expect(() => summitBlend(1, 11, 10)).toThrow(RangeError);
  });
});
