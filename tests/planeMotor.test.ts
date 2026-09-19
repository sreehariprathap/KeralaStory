import { describe, expect, it } from 'vitest';
import { PLANE, createPlaneState, stepPlane, touchdown, type PlaneIntent } from '../src/game/vehicle/planeMotor';
import { PLANE_SPAWN, checkpointsByDistance } from '../src/content/world/planeSites';
import { NEDUMBASSERY_AIRPORT_PLAN } from '../src/content/world/airportPlan';

const DT = 1 / 60;
const idle: PlaneIntent = { forward: 0, steer: 0, boost: false, slow: false };
function fly(state = createPlaneState(0, 0, 0, Math.PI / 2), intent: Partial<PlaneIntent> = {}, seconds = 1) {
  for (let i = 0; i < seconds * 60; i++) {
    const move = stepPlane(state, { ...idle, ...intent }, DT);
    state.x += move.x; state.y += move.y; state.z += move.z;
    if (state.grounded) state.y = 0;
  }
  return state;
}

describe('biplane flight model', () => {
  it('rolls down the runway on W and lifts off by itself within its length', () => {
    const plane = createPlaneState(0, 0, 0, Math.PI / 2);
    let seconds = 0;
    while (plane.grounded && seconds < 20) { fly(plane, { forward: 1 }, .1); seconds += .1; }
    expect(plane.grounded).toBe(false);
    // Heading π/2 rolls toward +x; the take-off run fits well inside Nedumbassery's runway.
    const runway = NEDUMBASSERY_AIRPORT_PLAN.runway;
    expect(plane.x).toBeGreaterThan(20);
    expect(plane.x).toBeLessThan(runway.xMax - runway.xMin - 60);
    // Still holding W from the roll, it keeps climbing instead of nosing into the ground.
    fly(plane, { forward: 1 }, 8);
    expect(plane.y).toBeGreaterThan(30);
    expect(plane.pitch).toBeGreaterThan(0);
    // Once W has been released, it pushes the nose down as normal.
    fly(plane, {}, .1);
    fly(plane, { forward: 1 }, 1);
    expect(plane.pitch).toBeLessThan(0);
  });

  it('climbs on S, dives on W, and turns toward the banked wing', () => {
    const climbing = fly({ ...createPlaneState(0, 100, 0, 0), grounded: false, speed: 45, airTime: 10, pitchArmed: true }, { forward: -1 }, 1.5);
    expect(climbing.pitch).toBeGreaterThan(.5);
    const diving = fly({ ...createPlaneState(0, 100, 0, 0), grounded: false, speed: 45, airTime: 10, pitchArmed: true }, { forward: 1 }, 1.5);
    expect(diving.pitch).toBeLessThan(-.5);
    const turning = fly({ ...createPlaneState(0, 100, 0, 0), grounded: false, speed: 45, airTime: 10, pitchArmed: true }, { steer: 1 }, 2);
    expect(turning.roll).toBeGreaterThan(.8);
    expect(turning.headingRad).toBeGreaterThan(.5);
  });

  it('stalls when too slow: the nose drops and the plane sinks', () => {
    const plane = fly({ ...createPlaneState(0, 200, 0, 0), grounded: false, speed: 10, pitch: .3, airTime: 10 }, { slow: true }, 2);
    expect(plane.pitch).toBeLessThan(0);
    expect(plane.y).toBeLessThan(200);
  });

  it('boosts past cruise speed on SHIFT', () => {
    const cruise = fly({ ...createPlaneState(0, 200, 0, 0), grounded: false, speed: 40, airTime: 10 }, {}, 20);
    const boosted = fly({ ...createPlaneState(0, 200, 0, 0), grounded: false, speed: 40, airTime: 10 }, { boost: true }, 20);
    expect(boosted.speed).toBeGreaterThan(cruise.speed + 5);
    expect(boosted.speed).toBeLessThanOrEqual(PLANE.maxSpeed + .5);
  });

  it('lands a gentle approach and crashes a steep, banked or fast one', () => {
    const base = { ...createPlaneState(0, 0, 0, 0), grounded: false, speed: 30, pitch: .05, roll: 0, verticalSpeed: -3 };
    expect(touchdown(base)).toBe('land');
    expect(touchdown({ ...base, pitch: -.6, verticalSpeed: -25 })).toBe('crash');
    expect(touchdown({ ...base, roll: .9 })).toBe('crash');
    expect(touchdown({ ...base, speed: 60 })).toBe('crash');
  });

  it('parks on the airport runway and respawns crashed pilots at the nearest checkpoint', () => {
    const runway = NEDUMBASSERY_AIRPORT_PLAN.runway;
    expect(PLANE_SPAWN.x).toBeGreaterThan(runway.xMin);
    expect(PLANE_SPAWN.z).toBe(runway.z);
    const [nearest, next] = checkpointsByDistance(-100, 0);
    expect(Math.hypot(nearest[0] + 100, nearest[2])).toBeLessThanOrEqual(Math.hypot(next[0] + 100, next[2]));
  });
});
