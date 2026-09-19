/**
 * Arcade biplane. Pure flight model: the controller owns the body, collision queries and the crash sequence.
 *
 * On the ground W opens the throttle and the plane rolls; past `takeoffSpeed` it lifts off by itself and
 * climbs away while W stays held.
 * In the air W pushes the nose down and S pulls it up, A/D bank (a banked wing turns the plane), SHIFT
 * opens the throttle to full and SPACE throttles back. With nothing held the engine settles to cruise.
 */
export const PLANE = {
  /** Level top speed at full throttle (m/s). */
  maxSpeed: 64,
  thrust: 17,
  /** Below this the wing stops flying: the nose drops and the plane sinks. */
  stallSpeed: 21,
  takeoffSpeed: 27,
  cruiseThrottle: .72,
  slowThrottle: .3,
  gravity: 20,
  /** Share of gravity that trades against airspeed on climbs and dives. */
  climbCost: .55,
  maxBank: 1.05,
  rollRate: 2.2,
  pitchRate: .95,
  maxPitch: 1.05,
  /** Rudder yaw on top of the banked turn, so A/D answer immediately. */
  rudder: .25,
  groundSteer: .7,
  rollingDrag: 1.2,
  groundBrake: 12,
  /** Wheels-to-origin height while rolling. */
  gearHeight: .1,
  /** Touchdown limits: steeper, faster or more banked than these is a crash. */
  landing: { maxBank: .4, minPitch: -.25, maxPitch: .45, maxSink: 9, maxSpeed: 46 },
  /** Hard ceiling above sea level; the nose is pushed down approaching it. */
  ceiling: 460,
} as const;

export interface PlaneState {
  x: number; y: number; z: number;
  headingRad: number; pitch: number; roll: number;
  speed: number; throttle: number; verticalSpeed: number;
  grounded: boolean; airTime: number;
  /** False from lift-off until W is let go: the W held for the take-off roll never becomes a dive. */
  pitchArmed: boolean;
}

export interface PlaneIntent {
  /** W = +1 (throttle up on the ground, nose down in the air), S = −1. */
  forward: number;
  /** D = +1 banks and turns right. */
  steer: number;
  boost: boolean;
  slow: boolean;
}

export function createPlaneState(x: number, y: number, z: number, headingRad: number): PlaneState {
  return { x, y, z, headingRad, pitch: 0, roll: 0, speed: 0, throttle: 0, verticalSpeed: 0, grounded: true, airTime: 0, pitchArmed: false };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const approach = (value: number, target: number, amount: number) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
const DRAG = PLANE.thrust / (PLANE.maxSpeed * PLANE.maxSpeed);

/** One step of the flight model; returns the world-space move the plane wants to make. */
export function stepPlane(state: PlaneState, intent: PlaneIntent, dt: number): { x: number; y: number; z: number } {
  const rawForward = clamp(intent.forward, -1, 1), steer = clamp(intent.steer, -1, 1);
  if (state.grounded) {
    const forward = rawForward, throttle = forward > 0 ? forward : 0;
    state.throttle = approach(state.throttle, throttle, 1.5 * dt);
    state.roll = approach(state.roll, 0, 2 * dt);
    state.pitch = approach(state.pitch, 0, 1 * dt);
    const brake = forward < 0 ? PLANE.groundBrake : forward === 0 ? PLANE.rollingDrag * 2 : PLANE.rollingDrag;
    state.speed = Math.max(0, state.speed + (PLANE.thrust * state.throttle - DRAG * state.speed * state.speed) * dt);
    state.speed = approach(state.speed, 0, brake * dt * (state.throttle > .05 && forward > 0 ? .2 : 1));
    state.headingRad += steer * PLANE.groundSteer * Math.min(1, state.speed / 6) * dt;
    state.verticalSpeed = 0;
    // Rotate and lift off once there is flying speed under the wings.
    if (state.speed >= PLANE.takeoffSpeed && forward > 0) {
      state.grounded = false; state.airTime = 0; state.pitch = .18; state.verticalSpeed = 2; state.pitchArmed = false;
    }
    return { x: Math.sin(state.headingRad) * state.speed * dt, y: 0, z: -Math.cos(state.headingRad) * state.speed * dt };
  }
  state.airTime += dt;
  // Climb-out: the W still held from the take-off roll keeps the plane climbing gently instead of dipping the
  // nose, until the pilot lets go of it once.
  if (rawForward <= 0) state.pitchArmed = true;
  let forward = rawForward;
  if (!state.pitchArmed && forward > 0) { forward = 0; state.pitch = approach(state.pitch, .22, .5 * dt); }
  const target = intent.boost ? 1 : intent.slow ? PLANE.slowThrottle : PLANE.cruiseThrottle;
  state.throttle = approach(state.throttle, target, .8 * dt);
  // Bank toward the stick; with it released the wings roll level.
  state.roll = approach(state.roll, steer * PLANE.maxBank, PLANE.rollRate * dt);
  // W noses down, S pulls up. In a steep bank the elevator pulls round the turn more than up.
  const elevator = -forward * PLANE.pitchRate * dt;
  state.pitch = clamp(state.pitch + elevator * Math.cos(state.roll), -PLANE.maxPitch, PLANE.maxPitch);
  // Near the ceiling the air is too thin to climb.
  if (state.y > PLANE.ceiling - 40 && state.pitch > 0) state.pitch = approach(state.pitch, 0, .8 * dt);
  const stall = clamp((PLANE.stallSpeed - state.speed) / PLANE.stallSpeed, 0, 1);
  if (stall > 0) state.pitch = approach(state.pitch, -.6, (.6 + 1.6 * stall) * dt);
  const lift = Math.max(state.speed, 18);
  state.headingRad += (PLANE.gravity * Math.tan(state.roll) / lift + steer * PLANE.rudder) * dt;
  const accel = PLANE.thrust * state.throttle - DRAG * state.speed * state.speed - PLANE.gravity * PLANE.climbCost * Math.sin(state.pitch);
  state.speed = clamp(state.speed + accel * dt, 0, PLANE.maxSpeed * 1.35);
  const horizontal = Math.cos(state.pitch) * state.speed;
  // A stalled wing mushes downward regardless of where the nose points.
  state.verticalSpeed = Math.sin(state.pitch) * state.speed - stall * 12;
  return { x: Math.sin(state.headingRad) * horizontal * dt, y: state.verticalSpeed * dt, z: -Math.cos(state.headingRad) * horizontal * dt };
}

/** What happens when the wheels meet the ground from the air: a landing, or a crash. */
export function touchdown(state: PlaneState): 'land' | 'crash' {
  const l = PLANE.landing;
  const gentle = Math.abs(state.roll) <= l.maxBank && state.pitch >= l.minPitch && state.pitch <= l.maxPitch && state.verticalSpeed >= -l.maxSink && state.speed <= l.maxSpeed;
  return gentle ? 'land' : 'crash';
}
