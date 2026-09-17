import { describe, expect, it } from 'vitest';
import { GLIDER_LAUNCH, THERMALS } from '../../../src/content/world/gliderSites';
import { addPlayer, createCanonicalWorldDefinition, createSimulationWorld, disposeSimulationWorld, launchGlider, playerChecksum, playerSnapshots, stepSimulation, submitPlayerInput, toVector, PLAYER_CENTER_HEIGHT, type PlayerProfile, type SimulationWorld } from '../src';

const id = 'guest_glider01';
const profile: PlayerProfile = { id, displayName: 'Flyer', appearance: { avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } } };
const definition = createCanonicalWorldDefinition();

/** Moves the guest onto a spot and lets them settle onto the ground. */
function placeAt(sim: SimulationWorld, feet: readonly number[]) {
  const player = sim.players.get(id)!;
  player.body.setTranslation(toVector([feet[0], feet[1] + PLAYER_CENTER_HEIGHT + .05, feet[2]]), true);
  player.snapshot.transform.position = [feet[0], feet[1] + .05, feet[2]];
  player.grounded = false;
  sim.physics.propagateModifiedBodyPositionsToColliders();
  for (let i = 0; i < 20; i++) stepSimulation(sim);
}
let sequence = 0;
const hold = (sim: SimulationWorld, moveX: number, moveZ: number, ticks: number) => {
  for (let i = 0; i < ticks; i++) { if (i % 10 === 0) submitPlayerInput(sim, id, { sequence: ++sequence, moveX, moveZ, actions: [] }); stepSimulation(sim); }
};
async function withGuest(run: (sim: SimulationWorld) => void | Promise<void>) {
  const sim = await createSimulationWorld(definition);
  try { addPlayer(sim, profile); sequence = 0; await run(sim); } finally { disposeSimulationWorld(sim); }
}

describe('authoritative paragliding', () => {
  it('refuses a launch outside the summit circle', () => withGuest(sim => {
    for (let i = 0; i < 20; i++) stepSimulation(sim);
    expect(launchGlider(sim, id)).toBe(false);
    expect(playerSnapshots(sim)[0].travel.kind).toBe('foot');
    expect(launchGlider(sim, 'guest_nobody00')).toBe(false);
  }));

  it('launches from the circle, glides down and lands back on foot', () => withGuest(sim => {
    placeAt(sim, GLIDER_LAUNCH.position);
    expect(sim.players.get(id)!.grounded).toBe(true);
    expect(launchGlider(sim, id)).toBe(true);
    expect(launchGlider(sim, id)).toBe(false);
    const start = playerSnapshots(sim)[0].transform.position;
    hold(sim, 0, 0, 60 * 5);
    const flying = playerSnapshots(sim)[0];
    expect(flying.travel.kind).toBe('glider');
    expect(Math.hypot(flying.transform.position[0] - start[0], flying.transform.position[2] - start[2])).toBeGreaterThan(40);
    let ticks = 0;
    while (playerSnapshots(sim)[0].travel.kind === 'glider' && ticks < 60 * 180) { hold(sim, 0, 0, 60); ticks += 60; }
    const landed = playerSnapshots(sim)[0];
    expect(landed.travel.kind).toBe('foot');
    expect(sim.players.get(id)!.glider).toBeNull();
    expect(definition.groundHeight(landed.transform.position[0], landed.transform.position[2])).not.toBeNull();
    // Walking works again after landing.
    hold(sim, 0, 1, 30);
    expect(playerSnapshots(sim)[0].transform.position).not.toEqual(landed.transform.position);
  }));

  it('climbs while circling inside a thermal', () => withGuest(sim => {
    const thermal = THERMALS[1];
    placeAt(sim, GLIDER_LAUNCH.position);
    expect(launchGlider(sim, id)).toBe(true);
    // Put the pilot high above the thermal and let them circle.
    const player = sim.players.get(id)!, groundY = definition.groundHeight(thermal.x, thermal.z)!;
    player.glider!.launchHold = 0;
    player.glider!.airTime = 10;
    player.body.setTranslation(toVector([thermal.x - 11, groundY + 60 + PLAYER_CENTER_HEIGHT, thermal.z]), true);
    player.glider!.headingRad = 0;
    sim.physics.propagateModifiedBodyPositionsToColliders();
    stepSimulation(sim);
    const before = playerSnapshots(sim)[0].transform.position[1];
    hold(sim, 1, 0, 60 * 20);
    const after = playerSnapshots(sim)[0];
    expect(after.travel.kind).toBe('glider');
    expect(after.transform.position[1]).toBeGreaterThan(before + 5);
  }));

  it('produces the same flight every run', async () => {
    const fly = async () => {
      let checksum = '';
      await withGuest(sim => { placeAt(sim, GLIDER_LAUNCH.position); launchGlider(sim, id); hold(sim, .4, -.5, 60 * 8); checksum = playerChecksum(playerSnapshots(sim)); });
      return checksum;
    };
    expect(await fly()).toBe(await fly());
  });
});
