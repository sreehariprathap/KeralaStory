import { describe, expect, it } from 'vitest';
import { TEA_ESTATE, TEA_ESTATE_PLANTING } from '../src/content/world/teaEstate';
import { V2_LAYOUT, V2_ROUTES, EXPANSION_LAYOUT, isWater } from '../src/content/world/definition';
import { pointInPolygon } from '../src/content/world/expansionLayout';

const routes = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES];
function roadClearance(x: number, z: number) {
  let best = Infinity;
  for (const r of routes) for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) - r.widthM / 2);
  }
  return best;
}

describe('Peringalkuthu tea estate', () => {
  const points = TEA_ESTATE_PLANTING.rows.flatMap(r => r.points);
  const town = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!;
  it('plants a broad contour band up the slopes', () => {
    expect(TEA_ESTATE.rows).toBe(22);
    expect(points.length).toBeGreaterThan(9000);
  });
  it('keeps every hedge off roads, water and the town', () => {
    expect(points.filter(([x, , z]) => roadClearance(x, z) < 1.2 || isWater(x, z) || pointInPolygon(x, z, town.footprint)).length).toBe(0);
  });
  it('threads winding picker paths across the rows, never through a hedge', () => {
    expect(TEA_ESTATE_PLANTING.paths.length).toBeGreaterThan(20);
    for (const path of TEA_ESTATE_PLANTING.paths) {
      expect(path.length).toBeGreaterThanOrEqual(4);
      const xs = path.map(p => p[0]);
      // Winding, not a ruler-straight cut.
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    }
    const hedgeNear = (x: number, z: number) => points.some(p => Math.hypot(p[0] - x, p[2] - z) < .6);
    const sample = TEA_ESTATE_PLANTING.paths.flatMap(p => p.filter((_, i) => i % 3 === 1)).slice(0, 200);
    expect(sample.filter(([x, , z]) => hedgeNear(x, z)).length).toBe(0);
  });
});
