import RAPIER from '@dimforge/rapier3d-compat';
import type { ReplicatedVehicleDto, SeatId, Vec3 } from '@kerala-story/protocol';
import type { SimulationWorld } from './fixedStep';
import { INPUT_TIMEOUT_TICKS, PLAYER_CENTER_HEIGHT } from './playerRules';
import { findSafeDismount } from './spawnRules';
import { controllerSeat, selectSeat, vehicleSeatAnchor } from './seatRules';
import { sharedVehicleSpawns } from './vehicleSpawns';
import { toTuple, toVector } from './worldDefinition';
export interface SimulationVehicle {
  snapshot: ReplicatedVehicleDto; body: RAPIER.RigidBody; collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController; heading: number; speed: number; grounded: boolean; halfHeight: number;
}
/** Intentionally modest collision-constrained arcade motion; browser motor code is never imported. */
export function addSharedVehicles(sim: SimulationWorld) {
  for (const spawn of sharedVehicleSpawns(sim.definition)) {
    if (sim.vehicles.has(spawn.id)) continue;
    const halfHeight = spawn.kind === 'car' ? .55 : .45;
    const rotation = { x: 0, y: Math.sin(spawn.headingRad / 2), z: 0, w: Math.cos(spawn.headingRad / 2) };
    const body = sim.physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.position[0], spawn.position[1] + halfHeight, spawn.position[2]).setRotation(rotation));
    const collider = sim.physics.createCollider(RAPIER.ColliderDesc.cuboid(spawn.kind === 'car' ? .85 : .23, halfHeight, spawn.kind === 'car' ? 1.6 : .8), body);
    const controller = sim.physics.createCharacterController(.03);
    controller.enableSnapToGround(.5); controller.enableAutostep(.28, .3, false); controller.setMaxSlopeClimbAngle(Math.PI / 4);
    sim.vehicles.set(spawn.id, { body, collider, controller, heading: spawn.headingRad, speed: 0, grounded: false, halfHeight,
      snapshot: { id: spawn.id, kind: spawn.kind, modelId: spawn.modelId, transform: { position: spawn.position, rotation: [rotation.x, rotation.y, rotation.z, rotation.w], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] }, controls: { driverId: null, throttle: 0, steering: 0, brake: true, nitro: false }, seats: {} } });
  }
  sim.physics.propagateModifiedBodyPositionsToColliders();
}
export function enterVehicle(sim: SimulationWorld, id: string, vehicleId: string, preferred?: SeatId): boolean {
  const player = sim.players.get(id), vehicle = sim.vehicles.get(vehicleId);
  if (!player?.snapshot.connected || player.snapshot.travel.kind !== 'foot' || !player.grounded || !vehicle?.grounded || Math.abs(vehicle.speed) > 1) return false;
  const p = player.snapshot.transform.position, v = vehicle.snapshot.transform.position;
  if (Math.hypot(p[0] - v[0], p[1] - v[1], p[2] - v[2]) > 4) return false;
  const seat = selectSeat(vehicle.snapshot, preferred); if (!seat) return false;
  // Atomic synchronous claim: no asynchronous gap between validation and ownership.
  vehicle.snapshot.seats[seat] = id; player.snapshot.travel = { kind: 'vehicle', vehicleId, seatId: seat };
  player.input = null; player.jumpQueued = false; player.collider.setEnabled(false); player.verticalSpeed = 0;
  attachOccupants(sim, vehicle); return true;
}
export function exitVehicle(sim: SimulationWorld, id: string): boolean {
  const player = sim.players.get(id); if (!player || player.snapshot.travel.kind !== 'vehicle') return false;
  const vehicle = sim.vehicles.get(player.snapshot.travel.vehicleId);
  if (!vehicle?.grounded || Math.abs(vehicle.speed) > 1) return false;
  const feet = findSafeDismount(sim, vehicle.snapshot.transform.position, vehicle.heading, player.collider); if (!feet) return false;
  releaseVehicleSeat(sim, id);
  player.snapshot.transform.position = feet; player.snapshot.transform.velocity = [0, 0, 0];
  player.body.setTranslation(toVector([feet[0], feet[1] + PLAYER_CENTER_HEIGHT, feet[2]]), true);
  player.body.setNextKinematicTranslation(toVector([feet[0], feet[1] + PLAYER_CENTER_HEIGHT, feet[2]]));
  player.grounded = true; return true;
}
export function releaseVehicleSeat(sim: SimulationWorld, id: string) {
  const player = sim.players.get(id); if (!player || player.snapshot.travel.kind !== 'vehicle') return;
  const vehicle = sim.vehicles.get(player.snapshot.travel.vehicleId);
  if (vehicle) { delete vehicle.snapshot.seats[player.snapshot.travel.seatId]; vehicle.snapshot.controls = { driverId: vehicle.snapshot.seats[controllerSeat(vehicle.snapshot.kind)] ?? null, throttle: 0, steering: 0, brake: true, nitro: false }; }
  player.snapshot.travel = { kind: 'foot' }; player.collider.setEnabled(true); player.input = null; player.jumpQueued = false;
}
function attachOccupants(sim: SimulationWorld, vehicle: SimulationVehicle) {
  const transform = vehicle.snapshot.transform;
  for (const [seat, id] of Object.entries(vehicle.snapshot.seats)) {
    const player = sim.players.get(id!), anchor = vehicleSeatAnchor(vehicle.snapshot.kind, seat as SeatId); if (!player || !anchor) continue;
    const c = Math.cos(vehicle.heading), s = Math.sin(vehicle.heading);
    const feet: Vec3 = [transform.position[0] + anchor[0] * c + anchor[2] * s, transform.position[1] + anchor[1], transform.position[2] - anchor[0] * s + anchor[2] * c];
    player.snapshot.transform = { position: feet, headingRad: vehicle.heading, velocity: [...transform.linearVelocity] };
    player.body.setNextKinematicTranslation(toVector([feet[0], feet[1] + PLAYER_CENTER_HEIGHT, feet[2]]));
    if (player.input) player.snapshot.lastProcessedInput = player.input.sequence;
  }
}
export function advanceVehicles(sim: SimulationWorld, dt: number) {
  for (const vehicle of sim.vehicles.values()) {
    const driverId = vehicle.snapshot.seats[controllerSeat(vehicle.snapshot.kind)] ?? null, driver = driverId ? sim.players.get(driverId) : undefined;
    const input = driver?.snapshot.connected && sim.tick - driver.inputTick < INPUT_TIMEOUT_TICKS ? driver.input : null;
    const brake = !input || input.actions.includes('brake');
    const throttle = brake ? 0 : -input.moveZ, steering = input?.moveX ?? 0;
    vehicle.snapshot.controls = { driverId, throttle, steering, brake, nitro: false };
    const target = throttle * (vehicle.snapshot.kind === 'car' ? 13 : 6);
    const change = (brake ? 14 : 5) * dt;
    vehicle.speed += Math.max(-change, Math.min(change, target - vehicle.speed));
    const angular = steering * Math.min(Math.abs(vehicle.speed) / 3, 1) * Math.sign(vehicle.speed) * -1.2;
    vehicle.heading += angular * dt;
    const old = toTuple(vehicle.body.translation());
    const desired = { x: -Math.sin(vehicle.heading) * vehicle.speed * dt, y: -9 * dt, z: -Math.cos(vehicle.heading) * vehicle.speed * dt };
    // Reject entry into water/void before collision advancement.
    const x = old[0] + desired.x, z = old[2] + desired.z;
    const ground = sim.definition.groundHeight(x, z), water = sim.definition.waterHeight(x, z);
    if (ground === null || (water !== null && ground <= water)) { desired.x = 0; desired.z = 0; vehicle.speed = 0; }
    vehicle.controller.computeColliderMovement(vehicle.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider => collider.handle !== vehicle.collider.handle);
    const movement = vehicle.controller.computedMovement(); vehicle.grounded = vehicle.controller.computedGrounded();
    if (Math.hypot(movement.x, movement.z) < Math.hypot(desired.x, desired.z) * .2) vehicle.speed = 0;
    const position: Vec3 = [old[0] + movement.x, old[1] + movement.y - vehicle.halfHeight, old[2] + movement.z];
    const rotation = { x: 0, y: Math.sin(vehicle.heading / 2), z: 0, w: Math.cos(vehicle.heading / 2) };
    vehicle.body.setNextKinematicTranslation(toVector([position[0], position[1] + vehicle.halfHeight, position[2]])); vehicle.body.setNextKinematicRotation(rotation);
    vehicle.snapshot.transform = { position, rotation: [0, rotation.y, 0, rotation.w], linearVelocity: [movement.x / dt, movement.y / dt, movement.z / dt], angularVelocity: [0, angular, 0] };
    attachOccupants(sim, vehicle);
  }
}
export function vehicleSnapshots(sim: SimulationWorld): ReplicatedVehicleDto[] { return [...sim.vehicles.values()].map(vehicle => structuredClone(vehicle.snapshot)); }
