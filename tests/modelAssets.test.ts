import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAR_MODELS, CHARACTER_MODELS } from '../src/content/assets/models';
import { loadLocalSave, writeLocalSave } from '../src/persistence/localSaveRepository';
import type { SaveV2 } from '../src/contracts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const save: SaveV2 = {
  version: 2,
  locale: 'en',
  worldVersion: 'kodassery-1',
  profile: {
    id: 'model-test',
    displayName: 'Model traveler',
    avatarPresetId: 'canopy',
    characterModelId: 'cartoon-kid',
    colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' },
  },
  position: [1, 2, 3],
  headingRad: 0,
  safeSpawnId: 'spawn',
  visitedLandmarkIds: [],
  settings: { quality: 'medium', muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1, cameraControl: 'auto', touchOpacity: 0.75 },
  updatedAt: '2026-09-15T00:00:00.000Z',
  bicycle: null,
};

function readGlb(url: string, staticModel = true) {
  const file = readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
  expect(file.subarray(0, 4).toString('ascii')).toBe('glTF');
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);

  let offset = 12;
  let json: { animations?: unknown[]; buffers?: { uri?: string; byteLength?: number }[]; images?: { uri?: string }[] } | undefined;
  let binaryLength = 0;
  while (offset < file.byteLength) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const chunk = file.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as typeof json;
    if (type === 0x004e4942) binaryLength = chunk.byteLength;
    offset += 8 + length;
  }
  expect(json).toBeDefined();
  if (staticModel) expect(json?.animations ?? []).toHaveLength(0);
  expect((json?.buffers ?? []).every((buffer) => !buffer.uri && (buffer.byteLength ?? 0) <= binaryLength)).toBe(true);
  expect((json?.images ?? []).every((image) => !image.uri)).toBe(true);
}

describe('character model assets', () => {
  it('catalogs all supplied self-contained car files', () => {
    expect(CAR_MODELS).toHaveLength(14);
    for (const model of CAR_MODELS) readGlb(model.url, false);
  });
  it('preserves a selected character model through the local save round trip', () => {
    const storage = new MemoryStorage();
    expect(writeLocalSave(save, storage).ok).toBe(true);
    expect(loadLocalSave(storage).save?.profile.characterModelId).toBe('cartoon-kid');
  });

  it('accepts older profiles without a character model selection', () => {
    const legacy = { ...save, profile: { ...save.profile, characterModelId: undefined } };
    const storage = new MemoryStorage();
    expect(writeLocalSave(legacy, storage).ok).toBe(true);
    expect(loadLocalSave(storage).save?.profile.characterModelId).toBeUndefined();
  });

  it('catalogs existing self-contained GLB character files', () => {
    expect(CHARACTER_MODELS.length).toBeGreaterThan(0);
    // Characters supplied with their own skeleton (rig 'mixamo') ship an unused authored clip; the
    // rest are static sources rigged by scripts/rig-characters.mjs and carry no animation.
    for (const model of CHARACTER_MODELS) readGlb(model.url, model.rig !== 'mixamo');
  });
});
