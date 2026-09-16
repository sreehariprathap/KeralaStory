import { expect, it } from 'vitest';
import { parkPoolLayout, v2DressingBoxes } from '../src/content/world/v2Dressing';
import { V2_LAYOUT } from '../src/content/world/definition';
import { createCanonicalWorldDefinition } from '../packages/simulation/src/worldDefinition';

it('keeps the pool in its world footprint without adding the park origin twice', () => {
  const pool = parkPoolLayout();
  expect([pool.x - pool.width / 2, pool.z - pool.depth / 2]).toEqual(V2_LAYOUT.park.poolFootprint[0]);
  expect(Number.isFinite(pool.y)).toBe(true);
});

it('shares every dressing collider with the authoritative simulation', () => {
  const world = createCanonicalWorldDefinition();
  for (const box of v2DressingBoxes()) expect(world.boxes.find(candidate => candidate.id === box.id)).toEqual(box);
});

import { TOWN_BUILDINGS, buildingGround } from '../src/content/world/v2Dressing';
import { EXPANSION_LAYOUT, V2_ROUTES, isWater } from '../src/content/world/definition';
import { createRouteField } from '../src/game/world/expansionTerrain';

it('keeps town shells dry and outside road clearance with grounded foundations', () => {
  const routeAt = createRouteField([...EXPANSION_LAYOUT.routes, ...V2_ROUTES]);
  for (const b of TOWN_BUILDINGS) {
    expect(buildingGround(b).max - buildingGround(b).min, `${b.id} relief`).toBeLessThan(2);
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
      const x = b.x + ix * (b.width / 2 + 1), z = b.z + iz * (b.depth / 2 + 1);
      expect(isWater(x, z), `${b.id} water`).toBe(false);
      const road = routeAt(x, z);
      if (road) expect(road.distance, `${b.id} road`).toBeGreaterThan(road.width + 1.5);
    }
  }
});

it('blocks pool entry on all sides while retaining the entrance forecourt', () => {
  const boxes = v2DressingBoxes();
  expect(boxes.filter(b => b.id.startsWith('park-pool-edge-') || b.id.startsWith('park-pool-end-'))).toHaveLength(4);
  const basin = boxes.find(b => b.id === 'park-pool-basin')!;
  const pool = parkPoolLayout();
  expect(basin.size).toEqual([pool.width, 2.8, pool.depth]);
  expect(boxes.find(b => b.id === 'park-forecourt')).toBeDefined();
});
