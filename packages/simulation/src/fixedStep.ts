import RAPIER from '@dimforge/rapier3d-compat';
import { createCanonicalWorldDefinition, type SimulationWorldDefinition } from './worldDefinition';
import { assembleStaticColliders } from './staticColliders';
import { advancePlayers, type SimulationPlayer } from './playerSimulation';

export const FIXED_STEP_SECONDS = 1 / 60;
export interface SimulationWorld {
  definition: SimulationWorldDefinition;
  physics: RAPIER.World;
  staticColliders: Map<string, RAPIER.Collider>;
  players: Map<string, SimulationPlayer>;
  tick: number;
  disposed: boolean;
}
let initialization: Promise<void> | undefined;
export async function createSimulationWorld(definition = createCanonicalWorldDefinition()): Promise<SimulationWorld> {
  await (initialization ??= RAPIER.init());
  const physics = new RAPIER.World({ x: 0, y: -22, z: 0 });
  physics.timestep = FIXED_STEP_SECONDS;
  const staticColliders = assembleStaticColliders(physics, definition);
  physics.step(); // Populate broad-phase queries before safe-spawn validation.
  return { definition, physics, staticColliders, players: new Map(), tick: 0, disposed: false };
}
export function stepSimulation(sim: SimulationWorld, dt = FIXED_STEP_SECONDS): void {
  if (sim.disposed) throw new Error('Simulation disposed');
  if (Math.abs(dt - FIXED_STEP_SECONDS) > 1e-10) throw new RangeError('Simulation requires a fixed 60 Hz step');
  advancePlayers(sim, dt);
  sim.physics.step();
  sim.tick++;
}
export function disposeSimulationWorld(sim: SimulationWorld): void {
  if (sim.disposed) return;
  sim.physics.free(); sim.players.clear(); sim.staticColliders.clear(); sim.disposed = true;
}
/** A host can bound catch-up without introducing variable simulation dt. */
export function createFixedStepper(sim: SimulationWorld, maxSteps = 5) {
  let accumulator = 0;
  return { reset() { accumulator = 0; }, advance(elapsedSeconds: number) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError('Invalid elapsed time');
    accumulator = Math.min(accumulator + elapsedSeconds, maxSteps * FIXED_STEP_SECONDS);
    let steps = 0;
    while (accumulator + 1e-12 >= FIXED_STEP_SECONDS) { stepSimulation(sim); accumulator -= FIXED_STEP_SECONDS; steps++; }
    return steps;
  } };
}
