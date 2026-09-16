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
