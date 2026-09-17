import { describe, expect, it } from 'vitest';
import { createForestInstances } from '../src/game/world/expansionInstances';

const input = (seed: number, overrides: Partial<Parameters<typeof createForestInstances>[0]> = {}) => ({
  seed,
  count: 24,
  bounds: { xMin: -10, xMax: 10, zMin: -20, zMax: 20 },
  heightAt: (x: number, z: number) => x + z / 10,
  allowedAt: () => true,
  ...overrides,
});

describe('createForestInstances', () => {
  it('is deterministic for the same seed and varies with another seed', () => {
    expect(createForestInstances(input(7))).toEqual(createForestInstances(input(7)));
    expect(createForestInstances(input(7))).not.toEqual(createForestInstances(input(8)));
  });

  it('returns no points under complete exclusion and skips non-finite heights', () => {
    expect(createForestInstances(input(1, { allowedAt: () => false }))).toEqual([]);
    const instances = createForestInstances(input(1, {
      heightAt: (x) => x < 0 ? Number.NaN : 3,
    }));
    expect(instances.every(({ position }) => Number.isFinite(position[1]))).toBe(true);
  });

  it('never accepts forbidden points and does not exceed the requested count', () => {
    const instances = createForestInstances(input(4, {
      count: 100,
      allowedAt: (x, z) => x * x + z * z > 25,
    }));
    expect(instances).toHaveLength(100);
    expect(instances.every(({ position: [x, , z] }) => x * x + z * z > 25)).toBe(true);
  });

  it('rejects invalid counts, seeds, and bounds', () => {
    expect(() => createForestInstances(input(1, { count: -1 }))).toThrow(RangeError);
    expect(() => createForestInstances(input(1, { count: 1.5 }))).toThrow(RangeError);
    expect(() => createForestInstances(input(Number.NaN))).toThrow(RangeError);
    expect(() => createForestInstances(input(1, { bounds: { xMin: 2, xMax: 2, zMin: 0, zMax: 1 } }))).toThrow(RangeError);
    expect(() => createForestInstances(input(1, { bounds: { xMin: 2, xMax: 1, zMin: 0, zMax: 1 } }))).toThrow(RangeError);
  });
});
