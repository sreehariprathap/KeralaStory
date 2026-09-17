import { describe, expect, it } from 'vitest';
import { GLIDER, THERMAL_CEILING_FADE, createGliderState, gliderLanding, headingToward, liftAt, stepGlider, turnToward, type Thermal } from '../src/game/vehicle/gliderMotor';

const dt = 1 / 60;
const fly = (seconds: number, intent = { steer: 0, pitch: 0, lift: 0 }, state = createGliderState(0)) => {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < Math.round(seconds / dt); i++) { const d = stepGlider(state, intent, dt); x += d.x; y += d.y; z += d.z; }
  return { state, x, y, z };
};

describe('glider motor', () => {
  it('holds altitude briefly after launch so the pilot clears the lip', () => {
    const { y } = fly(GLIDER.launchHoldSeconds - .1);
    expect(y).toBe(0);
  });

  it('settles into the cruise glide ratio (about 8:1)', () => {
    const { state } = fly(10);
    let horizontal = 0, drop = 0;
    for (let i = 0; i < 600; i++) { const d = stepGlider(state, { steer: 0, pitch: 0, lift: 0 }, dt); horizontal += Math.hypot(d.x, d.z); drop -= d.y; }
    expect(state.speed).toBeCloseTo(GLIDER.cruiseSpeed);
    expect(horizontal / drop).toBeGreaterThan(7.5);
    expect(horizontal / drop).toBeLessThan(8.3);
  });

  it('dives faster and sinks harder than a flare', () => {
    const dive = fly(12, { steer: 0, pitch: 1, lift: 0 }).state, flare = fly(12, { steer: 0, pitch: -1, lift: 0 }).state;
    expect(dive.speed).toBeCloseTo(GLIDER.diveSpeed);
    expect(flare.speed).toBeCloseTo(GLIDER.flareSpeed);
    expect(dive.verticalSpeed).toBeCloseTo(-GLIDER.diveSink);
    expect(flare.verticalSpeed).toBeCloseTo(-GLIDER.flareSink);
  });

  it('clamps the turn rate and banks into the turn', () => {
    const { state } = fly(1, { steer: 5, pitch: 0, lift: 0 });
    expect(state.headingRad).toBeCloseTo(GLIDER.turnRate, 5);
    expect(state.bank).toBeGreaterThan(0);
    expect(state.bank).toBeLessThanOrEqual(GLIDER.maxBank);
  });

  it('flies forward along the controller heading convention', () => {
    const north = fly(1, undefined, createGliderState(0));
    expect(north.z).toBeLessThan(0);
    expect(Math.abs(north.x)).toBeLessThan(1e-9);
    expect(headingToward(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2);
    expect(turnToward(0, Math.PI, .1)).toBeCloseTo(.1);
  });

  it('climbs in strong lift', () => {
    const { state } = fly(10, { steer: 0, pitch: 0, lift: 4 });
    expect(state.verticalSpeed).toBeCloseTo(4 - GLIDER.cruiseSink);
  });

  it('is identical regardless of step batching', () => {
    const run = (batch: number) => { const s = createGliderState(1); let z = 0; for (let i = 0; i < 600; i += batch) for (let j = 0; j < batch; j++) z += stepGlider(s, { steer: .3, pitch: .2, lift: 1 }, dt).z; return z; };
    expect(run(1)).toBeCloseTo(run(4), 8);
  });
});

describe('thermal lift', () => {
  const thermal: Thermal = { id: 't', x: 0, z: 0, radiusM: 20, liftMps: 4, ceilingY: 100 };
  it('is strongest at the centre and zero at the edge', () => {
    expect(liftAt([thermal], 0, 0, 0)).toBe(4);
    expect(liftAt([thermal], 10, 0, 0)).toBeCloseTo(3);
    expect(liftAt([thermal], 20, 0, 0)).toBe(0);
    expect(liftAt([thermal], 30, 0, 0)).toBe(0);
  });
  it('fades out below the ceiling', () => {
    expect(liftAt([thermal], 0, 100, 0)).toBe(0);
    expect(liftAt([thermal], 0, 120, 0)).toBe(0);
    expect(liftAt([thermal], 0, 100 - THERMAL_CEILING_FADE / 2, 0)).toBeCloseTo(2);
  });
  it('lets a circling pilot gain height', () => {
    const state = createGliderState(0);
    state.launchHold = 0;
    let x = 0, y = 0, z = 0;
    // Start on the circle a full-steer turn traces, so the pilot stays inside the column.
    const radius = GLIDER.cruiseSpeed / GLIDER.turnRate;
    x = -radius; z = 0;
    for (let i = 0; i < 60 * 40; i++) { const d = stepGlider(state, { steer: 1, pitch: 0, lift: liftAt([{ ...thermal, x: 0, z: 0 }], x, y, z) }, dt); x += d.x; y += d.y; z += d.z; }
    expect(y).toBeGreaterThan(15);
  });
});

describe('landing', () => {
  const cruising = { airTime: 5, speed: GLIDER.cruiseSpeed, verticalSpeed: -GLIDER.cruiseSink };
  it('keeps flying until close to the ground', () => {
    expect(gliderLanding(cruising, 20, 10, false)).toBe('fly');
    expect(gliderLanding(cruising, 10.2, 10, false)).toBe('land');
    expect(gliderLanding(cruising, 30, 10, true)).toBe('land');
    expect(gliderLanding(cruising, 30, null, false)).toBe('fly');
  });
  it('ignores ground contact right after launch', () => {
    expect(gliderLanding({ ...cruising, airTime: .1 }, 10, 10, true)).toBe('fly');
  });
  it('flags fast touchdowns as rough', () => {
    expect(gliderLanding({ ...cruising, speed: GLIDER.diveSpeed, verticalSpeed: -GLIDER.diveSink }, 10, 10, true)).toBe('rough');
  });
});
