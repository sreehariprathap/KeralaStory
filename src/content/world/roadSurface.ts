import type { Vec3 } from '../../contracts';
import { EXPANSION_LAYOUT, V2_ROUTES, MAIN_PATH } from './definition';
import { CHALAKKUDY_BRIDGES, CHALAKKUDY_CITY_ROADS, CITY_ROAD_WIDTH_M } from './chalakkudyCityPlan';
import { isStuntGround } from '../../game/world/stuntSites';

export type SurfaceKind = 'paved' | 'dirt' | 'offroad';
export interface SurfaceSample { kind: SurfaceKind; gripFactor: number; topSpeedFactor: number }

const FACTORS: Record<SurfaceKind, { gripFactor: number; topSpeedFactor: number }> = {
  paved: { gripFactor: 1, topSpeedFactor: 1 },
  dirt: { gripFactor: .75, topSpeedFactor: .85 },
  offroad: { gripFactor: .55, topSpeedFactor: .7 },
};

/** Metres beyond a route's half-width where grip fades smoothly toward off-road, instead of snapping. */
const SHOULDER_M = 2;
/** MAIN_PATH predates the ExpansionRoute system and carries no width of its own; the rest of the
 * codebase (isCycleAllowed, wildlifeRules.ts) already treats it as this fixed paved corridor. */
const MAIN_PATH_HALF_WIDTH_M = 3;

interface Segment { a: Vec3; b: Vec3; halfWidth: number; surface: 'paved' | 'dirt' }

function buildSegments(): Segment[] {
  const segments: Segment[] = [];
  const addPolyline = (points: readonly Vec3[], halfWidth: number, surface: 'paved' | 'dirt') => {
    for (let i = 1; i < points.length; i++) segments.push({ a: points[i - 1], b: points[i], halfWidth, surface });
  };
  for (const route of [...EXPANSION_LAYOUT.routes, ...V2_ROUTES]) addPolyline(route.points, route.widthM / 2, route.surface ?? 'paved');
  for (const bridge of CHALAKKUDY_BRIDGES) addPolyline([bridge.from, bridge.to], bridge.width / 2, 'paved');
  for (const road of CHALAKKUDY_CITY_ROADS) addPolyline(road.points, CITY_ROAD_WIDTH_M / 2, 'paved');
  addPolyline(MAIN_PATH.map(([x, z]): Vec3 => [x, 0, z]), MAIN_PATH_HALF_WIDTH_M, 'paved');
  return segments;
}

const SEGMENTS = buildSegments();

function distanceToSegment(x: number, z: number, a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
}

function nearestSegment(x: number, z: number): { distance: number; halfWidth: number; surface: 'paved' | 'dirt' } | null {
  let best: { distance: number; halfWidth: number; surface: 'paved' | 'dirt' } | null = null;
  for (const segment of SEGMENTS) {
    const distance = distanceToSegment(x, z, segment.a, segment.b);
    if (!best || distance < best.distance) best = { distance, halfWidth: segment.halfWidth, surface: segment.surface };
  }
  return best;
}

function blendTowardOffroad(from: SurfaceKind, t: number): SurfaceSample {
  const a = FACTORS[from], b = FACTORS.offroad;
  return { kind: from, gripFactor: a.gripFactor + (b.gripFactor - a.gripFactor) * t, topSpeedFactor: a.topSpeedFactor + (b.topSpeedFactor - a.topSpeedFactor) * t };
}

export function surfaceAt(x: number, z: number): SurfaceSample {
  if (isStuntGround(x, z)) return { kind: 'paved', ...FACTORS.paved };
  const nearest = nearestSegment(x, z);
  if (!nearest) return { kind: 'offroad', ...FACTORS.offroad };
  if (nearest.distance <= nearest.halfWidth) return { kind: nearest.surface, ...FACTORS[nearest.surface] };
  if (nearest.distance <= nearest.halfWidth + SHOULDER_M) return blendTowardOffroad(nearest.surface, (nearest.distance - nearest.halfWidth) / SHOULDER_M);
  return { kind: 'offroad', ...FACTORS.offroad };
}
