import type { InputCommands, InputSource } from '../../contracts/input';
export interface ExplorerInput {
  keys: Set<string>;
  move: {x: number; forward: number};
  source: InputSource | null;
  sprintLocked: boolean;
  interactQueued: boolean;
  brake: boolean;
  jumpQueued: boolean;
  lookX: number;
  lookY: number;
  dragging: boolean;
}

export const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ', 'KeyE', 'KeyF', 'KeyR']);

export function createInputState(): ExplorerInput {
  return { move: {x:0,forward:0}, source:null, sprintLocked:false, interactQueued:false, brake:false, keys: new Set(), jumpQueued: false, lookX: 0, lookY: 0, dragging: false };
}

export function clearInput(input: ExplorerInput): void {
  input.keys.clear();
  input.move = {x:0,forward:0};
  input.source = null;
  input.sprintLocked = false;
  input.interactQueued = false;
  input.brake = false;
  input.jumpQueued = false;
  input.lookX = 0;
  input.lookY = 0;
  input.dragging = false;
}

export function pressKey(input: ExplorerInput, code: string, repeat: boolean): void {
  input.keys.add(code);
  if (code === 'KeyF' && !repeat) input.interactQueued = true;
  if (code === 'KeyR' && !repeat) input.sprintLocked = !input.sprintLocked;
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

export function createInputCommands(input: ExplorerInput, enabled: () => boolean = () => true): InputCommands {
  return {
    setMove(source, x, forward) {
      if (!enabled()) return;
      if (!Number.isFinite(x) || !Number.isFinite(forward)) return;
      const length = Math.max(1, Math.hypot(x, forward));
      input.move = {x:x/length,forward:forward/length};
      input.source = source;
      if (forward < -.2) input.sprintLocked = false;
    },
    addLook(_source, dx, dy) {
      if (!enabled() || !Number.isFinite(dx + dy)) return;
      input.lookX += dx; input.lookY += dy;
    },
    press(action) {
      if (!enabled()) return;
      if (action === 'jump') input.jumpQueued = true;
      if (action === 'toggleSprint') input.sprintLocked = !input.sprintLocked;
      if (action === 'interact') input.interactQueued = true;
    },
    setBrake(held) { input.brake = enabled() && held; if (held) input.sprintLocked = false; },
    clear(source) {
      if (!source) { clearInput(input); return; }
      if (input.source === source) { input.source=null; input.move={x:0,forward:0}; }
      if (source === 'keyboard') input.keys.clear();
      input.sprintLocked=false; input.jumpQueued=false; input.interactQueued=false; input.brake=false;
      input.lookX=0; input.lookY=0;
    },
  };
}

export function keyboardAxes(keys: ReadonlySet<string>) {
  return {x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),
    forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))};
}
export function readMovement(input: ExplorerInput, azimuth: number) {
  const right=input.move.x, forward=input.sprintLocked?Math.max(1,input.move.forward):input.move.forward;
  const length=Math.max(1,Math.hypot(right,forward));
  return {x:(right*Math.cos(azimuth)-forward*Math.sin(azimuth))/length,
    z:(-right*Math.sin(azimuth)-forward*Math.cos(azimuth))/length,
    running:input.sprintLocked||input.keys.has('ShiftLeft')||input.keys.has('ShiftRight')};
}
