const DOWNLOAD_SHARE = 70;
const SETTLE_SHARE = 25;
const SETTLE_MS = 8000;

/**
 * three.js only reports downloads; parsing, decoding and shader compiles after them are invisible.
 * Downloads fill the first 70%, and time eases the rest toward 95 so the bar never looks frozen.
 * It reaches 100 only when the world reports the player ready.
 */
export function displayPercent(progress: number, elapsedMs: number, leaving: boolean): number {
  if (leaving) return 100;
  const downloads = Math.max(0, Math.min(progress, 1)) * DOWNLOAD_SHARE;
  const settling = SETTLE_SHARE * (1 - Math.exp(-Math.max(0, elapsedMs) / SETTLE_MS));
  return Math.min(DOWNLOAD_SHARE + SETTLE_SHARE, Math.round(downloads + settling));
}
