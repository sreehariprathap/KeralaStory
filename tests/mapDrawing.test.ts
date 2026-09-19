import { describe, expect, it } from 'vitest';
import { smoothPath, simplify } from '../src/features/map/smoothPath';
import { layoutLabels } from '../src/features/map/labelLayout';
import { elevationTint, hillshade } from '../src/features/map/mapRelief';
import { buildingFootprints, mapCities, mapHighlights } from '../src/features/map/mapFeatures';
import { V2_LAYOUT } from '../src/content/world/definition';

describe('smooth map paths', () => {
  it('passes through every point with cubic segments', () => {
    const d = smoothPath([[0, 0], [10, 0], [10, 10]]);
    expect(d.startsWith('M0 0C')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d.endsWith('10 10')).toBe(true);
    expect(smoothPath([[0, 0], [5, 0], [5, 5]], { closed: true }).endsWith('Z')).toBe(true);
    expect(smoothPath([])).toBe('');
  });
  it('drops crowded points but keeps both ends', () => {
    expect(simplify([[0, 0], [.2, 0], [.4, 0], [5, 0], [5.1, 0]], 1)).toEqual([[0, 0], [5, 0], [5.1, 0]]);
  });
});

describe('label layout', () => {
  it('moves a colliding label to another side and hides one with no room', () => {
    const placed = layoutLabels([
      { id: 'a', text: 'Alpha', x: 0, y: 0, fontSize: 10, offset: 4, priority: 2 },
      { id: 'b', text: 'Bravo', x: 2, y: 0, fontSize: 10, offset: 4, priority: 1 },
    ]);
    expect(placed.map(p => p.id)).toEqual(['a', 'b']);
    expect(placed[0].anchor).toBe('start');
    expect(placed[1].anchor).not.toBe('start');
    const crowded = layoutLabels([
      { id: 'big', text: 'CITY', x: 0, y: 0, fontSize: 40, offset: 0, priority: 9, centered: true },
      { id: 'small', text: 'x', x: 0, y: 0, fontSize: 40, offset: 0, priority: 1, centered: true },
    ]);
    expect(crowded.map(p => p.id)).toEqual(['big']);
  });
});

describe('relief shading', () => {
  it('tints by elevation and lights north-west slopes', () => {
    expect(elevationTint(0)[1]).toBeGreaterThan(elevationTint(100)[1]);
    expect(hillshade(0, 0)).toBeCloseTo(1);
    // Ground rising to the east faces west (toward the light): brighter.
    expect(hillshade(.5, 0)).toBeGreaterThan(1);
    expect(hillshade(-.5, 0)).toBeLessThan(1);
  });
});

describe('map features', () => {
  it('highlights adventure spots, every town and real buildings', () => {
    const kinds = new Set(mapHighlights().map(h => h.kind));
    for (const kind of ['paragliding', 'stadium', 'stunt-park', 'water-park'] as const) expect(kinds.has(kind), kind).toBe(true);
    expect(mapHighlights().every(h => h.position.every(Number.isFinite))).toBe(true);
    // Towns plus their extra districts (Chalakkudy spans both banks of the Kurumalippuzha).
    expect(mapCities().map(c => c.id).sort()).toEqual(V2_LAYOUT.towns.flatMap(t => [t.id, ...(t.districts ?? []).map(d => d.id)]).sort());
    expect(buildingFootprints().length).toBeGreaterThan(40);
  });
});

describe('place names over pins', () => {
  it('lets a centred city name sit on its own town pin', () => {
    const placed = layoutLabels([{ id: 'city', text: 'TOWN', x: 0, y: 0, fontSize: 12, offset: 0, priority: 9, centered: true }], [{ x0: -3, y0: -3, x1: 3, y1: 3, pin: true, owner: 'lm-town' }]);
    expect(placed.map(p => p.id)).toEqual(['city']);
  });
});
