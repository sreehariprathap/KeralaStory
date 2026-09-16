import type { ReplicatedVehicleDto, SeatId, Vec3 } from '@kerala-story/protocol';
export const VEHICLE_SEATS: Record<ReplicatedVehicleDto['kind'], readonly SeatId[]> = {
  car: ['driver', 'frontPassenger', 'rearLeft', 'rearRight'], bicycle: ['rider', 'passenger'],
};
export const controllerSeat = (kind: ReplicatedVehicleDto['kind']): SeatId => kind === 'car' ? 'driver' : 'rider';
/** Vehicle-local X/right, Y/up, -Z/forward. Shared by server and passive views. */
export function vehicleSeatAnchor(kind: ReplicatedVehicleDto['kind'], seat: SeatId): Vec3 | null {
  if (!VEHICLE_SEATS[kind].includes(seat)) return null;
  const anchors: Record<SeatId, Vec3> = { driver: [-.48, .48, -.5], frontPassenger: [.48, .48, -.5], rearLeft: [-.48, .48, .65], rearRight: [.48, .48, .65], rider: [0, .68, 0], passenger: [0, .68, .65] };
  return [...anchors[seat]];
}
export function selectSeat(vehicle: ReplicatedVehicleDto, preferred?: SeatId): SeatId | null {
  const choices = preferred ? [preferred] : VEHICLE_SEATS[vehicle.kind];
  return choices.find(seat => VEHICLE_SEATS[vehicle.kind].includes(seat) && !vehicle.seats[seat]) ?? null;
}
