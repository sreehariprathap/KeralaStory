import { CAR_MODELS, CHARACTER_MODELS, type CarModelId } from '../assets/models';
import { BIKE_MODELS, type BikeModelId } from '../assets/bikeProfiles';
import { CAR_PAINT_COLORS } from '../assets/vehicleProfiles';
import { DEFAULT_EQUIPPED, type Equipped, type ExplorerProfile } from '../../contracts';

export type StoreKind = 'car' | 'bike' | 'character';
/** Everything is free for now; prices become a data change when purchases arrive. */
export interface StoreItem { id: string; kind: StoreKind; name: string; price: 0; unlocked: true }

export const PROCEDURAL_CHARACTER_ID = 'procedural';
export type CharacterChoiceId = typeof PROCEDURAL_CHARACTER_ID | typeof CHARACTER_MODELS[number]['id'];

const item = (kind: StoreKind) => (model: { id: string; name: string }): StoreItem => ({ id: model.id, kind, name: model.name, price: 0, unlocked: true });

export const STORE_ITEMS: readonly StoreItem[] = [
  ...CAR_MODELS.map(item('car')),
  ...BIKE_MODELS.map(item('bike')),
  item('character')({ id: PROCEDURAL_CHARACTER_ID, name: 'Explorer' }),
  ...CHARACTER_MODELS.map(item('character')),
];

export function storeItems(kind: StoreKind): StoreItem[] {
  return STORE_ITEMS.filter(entry => entry.kind === kind);
}

export interface ResolvedEquipped { carId: CarModelId; carColor: string; bikeId: BikeModelId; characterId: CharacterChoiceId }

const valid = (kind: StoreKind, id: string | undefined, fallback: string) => (id !== undefined && STORE_ITEMS.some(entry => entry.kind === kind && entry.id === id) ? id : fallback);

export function resolveEquipped(equipped: Partial<Equipped> | undefined): ResolvedEquipped {
  const color = equipped?.carColor;
  return {
    carId: valid('car', equipped?.carId, DEFAULT_EQUIPPED.carId) as CarModelId,
    carColor: color !== undefined && CAR_PAINT_COLORS.some(paint => paint.value === color) ? color : DEFAULT_EQUIPPED.carColor,
    bikeId: valid('bike', equipped?.bikeId, DEFAULT_EQUIPPED.bikeId) as BikeModelId,
    characterId: valid('character', equipped?.characterId, DEFAULT_EQUIPPED.characterId) as CharacterChoiceId,
  };
}

export function applyEquippedCharacter(profile: ExplorerProfile, characterId: CharacterChoiceId): ExplorerProfile {
  const rest = { ...profile };
  delete rest.characterModelId;
  return characterId === PROCEDURAL_CHARACTER_ID ? rest : { ...rest, characterModelId: characterId };
}
