import { Capsule, Cuboid, QueryFilterFlags, Ray } from '@dimforge/rapier3d-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../../contracts';
import { isWater, walkableDeckHeight } from '../../content/world/definition';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, needsSafeReset } from '../player/controllerMath';

const SUPPORT_REACH = 0.75;
const CONTACT_GAP = 0.06;
const MIN_GROUND_NORMAL_Y = Math.cos(Math.PI / 4);

/**
 * Resolve a nearby supported feet position for the exact runtime collider.
 * Call after collision readiness; heading is the target parked/rider heading.
 * This checks destination clearance, not a swept rotation or dismount path.
 */
export function resolveClearFeet(world: World, excludeBody: RigidBody | null | undefined, x: number, z: number, nearY: number, ride: boolean, heading: number): Vec3 | null {
  if (![x,z,nearY,heading].every(Number.isFinite)) return null;
  const angle = ride ? Math.PI - heading : 0;
  const rotation = {x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)};
  const shape = ride ? new Cuboid(.38,FEET_TO_CENTER,.95) : new Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS);
  // A center-only ray can accept a bike straddling a ledge. Probe its four
  // corners too, with the same heading used by the collider. Foot cardinal
  // probes conservatively require the whole capsule base to be supported.
  const samples = ride
    ? [[0,0],[-.38,-.95],[-.38,.95],[.38,-.95],[.38,.95]]
    : [[0,0],[-CAPSULE_RADIUS,0],[CAPSULE_RADIUS,0],[0,-CAPSULE_RADIUS],[0,CAPSULE_RADIUS]];
  let highest = -Infinity;
  for (const [localX,localZ] of samples) {
    const px=x+Math.cos(angle)*localX+Math.sin(angle)*localZ;
    const pz=z-Math.sin(angle)*localX+Math.cos(angle)*localZ;
    const ray = new Ray({x:px,y:nearY+SUPPORT_REACH,z:pz},{x:0,y:-1,z:0});
    const hit = world.castRayAndGetNormal(ray,SUPPORT_REACH*2,true,QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,excludeBody??undefined);
    if (!hit || hit.normal.y < MIN_GROUND_NORMAL_Y || hit.collider.parent()?.isDynamic() || hit.collider.parent()?.isKinematic()) return null;
    const supportY = nearY+SUPPORT_REACH-hit.timeOfImpact;
    // Footprint samples must also stay out of unsupported water/boundary areas.
    if (needsSafeReset({x:px,y:supportY+CONTACT_GAP+FEET_TO_CENTER,z:pz})
      || (isWater(px,pz) && walkableDeckHeight(px,pz)===null)) return null;
    highest=Math.max(highest,supportY);
  }
  const feetY=highest+CONTACT_GAP;
  const blocked=world.intersectionWithShape({x,y:feetY+FEET_TO_CENTER,z},rotation,shape,QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,excludeBody??undefined);
  return blocked ? null : [x,feetY,z];
}
