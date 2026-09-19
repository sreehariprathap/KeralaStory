import { Capsule, Cuboid, QueryFilterFlags, Ray } from '@dimforge/rapier3d-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../../contracts';
import { isWater, isTravelAllowed, walkableDeckHeight } from '../../content/world/definition';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, needsSafeReset } from '../player/controllerMath';
import type { CarModelId } from '../../content/assets/models';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';

const SUPPORT_REACH = 0.75;
const CONTACT_GAP = 0.06;
const MIN_GROUND_NORMAL_Y = Math.cos(Math.PI / 4);

/**
 * Resolve a nearby supported feet position for the exact runtime collider.
 * Call after collision readiness; heading is the target parked/rider heading.
 * This checks destination clearance, not a swept rotation or dismount path.
 */
/** The default car probe, kept for callers that do not know which car they are placing. */
const DEFAULT_CAR_FOOTPRINT = { halfX: .9, halfZ: 1.9 };

/**
 * A car's plan-view half-extents. Deliberately NOT the collision chassis, which is a
 * compact belly box: a 3.8 m car carries a 1.35 m half-length one. Clearance needs the
 * space the vehicle actually occupies, so the length drives it. At the 3.8 m reference
 * length this returns exactly the values the fixed probe used.
 */
export function carFootprint(model: CarModelId): { halfX: number; halfZ: number } {
  const profile = VEHICLE_PROFILES[model];
  return { halfX: Math.max(profile.chassis.x, DEFAULT_CAR_FOOTPRINT.halfX), halfZ: profile.length / 2 };
}

export function resolveClearFeet(world: World, excludeBody: RigidBody | null | undefined, x: number, z: number, nearY: number, ride: boolean | 'car', heading: number, footprint: { halfX: number; halfZ: number } = DEFAULT_CAR_FOOTPRINT): Vec3 | null {
  if (![x,z,nearY,heading].every(Number.isFinite)) return null;
  const vehicle = ride === 'car' ? 'car' : ride ? 'bicycle' : null;
  if(vehicle && !isTravelAllowed(vehicle,x,z))return null;
  const angle = vehicle ? Math.PI - heading : 0;
  const rotation = {x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)};
  const shape = vehicle === 'car' ? new Cuboid(footprint.halfX,FEET_TO_CENTER,footprint.halfZ) : vehicle ? new Cuboid(.38,FEET_TO_CENTER,.95) : new Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS);
  // A center-only ray can accept a bike straddling a ledge. Probe its four
  // corners too, with the same heading used by the collider. Foot cardinal
  // probes conservatively require the whole capsule base to be supported.
  const samples = vehicle === 'car'
    ? [[0,0],[-footprint.halfX,-footprint.halfZ],[-footprint.halfX,footprint.halfZ],[footprint.halfX,-footprint.halfZ],[footprint.halfX,footprint.halfZ]]
    : vehicle ? [[0,0],[-.38,-.95],[-.38,.95],[.38,.95],[.38,-.95]]
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
