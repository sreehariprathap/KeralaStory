import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { computeExplorerMovement, createExplorerMotor } from '../src/game/player/characterMotor';
import type { MotorIntent, MotorState } from '../src/game/player/characterMotor';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, RUN_SPEED, WALK_SPEED } from '../src/game/player/controllerMath';

const DT = 1 / 60;
const ELEVATION = 76;
const worlds: RAPIER.World[] = [];

beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });

function createFixture() {
  const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
  worlds.push(world);
  world.timestep = DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, ELEVATION - 0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, ELEVATION + FEET_TO_CENTER + 0.06, 0));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), body);
  const motor = createExplorerMotor(world);
  const state: MotorState = { grounded: false, verticalSpeed: 0 };
  world.step(); // Publish static colliders to the broad-phase before querying them.
  const step = (intent: Partial<MotorIntent> = {}) => {
    const move = computeExplorerMovement(motor, collider, state, { xVelocity: 0, zVelocity: 0, jump: false, ...intent }, DT);
    const position = body.translation();
    body.setNextKinematicTranslation({ x: position.x + move.x, y: position.y + move.y, z: position.z + move.z });
    world.step();
    const next = body.translation();
    return { x: next.x, y: next.y - FEET_TO_CENTER, z: next.z, grounded: state.grounded };
  };
  for (let frame = 0; frame < 12; frame++) step();
  return { world, body, motor, state, step };
}

describe('real Rapier explorer integration at a fixed 60 Hz step', () => {
  it('settles on elevated ground and runs the authored distance for held movement', () => {
    const fixture = createFixture();
    expect(fixture.state.grounded).toBe(true);
    let position = fixture.step();
    expect(position.y).toBeCloseTo(ELEVATION + 0.025, 2);
    for (let frame = 0; frame < 120; frame++) position = fixture.step({ zVelocity: RUN_SPEED });
    // Measured 11.3799715 m: contact correction loses 2.003 cm over 120 steps.
    // Bound total distance error by the actual 2.5 cm controller contact gap.
    // Lateral/vertical corrections are 5.442/11.503 mm. The combined 3D
    // error is 23.729 mm, still below one controller contact gap.
    expect(Math.hypot(position.x, position.z - RUN_SPEED * 2, position.y - ELEVATION - fixture.motor.offset()))
      .toBeLessThan(fixture.motor.offset());
    expect(position.grounded).toBe(true);
  });

  it('stops before a solid wall without tunneling while run stays held', () => {
    const fixture = createFixture();
    fixture.world.createCollider(RAPIER.ColliderDesc.cuboid(3, 2, 0.2).setTranslation(0, ELEVATION + 2, 3));
    fixture.world.step();
    let position = fixture.step();
    for (let frame = 0; frame < 180; frame++) position = fixture.step({ zVelocity: RUN_SPEED });
    const wallSurface = 2.8;
    expect(position.z).toBeGreaterThan(2.45);
    expect(position.z + CAPSULE_RADIUS).toBeLessThan(wallSurface);
    const stoppedZ = position.z;
    for (let frame = 0; frame < 60; frame++) position = fixture.step({ zVelocity: RUN_SPEED });
    expect(position.z).toBeCloseTo(stoppedZ, 3);
    expect(position.grounded).toBe(true);
  });

  it('automatically climbs a 22 cm step and stays grounded across its landing', () => {
    const fixture = createFixture();
    fixture.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.11, 2).setTranslation(0, ELEVATION + 0.11, 4));
    fixture.world.step();
    let position = fixture.step();
    for (let frame = 0; frame < 75; frame++) position = fixture.step({ zVelocity: WALK_SPEED });
    expect(position.z).toBeGreaterThan(3.5);
    expect(position.y).toBeCloseTo(ELEVATION + 0.22 + 0.025, 2);
    expect(position.grounded).toBe(true);
  });

  it('walks up a triangle-mesh slope onto a bridge 2.5 m above the ground', () => {
    const fixture = createFixture();
    const vertices = new Float32Array([-3,ELEVATION,2, 3,ELEVATION,2, -3,ELEVATION+2.5,10, 3,ELEVATION+2.5,10]);
    fixture.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, new Uint32Array([0,2,1, 1,2,3])));
    fixture.world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.15, 4).setTranslation(0, ELEVATION + 2.35, 14));
    fixture.world.step();
    let position = fixture.step();
    let rampStartZ = 0;
    let rampEndZ = 0;
    for (let frame = 0; frame < 300; frame++) {
      position = fixture.step({ zVelocity: WALK_SPEED });
      if (frame === 119) rampStartZ = position.z;
      if (frame === 179) rampEndZ = position.z;
      if (frame >= 60) expect(position.grounded).toBe(true);
    }
    // On the 2.5/8 slope, Rapier projects (walk, -2 m/s grounded pull)
    // onto the surface: dz/dt = (3.1 - 2*slope)/(1+slope²) = 2.2548.
    // Measured one-second progression is 2.2553 m; two contact gaps allow
    // entry/exit numerical correction without masking a blocked ramp.
    const slope = 2.5 / 8;
    const slopeSpeed = (WALK_SPEED - 2 * slope) / (1 + slope * slope);
    expect(Math.abs(rampEndZ - rampStartZ - slopeSpeed)).toBeLessThan(2 * fixture.motor.offset());
    // The deck begins at z=10. Require the whole capsule past that seam,
    // correct elevated feet height, and grounded contact before continuing.
    expect(position.z - CAPSULE_RADIUS).toBeGreaterThan(10);
    expect(position.y).toBeCloseTo(ELEVATION + 2.5 + 0.025, 2);
    expect(position.grounded).toBe(true);
    const deckStart = position.z;
    for (let frame = 0; frame < 30; frame++) {
      position = fixture.step({ zVelocity: WALK_SPEED });
      expect(position.grounded).toBe(true);
      expect(Math.abs(position.y - (ELEVATION + 2.5))).toBeLessThan(2 * fixture.motor.offset());
    }
    expect(position.z).toBeGreaterThan(13);
    expect(position.z).toBeLessThan(18);
    expect(Math.abs(position.z - deckStart - WALK_SPEED * 0.5)).toBeLessThan(fixture.motor.offset());
  });

  it('jumps, ignores a second midair jump request, and lands at the same feet height', () => {
    const fixture = createFixture();
    const comparison = createFixture();
    let highest = ELEVATION;
    let sawAirborne = false;
    let position = fixture.step({ jump: true });
    comparison.step({ jump: true });
    for (let frame = 0; frame < 100; frame++) {
      position = fixture.step({ jump: frame === 10 });
      const expected = comparison.step();
      expect(position.y).toBeCloseTo(expected.y, 4);
      highest = Math.max(highest, position.y);
      sawAirborne ||= !position.grounded;
    }
    expect(sawAirborne).toBe(true);
    expect(highest - ELEVATION).toBeGreaterThan(0.9);
    expect(highest - ELEVATION).toBeLessThan(1.2);
    expect(position.grounded).toBe(true);
    expect(position.y).toBeCloseTo(ELEVATION + 0.025, 2);
  });

  it('cancels upward velocity at a low ceiling and returns to the ground', () => {
    const fixture = createFixture();
    fixture.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, ELEVATION + 2.1, 0));
    fixture.world.step();
    let position = fixture.step({ jump: true });
    let highest = position.y;
    for (let frame = 0; frame < 100; frame++) {
      position = fixture.step();
      highest = Math.max(highest, position.y);
    }
    expect(highest + FEET_TO_CENTER * 2).toBeLessThan(ELEVATION + 2);
    expect(position.grounded).toBe(true);
    expect(position.y).toBeCloseTo(ELEVATION + 0.025, 2);
  });
});
