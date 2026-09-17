import { describe, expect, it } from 'vitest';
import type { ExpansionRoute } from '../src/contracts/worldExpansion';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, terrainHeight } from '../src/content/world/definition';
import { nearestRouteSample } from '../src/content/world/expansionLayout';
import { locationBoardLayout } from '../src/game/world/locationBoardGeometry';
import { routeSurfaceHeight, visibleRoutePoints } from '../src/game/world/routeVisualGeometry';

const vehicleRoad: ExpansionRoute = {
  id: 'vehicle-road',
  points: [[0, 0, 0], [20, 0, 0]],
  widthM: 6,
  shoulderM: 0,
  allowedModes: ['foot', 'bicycle', 'car'],
};

const footTrail: ExpansionRoute = {
  id: 'foot-trail',
  points: [[20, 0, 0], [20, 0, 3], [20, 0, 5], [20, 0, 8]],
  widthM: 3,
  shoulderM: 0,
  allowedModes: ['foot'],
};

describe('expansion visual geometry', () => {
  it('keeps the location-board post below the board face', () => {
    const layout = locationBoardLayout(4);

    expect(layout.postTopY).toBeCloseTo(layout.boardBottomY);
    expect(layout.postTopY).toBeLessThanOrEqual(layout.boardBottomY);
  });

  it('removes the overlapping footpath paint at a vehicle-road junction', () => {
    const visible = visibleRoutePoints(footTrail, [vehicleRoad, footTrail]);

    expect(visible[0]).toEqual([20, 0, 5]);
    expect(visible.at(-1)).toEqual([20, 0, 8]);
  });

  it('keeps the Athirappilly trail paint clear of its approach road', () => {
    const trail = EXPANSION_LAYOUT.routes.find(route => route.id === 'athirappilly-view-trail')!;
    const approachRoad = EXPANSION_LAYOUT.routes.find(route => route.id === 'chokkana-main-road')!;
    const visible = visibleRoutePoints(trail, EXPANSION_LAYOUT.routes);

    expect(visible.length).toBeLessThan(trail.points.length);
    expect(nearestRouteSample(approachRoad, visible[0][0], visible[0][2]).distanceM).toBeGreaterThan((trail.widthM + approachRoad.widthM) / 2);
  });

  it('keeps the visible road centerline on its authored grade', () => {
    const approachRoad = EXPANSION_LAYOUT.routes.find(route => route.id === 'chokkana-main-road')!;
    const point = approachRoad.points.find(candidate => candidate[0] < -440)!;
    const centerTerrainHeight = EXPANSION_GROUND.deckHeightAt(point[0], point[2]) ?? terrainHeight(point[0], point[2]);

    expect(routeSurfaceHeight(point, centerTerrainHeight, centerTerrainHeight)).toBe(point[1]);
  });
});
