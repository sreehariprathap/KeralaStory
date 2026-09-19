// Three-free on purpose: the menu shell reads this without pulling the 3D chunk into the first load.
let progress = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

/** Loaders discover more files as they go, so the ratio can drop; the bar never should. */
export function nextProgress(previous: number, loaded: number, total: number): number {
  if (total <= 0) return previous;
  return Math.max(previous, Math.min(1, loaded / total));
}

export function reportLoadProgress(loaded: number, total: number): void {
  progress = nextProgress(progress, loaded, total);
  notify();
}

export function resetLoadProgress(): void {
  progress = 0;
  notify();
}

export function getLoadProgress(): number {
  return progress;
}

export function subscribeLoadProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
