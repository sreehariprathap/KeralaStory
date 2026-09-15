import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, getAsset } from '../src/content/assets/manifest';

describe('asset manifest', () => {
  it('has unique stable IDs and valid record fields', () => {
    const ids = ASSET_MANIFEST.map(asset => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const asset of ASSET_MANIFEST) {
      expect(['prototype', 'ready']).toContain(asset.status);
      expect(['character', 'vehicle', 'environment', 'audio', 'reference']).toContain(asset.kind);
      expect(asset.sourcePath === null || asset.sourcePath.length > 0).toBe(true);
      expect(asset.license === null || asset.license.length > 0).toBe(true);
    }
  });

  it('tracks the available procedural previews and references', () => {
    expect(getAsset('traveler-procedural-preview')?.status).toBe('prototype');
    expect(getAsset('bicycle-procedural-roadster-preview')?.status).toBe('prototype');
    expect(getAsset('world-reference-2000s')?.kind).toBe('reference');
  });

  it('does not claim production-ready assets without supplied deliverables', () => {
    expect(ASSET_MANIFEST.some(asset => asset.status === 'ready')).toBe(false);
    expect(ASSET_MANIFEST.filter(asset => asset.sourcePath === null).every(asset => asset.status === 'prototype' && asset.license === null)).toBe(true);
  });
});
