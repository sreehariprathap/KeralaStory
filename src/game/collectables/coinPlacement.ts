import { WORLD_BOUNDS, hasGroundAt, isWater, terrainHeight } from '../../content/world/definition';
import { isWaterfallFootprint } from '../world/waterfallGeometry';
import type { CollectItem } from './types';

export const COIN_COUNT = 100;
export const MIN_COIN_SPACING = 15;
/** Coins float at chest height so they read against the ground. */
const COIN_HEIGHT = 1;
/** Roughly 25 degrees, sampled over a one metre step. */
const MAX_SLOPE = .47;
const TRY_BUDGET = 20000;

/** Same small PRNG the coconut placement uses: cheap, stable, seeded. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hashDate(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) { hash ^= dateKey.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function slope(x: number, z: number): number {
  const h = terrainHeight(x, z);
  return Math.max(
    Math.abs(terrainHeight(x + 1, z) - h), Math.abs(terrainHeight(x - 1, z) - h),
    Math.abs(terrainHeight(x, z + 1) - h), Math.abs(terrainHeight(x, z - 1) - h),
  );
}

/** Dry, walkable, reasonably level ground. Roads are welcome: coins are meant to be found while travelling. */
export function isCoinSpotOpen(x: number, z: number): boolean {
  if (x < WORLD_BOUNDS.xMin || x > WORLD_BOUNDS.xMax || z < WORLD_BOUNDS.zMin || z > WORLD_BOUNDS.zMax) return false;
  if (isWater(x, z) || !hasGroundAt(x, z)) return false;
  if (isWaterfallFootprint(x, z)) return false;
  return slope(x, z) <= MAX_SLOPE;
}

/** The day's coins. Pure and seeded by the date, so any client (or a server later) builds the same set. */
export function dailyCoinSpots(dateKey: string, count: number = COIN_COUNT): CollectItem[] {
  const random = rng(hashDate(dateKey));
  const spots: CollectItem[] = [];
  const width = WORLD_BOUNDS.xMax - WORLD_BOUNDS.xMin, depth = WORLD_BOUNDS.zMax - WORLD_BOUNDS.zMin;
  for (let attempt = 0; attempt < TRY_BUDGET && spots.length < count; attempt++) {
    const x = WORLD_BOUNDS.xMin + random() * width, z = WORLD_BOUNDS.zMin + random() * depth;
    if (!isCoinSpotOpen(x, z)) continue;
    if (spots.some(s => Math.hypot(s.x - x, s.z - z) < MIN_COIN_SPACING)) continue;
    spots.push({ id: `coin:${dateKey}:${spots.length}`, kind: 'coin', x, y: terrainHeight(x, z) + COIN_HEIGHT, z });
  }
  return spots;
}
