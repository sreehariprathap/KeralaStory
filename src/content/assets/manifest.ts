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
  { id: 'traveler-procedural-preview', status: 'prototype', sourcePath: 'src/game/player/ExplorerAvatar.tsx', license: 'Original project code', kind: 'character' },
  { id: 'bicycle-procedural-roadster-preview', status: 'prototype', sourcePath: 'src/game/vehicle/BicycleVisual.tsx', license: 'Original project code', kind: 'vehicle' },
  { id: 'regional-details-prototype', status: 'prototype', sourcePath: 'src/game/world/RegionalDetails.tsx', license: 'Original project code', kind: 'environment' },
  { id: 'default-bgm', status: 'prototype', sourcePath: 'public/assets/bgm.mp3', license: null, kind: 'audio' },
  { id: 'world-reference', status: 'prototype', sourcePath: 'public/assets/world-reference.jpeg', license: null, kind: 'reference' },
  { id: 'world-reference-2000s', status: 'prototype', sourcePath: 'public/assets/world-reference-2000s.jpeg', license: null, kind: 'reference' },
  { id: 'approved-traveler-rig', status: 'prototype', sourcePath: null, license: null, kind: 'character' },
  { id: 'approved-bicycle-model', status: 'prototype', sourcePath: null, license: null, kind: 'vehicle' },
  { id: 'approved-regional-environment-kit', status: 'prototype', sourcePath: null, license: null, kind: 'environment' },
  { id: 'approved-kerala-ambience-and-footsteps', status: 'prototype', sourcePath: null, license: null, kind: 'audio' },
];

export function getAsset(id: string): AssetRecord | undefined {
  return ASSET_MANIFEST.find(asset => asset.id === id);
}
