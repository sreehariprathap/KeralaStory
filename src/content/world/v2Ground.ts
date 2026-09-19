import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { WorldV2Layout } from '../../contracts/worldV2';
import { roundedPath, pointInPolygon } from './expansionLayout';
import { createRouteField } from '../../game/world/expansionTerrain';
import { createRiverField } from '../../game/world/riverGeometry';
import { STADIUM, stadiumRectDistance } from './stadiumLayout';
import { cityBridgeAbutment, cityBridgeCeiling, cityBridgeDeckAt, cityBridgeUnderside } from './chalakkudyCityPlan';
import { SNEHA_HEADLAND, coastDistance } from './snehaTheeram';
import { MALAKKAPPARA_FILL_BLEND_M } from './malakkapparaPlan';

/** Sea level shared with the original world (definition.ts re-exports the same value). */
const WATER_LEVEL = 8;

const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
/** Roads whose sides are graded into broad, gentle slopes. */
export const GRADED_SIDE_ROADS = new Set(['chalakudy-dam-road', 'malakkappara-road']);

/** Round road bends while interpolating elevations along the original control profile. */
export function createV2Routes(layout: WorldV2Layout): ExpansionRoute[] {
  return layout.roads.map(road => {
    const controls = road.points;
    const flat = roundedPath(controls.map(p => [p[0], p[2]]), 28);
    const profile = controls.map((p, i) => i ? Math.hypot(p[0] - controls[i - 1][0], p[2] - controls[i - 1][2]) : 0);
    for (let i = 1; i < profile.length; i++) profile[i] += profile[i - 1];
    const distances = flat.map((p, i) => i ? Math.hypot(p[0] - flat[i - 1][0], p[1] - flat[i - 1][1]) : 0);
    for (let i = 1; i < distances.length; i++) distances[i] += distances[i - 1];
    const points = flat.map((p, i): [number, number, number] => {
      const along = distances[i] / distances.at(-1)! * profile.at(-1)!;
      let j = 1; while (j < profile.length - 1 && profile[j] < along) j++;
      const t = (along - profile[j - 1]) / (profile[j] - profile[j - 1]);
      return [p[0], controls[j - 1][1] + t * (controls[j][1] - controls[j - 1][1]), p[1]];
    });
    return { id: road.id, points, widthM: road.widthM, shoulderM: .75, allowedModes: ['foot', 'bicycle', 'car'] };
  });
}

export function createV2GroundProfile(layout: WorldV2Layout) {
  const routes = createV2Routes(layout), river = createRiverField(layout.riverReaches);
  // Turning circles join the road field as tiny round 'roads', so terrain, scenery and travel rules treat them as road.
  const caps: ExpansionRoute[] = layout.roadCaps.map(cap => ({
    id: cap.id, points: [cap.center, [cap.center[0] + .01, cap.center[1], cap.center[2]]], widthM: cap.radius * 2, shoulderM: .75, allowedModes: ['foot', 'bicycle', 'car'],
  }));
  const field = createRouteField([...routes, ...caps]);
  // Mountain roads whose sides are graded as broad, easy slopes (tea is planted on them) rather than
  // the standard 12 m verge: the verge widens with the cut or fill so no bank is steeper than ~1 in 3.
  const hillRoads = createRouteField(routes.filter(r => GRADED_SIDE_ROADS.has(r.id)), 60);
  const sites = [...layout.towns.filter(t => !t.existing), layout.park, layout.airport];
  // Extra town districts level to their own height.
  const districts = layout.towns.flatMap(t => t.districts ?? []).flatMap(d => d.y === undefined ? [] : [{ footprint: d.footprint, center: [0, d.y, 0] as const }]);
  const southShoreZ = layout.riverNodes.find(n => n.id === 'main-outlet')!.position[2];
  const plungePool = layout.riverReaches.find(r => r.id === 'chalakudy-plunge-pool');
  const poolCenter = plungePool ? { x: plungePool.points[0][0], y: plungePool.points[0][1], z: (plungePool.points[0][2] + plungePool.points.at(-1)![2]) / 2, radius: (plungePool.points.at(-1)![2] - plungePool.points[0][2]) / 2 } : null;
  /** Preserve the original corridor, except the already separate terrain to its north/west. */
  const apply = (x: number, z: number, previous: number): number => {
    // The original world owns its own ground; south of its coast (z > 92) the shared x = -78 edge is ours.
    if (x >= -78 && z >= -481 && z <= 92) return previous;
    let y = previous;
    if (z > -260) {
      const lowland = Math.max(10, 49 - (z + 120) * .12) + Math.sin(x * .012) * 1.5;
      const blend = smooth((z + 260) / 50);
      y = y * (1 - blend) + lowland * blend;
    }
    // Sneha Theeram: a gentle sand slope up from the waterline, the sea floor falling away below it.
    const coast = coastDistance(x, z);
    if (coast !== null) {
      if (coast < 0) y = Math.min(y, Math.max(3.5, WATER_LEVEL - .9 + coast * .16));
      else {
        // Under Kodaly's headland (where NH 544 loops high above the bay) the shore climbs as a grassy
        // bluff instead of a flat beach, so the road's embankment never stands as a sheer wall.
        const headland = 1 - smooth((Math.hypot(x - SNEHA_HEADLAND[0], z - SNEHA_HEADLAND[1]) - 30) / 90);
        const beach = WATER_LEVEL + .35 + coast * (.06 + .34 * headland), blend = 1 - smooth((coast - 30) / 45);
        y = y * (1 - blend) + beach * blend;
      }
    }
    for (const site of [...sites, ...districts]) {
      const xs = site.footprint.map(p => p[0]), zs = site.footprint.map(p => p[1]);
      const dx = Math.max(Math.min(...xs) - x, 0, x - Math.max(...xs));
      const dz = Math.max(Math.min(...zs) - z, 0, z - Math.max(...zs));
      // Malakkappara's pad drops to lower ground over a short step, faced by its dry-stone walls; cuts
      // into the hill (and every other site) keep the long, easy slope.
      const walled = 'id' in site && site.id === 'malakkappara' && y < site.center[1];
      const blend = 1 - smooth(Math.hypot(dx, dz) / (walled ? MALAKKAPPARA_FILL_BLEND_M : 25));
      y = y * (1 - blend) + site.center[1] * blend;
    }
    // The football ground is levelled like a town site, with a shorter blend.
    const pitchBlend = 1 - smooth(stadiumRectDistance(x, z, STADIUM.pad.halfWidth, STADIUM.pad.halfLength) / STADIUM.pad.blend);
    if (pitchBlend > 0) y = y * (1 - pitchBlend) + STADIUM.groundY * pitchBlend;
    // The dam's plunge pool sits in a broad grassy bowl: low ground around it is raised into an apron a
    // little above the water, so the pool never stands on a thin berm above the valley to its west.
    if (poolCenter) {
      const rim = 1 - smooth((Math.hypot(x - poolCenter.x, z - poolCenter.z) - poolCenter.radius - 8) / 26);
      if (rim > 0) y = Math.max(y, y * (1 - rim) + (poolCenter.y + 1.4) * rim);
    }
    const bank = river.nearest(x, z), surface = river.surfaceAt(x, z);
    if (bank) {
      const blend = 1 - smooth((bank.distance - bank.halfWidth) / 20);
      if (blend > 0) {
        const bed = bank.height - 3 + 6 * smooth((bank.distance - bank.halfWidth + 5) / 12);
        // Beyond the end of a lake band (the reservoir's face against the dam) banks may only dig, never
        // build up: otherwise the lake's bank would fill the gorge in front of the dam wall.
        const lakeEnd = bank.segment.kind === 'pool' && (bank.t <= 0 || bank.t >= 1);
        y = lakeEnd ? Math.min(y, y * (1 - blend) + bed * blend) : y * (1 - blend) + bed * blend;
      }
    }
    if (surface !== null) y = Math.min(y, surface - 2.5);
    const hill = hillRoads(x, z);
    if (hill) {
      const verge = Math.max(12, Math.min(48, Math.abs(hill.height - y) / .32));
      const blend = 1 - smooth((hill.distance - hill.width - 2) / verge);
      y = y * (1 - blend) + hill.height * blend;
    }
    const road = field(x, z);
    if (road) {
      const blend = 1 - smooth((road.distance - road.width - 2) / 12);
      y = y * (1 - blend) + road.height * blend;
    }
    // A widened verge must never fill a lake or river bed.
    if (surface !== null) y = Math.min(y, surface - 2.5);
    // Nothing may fill a bridge span: dig out anything that would reach the underside of a deck.
    const underside = cityBridgeUnderside(x, z);
    if (underside && underside.target < y) y = y * (1 - underside.weight) + Math.min(y, underside.target) * underside.weight;
    const abutment = cityBridgeAbutment(x, z);
    if (abutment) y = y * (1 - abutment.weight) + abutment.target * abutment.weight;
    const ceiling = cityBridgeCeiling(x, z);
    if (ceiling !== null) y = Math.min(y, ceiling);
    return y;
  };
  const siteAt = (x: number, z: number) => sites.find(site => pointInPolygon(x, z, site.footprint));
  return { routes, caps: layout.roadCaps, field, river, apply, siteAt, southShoreZ, bridgeDeckAt: cityBridgeDeckAt };
}
