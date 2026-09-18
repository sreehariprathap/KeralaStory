import { beforeEach, describe, expect, it } from 'vitest';
import { getLoadProgress, nextProgress, reportLoadProgress, resetLoadProgress, subscribeLoadProgress } from '../src/game/render/loadProgress';

describe('load progress', () => {
  beforeEach(() => resetLoadProgress());

  it('never moves backwards when more items are discovered', () => {
    expect(nextProgress(0, 5, 10)).toBe(0.5);
    expect(nextProgress(0.5, 6, 20)).toBe(0.5);
    expect(nextProgress(0.5, 18, 20)).toBe(0.9);
  });

  it('ignores empty totals and clamps to one', () => {
    expect(nextProgress(0.3, 0, 0)).toBe(0.3);
    expect(nextProgress(0.3, 12, 10)).toBe(1);
  });

  it('notifies subscribers and resets', () => {
    let calls = 0;
    const unsubscribe = subscribeLoadProgress(() => { calls++; });
    reportLoadProgress(1, 4);
    expect(getLoadProgress()).toBe(0.25);
    expect(calls).toBe(1);
    resetLoadProgress();
    expect(getLoadProgress()).toBe(0);
    unsubscribe();
    reportLoadProgress(2, 4);
    expect(calls).toBe(2);
  });
});
