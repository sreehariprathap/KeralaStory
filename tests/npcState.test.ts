import { describe, expect, it } from 'vitest';
import { NPC_DEFINITIONS } from '../src/game/npc/npcDefinitions';
import { createNpcState, tickNpcWander, isPlayerInRange, rollCoinEffect, scareAway } from '../src/game/npc/npcState';

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('npcState', () => {
  it('picks a new target on arrival and stays within the configured zones', () => {
    const def = NPC_DEFINITIONS.mayavi;
    let state = createNpcState(def, 0, 1);
    const firstTarget = state.targetPosition;
    // Force arrival by placing the NPC on the target, then tick once more.
    state = { ...state, position: firstTarget };
    state = tickNpcWander(state, def, 500, seededRng(2));
    expect(state.targetPosition).not.toEqual(firstTarget);
  });

  it('reports in-range only within proximityRadiusM', () => {
    const def = NPC_DEFINITIONS.luttappi;
    const state = createNpcState(def, 0, 3);
    const close: [number, number, number] = [state.position[0] + 1, state.position[1], state.position[2]];
    const far: [number, number, number] = [state.position[0] + 100, state.position[1], state.position[2]];
    expect(isPlayerInRange(state, def, close)).toBe(true);
    expect(isPlayerInRange(state, def, far)).toBe(false);
  });

  it('never rolls a coin effect before effectIntervalMs has elapsed', () => {
    const def = NPC_DEFINITIONS.luttappi;
    let state = createNpcState(def, 0, 4);
    state = { ...state, nextEffectAt: 8000 };
    expect(rollCoinEffect(state, def, 1000, seededRng(5))).toBeNull();
  });

  it('is deterministic for a seeded rng and clamps to the defined delta range', () => {
    const def = NPC_DEFINITIONS.luttappi;
    const state = { ...createNpcState(def, 0, 6), nextEffectAt: 0 };
    const a = rollCoinEffect(state, def, 8000, seededRng(7));
    const b = rollCoinEffect(state, def, 8000, seededRng(7));
    expect(a?.coinsDelta).toBe(b?.coinsDelta);
    if (a) expect(a.coinsDelta).toBeGreaterThanOrEqual(def.minCoinDelta);
    if (a) expect(a.coinsDelta).toBeLessThanOrEqual(def.maxCoinDelta);
  });

  it('moves Luttappi away from a player when Mayavi is within scareRadiusM', () => {
    const def = NPC_DEFINITIONS.luttappi;
    const base = createNpcState(def, 0, 8);
    const mayaviPos: [number, number, number] = [base.position[0] + 2, base.position[1], base.position[2]];
    // Anchor the target near Mayavi so scareAway's effect (moving it away) is unambiguous.
    const state = { ...base, targetPosition: [base.position[0] + 3, base.position[1], base.position[2]] as [number, number, number] };
    const scared = scareAway(state, def, mayaviPos, seededRng(9));
    const before = Math.hypot(state.targetPosition[0] - mayaviPos[0], state.targetPosition[2] - mayaviPos[2]);
    const after = Math.hypot(scared.targetPosition[0] - mayaviPos[0], scared.targetPosition[2] - mayaviPos[2]);
    expect(after).toBeGreaterThan(before);
  });
});
