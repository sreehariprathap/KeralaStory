import { V2_LAYOUT, waterLevelAt } from './definition';
import { DAM_POOL_RADIUS } from './v2Layout';

export interface BoatDock { id: string; label: string; x: number; z: number; headingRad: number; level: number }

const node = (id: string) => V2_LAYOUT.riverNodes.find(n => n.id === id)!.position;
const crest = node('dam-crest'), pool = node('plunge-pool');
const dock = (id: string, label: string, x: number, z: number, headingRad: number): BoatDock => {
  const level = waterLevelAt(x, z);
  if (level === null) throw new RangeError(`Boat dock ${id} is not on water`);
  return { id, label, x, z, headingRad, level };
};

/** Boats moored at Peringalkuthu Dam: one on the reservoir against the crest, one in the plunge pool below. */
export const BOAT_DOCKS: readonly BoatDock[] = [
  // Broadside to the upstream face of the wall, a step down from the crest walkway's parapet.
  dock('reservoir-boat', 'Peringalkuthu Reservoir boat', crest[0] - 10, crest[2] - 10.5, Math.PI / 2),
  // Along the plunge pool's western shore, below the foot of the dam stairs.
  dock('plunge-pool-boat', 'Peringalkuthu plunge pool boat', pool[0] - DAM_POOL_RADIUS + 3.5, pool[2] + DAM_POOL_RADIUS + 1, 0),
];
