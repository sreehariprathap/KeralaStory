import { describe, expect, it } from 'vitest';
import { GOAT_LOOP, isOnPlayingArea } from '../src/game/world/goatRoute';
import { STADIUM } from '../src/content/world/stadiumLayout';

describe('stadium goat', () => {
  it('never walks onto the pitch or its run-off', () => {
    for (let i = 0; i < GOAT_LOOP.length; i++) {
      const a = GOAT_LOOP[i], b = GOAT_LOOP[(i + 1) % GOAT_LOOP.length];
      for (let t = 0; t <= 1; t += .05) expect(isOnPlayingArea(a.u + (b.u - a.u) * t, a.v + (b.v - a.v) * t), `leg ${i}`).toBe(false);
    }
  });
  it('stays near the stadium and spends time on the seats', () => {
    for (const stop of GOAT_LOOP) {
      expect(Math.abs(stop.u)).toBeLessThan(STADIUM.pad.halfWidth + 12);
      expect(Math.abs(stop.v)).toBeLessThan(STADIUM.pad.halfLength);
    }
    expect(GOAT_LOOP.filter(stop => typeof stop.y === 'number' && stop.y > 1).length).toBeGreaterThan(2);
  });
});
