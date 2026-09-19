import { describe, expect, it } from 'vitest';
import { CHALAKKUDY_CITY, chalakkudyCityBoxes, lotGround } from '../src/content/world/chalakkudyCity';
import { CHALAKKUDY_BRIDGES, CHALAKKUDY_CITY_ROADS, CHALAKKUDY_MALL, CHALAKKUDY_SHOWROOM, CHALAKKUDY_STORES, CHALAKKUDY_TOWERS, CITY_ROAD_WIDTH_M, bridgeFrame } from '../src/content/world/chalakkudyCityPlan';
import { EXPANSION_LAYOUT, SAFE_SPAWNS, V2_LAYOUT, V2_ROUTES, getZoneAtPosition, isTravelAllowed, isWater, openWaterSurfaceAt, walkableDeckHeight } from '../src/content/world/definition';
import { Euler, Quaternion } from 'three';
import { yawPitchToXyz } from '../src/content/world/chalakkudyCity';
import { createRouteField } from '../src/game/world/expansionTerrain';
import { createCanonicalWorldDefinition } from '../packages/simulation/src/worldDefinition';
import { TOWN_BUILDINGS } from '../src/content/world/v2Dressing';

const insideBox = (x: number, y: number, z: number, margin = 0, marginZ = margin) => chalakkudyCityBoxes().some(b => {
  const dx = x - b.position[0], dz = z - b.position[2], yaw = b.rotation[1];
  const lx = Math.cos(yaw) * dx - Math.sin(yaw) * dz, lz = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
  return Math.abs(lx) <= b.size[0] / 2 + margin && Math.abs(y - b.position[1]) <= b.size[1] / 2 && Math.abs(lz) <= b.size[2] / 2 + marginZ;
});

describe('Tier A Chalakkudy city', () => {
  it('stays the Tier A town and builds its four-lane roads as drivable routes', () => {
    expect(V2_LAYOUT.towns.find(t => t.id === 'chalakkudy')!.tier).toBe('A');
    for (const plan of CHALAKKUDY_CITY_ROADS) {
      const route = V2_ROUTES.find(r => r.id === plan.id)!;
      expect(route.widthM).toBe(CITY_ROAD_WIDTH_M);
      expect(route.widthM / 3.5).toBe(4);
      expect(route.allowedModes).toContain('car');
    }
  });

  it('shares every city collider with the authoritative simulation', () => {
    const world = createCanonicalWorldDefinition();
    for (const box of chalakkudyCityBoxes()) expect(world.boxes.find(candidate => candidate.id === box.id)).toEqual(box);
    expect(new Set(chalakkudyCityBoxes().map(b => b.id)).size).toBe(chalakkudyCityBoxes().length);
  });

  it('keeps the mall, shops and showroom dry, grounded and clear of every road', () => {
    const routeAt = createRouteField([...EXPANSION_LAYOUT.routes, ...V2_ROUTES]);
    for (const lot of [...CHALAKKUDY_STORES, ...CHALAKKUDY_TOWERS, CHALAKKUDY_MALL, CHALAKKUDY_SHOWROOM]) {
      const ground = lotGround(lot);
      expect(ground.max - ground.min, `${lot.id} relief`).toBeLessThan(2);
      for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
        const x = lot.x + ix * (lot.width / 2 + 1), z = lot.z + iz * (lot.depth / 2 + 1);
        expect(isWater(x, z), `${lot.id} water`).toBe(false);
        const road = routeAt(x, z);
        if (road) expect(road.distance, `${lot.id} road`).toBeGreaterThan(road.width + 1.5);
      }
    }
  });

  it('does not overlap the remaining town buildings or block a spawn', () => {
    for (const b of TOWN_BUILDINGS) expect(insideBox(b.x, lotGround(b).max + 1, b.z, b.width / 2, b.depth / 2), b.id).toBe(false);
    for (const spawn of SAFE_SPAWNS) expect(insideBox(spawn.position[0], spawn.position[1] + .9, spawn.position[2], .5), spawn.id).toBe(false);
  });

  it('keeps the showroom walk-in doorway and the mall driveway open', () => {
    const s = CHALAKKUDY_SHOWROOM, floor = lotGround(s).max + .15;
    for (const dz of [2, 0, -2]) expect(insideBox(s.x, floor + 1, s.z + s.depth / 2 + dz), `doorway ${dz}`).toBe(false);
    expect(insideBox(s.x, floor + 1, s.z + s.depth / 2 - 5)).toBe(false);
    // Between the pharmacy and Kerala Silks, from MG Road into the car park.
    for (let z = -70; z >= -84; z -= 2) expect(insideBox(-373, 50, z, .5), `driveway ${z}`).toBe(false);
  });

  it('paints only on the four-lane roads and displays cars in the showroom', () => {
    expect(CHALAKKUDY_CITY.paint.length).toBeGreaterThan(100);
    expect(CHALAKKUDY_CITY.cars.length).toBeGreaterThanOrEqual(3);
    expect(CHALAKKUDY_CITY.signs.map(s => s.label)).toContain('Chalakkudy Central Mall');
  });

  it('runs NH 544 as a loop: Chalakkudy → Kodakara → Kodaly → Chalakkudy, all four lanes', () => {
    const road = (id: string) => V2_ROUTES.find(r => r.id === id)!;
    const bridge = (id: string) => CHALAKKUDY_BRIDGES.find(b => b.id === id)!;
    const same = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]) < .5;
    const onRoad = (p: readonly number[], id: string) => road(id).points.some(q => Math.hypot(q[0] - p[0], q[2] - p[2]) < road(id).widthM / 2);
    const kodakara = V2_LAYOUT.towns.find(t => t.id === 'kodakara')!, kodaly = V2_LAYOUT.towns.find(t => t.id === 'kodaly')!;
    // Chalakkudy (Boulevard) → through Kodakara's centre → Kurumali Bridge.
    expect(onRoad(road('chalakkudy-kodakara-highway').points[0], 'chalakkudy-boulevard')).toBe(true);
    expect(onRoad(kodakara.center, 'chalakkudy-kodakara-highway')).toBe(true);
    expect(same(road('chalakkudy-kodakara-highway').points.at(-1)!, bridge('kurumali-highway-bridge').to)).toBe(true);
    // Kodaly junction: bridge, Kodaly Road into town, and the ghat back to Chalakkudy East.
    const junction = bridge('kurumali-highway-bridge').from;
    expect(same(road('chalakkudy-kodaly-road').points[0], junction)).toBe(true);
    expect(same(road('chalakkudy-kodaly-highway').points.at(-1)!, junction)).toBe(true);
    // Kodaly Road runs on as a two-lane link into the Banyan circle's west avenue.
    expect(same(road('kodaly-avenue-link').points[0], road('chalakkudy-kodaly-road').points.at(-1)!)).toBe(true);
    const kodalyGate = road('kodaly-avenue-link').points.at(-1)!;
    expect(Math.min(...kodaly.footprint.map(p => p[0])) - kodalyGate[0]).toBeLessThan(5);
    // Chalakkudy East → MG Road Bridge → MG Road → Boulevard.
    expect(same(road('chalakkudy-kodaly-highway').points[0], bridge('chalakkudy-mg-bridge').to)).toBe(true);
    expect(same(road('chalakkudy-mg-road').points.at(-1)!, bridge('chalakkudy-mg-bridge').from)).toBe(true);
    expect(onRoad(road('chalakkudy-boulevard').points[0], 'chalakkudy-mg-road')).toBe(true);
    for (const id of ['chalakkudy-kodakara-highway', 'chalakkudy-kodaly-highway', 'chalakkudy-mg-road', 'chalakkudy-boulevard']) expect(road(id).widthM).toBe(CITY_ROAD_WIDTH_M);
    expect(getZoneAtPosition(-170, 0)).toBe(getZoneAtPosition(-430, -120));
    for (const id of ['chalakkudy-mg-bridge', 'chalakkudy-north-bridge']) { const b = bridge(id), f = bridgeFrame(b); for (let along = 0; along <= f.length; along += 4) expect(getZoneAtPosition(b.from[0] + f.ux * along, b.from[2] + f.uz * along), `${b.id} ${along}`).toBe(getZoneAtPosition(-430, -120)); }
  });

  it('joins each bridge to road ends on both banks, over water, with a walkable deck', () => {
    const ends = CHALAKKUDY_CITY_ROADS.flatMap(r => [r.points[0], r.points.at(-1)!]);
    // Beam spans carry an existing road straight through: their ends lie on that road instead.
    const onCarRoad = (p: readonly number[]) => [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'))
      .some(r => r.points.some(q => Math.hypot(q[0] - p[0], q[2] - p[2]) < 1.5 && Math.abs(q[1] - p[1]) < .2));
    for (const b of CHALAKKUDY_BRIDGES) {
      for (const end of [b.from, b.to]) expect(ends.some(p => Math.hypot(p[0] - end[0], p[2] - end[2]) < .01 && Math.abs(p[1] - end[1]) < .01) || (b.style === 'beam' && onCarRoad(end)), `${b.id} end`).toBe(true);
      const frame = bridgeFrame(b);
      expect(Math.abs(frame.grade)).toBeLessThanOrEqual(.1);
      let overWater = 0;
      for (let along = 2; along < frame.length - 2; along += 2) {
        const x = b.from[0] + frame.ux * along, z = b.from[2] + frame.uz * along, deck = frame.heightAt(along);
        expect(walkableDeckHeight(x, z)).toBeCloseTo(deck, 5);
        expect(isTravelAllowed('car', x, z)).toBe(true);
        if (isWater(x, z)) { overWater++; expect(openWaterSurfaceAt(x, z, deck)).toBeNull(); }
      }
      if (b.crosses !== 'path') expect(overWater, b.id).toBeGreaterThan(5);
    }
  });

  it('converts tilted deck rotations into the XYZ Euler angles colliders use', () => {
    for (const [yaw, pitch] of [[.7, -.08], [-2.6, .09], [2.2, .05]]) {
      const expected = new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, 'YXZ'));
      const actual = new Quaternion().setFromEuler(new Euler(...yawPitchToXyz(yaw, pitch), 'XYZ'));
      expect(Math.abs(expected.dot(actual))).toBeCloseTo(1, 6);
    }
  });
});
