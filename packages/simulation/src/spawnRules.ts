import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '@kerala-story/protocol';
import type { SimulationWorld } from './fixedStep';
import { PLAYER_CENTER_HEIGHT, PLAYER_HALF_HEIGHT, PLAYER_RADIUS } from './playerRules';
import { toVector } from './worldDefinition';

/** Validates ground against actual server triangles, then full capsule clearance. */
export function groundedClearPosition(sim: SimulationWorld, requested: readonly number[], exclude?: RAPIER.Collider): Vec3 | null {
  if (requested.length !== 3 || !requested.every(Number.isFinite)) return null;
  const [x, y, z] = requested;
  if (sim.definition.groundHeight(x, z) === null) return null;
  const ray = new RAPIER.Ray({ x, y: y + .8, z }, { x: 0, y: -1, z: 0 });
  const hit = sim.physics.castRayAndGetNormal(ray, 2, true, RAPIER.QueryFilterFlags.ONLY_FIXED);
  if (!hit || hit.normal.y < Math.SQRT1_2) return null;
  const surface = y + .8 - hit.timeOfImpact;
  const water = sim.definition.waterHeight(x, z);
  if (water !== null && surface <= water) return null;
  const feet: Vec3 = [x, surface + .045, z];
  // Newly joined bodies may not yet have entered Rapier's broad phase.
  for (const player of sim.players.values()) {
    if (player.collider.handle === exclude?.handle) continue;
    const other = player.body.translation();
    if (Math.hypot(other.x - x, other.z - z) < PLAYER_RADIUS * 2 + .05 && Math.abs(other.y - feet[1] - PLAYER_CENTER_HEIGHT) < PLAYER_CENTER_HEIGHT * 2) return null;
  }
  const occupied = sim.physics.intersectionWithShape(toVector([x, feet[1] + PLAYER_CENTER_HEIGHT, z]), { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, exclude);
  return occupied ? null : feet;
}
export function findSafeSpawn(sim: SimulationWorld, requested?: readonly number[], exclude?: RAPIER.Collider): Vec3 {
  if (requested) { const valid = groundedClearPosition(sim, requested, exclude); if (valid) return valid; }
  const spawns = [...sim.definition.safeSpawns].sort((a, b) => {
    const distance = (p: readonly number[]) => requested?.every(Number.isFinite) ? Math.hypot(p[0] - requested[0], p[2] - requested[2]) : 0;
    return distance(a.position) - distance(b.position);
  });
  for (const spawn of spawns) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0]]) {
    const position = groundedClearPosition(sim, [spawn.position[0] + dx, spawn.position[1], spawn.position[2] + dz], exclude);
    if (position) return position;
  }
  throw new Error('No clear dry safe spawn');
}
/** No teleport to a distant parking spot when a vehicle has no safe nearby exit. */
export function findSafeDismount(sim: SimulationWorld, origin: readonly number[], headingRad = 0, exclude?: RAPIER.Collider): Vec3 | null {
  for (const distance of [1.5, 2.3, 3]) for (const angle of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
    const yaw = headingRad + angle;
    const position = groundedClearPosition(sim, [origin[0] + Math.sin(yaw) * distance, origin[1], origin[2] + Math.cos(yaw) * distance], exclude);
    if (position) return position;
  }
  return null;
}
export function needsSafeReset(sim: SimulationWorld, feet: Vec3) {
  if (!feet.every(Number.isFinite)) return true;
  const height = sim.definition.groundHeight(feet[0], feet[2]);
  const water = sim.definition.waterHeight(feet[0], feet[2]);
  return height === null || feet[1] + PLAYER_CENTER_HEIGHT * 2 < height || (water !== null && feet[1] <= water);
}
