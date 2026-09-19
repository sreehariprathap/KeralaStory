import { describe, expect, it } from 'vitest';
import { V2_LAYOUT, V2_ROUTES, hasGroundAt, isWater, terrainHeight, waterLevelAt } from '../src/content/world/definition';
import { CHALAKKUDY_BRIDGES, bridgeFrame } from '../src/content/world/chalakkudyCityPlan';

const bridge = () => CHALAKKUDY_BRIDGES.find(b => b.id === 'malakkappara-river-bridge')!;

describe('Malakkappara river bridge', () => {
  it('spans the river with air under the deck', () => {
    const b = bridge(), frame = bridgeFrame(b);
    let overWater = 0;
    for (let along = 2; along < frame.length - 2; along += 1) {
      const x = b.from[0] + frame.ux * along, z = b.from[2] + frame.uz * along;
      const water = waterLevelAt(x, z);
      if (water === null) continue;
      overWater++;
      // The visible slab hangs 1.5 m below the deck line.
      expect(frame.heightAt(along) - 1.5 - water, `${along} m along`).toBeGreaterThan(1.5);
    }
    expect(overWater).toBeGreaterThan(10);
  });
  it('lands both ends on dry ground at its roads\' height', () => {
    const b = bridge();
    for (const [end, roadId] of [[b.from, 'malakkappara-market-road'], [b.to, 'malakkappara-west-road']] as const) {
      const [x, y, z] = end;
      expect(hasGroundAt(x, z)).toBe(true);
      expect(isWater(x, z)).toBe(false);
      const road = V2_ROUTES.find(r => r.id === roadId)!;
      const nearest = road.points.reduce((best, p) => Math.hypot(p[0] - x, p[2] - z) < Math.hypot(best[0] - x, best[2] - z) ? p : best);
      expect(Math.abs(nearest[1] - y)).toBeLessThan(.4);
      expect(Math.abs(terrainHeight(x, z) - y)).toBeLessThan(1.2);
    }
  });
  it('levels a west-bank district for the new quarter', () => {
    const town = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!;
    const district = town.districts?.find(d => d.id === 'malakkappara-west-bank');
    expect(district?.y).toBe(77);
    // Clear of the west road's own blend, the district pad is level.
    expect(Math.abs(terrainHeight(-740, -645) - 77)).toBeLessThan(.3);
    expect(Math.abs(terrainHeight(-716, -696) - 77)).toBeLessThan(.3);
  });
});
