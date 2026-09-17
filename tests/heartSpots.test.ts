import { describe, expect, it } from 'vitest';
import { HEART_COUNT, dailyHeartSpots } from '../src/game/collectables/heartSpots';
import { WORLD_BOUNDS, isWater } from '../src/content/world/definition';

const hearts = dailyHeartSpots();

describe('heart spots', () => {
  it('offers ten hearts', () => {
    expect(hearts).toHaveLength(HEART_COUNT);
    expect(hearts.every(h => h.kind === 'heart')).toBe(true);
  });

  it('gives each a unique, date-free id and a label', () => {
    expect(new Set(hearts.map(h => h.id)).size).toBe(HEART_COUNT);
    expect(hearts.every(h => h.id.startsWith('heart:') && !/\d{4}-\d{2}-\d{2}/.test(h.id))).toBe(true);
    expect(hearts.every(h => h.label.length > 0)).toBe(true);
  });

  it('keeps every heart inside the world and out of the water', () => {
    for (const heart of hearts) {
      expect(heart.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMin);
      expect(heart.x).toBeLessThanOrEqual(WORLD_BOUNDS.xMax);
      expect(heart.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.zMin);
      expect(heart.z).toBeLessThanOrEqual(WORLD_BOUNDS.zMax);
      expect(isWater(heart.x, heart.z)).toBe(false);
      expect(Number.isFinite(heart.y)).toBe(true);
    }
  });

  it('spreads hearts out, at least 30 m apart', () => {
    for (let i = 0; i < hearts.length; i++) {
      for (let j = i + 1; j < hearts.length; j++) {
        expect(Math.hypot(hearts[i].x - hearts[j].x, hearts[i].z - hearts[j].z)).toBeGreaterThan(30);
      }
    }
  });

  it('is the same list every call', () => {
    expect(dailyHeartSpots()).toEqual(hearts);
  });
});
