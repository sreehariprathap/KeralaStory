import { createNitroState, stepNitro, type NitroState } from './carNitro';

/** Arcade launch: pure motor and hull checks. The controller owns the body and collision. */
export const BOAT = {
  topSpeed: 11,
  reverseSpeed: 3,
  acceleration: 4,
  /** Extra top speed while the nitrous burns. */
  nitroSpeed: 8,
  brake: 4,
  /** Water drag with no throttle, so a released boat glides to a stop. */
  drag: .8,
  turnRate: 1.1,
  /** Hull half extents (m): half beam and half length. */
  halfBeam: .85,
  halfLength: 2.1,
  /** Shallower than this under any hull point runs the boat aground. */
  minDepth: .5,
  /** Hull points may sit on water this far above or below the centre (a river's slope), but not a weir or waterfall. */
  levelTolerance: .6,
  /** Share of the river's current that carries the hull along. */
  drift: .8,
  /** Walking distance at which F boards a moored boat. */
  mountDistance: 6,
} as const;

export interface BoatState { x: number; z: number; headingRad: number; speed: number; level: number; nitro: NitroState }

export interface BoatIntent { forward: number; steer: number; brake: boolean; nitro?: boolean }

export function createBoatState(x: number, z: number, headingRad: number, level: number): BoatState {
  return { x, z, headingRad, speed: 0, level, nitro: createNitroState() };
}

const approach = (value: number, target: number, amount: number) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

/** Advances speed and heading one step; returns the horizontal move the hull wants to make. */
export function stepBoat(state: BoatState, intent: BoatIntent, dt: number): { x: number; z: number } {
  const forward = Math.max(-1, Math.min(1, intent.forward)), steer = Math.max(-1, Math.min(1, intent.steer));
  stepNitro(state.nitro, intent.nitro === true && forward > 0 && !intent.brake, dt);
  const top = BOAT.topSpeed + (state.nitro.active ? BOAT.nitroSpeed : 0);
  if (intent.brake) state.speed = approach(state.speed, 0, BOAT.brake * dt);
  else if (forward > 0) state.speed = approach(state.speed, top * forward, (state.speed > top ? BOAT.drag * 2 : BOAT.acceleration * state.nitro.multiplier) * dt);
  else if (forward < 0) state.speed = approach(state.speed, -BOAT.reverseSpeed * -forward, (state.speed > 0 ? BOAT.brake : BOAT.acceleration) * dt);
  else state.speed = approach(state.speed, 0, BOAT.drag * dt);
  // A rudder only bites with water flowing past it, but a paddle still turns a boat that is nearly still.
  const bite = (.35 + .65 * Math.min(1, Math.abs(state.speed) / 2)) * (1 - .35 * Math.min(1, Math.abs(state.speed) / (BOAT.topSpeed + BOAT.nitroSpeed)));
  state.headingRad += steer * BOAT.turnRate * bite * dt * (state.speed < -.05 ? -1 : 1);
  return { x: Math.sin(state.headingRad) * state.speed * dt, z: -Math.cos(state.headingRad) * state.speed * dt };
}

/** Hull sample points (centre, bow, stern and both beams) for a boat at (x, z). */
export function hullPoints(x: number, z: number, headingRad: number): [number, number][] {
  const fx = Math.sin(headingRad), fz = -Math.cos(headingRad), rx = -fz, rz = fx;
  return [[0, 0], [0, BOAT.halfLength], [0, -BOAT.halfLength], [BOAT.halfBeam, 0], [-BOAT.halfBeam, 0], [BOAT.halfBeam, BOAT.halfLength * .7], [-BOAT.halfBeam, BOAT.halfLength * .7]]
    .map(([r, f]) => [x + rx * r + fx * f, z + rz * r + fz * f]);
}

/**
 * Water surface under the hull's centre when every hull point floats on connected water (a lake, or a river
 * sloping gently under it) with enough depth; null when the hull would ground, or straddle a weir or waterfall.
 */
export function boatSurface(x: number, z: number, headingRad: number, waterLevelAt: (x: number, z: number) => number | null, groundAt: (x: number, z: number) => number): number | null {
  return groundedPoints(x, z, headingRad, waterLevelAt, groundAt) === 0 ? waterLevelAt(x, z) : null;
}

/** How many hull points are aground (or off the water body); a centre off the water counts as all of them. */
export function groundedPoints(x: number, z: number, headingRad: number, waterLevelAt: (x: number, z: number) => number | null, groundAt: (x: number, z: number) => number): number {
  const points = hullPoints(x, z, headingRad), centre = waterLevelAt(x, z);
  if (centre === null) return points.length;
  return points.filter(([px, pz]) => {
    const surface = waterLevelAt(px, pz);
    return surface === null || Math.abs(surface - centre) > BOAT.levelTolerance || groundAt(px, pz) > surface - BOAT.minDepth;
  }).length;
}

/** A move (or turn) is allowed if the hull ends fully afloat, or, already touching bottom, no more aground than before. */
export function boatMoveAllowed(from: number, to: number): boolean {
  return to === 0 || (from > 0 && to <= from);
}
