import { describe, expect, it } from 'vitest';
import { shouldPersistSave } from '../../src/features/multiplayer/roomSessionModel';
import { loadLocalSave, writeLocalSave } from '../../src/persistence/localSaveRepository';
import { createCollectState } from '../../src/game/collectables/collectState';
import { WORLD_VERSION } from '../../src/content/world/definition';
import type { SaveV3 } from '../../src/contracts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const soloSave: SaveV3 = {
  version: 3,
  worldVersion: WORLD_VERSION,
  collect: createCollectState(),
  locale: 'en',
  bicycle: null,
  profile: { id: 'solo', displayName: 'Solo', avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } },
  position: [11, 2, -33],
  headingRad: 1.25,
  safeSpawnId: 'origin',
  visitedLandmarkIds: ['origin'],
  settings: { quality: 'medium', muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1, cameraControl: 'auto', touchOpacity: 0.75 },
  updatedAt: new Date().toISOString(),
};

// Simulates App's persist() gate: the room position is only written when the guard allows it.
function persistOnce(storage: Storage, inRoom: boolean, position: [number, number, number]) {
  if (!shouldPersistSave(inRoom)) return;
  writeLocalSave({ ...soloSave, position, updatedAt: new Date().toISOString() }, storage);
}

describe('solo save isolation', () => {
  it('leaves the solo save untouched while the player is in a room', () => {
    const storage = new MemoryStorage();
    writeLocalSave(soloSave, storage);
    persistOnce(storage, true, [900, 90, 900]);
    expect(loadLocalSave(storage).save?.position).toEqual([11, 2, -33]);
  });

  it('still writes the solo save outside a room', () => {
    const storage = new MemoryStorage();
    writeLocalSave(soloSave, storage);
    persistOnce(storage, false, [42, 3, 7]);
    expect(loadLocalSave(storage).save?.position).toEqual([42, 3, 7]);
  });
});
