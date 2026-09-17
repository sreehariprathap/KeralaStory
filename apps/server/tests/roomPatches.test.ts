import { expect, it } from 'vitest';
import { RoomState } from '../src/roomState.ts';
import { projectSnapshot } from '../src/patchProjector.ts';
import { RoomMetrics } from '../src/metrics.ts';
import { fullRoomSnapshot } from '../../../packages/protocol/tests/fixtures.ts';
it('projects only DTO entities and removes expired guests', () => {
  const state = new RoomState();
  projectSnapshot(state, fullRoomSnapshot);
  expect(JSON.parse(state.players.get('guest_maya1234') as string).displayName).toBe('മായ 🌴');
  expect(state.players.size).toBe(1);
  projectSnapshot(state, { ...fullRoomSnapshot, players: [], vehicles: [] });
  expect(state.players.size).toBe(0); expect(state.vehicles.size).toBe(0);
});
it('reports bounded numeric metrics without message bodies or tokens', () => {
  const metrics = new RoomMetrics();
  metrics.sample('tickMs', 1); metrics.sample('tickMs', 5); metrics.sample('tickMs', 30);
  metrics.increment('rejectedChat');
  expect(metrics.snapshot().tickMs).toEqual({ count: 3, median: 5, p95: 30 });
  expect(Object.keys(metrics.snapshot()).sort()).toEqual(['activeGuests', 'closeReason', 'joins', 'occupancy', 'patchBytes', 'reconnects', 'rejectedChat', 'rejectedInput', 'rttMs', 'tickMs'].sort());
});
