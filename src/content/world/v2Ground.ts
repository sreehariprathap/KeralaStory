import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { WorldV2Layout } from '../../contracts/worldV2';
import { roundedPath, pointInPolygon } from './expansionLayout';
import { createRouteField } from '../../game/world/expansionTerrain';
import { createRiverField } from '../../game/world/riverGeometry';

const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

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
  const routes = createV2Routes(layout), field = createRouteField(routes), river = createRiverField(layout.riverReaches);
  const sites = [...layout.towns.filter(t => !t.existing), layout.park];
  const southShoreZ = layout.riverNodes.find(n => n.id === 'main-outlet')!.position[2];
  /** Preserve the original corridor, except the already separate terrain to its north/west. */
  const apply = (x: number, z: number, previous: number): number => {
    if (x >= -78 && z >= -481) return previous;
    let y = previous;
    if (z > -260) {
      const lowland = Math.max(10, 49 - (z + 120) * .12) + Math.sin(x * .012) * 1.5;
      const blend = smooth((z + 260) / 50);
      y = y * (1 - blend) + lowland * blend;
    }
    for (const site of sites) {
      const xs = site.footprint.map(p => p[0]), zs = site.footprint.map(p => p[1]);
      const dx = Math.max(Math.min(...xs) - x, 0, x - Math.max(...xs));
      const dz = Math.max(Math.min(...zs) - z, 0, z - Math.max(...zs));
      const blend = 1 - smooth(Math.hypot(dx, dz) / 25);
      y = y * (1 - blend) + site.center[1] * blend;
    }
    const bank = river.nearest(x, z), surface = river.surfaceAt(x, z);
    if (bank) {
      const blend = 1 - smooth((bank.distance - bank.halfWidth) / 20);
      if (blend > 0) {
        const bed = bank.height - 3 + 6 * smooth((bank.distance - bank.halfWidth + 5) / 12);
        y = y * (1 - blend) + bed * blend;
      }
    }
    if (surface !== null) y = Math.min(y, surface - 2.5);
    const road = field(x, z);
    if (road) {
      const blend = 1 - smooth((road.distance - road.width - 2) / 12);
      y = y * (1 - blend) + road.height * blend;
    }
    if (x < -78 && z > southShoreZ - 20) {
      const blend = smooth((z - southShoreZ + 20) / 20);
      y = y * (1 - blend) + 3.5 * blend;
    }
    return y;
  };
  const siteAt = (x: number, z: number) => sites.find(site => pointInPolygon(x, z, site.footprint));
  return { routes, field, river, apply, siteAt, southShoreZ };
}
