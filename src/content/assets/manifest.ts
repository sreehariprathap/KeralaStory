import { CAR_MODELS, CHARACTER_MODELS } from './models';
import { V2_ASSET_PROFILES } from './v2AssetProfiles';
import { BIKE_MODELS } from './bikeProfiles';
export type AssetStatus = 'prototype' | 'ready';
export type AssetKind = 'character' | 'vehicle' | 'environment' | 'audio' | 'reference';

export interface AssetRecord {
  id: string;
  status: AssetStatus;
  sourcePath: string | null;
  /** Null means that provenance/license evidence has not been supplied. */
  license: string | null;
  kind: AssetKind;
}

/**
 * Evidence-backed inventory. Procedural code and concept references remain
 * prototypes until approved deliverables and provenance are supplied.
 */
export const ASSET_MANIFEST: readonly AssetRecord[] = [
  ...V2_ASSET_PROFILES.map(profile => ({ id: `v2-${profile.id}`, status: 'prototype' as const, sourcePath: `public${profile.url}`, license: null, kind: profile.url.includes('/cars/') ? 'vehicle' as const : 'environment' as const })),
  ...CHARACTER_MODELS.map(model => ({ id: `character-${model.id}`, status: 'prototype' as const, sourcePath: `public${model.url}`, license: null, kind: 'character' as const })),
  ...CAR_MODELS.map(model => ({ id: `car-${model.id}`, status: 'prototype' as const, sourcePath: `public${model.url}`, license: null, kind: 'vehicle' as const })),
  ...BIKE_MODELS.flatMap(model => 'url' in model ? [{ id: `bike-${model.id}`, status: 'prototype' as const, sourcePath: `public${model.url}`, license: null, kind: 'vehicle' as const }] : []),
  ...['coconut_tree.glb', 'coconut_tree (1).glb', 'low_poly_coconut_1.glb', 'low_poly_coconut_2.glb', 'low_poly_coconut_3.glb', 'stylized_palm__coconut_tree_pack.glb']
    .map(file => ({ id: `coconut-${file.replace(/\W+/g, '-').replace(/-glb$/, '')}`, status: 'prototype' as const, sourcePath: `public/assets/Coconut-trees/${file}`, license: null, kind: 'environment' as const })),
  ...['flowers.glb', 'flowers (1).glb', 'flowers_pack_4.glb']
    .map(file => ({ id: `flowers-${file.replace(/\W+/g, '-').replace(/-glb$/, '')}`, status: 'prototype' as const, sourcePath: `public/assets/grass/${file}`, license: null, kind: 'environment' as const })),
  ...['cartoon_dog.glb', 'chicken_character.glb', 'cow.glb', 'elephant.glb', 'goat.glb', 'toon_cat_free.glb']
    .map(file => ({ id: `animal-${file.replace(/\.glb$/, '').replace(/_/g, '-')}`, status: 'prototype' as const, sourcePath: `public/assets/living-beings/${file}`, license: null, kind: 'character' as const })),
  ...['coin.glb', 'coins_and_money.glb', 'pumping_heart_model.glb']
    .map(file => ({ id: `collectable-${file.replace(/\.glb$/, '').replace(/_/g, '-')}`, status: 'prototype' as const, sourcePath: `public/assets/collectables/${file}`, license: null, kind: 'environment' as const })),
  { id: 'adventure-paraglider-canopy', status: 'prototype', sourcePath: 'public/assets/adventure/parachute_-_low_poly.glb', license: null, kind: 'vehicle' },
  { id: 'traveler-procedural-preview', status: 'prototype', sourcePath: 'src/game/player/ExplorerAvatar.tsx', license: 'Original project code', kind: 'character' },
  { id: 'bicycle-procedural-roadster-preview', status: 'prototype', sourcePath: 'src/game/vehicle/BicycleVisual.tsx', license: 'Original project code', kind: 'vehicle' },
  { id: 'regional-details-prototype', status: 'prototype', sourcePath: 'src/game/world/RegionalDetails.tsx', license: 'Original project code', kind: 'environment' },
  { id: 'default-bgm', status: 'prototype', sourcePath: 'public/assets/bgm.mp3', license: null, kind: 'audio' },
  { id: 'world-reference', status: 'prototype', sourcePath: 'asset-sources/reference/world-reference.jpeg', license: null, kind: 'reference' },
  { id: 'world-reference-2000s', status: 'prototype', sourcePath: 'asset-sources/reference/world-reference-2000s.jpeg', license: null, kind: 'reference' },
  { id: 'approved-traveler-rig', status: 'prototype', sourcePath: null, license: null, kind: 'character' },
  { id: 'approved-bicycle-model', status: 'prototype', sourcePath: null, license: null, kind: 'vehicle' },
  { id: 'approved-regional-environment-kit', status: 'prototype', sourcePath: null, license: null, kind: 'environment' },
  { id: 'approved-kerala-ambience-and-footsteps', status: 'prototype', sourcePath: null, license: null, kind: 'audio' },
];

export function getAsset(id: string): AssetRecord | undefined {
  return ASSET_MANIFEST.find(asset => asset.id === id);
}
