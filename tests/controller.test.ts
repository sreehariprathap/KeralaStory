import { describe, expect, it } from 'vitest';
import { clearInput, createInputState, headingFromMotion, movementIntent, pressKey } from '../src/game/input/inputState';
import { FEET_TO_CENTER, dampAngle, needsSafeReset } from '../src/game/player/controllerMath';

import { BRIDGE_DECK_Y, BRIDGE_X, LANDMARKS, WATER_LEVEL, WORLD_BOUNDS, terrainHeight } from '../src/content/world/kodassery';

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
  it('accepts grounded landmarks in all four regions, including the elevated river bridge', () => {
    for (const { position: [x, feetY, z] } of LANDMARKS) {
      expect(needsSafeReset({ x, y: feetY + FEET_TO_CENTER, z })).toBe(false);
    }
    for (const [x, z] of [[65, -460], [0, -333], [0, -190], [48, 77]]) {
      expect(needsSafeReset({ x, y: terrainHeight(x, z) + FEET_TO_CENTER, z })).toBe(false);
    }
  });
  it('lets explorers swim in open water while keeping bridge decks and airborne crossings valid', () => {
    expect(needsSafeReset({ x: BRIDGE_X, y: BRIDGE_DECK_Y + FEET_TO_CENTER, z: -99 })).toBe(false);
    expect(needsSafeReset({ x: BRIDGE_X, y: WATER_LEVEL - 1.25 + FEET_TO_CENTER, z: -99 })).toBe(false);
    expect(needsSafeReset({ x: 0, y: WATER_LEVEL + FEET_TO_CENTER + 1, z: -99 })).toBe(false);
    expect(needsSafeReset({ x: 84, y: WATER_LEVEL - 1.25 + FEET_TO_CENTER, z: 50 })).toBe(false);
  });
  it('recovers falls beneath local terrain, nonfinite coordinates and world-boundary exits', () => {
    for (const z of [-460, -250, 40]) {
      expect(needsSafeReset({ x: 0, y: terrainHeight(0, z) - FEET_TO_CENTER - 0.01, z })).toBe(true);
    }
    const y = terrainHeight(0, -460) + FEET_TO_CENTER;
    expect(needsSafeReset({ x: WORLD_BOUNDS.xMax + 0.01, y, z: -460 })).toBe(true);
    expect(needsSafeReset({ x: WORLD_BOUNDS.xMin - 0.01, y, z: -460 })).toBe(true);
    expect(needsSafeReset({ x: 0, y, z: WORLD_BOUNDS.zMin - 0.01 })).toBe(true);
    expect(needsSafeReset({ x: 0, y, z: WORLD_BOUNDS.zMax + 0.01 })).toBe(true);
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(needsSafeReset({ x: invalid, y, z: -460 })).toBe(true);
      expect(needsSafeReset({ x: 0, y: invalid, z: -460 })).toBe(true);
      expect(needsSafeReset({ x: 0, y, z: invalid })).toBe(true);
    }
  });
  it('turns across the angle seam along the short arc', () => {
    const result = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(result).toBeCloseTo(Math.PI);
  });
});
