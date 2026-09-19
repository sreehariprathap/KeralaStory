import type { Vec3 } from '../../contracts';
import { V2_LAYOUT, V2_ROUTES, hasGroundAt, isClearOfRoads, isWater, terrainHeight } from './definition';
import { pointInPolygon } from './expansionLayout';

/**
 * Peringalkuthu Tea Estate: clipped tea hedges on the graded slopes either side of the Malakkappara–dam
 * road, the way Kerala hill estates run their rows along the contour. Each row is an offset of the road
 * line, broken wherever the ground is wet, too steep, taken by another road, the town or a turning circle,
 * and by a picker's path every few dozen metres. Deterministic data shared by rendering and placement rules.
 */
export const TEA_ESTATE = {
  id: 'peringalkuthu-tea-estate',
  label: 'Peringalkuthu Tea Estate',
  roadId: 'chalakudy-dam-road',
  /** First row's distance from the road centre, and the spacing between rows (metres). */
  firstRowM: 6.5,
  rowSpacingM: 2,
  rows: 22,
  /** Hedges are clipped flat-topped: height and full width (metres). */
  hedgeHeightM: 1,
  hedgeWidthM: 1.65,
  /** No planting on ground steeper than this (rise over run): the terraces climb the road-cut banks. */
  maxSlope: 1.15,
  /** Picker's paths wind across the rows at about this spacing along the road (metres). */
  pathEveryM: 34,
} as const;

export interface TeaRow { points: Vec3[] }
export interface ShadeTree { position: Vec3; height: number; yaw: number }

/** How far a picker's path strays along the road as it climbs through the rows. */
const wobble = (k: number, offset: number) => Math.sin(offset * .13 + k * 1.7) * 5;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const slopeAt = (x: number, z: number) => {
  const dx = terrainHeight(x + 1, z) - terrainHeight(x - 1, z), dz = terrainHeight(x, z + 1) - terrainHeight(x, z - 1);
  return Math.hypot(dx, dz) / 2;
};

function createEstate() {
  const road = V2_ROUTES.find(r => r.id === TEA_ESTATE.roadId)!;
  const town = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!;
  // The road resampled every metre with smoothed normals, and the distance along it.
  const line: { x: number; z: number; nx: number; nz: number; s: number }[] = [];
  let s = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1e-6) continue;
    for (let k = line.length ? 1 : 0, n = Math.ceil(l); k <= n; k++) line.push({ x: a[0] + (b[0] - a[0]) * k / n, z: a[2] + (b[2] - a[2]) * k / n, nx: 0, nz: 0, s: s + l * k / n });
    s += l;
  }
  for (let i = 0; i < line.length; i++) {
    const p = line[Math.max(0, i - 3)], q = line[Math.min(line.length - 1, i + 3)], l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    line[i].nx = -(q.z - p.z) / l; line[i].nz = (q.x - p.x) / l;
  }
  const roadDistance = (x: number, z: number, near: number) => {
    let best = Infinity;
    for (let i = Math.max(0, near - 80); i < Math.min(line.length, near + 80); i++) best = Math.min(best, Math.hypot(line[i].x - x, line[i].z - z));
    return best;
  };
  const plantable = (x: number, z: number, offset: number, near: number) => {
    if (!hasGroundAt(x, z) || isWater(x, z) || slopeAt(x, z) > TEA_ESTATE.maxSlope) return false;
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (isWater(x + dx, z + dz)) return false;
    if (pointInPolygon(x, z, town.footprint)) return false;
    // Inside a bend the offset line folds back on the road: keep only points really at this row's distance.
    if (roadDistance(x, z, near) < offset - .6) return false;
    // Clear of every road, trail, bridge and turning circle (the estate road itself is well inside the first row).
    return isClearOfRoads(x, z, 1.5);
  };
  // Pickers' paths first: one point a metre, climbing from the road through every row. Hedges then
  // keep a metre clear of them on the ground, which holds on the inside of bends where rows bunch up.
  const paths: Vec3[][] = [], lastRow = TEA_ESTATE.firstRowM + (TEA_ESTATE.rows - 1) * TEA_ESTATE.rowSpacingM;
  // Line samples are a metre apart: interpolate between them so paths curve instead of stepping.
  const lineAt = (at: number) => {
    const u = Math.max(0, Math.min(line.length - 1.001, at)), i = Math.floor(u), f = u - i, a = line[i], b = line[i + 1];
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, nx: a.nx + (b.nx - a.nx) * f, nz: a.nz + (b.nz - a.nz) * f };
  };
  for (let k = 1; k * TEA_ESTATE.pathEveryM < line.at(-1)!.s; k++) for (const side of [-1, 1]) {
    let path: Vec3[] = [];
    const flush = () => { if (path.length >= 4) paths.push(path); path = []; };
    for (let offset = TEA_ESTATE.firstRowM - 1; offset <= lastRow + 1; offset++) {
      const at = k * TEA_ESTATE.pathEveryM + wobble(k, offset), p = lineAt(at);
      const x = p.x + p.nx * offset * side, z = p.z + p.nz * offset * side;
      if (at < 40 || at > line.at(-1)!.s - 70 || !hasGroundAt(x, z) || isWater(x, z) || !isClearOfRoads(x, z, 1.5) || pointInPolygon(x, z, town.footprint)) { flush(); continue; }
      path.push([x, terrainHeight(x, z), z]);
    }
    flush();
  }
  const pathBins = new Map<string, [Vec3, Vec3][]>();
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const key = `${Math.floor(path[i][0] / 8)},${Math.floor(path[i][2] / 8)}`;
    pathBins.set(key, [...(pathBins.get(key) ?? []), [path[i - 1], path[i]]]);
  }
  const nearPath = (x: number, z: number) => {
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) for (const [a, b] of pathBins.get(`${Math.floor(x / 8) + dx},${Math.floor(z / 8) + dz}`) ?? []) {
      const ex = b[0] - a[0], ez = b[2] - a[2], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / (ex * ex + ez * ez || 1)));
      if (Math.hypot(x - a[0] - ex * t, z - a[2] - ez * t) < 1.15) return true;
    }
    return false;
  };
  const rows: TeaRow[] = [];
  for (const side of [-1, 1]) for (let r = 0; r < TEA_ESTATE.rows; r++) {
    const offset = TEA_ESTATE.firstRowM + r * TEA_ESTATE.rowSpacingM;
    let current: Vec3[] = [];
    const flush = () => { if (current.length >= 6) rows.push({ points: current }); current = []; };
    // Leave the first and last stretches (the town edge and the dam's lakeside plateau) unplanted.
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      const x = p.x + p.nx * offset * side, z = p.z + p.nz * offset * side;
      if (p.s < 40 || p.s > line.at(-1)!.s - 70 || nearPath(x, z) || !plantable(x, z, offset, i)) { flush(); continue; }
      current.push([x, terrainHeight(x, z), z]);
    }
    flush();
  }
  // A path only runs where it has tea either side: trim each to the stretch beside planted rows.
  const rowBins = new Set<string>();
  for (const row of rows) for (const [x, , z] of row.points) rowBins.add(`${Math.round(x / 2)},${Math.round(z / 2)}`);
  const beside = ([x, , z]: Vec3) => [-1, 0, 1].some(dx => [-1, 0, 1].some(dz => rowBins.has(`${Math.round(x / 2) + dx},${Math.round(z / 2) + dz}`)));
  const plantedPaths = paths.flatMap(path => {
    const out: Vec3[][] = [];
    let run: Vec3[] = [];
    for (const p of path) { if (beside(p)) run.push(p); else { if (run.length >= 4) out.push(run); run = []; } }
    if (run.length >= 4) out.push(run);
    return out;
  });
  // Silver oaks for shade, standing in the rows every so often.
  const random = rng(7351), shade: ShadeTree[] = [];
  // Sparse: one every few dozen metres of every third row.
  for (const [r, row] of rows.entries()) for (let i = 6; i < row.points.length - 6; i += 22 + Math.floor(random() * 22)) {
    if (r % 3 || random() < .35) continue;
    const [x, y, z] = row.points[i];
    shade.push({ position: [x, y, z], height: 9 + random() * 6, yaw: random() * Math.PI * 2 });
  }
  return { rows, shade, paths: plantedPaths };
}

export const TEA_ESTATE_PLANTING = createEstate();

/** Within the estate's planted band: palms, flowers and stunt parks keep off it. */
export function isTeaEstateGround(x: number, z: number): boolean {
  return TEA_ESTATE_BINS.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`) === true;
}
const TEA_ESTATE_BINS = new Map<string, boolean>();
for (const row of TEA_ESTATE_PLANTING.rows) for (const [x, , z] of row.points) for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) TEA_ESTATE_BINS.set(`${Math.floor(x / 8) + dx},${Math.floor(z / 8) + dz}`, true);
