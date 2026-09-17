import { useEffect, useState } from 'react';

type FullscreenDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

const doc = () => document as FullscreenDocument;

/** Running as an installed app (home-screen icon), where the browser UI is already gone. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad Safari, where installing goes through Share → Add to Home Screen. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function canFullscreen(): boolean {
  return Boolean(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
}

const fullscreenElement = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null;

export async function toggleFullscreen(landscape: boolean) {
  if (fullscreenElement()) {
    await (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
    return;
  }
  const root = document.documentElement as FullscreenElement;
  await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.());
  // Orientation can only be locked while fullscreen, and only on some browsers (Android Chrome).
  if (landscape) try { await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape'); } catch { /* unsupported */ }
}

export function useFullscreen(): boolean {
  const [active, setActive] = useState(() => Boolean(fullscreenElement()));
  useEffect(() => {
    const update = () => setActive(Boolean(fullscreenElement()));
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => { document.removeEventListener('fullscreenchange', update); document.removeEventListener('webkitfullscreenchange', update); };
  }, []);
  return active;
}

/** Keeps the screen awake while `enabled`; the lock is re-taken when the page becomes visible again. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null, cancelled = false;
    const acquire = async () => {
      if (document.hidden || lock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
        if (cancelled) void lock.release();
      } catch { /* denied or battery saver */ }
    };
    const onVisible = () => { if (!document.hidden) void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); void lock?.release(); };
  }, [enabled]);
}

/** Short haptic pulse where supported (Android); silently ignored elsewhere. */
export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
