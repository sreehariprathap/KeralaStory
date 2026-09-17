import type { GameSettings } from '../../contracts';

export interface RenderProfile {
  /** Device-pixel-ratio range the governor may use. */
  dprMin: number;
  dprMax: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Redraw the shadow map every N frames (1 = every frame). */
  shadowInterval: number;
}

/** Per-quality renderer settings. Phones get a lower resolution ceiling: their screens are dense and their GPUs small. */
export function renderProfile(quality: GameSettings['quality'], mobile: boolean, deviceDpr: number): RenderProfile {
  const cap = (value: number) => Math.max(1, Math.min(deviceDpr, value));
  if (quality === 'low') return { dprMin: .6, dprMax: cap(1), antialias: false, shadows: false, shadowMapSize: 0, shadowInterval: 1 };
  if (quality === 'medium') return { dprMin: .75, dprMax: cap(mobile ? 1.25 : 1.5), antialias: true, shadows: true, shadowMapSize: 1024, shadowInterval: 2 };
  return { dprMin: .85, dprMax: cap(mobile ? 1.5 : 2), antialias: true, shadows: true, shadowMapSize: 2048, shadowInterval: 1 };
}

/** Frame time (ms) above which resolution drops: slower than ~50 fps. */
export const SLOW_FRAME_MS = 20;
/** Frame time (ms) below which resolution may rise again: faster than ~75 fps. */
export const FAST_FRAME_MS = 13.3;
const WINDOW_MS = 1500;

/**
 * Adjusts render resolution to hold a smooth frame rate.
 * Feed it every frame's duration; it returns a new DPR when one should be applied, otherwise null.
 * Drops quickly (one slow window), recovers slowly (two fast windows in a row), and waits a window after each change.
 */
export function createDprGovernor(min: number, max: number, start = max) {
  let dpr = Math.max(min, Math.min(max, start));
  let samples: number[] = [], elapsed = 0, fastWindows = 0, cooldown = 0;
  return {
    get dpr() { return dpr; },
    sample(frameMs: number): number | null {
      // Ignore hitches from tab switches and asset uploads; they are not steady-state cost.
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return null;
      samples.push(frameMs); elapsed += frameMs;
      if (elapsed < WINDOW_MS) return null;
      const sorted = samples.sort((a, b) => a - b), p75 = sorted[Math.floor(sorted.length * .75)];
      samples = []; elapsed = 0;
      if (cooldown > 0) { cooldown--; return null; }
      let next = dpr;
      if (p75 > SLOW_FRAME_MS) { next = Math.max(min, dpr * .85); fastWindows = 0; }
      else if (p75 < FAST_FRAME_MS) { if (++fastWindows >= 2) { next = Math.min(max, dpr * 1.1); fastWindows = 0; } }
      else fastWindows = 0;
      next = Math.round(next * 100) / 100;
      if (Math.abs(next - dpr) < .01) return null;
      dpr = next; cooldown = 1;
      return dpr;
    },
  };
}

/** How the render loop should run: stop when hidden, render on demand behind menus, run freely while playing. */
export function frameloopFor(hidden: boolean, active: boolean, mode: string): 'always' | 'demand' | 'never' {
  if (hidden) return 'never';
  if (active && (mode === 'paused' || mode === 'map')) return 'demand';
  return 'always';
}
