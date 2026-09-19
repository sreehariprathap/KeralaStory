import { describe, expect, it } from 'vitest';
import { ROAD_MARKINGS, MARKED_ROADS } from '../src/content/world/roadMarkings';
import { V2_ROUTES, V2_LAYOUT } from '../src/content/world/definition';

const dist = (x: number, z: number, pts: readonly (readonly number[])[]) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[2] - a[2]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t)); }
  return best;
};
describe('two-lane road markings', () => {
  const marked = V2_ROUTES.filter(r => MARKED_ROADS.has(r.id));
  it('marks the Malakkappara roads', () => {
    expect(marked.map(r => r.id).sort()).toEqual(['chalakudy-dam-road', 'malakkappara-market-road', 'malakkappara-road']);
    expect(ROAD_MARKINGS.length).toBeGreaterThan(500);
  });
  it('keeps every strip on its carriageway', () => {
    for (const s of ROAD_MARKINGS) {
      const mx = (s.a[0] + s.b[0]) / 2, mz = (s.a[1] + s.b[1]) / 2;
      expect(Math.min(...marked.map(r => dist(mx, mz, r.points) - r.widthM / 2))).toBeLessThan(0);
      expect(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])).toBeLessThan(2.1);
    }
  });
  it('leaves turning caps unpainted', () => {
    for (const cap of V2_LAYOUT.roadCaps) for (const s of ROAD_MARKINGS) expect(Math.hypot(s.a[0] - cap.center[0], s.a[1] - cap.center[2])).toBeGreaterThan(cap.radius);
  });
});
