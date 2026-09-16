import { ORIGINAL_WORLD_BOUNDS } from '../src/content/world/definition';
import { FEET_TO_CENTER, needsSafeReset } from '../src/game/player/controllerMath';
import { describe, expect, it } from 'vitest';
import { BRIDGE_DECK_Y, BRIDGE_PATH, BRIDGE_X, CITY_PATH, KODASSERY_PATH, riverCenter, RIVER_CENTERLINE, isRiver, VILLAGE_PATH, WATER_LEVEL, JETTY_BOUNDS, JETTY_DECK_Y, LANDMARKS, MAIN_PATH, MAP_BOUNDS, PARKING_SPOTS, REGIONS, SPAWN, WORLD_BOUNDS, WORLD_DEFINITION, containsPoint, getZoneAt, getZoneAtPosition, hasGroundAt, isCycleAllowed, isOnWalkableDeck, isWater, nearestParking, safeGroundPosition, terrainHeight, walkableDeckHeight } from '../src/content/world/definition';
import * as legacy from '../src/content/world/kodassery';

describe('canonical connected world topology', () => {
  it('preserves compatibility references and four adjoining region definitions', () => {
    expect(legacy.LANDMARKS).toBe(LANDMARKS);
    expect(WORLD_DEFINITION.mainPath).toBe(MAIN_PATH);
    expect(REGIONS.map(region => region.id)).toEqual(['kodassery', 'kadambode', 'kurumali', 'kodaly']);
    for (const [i, region] of REGIONS.entries()) {
      expect(getZoneAt(region.center[1])).toBe(region.id);
      expect(region.safeSpawnIds.length).toBeGreaterThan(0);
      if (i) expect(region.bounds.zMin).toBe(REGIONS[i - 1].bounds.zMax);
      for (const neighborId of region.neighborIds) expect(REGIONS.find(candidate => candidate.id === neighborId)?.neighborIds).toContain(region.id);
    }
  });
  it('keeps every original discovery and adds a reachable spice-garden anchor', () => {
    expect(LANDMARKS.map(landmark => landmark.id)).toEqual(expect.arrayContaining(['origin','canopy','waterfall','paddy','temple','tea-shop','river-bridge','fishing-bank','market','lighthouse','harbor','spice-garden']));
    expect(new Set(LANDMARKS.map(landmark => landmark.id)).size).toBe(LANDMARKS.length);
    const spice = LANDMARKS.find(landmark => landmark.id === 'spice-garden')!;
    expect(spice.position[1]).toBe(terrainHeight(spice.position[0], spice.position[2]));
    expect(isWater(spice.position[0], spice.position[2])).toBe(false);
  });
  it('allows every main-route meter but blocks canopy, open river and narrow jetty cycling', () => {
    for (let i = 1; i < MAIN_PATH.length; i++) {
      const a = MAIN_PATH[i - 1], b = MAIN_PATH[i];
      const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        expect(isCycleAllowed(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(true);
      }
    }
    expect(isCycleAllowed(18, -415)).toBe(false);
    expect(isCycleAllowed(0, -100)).toBe(false);
    expect(isCycleAllowed(96, 76)).toBe(false);
    expect(isCycleAllowed(BRIDGE_X + 1.51, -99)).toBe(false);
    expect(isCycleAllowed(BRIDGE_X + 1.5, -99)).toBe(true);
  });
  it('provides valid parking in each region and an origin slot within mount range', () => {
    expect(Math.hypot(...PARKING_SPOTS[0].position.map((coordinate, i) => coordinate - SPAWN[i]))).toBeLessThan(2);
    for (const spot of PARKING_SPOTS) {
      expect(spot.zoneId).toBe(getZoneAtPosition(spot.position[0],spot.position[2]));
      expect(isCycleAllowed(spot.position[0], spot.position[2])).toBe(true);
      expect(safeGroundPosition(spot.position)).toEqual(spot.position);
      expect(nearestParking(spot.position).id).toBe(spot.id);
    }
    expect(new Set(PARKING_SPOTS.map(spot => spot.zoneId)).size).toBe(4);
  });
  it('restores feet on land and bridge or pier surfaces, with explicit map extent for the jetty', () => {
    expect(safeGroundPosition([0, -900, 20])).toEqual([0, terrainHeight(0, 20) + 0.05, 20]);
    expect(safeGroundPosition([BRIDGE_X, 2, -99])).toEqual([BRIDGE_X, BRIDGE_DECK_Y + 0.05, -99]);
    expect(safeGroundPosition([96, -100, 76])).toEqual([96, JETTY_DECK_Y + 0.05, 76]);
    expect(isOnWalkableDeck(96, 76)).toBe(true);
    expect(hasGroundAt(96, 76)).toBe(false);
    expect(containsPoint(MAP_BOUNDS, JETTY_BOUNDS.xMax, 76)).toBe(true);
    expect(isOnWalkableDeck(96, 78)).toBe(false);
    expect(walkableDeckHeight(BRIDGE_X, -134)).toBeGreaterThanOrEqual(BRIDGE_DECK_Y);
    for (const unsafe of [[0, 9, -99], [100, 8, 76], [NaN, 0, 0]] as [number,number,number][]) {
      expect(safeGroundPosition(unsafe)).toEqual(nearestParking(unsafe).position);
    }
  });
});

type Point = readonly [number, number];

function samePoint(a: Point, b: Point): void {
  expect(a[0]).toBe(b[0]);
  expect(a[1]).toBe(b[1]);
}

describe('connected Kerala Story world topology', () => {
  it('joins the Kodassery, village, bridge, and city routes', () => {
    samePoint(KODASSERY_PATH[KODASSERY_PATH.length - 1], VILLAGE_PATH[0]);
    samePoint(VILLAGE_PATH[VILLAGE_PATH.length - 1], BRIDGE_PATH[0]);
    samePoint(BRIDGE_PATH[BRIDGE_PATH.length - 1], CITY_PATH[0]);
    for (const path of [KODASSERY_PATH, VILLAGE_PATH, CITY_PATH, BRIDGE_PATH]) {
      for (const [x, z] of path) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMin);
        expect(x).toBeLessThanOrEqual(WORLD_BOUNDS.xMax);
        expect(z).toBeGreaterThanOrEqual(WORLD_BOUNDS.zMin);
        expect(z).toBeLessThanOrEqual(WORLD_BOUNDS.zMax);
      }
    }
  });

  it('carries the Kurumali river across its original corridor without extending it into Chokkana', () => {
    expect(RIVER_CENTERLINE[0][0]).toBeLessThanOrEqual(ORIGINAL_WORLD_BOUNDS.xMin);
    expect(RIVER_CENTERLINE[RIVER_CENTERLINE.length - 1][0]).toBeGreaterThanOrEqual(ORIGINAL_WORLD_BOUNDS.xMax);
    expect(isRiver(ORIGINAL_WORLD_BOUNDS.xMin, riverCenter(ORIGINAL_WORLD_BOUNDS.xMin))).toBe(true);
    expect(isRiver(ORIGINAL_WORLD_BOUNDS.xMax, riverCenter(ORIGINAL_WORLD_BOUNDS.xMax))).toBe(true);
  });

  it('keeps the bridge deck above the water level', () => {
    expect(BRIDGE_X).toBe(BRIDGE_PATH[0][0]);
    expect(BRIDGE_DECK_Y).toBeGreaterThan(WATER_LEVEL);
    expect(isWater(BRIDGE_X, -99)).toBe(true);
  });

  it('keeps the far banks above water', () => {
    expect(terrainHeight(0, -130)).toBeGreaterThan(WATER_LEVEL);
    expect(terrainHeight(0, -70)).toBeGreaterThan(WATER_LEVEL);
  });

  it('distinguishes river water, ordinary land, and coastal water', () => {
    expect(isWater(0, riverCenter(0))).toBe(true);
    expect(isWater(0, -130)).toBe(false);
    expect(isWater(0, -300)).toBe(false);
    expect(isWater(0, 91)).toBe(true);
    expect(isWater(84, 0)).toBe(true);
  });
});

it('allows the pier extension only at a valid deck elevation',()=>{
  expect(needsSafeReset({x:96,y:JETTY_DECK_Y+FEET_TO_CENTER,z:76})).toBe(false);
  expect(needsSafeReset({x:96,y:JETTY_DECK_Y+FEET_TO_CENTER-.2,z:76})).toBe(true);
  expect(needsSafeReset({x:96,y:JETTY_DECK_Y+FEET_TO_CENTER,z:78})).toBe(true);
  expect(needsSafeReset({x:97,y:JETTY_DECK_Y+FEET_TO_CENTER,z:76})).toBe(true);
});
