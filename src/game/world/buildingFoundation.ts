/** Placement uses the rendered terrain triangles, not the analytic height curve. */
export type FoundationVec3 = [number, number, number];
export interface FoundationBounds { xMin: number; xMax: number; zMin: number; zMax: number }
export interface TerrainSurface {
  heightAt(x: number, z: number): number;
  heightRange(bounds: FoundationBounds): { min: number; max: number };
}
export interface FoundationBox { position: FoundationVec3; size: FoundationVec3 }
type Point = { x: number; y: number; z: number };
type Triangle = { points: Point[]; bounds: FoundationBounds };

/** X bins keep repeated foundation queries local while retaining exact triangle clipping. */
export function createTerrainSurface(mesh: { vertices: ArrayLike<number>; indices: ArrayLike<number> }): TerrainSurface {
  const bins = new Map<number, Triangle[]>(), binWidth = 4;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = [0, 1, 2].map(offset => {
      const index = mesh.indices[i + offset] * 3;
      return { x: mesh.vertices[index], y: mesh.vertices[index + 1], z: mesh.vertices[index + 2] };
    });
    const bounds = { xMin: Math.min(...points.map(p => p.x)), xMax: Math.max(...points.map(p => p.x)), zMin: Math.min(...points.map(p => p.z)), zMax: Math.max(...points.map(p => p.z)) };
    const triangle = { points, bounds };
    for (let bin = Math.floor(bounds.xMin / binWidth); bin <= Math.floor(bounds.xMax / binWidth); bin++) {
      const entries = bins.get(bin) ?? []; entries.push(triangle); bins.set(bin, entries);
    }
  }
  const candidates = (bounds: FoundationBounds) => {
    const result = new Set<Triangle>();
    for (let bin = Math.floor(bounds.xMin / binWidth); bin <= Math.floor(bounds.xMax / binWidth); bin++) {
      for (const triangle of bins.get(bin) ?? []) {
        const b = triangle.bounds;
        if (b.xMax >= bounds.xMin && b.xMin <= bounds.xMax && b.zMax >= bounds.zMin && b.zMin <= bounds.zMax) result.add(triangle);
      }
    }
    return result;
  };
  return {
    heightAt(x, z) {
      for (const { points: [a, b, c] } of candidates({ xMin: x, xMax: x, zMin: z, zMax: z })) {
        const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(denominator) < 1e-12) continue;
        const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
        const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
        if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) return u * a.y + v * b.y + (1 - u - v) * c.y;
      }
      throw new RangeError(`No rendered terrain at ${x}, ${z}`);
    },
    heightRange(bounds) {
      let min = Infinity, max = -Infinity;
      for (const triangle of candidates(bounds)) {
        let polygon = triangle.points;
        // The extrema of a planar triangle clipped to a rectangle are at its vertices.
        for (const [axis, edge, sign] of [['x', bounds.xMin, 1], ['x', bounds.xMax, -1], ['z', bounds.zMin, 1], ['z', bounds.zMax, -1]] as const) {
          const clipped: Point[] = [];
          for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const insideA = (a[axis] - edge) * sign >= 0, insideB = (b[axis] - edge) * sign >= 0;
            if (insideA) clipped.push(a);
            if (insideA !== insideB) {
              const t = (edge - a[axis]) / (b[axis] - a[axis]);
              clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
            }
          }
          polygon = clipped;
        }
        for (const point of polygon) { min = Math.min(min, point.y); max = Math.max(max, point.y); }
      }
      if (!Number.isFinite(min)) throw new RangeError('Foundation footprint misses rendered terrain');
      return { min, max };
    },
  };
}

export interface FoundationPlan {
  bounds: FoundationBounds;
  deckY: number;
  groundMin: number;
  groundMax: number;
  body: FoundationBox;
}

export function planFoundation(surface: TerrainSurface, options: { x: number; z: number; width: number; depth: number; clearance?: number; burial?: number }): FoundationPlan {
  const { x, z, width, depth, clearance = .22, burial = .45 } = options;
  const bounds = { xMin: x - width / 2, xMax: x + width / 2, zMin: z - depth / 2, zMax: z + depth / 2 };
  const ground = surface.heightRange(bounds), deckY = ground.max + clearance, bottom = ground.min - burial;
  return { bounds, deckY, groundMin: ground.min, groundMax: ground.max, body: { position: [x, (deckY + bottom) / 2, z], size: [width, deckY - bottom, depth] } };
}

/** South-facing treads, numbered from the porch outwards. Every riser is solid to ground. */
export function planFoundationSteps(surface: TerrainSurface, options: { x: number; edgeZ: number; deckY: number; width?: number; treadDepth?: number; maxRise?: number; burial?: number }): FoundationBox[] {
  const { x, edgeZ, deckY, width = 3, treadDepth = .45, maxRise = .24, burial = .45 } = options;
  // Solve against terrain at the *outer* end: extending steps downhill increases the drop.
  let count = 1, footY = 0;
  for (; count <= 96; count++) {
    footY = surface.heightAt(x, edgeZ + count * treadDepth);
    if ((deckY - footY) / count <= maxRise) break;
  }
  if (count > 96) throw new RangeError('Foundation approach is too steep for stairs');
  const rise = Math.max(0, (deckY - footY) / count);
  return Array.from({ length: count }, (_, i) => {
    const zMin = edgeZ + i * treadDepth, zMax = zMin + treadDepth;
    const ground = surface.heightRange({ xMin: x - width / 2, xMax: x + width / 2, zMin, zMax });
    const top = deckY - i * rise, bottom = Math.min(ground.min - burial, top - burial);
    return { position: [x, (top + bottom) / 2, (zMin + zMax) / 2], size: [width, top - bottom, treadDepth] };
  });
}
