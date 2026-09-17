import { describe, expect, it } from 'vitest';
import { assetCacheKey, isCacheableAsset, missingAssets, staleKeys, totalBytes, type AssetHashes } from '../src/pwa/assetCache';

const origin = 'https://kerala.example';
const hashes: AssetHashes = { version: 1, files: {
  '/assets/cars/bronco.glb': { h: 'aaa', b: 1000 },
  '/assets/grass/flowers (1).glb': { h: 'bbb', b: 500 },
  '/assets/bgm.mp3': { h: 'ccc', b: 300 },
  '/assets/notes.txt': { h: 'ddd', b: 9 },
} };

describe('asset cache keys', () => {
  it('caches world models, images and audio but not bundles or other files', () => {
    expect(isCacheableAsset('/assets/cars/bronco.glb')).toBe(true);
    expect(isCacheableAsset('/park/amusement_park.glb')).toBe(true);
    expect(isCacheableAsset('/assets/bgm.mp3')).toBe(true);
    expect(isCacheableAsset('/app/index-abc.js')).toBe(false);
    expect(isCacheableAsset('/assets/notes.txt')).toBe(false);
    expect(isCacheableAsset('/index.html')).toBe(false);
  });

  it('prunes entries whose content hash changed or was unpublished, including encoded paths', () => {
    const keys = [
      assetCacheKey(origin, '/assets/cars/bronco.glb', 'aaa'),
      assetCacheKey(origin, '/assets/cars/bronco.glb', 'old'),
      assetCacheKey(origin, encodeURI('/assets/grass/flowers (1).glb'), 'bbb'),
      assetCacheKey(origin, '/assets/removed.glb', 'zzz'),
    ];
    expect(staleKeys(keys, hashes)).toEqual([keys[1], keys[3]]);
  });

  it('reports what is left to download', () => {
    const keys = [assetCacheKey(origin, '/assets/cars/bronco.glb', 'aaa')];
    const missing = missingAssets(keys, hashes, origin);
    expect(missing.paths.sort()).toEqual(['/assets/bgm.mp3', '/assets/grass/flowers (1).glb']);
    expect(missing.bytes).toBe(800);
    expect(totalBytes(hashes)).toBe(1800);
    const all = Object.keys(hashes.files).map(path => assetCacheKey(origin, encodeURI(path), hashes.files[path].h));
    expect(missingAssets(all, hashes, origin)).toEqual({ paths: [], bytes: 0 });
  });
});
