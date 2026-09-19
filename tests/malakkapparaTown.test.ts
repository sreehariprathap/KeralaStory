import { describe, expect, it } from 'vitest';
import { MALAKKAPPARA_LOTS, lotCorners } from '../src/content/world/malakkapparaPlan';
import { MALAKKAPPARA_TOWN } from '../src/content/world/malakkapparaTown';
import { EXPANSION_LAYOUT, V2_ROUTES, isWater, terrainHeight } from '../src/content/world/definition';

const roads = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'));
const corners = (l: typeof MALAKKAPPARA_LOTS[number]) => lotCorners(l);
const roadGap = (x: number, z: number) => Math.min(...roads.map(r => { let best = Infinity; for (let i = 1; i < r.points.length; i++) { const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[2] - a[2]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t)); } return best - r.widthM / 2; }));

describe('Malakkappara town', () => {
  it('builds a real town', () => {
    const kinds = MALAKKAPPARA_LOTS.map(l => l.kind);
    expect(kinds.filter(k => k === 'shop').length).toBeGreaterThanOrEqual(18);
    expect(kinds.filter(k => k === 'house').length).toBeGreaterThanOrEqual(20);
    expect(kinds.filter(k => k === 'hotel').length).toBe(2);
    expect(kinds.filter(k => k === 'resort-cottage').length).toBeGreaterThanOrEqual(4);
    expect(kinds).toContain('bus-shelter');
  });
  it('keeps every lot off roads and water', () => {
    for (const l of MALAKKAPPARA_LOTS) for (const [x, z] of corners(l)) {
      expect(roadGap(x, z), l.id).toBeGreaterThan(1.5);
      expect(isWater(x, z), l.id).toBe(false);
    }
  });
  it('never overlaps two lots', () => {
    const boxes = MALAKKAPPARA_LOTS.map(l => { const c = corners(l); return { id: l.id, xs: c.map(p => p[0]), zs: c.map(p => p[1]) }; });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const apart = Math.max(...a.xs) <= Math.min(...b.xs) || Math.max(...b.xs) <= Math.min(...a.xs) || Math.max(...a.zs) <= Math.min(...b.zs) || Math.max(...b.zs) <= Math.min(...a.zs);
      expect(apart, `${a.id} × ${b.id}`).toBe(true);
    }
  });
  it('stands every building on a plinth that reaches the ground', () => {
    for (const l of MALAKKAPPARA_LOTS) {
      const plinth = MALAKKAPPARA_TOWN.boxes.find(b => b.id === `${l.id}-plinth`)!;
      expect(plinth, l.id).toBeDefined();
      const bottom = plinth.position[1] - plinth.size[1] / 2;
      for (const [x, z] of corners(l)) expect(bottom, l.id).toBeLessThanOrEqual(terrainHeight(x, z) + .01);
    }
  });
});
