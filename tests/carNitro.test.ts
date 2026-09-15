import { describe, expect, it } from 'vitest';
import { createNitroState, stepNitro } from '../src/game/vehicle/carNitro';

describe('car nitrous controller', () => {
  it('activates while held, expires its boost, and enforces cooldown', () => {
    const state = createNitroState();
    stepNitro(state, true, 0.1);
    expect(state.active).toBe(true);
    expect(state.multiplier).toBeGreaterThan(1);
    stepNitro(state, true, 2);
    expect(state.active).toBe(false);
    expect(state.remaining).toBe(0);
    stepNitro(state, true, 0.1);
    expect(state.active).toBe(false);
    expect(state.cooldown).toBeGreaterThan(0);
  });

  it('recharges after release and cooldown without affecting idle cars', () => {
    const state = createNitroState();
    stepNitro(state, false, 1);
    expect(state.active).toBe(false);
    expect(state.multiplier).toBe(1);
    stepNitro(state, true, 0.1);
    expect(state.active).toBe(true);
    stepNitro(state, false, 2);
    stepNitro(state, false, 3);
    stepNitro(state, true, 0.1);
    expect(state.active).toBe(true);
  });
});
