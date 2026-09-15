import { describe, expect, it } from 'vitest';
import type { MapBounds } from '../src/contracts';
import { bearingToWaypoint, distanceToWaypoint, mapToWorldViewport } from '../src/features/map/mapGeometry';

const bounds: MapBounds = { xMin: -10, xMax: 10, zMin: -20, zMax: 20 };
const canvas = { width: 340, height: 650 };

describe('map geometry', () => {
  it('maps viewBox corners to world bounds', () => {
    const rect = { left: 0, top: 0, width: 340, height: 650 };
    expect(mapToWorldViewport(0, 0, rect, { x: 0, y: 0, width: 340, height: 650 }, bounds, canvas)).toEqual([-10, 0, -20]);
    expect(mapToWorldViewport(340, 650, rect, { x: 0, y: 0, width: 340, height: 650 }, bounds, canvas)).toEqual([10, 0, 20]);
  });

  it('handles pan and zoom through the viewBox', () => {
    const rect = { left: 20, top: 10, width: 340, height: 650 };
    const world = mapToWorldViewport(190, 335, rect, { x: 85, y: 162.5, width: 170, height: 325 }, bounds, canvas);
    expect(world?.[0]).toBeCloseTo(0);
    expect(world?.[2]).toBeCloseTo(0);
  });

  it('ignores letterbox margins', () => {
    const rect = { left: 0, top: 0, width: 650, height: 340 };
    const viewBox = { x: 0, y: 0, width: 340, height: 650 };
    const topLeft = mapToWorldViewport((650 - 340 * (340 / 650)) / 2, 0, rect, viewBox, bounds, canvas);
    expect(topLeft?.[0]).toBeCloseTo(-10);
    expect(topLeft?.[2]).toBeCloseTo(-20);
    expect(mapToWorldViewport(100, 0, rect, viewBox, bounds, canvas)).toBeNull();
  });

  it('returns north-up bearing and horizontal distance', () => {
    expect(bearingToWaypoint([0, 0, 0], [0, 0, -1])).toBeCloseTo(0);
    expect(bearingToWaypoint([0, 0, 0], [1, 0, 0])).toBeCloseTo(Math.PI / 2);
    expect(distanceToWaypoint([0, 0, 0], [3, 99, 4])).toBe(5);
  });
});
