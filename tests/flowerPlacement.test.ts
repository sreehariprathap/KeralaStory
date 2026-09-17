import { describe, expect, it } from 'vitest';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, MAIN_PATH, isWater, terrainHeight } from '../src/content/world/definition';
import { flowerPatches, isFlowerSpotOpen, treeSpots } from '../src/game/world/flowerPlacement';
import { isStuntGround } from '../src/game/world/stuntSites';

const weights = [1, 3, 2];
const heights = [[.3, .5], [.4, .7], [.6, .9]] as const;
const trees = treeSpots();
const patches = flowerPatches(weights, heights, trees);

function pathDistance(x: number, z: number) {
  let best = Infinity;
  for (let i = 1; i < MAIN_PATH.length; i++) {
    const [ax, az] = MAIN_PATH[i - 1], [bx, bz] = MAIN_PATH[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

describe('flower placement', () => {
  it('is deterministic and uses every variant within its height range', () => {
    expect(flowerPatches(weights, heights, trees)).toEqual(patches);
    expect(patches.length).toBeGreaterThan(1500);
    for (let v = 0; v < weights.length; v++) expect(patches.some(p => p.variant === v)).toBe(true);
    for (const p of patches) {
      const [lo, hi] = heights[p.variant];
      expect(p.height).toBeGreaterThanOrEqual(lo);
      expect(p.height).toBeLessThanOrEqual(hi);
    }
  });

  it('keeps every bed off roads, paths, water and sports ground', () => {
    for (const p of patches) {
      expect(isWater(p.x, p.z)).toBe(false);
      expect(isStuntGround(p.x, p.z)).toBe(false);
      expect(pathDistance(p.x, p.z)).toBeGreaterThan(5);
      for (const field of [EXPANSION_GROUND.field(p.x, p.z), EXPANSION_GROUND.v2?.field(p.x, p.z)]) {
        if (field) expect(field.distance).toBeGreaterThan(field.width);
      }
    }
  });

  it('grows most beds beside trees', () => {
    // Spatial hash of trunks, so the check stays fast.
    const cells = new Map<string, { x: number; z: number }[]>();
    for (const t of trees) { const k = `${Math.floor(t.x / 10)},${Math.floor(t.z / 10)}`; cells.set(k, [...(cells.get(k) ?? []), t]); }
    const nearTree = patches.filter(p => {
      const cx = Math.floor(p.x / 10), cz = Math.floor(p.z / 10);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((cells.get(`${cx + i},${cz + j}`) ?? []).some(t => Math.hypot(t.x - p.x, t.z - p.z) <= 5.6)) return true;
      return false;
    });
    expect(nearTree.length / patches.length).toBeGreaterThan(.7);
  });

  it('dresses the summit meadows but leaves the viewpoint terrace clear', () => {
    const [sx, , sz] = EXPANSION_LAYOUT.summitPosition;
    const peak = patches.filter(p => Math.hypot(p.x - sx, p.z - sz) < 175 && terrainHeight(p.x, p.z) >= 110);
    expect(peak.length).toBeGreaterThan(200);
    expect(patches.every(p => Math.hypot(p.x - sx, p.z - sz) >= 14)).toBe(true);
    expect(isFlowerSpotOpen(sx, sz)).toBe(false);
  });
});
