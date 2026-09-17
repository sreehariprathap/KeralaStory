import type { MapBounds } from '../../contracts';

export interface TerrainChunk {
  id: string;
  bounds: MapBounds;
  nx: number;
  nz: number;
  xCoordinates: readonly number[];
  zCoordinates: readonly number[];
  vertices: number[];
  indices: number[];
}

/** The same arrays supply rendering, Rapier collision, and grounded content. */
export function createTerrainChunk(id: string, bounds: MapBounds, spacing: number, heightAt: (x: number, z: number) => number): TerrainChunk {
  const nx = Math.ceil((bounds.xMax - bounds.xMin) / spacing);
  const nz = Math.ceil((bounds.zMax - bounds.zMin) / spacing);
  if (!Number.isFinite(nx + nz) || nx < 1 || nz < 1 || spacing <= 0) throw new RangeError('Invalid terrain grid');
  const xs = Array.from({ length: nx + 1 }, (_, i) => bounds.xMin + (bounds.xMax - bounds.xMin) * i / nx);
  const zs = Array.from({ length: nz + 1 }, (_, i) => bounds.zMin + (bounds.zMax - bounds.zMin) * i / nz);
  return createRectilinearTerrainChunk(id, xs, zs, heightAt);
}

/** Shared edge coordinates are retained exactly, including the older 2.5m north grid. */
export function createRectilinearTerrainChunk(id: string, xCoordinates: readonly number[], zCoordinates: readonly number[], heightAt: (x: number, z: number) => number): TerrainChunk {
  for (const axis of [xCoordinates, zCoordinates]) {
    if (axis.length < 2 || axis.some((value, i) => !Number.isFinite(value) || (i > 0 && value <= axis[i - 1]))) throw new RangeError('Terrain coordinates must increase finitely');
  }
  const nx = xCoordinates.length - 1, nz = zCoordinates.length - 1;
  const bounds = { xMin:xCoordinates[0], xMax:xCoordinates[nx], zMin:zCoordinates[0], zMax:zCoordinates[nz] };
  const vertices: number[] = [], indices: number[] = [];
  for (const z of zCoordinates) for (const x of xCoordinates) {
    const y = heightAt(x,z);
    if (!Number.isFinite(y)) throw new RangeError('Terrain height must be finite');
    vertices.push(x,y,z);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i;
    indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
  }
  return { id, bounds, nx, nz, xCoordinates, zCoordinates, vertices, indices };
}
function coordinateCell(axis: readonly number[], value: number): number {
  let lo = 0, hi = axis.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (axis[mid] <= value) lo = mid; else hi = mid; }
  return Math.min(lo, axis.length - 2);
}

/** Barycentric height query on the rendered diagonal, including outer edges. */
export function sampleTerrainChunk(chunk: TerrainChunk, x: number, z: number): number | null {
  const { bounds: b, nx, vertices, xCoordinates, zCoordinates } = chunk;
  if (!Number.isFinite(x + z) || x < b.xMin || x > b.xMax || z < b.zMin || z > b.zMax) return null;
  const i = coordinateCell(xCoordinates,x), j = coordinateCell(zCoordinates,z);
  const u = (x-xCoordinates[i])/(xCoordinates[i+1]-xCoordinates[i]);
  const v = (z-zCoordinates[j])/(zCoordinates[j+1]-zCoordinates[j]);
  const a = j * (nx + 1) + i;
  const y = (index: number) => vertices[index * 3 + 1];
  return u + v <= 1
    ? y(a) * (1 - u - v) + y(a + 1) * u + y(a + nx + 1) * v
    : y(a + 1) * (1 - v) + y(a + nx + 1) * (1 - u) + y(a + nx + 2) * (u + v - 1);
}

export interface RouteFieldSample { height: number; distance: number; width: number; footOnly: boolean }

/** Index route segments once; per-vertex queries inspect nearby cells only. */
export function createRouteField(routes: readonly import('../../contracts/worldExpansion').ExpansionRoute[]) {
  type Segment = { a: readonly number[]; b: readonly number[]; width: number; footOnly: boolean };
  const bins = new Map<string, Segment[]>(), cell = 32, reach = 24;
  for (const route of routes) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i];
    const segment = { a, b, width: route.widthM / 2 + route.shoulderM, footOnly: route.allowedModes.length === 1 };
    for (let x = Math.floor((Math.min(a[0], b[0]) - reach) / cell); x <= Math.floor((Math.max(a[0], b[0]) + reach) / cell); x++) {
      for (let z = Math.floor((Math.min(a[2], b[2]) - reach) / cell); z <= Math.floor((Math.max(a[2], b[2]) + reach) / cell); z++) {
        const key = `${x},${z}`, entries = bins.get(key) ?? [];
        entries.push(segment); bins.set(key, entries);
      }
    }
  }
  return (x: number, z: number): RouteFieldSample | null => {
    let result: RouteFieldSample | null = null;
    for (const { a, b, width, footOnly } of bins.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
      const distance = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
      if (distance <= reach && (!result || distance < result.distance)) result = { height: a[1] + (b[1] - a[1]) * t, distance, width, footOnly };
    }
    return result;
  };
}
