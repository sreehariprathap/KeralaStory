import { describe, expect, it } from 'vitest';
import { COIN_COUNT, MIN_COIN_SPACING, dailyCoinSpots, isCoinSpotOpen } from '../src/game/collectables/coinPlacement';
import { WORLD_BOUNDS, isWater, terrainHeight } from '../src/content/world/definition';

const spots = dailyCoinSpots('2026-09-16');

describe('daily coin placement', () => {
  it('returns the full set of coins', () => {
    expect(spots).toHaveLength(COIN_COUNT);
    expect(spots.every(s => s.kind === 'coin')).toBe(true);
  });

  it('is deterministic for one date', () => {
    expect(dailyCoinSpots('2026-09-16')).toEqual(spots);
  });

  it('places coins differently on a different date', () => {
    const other = dailyCoinSpots('2026-09-17');
    const same = other.filter((s, i) => Math.hypot(s.x - spots[i].x, s.z - spots[i].z) < 1);
    expect(same.length).toBeLessThan(COIN_COUNT / 2);
  });

  it('gives every coin a stable id carrying the date', () => {
    expect(spots[0].id).toBe('coin:2026-09-16:0');
    expect(new Set(spots.map(s => s.id)).size).toBe(COIN_COUNT);
  });

  it('keeps every coin inside the world and out of the water', () => {
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMin);
      expect(spot.x).toBeLessThanOrEqual(WORLD_BOUNDS.xMax);
      expect(spot.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.zMin);
      expect(spot.z).toBeLessThanOrEqual(WORLD_BOUNDS.zMax);
      expect(isWater(spot.x, spot.z)).toBe(false);
    }
  });

  it('floats each coin a metre above the ground', () => {
    for (const spot of spots) expect(spot.y).toBeCloseTo(terrainHeight(spot.x, spot.z) + 1, 5);
  });

  it('keeps coins at least the minimum spacing apart', () => {
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThanOrEqual(MIN_COIN_SPACING);
      }
    }
  });

  it('rejects a spot in the river', () => {
    expect(isCoinSpotOpen(0, -100)).toBe(false);
  });

  it('returns a smaller set when asked for fewer', () => {
    expect(dailyCoinSpots('2026-09-16', 10)).toHaveLength(10);
  });
});
