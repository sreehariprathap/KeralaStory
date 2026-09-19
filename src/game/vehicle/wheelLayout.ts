import type { VehicleWheel } from '../../content/assets/vehicleProfiles';

/** Front/rear torque split, matching the rear bias the four-wheel cars were tuned with. */
const FRONT_AXLE_SHARE = .4, REAR_AXLE_SHARE = .6;

/** Profiles list wheels with +Z forward, so the axle is a property of the geometry, not the index. */
export function isRearWheel(wheel: VehicleWheel): boolean {
  return wheel.z < 0;
}

/**
 * Per-wheel fraction of the total engine force. The axle share is divided by the
 * number of wheels on that axle, so a dual rear axle delivers the same total
 * torque as a single one instead of twice as much.
 */
export function engineForceShare(wheels: readonly VehicleWheel[]): number[] {
  const rear = wheels.filter(isRearWheel).length, front = wheels.length - rear;
  return wheels.map(wheel => (isRearWheel(wheel) ? (rear ? REAR_AXLE_SHARE / rear : 0) : front ? FRONT_AXLE_SHARE / front : 0));
}
