import { describe, expect, it } from 'vitest';
import { clearInput, createInputState, headingFromMotion, movementIntent, pressKey } from '../src/game/input/inputState';
import { dampAngle, needsSafeReset } from '../src/game/player/controllerMath';

describe('explorer input and movement contracts', () => {
  it('normalizes diagonal movement and treats arrow aliases as the same action', () => {
    const diagonal = movementIntent(new Set(['KeyW', 'KeyD']), 0);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
    const aliases = movementIntent(new Set(['KeyW', 'ArrowUp']), 0);
    expect(aliases.z).toBe(-1);
    expect(movementIntent(new Set(['KeyW', 'KeyS']), 0).z).toBeCloseTo(0);
  });
  it('walks south at the initial south-facing camera and strafes screen-right west', () => {
    const forward = movementIntent(new Set(['KeyW']), -Math.PI);
    expect(forward.x).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(1);
    const right = movementIntent(new Set(['KeyD', 'ShiftLeft']), -Math.PI);
    expect(right.x).toBeCloseTo(-1);
    expect(right.running).toBe(true);
    expect(headingFromMotion(0, -1)).toBeCloseTo(0);
    expect(headingFromMotion(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(headingFromMotion(0, 1)).toBeCloseTo(Math.PI);
  });
  it('queues one jump edge and clears every held action on ownership loss', () => {
    const input = createInputState();
    pressKey(input, 'Space', false);
    expect(input.jumpQueued).toBe(true);
    input.jumpQueued = false;
    pressKey(input, 'Space', true);
    expect(input.jumpQueued).toBe(false);
    pressKey(input, 'KeyW', false);
    input.lookX = 12; input.lookY = 3; input.dragging = true;
    clearInput(input);
    expect(input).toEqual(createInputState());
  });
  it('detects invalid positions without rejecting the elevated world', () => {
    expect(needsSafeReset({ x: 0, y: 76, z: -460 })).toBe(false);
    expect(needsSafeReset({ x: 0, y: 44, z: -460 })).toBe(true);
    expect(needsSafeReset({ x: 65, y: 76, z: -460 })).toBe(true);
    expect(needsSafeReset({ x: 0, y: 76, z: -333 })).toBe(true);
    expect(needsSafeReset({ x: NaN, y: 76, z: -460 })).toBe(true);
  });
  it('turns across the angle seam along the short arc', () => {
    const result = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(result).toBeCloseTo(Math.PI);
  });
});
