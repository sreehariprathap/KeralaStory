import { describe, expect, it } from 'vitest';
import { STADIUM, isInStadiumJoin, isStadiumGround, stadiumToWorld, worldToStadium } from '../src/content/world/stadiumLayout';
import { terrainHeight, isWater, V2_LAYOUT } from '../src/content/world/definition';
import { pointInPolygon } from '../src/content/world/expansionLayout';
import { canKick, dribbleVelocity, goalScored, hasLeftGround, isOutOfPlay, kickVelocity, restartSpot } from '../src/game/soccer/soccerRules';
import { isStuntGround, stuntSites } from '../src/game/world/stuntSites';

const at = (u: number, v: number) => stadiumToWorld(u, v);

describe('football ground', () => {
  it('round-trips pitch coordinates', () => {
    const p = at(7, -12), back = worldToStadium(p.x, p.z);
    expect(back.u).toBeCloseTo(7); expect(back.v).toBeCloseTo(-12);
  });
  it('sits on a level, dry pad near Kodakara, clear of stunt ramps', () => {
    for (let u = -STADIUM.pad.halfWidth; u <= STADIUM.pad.halfWidth; u += 5) for (let v = -STADIUM.pad.halfLength; v <= STADIUM.pad.halfLength; v += 5) {
      const p = at(u, v);
      expect(Math.abs(terrainHeight(p.x, p.z) - STADIUM.groundY)).toBeLessThan(.05);
      expect(isWater(p.x, p.z)).toBe(false);
    }
    const kodakara = V2_LAYOUT.towns.find(t => t.id === 'kodakara')!;
    expect(pointInPolygon(STADIUM.center.x, STADIUM.center.z, kodakara.footprint)).toBe(false);
    expect(Math.hypot(STADIUM.center.x - kodakara.center[0], STADIUM.center.z - kodakara.center[2])).toBeLessThan(250);
    for (const site of stuntSites()) for (const ramp of site.ramps) expect(isStadiumGround(ramp.entry[0], ramp.entry[2], STADIUM.pad.blend)).toBe(false);
    expect(isStuntGround(STADIUM.center.x, STADIUM.center.z)).toBe(true);
  });
  it('has a join circle beside the halfway line', () => {
    const p = at(STADIUM.join.u, STADIUM.join.v);
    expect(isInStadiumJoin(p.x, p.z)).toBe(true);
    const centre = at(0, 0);
    expect(isInStadiumJoin(centre.x, centre.z)).toBe(false);
  });
});

describe('football rules', () => {
  it('scores only between the posts, under the bar and past the line', () => {
    const inSouth = at(0, STADIUM.pitch.halfLength + 1), inNorth = at(1, -STADIUM.pitch.halfLength - 1);
    expect(goalScored(inSouth.x, .3, inSouth.z)).toBe('south');
    expect(goalScored(inNorth.x, .3, inNorth.z)).toBe('north');
    expect(goalScored(inSouth.x, 3, inSouth.z)).toBeNull();
    const wide = at(STADIUM.goal.halfWidth + 1, STADIUM.pitch.halfLength + 1);
    expect(goalScored(wide.x, .3, wide.z)).toBeNull();
    const onLine = at(0, STADIUM.pitch.halfLength);
    expect(goalScored(onLine.x, .3, onLine.z)).toBeNull();
  });
  it('restarts out-of-play balls on the pitch', () => {
    const side = at(STADIUM.pitch.halfWidth + STADIUM.runoff + 1, 10);
    expect(isOutOfPlay(side.x, side.z)).toBe(true);
    const spot = restartSpot(side.x, side.z), local = worldToStadium(spot.x, spot.z);
    expect(Math.abs(local.u)).toBeLessThan(STADIUM.pitch.halfWidth);
    expect(local.v).toBeCloseTo(10);
    const behind = at(12, STADIUM.pitch.halfLength + STADIUM.runoff + 1), goalKick = worldToStadium(restartSpot(behind.x, behind.z).x, restartSpot(behind.x, behind.z).z);
    expect(goalKick.u).toBeCloseTo(0); expect(goalKick.v).toBeLessThan(STADIUM.pitch.halfLength);
    const centre = at(0, 0);
    expect(isOutOfPlay(centre.x, centre.z)).toBe(false);
  });
  it('kicks harder and higher with charge, along the heading', () => {
    const tap = kickVelocity(Math.PI / 2, 0), full = kickVelocity(Math.PI / 2, 1);
    expect(tap.x).toBeGreaterThan(0); expect(Math.abs(tap.z)).toBeLessThan(1e-9);
    expect(full.x).toBeGreaterThan(tap.x); expect(full.y).toBeGreaterThan(tap.y);
  });
  it('only kicks a ball within reach and not behind the player', () => {
    const player = { x: 0, z: 0, headingRad: 0 }; // facing −z
    expect(canKick(player, { x: 0, z: -1 })).toBe(true);
    expect(canKick(player, { x: 0, z: 1.5 })).toBe(false);
    expect(canKick(player, { x: 0, z: -3 })).toBe(false);
  });
  it('dribbles a ball the player runs into, keeping it ahead', () => {
    const player = { x: 0, z: 0, headingRad: 0, speed: 5 };
    const push = dribbleVelocity(player, { x: 0, y: 0, z: -.5 }, { x: 0, y: 0, z: 0 })!;
    expect(push.z).toBeLessThan(-4);
    expect(dribbleVelocity({ ...player, speed: 0 }, { x: 0, y: 0, z: -.5 }, { x: 0, y: 0, z: 0 })).toBeNull();
    expect(dribbleVelocity(player, { x: 0, y: 0, z: -3 }, { x: 0, y: 0, z: 0 })).toBeNull();
  });
  it('ends the match only well off the ground', () => {
    const near = at(STADIUM.pad.halfWidth + 5, 0), far = at(STADIUM.pad.halfWidth + 30, 0);
    expect(hasLeftGround(near.x, near.z)).toBe(false);
    expect(hasLeftGround(far.x, far.z)).toBe(true);
  });
});
