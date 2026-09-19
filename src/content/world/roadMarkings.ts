import type { Vec3 } from '../../contracts';
import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { CityPaint } from './chalakkudyCity';
import { EXPANSION_LAYOUT, V2_LAYOUT, V2_ROUTES } from './definition';

const WHITE = '#f1efe6';
/** Two-lane roads that get a dashed centre line and solid edge lines. */
export const MARKED_ROADS: ReadonlySet<string> = new Set(['malakkappara-road', 'chalakudy-dam-road', 'malakkappara-market-road']);

function polylineDistance(x: number, z: number, pts: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
}

/** The route resampled every ~`step` m, with smoothed left normals and distance along. */
export function resampleRoute(points: readonly Vec3[], step = 1.5) {
  const out: { x: number; y: number; z: number; s: number; nx: number; nz: number }[] = [];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1e-6) continue;
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = out.length ? 1 : 0; k <= n; k++) { const t = k / n; out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, s: s + l * t, nx: 0, nz: 0 }); }
    s += l;
  }
  for (let i = 0; i < out.length; i++) {
    const p = out[Math.max(0, i - 2)], q = out[Math.min(out.length - 1, i + 2)], l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    out[i].nx = -(q.z - p.z) / l; out[i].nz = (q.x - p.x) / l;
  }
  return out;
}

/**
 * Kerala two-lane paint: solid white edge lines just inside the shoulders and a dashed white centre
 * line (3 m dash, 3 m gap). Paint stops short of junctions with other car roads and of turning caps.
 */
export function twoLaneMarkings(route: ExpansionRoute, others: readonly ExpansionRoute[], caps: readonly { center: Vec3; radius: number }[]): CityPaint[] {
  const half = route.widthM / 2, samples = resampleRoute(route.points), paint: CityPaint[] = [];
  const clear = (x: number, z: number) => others.every(o => polylineDistance(x, z, o.points) > o.widthM / 2 + 3) && caps.every(c => Math.hypot(x - c.center[0], z - c.center[2]) > c.radius + 2);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (!clear(a.x, a.z) || !clear(b.x, b.z)) continue;
    const strip = (o: number, width: number) => paint.push({ a: [a.x + a.nx * o, a.z + a.nz * o], b: [b.x + b.nx * o, b.z + b.nz * o], width, color: WHITE });
    for (const o of [-(half - .3), half - .3]) strip(o, .12);
    if (Math.floor((a.s + b.s) / 2 / 3) % 2 === 0) strip(0, .12);
  }
  return paint;
}

const carRoutes = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'));
/** Paint for every marked road, ready for `createPaintGeometry`. */
export const ROAD_MARKINGS: CityPaint[] = V2_ROUTES.filter(r => MARKED_ROADS.has(r.id))
  .flatMap(r => twoLaneMarkings(r, carRoutes.filter(o => o.id !== r.id), V2_LAYOUT.roadCaps));
