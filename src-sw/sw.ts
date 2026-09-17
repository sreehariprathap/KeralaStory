/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, getCacheKeyForURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { createPartialResponse } from 'workbox-range-requests';
import { ASSET_CACHE, assetCacheKey, isCacheableAsset, missingAssets, staleKeys, totalBytes, type AssetHashes, type WorkerReply, type WorkerRequest } from '../src/pwa/assetCache';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

// App shell: hashed JS/CSS, fonts, icons and the Draco decoder. Updated as a set when a new build is accepted.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Any in-app URL (including ?inspect) opens the cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('message', event => {
  const data = event.data as WorkerRequest | { type: 'SKIP_WAITING' } | undefined;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
  else if (data?.type === 'asset-hashes') event.waitUntil(setHashes(data.hashes));
  else if (data?.type === 'warm') event.waitUntil(warm(data.paths, event.source));
  else if (data?.type === 'cache-status') event.waitUntil(status(event.source));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// ---- World assets: cache-first under content-hash keys ----------------------------------------------
const META_CACHE = 'kerala-asset-meta-v1';
const META_KEY = '/__asset-hashes';
let hashes: AssetHashes | null = null;

async function loadHashes(): Promise<AssetHashes | null> {
  if (hashes) return hashes;
  const stored = await (await caches.open(META_CACHE)).match(META_KEY);
  hashes = stored ? await stored.json() as AssetHashes : null;
  return hashes;
}

async function setHashes(next: AssetHashes) {
  hashes = next;
  await (await caches.open(META_CACHE)).put(META_KEY, new Response(JSON.stringify(next), { headers: { 'content-type': 'application/json' } }));
  const cache = await caches.open(ASSET_CACHE);
  const keys = (await cache.keys()).map(request => request.url);
  await Promise.all(staleKeys(keys, next).map(key => cache.delete(key)));
}

async function fetchAndStore(cache: Cache, path: string, key: string): Promise<Response> {
  // Always fetch the whole file, even for a Range request: the cache needs the complete body.
  const response = await fetch(new Request(new URL(path, self.location.origin).href, { credentials: 'same-origin' }));
  if (response.ok && response.status === 200) {
    try { await cache.put(key, response.clone()); } catch { /* quota: serve without caching */ }
  }
  return response;
}

async function serveAsset(request: Request, url: URL): Promise<Response> {
  const cache = await caches.open(ASSET_CACHE);
  const entry = (await loadHashes())?.files[decodeURI(url.pathname)];
  const respond = async (response: Response) => request.headers.has('range') && response.status === 200 ? createPartialResponse(request, response) : response;
  if (!entry) {
    // Not published yet (first visit before the page sent hashes, or a dev build): plain network.
    try { return await fetch(request); } catch {
      const stale = await cache.match(url.pathname, { ignoreSearch: true });
      if (stale) return respond(stale);
      throw new Error(`offline: ${url.pathname}`);
    }
  }
  const key = assetCacheKey(url.origin, url.pathname, entry.h);
  const hit = await cache.match(key);
  if (hit) return respond(hit);
  try { return await respond(await fetchAndStore(cache, url.pathname, key)); } catch (error) {
    // Offline with an older copy: better an old model than a broken scene.
    const stale = await cache.match(url.pathname, { ignoreSearch: true });
    if (stale) return respond(stale);
    throw error;
  }
}

// Hashed bundle files outside the precache (e.g. the Draco decoder) never change: cache on first use.
const APP_RUNTIME_CACHE = 'kerala-app-runtime-v1';
async function serveHashed(request: Request): Promise<Response> {
  const cache = await caches.open(APP_RUNTIME_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) try { await cache.put(request, response.clone()); } catch { /* quota */ }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Precached files are answered by workbox's own listener; responding twice throws.
  if (url.pathname.startsWith('/app/')) { if (!getCacheKeyForURL(url.href)) event.respondWith(serveHashed(request)); }
  else if (isCacheableAsset(decodeURI(url.pathname))) event.respondWith(serveAsset(request, url));
});

function reply(target: Client | ServiceWorker | MessagePort | null, message: WorkerReply) {
  target?.postMessage(message);
}

async function warm(paths: string[], source: Client | ServiceWorker | MessagePort | null) {
  const map = await loadHashes();
  if (!map) return;
  const cache = await caches.open(ASSET_CACHE);
  const todo = paths.filter(path => map.files[path]);
  let done = 0, bytes = 0, failed = 0;
  // Two at a time: fast enough on Wi-Fi without starving the game's own requests.
  const queue = [...todo];
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const key = assetCacheKey(self.location.origin, encodeURI(path), map.files[path].h);
      try {
        if (!(await cache.match(key))) {
          const response = await fetchAndStore(cache, encodeURI(path), key);
          if (!response.ok) failed++;
        }
        bytes += map.files[path].b;
      } catch { failed++; }
      done++;
      reply(source, { type: 'warm-progress', done, total: todo.length, bytes, failed });
    }
  };
  await Promise.all([worker(), worker()]);
}

async function status(source: Client | ServiceWorker | MessagePort | null) {
  const map = await loadHashes();
  if (!map) { reply(source, { type: 'cache-status', cachedBytes: 0, totalBytes: 0, missingBytes: 0 }); return; }
  const keys = (await (await caches.open(ASSET_CACHE)).keys()).map(request => request.url);
  const total = totalBytes(map), missing = missingAssets(keys, map, self.location.origin).bytes;
  reply(source, { type: 'cache-status', cachedBytes: total - missing, totalBytes: total, missingBytes: missing });
}
