import RAPIER from '@dimforge/rapier3d-compat';
import { InputSchema, type AvatarAppearanceDto, type ReplicatedPlayerDto, type Vec3 } from '@kerala-story/protocol';
import type { SimulationWorld } from './fixedStep';
import { releaseVehicleSeat } from './vehicleSimulation';
import { GRAVITY, INPUT_TIMEOUT_TICKS, JUMP_SPEED, PLAYER_CENTER_HEIGHT, PLAYER_HALF_HEIGHT, PLAYER_RADIUS, walkingVelocity } from './playerRules';
import { findSafeSpawn, groundedClearPosition, needsSafeReset } from './spawnRules';
import { GLIDER, createGliderState, gliderLanding, headingToward, stepGlider, turnToward, type GliderState } from '../../../src/game/vehicle/gliderMotor';
import { GLIDER_LAUNCH, GLIDER_TURN_BACK, isInGliderLaunch, thermalLift } from '../../../src/content/world/gliderSites';
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
  glider: GliderState | null;
  gliderStuckSeconds: number;
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
  sim.players.set(profile.id, { snapshot, body, collider, controller, input: null, inputTick: sim.tick, lastReceivedSequence: -1, jumpQueued: false, grounded: false, verticalSpeed: 0, glider: null, gliderStuckSeconds: 0 });
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
/** Starts a flight from the summit circle. Only a grounded, connected player on foot inside the circle may launch. */
export function launchGlider(sim: SimulationWorld, id: string): boolean {
  const player = sim.players.get(id);
  if (!player?.snapshot.connected || player.snapshot.travel.kind !== 'foot' || !player.grounded) return false;
  const [x, y, z] = player.snapshot.transform.position;
  if (!isInGliderLaunch(x, z)) return false;
  player.glider = createGliderState(GLIDER_LAUNCH.headingRad); player.gliderStuckSeconds = 0;
  player.snapshot.travel = { kind: 'glider' };
  player.snapshot.transform.headingRad = GLIDER_LAUNCH.headingRad;
  player.grounded = false; player.verticalSpeed = 0; player.jumpQueued = false;
  const lifted: Vec3 = [x, y + 1, z];
  player.body.setTranslation(toVector([lifted[0], lifted[1] + PLAYER_CENTER_HEIGHT, lifted[2]]), true);
  player.snapshot.transform.position = lifted;
  sim.physics.propagateModifiedBodyPositionsToColliders();
  return true;
}
/** Nearest dry, clear standing spot around (x, z); falls back to the nearest safe spawn. */
function gliderLandingSpot(sim: SimulationWorld, player: SimulationPlayer, x: number, y: number, z: number, maxRadius: number): Vec3 {
  for (let radius = 0; radius <= maxRadius; radius += 3) for (let i = 0, steps = radius ? 12 : 1; i < steps; i++) {
    const angle = i / steps * Math.PI * 2, px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius;
    const ground = sim.definition.groundHeight(px, pz);
    const spot = groundedClearPosition(sim, [px, radius ? ground ?? y : y, pz], player.collider) ?? (ground === null ? null : groundedClearPosition(sim, [px, ground, pz], player.collider));
    if (spot) return spot;
  }
  return findSafeSpawn(sim, [x, y, z], player.collider);
}
function advanceGlider(sim: SimulationWorld, player: SimulationPlayer, input: PlayerInput | null, dt: number): void {
  const glider = player.glider!, old = toTuple(player.body.translation()), feetY = old[1] - PLAYER_CENTER_HEIGHT;
  const aheadX = old[0] + Math.sin(glider.headingRad) * GLIDER.edgeLookAhead, aheadZ = old[2] - Math.cos(glider.headingRad) * GLIDER.edgeLookAhead;
  const nearEdge = sim.definition.groundHeight(aheadX, aheadZ) === null;
  if (nearEdge) glider.headingRad = turnToward(glider.headingRad, headingToward(old[0], old[2], GLIDER_TURN_BACK.x, GLIDER_TURN_BACK.z), GLIDER.turnRate * 2 * dt);
  // Clients send vehicle-style intent: moveX steers, -moveZ is the forward stick (dive).
  const step = stepGlider(glider, { steer: nearEdge ? 0 : input?.moveX ?? 0, pitch: -(input?.moveZ ?? 0), lift: thermalLift(old[0], feetY, old[2]) }, dt);
  if (sim.definition.groundHeight(old[0] + step.x, old[2] + step.z) === null) { step.x = 0; step.z = 0; }
  player.controller.disableSnapToGround();
  player.controller.computeColliderMovement(player.collider, step, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider => collider.handle !== player.collider.handle);
  const corrected = player.controller.computedMovement(), grounded = player.controller.computedGrounded();
  const next: Vec3 = [old[0] + corrected.x, feetY + corrected.y, old[2] + corrected.z];
  const ground = sim.definition.groundHeight(next[0], next[2]), water = sim.definition.waterHeight(next[0], next[2]);
  const overWater = water !== null && (ground === null || ground <= water);
  const splash = overWater && glider.airTime > GLIDER.minAirSeconds && next[1] - water < GLIDER.landClearance;
  const landing = splash ? 'land' : gliderLanding(glider, next[1], overWater ? null : ground, grounded);
  player.gliderStuckSeconds = Math.hypot(corrected.x, corrected.z) < Math.hypot(step.x, step.z) * .1 ? player.gliderStuckSeconds + dt : 0;
  if (landing !== 'fly' || player.gliderStuckSeconds > 2) {
    const feet = gliderLandingSpot(sim, player, next[0], next[1], next[2], splash ? 60 : 30);
    player.snapshot.travel = { kind: 'foot' }; player.glider = null; player.gliderStuckSeconds = 0;
    player.grounded = true; player.verticalSpeed = 0;
    player.body.setNextKinematicTranslation(toVector([feet[0], feet[1] + PLAYER_CENTER_HEIGHT, feet[2]]));
    player.snapshot.transform = { position: feet, headingRad: glider.headingRad, velocity: [0, 0, 0] };
    return;
  }
  player.body.setNextKinematicTranslation(toVector([next[0], next[1] + PLAYER_CENTER_HEIGHT, next[2]]));
  player.snapshot.transform = { position: next, headingRad: glider.headingRad, velocity: [corrected.x / dt, corrected.y / dt, corrected.z / dt] };
}
export function advancePlayers(sim: SimulationWorld, dt: number): void {
  for (const player of [...sim.players.values()].sort((a, b) => a.snapshot.id.localeCompare(b.snapshot.id))) {
    const active = player.snapshot.connected && sim.tick - player.inputTick < INPUT_TIMEOUT_TICKS;
    const input = active ? player.input : null;
    if (player.snapshot.travel.kind === 'glider' && player.glider) {
      player.jumpQueued = false;
      advanceGlider(sim, player, input, dt);
      if (input) player.snapshot.lastProcessedInput = input.sequence;
      continue;
    }
    if (player.snapshot.travel.kind !== 'foot') continue;
    const old = toTuple(player.body.translation());
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
