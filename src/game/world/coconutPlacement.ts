import type { Vec3 } from '../../contracts';
import {
  BRIDGE_BOUNDS, BRIDGE_PATH, EXPANSION_GROUND, JETTY_BOUNDS, LANDMARKS, MAIN_PATH, PARKING_SPOTS, QUAY_BOUNDS,
  SAFE_SPAWNS, V2_LAYOUT, WALKING_DETOURS, WORLD_BOUNDS, containsPoint, isCarTerrainAllowed, isWater, terrainHeight,
} from '../../content/world/definition';
import { isWaterfallFootprint } from './waterfallGeometry';
import { isStuntGround } from './stuntSites';

export interface CoconutCandidate { x: number; z: number; variant: number; height: number; yaw: number; lean: number }

const CELL = 14;
const ROAD_CLEARANCE = 3;
const PATH_CLEARANCE = 5.5;
const POINT_CLEARANCE = 9;
/** Coconut palms are a lowland tree: full density below FULL, none above NONE (metres). */
const ELEVATION_FULL = 80, ELEVATION_NONE = 115;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function segmentDistance(x: number, z: number, path: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

const inflate = (b: { xMin: number; xMax: number; zMin: number; zMax: number }, m: number) => ({ xMin: b.xMin - m, xMax: b.xMax + m, zMin: b.zMin - m, zMax: b.zMax + m });
const footprintBounds = (points: readonly (readonly [number, number])[], m: number) => inflate({
  xMin: Math.min(...points.map(p => p[0])), xMax: Math.max(...points.map(p => p[0])),
  zMin: Math.min(...points.map(p => p[1])), zMax: Math.max(...points.map(p => p[1])),
}, m);

/** Village lanes drawn in KeralaWorld that are not part of MAIN_PATH (temple and tea-shop spurs). */
const VILLAGE_LANES: readonly (readonly [number, number])[][] = [[[-6, -238], [12, -238], [22, -231]], [[7, -190], [-10, -190]]];

const KEEP_CLEAR_POINTS: readonly Vec3[] = [...LANDMARKS.map(l => l.position), ...PARKING_SPOTS.map(p => p.position), ...SAFE_SPAWNS.map(s => s.position)];
const KEEP_CLEAR_AREAS = [
  inflate(JETTY_BOUNDS, 3), inflate(QUAY_BOUNDS, 3), inflate(BRIDGE_BOUNDS, 4),
  footprintBounds(V2_LAYOUT.park.footprint, 8),
  // Kodassery treehouses and their branch trail.
  { xMin: 4, xMax: 37, zMin: -436, zMax: -370 },
];

/** Data-side rules: dry, gentle ground that is off every road, path and gathering spot. Buildings are rejected later by physics. */
export function isCoconutSpotOpen(x: number, z: number): boolean {
  if (!isCarTerrainAllowed(x, z)) return false;
  for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (isWater(x + dx, z + dz)) return false;
  if (isWaterfallFootprint(x, z, 3) || isStuntGround(x, z, 6)) return false;
  const route = EXPANSION_GROUND.field(x, z);
  if (route && route.distance <= route.width + ROAD_CLEARANCE) return false;
  const v2Road = EXPANSION_GROUND.v2?.field(x, z);
  if (v2Road && v2Road.distance <= v2Road.width + ROAD_CLEARANCE) return false;
  if (segmentDistance(x, z, MAIN_PATH) < PATH_CLEARANCE || segmentDistance(x, z, BRIDGE_PATH) < PATH_CLEARANCE) return false;
  if (WALKING_DETOURS.some(detour => segmentDistance(x, z, detour.path) < 3)) return false;
  if (VILLAGE_LANES.some(lane => segmentDistance(x, z, lane) < 4.5)) return false;
  if (KEEP_CLEAR_AREAS.some(area => containsPoint(area, x, z))) return false;
  return !KEEP_CLEAR_POINTS.some(p => Math.hypot(p[0] - x, p[2] - z) < POINT_CLEARANCE);
}

/** Soft, low-frequency groves so palms cluster the way they do around Kerala homesteads and riverbanks. */
function groveDensity(x: number, z: number) {
  const g = Math.sin(x * .013 + 1.3) * Math.sin(z * .011 + .7) + .5 * Math.sin((x + z) * .021 + 2.1);
  return Math.max(.06, Math.min(.85, .3 + .38 * g));
}

/**
 * Seeded and deterministic, so the same world always grows the same palms.
 * `weights` picks a variant per tree; `heights` gives each variant's [min, max] height in metres.
 */
export function coconutCandidates(weights: readonly number[], heights: readonly (readonly [number, number])[]): CoconutCandidate[] {
  const r = rng(20001), total = weights.reduce((a, b) => a + b, 0), out: CoconutCandidate[] = [];
  const b = WORLD_BOUNDS;
  for (let cx = b.xMin; cx < b.xMax; cx += CELL) for (let cz = b.zMin; cz < b.zMax; cz += CELL) {
    // Consume a fixed number of draws per cell so edits to the filters never reshuffle the rest of the world.
    const draws = Array.from({ length: 8 }, r);
    const x = cx + draws[0] * CELL, z = cz + draws[1] * CELL;
    const y = terrainHeight(x, z);
    const elevation = Math.max(0, Math.min(1, (ELEVATION_NONE - y) / (ELEVATION_NONE - ELEVATION_FULL)));
    if (draws[2] > groveDensity(x, z) * elevation * 1.25 || !isCoconutSpotOpen(x, z)) continue;
    let pick = draws[3] * total, variant = 0;
    while (pick > weights[variant] && variant < weights.length - 1) pick -= weights[variant++];
    const [lo, hi] = heights[variant];
    out.push({ x, z, variant, height: lo + draws[4] * (hi - lo), yaw: draws[5] * Math.PI * 2, lean: (draws[6] - .5) * .12 });
  }
  return out;
}
