import { describe, expect, it } from 'vitest';
import { createDprGovernor, frameloopFor, renderProfile } from '../src/game/render/renderBudget';

const feed = (governor: ReturnType<typeof createDprGovernor>, frameMs: number, seconds: number) => {
  const changes: number[] = [];
  for (let t = 0; t < seconds * 1000; t += frameMs) { const next = governor.sample(frameMs); if (next !== null) changes.push(next); }
  return changes;
};

describe('render profile', () => {
  it('never exceeds the device pixel ratio and caps phones lower than desktops', () => {
    expect(renderProfile('high', false, 3).dprMax).toBe(2);
    expect(renderProfile('high', true, 3).dprMax).toBe(1.5);
    expect(renderProfile('medium', true, 3).dprMax).toBe(1.25);
    expect(renderProfile('high', false, 1).dprMax).toBe(1);
  });
  it('drops antialiasing and shadows on low, and redraws medium shadows every other frame', () => {
    expect(renderProfile('low', true, 3)).toMatchObject({ antialias: false, shadows: false, dprMax: 1 });
    expect(renderProfile('medium', false, 2)).toMatchObject({ shadows: true, shadowMapSize: 1024, shadowInterval: 2 });
    expect(renderProfile('high', false, 2)).toMatchObject({ shadowMapSize: 2048, shadowInterval: 1 });
  });
});

describe('resolution governor', () => {
  it('holds steady at a comfortable frame rate', () => {
    const governor = createDprGovernor(.75, 1.5);
    expect(feed(governor, 16, 10)).toEqual([]);
    expect(governor.dpr).toBe(1.5);
  });
  it('steps down under sustained load, but never below the floor', () => {
    const governor = createDprGovernor(.75, 1.5);
    const changes = feed(governor, 33, 30);
    expect(changes[0]).toBeCloseTo(1.275, 1);
    expect(changes.every((value, i) => i === 0 || value < changes[i - 1])).toBe(true);
    expect(governor.dpr).toBe(.75);
  });
  it('recovers slowly once there is headroom', () => {
    const governor = createDprGovernor(.75, 1.5, .75);
    const changes = feed(governor, 8, 45);
    expect(changes.length).toBeGreaterThan(2);
    expect(governor.dpr).toBe(1.5);
    // Two fast windows per step, plus a cooldown: no faster than one step every ~4.5 s.
    expect(feed(createDprGovernor(.75, 1.5, .75), 8, 4)).toHaveLength(1);
  });
  it('ignores hitches and invalid samples', () => {
    const governor = createDprGovernor(.75, 1.5);
    for (let i = 0; i < 20; i++) expect(governor.sample(i % 2 ? 400 : Number.NaN)).toBeNull();
    expect(governor.dpr).toBe(1.5);
  });
});

describe('frame loop', () => {
  it('stops when hidden, renders on demand behind pause and map, and runs otherwise', () => {
    expect(frameloopFor(true, true, 'playing')).toBe('never');
    expect(frameloopFor(false, true, 'paused')).toBe('demand');
    expect(frameloopFor(false, true, 'map')).toBe('demand');
    expect(frameloopFor(false, true, 'playing')).toBe('always');
    expect(frameloopFor(false, true, 'loading')).toBe('always');
    expect(frameloopFor(false, false, 'menu')).toBe('always');
  });
});
