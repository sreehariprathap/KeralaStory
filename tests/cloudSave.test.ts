import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SaveV3 } from '../src/contracts';
import { chooseSave, parseCloudDoc, toCloudDoc } from '../src/account/cloudSave';

const profile = { id: 'p1', displayName: 'Meera', avatarPresetId: 'canopy' as const, colors: { skin: '#ba805b' as const, hair: '#292a25' as const, clothing: '#285943' as const } };
const save = (updatedAt: string, coins = 10): SaveV3 => ({
  version: 3, locale: 'en', bicycle: { position: [1, 2, 3], headingRad: 1 }, worldVersion: 'test-world', profile,
  position: [0, 1, 0], headingRad: 0, safeSpawnId: 'origin', visitedLandmarkIds: ['summit'], settings: DEFAULT_SETTINGS, updatedAt,
  collect: { coins, dateKey: '2026-09-18', collectedIds: ['coin:1'] },
});
const equipped = { carId: 'supercar', carColor: '#16181c', bikeId: 'yamaha', characterId: 'straw-hat' };

describe('cloud save', () => {
  it('round-trips a save with its coins and the equipped loadout', () => {
    const record = { save: save('2026-09-18T10:00:00.000Z', 420), equipped };
    const doc = toCloudDoc(record);
    expect(typeof doc.saveJson).toBe('string');
    expect(parseCloudDoc(JSON.parse(JSON.stringify(doc)))).toEqual(record);
  });

  it('never writes undefined fields, which Firestore rejects', () => {
    const doc = toCloudDoc({ save: { ...save('2026-09-18T10:00:00.000Z'), profile: { ...profile, characterModelId: undefined } }, equipped: null });
    expect(Object.values(doc).includes(undefined)).toBe(false);
    expect('equipped' in doc).toBe(false);
  });

  it('treats missing or corrupt cloud data as absent', () => {
    expect(parseCloudDoc(undefined)).toEqual({ save: null, equipped: null });
    expect(parseCloudDoc({ saveJson: '{not json', equipped: { carId: '' } })).toEqual({ save: null, equipped: null });
    expect(parseCloudDoc({ saveJson: JSON.stringify({ ...save('2026-09-18T10:00:00.000Z'), collect: { coins: -1 } }) }).save).toBeNull();
  });

  it('keeps the newer save on sign-in, and the account copy on a tie', () => {
    const older = save('2026-09-17T10:00:00.000Z'), newer = save('2026-09-18T10:00:00.000Z');
    expect(chooseSave(null, null)).toBe('none');
    expect(chooseSave(older, null)).toBe('local');
    expect(chooseSave(null, older)).toBe('cloud');
    expect(chooseSave(newer, older)).toBe('local');
    expect(chooseSave(older, newer)).toBe('cloud');
    expect(chooseSave(newer, newer)).toBe('cloud');
  });
});
