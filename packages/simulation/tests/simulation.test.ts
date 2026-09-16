import { describe, expect, it } from 'vitest';
import { addPlayer, createCanonicalWorldDefinition, createFixedStepper, createSimulationWorld, disposeSimulationWorld, findSafeDismount, findSafeSpawn, groundedClearPosition, playerSnapshots, replayPlayers, setPlayerConnected, stepSimulation, submitPlayerInput, type PlayerProfile, type ReplayEvent } from '../src';

const profile = (id = 'guest_aaaaaaaa'): PlayerProfile => ({ id, displayName: 'Explorer', appearance: { avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } } });
const definition = createCanonicalWorldDefinition();
describe('canonical authoritative world', () => {
  it('loads exact terrain and authored structural boxes; named spawns are grounded and clear', async () => {
    const sim = await createSimulationWorld(definition);
    try {
      expect(sim.staticColliders.size).toBe(definition.meshes.length + definition.boxes.length);
      expect(sim.staticColliders.has('bridge-deck')).toBe(true); expect(sim.staticColliders.has('jetty')).toBe(true);
      const invalid = definition.safeSpawns.filter(spawn => !groundedClearPosition(sim, spawn.position)).map(spawn => spawn.id);
      expect(invalid).toEqual([]);
      expect(groundedClearPosition(sim, [12, 15.05, -99])?.[1]).toBeCloseTo(15.045, 3);
      expect(groundedClearPosition(sim, [90, 8.55, 76])?.[1]).toBeCloseTo(8.545, 3);
      expect(groundedClearPosition(sim, [0, 8, -100])).toBeNull();
      expect(groundedClearPosition(sim, [0, -1000, -460])).toBeNull();
      expect(findSafeSpawn(sim, [NaN, 0, 0]).every(Number.isFinite)).toBe(true);
      expect(findSafeDismount(sim, [0, 8, -100])).toBeNull();
    } finally { disposeSimulationWorld(sim); }
  });
  it('orders authority inputs, clears disconnected motion, retains reconnect identity and caps host catch-up', async () => {
    const sim = await createSimulationWorld(definition);
    try {
      addPlayer(sim, profile());
      for (let i = 0; i < 5; i++) stepSimulation(sim);
      const before = playerSnapshots(sim)[0].transform.position;
      expect(submitPlayerInput(sim, profile().id, { sequence: 1, moveX: 0, moveZ: 1, actions: [] })).toBe(true);
      expect(submitPlayerInput(sim, profile().id, { sequence: 1, moveX: 1, moveZ: 0, actions: [] })).toBe(false);
      expect(submitPlayerInput(sim, profile().id, { sequence: 0, moveX: 1, moveZ: 0, actions: [] })).toBe(false);
      expect(submitPlayerInput(sim, profile().id, { sequence: 2, moveX: 0, moveZ: 1, actions: [], position: [100, 0, 0] })).toBe(false);
      for (let i = 0; i < 10; i++) stepSimulation(sim);
      expect(playerSnapshots(sim)[0].transform.position[2]).toBeGreaterThan(before[2] + .3);
      expect(playerSnapshots(sim)[0].lastProcessedInput).toBe(1);
      setPlayerConnected(sim, profile().id, false); const disconnected = playerSnapshots(sim)[0].transform.position;
      for (let i = 0; i < 10; i++) stepSimulation(sim);
      expect(playerSnapshots(sim)[0].transform.position[2]).toBeCloseTo(disconnected[2], 2);
      setPlayerConnected(sim, profile().id, true); expect(playerSnapshots(sim)).toHaveLength(1);
      expect(playerSnapshots(sim)[0].lastProcessedInput).toBe(1);
      expect(createFixedStepper(sim).advance(5)).toBe(5);
      expect(() => stepSimulation(sim, .1)).toThrow();
    } finally { disposeSimulationWorld(sim); }
  });
  it('replays two guests through disconnect/reconnect with identical 600-tick checksum', async () => {
    const events: ReplayEvent[] = [{ tick: 0, type: 'join', profile: profile() }, { tick: 1, type: 'join', profile: profile('guest_bbbbbbbb') }, { tick: 200, type: 'disconnect', id: profile().id }, { tick: 240, type: 'reconnect', id: profile().id }];
    for (let tick = 10; tick < 600; tick += 10) for (const id of [profile().id, 'guest_bbbbbbbb']) events.push({ tick, type: 'input', id, input: { sequence: tick, moveX: 0, moveZ: .3, actions: [] } });
    const a = await replayPlayers(events, 600, definition), b = await replayPlayers(events, 600, definition);
    expect(a.checksum).toBe(b.checksum); expect(a.players).toHaveLength(2); expect(a.players.every(p => p.connected)).toBe(true);
    expect(a.players[0].transform.position).not.toEqual(a.players[1].transform.position);
  });
  it('ten same-tick joins reserve distinct clear spawn positions', async () => {
    const sim = await createSimulationWorld(definition);
    try {
      for (let i = 0; i < 10; i++) addPlayer(sim, profile(`guest_player0${i}`));
      const players = playerSnapshots(sim);
      for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
        const a = players[i].transform.position, b = players[j].transform.position;
        expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(.55);
      }
    } finally { disposeSimulationWorld(sim); }
  });
});
