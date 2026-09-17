import { createHash } from 'node:crypto';
import type { ReplicatedPlayerDto } from '@kerala-story/protocol';
import { createSimulationWorld, disposeSimulationWorld, stepSimulation } from './fixedStep';
import { addPlayer, launchGlider, playerSnapshots, removePlayer, setPlayerConnected, submitPlayerInput, type PlayerInput, type PlayerProfile } from './playerSimulation';
import type { SimulationWorldDefinition } from './worldDefinition';

export type ReplayEvent = { tick: number } & (
  | { type: 'join'; profile: PlayerProfile }
  | { type: 'input'; id: string; input: PlayerInput }
  | { type: 'disconnect' | 'reconnect' | 'leave' | 'launchGlider'; id: string }
);
/** Rounding occurs only at serialized output, never during the simulation. */
export function playerChecksum(players: readonly ReplicatedPlayerDto[]): string {
  const serialized = JSON.stringify([...players].sort((a, b) => a.id.localeCompare(b.id)), (_key, value: unknown) => typeof value === 'number' ? Math.round(value * 1e5) / 1e5 : value);
  return createHash('sha256').update(serialized).digest('hex');
}
export async function replayPlayers(events: readonly ReplayEvent[], ticks: number, definition?: SimulationWorldDefinition) {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || events.some(event => !Number.isSafeInteger(event.tick) || event.tick < 0 || event.tick >= ticks)) throw new RangeError('Invalid replay tick');
  const sim = await createSimulationWorld(definition);
  try {
    const ordered = [...events].sort((a, b) => a.tick - b.tick); let cursor = 0;
    for (let tick = 0; tick < ticks; tick++) {
      while (cursor < ordered.length && ordered[cursor].tick === tick) {
        const event = ordered[cursor++];
        switch (event.type) {
          case 'join': addPlayer(sim, event.profile); break;
          case 'input': submitPlayerInput(sim, event.id, event.input); break;
          case 'disconnect': setPlayerConnected(sim, event.id, false); break;
          case 'reconnect': setPlayerConnected(sim, event.id, true); break;
          case 'leave': removePlayer(sim, event.id); break;
          case 'launchGlider': launchGlider(sim, event.id); break;
        }
      }
      stepSimulation(sim);
    }
    const players = playerSnapshots(sim);
    return { players, checksum: playerChecksum(players), tick: sim.tick };
  } finally { disposeSimulationWorld(sim); }
}
