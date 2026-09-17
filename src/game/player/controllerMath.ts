import { hasGroundAt, terrainHeight, walkableDeckHeight } from '../../content/world/kodassery';

export const PHYSICS_STEP_SECONDS = 1 / 60;
export const CAPSULE_RADIUS = 0.26;
export const CAPSULE_HALF_HEIGHT = 0.58;
export const FEET_TO_CENTER = CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT;
export const WALK_SPEED = 3.1;
export const RUN_SPEED = 5.7;
export const GRAVITY = -22;
export const JUMP_SPEED = 7.0;

/** Input is the physics capsule center, not the rendered feet or saved position. */
export function needsSafeReset(position: { x: number; y: number; z: number }): boolean {
  const { x, y, z } = position;
  if (![x, y, z].every(Number.isFinite)) return true;
  const deckY = walkableDeckHeight(x,z);
  if (!hasGroundAt(x,z)) {
    // Only the authored pier footprint extends beyond terrain bounds. Recovery
    // also checks elevation so falling beneath the pier cannot become a refuge.
    return deckY === null || y - FEET_TO_CENTER < deckY - 0.1;
  }
  // Recover only after the entire capsule has fallen below local ground. This
  // leaves contact/mesh interpolation room and accepts elevated platforms.
  if (y + FEET_TO_CENTER < terrainHeight(x, z)) return true;
  // Open water is swimmable; only falling below the terrain (or off the map) needs recovery.
  return false;
}

export function dampAngle(current: number, target: number, factor: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * factor;
}
