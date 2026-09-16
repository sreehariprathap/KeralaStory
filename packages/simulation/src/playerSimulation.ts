import RAPIER from '@dimforge/rapier3d-compat';
import { InputSchema, type AvatarAppearanceDto, type ReplicatedPlayerDto, type Vec3 } from '@kerala-story/protocol';
import type { SimulationWorld } from './fixedStep';
import { releaseVehicleSeat } from './vehicleSimulation';
import { GRAVITY, INPUT_TIMEOUT_TICKS, JUMP_SPEED, PLAYER_CENTER_HEIGHT, PLAYER_HALF_HEIGHT, PLAYER_RADIUS, walkingVelocity } from './playerRules';
import { findSafeSpawn, needsSafeReset } from './spawnRules';
import { toTuple, toVector } from './worldDefinition';

export type PlayerInput = ReturnType<typeof InputSchema.parse>;
export interface PlayerProfile { id: string; displayName: string; appearance: AvatarAppearanceDto }
export interface SimulationPlayer {
  snapshot: ReplicatedPlayerDto;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  input: PlayerInput | null;
  lastReceivedSequence: number;
  inputTick: number;
  jumpQueued: boolean;
  grounded: boolean;
  verticalSpeed: number;
}
export function addPlayer(sim: SimulationWorld, profile: PlayerProfile): ReplicatedPlayerDto {
  if (sim.players.has(profile.id)) throw new Error('Player already exists; reconnect instead');
  const feet = findSafeSpawn(sim);
  const body = sim.physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(feet[0], feet[1] + PLAYER_CENTER_HEIGHT, feet[2]));
  const collider = sim.physics.createCollider(RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS), body);
  const controller = sim.physics.createCharacterController(.025);
  controller.enableAutostep(.32, .22, false); controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI * .29); controller.enableSnapToGround(.25);
  controller.setApplyImpulsesToDynamicBodies(false);
  const snapshot: ReplicatedPlayerDto = { ...structuredClone(profile), transform: { position: feet, headingRad: Math.PI, velocity: [0, 0, 0] }, travel: { kind: 'foot' }, connected: true, lastProcessedInput: 0 };
  sim.players.set(profile.id, { snapshot, body, collider, controller, input: null, inputTick: sim.tick, lastReceivedSequence: -1, jumpQueued: false, grounded: false, verticalSpeed: 0 });
  sim.physics.propagateModifiedBodyPositionsToColliders();
  return structuredClone(snapshot);
}
export function removePlayer(sim: SimulationWorld, id: string): void {
  const player = sim.players.get(id); if (!player) return;
  releaseVehicleSeat(sim, id);
  sim.physics.removeCharacterController(player.controller); sim.physics.removeRigidBody(player.body); sim.players.delete(id);
}
/** Reconnect retains body, transform, identity and sequence acknowledgment. */
export function setPlayerConnected(sim: SimulationWorld, id: string, connected: boolean): boolean {
  const player = sim.players.get(id); if (!player) return false;
  player.snapshot.connected = connected; player.input = null; player.jumpQueued = false;
  return true;
}
export function submitPlayerInput(sim: SimulationWorld, id: string, candidate: unknown): boolean {
  const player = sim.players.get(id), parsed = InputSchema.safeParse(candidate);
  if (!player?.snapshot.connected || !parsed.success || parsed.data.sequence <= player.lastReceivedSequence) return false;
  player.lastReceivedSequence = parsed.data.sequence;
  player.jumpQueued ||= parsed.data.actions.includes('jump') && !player.input?.actions.includes('jump');
  player.input = parsed.data; player.inputTick = sim.tick;
  return true;
}
export function advancePlayers(sim: SimulationWorld, dt: number): void {
  for (const player of [...sim.players.values()].sort((a, b) => a.snapshot.id.localeCompare(b.snapshot.id))) {
    if (player.snapshot.travel.kind !== 'foot') continue;
    const old = toTuple(player.body.translation());
    const active = player.snapshot.connected && sim.tick - player.inputTick < INPUT_TIMEOUT_TICKS;
    const input = active ? player.input : null;
    const velocity = walkingVelocity(input?.moveX ?? 0, input?.moveZ ?? 0);
    if (active && player.jumpQueued && player.grounded) { player.verticalSpeed = JUMP_SPEED; player.grounded = false; }
    player.jumpQueued = false;
    player.verticalSpeed = Math.max(-30, player.verticalSpeed + GRAVITY * dt);
    if (player.grounded && player.verticalSpeed < 0) player.verticalSpeed = -2;
    if (player.verticalSpeed > 0) player.controller.disableSnapToGround(); else player.controller.enableSnapToGround(.25);
    const desired = { x: velocity.x * dt, y: player.verticalSpeed * dt, z: velocity.z * dt };
    player.controller.computeColliderMovement(player.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider => collider.handle !== player.collider.handle);
    const corrected = player.controller.computedMovement(); player.grounded = player.controller.computedGrounded();
    if ((player.grounded && player.verticalSpeed < 0) || (player.verticalSpeed > 0 && corrected.y < desired.y - .001)) player.verticalSpeed = 0;
    let feet: Vec3 = [old[0] + corrected.x, old[1] + corrected.y - PLAYER_CENTER_HEIGHT, old[2] + corrected.z];
    let reset = false;
    if (needsSafeReset(sim, feet)) { feet = findSafeSpawn(sim, undefined, player.collider); player.verticalSpeed = 0; reset = true; }
    player.body.setNextKinematicTranslation(toVector([feet[0], feet[1] + PLAYER_CENTER_HEIGHT, feet[2]]));
    player.snapshot.transform.position = feet;
    // Snap sub-millimetre-per-second solver residue at the replication boundary.
    // The authoritative body remains full precision; clients should not observe
    // tiny lateral drift after a stopped/disconnected player is settled.
    const cleanVelocity = (value: number) => Math.abs(value) < 1e-3 ? 0 : value;
    player.snapshot.transform.velocity = reset ? [0, 0, 0] : [cleanVelocity(corrected.x / dt), cleanVelocity(corrected.y / dt), cleanVelocity(corrected.z / dt)];
    if (Math.hypot(corrected.x, corrected.z) > 1e-5) player.snapshot.transform.headingRad = Math.atan2(corrected.x, -corrected.z);
    if (input) player.snapshot.lastProcessedInput = input.sequence;
  }
}
export function playerSnapshots(sim: SimulationWorld): ReplicatedPlayerDto[] {
  return [...sim.players.values()].sort((a, b) => a.snapshot.id.localeCompare(b.snapshot.id)).map(player => structuredClone(player.snapshot));
}
