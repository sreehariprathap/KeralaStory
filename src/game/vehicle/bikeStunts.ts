const FLIP_RATE = 5.5;
const SPIN_RATE = 6.5;
const FLIP_TOLERANCE = .7;
const SPIN_TOLERANCE = .75;
/** Shorter hops than this are just bumps: no callout, but a crooked landing still wipes out. */
const TRICK_AIRTIME = .35;
const BIG_AIR_TIME = 1.1;
const TAU = Math.PI * 2;

export interface StuntState {
  airborne: boolean;
  airTime: number;
  /** Visual pitch in radians; positive tips the nose down (front flip), negative is a backflip. */
  pitch: number;
  /** Visual yaw spin in radians; the travel direction is unchanged. */
  spin: number;
  /** Keys held at takeoff (e.g. W for throttle) only trigger tricks after being released once. */
  flipArmed: boolean;
  spinArmed: boolean;
}
export type LandingResult = { kind: 'clean' | 'wipeout'; label: string };

export function createStuntState(): StuntState {
  return { airborne: false, airTime: 0, pitch: 0, spin: 0, flipArmed: false, spinArmed: false };
}

/** `flip` +1 = front flip (W), -1 = backflip (S); `spin` +1 = spin right (D). */
export function stepStuntAir(state: StuntState, input: { flip: number; spin: number }, dt: number) {
  state.airborne = true;
  state.airTime += dt;
  if (Math.abs(input.flip) < .2) state.flipArmed = true;
  if (Math.abs(input.spin) < .2) state.spinArmed = true;
  if (state.flipArmed) state.pitch += Math.max(-1, Math.min(1, input.flip)) * FLIP_RATE * dt;
  if (state.spinArmed) state.spin -= Math.max(-1, Math.min(1, input.spin)) * SPIN_RATE * dt;
}

const residual = (angle: number) => angle - Math.round(angle / TAU) * TAU;

function trickLabel(state: StuntState) {
  const flips = Math.round(Math.abs(state.pitch) / TAU), spins = Math.round(Math.abs(state.spin) / TAU);
  const parts: string[] = [];
  if (flips) parts.push(`${flips > 1 ? `${flips}× ` : ''}${state.pitch < 0 ? 'Backflip' : 'Front flip'}`);
  if (spins) parts.push(`${spins * 360}`);
  if (parts.length) return `${parts.join(' + ')}!`;
  return state.airTime >= BIG_AIR_TIME ? 'Big air!' : '';
}

/** Call on touchdown. A landing counts if the bike comes down within tolerance of level and forward. */
export function landStunt(state: StuntState): LandingResult | null {
  if (!state.airborne) return null;
  const clean = Math.abs(residual(state.pitch)) <= FLIP_TOLERANCE && Math.abs(residual(state.spin)) <= SPIN_TOLERANCE;
  const label = state.airTime >= TRICK_AIRTIME ? trickLabel(state) : '';
  Object.assign(state, createStuntState());
  return clean ? { kind: 'clean', label } : { kind: 'wipeout', label: 'Wipeout! Land with the bike level and facing forward.' };
}

export function wrapAngle(angle: number) {
  return residual(angle);
}
