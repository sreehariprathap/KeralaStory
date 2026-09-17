import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { ASSET_HASHES_URL, isCacheableAsset, type AssetHashes, type WorkerReply, type WorkerRequest } from './assetCache';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export interface PwaState {
  /** A new build is waiting; `applyUpdate` reloads into it. */
  updateReady: boolean;
  /** The app shell is cached and the game opens offline. */
  offlineReady: boolean;
  /** The browser offered an install prompt (Chromium). */
  canInstall: boolean;
  /** World download: bytes cached / total, null until the worker reports. */
  cache: { cachedBytes: number; totalBytes: number } | null;
  download: { done: number; total: number; failed: number } | null;
}

let state: PwaState = { updateReady: false, offlineReady: false, canInstall: false, cache: null, download: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let installEvent: BeforeInstallPromptEvent | null = null;
let hashes: AssetHashes | null = null;

function post(message: WorkerRequest) {
  navigator.serviceWorker?.controller?.postMessage(message);
}

async function publishHashes() {
  try {
    const response = await fetch(ASSET_HASHES_URL, { cache: 'no-cache' });
    if (!response.ok) return;
    hashes = await response.json() as AssetHashes;
    post({ type: 'asset-hashes', hashes });
    // Anything the page already loaded before the worker took control is worth keeping.
    const loaded = performance.getEntriesByType('resource').map(entry => decodeURI(new URL(entry.name).pathname)).filter(path => isCacheableAsset(path) && hashes!.files[path]);
    if (loaded.length) post({ type: 'warm', paths: [...new Set(loaded)] });
    post({ type: 'cache-status' });
  } catch { /* offline: the worker keeps the last published hashes */ }
}

/** Registers the service worker (production builds only) and wires install/update events. */
export function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ updateReady: true }),
    onOfflineReady: () => set({ offlineReady: true }),
  });
  navigator.serviceWorker.addEventListener('message', event => {
    const data = event.data as WorkerReply;
    if (data?.type === 'warm-progress') {
      set({ download: { done: data.done, total: data.total, failed: data.failed } });
      if (data.done === data.total) post({ type: 'cache-status' });
    } else if (data?.type === 'cache-status') set({ cache: { cachedBytes: data.cachedBytes, totalBytes: data.totalBytes } });
  });
  // The first visit is not controlled until the worker claims the page.
  if (navigator.serviceWorker.controller) void publishHashes();
  navigator.serviceWorker.addEventListener('controllerchange', () => void publishHashes());
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event as BeforeInstallPromptEvent; set({ canInstall: true }); });
  window.addEventListener('appinstalled', () => { installEvent = null; set({ canInstall: false }); });
}

export function applyUpdate() {
  void updateSW?.(true);
}

export async function promptInstall() {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  set({ canInstall: false });
}

export function refreshCacheStatus() {
  post({ type: 'cache-status' });
}

/** Caches every world asset for offline play. Asks the browser not to evict it under storage pressure. */
export async function downloadWorld() {
  if (!hashes || !navigator.serviceWorker?.controller) return false;
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  const paths = Object.keys(hashes.files).filter(isCacheableAsset);
  set({ download: { done: 0, total: paths.length, failed: 0 } });
  post({ type: 'warm', paths });
  return true;
}

export const serviceWorkerActive = () => Boolean(navigator.serviceWorker?.controller);
