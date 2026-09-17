/**
 * Football actions of the local explorer, written by SoccerMatch at physics rate and read by the avatar animator.
 * Events are counters so the animator can notice them without a per-frame React update.
 */
export interface SoccerMotion {
  /** A match is running. */
  active: boolean;
  /** Kick wind-up, 0..1, while the kick button is held. */
  charge: number;
  /** Incremented when a kick is released (whether or not it met the ball). */
  kicks: number;
  /** Charge of the latest kick, 0..1. */
  kickPower: number;
  /** Incremented for each dribble touch. */
  touches: number;
  /** The player is running with the ball. */
  dribbling: boolean;
  /** Incremented when a goal is scored. */
  goals: number;
}

export const soccerMotion: SoccerMotion = { active: false, charge: 0, kicks: 0, kickPower: 0, touches: 0, dribbling: false, goals: 0 };

export function resetSoccerMotion(motion: SoccerMotion = soccerMotion) {
  Object.assign(motion, { active: false, charge: 0, dribbling: false });
}

/** Seconds from a kick's release to the end of its follow-through. */
export const KICK_SWING_SECONDS = .5;
/** Seconds a dribble touch lasts. */
export const TOUCH_SECONDS = .26;
/** Seconds the arms stay raised after a goal. */
export const CELEBRATE_SECONDS = 2.4;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

/**
 * Limb bends (radians about the character's X axis; positive swings a limb backwards) for the kicking leg
 * `t` seconds after release. Returns null once the swing is over.
 */
export function kickSwing(t: number, power: number) {
  if (t < 0 || t >= KICK_SWING_SECONDS) return null;
  const reach = .9 + .6 * clamp01(power);
  const strike = .12, hold = .24;
  // Fast strike from the wind-up, a held follow-through, then a settle back to the stride.
  if (t < strike) { const s = ease(t / strike); return { hip: .7 - (.7 + reach) * s, knee: 1.35 - 1.3 * s }; }
  if (t < hold) return { hip: -reach, knee: .05 };
  const s = ease((t - hold) / (KICK_SWING_SECONDS - hold));
  return { hip: -reach * (1 - s), knee: (.05 + .25 * s) * (1 - s) };
}

/** Wind-up pose for the kicking leg while charging. */
export function kickWindup(charge: number) {
  const c = ease(charge * 1.6);
  return { hip: .7 * c, knee: 1.3 * c };
}

/** A small forward flick of the dribbling foot. */
export function touchPulse(t: number) {
  if (t < 0 || t >= TOUCH_SECONDS) return 0;
  return Math.sin(Math.PI * t / TOUCH_SECONDS);
}
