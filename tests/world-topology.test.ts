import { describe, expect, it } from 'vitest';
import {
  BRIDGE_DECK_Y, BRIDGE_PATH, BRIDGE_X, CITY_PATH, KODASSERY_PATH, riverCenter,
  RIVER_CENTERLINE, isRiver, isWater, terrainHeight, VILLAGE_PATH, WATER_LEVEL,
  WORLD_BOUNDS,
} from '../src/content/world/kodassery.ts';

type Point = readonly [number, number];

function samePoint(a: Point, b: Point): void {
  expect(a[0]).toBe(b[0]);
  expect(a[1]).toBe(b[1]);
}

describe('connected Kerala Story world topology', () => {
  it('joins the Kodassery, village, bridge, and city routes', () => {
    samePoint(KODASSERY_PATH[KODASSERY_PATH.length - 1], VILLAGE_PATH[0]);
    samePoint(VILLAGE_PATH[VILLAGE_PATH.length - 1], BRIDGE_PATH[0]);
    samePoint(BRIDGE_PATH[BRIDGE_PATH.length - 1], CITY_PATH[0]);
    for (const path of [KODASSERY_PATH, VILLAGE_PATH, CITY_PATH, BRIDGE_PATH]) {
      for (const [x, z] of path) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMin);
        expect(x).toBeLessThanOrEqual(WORLD_BOUNDS.xMax);
        expect(z).toBeGreaterThanOrEqual(WORLD_BOUNDS.zMin);
        expect(z).toBeLessThanOrEqual(WORLD_BOUNDS.zMax);
      }
    }
  });

  it('carries the river centerline across the playable x extent', () => {
    expect(RIVER_CENTERLINE[0][0]).toBeLessThanOrEqual(WORLD_BOUNDS.xMin);
    expect(RIVER_CENTERLINE[RIVER_CENTERLINE.length - 1][0]).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMax);
    expect(isRiver(WORLD_BOUNDS.xMin, riverCenter(WORLD_BOUNDS.xMin))).toBe(true);
    expect(isRiver(WORLD_BOUNDS.xMax, riverCenter(WORLD_BOUNDS.xMax))).toBe(true);
  });

  it('keeps the bridge deck above the water level', () => {
    expect(BRIDGE_X).toBe(BRIDGE_PATH[0][0]);
    expect(BRIDGE_DECK_Y).toBeGreaterThan(WATER_LEVEL);
    expect(isWater(BRIDGE_X, -99)).toBe(true);
  });

  it('keeps the far banks above water', () => {
    expect(terrainHeight(0, -130)).toBeGreaterThan(WATER_LEVEL);
    expect(terrainHeight(0, -70)).toBeGreaterThan(WATER_LEVEL);
  });

  it('distinguishes river water, ordinary land, and coastal water', () => {
    expect(isWater(0, riverCenter(0))).toBe(true);
    expect(isWater(0, -130)).toBe(false);
    expect(isWater(0, -300)).toBe(false);
    expect(isWater(0, 91)).toBe(true);
    expect(isWater(84, 0)).toBe(true);
  });
});
