import { EXPANSION_LAYOUT, WORLD_BOUNDS, hasGroundAt, isOnWalkableDeck, isWater, terrainHeight } from '../../content/world/definition';
import { isInGliderLaunch } from '../../content/world/gliderSites';
import { isWaterfallFootprint } from './waterfallGeometry';
import { isStuntGround } from './stuntSites';
import { coconutCandidates, isClearOfRoutes } from './coconutPlacement';
import { chokkanaForest } from './chokkanaForest';
import { kodasseryTreeSpots } from './KodasseryWorld';

export interface FlowerPatch { x: number; z: number; variant: number; height: number; yaw: number }
type XZ = { x: number; z: number };

/** About 37 degrees over a one metre step: flowers tolerate steeper ground than palms. */
const MAX_SLOPE = .75;
/** The summit viewpoint terrace stays clear. */
const SUMMIT_TERRACE = 14;
/** Beds sit in a ring around each trunk: outside the trunk collider, inside the canopy. */
const TREE_RING: readonly [number, number] = [2.2, 5.5];
/** Meadow flowers grow on the upper slopes, above this height. */
const PEAK_MIN_HEIGHT = 110;
const PEAK_RADIUS = 175;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function slope(x: number, z: number) {
  const h = terrainHeight(x, z);
  return Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => Math.abs(terrainHeight(x + dx, z + dz) - h)));
}

/** Dry, not too steep, and off every road, trail and gathering spot. Buildings and decks are rejected later by physics. */
export function isFlowerSpotOpen(x: number, z: number): boolean {
  const b = WORLD_BOUNDS;
  if (x < b.xMin || x > b.xMax || z < b.zMin || z > b.zMax || !hasGroundAt(x, z)) return false;
  if (isWater(x, z) || isOnWalkableDeck(x, z) || isWater(x + 1, z) || isWater(x - 1, z) || isWater(x, z + 1) || isWater(x, z - 1)) return false;
  if (isWaterfallFootprint(x, z, 2) || isStuntGround(x, z, 3) || isInGliderLaunch(x, z)) return false;
  const summit = EXPANSION_LAYOUT.summitPosition;
  if (Math.hypot(x - summit[0], z - summit[2]) < SUMMIT_TERRACE) return false;
  return slope(x, z) <= MAX_SLOPE && isClearOfRoutes(x, z);
}

/** Every tree the world grows: lowland palms, the Kodassery forest and the Chokkana broadleaves. */
export function treeSpots(): XZ[] {
  return [
    ...coconutCandidates([1], [[1, 1]]),
    ...kodasseryTreeSpots(),
    ...chokkanaForest(850).map(tree => ({ x: tree.position[0], z: tree.position[2] })),
  ];
}

function pickVariant(draw: number, weights: readonly number[], total: number) {
  let pick = draw * total, variant = 0;
  while (pick > weights[variant] && variant < weights.length - 1) pick -= weights[variant++];
  return variant;
}

/**
 * Seeded flower beds around tree trunks, plus scattered meadow clumps on the upper slopes of the summit.
 * `weights` picks a variant per flower; `heights` gives each variant's [min, max] height in metres.
 */
export function flowerPatches(weights: readonly number[], heights: readonly (readonly [number, number])[], trees: readonly XZ[] = treeSpots()): FlowerPatch[] {
  const total = weights.reduce((a, b) => a + b, 0), out: FlowerPatch[] = [];
  const add = (x: number, z: number, draws: readonly number[]) => {
    if (!isFlowerSpotOpen(x, z)) return;
    const variant = pickVariant(draws[0], weights, total), [lo, hi] = heights[variant];
    out.push({ x, z, variant, height: lo + draws[1] * (hi - lo), yaw: draws[2] * Math.PI * 2 });
  };
  const r = rng(40711);
  for (const tree of trees) {
    // A fixed number of draws per tree, so filter edits never reshuffle the rest of the world.
    const draws = Array.from({ length: 2 + 5 * 5 }, r);
    if (draws[0] > .55) continue;
    const beds = 2 + Math.floor(draws[1] * 4);
    // Beds bunch on one side of the trunk rather than circling it evenly.
    const facing = draws[2] * Math.PI * 2;
    for (let i = 0; i < beds; i++) {
      const d = draws.slice(2 + i * 5, 7 + i * 5);
      const angle = facing + (d[0] - .5) * 2.4, radius = TREE_RING[0] + d[1] * (TREE_RING[1] - TREE_RING[0]);
      add(tree.x + Math.cos(angle) * radius, tree.z + Math.sin(angle) * radius, d.slice(2));
    }
  }
  // Meadows on the summit: small clumps of three to six flowers.
  const peak = rng(52903), summit = EXPANSION_LAYOUT.summitPosition;
  for (let i = 0; i < 500; i++) {
    const draws = Array.from({ length: 4 + 6 * 5 }, peak);
    const angle = draws[0] * Math.PI * 2, radius = Math.sqrt(draws[1]) * PEAK_RADIUS;
    const cx = summit[0] + Math.cos(angle) * radius, cz = summit[2] + Math.sin(angle) * radius;
    if (terrainHeight(cx, cz) < PEAK_MIN_HEIGHT) continue;
    const count = 3 + Math.floor(draws[2] * 4);
    for (let k = 0; k < count; k++) {
      const d = draws.slice(4 + k * 5, 9 + k * 5);
      const a = d[3] * Math.PI * 2, spread = (.8 + draws[3] * 2.4) * Math.sqrt(d[4]);
      add(cx + Math.cos(a) * spread, cz + Math.sin(a) * spread, d);
    }
  }
  return out;
}
