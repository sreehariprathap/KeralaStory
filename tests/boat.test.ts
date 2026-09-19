import { describe, expect, it } from 'vitest';
import { BOAT, boatMoveAllowed, boatSurface, createBoatState, stepBoat, type BoatState } from '../src/game/vehicle/boatMotor';
import { BOAT_DOCKS } from '../src/content/world/boatDocks';
import { V2_LAYOUT, terrainHeight, waterLevelAt } from '../src/content/world/definition';
import { DAM_POOL_RADIUS } from '../src/content/world/v2Layout';

const boat = (overrides: Partial<BoatState> = {}): BoatState => ({ ...createBoatState(0, 0, 0, 0), ...overrides });

describe('boat motor', () => {
  it('accelerates to top speed along its heading and glides to a stop', () => {
    const state = boat();
    let move = { x: 0, z: 0 };
    for (let i = 0; i < 600; i++) move = stepBoat(state, { forward: 1, steer: 0, brake: false }, 1 / 60);
    expect(state.speed).toBeCloseTo(BOAT.topSpeed);
    // Heading 0 is north (−z).
    expect(move.z).toBeLessThan(0);
    expect(Math.abs(move.x)).toBeLessThan(1e-9);
    for (let i = 0; i < 1200; i++) stepBoat(state, { forward: 0, steer: 0, brake: false }, 1 / 60);
    expect(state.speed).toBe(0);
  });

  it('reverses slowly and steers the stern the other way', () => {
    const state = boat();
    for (let i = 0; i < 600; i++) stepBoat(state, { forward: -1, steer: 1, brake: false }, 1 / 60);
    expect(state.speed).toBeCloseTo(-BOAT.reverseSpeed);
    expect(state.headingRad).toBeLessThan(0);
  });

  it('reaches a higher top speed on nitrous, then settles back', () => {
    const state = boat();
    for (let i = 0; i < 600; i++) stepBoat(state, { forward: 1, steer: 0, brake: false }, 1 / 60);
    for (let i = 0; i < 60; i++) stepBoat(state, { forward: 1, steer: 0, brake: false, nitro: true }, 1 / 60);
    expect(state.nitro.active).toBe(true);
    expect(state.speed).toBeGreaterThan(BOAT.topSpeed + 1);
    for (let i = 0; i < 900; i++) stepBoat(state, { forward: 1, steer: 0, brake: false }, 1 / 60);
    expect(state.speed).toBeCloseTo(BOAT.topSpeed);
  });

  it('runs aground where the water is shallow, and never straddles a weir', () => {
    const lake = () => 10, deep = () => 5, shallow = () => 9.8;
    expect(boatSurface(0, 0, 0, lake, deep)).toBe(10);
    expect(boatSurface(0, 0, 0, lake, shallow)).toBeNull();
    expect(boatSurface(0, 0, 0, (_x: number, z: number) => z < -1 ? 14 : 10, deep)).toBeNull();
    expect(boatSurface(0, 0, 0, (_x: number, z: number) => z < -1 ? null : 10, deep)).toBeNull();
    // A hull touching bottom can always back off or turn away, but never drive further aground.
    expect(boatMoveAllowed(0, 1)).toBe(false);
    expect(boatMoveAllowed(2, 1)).toBe(true);
    expect(boatMoveAllowed(2, 3)).toBe(false);
    // A river sloping gently under the hull still floats it.
    expect(boatSurface(0, 0, 0, (_x: number, z: number) => 10 - z * .05, deep)).toBeCloseTo(10);
  });
});

describe('Peringalkuthu Dam boats', () => {
  it('moor one boat afloat on the reservoir and one in the plunge pool', () => {
    const crest = V2_LAYOUT.riverNodes.find(n => n.id === 'dam-crest')!.position;
    const pool = V2_LAYOUT.riverNodes.find(n => n.id === 'plunge-pool')!.position;
    expect(BOAT_DOCKS[0].level).toBeCloseTo(crest[1], 1);
    expect(BOAT_DOCKS[1].level).toBeCloseTo(pool[1], 1);
    for (const dock of BOAT_DOCKS) expect(boatSurface(dock.x, dock.z, dock.headingRad, waterLevelAt, terrainHeight)).toBeCloseTo(dock.level);
  });

  it('lets the plunge pool boat sail out down the Chalakkudy river', () => {
    // Follow the river's own centreline from the pool's outlet: every sample floats a hull heading downstream.
    const reach = V2_LAYOUT.riverReaches.find(r => r.id === 'malakkappara-river')!;
    for (let i = 1; i < reach.points.length; i++) {
      const a = reach.points[i - 1], b = reach.points[i], heading = Math.atan2(b[0] - a[0], -(b[2] - a[2]));
      for (let t = .1; t < 1; t += .2) expect(boatSurface(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t, heading, waterLevelAt, terrainHeight)).not.toBeNull();
    }
  });

  it('shapes the plunge pool as a round, sunken basin', () => {
    const pool = V2_LAYOUT.riverNodes.find(n => n.id === 'plunge-pool')!.position;
    const cx = pool[0], cz = pool[2] + DAM_POOL_RADIUS;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      // Water fills the circle, and a bank stands just above the surface round its northern half.
      expect(waterLevelAt(cx + Math.cos(a) * DAM_POOL_RADIUS * .8, cz + Math.sin(a) * DAM_POOL_RADIUS * .8)).toBeCloseTo(pool[1], 1);
      if (Math.sin(a) < 0) expect(terrainHeight(cx + Math.cos(a) * (DAM_POOL_RADIUS + 6), cz + Math.sin(a) * (DAM_POOL_RADIUS + 6))).toBeGreaterThan(pool[1]);
    }
    expect(terrainHeight(cx, cz)).toBeLessThan(pool[1] - 2);
  });
});
