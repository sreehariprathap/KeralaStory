import type { MapBounds, Vec3 } from '../../contracts';
import { mapToWorld } from './projection';

export interface SvgViewBox { x: number; y: number; width: number; height: number }
export interface ClientRectLike { left: number; top: number; width: number; height: number }

/** Convert a pointer to world coordinates, accounting for SVG xMidYMid meet letterboxing. */
export function mapToWorldViewport(clientX: number, clientY: number, rect: ClientRectLike, viewBox: SvgViewBox, mapBounds: MapBounds, canvasSize: { width: number; height: number }, y = 0): Vec3 | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height, viewBox.x, viewBox.y, viewBox.width, viewBox.height, canvasSize.width, canvasSize.height].every(Number.isFinite)) return null;
  if (rect.width <= 0 || rect.height <= 0 || viewBox.width <= 0 || viewBox.height <= 0 || canvasSize.width <= 0 || canvasSize.height <= 0) return null;
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const svgX = viewBox.x + (clientX - rect.left - offsetX) / scale;
  const svgY = viewBox.y + (clientY - rect.top - offsetY) / scale;
  if (svgX < 0 || svgX > canvasSize.width || svgY < 0 || svgY > canvasSize.height) return null;
  return mapToWorld(svgX / canvasSize.width, svgY / canvasSize.height, mapBounds, y);
}

/** North-up bearing in radians, clockwise from north. */
export function bearingToWaypoint(from: Vec3, to: Vec3): number {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw new RangeError('Waypoint coordinates must be finite');
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(dx, -dz);
}

export function distanceToWaypoint(from: Vec3, to: Vec3): number {
  return Math.hypot(to[0] - from[0], to[2] - from[2]);
}
