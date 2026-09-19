import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_LAYOUT, V2_LAYOUT, V2_ROUTES, terrainHeight, walkableDeckHeight } from '../src/content/world/definition';
import { CHALAKKUDY_BRIDGES } from '../src/content/world/chalakkudyCityPlan';
import { createCanonicalWorldDefinition } from '../packages/simulation/src/worldDefinition';
import { ROAD_DESTINATIONS, ROAD_DRIVE_ROUTES, roadDriveReport } from './support/roadDrive';

type P = readonly number[];
const surface = (x: number, z: number) => Math.max(walkableDeckHeight(x, z) ?? -Infinity, terrainHeight(x, z));
const distance = (x: number, z: number, points: readonly P[]) => {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
};

/** Every carriageway a car can use: roads, the unsealed summit track, bridges and the paved destinations. */
const network = [
  ...[...EXPANSION_LAYOUT.routes.filter(r => r.allowedModes.includes('car')), ...V2_ROUTES].map(r => ({ id: r.id, points: r.points as readonly P[], half: r.widthM / 2 })),
  ...ROAD_DRIVE_ROUTES.filter(r => r.id === 'village-road').map(r => ({ id: r.id, points: r.points, half: r.halfWidth })),
  ...CHALAKKUDY_BRIDGES.map(b => ({ id: b.id, points: [b.from, b.to] as readonly P[], half: b.width / 2 })),
  ...ROAD_DESTINATIONS.map(d => ({ id: d.id, points: d.points.map(([x, z]) => [x, 0, z]) as readonly P[], half: d.halfWidth })),
];
const destinations = new Set(ROAD_DESTINATIONS.map(d => d.id));

describe('road network', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('has no dead ends: every road end meets another road, a bridge, a turning circle or a paved destination', () => {
    for (const road of network.filter(r => !destinations.has(r.id))) {
      for (const end of [road.points[0], road.points.at(-1)!]) {
        const joined = network.some(other => other !== road && distance(end[0], end[2], other.points) <= other.half + .5)
          || V2_LAYOUT.roadCaps.some(cap => Math.hypot(cap.center[0] - end[0], cap.center[2] - end[2]) <= cap.radius);
        expect(joined, `${road.id} ends in nothing at ${end[0].toFixed(1)}, ${end[2].toFixed(1)}`).toBe(true);
      }
    }
  });

  it('sits every turning circle level with the road it serves', () => {
    for (const cap of V2_LAYOUT.roadCaps) {
      const [x, y, z] = cap.center;
      expect(Math.abs(surface(x, z) - y), cap.id).toBeLessThan(.35);
      // Flat enough to turn a car on: rim no more than a car's ground clearance off the centre.
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        expect(Math.abs(surface(x + Math.cos(a) * (cap.radius - 1), z + Math.sin(a) * (cap.radius - 1)) - surface(x, z)), cap.id).toBeLessThan(1.2);
      }
    }
  });

  it('keeps every solid off the carriageways', () => {
    const allowed = /^(bridge-|chokkana-stream-deck|harbor-quay|harbor-south-ramp|jetty|athirappilly-trail-bridge|chalakkudy-.*-bridge|kurumali-highway-bridge|park-forecourt)/;
    const boxes = createCanonicalWorldDefinition().boxes.filter(b => !allowed.test(b.id));
    for (const road of network.filter(r => !destinations.has(r.id))) {
      const hits = new Set<string>();
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 2);
        for (let k = 0; k <= steps; k++) {
          const x = a[0] + (b[0] - a[0]) * k / steps, z = a[2] + (b[2] - a[2]) * k / steps, y = surface(x, z);
          for (const box of boxes) {
            const yaw = box.rotation[1], dx = x - box.position[0], dz = z - box.position[2];
            const lx = Math.cos(yaw) * dx - Math.sin(yaw) * dz, lz = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
            // The inner carriageway: a kerb-side post or a building's eave over the verge does not count.
            const reach = road.half - .8;
            if (Math.abs(lx) >= box.size[0] / 2 + reach || Math.abs(lz) >= box.size[2] / 2 + reach) continue;
            if (distance(box.position[0], box.position[2], road.points) > reach + Math.min(box.size[0], box.size[2]) / 2) continue;
            const top = box.position[1] + box.size[1] / 2, bottom = box.position[1] - box.size[1] / 2;
            if (top > y + .1 && bottom < y + 2) hits.add(box.id);
          }
        }
      }
      expect([...hits], road.id).toEqual([]);
    }
  });

  it('drives every paved road both ways at racing pace without a bump, a jump or a crash', { timeout: 120_000 }, () => {
    for (const route of ROAD_DRIVE_ROUTES) for (const reverse of [false, true]) {
      const report = roadDriveReport(route, reverse), label = `${route.id}${reverse ? ' (reverse)' : ''}`;
      expect(report.finished, `${label} stuck at ${report.stuckAt}`).toBe(true);
      expect(report.airborneMs, `${label} airborne`).toBeLessThanOrEqual(150);
      expect(report.maxJolt, `${label} jolt at ${report.joltAt}`).toBeLessThanOrEqual(10.5);
      expect(report.maxTilt, `${label} tilt`).toBeLessThan(.45);
      expect(report.maxOffset, `${label} left the road at ${report.offsetAt}`).toBeLessThan(route.halfWidth + 1.5);
      // Long enough to get up to speed: a racing car should never be crawling.
      const length = route.points.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - route.points[i - 1][0], p[2] - route.points[i - 1][2]) : 0, 0);
      if (length > 80) expect(report.averageSpeed, `${label} pace`).toBeGreaterThan(8);
    }
  });
});
