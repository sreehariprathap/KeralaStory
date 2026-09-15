export const CAR_CRUISE_SPEED = 14;

export interface CarMotorState {
  speed: number;
  headingRad: number;
  reverseArmed: boolean;
}

export interface CarIntent {
  forward: number;
  steer: number;
  brake: boolean;
}

export function createCarState(headingRad = 0): CarMotorState {
  return { speed: 0, headingRad, reverseArmed: true };
}

function approach(value: number, target: number, amount: number) {
  return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
}

/** Fixed-step arcade motor. Collision resolution stays with the vehicle controller. */
export function stepCar(state: CarMotorState, intent: CarIntent, dt: number) {
  const forward = Math.max(-1, Math.min(1, intent.forward));
  const steer = Math.max(-1, Math.min(1, intent.steer));
  if (intent.brake) {
    state.speed = approach(state.speed, 0, 11 * dt);
    state.reverseArmed = false;
  } else if (forward > 0) {
    state.speed = approach(state.speed, CAR_CRUISE_SPEED * forward, 4 * dt);
    state.reverseArmed = false;
  } else if (forward < 0) {
    if (state.speed > 0) {
      state.speed = approach(state.speed, 0, 11 * dt);
      state.reverseArmed = false;
    } else if (state.reverseArmed) state.speed = approach(state.speed, -4 * Math.abs(forward), 2.5 * dt);
  } else {
    state.speed = approach(state.speed, 0, 1.6 * dt);
    if (Math.abs(state.speed) < 0.01) state.reverseArmed = true;
  }
  const turn = Math.min(1, Math.abs(state.speed) / 2) * (1.25 - 0.55 * Math.min(1, Math.abs(state.speed) / CAR_CRUISE_SPEED));
  state.headingRad += steer * turn * dt * (state.speed < 0 ? -1 : 1);
  if (state.speed === 0) return { x: 0, z: 0 };
  return { x: Math.sin(state.headingRad) * state.speed * dt, z: -Math.cos(state.headingRad) * state.speed * dt };
}
