import { describe, expect, it } from 'vitest';
import { playCollectChime } from '../src/game/collectables/collectChime';

describe('collect chime', () => {
  it('does nothing and throws nothing when audio is unavailable', () => {
    expect(() => playCollectChime('coin', { muted: false, volume: .5 })).not.toThrow();
  });

  it('stays silent when muted', () => {
    let created = 0;
    const original = globalThis.AudioContext;
    // @ts-expect-error test double
    globalThis.AudioContext = class { constructor() { created++; } };
    playCollectChime('coin', { muted: true, volume: 1 });
    globalThis.AudioContext = original;
    expect(created).toBe(0);
  });
});
