import { describe, expect, it } from 'vitest';
import { headingToDegrees, mapToWorld, worldToMap } from '../src/features/map/projection.ts';

const bounds = { xMin: -210, xMax: 210, zMin: -520, zMax: 530 };

describe('map projection', () => {
  it('projects corners and center', () => {
    expect(worldToMap([-210, 4, -520], bounds)).toEqual({ u: 0, v: 0 });
    expect(worldToMap([210, 4, 530], bounds)).toEqual({ u: 1, v: 1 });
    expect(worldToMap([0, 4, 5], bounds)).toEqual({ u: 0.5, v: 0.5 });
  });

  it('round trips with elevation', () => {
    const map = worldToMap([13, 7, -91], bounds);
    expect(mapToWorld(map.u, map.v, bounds, 7)).toEqual([13, 7, -91]);
  });

  it('uses north zero and clockwise heading degrees', () => {
    expect(headingToDegrees(0)).toBe(0);
    expect(headingToDegrees(Math.PI / 2)).toBe(90);
    expect(headingToDegrees(-Math.PI / 2)).toBe(270);
  });

  it('rejects zero dimensions', () => {
    expect(() => worldToMap([0, 0, 0], { ...bounds, xMax: bounds.xMin })).toThrow(RangeError);
    expect(() => mapToWorld(0, 0, { ...bounds, zMax: bounds.zMin })).toThrow(RangeError);
  });
});
