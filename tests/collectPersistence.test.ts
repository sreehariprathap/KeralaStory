import { describe, expect, it } from 'vitest';
import { loadLocalSave, writeLocalSave } from '../src/persistence/localSaveRepository';
import { DEFAULT_SETTINGS, type SaveV3 } from '../src/contracts';
import { todayKey } from '../src/game/collectables/collectState';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  } as Storage;
}

const profile = { id: 'p1', displayName: 'Meera', avatarPresetId: 'canopy' as const, colors: { skin: '#ba805b' as const, hair: '#292a25' as const, clothing: '#285943' as const } };
const baseV2 = {
  version: 2 as const, locale: 'en' as const, bicycle: null, worldVersion: 'test-world', profile,
  position: [0, 1, 0] as [number, number, number], headingRad: 0, safeSpawnId: 'origin',
  visitedLandmarkIds: [], settings: DEFAULT_SETTINGS, updatedAt: new Date().toISOString(),
};

describe('save v3 wallet', () => {
  it('migrates a v2 save forward with an empty wallet', () => {
    const storage = memoryStorage();
    storage.setItem('kerala-story:save:v1', JSON.stringify(baseV2));
    const { save } = loadLocalSave(storage);
    expect(save?.version).toBe(3);
    expect(save?.collect).toEqual({ coins: 0, dateKey: todayKey(), collectedIds: [] });
    expect(save?.profile.displayName).toBe('Meera');
  });

  it('round-trips a wallet through a write and a load', () => {
    const storage = memoryStorage();
    const save: SaveV3 = { ...baseV2, version: 3, collect: { coins: 42, dateKey: '2026-09-16', collectedIds: ['coin:2026-09-16:1'] } };
    expect(writeLocalSave(save, storage).ok).toBe(true);
    expect(loadLocalSave(storage).save?.collect).toEqual({ coins: 42, dateKey: '2026-09-16', collectedIds: ['coin:2026-09-16:1'] });
  });

  it('refuses a negative wallet', () => {
    const storage = memoryStorage();
    const broken = { ...baseV2, version: 3, collect: { coins: -5, dateKey: '2026-09-16', collectedIds: [] } };
    expect(writeLocalSave(broken as never, storage).ok).toBe(false);
  });

  it('preserves a save from a newer version', () => {
    const storage = memoryStorage();
    storage.setItem('kerala-story:save:v1', JSON.stringify({ ...baseV2, version: 4 }));
    const { save, warning } = loadLocalSave(storage);
    expect(save).toBeNull();
    expect(warning).toContain('newer version');
    expect(storage.getItem('kerala-story:save:v1')).toContain('"version":4');
  });
});
