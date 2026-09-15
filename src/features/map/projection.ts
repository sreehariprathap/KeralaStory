import type { MapBounds, Vec3 } from '../../contracts/index.ts';

function dimensions(bounds: MapBounds): { width: number; depth: number } {
  const width = bounds.xMax - bounds.xMin;
  const depth = bounds.zMax - bounds.zMin;
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width === 0 || depth === 0) {
    throw new RangeError('Map bounds must have finite, non-zero dimensions');
  }
  return { width, depth };
}

/** Convert world X/Z coordinates to normalized map coordinates. */
export function worldToMap(position: Vec3, bounds: MapBounds): { u: number; v: number } {
  const { width, depth } = dimensions(bounds);
  return { u: (position[0] - bounds.xMin) / width, v: (position[2] - bounds.zMin) / depth };
}

/** Convert normalized map coordinates back to world X/Z, preserving the supplied elevation. */
export function mapToWorld(u: number, v: number, bounds: MapBounds, y = 0): Vec3 {
  const { width, depth } = dimensions(bounds);
  return [bounds.xMin + u * width, y, bounds.zMin + v * depth];
}

/** Convert a north-zero, clockwise heading in radians to a normalized compass degree. */
export function headingToDegrees(rad: number): number {
  if (!Number.isFinite(rad)) throw new RangeError('Heading must be finite');
  return ((rad * 180 / Math.PI) % 360 + 360) % 360;
}
