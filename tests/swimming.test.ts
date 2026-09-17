import { describe, expect, it } from 'vitest';
import { SWIM_FLOAT_DEPTH, SWIM_SPEED, buoyantVerticalSpeed, isSunk, isSwimming, swimVelocity } from '../src/game/player/swimming';
import { EXPANSION_GROUND, V2_LAYOUT, WATER_LEVEL, isVehicleTerrainAllowed, isCarTerrainAllowed, riverCenter, waterFlowAt } from '../src/content/world/definition';

describe('swimming', () => {
  it('starts in deep water, keeps swimming through small bobs and stops on shallow ground', () => {
    expect(isSwimming(8, null, true)).toBe(false);
    expect(isSwimming(8 - 0.5, 8, false)).toBe(false);
    expect(isSwimming(8 - 1.2, 8, false)).toBe(true);
    expect(isSwimming(8 - 1, 8, true)).toBe(true);
    expect(isSwimming(8 - 0.8, 8, true)).toBe(false);
  });
  it('settles at the floating depth and absorbs a dive', () => {
    let y = 8 + 2, v = -15;
    for (let i = 0; i < 600; i++) { v = buoyantVerticalSpeed(v, y, 8, 1 / 60); y += v / 60; }
    expect(y).toBeCloseTo(8 - SWIM_FLOAT_DEPTH, 2);
    expect(buoyantVerticalSpeed(-30, 8, 8, 1 / 60)).toBeGreaterThanOrEqual(-8);
  });
  it('adds the current to the stroke', () => {
    expect(swimVelocity({ x: 1, z: 0, running: false }, { x: 0, z: 1 })).toEqual({ x: SWIM_SPEED, z: 1 });
    expect(swimVelocity({ x: 0, z: 0, running: false }, { x: -0.5, z: 0 })).toEqual({ x: -0.5, z: 0 });
  });
  it('sinks vehicles only once their wheels are well under', () => {
    expect(isSunk(8 - 0.3, 8)).toBe(false);
    expect(isSunk(8 - 0.6, 8)).toBe(true);
    expect(isSunk(0, null)).toBe(false);
  });
});

describe('river current', () => {
  it('carries swimmers downstream along each channel and is slack in still water', () => {
    // The Kurumali river runs toward the Kodaly estuary (+x).
    const legacy = waterFlowAt(0, riverCenter(0));
    expect(legacy.x).toBeGreaterThan(0.5);
    expect(waterFlowAt(0, -300)).toEqual({ x: 0, z: 0 });
    for (const reach of V2_LAYOUT.riverReaches.filter(r => r.kind === 'channel' && r.id !== 'kurumali-existing')) {
      const [a, b] = reach.points;
      const x = (a[0] + b[0]) / 2, z = (a[2] + b[2]) / 2;
      if (EXPANSION_GROUND.v2!.river.surfaceAt(x, z) === null) continue;
      const flow = waterFlowAt(x, z), downstream = (b[0] - a[0]) * flow.x + (b[2] - a[2]) * flow.z;
      expect(downstream, reach.id).toBeGreaterThan(0);
    }
  });
  it('lets vehicles drive into water that cars cannot park on', () => {
    const z = riverCenter(0);
    expect(WATER_LEVEL).toBeGreaterThan(0);
    expect(isCarTerrainAllowed(0, z)).toBe(false);
    expect(isVehicleTerrainAllowed(0, z)).toBe(true);
  });
});
