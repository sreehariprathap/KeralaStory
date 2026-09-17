import { LANDMARKS, V2_LAYOUT, terrainHeight } from '../../content/world/definition';
import type { CollectItem } from './types';

export const HEART_COUNT = 10;
export interface HeartSpot extends CollectItem { kind: 'heart'; label: string }

/** Hearts hang above head height: spotted from the right angle, never stumbled over. */
const LIFT = 2.2;

function at(id: string): { x: number; z: number } {
  const place = LANDMARKS.find(l => l.id === id);
  if (!place) throw new Error(`Heart spot references a missing landmark: ${id}`);
  return { x: place.position[0], z: place.position[2] };
}

function spot(id: string, label: string, x: number, z: number): HeartSpot {
  return { id: `heart:${id}`, kind: 'heart', label, x, z, y: terrainHeight(x, z) + LIFT };
}

/** Offsets from a landmark, so a heart follows its place if the world moves. */
function near(id: string, landmarkId: string, label: string, dx: number, dz: number): HeartSpot {
  const { x, z } = at(landmarkId);
  return spot(id, label, x + dx, z + dz);
}

/**
 * Ten hiding places, hard to find but reachable on foot, one per notable corner of
 * the map. Each is walked in the running app before release.
 */
export function dailyHeartSpots(): HeartSpot[] {
  const park = V2_LAYOUT.park.center, chalakkudy = V2_LAYOUT.towns.find(t => t.id === 'chalakkudy')!.center;
  return [
    near('waterfall-ledge', 'waterfall', 'Behind Silverthread falls', 6, -5),
    near('canopy-branch', 'canopy', 'A treehouse branch', -7, 6),
    near('first-overlook', 'origin', 'Above the first overlook', -9, -7),
    near('temple-eaves', 'temple', 'Under the temple eaves', 4, 4),
    near('tea-shop-yard', 'tea-shop', 'The tea shop back yard', -5, 5),
    near('fishing-reeds', 'fishing-bank', 'In the fishing-bank reeds', -6, 5),
    near('market-roof', 'market', 'A market rooftop', 6, 5),
    near('lighthouse-rocks', 'lighthouse', 'The lighthouse rocks', 5, -5),
    spot('silver-storm-stand', 'High in the Silver Storm park', park[0] + 7, park[2] + 6),
    spot('chalakkudy-roof', 'Over a Chalakkudy shopfront', chalakkudy[0] + 6, chalakkudy[2] + 6),
  ];
}
