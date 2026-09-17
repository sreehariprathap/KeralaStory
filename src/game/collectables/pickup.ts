import type { Carrier, CollectItem } from './types';

const CELL = 20;
/** A coin under a bridge should not jump to a player on the deck. */
const VERTICAL_REACH = 3;
const FOOT_RADIUS = 1.2, VEHICLE_RADIUS = 2.5;

export interface PickupGrid { cells: Map<string, CollectItem[]> }

export function pickupRadius(carrier: Carrier): number {
  return carrier === 'foot' ? FOOT_RADIUS : VEHICLE_RADIUS;
}

const key = (x: number, z: number) => `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;

export function buildPickupGrid(items: readonly CollectItem[]): PickupGrid {
  const cells = new Map<string, CollectItem[]>();
  for (const item of items) {
    const cell = key(item.x, item.z);
    const bucket = cells.get(cell);
    if (bucket) bucket.push(item); else cells.set(cell, [item]);
  }
  return { cells };
}

/** Nearest reachable item, or null. Cheap enough for every frame: it tests at most nine cells. */
export function findPickup(grid: PickupGrid, x: number, y: number, z: number, carrier: Carrier, taken: ReadonlySet<string>): CollectItem | null {
  const radius = pickupRadius(carrier), limit = radius * radius;
  let best: CollectItem | null = null, bestDistance = Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const bucket = grid.cells.get(key(x + dx * CELL, z + dz * CELL));
    if (!bucket) continue;
    for (const item of bucket) {
      if (taken.has(item.id)) continue;
      // Hearts hide on ledges and rooftops: they reward getting out of the vehicle.
      if (item.kind === 'heart' && carrier !== 'foot') continue;
      if (Math.abs(item.y - y) > VERTICAL_REACH) continue;
      const distance = (item.x - x) ** 2 + (item.z - z) ** 2;
      if (distance <= limit && distance < bestDistance) { best = item; bestDistance = distance; }
    }
  }
  return best;
}
