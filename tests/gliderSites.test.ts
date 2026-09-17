import { describe, expect, it } from 'vitest';
import { EXPANSION_LAYOUT, hasGroundAt, isTravelAllowed, isWater, terrainHeight } from '../src/content/world/definition';
import { GLIDER_LAUNCH, THERMALS, isInGliderLaunch, thermalLift } from '../src/content/world/gliderSites';
import { GLIDER } from '../src/game/vehicle/gliderMotor';

const glideRatio = GLIDER.cruiseSpeed / GLIDER.cruiseSink;

describe('glider launch site', () => {
  it('sits on the summit top on dry ground', () => {
    const [x, y, z] = GLIDER_LAUNCH.position, summit = EXPANSION_LAYOUT.summitPosition;
    expect(Math.hypot(x - summit[0], z - summit[2])).toBeLessThan(6);
    expect(Math.abs(y - summit[1])).toBeLessThan(1);
    expect(isTravelAllowed('foot', x, z)).toBe(true);
    expect(isInGliderLaunch(x, z)).toBe(true);
    expect(isInGliderLaunch(x + GLIDER_LAUNCH.radiusM + .1, z)).toBe(false);
  });

  it('faces downhill so the launch clears the lip', () => {
    const [x, y, z] = GLIDER_LAUNCH.position, h = GLIDER_LAUNCH.headingRad;
    // Launch speed held for the launch window, then keep checking the cruise glide path.
    for (let d = 8; d <= 200; d += 4) {
      const px = x + Math.sin(h) * d, pz = z - Math.cos(h) * d;
      const heldFor = GLIDER.launchSpeed * GLIDER.launchHoldSeconds;
      const flightY = y + 1 - Math.max(0, d - heldFor) / glideRatio;
      expect(flightY - terrainHeight(px, pz), `clearance ${d} m out`).toBeGreaterThan(.5);
    }
  });
});

describe('thermals', () => {
  it('stand over dry ground inside the map', () => {
    expect(THERMALS.length).toBeGreaterThanOrEqual(5);
    for (const t of THERMALS) {
      expect(hasGroundAt(t.x, t.z), t.id).toBe(true);
      expect(isWater(t.x, t.z), t.id).toBe(false);
      expect(t.ceilingY, t.id).toBeGreaterThan(terrainHeight(t.x, t.z) + 60);
    }
  });

  it('give lift near their centres and none far away', () => {
    for (const t of THERMALS) expect(thermalLift(t.x, terrainHeight(t.x, t.z) + 20, t.z), t.id).toBeGreaterThan(3);
    const [x, y, z] = GLIDER_LAUNCH.position;
    expect(thermalLift(x, y + 1, z)).toBe(0);
  });

  it('form a chain every thermal can be reached along from the summit', () => {
    const [sx, sy, sz] = GLIDER_LAUNCH.position;
    const arrivalMargin = 25;
    const reached = new Set<string>();
    const frontier: { x: number; z: number; y: number }[] = [{ x: sx, z: sz, y: sy }];
    while (frontier.length) {
      const from = frontier.pop()!;
      for (const t of THERMALS) {
        if (reached.has(t.id)) continue;
        const arrive = from.y - Math.hypot(t.x - from.x, t.z - from.z) / glideRatio;
        if (arrive - terrainHeight(t.x, t.z) > arrivalMargin) { reached.add(t.id); frontier.push({ x: t.x, z: t.z, y: t.ceilingY - 15 }); }
      }
    }
    expect([...reached].sort()).toEqual(THERMALS.map(t => t.id).sort());
  });
});
