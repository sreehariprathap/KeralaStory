import { SLICE_BOUNDS } from '../../content/world/kodassery';

export const CAPSULE_RADIUS = 0.26;
export const CAPSULE_HALF_HEIGHT = 0.58;
export const FEET_TO_CENTER = CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT;
export const WALK_SPEED = 3.1;
export const RUN_SPEED = 5.7;
export const GRAVITY = -22;
export const JUMP_SPEED = 7.0;

export function needsSafeReset(position: { x: number; y: number; z: number }): boolean {
  return !Number.isFinite(position.x + position.y + position.z) || position.y < 45
    || position.x < SLICE_BOUNDS.xMin || position.x > SLICE_BOUNDS.xMax
    || position.z < SLICE_BOUNDS.zMin || position.z > SLICE_BOUNDS.zMax;
}

export function dampAngle(current: number, target: number, factor: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * factor;
}
