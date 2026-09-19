import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { V2_ROUTES, isTravelAllowed } from '../src/content/world/definition';

const road = V2_ROUTES.find(route => route.id === 'malakkappara-road')!;

describe('the bus on the Malakkappara forest road', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('is allowed to drive the whole road', () => {
    for (const point of road.points) expect(isTravelAllowed('car', point[0], point[2]), `${point[0]},${point[2]}`).toBe(true);
  });

});
