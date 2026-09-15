export interface ExplorerInput {
  keys: Set<string>;
  jumpQueued: boolean;
  lookX: number;
  lookY: number;
  dragging: boolean;
}

export const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ', 'KeyE']);

export function createInputState(): ExplorerInput {
  return { keys: new Set(), jumpQueued: false, lookX: 0, lookY: 0, dragging: false };
}

export function clearInput(input: ExplorerInput): void {
  input.keys.clear();
  input.jumpQueued = false;
  input.lookX = 0;
  input.lookY = 0;
  input.dragging = false;
}

export function pressKey(input: ExplorerInput, code: string, repeat: boolean): void {
  input.keys.add(code);
  if (code === 'Space' && !repeat) input.jumpQueued = true;
}

/** Camera azimuth is the angle of its position around the player, from +Z. */
export function movementIntent(keys: ReadonlySet<string>, cameraAzimuth: number): { x: number; z: number; running: boolean } {
  let forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  let right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const length = Math.hypot(forward, right);
  if (length > 0) { forward /= length; right /= length; }
  return {
    x: right * Math.cos(cameraAzimuth) - forward * Math.sin(cameraAzimuth),
    z: -right * Math.sin(cameraAzimuth) - forward * Math.cos(cameraAzimuth),
    running: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

export function headingFromMotion(x: number, z: number): number {
  return (Math.atan2(x, -z) + Math.PI * 2) % (Math.PI * 2);
}
