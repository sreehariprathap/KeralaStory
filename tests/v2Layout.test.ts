import { describe, expect, it } from 'vitest';
import {
  LANDMARKS,
  MAP_BOUNDS,
  RIVER_CENTERLINE,
  WATER_LEVEL,
  WORLD_BOUNDS,
  WORLD_DEFINITION,
  V2_LAYOUT,
} from '../src/content/world/definition';
import { createV2Layout } from '../src/content/world/v2Layout';

const distanceToSegment = (p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]): number => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};

const isDry = (p: readonly [number, number]): boolean => V2_LAYOUT.riverReaches.every(reach =>
  reach.points.slice(1).every((point, i) => distanceToSegment(p, [reach.points[i][0], reach.points[i][2]], [point[0], point[2]]) > reach.widthsM[i] / 2));

const footprintSamples = (footprint: readonly (readonly [number, number])[], center: readonly [number, number]) => [
  ...footprint,
  ...footprint.map((point, i) => {
    const next = footprint[(i + 1) % footprint.length];
    return [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] as const;
  }),
  center,
];

describe('approved V2 world layout', () => {
  it('assigns the exact four-town tier map', () => {
    expect(Object.fromEntries(V2_LAYOUT.towns.map(town => [town.label, town.tier]))).toEqual({
      Chalakkudy: 'A', Kodakara: 'B', Kodaly: 'C', Malakkappara: 'C',
    });
  });

  it('connects every reach to declared nodes, descends downstream, and forks to both outlets', () => {
    const nodeIds = new Set(V2_LAYOUT.riverNodes.map(node => node.id));
    for (const reach of V2_LAYOUT.riverReaches) {
      expect(nodeIds.has(reach.from)).toBe(true);
      expect(nodeIds.has(reach.to)).toBe(true);
      expect(reach.points[0]).toEqual(V2_LAYOUT.riverNodes.find(node => node.id === reach.from)!.position);
      expect(reach.points.at(-1)).toEqual(V2_LAYOUT.riverNodes.find(node => node.id === reach.to)!.position);
      expect(reach.points).toHaveLength(reach.widthsM.length);
      expect(reach.widthsM.every(width => Number.isFinite(width) && width > 0)).toBe(true);
      for (let i = 1; i < reach.points.length; i++) expect(reach.points[i][1]).toBeLessThanOrEqual(reach.points[i - 1][1]);
    }
    expect(V2_LAYOUT.riverReaches.filter(reach => reach.from === 'river-fork').map(reach => reach.to)).toEqual(['main-outlet', 'kurumali-join']);

    const outgoing = new Map<string, string[]>();
    for (const reach of V2_LAYOUT.riverReaches) outgoing.set(reach.from, [...(outgoing.get(reach.from) ?? []), reach.to]);
    const seen = new Set<string>(['headwaters']);
    const queue = ['headwaters'];
    while (queue.length) for (const next of outgoing.get(queue.shift()!) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    expect(seen.has('main-outlet')).toBe(true);
    expect(seen.has('kodaly-estuary')).toBe(true);
  });

  it('preserves the legacy river samples and harbor/lighthouse landmarks', () => {
    const legacy = V2_LAYOUT.riverReaches.find(reach => reach.id === 'kurumali-existing')!;
    expect(legacy.points).toEqual(RIVER_CENTERLINE.map(([x, z]) => [x, WATER_LEVEL, z]));
    for (const id of ['harbor', 'lighthouse']) expect(LANDMARKS.find(landmark => landmark.id === id)).toBeDefined();
    expect(LANDMARKS.find(landmark => landmark.id === 'harbor')!.label).toBe('Kodaly harbor');
    expect(LANDMARKS.find(landmark => landmark.id === 'lighthouse')!.label).toBe('Kodaly lighthouse');
  });

  it('keeps all proposed footprints, roads, and river extents within V2 bounds', () => {
    const points: Array<readonly [number, number]> = [];
    for (const town of V2_LAYOUT.towns) points.push(...town.footprint);
    points.push(...V2_LAYOUT.park.footprint, ...V2_LAYOUT.park.poolFootprint);
    for (const road of V2_LAYOUT.roads) points.push(...road.points.map(point => [point[0], point[2]] as [number, number]));
    for (const reach of V2_LAYOUT.riverReaches) reach.points.forEach((point, i) => {
      const half = reach.widthsM[i] / 2;
      points.push([point[0] - half, point[2] - half], [point[0] + half, point[2] + half]);
    });
    for (const [x, z] of points) {
      expect(x).toBeGreaterThanOrEqual(V2_LAYOUT.bounds.xMin);
      expect(x).toBeLessThanOrEqual(V2_LAYOUT.bounds.xMax);
      expect(z).toBeGreaterThanOrEqual(V2_LAYOUT.bounds.zMin);
      expect(z).toBeLessThanOrEqual(V2_LAYOUT.bounds.zMax);
    }
  });

  it('keeps proposed road control segments at or below ten percent grade', () => {
    for (const road of V2_LAYOUT.roads) for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      expect(Math.abs(b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[2] - a[2]) || 1)).toBeLessThanOrEqual(0.1);
    }
  });

  it('keeps sampled corners, edges, and centers of new town footprints dry', () => {
    for (const town of V2_LAYOUT.towns.filter(town => !town.existing)) {
      for (const [x, z] of footprintSamples(town.footprint, [town.center[0], town.center[2]])) {
        expect(isDry([x, z])).toBe(true);
      }
    }
  });

  it('does not let constructing the review blueprint mutate live inputs or world contracts', () => {
    const input: Parameters<typeof createV2Layout>[0] = {
      expansion: WORLD_DEFINITION.expansion,
      existingBounds: MAP_BOUNDS,
      legacyRiver: RIVER_CENTERLINE.map(([x, z]) => [x, WATER_LEVEL, z]),
      kodalyCenter: LANDMARKS.find(landmark => landmark.id === 'market')!.position,
      villageRoadJoin: [10, 0, -184],
    };
    const inputBefore = structuredClone(input);
    const versionBefore = WORLD_DEFINITION.version;
    const zoneIdsBefore = WORLD_DEFINITION.regions.map(region => region.id);
    const result = createV2Layout(input);
    expect(input).toEqual(inputBefore);
    expect(result.bounds).not.toBe(input.existingBounds);
    expect(WORLD_DEFINITION.bounds).toBe(WORLD_BOUNDS);
    expect(WORLD_DEFINITION.bounds).not.toBe(V2_LAYOUT.bounds);
    expect(WORLD_DEFINITION.bounds).toEqual(V2_LAYOUT.bounds);
    expect(WORLD_DEFINITION.mapBounds).toBe(MAP_BOUNDS);
    expect(WORLD_DEFINITION.version).toBe(versionBefore);
    expect(WORLD_DEFINITION.regions.map(region => region.id)).toEqual(zoneIdsBefore);
  });
});
