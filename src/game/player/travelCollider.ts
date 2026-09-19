import { Capsule, Cuboid, type Collider } from '@dimforge/rapier3d-compat';
import type { TravelMode } from '../../contracts';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER } from './controllerMath';

export function configureTravelCollider(collider: Collider, mode: TravelMode) {
  // A disabled collider can retain solid contacts after a shape/pose change in
  // Rapier. The occupied capsule follows inside the chassis, so it must also
  // be non-solid to avoid repeatedly pushing the car away from its passenger.
  // The plane flies by its own shape sweeps, so the pilot's capsule is switched off the same way.
  const passenger = mode === 'car' || mode === 'plane' || mode === 'bicycle';
  collider.setSensor(passenger);
  collider.setCollisionGroups(passenger ? 0 : 0xffffffff);
  collider.setSolverGroups(passenger ? 0 : 0xffffffff);
  collider.setEnabled(!passenger);
  collider.setShape(mode === 'bicycle' ? new Cuboid(.38, FEET_TO_CENTER, .95)
    : mode === 'boat' ? new Cuboid(.8, FEET_TO_CENTER, 2)
    : new Capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS));
}
