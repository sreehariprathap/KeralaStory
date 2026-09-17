/**
 * Shared by the service worker and the page. `public/` files keep stable URLs, so the build publishes a
 * content hash per file (asset-hashes.json) and the worker stores each response under `path?v=<hash>`.
 * A changed file gets a new key; entries whose hash is no longer published are pruned.
 */
export interface AssetEntry { /** Content hash. */ h: string; /** Size in bytes. */ b: number }
export interface AssetHashes { version: 1; files: Record<string, AssetEntry> }

export const ASSET_CACHE = 'kerala-assets-v1';
export const ASSET_HASHES_URL = '/asset-hashes.json';

const CACHEABLE = /^\/(?:assets|park)\/.+\.(?:glb|gltf|bin|png|jpe?g|webp|ktx2|mp3|ogg|wav)$/i;

/** World assets served from public/ (models, textures, audio). Built JS/CSS live under /app/ and are precached instead. */
export function isCacheableAsset(pathname: string): boolean {
  return CACHEABLE.test(pathname);
}

export function assetCacheKey(origin: string, pathname: string, hash: string): string {
  return `${origin}${pathname}?v=${hash}`;
}

/** Cached request URLs that no longer match the published hash (or are not published at all). */
export function staleKeys(keys: readonly string[], hashes: AssetHashes): string[] {
  return keys.filter(key => {
    const url = new URL(key);
    return hashes.files[decodeURI(url.pathname)]?.h !== url.searchParams.get('v');
  });
}

/** Published assets not yet in the cache, and their total size. */
export function missingAssets(cachedKeys: readonly string[], hashes: AssetHashes, origin: string) {
  const cached = new Set(cachedKeys);
  const paths = Object.keys(hashes.files).filter(path => isCacheableAsset(path) && !cached.has(assetCacheKey(origin, encodeURI(path), hashes.files[path].h)));
  return { paths, bytes: paths.reduce((sum, path) => sum + hashes.files[path].b, 0) };
}

export function totalBytes(hashes: AssetHashes): number {
  return Object.entries(hashes.files).reduce((sum, [path, entry]) => sum + (isCacheableAsset(path) ? entry.b : 0), 0);
}

/** Messages between page and worker. */
export type WorkerRequest =
  | { type: 'asset-hashes'; hashes: AssetHashes }
  | { type: 'warm'; paths: string[] }
  | { type: 'cache-status' };
export type WorkerReply =
  | { type: 'warm-progress'; done: number; total: number; bytes: number; failed: number }
  | { type: 'cache-status'; cachedBytes: number; totalBytes: number; missingBytes: number };
