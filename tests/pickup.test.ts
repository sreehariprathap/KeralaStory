import { describe, expect, it } from 'vitest';
import { buildPickupGrid, findPickup, pickupRadius } from '../src/game/collectables/pickup';
import type { CollectItem } from '../src/game/collectables/types';

const coin: CollectItem = { id: 'coin:a', kind: 'coin', x: 10, y: 20, z: -30 };
const heart: CollectItem = { id: 'heart:a', kind: 'heart', x: 40, y: 12, z: -30 };
const grid = buildPickupGrid([coin, heart]);
const none = new Set<string>();

describe('pickup', () => {
  it('reaches further from a vehicle than on foot', () => {
    expect(pickupRadius('foot')).toBe(1.2);
    expect(pickupRadius('car')).toBe(2.5);
    expect(pickupRadius('bicycle')).toBe(2.5);
  });

  it('takes a coin the player is standing on', () => {
    expect(findPickup(grid, 10.5, 20, -30, 'foot', none)?.id).toBe('coin:a');
  });

  it('leaves a coin that is out of reach', () => {
    expect(findPickup(grid, 13, 20, -30, 'foot', none)).toBeNull();
  });

  it('lets a driver sweep up a coin the walker would miss', () => {
    expect(findPickup(grid, 12, 20, -30, 'foot', none)).toBeNull();
    expect(findPickup(grid, 12, 20, -30, 'car', none)?.id).toBe('coin:a');
  });

  it('ignores a coin far below or above, such as one under a bridge', () => {
    expect(findPickup(grid, 10, 26, -30, 'foot', none)).toBeNull();
  });

  it('gives hearts only to a player on foot', () => {
    expect(findPickup(grid, 40, 12, -30, 'car', none)).toBeNull();
    expect(findPickup(grid, 40, 12, -30, 'foot', none)?.id).toBe('heart:a');
  });

  it('skips items already collected', () => {
    expect(findPickup(grid, 10, 20, -30, 'foot', new Set(['coin:a']))).toBeNull();
  });

  it('returns the nearest item when two are close', () => {
    const near = buildPickupGrid([coin, { ...coin, id: 'coin:b', x: 10.4 }]);
    expect(findPickup(near, 10.5, 20, -30, 'foot', none)?.id).toBe('coin:b');
  });
});
