import { describe, expect, it } from 'vitest';
import { CAR_MODELS, CHARACTER_MODELS } from '../src/content/assets/models';
import { BIKE_MODELS } from '../src/content/assets/bikeProfiles';
import { STORE_ITEMS, storeItems, resolveEquipped, applyEquippedCharacter, PROCEDURAL_CHARACTER_ID } from '../src/content/store/catalog';
import type { ExplorerProfile } from '../src/contracts';

const profile: ExplorerProfile = { id: 'p1', displayName: 'Sree', avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } };

describe('store catalogue', () => {
  it('lists exactly the spawnable cars, bikes, and characters plus the procedural explorer', () => {
    expect(storeItems('car').map(i => i.id)).toEqual(CAR_MODELS.map(m => m.id));
    expect(storeItems('bike').map(i => i.id)).toEqual(BIKE_MODELS.map(m => m.id));
    expect(storeItems('character').map(i => i.id)).toEqual([PROCEDURAL_CHARACTER_ID, ...CHARACTER_MODELS.map(m => m.id)]);
  });

  it('prices everything at zero and unlocks everything', () => {
    expect(STORE_ITEMS.every(i => i.price === 0 && i.unlocked)).toBe(true);
  });

  it('resolves defaults when nothing is equipped', () => {
    expect(resolveEquipped(undefined)).toEqual({ carId: 'admin', carColor: '#b3121f', bikeId: 'roadster', characterId: 'procedural' });
  });

  it('keeps valid equipped ids and falls back per field on unknown ones', () => {
    expect(resolveEquipped({ carId: 'supercar', carColor: '#16181c', bikeId: 'yamaha', characterId: 'straw-hat' }))
      .toEqual({ carId: 'supercar', carColor: '#16181c', bikeId: 'yamaha', characterId: 'straw-hat' });
    expect(resolveEquipped({ carId: 'mazda-rx7', carColor: 'purple', bikeId: 'nope', characterId: 'tommy' }))
      .toEqual({ carId: 'admin', carColor: '#b3121f', bikeId: 'roadster', characterId: 'procedural' });
  });

  it('applies the equipped character to a profile', () => {
    expect(applyEquippedCharacter(profile, 'messi').characterModelId).toBe('messi');
    expect(applyEquippedCharacter({ ...profile, characterModelId: 'messi' }, 'procedural').characterModelId).toBeUndefined();
  });
});
