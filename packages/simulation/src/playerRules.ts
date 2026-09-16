export const PLAYER_RADIUS = .26;
export const PLAYER_HALF_HEIGHT = .58;
export const PLAYER_CENTER_HEIGHT = PLAYER_RADIUS + PLAYER_HALF_HEIGHT;
export const WALK_SPEED = 3.1;
export const GRAVITY = -22;
export const JUMP_SPEED = 7;
export const INPUT_TIMEOUT_TICKS = 30;
export function walkingVelocity(x: number, z: number) {
  const length = Math.max(1, Math.hypot(x, z));
  return { x: x / length * WALK_SPEED, z: z / length * WALK_SPEED };
}
