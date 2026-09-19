import type { RiverReach } from '../../contracts/worldV2';

export interface RiverMesh { id: string; vertices: number[]; indices: number[]; uv: number[] }

/** Shared cross-sections make each river bend watertight. Y is the authored water surface. */
export function createRiverMesh(reach: RiverReach): RiverMesh {
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  let along = 0;
  reach.points.forEach((p, i) => {
    const before = reach.points[Math.max(0, i - 1)], after = reach.points[Math.min(reach.points.length - 1, i + 1)];
    const normal = (a: readonly number[], b: readonly number[]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
      return [-dz / length, dx / length];
    };
    const a = normal(i ? before : p, i ? p : after), b = normal(i < reach.points.length - 1 ? p : before, i < reach.points.length - 1 ? after : p);
    const length = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
    const nx = (a[0] + b[0]) / length, nz = (a[1] + b[1]) / length;
    const half = reach.widthsM[i] / 2 / Math.max(.5, nx * b[0] + nz * b[1]);
    if (i) along += Math.hypot(p[0] - before[0], p[2] - before[2]);
    for (const side of [-1, 1]) { vertices.push(p[0] + side * nx * half, p[1], p[2] + side * nz * half); uv.push(side < 0 ? 0 : 1, along / 12); }
    if (i) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  return { id: reach.id, vertices, indices, uv };
}

/** Spatially indexed queries use the same water triangles as rendering. */
export function createRiverField(reaches: readonly RiverReach[]) {
  const meshes = reaches.filter(r => r.id !== 'kurumali-existing').map(createRiverMesh);
  type Triangle = { a: number[]; b: number[]; c: number[] };
  type Segment = { a: readonly number[]; b: readonly number[]; wa: number; wb: number; kind: RiverReach['kind'] };
  const triangles = new Map<string, Triangle[]>(), segments = new Map<string, Segment[]>(), cell = 48;
  const index = <T,>(map: Map<string, T[]>, value: T, minX: number, maxX: number, minZ: number, maxZ: number) => {
    for (let x = Math.floor(minX / cell); x <= Math.floor(maxX / cell); x++) for (let z = Math.floor(minZ / cell); z <= Math.floor(maxZ / cell); z++) {
      const key = `${x},${z}`, entries = map.get(key) ?? []; entries.push(value); map.set(key, entries);
    }
  };
  for (const mesh of meshes) for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.slice(i, i + 3).map(n => mesh.vertices.slice(n * 3, n * 3 + 3));
    index(triangles, { a, b, c }, Math.min(a[0], b[0], c[0]), Math.max(a[0], b[0], c[0]), Math.min(a[2], b[2], c[2]), Math.max(a[2], b[2], c[2]));
  }
  for (const reach of reaches.filter(r => r.kind !== 'waterfall')) for (let i = 1; i < reach.points.length; i++) {
    const a = reach.points[i - 1], b = reach.points[i], wa = reach.widthsM[i - 1], wb = reach.widthsM[i], pad = Math.max(wa, wb) + 24;
    index(segments, { a, b, wa, wb, kind: reach.kind }, Math.min(a[0], b[0]) - pad, Math.max(a[0], b[0]) + pad, Math.min(a[2], b[2]) - pad, Math.max(a[2], b[2]) + pad);
  }
  const nearest = (x: number, z: number) => {
    let result: { distance: number; halfWidth: number; height: number; segment: Segment; t: number } | null = null;
    for (const segment of segments.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
      const { a, b, wa, wb } = segment, dx = b[0] - a[0], dz = b[2] - a[2];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
      const distance = Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz);
      if (!result || distance < result.distance) result = { distance, halfWidth: (wa + (wb - wa) * t) / 2, height: a[1] + (b[1] - a[1]) * t, segment, t };
    }
    return result;
  };
  /** Surface current (m/s) at a point: downstream along the reach, faster on steep reaches, slack near banks and in pools. */
  const flowAt = (x: number, z: number): { x: number; z: number } => {
    const hit = nearest(x, z);
    if (!hit || hit.distance > hit.halfWidth + 1) return { x: 0, z: 0 };
    const { a, b, kind } = hit.segment, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
    const slope = Math.max(0, a[1] - b[1]) / length;
    const speed = kind === 'pool' ? .35 : Math.min(3.2, 1.1 + slope * 60);
    const edge = Math.min(1, hit.distance / Math.max(1, hit.halfWidth));
    const scale = speed * (1 - .7 * edge * edge);
    return { x: dx / length * scale, z: dz / length * scale };
  };
  const surfaceAt = (x: number, z: number): number | null => {
    let height: number | null = null;
    for (const { a, b, c } of triangles.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(d) < 1e-10) continue;
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
      const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) height = Math.max(height ?? -Infinity, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
    }
    return height;
  };
  return { meshes, nearest, surfaceAt, flowAt };
}
