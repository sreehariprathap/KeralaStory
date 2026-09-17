import { describe, expect, it } from 'vitest';
import { COLLECT_VALUE, collect, createCollectState, isCollected, rollOver, todayKey } from '../src/game/collectables/collectState';
import type { CollectItem } from '../src/game/collectables/types';

const coin = (id: string): CollectItem => ({ id, kind: 'coin', x: 0, y: 0, z: 0 });
const heart: CollectItem = { id: 'heart:jetty', kind: 'heart', x: 1, y: 2, z: 3 };

describe('collect state', () => {
  it('uses local time for the date key, not UTC', () => {
    // 2026-03-01T00:30 local time, whatever the runner's zone is.
    const local = new Date(2026, 2, 1, 0, 30, 0);
    expect(todayKey(local)).toBe('2026-03-01');
  });

  it('values a coin at 1, a heart at 10 and money at 25', () => {
    expect(COLLECT_VALUE).toEqual({ coin: 1, heart: 10, money: 25 });
  });

  it('adds a coin once and ignores a repeat of the same id', () => {
    const start = createCollectState(new Date(2026, 8, 16, 12));
    const once = collect(start, coin('coin:2026-09-16:4'));
    const twice = collect(once, coin('coin:2026-09-16:4'));
    expect(once.coins).toBe(1);
    expect(twice.coins).toBe(1);
    expect(twice.collectedIds).toEqual(['coin:2026-09-16:4']);
  });

  it('adds ten coins for a heart', () => {
    const start = createCollectState(new Date(2026, 8, 16, 12));
    expect(collect(start, heart).coins).toBe(10);
  });

  it('reports collected ids', () => {
    const state = collect(createCollectState(new Date(2026, 8, 16, 12)), heart);
    expect(isCollected(state, 'heart:jetty')).toBe(true);
    expect(isCollected(state, 'heart:quay')).toBe(false);
  });

  it('clears collected ids on a new day but keeps the wallet', () => {
    const state = collect(createCollectState(new Date(2026, 8, 16, 12)), heart);
    const next = rollOver(state, '2026-09-17');
    expect(next.coins).toBe(10);
    expect(next.collectedIds).toEqual([]);
    expect(next.dateKey).toBe('2026-09-17');
  });

  it('is a no-op when the date key has not changed', () => {
    const state = collect(createCollectState(new Date(2026, 8, 16, 12)), heart);
    expect(rollOver(state, state.dateKey)).toBe(state);
  });
});
