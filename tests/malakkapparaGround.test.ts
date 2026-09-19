import { describe, expect, it } from 'vitest';
import { V2_LAYOUT, V2_ROUTES, terrainHeight } from '../src/content/world/definition';

const town = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!, padY = town.center[1];
describe('Malakkappara ground', () => {
  it('carries the main road at pad height through town', () => {
    const road = V2_ROUTES.find(r => r.id === 'malakkappara-road')!;
    for (const p of road.points.filter(p => p[2] < -628)) expect(Math.abs(p[1] - padY)).toBeLessThan(.35);
  });
  it('drops off the fill edges within a few metres instead of a long sag', () => {
    // East edge above the valley: pad at x=-497, valley floor 6 m out.
    expect(Math.abs(terrainHeight(-497, -650) - padY)).toBeLessThan(.2);
    expect(padY - terrainHeight(-489, -650)).toBeGreaterThan(6);
  });
});
