/**
 * Arcade paraglider. Pure maths only: the browser controller and the multiplayer
 * server both step this, so it must not import Rapier, Three or React.
 */

/** Tuning values; speeds in m/s, rates in rad/s. */
export const GLIDER = {
  cruiseSpeed: 11, diveSpeed: 16, flareSpeed: 7,
  cruiseSink: 1.4, diveSink: 3.5, flareSink: .9,
  /** How quickly airspeed and vertical speed ease toward their targets (m/s²). */
  speedEase: 4, verticalEase: 3,
  turnRate: .9, maxBank: .44,
  launchSpeed: 9, launchHoldSeconds: 1.5,
  /** Touching down faster than this reads as a rough landing. */
  roughLandingSpeed: 13,
  /** Feet this close to the ground count as landed. */
  landClearance: .4,
  /** Ignore ground contact right after launch so the summit lip cannot end the flight. */
  minAirSeconds: .6,
  /** Look this far ahead for the map edge before turning back. */
  edgeLookAhead: 24,
} as const;

export interface GliderState { headingRad: number; speed: number; verticalSpeed: number; bank: number; launchHold: number; airTime: number }
/** `steer` follows the bicycle convention; `pitch` +1 dives, -1 flares; `lift` is thermal lift in m/s. */
export interface GliderIntent { steer: number; pitch: number; lift: number }

export function createGliderState(headingRad: number): GliderState {
  return { headingRad, speed: GLIDER.launchSpeed, verticalSpeed: 0, bank: 0, launchHold: GLIDER.launchHoldSeconds, airTime: 0 };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const approach = (value: number, target: number, amount: number) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

/** One fixed step. Returns the desired translation; the caller applies collision. */
export function stepGlider(state: GliderState, intent: GliderIntent, dt: number): { x: number; y: number; z: number } {
  const steer = clamp(intent.steer, -1, 1), pitch = clamp(intent.pitch, -1, 1);
  const targetSpeed = pitch >= 0 ? GLIDER.cruiseSpeed + (GLIDER.diveSpeed - GLIDER.cruiseSpeed) * pitch : GLIDER.cruiseSpeed + (GLIDER.flareSpeed - GLIDER.cruiseSpeed) * -pitch;
  const targetSink = pitch >= 0 ? GLIDER.cruiseSink + (GLIDER.diveSink - GLIDER.cruiseSink) * pitch : GLIDER.cruiseSink + (GLIDER.flareSink - GLIDER.cruiseSink) * -pitch;
  state.speed = approach(state.speed, targetSpeed, GLIDER.speedEase * dt);
  const targetVertical = state.launchHold > 0 ? 0 : Math.max(0, intent.lift) - targetSink;
  state.launchHold = Math.max(0, state.launchHold - dt);
  state.verticalSpeed = approach(state.verticalSpeed, targetVertical, GLIDER.verticalEase * dt);
  state.headingRad += steer * GLIDER.turnRate * dt;
  state.bank = approach(state.bank, steer * GLIDER.maxBank, 1.6 * dt);
  state.airTime += dt;
  return { x: Math.sin(state.headingRad) * state.speed * dt, y: state.verticalSpeed * dt, z: -Math.cos(state.headingRad) * state.speed * dt };
}

export interface Thermal { id: string; x: number; z: number; radiusM: number; liftMps: number; ceilingY: number }
/** Lift fades out over this many metres below a thermal's ceiling. */
export const THERMAL_CEILING_FADE = 15;

/** Strongest lift at a point: falls off toward the edge and fades out below the ceiling. */
export function liftAt(thermals: readonly Thermal[], x: number, y: number, z: number): number {
  let lift = 0;
  for (const thermal of thermals) {
    const r = Math.hypot(x - thermal.x, z - thermal.z) / thermal.radiusM;
    if (r >= 1) continue;
    const height = clamp((thermal.ceilingY - y) / THERMAL_CEILING_FADE, 0, 1);
    lift = Math.max(lift, thermal.liftMps * (1 - r * r) * height);
  }
  return lift;
}

export type GliderLanding = 'fly' | 'land' | 'rough';
/** `groundY` is null over open water or off the map; contact with scenery still counts via `grounded`. */
export function gliderLanding(state: Pick<GliderState, 'airTime' | 'speed' | 'verticalSpeed'>, feetY: number, groundY: number | null, grounded: boolean): GliderLanding {
  if (state.airTime < GLIDER.minAirSeconds) return 'fly';
  const touching = grounded || (groundY !== null && feetY - groundY < GLIDER.landClearance);
  if (!touching) return 'fly';
  return Math.hypot(state.speed, state.verticalSpeed) > GLIDER.roughLandingSpeed ? 'rough' : 'land';
}

/** Heading that points from (x, z) toward (tx, tz), in the controller's convention. */
export function headingToward(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(tx - x, -(tz - z));
}

/** Turns the heading toward `target` by at most `maxStep` radians. */
export function turnToward(heading: number, target: number, maxStep: number): number {
  const difference = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
  return heading + clamp(difference, -maxStep, maxStep);
}
