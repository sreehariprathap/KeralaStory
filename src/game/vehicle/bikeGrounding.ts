import { QueryFilterFlags, Ray, type World } from '@dimforge/rapier3d-compat';

const PROBE_ABOVE = 1.2;
const PROBE_LENGTH = 3;
const MAX_OFFSET = .6;

export interface BikeTilt { pitch: number; offset: number }

function groundAt(world: World, x: number, y: number, z: number): number | null {
  const hit = world.castRay(new Ray({ x, y: y + PROBE_ABOVE, z }, { x: 0, y: -1, z: 0 }), PROBE_LENGTH, true,
    QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined,
    // Ignore the rider/bike body and parked cars; only static ground should carry the tyres.
    collider => !collider.parent()?.isDynamic() && !collider.parent()?.isKinematic());
  return hit ? y + PROBE_ABOVE - hit.timeOfImpact : null;
}

/**
 * The bike collider only yaws, so on slopes it rests on one corner. Sample the ground under both
 * tyre contacts and return the pitch (rotation.x, nose-up negative) and vertical shift that put
 * both tyres on the surface. `heading` follows the motor convention: forward = (sin h, 0, -cos h).
 */
export function measureBikeTilt(world: World, x: number, feetY: number, z: number, heading: number, halfWheelbase: number): BikeTilt | null {
  const fx = Math.sin(heading) * halfWheelbase, fz = -Math.cos(heading) * halfWheelbase;
  const front = groundAt(world, x + fx, feetY, z + fz), rear = groundAt(world, x - fx, feetY, z - fz);
  if (front === null || rear === null) return null;
  return {
    pitch: -Math.atan2(front - rear, 2 * halfWheelbase),
    offset: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, (front + rear) / 2 - feetY)),
  };
}
