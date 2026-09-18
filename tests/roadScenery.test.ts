import { describe, expect, it } from 'vitest';
import { EXPANSION_LAYOUT, V2_ROUTES, EXPANSION_GROUND, terrainHeight } from '../src/content/world/definition';
import { coconutCandidates } from '../src/game/world/coconutPlacement';
import { flowerPatches } from '../src/game/world/flowerPlacement';
import { chokkanaForest } from '../src/game/world/chokkanaForest';
import { generatePlants } from '../src/game/world/KeralaWorld';
import { generateForest } from '../src/game/world/KodasseryWorld';
import { createRouteRibbon } from '../src/game/world/routeVisualGeometry';
import { stuntSites } from '../src/game/world/stuntSites';

const routes = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES];
/** Distance from (x, z) to the nearest paved surface: road edges (incl. shoulder) and bridge decks. */
function clearance(x: number, z: number) {
  let best = Infinity;
  for (const route of routes) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) - route.widthM / 2);
  }
  if (EXPANSION_GROUND.v2!.bridgeDeckAt(x, z) !== null) best = Math.min(best, 0);
  return best;
}

describe('roads stay clear of scenery and above the ground', () => {
  it('never places a palm, tree, shrub, flower or grass tuft on a road or bridge', () => {
    const plants: [string, number, number, number][] = [
      ...coconutCandidates([1], [[1, 1]]).map(p => ['palm', p.x, p.z, 4] as [string, number, number, number]),
      ...chokkanaForest(850).map(t => ['forest', t.position[0], t.position[2], 4] as [string, number, number, number]),
      ...flowerPatches([1], [[.3, .5]]).map(f => ['flower', f.x, f.z, .5] as [string, number, number, number]),
      ...generatePlants().trunks.map(t => ['village palm', t.position[0], t.position[2], 3] as [string, number, number, number]),
      ...generatePlants().shrubs.map(t => ['shrub', t.position[0], t.position[2], 1.5] as [string, number, number, number]),
      ...generateForest().trunks.map(t => ['kodassery tree', t.position[0], t.position[2], 3] as [string, number, number, number]),
      ...generateForest().grass.map(t => ['grass', t.position[0], t.position[2], .3] as [string, number, number, number]),
    ];
    const onRoad = plants.filter(([, x, z, radius]) => clearance(x, z) < radius);
    expect(onRoad.map(([kind, x, z]) => `${kind} @ ${x.toFixed(1)},${z.toFixed(1)}`)).toEqual([]);
  });

  it('keeps stunt ramps off the new roads', () => {
    for (const site of stuntSites()) for (const ramp of site.ramps) expect(clearance(ramp.entry[0], ramp.entry[2]), site.id).toBeGreaterThan(2);
  });

  it('lays every road surface above the ground it covers', () => {
    const heightAt = (x: number, z: number) => Math.max(EXPANSION_GROUND.deckHeightAt(x, z) ?? -Infinity, terrainHeight(x, z));
    // Foot trails follow rough ground by design; this guards the driveable network.
    for (const route of routes.filter(r => r.allowedModes.includes('car'))) {
      const mesh = createRouteRibbon(route, routes, heightAt, { surface: [0, 0, 0], shoulder: [0, 0, 0] });
      let worst = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const v = [0, 1, 2].map(k => mesh.positions.slice(mesh.indices[i + k] * 3, mesh.indices[i + k] * 3 + 3));
        const p = [0, 1, 2].map(k => (v[0][k] + v[1][k] + v[2][k]) / 3);
        // Bridge decks are drawn by their own structure; skip their footprint edges.
        if (EXPANSION_GROUND.deckHeightAt(p[0], p[2]) !== null) continue;
        worst = Math.max(worst, terrainHeight(p[0], p[2]) - p[1]);
      }
      expect(worst, route.id).toBeLessThanOrEqual(.1);
    }
  });
});
