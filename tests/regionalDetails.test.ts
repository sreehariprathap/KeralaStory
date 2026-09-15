import { describe, expect, it } from 'vitest';
import { isWater, MAIN_PATH, terrainHeight } from '../src/content/world/definition';
import { BANANA_GROUPS, CARDAMOM_GROUPS, FISHING_DETAILS, SPICE_GARDEN_BOUNDS, SPICE_SUPPORTS, SPICE_VINES } from '../src/content/zones/prototypeDetails';

function corridorDistance(x: number, z: number): number {
  return Math.min(...MAIN_PATH.map(([px, pz]) => Math.hypot(x - px, z - pz)));
}

describe('regional prototype details', () => {
  it('keeps spice planting in the authored garden and off the main approach', () => {
    const all = [...SPICE_SUPPORTS, ...SPICE_VINES, ...CARDAMOM_GROUPS, ...BANANA_GROUPS];
    for (const item of all) {
      expect(item.x).toBeGreaterThanOrEqual(SPICE_GARDEN_BOUNDS.xMin);
      expect(item.x).toBeLessThanOrEqual(SPICE_GARDEN_BOUNDS.xMax);
      expect(item.z).toBeGreaterThanOrEqual(SPICE_GARDEN_BOUNDS.zMin);
      expect(item.z).toBeLessThanOrEqual(SPICE_GARDEN_BOUNDS.zMax);
      expect(isWater(item.x, item.z)).toBe(false);
      expect(corridorDistance(item.x, item.z)).toBeGreaterThan(3);
      expect(terrainHeight(item.x, item.z)).toBeTypeOf('number');
    }
  });

  it('places fishing prototypes at the two authored dry river-bank detours', () => {
    expect(FISHING_DETAILS.map(({ id }) => id)).toEqual(['north-fishing', 'south-fishing']);
    for (const detail of FISHING_DETAILS) {
      expect(isWater(detail.x, detail.z)).toBe(false);
      expect(terrainHeight(detail.x, detail.z)).toBeTypeOf('number');
      expect(corridorDistance(detail.x, detail.z)).toBeGreaterThan(3);
    }
  });
});
