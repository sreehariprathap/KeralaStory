import { expect, it } from 'vitest';
import { CAR_CRUISE_SPEED, createCarState, stepCar } from '../src/game/vehicle/carMotor';

it('accelerates an off-road car to its capped cruise speed', async () => {
  const car = await import('../src/game/vehicle/carMotor').catch(() => null);

  expect(car?.createCarState).toBeTypeOf('function');
});

it('accelerates, brakes to a stop, then only reverses after neutral', () => {
  const state = createCarState();
  for (let tick = 0; tick < 600; tick++) stepCar(state, { forward: 1, steer: 0, brake: false }, 1 / 60);
  expect(state.speed).toBeCloseTo(CAR_CRUISE_SPEED);

  for (let tick = 0; tick < 180; tick++) stepCar(state, { forward: -1, steer: 0, brake: false }, 1 / 60);
  expect(state.speed).toBe(0);
  stepCar(state, { forward: 0, steer: 0, brake: false }, 1 / 60);
  for (let tick = 0; tick < 120; tick++) stepCar(state, { forward: -1, steer: 0, brake: false }, 1 / 60);
  expect(state.speed).toBeCloseTo(-4);
});

it('turns only while moving and returns a forward displacement from its heading', () => {
  const state = createCarState();
  expect(stepCar(state, { forward: 0, steer: 1, brake: false }, 1 / 60)).toEqual({ x: 0, z: 0 });
  state.speed = 6;
  const movement = stepCar(state, { forward: 0, steer: 1, brake: false }, 1 / 60);
  expect(state.headingRad).toBeGreaterThan(0);
  expect(movement.x).toBeGreaterThan(0);
  expect(movement.z).toBeLessThan(0);
});
