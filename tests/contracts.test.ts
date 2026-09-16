import { describe, expect, it } from 'vitest';
import { getZoneAtPosition, LANDMARKS, SLICE_BOUNDS, SPAWN, WORLD_REGIONS } from '../src/content/world/kodassery.ts';
import { ProfileSchema, SaveSchema } from '../src/contracts/index.ts';

const profile = {
  id: 'local', displayName: 'Explorer', avatarPresetId: 'canopy' as const,
  colors: { skin: '#ba805b' as const, hair: '#292a25' as const, clothing: '#285943' as const },
};
const save = {
  version: 1 as const, worldVersion: 'kodassery-foundation-1', profile,
  position: [0, 1, -460] as [number, number, number], headingRad: 0, safeSpawnId: 'origin',
  visitedLandmarkIds: [],
  settings: { quality: 'medium' as const, muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1 },
  updatedAt: '2026-09-14T00:00:00.000Z',
};

describe('shared contracts', () => {
  it('trims display names and counts Unicode characters', () => {
    expect(ProfileSchema.parse({ ...profile, displayName: '  Maya  ' }).displayName).toBe('Maya');
    expect(ProfileSchema.parse({ ...profile, displayName: '界'.repeat(24) }).displayName).toHaveLength(24);
    expect(() => ProfileSchema.parse({ ...profile, displayName: '界'.repeat(25) })).toThrow();
  });

  it('rejects unsafe names, colors, and presets', () => {
    expect(() => ProfileSchema.parse({ ...profile, displayName: '<b>Maya</b>' })).toThrow();
    expect(() => ProfileSchema.parse({ ...profile, displayName: 'M\u0000aya' })).toThrow();
    expect(() => ProfileSchema.parse({ ...profile, avatarPresetId: 'unknown' })).toThrow();
    expect(() => ProfileSchema.parse({ ...profile, colors: { ...profile.colors, skin: '#ffffff' } })).toThrow();
  });

  it('rejects nonfinite positions and invalid settings in saves', () => {
    expect(() => SaveSchema.parse({ ...save, position: [Number.NaN, 0, 0] })).toThrow();
    expect(() => SaveSchema.parse({ ...save, position: [Number.POSITIVE_INFINITY, 0, 0] })).toThrow();
    expect(() => SaveSchema.parse({ ...save, settings: { ...save.settings, volume: 2 } })).toThrow();
    expect(() => SaveSchema.parse({ ...save, settings: { ...save.settings, sensitivity: 0.1 } })).toThrow();
  });
});

describe('Kodassery world fixtures', () => {
  it('has unique landmark IDs resolving to a known region and zone', () => {
    const ids = LANDMARKS.map(landmark => landmark.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const landmark of LANDMARKS) {
      expect(WORLD_REGIONS.some(region => region.id === landmark.zoneId)).toBe(true);
      expect(landmark.zoneId).toBe(getZoneAtPosition(landmark.position[0], landmark.position[2]));
      expect(landmark.position.every(Number.isFinite)).toBe(true);
      expect(landmark.position[0]).toBeGreaterThanOrEqual(SLICE_BOUNDS.xMin);
      expect(landmark.position[0]).toBeLessThanOrEqual(SLICE_BOUNDS.xMax);
      expect(landmark.position[2]).toBeGreaterThanOrEqual(SLICE_BOUNDS.zMin);
      expect(landmark.position[2]).toBeLessThanOrEqual(SLICE_BOUNDS.zMax);
    }
  });

  it('places the entry spawn in the Kodassery slice', () => {
    expect(SPAWN[0]).toBeGreaterThanOrEqual(SLICE_BOUNDS.xMin);
    expect(SPAWN[0]).toBeLessThanOrEqual(SLICE_BOUNDS.xMax);
    expect(SPAWN[2]).toBeGreaterThanOrEqual(SLICE_BOUNDS.zMin);
    expect(SPAWN[2]).toBeLessThanOrEqual(SLICE_BOUNDS.zMax);
    expect(SPAWN.every(Number.isFinite)).toBe(true);
  });
});
