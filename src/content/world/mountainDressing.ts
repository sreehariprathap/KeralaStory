import type { Vec3 } from '../../contracts';
import type { TraversalBox } from '../../game/world/traversalGeometry';
import { STUNT_SITES } from '../../game/world/stuntSites.data';
import { LANDMARKS, PARKING_SPOTS, V2_LAYOUT, WORLD_BOUNDS, getAreaAt, hasGroundAt, isClearOfRoads, isWater, terrainHeight } from './definition';
import { pointInPolygon } from './expansionLayout';
import { isTeaEstateGround } from './teaEstate';

/**
 * Hill-country detail: boulders and scree on the steep and high ground, and clumps of shola forest in
 * the folds and on the gentler slopes, across the V2 hills (reservoir backdrop, gorge, Kodassery summit
 * mountain, valley heads). Seeded per cell, so the same world always grows the same hills. Large boulders
 * collide and are shared with the multiplayer simulation.
 */
export interface Boulder { position: Vec3; scale: Vec3; yaw: number; variant: number; tint: number }
export interface HillTree { position: Vec3; height: number; spread: number; yaw: number; kind: 'shola' | 'slender' }

const CELL = 9;
/** Boulders at least this big (largest half-extent, metres) get a collider. */
const SOLID_BOULDER = 1.6;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const slopeAt = (x: number, z: number) => Math.hypot(terrainHeight(x + 1.5, z) - terrainHeight(x - 1.5, z), terrainHeight(x, z + 1.5) - terrainHeight(x, z - 1.5)) / 3;
/** Low-frequency patches: shola forest grows in clumps, not evenly. */
const patch = (x: number, z: number) => .5 + .3 * Math.sin(x * .021 + 1.7) * Math.sin(z * .019 + .4) + .2 * Math.sin((x - z) * .034 + 2.2);

function createDressing() {
  const random = rng(90210), boulders: Boulder[] = [], trees: HillTree[] = [];
  const sites = [...V2_LAYOUT.towns.map(t => t.footprint), V2_LAYOUT.park.footprint, V2_LAYOUT.airport.footprint];
  const crest = V2_LAYOUT.riverNodes.find(n => n.id === 'dam-crest')!.position;
  const keepClear = [...LANDMARKS.map(l => l.position), ...PARKING_SPOTS.map(p => p.position)];
  const open = (x: number, z: number, margin: number) => {
    if (!hasGroundAt(x, z) || isWater(x, z) || !isClearOfRoads(x, z, margin)) return false;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (isWater(x + dx, z + dz)) return false;
    if (isTeaEstateGround(x, z) || sites.some(f => pointInPolygon(x, z, f))) return false;
    if (Math.hypot(x - crest[0], z - crest[2]) < 55) return false;
    if (keepClear.some(p => Math.hypot(p[0] - x, p[2] - z) < 14)) return false;
    return !STUNT_SITES.some(site => site.clear.some(c => Math.hypot(c.x - x, c.z - z) < c.radius + 4));
  };
  const b = WORLD_BOUNDS;
  for (let cx = b.xMin; cx < b.xMax; cx += CELL) for (let cz = b.zMin; cz < b.zMax; cz += CELL) {
    // A fixed number of draws per cell keeps every other cell stable when a rule changes.
    const d = Array.from({ length: 12 }, random);
    const x = cx + d[0] * CELL, z = cz + d[1] * CELL;
    // The original hand-built Kodassery hillside keeps its own scenery.
    if (x > -78 && z > -499) continue;
    if (!hasGroundAt(x, z)) continue;
    const y = terrainHeight(x, z), slope = slopeAt(x, z), high = Math.max(0, Math.min(1, (y - 92) / 40));
    const rugged = Math.max(0, Math.min(1, (slope - .35) / .5));
    const hill = Math.max(high, rugged);
    if (hill <= 0) continue;
    // Boulders: most on steep and high ground, a few scattered lower down.
    if (d[2] < .12 + .5 * rugged + .15 * high && open(x, z, 3)) {
      const size = .7 + d[3] * d[3] * 3.4 * (.5 + rugged);
      boulders.push({ position: [x, y - size * .25, z], scale: [size * (.8 + d[4] * .5), size * (.55 + d[5] * .35), size * (.8 + d[6] * .5)], yaw: d[7] * Math.PI * 2, variant: Math.floor(d[8] * 4), tint: d[9] });
      continue;
    }
    // Shola forest: patches on hillsides that are not too steep, thinning out on the bare tops.
    const forest = patch(x, z) * (1 - Math.max(0, Math.min(1, (y - 175) / 25))) * (slope < .9 ? 1 : 0);
    if (getAreaAt(x, z) === 'chokkana') continue; // Chokkana already has its own forest.
    if (d[10] < forest * 1.1 * hill + .12 * hill && open(x, z, 4)) {
      // A clump: the seed tree and a few neighbours huddled around it, as shola grows in the folds.
      const clump = 1 + Math.floor(d[6] * 4 * forest);
      for (let k = 0; k < clump; k++) {
        const a = d[7] * 6.283 + k * 2.1, r = k ? 3.5 + ((d[9] * 7 + k * .37) % 1) * 4 : 0;
        const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
        if (k && (!open(tx, tz, 4) || slopeAt(tx, tz) > .9)) continue;
        const slender = k === 0 && d[11] < .3, grow = (d[3] + k * .23) % 1;
        trees.push({ position: [tx, terrainHeight(tx, tz) - .2, tz], height: slender ? 11 + grow * 7 : 6.5 + grow * 6, spread: slender ? 1.6 + d[4] : 2.8 + ((d[4] + k * .31) % 1) * 2.6, yaw: (d[5] + k * .17) * Math.PI * 2, kind: slender ? 'slender' : 'shola' });
      }
    }
  }
  return { boulders, trees };
}

export const MOUNTAIN_DRESSING = createDressing();

/** Colliders for the large boulders, shared by the client physics and the multiplayer simulation. */
export function mountainDressingBoxes(): TraversalBox[] {
  return MOUNTAIN_DRESSING.boulders.flatMap((b, i) => Math.max(b.scale[0], b.scale[2]) < SOLID_BOULDER ? [] : [{
    id: `hill-boulder-${i}`, position: [b.position[0], b.position[1] + b.scale[1] * .45, b.position[2]] as Vec3,
    size: [b.scale[0] * 1.5, b.scale[1] * 1.2, b.scale[2] * 1.5] as Vec3, rotation: [0, b.yaw, 0] as Vec3,
  }]);
}
