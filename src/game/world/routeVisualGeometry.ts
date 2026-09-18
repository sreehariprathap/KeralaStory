import type { ExpansionRoute } from '../../contracts/worldExpansion';

export function routeSurfaceHeight(centerPoint: readonly [number, number, number], centerTerrainHeight: number, sampledTerrainHeight: number): number {
  return centerPoint[1] + sampledTerrainHeight - centerTerrainHeight;
}

function distanceToRoute(point: readonly [number, number, number], route: ExpansionRoute): number {
  let nearestDistance = Infinity;
  for (let index = 1; index < route.points.length; index++) {
    const start = route.points[index - 1];
    const end = route.points[index];
    const deltaX = end[0] - start[0];
    const deltaZ = end[2] - start[2];
    const segmentLengthSquared = deltaX * deltaX + deltaZ * deltaZ || 1;
    const progress = Math.max(0, Math.min(1, ((point[0] - start[0]) * deltaX + (point[2] - start[2]) * deltaZ) / segmentLengthSquared));
    nearestDistance = Math.min(nearestDistance, Math.hypot(point[0] - start[0] - deltaX * progress, point[2] - start[2] - deltaZ * progress));
  }
  return nearestDistance;
}

/** Avoids drawing a footpath paint layer on top of a connected vehicle road. */
export function visibleRoutePoints(route: ExpansionRoute, routes: readonly ExpansionRoute[]) {
  if (route.allowedModes.includes('car')) return route.points;
  const vehicleRoutes = routes.filter(candidate => candidate.id !== route.id && candidate.allowedModes.includes('car'));
  const firstVisibleIndex = route.points.findIndex(point => vehicleRoutes.every(vehicleRoute => distanceToRoute(point, vehicleRoute) > (route.widthM + vehicleRoute.widthM) / 2));
  return firstVisibleIndex === -1 ? route.points.slice(-1) : route.points.slice(firstVisibleIndex);
}

export interface RibbonMesh { positions: number[]; colors: number[]; indices: number[] }

function polylineDistance(x: number, z: number, points: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
}

/**
 * A road surface that hugs the ground: rows every ~1 m along the road and columns every ~1 m across,
 * each vertex on the walkable surface plus a small lift, so terrain can never poke through.
 * Where a road ends on another road, its end flares into rounded kerb corners (radius `flare`).
 * The outer half-metre is tinted as a dusty shoulder so the asphalt fades into the verge.
 */
export function createRouteRibbon(
  route: ExpansionRoute, routes: readonly ExpansionRoute[], heightAt: (x: number, z: number) => number,
  colors: { surface: readonly [number, number, number]; shoulder: readonly [number, number, number] },
): RibbonMesh {
  const points = visibleRoutePoints(route, routes);
  const car = route.allowedModes.includes('car'), half = route.widthM / 2;
  const flare = car ? Math.min(5, route.widthM * .4) : 0;
  // Road ends that join another car road's carriageway get flared corners.
  const joins = car ? [points[0], points.at(-1)!].flatMap(end => routes
    .filter(other => other.id !== route.id && other.allowedModes.includes('car'))
    .filter(other => polylineDistance(end[0], end[2], other.points) <= other.widthM / 2 + .5)
    .map(other => ({ end, other }))) : [];
  // Dense samples along the centreline.
  const samples: { x: number; z: number; tx: number; tz: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const steps = Math.max(1, Math.ceil(length));
    for (let k = samples.length ? 1 : 0; k <= steps; k++) samples.push({ x: a[0] + dx * k / steps, z: a[2] + dz * k / steps, tx: dx / length, tz: dz / length });
  }
  // Smooth tangents at polyline joints so rows never cross on bends.
  for (let i = 1; i < samples.length - 1; i++) {
    const p = samples[i - 1], n = samples[i + 1], dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1;
    samples[i].tx = dx / l; samples[i].tz = dz / l;
  }
  const halfAt = (x: number, z: number) => {
    let h = half;
    for (const { end, other } of joins) {
      if (Math.hypot(x - end[0], z - end[2]) > other.widthM / 2 + flare + 3) continue;
      const d = polylineDistance(x, z, other.points) - other.widthM / 2;
      const extra = d <= 0 ? flare : d < flare ? flare - Math.sqrt(flare * flare - (flare - d) ** 2) : 0;
      h = Math.max(h, half + extra);
    }
    return h;
  };
  const columns = Math.max(4, Math.ceil((half + flare) * 2));
  const positions: number[] = [], vertexColors: number[] = [], indices: number[] = [];
  samples.forEach((s, row) => {
    const nx = -s.tz, nz = s.tx, h = halfAt(s.x, s.z);
    for (let j = 0; j <= columns; j++) {
      const offset = (j / columns - .5) * 2 * h, x = s.x + nx * offset, z = s.z + nz * offset;
      // Highest ground within ~0.7 m, so creases between vertices stay under the surface.
      let ground = heightAt(x, z);
      for (const [dx, dz] of [[.7, 0], [-.7, 0], [0, .7], [0, -.7], [.5, .5], [.5, -.5], [-.5, .5], [-.5, -.5]]) ground = Math.max(ground, heightAt(x + dx, z + dz));
      positions.push(x, ground + .05, z);
      const c = car && Math.abs(offset) > h - .5 ? colors.shoulder : colors.surface;
      vertexColors.push(c[0], c[1], c[2]);
      if (row && j < columns) {
        const a = (row - 1) * (columns + 1) + j, b = row * (columns + 1) + j;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  });
  return { positions, colors: vertexColors, indices };
}
