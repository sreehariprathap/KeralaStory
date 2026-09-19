import { describe, expect, it } from 'vitest';
import { PARK_BOUNDS, PARK_BUILDINGS, PARK_ENTRANCE, PARK_POOLS, PARK_TOWERS, waterParkBoxes } from '../src/content/world/waterPark';
import { v2DressingBoxes, parkPoolLayout } from '../src/content/world/v2Dressing';
import { V2_LAYOUT, isWater } from '../src/content/world/definition';
import { createCanonicalWorldDefinition } from '../packages/simulation/src/worldDefinition';
import { createRouteField } from '../src/game/world/expansionTerrain';
import { EXPANSION_LAYOUT, V2_ROUTES } from '../src/content/world/definition';

const inside = (x: number, z: number, margin = 0) =>
  x >= PARK_BOUNDS.xMin + margin && x <= PARK_BOUNDS.xMax - margin && z >= PARK_BOUNDS.zMin + margin && z <= PARK_BOUNDS.zMax - margin;

describe('Silver Storm water park', () => {
  it('keeps the authored wave pool exactly where the layout puts it', () => {
    const wave = PARK_POOLS.find(p => p.id === 'wave')!;
    const pool = parkPoolLayout();
    expect([wave.x, wave.z, wave.width, wave.depth]).toEqual([pool.x, pool.z, pool.width, pool.depth]);
    expect(V2_LAYOUT.park.poolFootprint[0]).toEqual([wave.x - wave.width / 2, wave.z - wave.depth / 2]);
  });

  it('builds every pool, tower and building inside the park footprint on dry ground', () => {
    for (const p of PARK_POOLS) {
      expect(inside(p.x - p.width / 2, p.z - p.depth / 2), p.id).toBe(true);
      expect(inside(p.x + p.width / 2, p.z + p.depth / 2), p.id).toBe(true);
    }
    for (const t of PARK_TOWERS) expect(inside(t.x, t.z, t.radius + 4), t.id).toBe(true);
    for (const b of PARK_BUILDINGS) {
      expect(inside(b.x - b.width / 2, b.z - b.depth / 2), b.id).toBe(true);
      expect(inside(b.x + b.width / 2, b.z + b.depth / 2), b.id).toBe(true);
      expect(isWater(b.x, b.z), b.id).toBe(false);
    }
  });

  it('separates the towers from the buildings and the pools they drop into', () => {
    for (const t of PARK_TOWERS) {
      const splash = PARK_POOLS.find(p => p.id === t.splashId)!;
      const gap = Math.hypot(splash.x - t.x, splash.z - t.z);
      expect(gap, `${t.id} to ${splash.id}`).toBeGreaterThan(t.radius + 2);
      expect(gap, `${t.id} to ${splash.id}`).toBeLessThan(t.radius + 22);
      for (const b of PARK_BUILDINGS) {
        const clear = Math.max(Math.abs(b.x - t.x) - b.width / 2, Math.abs(b.z - t.z) - b.depth / 2);
        expect(clear, `${t.id} vs ${b.id}`).toBeGreaterThan(t.radius);
      }
    }
  });

  it('rings the park with a fence that leaves the entrance open', () => {
    const boxes = waterParkBoxes();
    const fence = boxes.filter(b => b.id.startsWith('park-fence-'));
    expect(fence.map(b => b.id).sort()).toEqual(['park-fence-east', 'park-fence-north', 'park-fence-south-east', 'park-fence-south-west', 'park-fence-west']);
    const blocksEntrance = fence.some(b =>
      Math.abs(b.position[0] - PARK_ENTRANCE.x) < b.size[0] / 2 && Math.abs(b.position[2] - PARK_ENTRANCE.z) < b.size[2] / 2 + 3);
    expect(blocksEntrance).toBe(false);
    for (const box of boxes) expect(box.size.every(v => v > 0) && box.position.every(Number.isFinite), box.id).toBe(true);
  });

  it('closes off the new pool basins and keeps clear of the access road', () => {
    const boxes = waterParkBoxes();
    for (const pool of PARK_POOLS.filter(p => p.id !== 'wave')) {
      const basin = boxes.find(b => b.id === `park-pool-${pool.id}`)!;
      expect(basin.size).toEqual([pool.width, 2.8, pool.depth]);
    }
    const routeAt = createRouteField([...EXPANSION_LAYOUT.routes, ...V2_ROUTES]);
    for (const box of boxes.filter(b => !b.id.startsWith('park-fence-'))) {
      const road = routeAt(box.position[0], box.position[2]);
      if (road) expect(road.distance, box.id).toBeGreaterThan(road.width);
    }
  });

  it('shares every park collider with the multiplayer simulation', () => {
    const world = createCanonicalWorldDefinition();
    const dressing = v2DressingBoxes();
    for (const box of waterParkBoxes()) {
      expect(dressing.find(b => b.id === box.id), box.id).toEqual(box);
      expect(world.boxes.find(b => b.id === box.id), box.id).toEqual(box);
    }
  });
});
