import { V2_LAYOUT, terrainHeight } from './definition';
import type { TraversalBox } from '../../game/world/traversalGeometry';

/**
 * Silver Storm, built from world data rather than a source model.
 * The imported amusement park cost 4.9 MB, 498k vertices and 53 MB of texture memory for a landmark
 * most players only pass; this layout draws in a handful of merged meshes with no textures at all.
 *
 * Every position is derived from `V2_LAYOUT.park`, so the park follows the authored footprint.
 */
export interface ParkPool { id: string; x: number; z: number; width: number; depth: number; /** Metres below deck level. */ depthM: number }
export interface ParkTower { id: string; x: number; z: number; height: number; radius: number; /** Flumes spiral down to this pool. */ splashId: string; flumes: number; color: string }
export interface ParkBuilding { id: string; x: number; z: number; width: number; depth: number; height: number; wall: string; roof: string }

const footprint = V2_LAYOUT.park.footprint;
const xs = footprint.map(p => p[0]), zs = footprint.map(p => p[1]);
export const PARK_BOUNDS = { xMin: Math.min(...xs), xMax: Math.max(...xs), zMin: Math.min(...zs), zMax: Math.max(...zs) };
const cx = (PARK_BOUNDS.xMin + PARK_BOUNDS.xMax) / 2, cz = (PARK_BOUNDS.zMin + PARK_BOUNDS.zMax) / 2;
/** Deck level: one flat height for the whole park, taken at its centre. */
export const PARK_DECK_Y = terrainHeight(cx, cz);
/** The visitors' entrance faces the access road on the south edge. */
export const PARK_ENTRANCE = { x: cx, z: PARK_BOUNDS.zMax - 4, width: 12 };

const pool = V2_LAYOUT.park.poolFootprint;
const poolX = pool.map(p => p[0]), poolZ = pool.map(p => p[1]);

export const PARK_POOLS: readonly ParkPool[] = [
  // The authored pool footprint stays exactly where it was: the wave pool.
  {
    id: 'wave', x: (Math.min(...poolX) + Math.max(...poolX)) / 2, z: (Math.min(...poolZ) + Math.max(...poolZ)) / 2,
    width: Math.max(...poolX) - Math.min(...poolX), depth: Math.max(...poolZ) - Math.min(...poolZ), depthM: 2.8,
  },
  // Each slide tower drops into the pool directly south of it.
  { id: 'splash', x: cx - 18, z: cz + 8, width: 17, depth: 12, depthM: 1.6 },
  { id: 'kids', x: cx + 21, z: cz + 12, width: 12, depth: 8, depthM: 1 },
  { id: 'lap', x: cx + 6, z: PARK_BOUNDS.zMin + 22, width: 26, depth: 12, depthM: 1.8 },
];

export const PARK_TOWERS: readonly ParkTower[] = [
  { id: 'main', x: cx - 18, z: cz - 8, height: 13, radius: 2.4, splashId: 'splash', flumes: 3, color: '#3aa7ad' },
  { id: 'kids', x: cx + 21, z: cz + 1, height: 6.5, radius: 1.6, splashId: 'kids', flumes: 2, color: '#e2894f' },
];

/** Shade palms dotted around the decks, away from the pools and slides. */
export const PARK_PALMS: readonly { x: number; z: number; height: number }[] = [
  [-38, 26, 6.5], [-30, -24, 7.2], [-4, 30, 6.8], [12, -30, 7.4], [34, -26, 6.6], [40, 24, 7], [-40, -4, 6.4], [44, -2, 6.9],
].map(([dx, dz, height]) => ({ x: cx + dx, z: cz + dz, height }));

/** Ticket booths either side of the entrance gate. */
export const PARK_BOOTHS: readonly { x: number; z: number }[] = [-1, 1].map(side => ({ x: PARK_ENTRANCE.x + side * (PARK_ENTRANCE.width / 2 + 3), z: PARK_ENTRANCE.z - 1.5 }));

export const PARK_BUILDINGS: readonly ParkBuilding[] = [
  { id: 'changing-rooms', x: PARK_BOUNDS.xMin + 16, z: PARK_BOUNDS.zMax - 17, width: 12, depth: 7, height: 3.2, wall: '#e7d7b2', roof: '#a8573d' },
  { id: 'cafe', x: cx + 19, z: PARK_BOUNDS.zMax - 15, width: 10, depth: 7, height: 3.2, wall: '#d5dfb6', roof: '#bd7049' },
  { id: 'plant-room', x: PARK_BOUNDS.xMax - 14, z: PARK_BOUNDS.zMin + 13, width: 8, depth: 6, height: 3, wall: '#cfc6a6', roof: '#7d8a6a' },
];

/** A shallow splash pad in the middle, which players can walk across. */
export const PARK_SPLASH_PAD = { x: cx, z: cz + 22, radius: 8, jets: 8 };

/** Sun loungers and umbrellas, laid out along the pool decks. */
export const PARK_LOUNGERS = PARK_POOLS.flatMap(p =>
  Array.from({ length: p.id === 'wave' || p.id === 'lap' ? 6 : 4 }, (_, i) => ({
    id: `${p.id}-${i}`,
    x: p.x - p.width / 2 + 1.4 + i * ((p.width - 2.8) / Math.max(1, (p.id === 'wave' || p.id === 'lap' ? 6 : 4) - 1)),
    z: p.z + p.depth / 2 + 2.6,
    umbrella: i % 2 === 0,
  })));

const FENCE_HEIGHT = 2.2;
const INSET = 3;

/** Perimeter fence posts and rails, with a gap at the entrance. */
export const PARK_FENCE = {
  xMin: PARK_BOUNDS.xMin + INSET, xMax: PARK_BOUNDS.xMax - INSET,
  zMin: PARK_BOUNDS.zMin + INSET, zMax: PARK_BOUNDS.zMax - INSET,
  height: FENCE_HEIGHT,
  gap: { x: PARK_ENTRANCE.x, width: PARK_ENTRANCE.width },
};

/**
 * Solid parts of the park. Pool basins stay closed off (the pools are not part of the swimmable water
 * system), the fence rings the grounds with an opening at the entrance, and the buildings and towers block.
 */
export function waterParkBoxes(): TraversalBox[] {
  const boxes: TraversalBox[] = [];
  const y = PARK_DECK_Y;
  for (const b of PARK_BUILDINGS) {
    boxes.push({ id: `park-${b.id}`, position: [b.x, y + b.height / 2, b.z], size: [b.width, b.height, b.depth], rotation: [0, 0, 0] });
  }
  for (const t of PARK_TOWERS) {
    // A square proxy around the stair tower; the flumes above are decoration and never collide.
    boxes.push({ id: `park-tower-${t.id}`, position: [t.x, y + t.height / 2, t.z], size: [t.radius * 2, t.height, t.radius * 2], rotation: [0, 0, 0] });
  }
  for (const p of PARK_POOLS) {
    if (p.id === 'wave') continue; // The wave pool keeps its original edge and basin colliders.
    boxes.push({ id: `park-pool-${p.id}`, position: [p.x, y + 1.4, p.z], size: [p.width, 2.8, p.depth], rotation: [0, 0, 0] });
  }
  const f = PARK_FENCE, span = f.xMax - f.xMin, depth = f.zMax - f.zMin;
  boxes.push({ id: 'park-fence-north', position: [(f.xMin + f.xMax) / 2, y + f.height / 2, f.zMin], size: [span, f.height, .4], rotation: [0, 0, 0] });
  boxes.push({ id: 'park-fence-west', position: [f.xMin, y + f.height / 2, (f.zMin + f.zMax) / 2], size: [.4, f.height, depth], rotation: [0, 0, 0] });
  boxes.push({ id: 'park-fence-east', position: [f.xMax, y + f.height / 2, (f.zMin + f.zMax) / 2], size: [.4, f.height, depth], rotation: [0, 0, 0] });
  // The south fence is split either side of the entrance gap.
  const gapMin = f.gap.x - f.gap.width / 2, gapMax = f.gap.x + f.gap.width / 2;
  for (const [id, from, to] of [['park-fence-south-west', f.xMin, gapMin], ['park-fence-south-east', gapMax, f.xMax]] as const) {
    if (to - from <= 0) continue;
    boxes.push({ id, position: [(from + to) / 2, y + f.height / 2, f.zMax], size: [to - from, f.height, .4], rotation: [0, 0, 0] });
  }
  return boxes;
}
