import { describe, expect, it } from 'vitest';
import { InputSender } from '../../src/network/inputSender';
import { LocalReconciliation } from '../../src/network/reconciliation';
import { decodeRoomState } from '../../src/network/roomClient';

describe('network input ownership', () => {
  it('caps changed inputs at 30 Hz, sends 5 Hz idle heartbeats and clears focus', () => {
    const sent: number[] = [];
    const sender = new InputSender(input => sent.push(input.sequence));
    sender.setIntent({ moveX: 1, moveZ: 0, actions: ['jump'] });
    expect(sender.tick(0)?.actions).toEqual(['jump']);
    expect(sender.tick(10)).toBeNull();
    expect(sender.tick(34)?.actions).toEqual([]);
    expect(sender.tick(200)).toBeNull();
    expect(sender.tick(234)?.moveX).toBe(1);
    sender.setFocused(false);
    expect(sender.tick(268)?.moveX).toBe(0);
    sender.acknowledge(90);
    expect(sender.tick(468)?.sequence).toBe(91);
    expect(sent).toEqual([0, 1, 2, 3, 91]);
  });
});

describe('local authoritative reconciliation', () => {
  const initial = { position: [0, 0, 0] as [number, number, number], headingRad: 0, velocity: [0, 0, 0] as [number, number, number] };
  it('only removes acknowledged inputs and replays the remainder', () => {
    const state = new LocalReconciliation(initial);
    state.predictInput({ sequence: 1, moveX: 1, moveZ: 0, actions: [] }, .1);
    state.predictInput({ sequence: 2, moveX: 1, moveZ: 0, actions: [] }, .1);
    state.reconcile(initial, 1);
    expect(state.pending.map(value => value.input.sequence)).toEqual([2]);
    state.advance(.18);
    expect(state.current.position[0]).toBeCloseTo(.31);
  });
  it('bounds large correction to 180ms and explicitly snaps safety resets', () => {
    const state = new LocalReconciliation(initial);
    const authority = { ...initial, position: [10, 0, 0] as [number, number, number] };
    state.reconcile(authority, 1);
    expect(state.advance(.09).position[0]).toBeCloseTo(5);
    expect(state.advance(.09).position[0]).toBe(10);
    expect(state.reconcile(initial, 2, true)).toBe('safety-reset');
    expect(state.current.position).toEqual([0, 0, 0]);
    expect(state.reconcile(authority, 1)).toBe('stale');
  });
});

describe('schema patch boundary', () => {
  it('decodes empty valid state and rejects malformed replicated entities', () => {
    const state = { phase: 'playing', worldVersion: 'v1', serverTimeMs: 10, players: new Map<string, string>(), vehicles: new Map<string, string>() };
    expect(decodeRoomState(state)?.players).toEqual([]);
    state.players.set('guest_invalid', '{broken');
    expect(decodeRoomState(state)).toBeNull();
  });
});
