import { describe, expect, it } from 'vitest';
import { clearLocalSave, loadLocalSave, writeLocalSave } from '../src/persistence/localSaveRepository.ts';
import type { SaveV1 } from '../src/contracts/index.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const save: SaveV1 = {
  version: 1, worldVersion: 'kodassery-1', profile: {
    id: 'local', displayName: 'മലയാളി യാത്രികൻ', avatarPresetId: 'canopy',
    colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' },
  }, position: [1, 2, 3], headingRad: 0, safeSpawnId: 'spawn', visitedLandmarkIds: [],
  settings: { quality: 'medium', muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1, cameraControl: 'auto' },
  updatedAt: '2026-09-14T00:00:00.000Z',
};

describe('local save repository', () => {
  it('round trips and preserves Unicode names', () => {
    const storage = new MemoryStorage();
    expect(writeLocalSave(save, storage).ok).toBe(true);
    expect(loadLocalSave(storage).save?.profile.displayName).toBe(save.profile.displayName);
    expect(loadLocalSave(storage).save?.version).toBe(3);
    expect(loadLocalSave(storage).save?.locale).toBe('en');
    expect(loadLocalSave(storage).save?.bicycle).toBeNull();
  });

  it('migrates V1 without changing profile or discoveries', () => {
    const storage = new MemoryStorage();
    writeLocalSave(save, storage);
    const loaded = loadLocalSave(storage).save;
    expect(loaded?.version).toBe(3);
    expect(loaded?.visitedLandmarkIds).toEqual(save.visitedLandmarkIds);
  });

  it('returns null for missing save', () => expect(loadLocalSave(new MemoryStorage())).toEqual({ save: null, warning: null }));

  it('defaults cameraControl to auto for a save recorded before the setting existed', () => {
    const storage = new MemoryStorage();
    const { cameraControl, ...settingsWithoutCameraControl } = save.settings;
    void cameraControl;
    storage.setItem('kerala-story:save:v1', JSON.stringify({ ...save, settings: settingsWithoutCameraControl }));
    expect(loadLocalSave(storage).save?.settings.cameraControl).toBe('auto');
  });

  it('recovers a valid backup when primary is corrupt', () => {
    const storage = new MemoryStorage();
    writeLocalSave(save, storage);
    writeLocalSave({ ...save, position: [4, 5, 6] }, storage);
    storage.setItem('kerala-story:save:v1', '{bad');
    expect(loadLocalSave(storage).save?.position).toEqual(save.position);
    expect(loadLocalSave(storage).warning).toMatch(/recovered/i);
  });

  it('preserves future primary versions', () => {
    const storage = new MemoryStorage();
    storage.setItem('kerala-story:save:v1', JSON.stringify({ version: 4, data: 'future' }));
    expect(writeLocalSave(save, storage).ok).toBe(false);
    expect(storage.getItem('kerala-story:save:v1')).toContain('"version":4');
  });

  it('recovers backup while preserving a future primary version', () => {
    const storage = new MemoryStorage();
    writeLocalSave(save, storage);
    writeLocalSave({ ...save, position: [4, 5, 6] }, storage);
    const future = JSON.stringify({ version: 4, profile: { displayName: 'future' } });
    storage.setItem('kerala-story:save:v1', future);
    const result = loadLocalSave(storage);
    expect(result.save?.position).toEqual([1, 2, 3]);
    expect(result.warning).toMatch(/newer|future/i);
    expect(result.warning).toMatch(/preserved/i);
    expect(result.warning).toMatch(/backup|recovered/i);
    expect(writeLocalSave(save, storage).ok).toBe(false);
    expect(storage.getItem('kerala-story:save:v1')).toBe(future);
  });

  it('archives corrupt primary before replacing it', () => {
    const storage = new MemoryStorage();
    storage.setItem('kerala-story:save:v1', '{corrupt raw}');
    expect(writeLocalSave(save, storage).ok).toBe(true);
    expect(storage.getItem('kerala-story:save:archive')).toBe('{corrupt raw}');
  });

  it('handles storage failures', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } } as unknown as Storage;
    expect(loadLocalSave(broken).warning).toMatch(/read/i);
    expect(writeLocalSave(save, broken).ok).toBe(false);
    expect(clearLocalSave(broken).ok).toBe(false);
  });

  it('clears primary and backup', () => {
    const storage = new MemoryStorage();
    writeLocalSave(save, storage);
    expect(clearLocalSave(storage).ok).toBe(true);
    expect(loadLocalSave(storage).save).toBeNull();
  });
});
