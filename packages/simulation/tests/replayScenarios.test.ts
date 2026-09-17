import { describe, expect, it } from 'vitest';
import { createCanonicalWorldDefinition, replayPlayers, type PlayerProfile, type ReplayEvent } from '../src';

const definition = createCanonicalWorldDefinition();
const profile = (id: string): PlayerProfile => ({
  id,
  displayName: `Explorer ${id.slice(-1)}`,
  appearance: {
    avatarPresetId: 'canopy',
    colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' },
  },
});

async function runTwice(events: readonly ReplayEvent[], ticks: number) {
  const first = await replayPlayers(events, ticks, definition);
  const second = await replayPlayers(events, ticks, definition);
  expect(first.checksum).toBe(second.checksum);
  expect(first.tick).toBe(ticks);
  return first;
}

describe('named deterministic multiplayer replay scenarios', () => {
  it('walking apart: two players retain ownership and finish separated', async () => {
    const events: ReplayEvent[] = [
      { tick: 0, type: 'join', profile: profile('guest_aaaaaaaa') },
      { tick: 1, type: 'join', profile: profile('guest_bbbbbbbb') },
    ];
    for (let tick = 2, sequence = 1; tick < 100; tick += 10, sequence++) {
      events.push(
        { tick, type: 'input', id: 'guest_aaaaaaaa', input: { sequence, moveX: -1, moveZ: 0, actions: [] } },
        { tick, type: 'input', id: 'guest_bbbbbbbb', input: { sequence, moveX: 1, moveZ: 0, actions: [] } },
      );
    }

    const result = await runTwice(events, 120);
    expect(result.players).toHaveLength(2);
    expect(result.players.every(player => player.connected)).toBe(true);
    expect(result.players.map(player => player.id)).toEqual(['guest_aaaaaaaa', 'guest_bbbbbbbb']);
    expect(result.players[0].transform.position[0]).toBeLessThan(result.players[1].transform.position[0] - 0.5);
    expect(result.players.map(player => player.lastProcessedInput)).toEqual([10, 10]);
  });

  it('duplicate input: repeated sequence is ignored and ownership stays with the first input', async () => {
    const events: ReplayEvent[] = [
      { tick: 0, type: 'join', profile: profile('guest_cccccccc') },
      { tick: 1, type: 'input', id: 'guest_cccccccc', input: { sequence: 1, moveX: 0, moveZ: 1, actions: [] } },
      { tick: 2, type: 'input', id: 'guest_cccccccc', input: { sequence: 1, moveX: 0, moveZ: -1, actions: [] } },
    ];

    const result = await runTwice(events, 50);
    const player = result.players[0];
    expect(player.connected).toBe(true);
    expect(player.lastProcessedInput).toBe(1);
    expect(player.transform.position[2]).toBeGreaterThan(-459);
  });

  it('disconnect/reconnect: the same guest retains identity and resumes from its acknowledged sequence', async () => {
    const events: ReplayEvent[] = [
      { tick: 0, type: 'join', profile: profile('guest_dddddddd') },
      { tick: 1, type: 'input', id: 'guest_dddddddd', input: { sequence: 1, moveX: 1, moveZ: 0, actions: [] } },
      { tick: 10, type: 'disconnect', id: 'guest_dddddddd' },
      { tick: 40, type: 'reconnect', id: 'guest_dddddddd' },
      { tick: 41, type: 'input', id: 'guest_dddddddd', input: { sequence: 2, moveX: -1, moveZ: 0, actions: [] } },
    ];

    const result = await runTwice(events, 80);
    const player = result.players[0];
    expect(player.id).toBe('guest_dddddddd');
    expect(player.connected).toBe(true);
    expect(player.lastProcessedInput).toBe(2);
    expect(player.transform.velocity[0]).toBe(0);
  });
});
