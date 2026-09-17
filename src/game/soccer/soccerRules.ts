import { STADIUM, stadiumToWorld, worldToStadium } from '../../content/world/stadiumLayout';

/** Arcade football rules. Pure: SoccerMatch owns the ball body and applies these. */
export const BALL_RADIUS = 0.22;
export const BALL_MASS = 0.45;
/** Kick reach from the player's centre, and the dribble "touch" radius. */
export const KICK_REACH = 1.9;
export const DRIBBLE_REACH = 1.1;
/** Seconds of holding K for a full-power kick. */
export const KICK_CHARGE_SECONDS = 0.8;
export const GOAL_RESET_SECONDS = 2.2;
export const OUT_RESET_SECONDS = 1.2;
/** Walking this far off the pad ends the match. */
export const LEAVE_DISTANCE = 18;

export type GoalEnd = 'north' | 'south';
export interface Vec { x: number; y: number; z: number }

/** Forward unit vector for a controller heading (forward = (sin h, −cos h)). */
export function headingForward(headingRad: number): { x: number; z: number } {
  return { x: Math.sin(headingRad), z: -Math.cos(headingRad) };
}

/** Launch velocity for a kick charged 0..1: a firm pass when tapped, a lofted rocket at full power. */
export function kickVelocity(headingRad: number, charge: number, playerVelocity: { x: number; z: number } = { x: 0, z: 0 }): Vec {
  const power = Math.max(0, Math.min(1, charge));
  const f = headingForward(headingRad), speed = 9 + power * 15;
  return { x: f.x * speed + playerVelocity.x * .5, y: 1.2 + power * 5.5, z: f.z * speed + playerVelocity.z * .5 };
}

/** Whether the ball is close enough, and not behind the player, to be kicked. */
export function canKick(player: { x: number; z: number; headingRad: number }, ball: { x: number; z: number }): boolean {
  const dx = ball.x - player.x, dz = ball.z - player.z, distance = Math.hypot(dx, dz);
  if (distance > KICK_REACH) return false;
  if (distance < .35) return true;
  const f = headingForward(player.headingRad);
  return (dx * f.x + dz * f.z) / distance > -.2;
}

/**
 * Keeps a ball the player is running into just ahead of their feet.
 * Returns the ball's new horizontal velocity, or null when the player is not dribbling it.
 */
export function dribbleVelocity(player: { x: number; z: number; headingRad: number; speed: number }, ball: Vec, ballVelocity: Vec): { x: number; z: number } | null {
  if (player.speed < .8 || ball.y > .7) return null;
  const dx = ball.x - player.x, dz = ball.z - player.z, distance = Math.hypot(dx, dz);
  if (distance > DRIBBLE_REACH) return null;
  const f = headingForward(player.headingRad);
  if (distance > .2 && (dx * f.x + dz * f.z) / distance < -.3) return null;
  // Already rolling away faster than the player: leave it.
  if (ballVelocity.x * f.x + ballVelocity.z * f.z > player.speed * 1.6) return null;
  const lead = .75, targetX = player.x + f.x * lead, targetZ = player.z + f.z * lead;
  return { x: f.x * player.speed * 1.08 + (targetX - ball.x) * 6, z: f.z * player.speed * 1.08 + (targetZ - ball.z) * 6 };
}

/** The end whose goal the ball is inside (past the line, between the posts, under the bar). `ballY` is height above the pitch. */
export function goalScored(x: number, ballY: number, z: number): GoalEnd | null {
  const { u, v } = worldToStadium(x, z), { halfLength } = STADIUM.pitch, { halfWidth, height, depth } = STADIUM.goal;
  if (Math.abs(u) > halfWidth - BALL_RADIUS || ballY > height - BALL_RADIUS) return null;
  const past = Math.abs(v) - halfLength;
  if (past < BALL_RADIUS || past > depth + .5) return null;
  // +v is +z, which is south on the north-up map.
  return v > 0 ? 'south' : 'north';
}

/** Out of play: beyond the run-off on any side (and not in a goal). */
export function isOutOfPlay(x: number, z: number): boolean {
  const { u, v } = worldToStadium(x, z), { halfWidth, halfLength } = STADIUM.pitch, r = STADIUM.runoff;
  return Math.abs(u) > halfWidth + r || Math.abs(v) > halfLength + r;
}

/** Where play restarts after the ball went out: back on the pitch next to where it left, a little in from the line. */
export function restartSpot(x: number, z: number): { x: number; z: number } {
  const { u, v } = worldToStadium(x, z), { halfWidth, halfLength } = STADIUM.pitch;
  const clampU = Math.max(-halfWidth + 1.5, Math.min(halfWidth - 1.5, u));
  const clampV = Math.max(-halfLength + 1.5, Math.min(halfLength - 1.5, v));
  // Past a goal line: goal kick from in front of that goal.
  const spotV = Math.abs(v) > halfLength ? Math.sign(v) * (halfLength - 5.5) : clampV;
  const spotU = Math.abs(v) > halfLength ? 0 : clampU;
  return stadiumToWorld(spotU, spotV);
}

export function kickOffSpot(): { x: number; z: number } {
  return stadiumToWorld(0, 0);
}

/** Whether the player has wandered off the football ground. */
export function hasLeftGround(x: number, z: number): boolean {
  const { u, v } = worldToStadium(x, z);
  return Math.abs(u) > STADIUM.pad.halfWidth + LEAVE_DISTANCE || Math.abs(v) > STADIUM.pad.halfLength + LEAVE_DISTANCE;
}
