import { pointInPolygon } from '../../content/world/expansionLayout';
import {
  EXPANSION_GROUND, KODASSERY_BOUNDS, LANDMARKS, MAIN_PATH, V2_LAYOUT, WORLD_BOUNDS,
  containsPoint, getAreaAt, getZoneAtPosition, isCarTerrainAllowed, isWater, terrainHeight,
} from '../../content/world/definition';
import { isStuntGround } from './stuntSites';

export type SpeciesId = 'elephant' | 'cow' | 'dog' | 'cat' | 'chicken';

export interface SpeciesProfile {
  id: SpeciesId;
  url: string;
  /** Real-world height of the whole model (ears/horns/tail included), in metres. */
  height: number;
  /** Yaw in radians that turns the source model to face +Z. */
  rotationY: number;
  count: number;
  /** Walking speed in m/s. */
  speed: number;
  /** How far an animal strays from its home spot, in metres. */
  roam: number;
  /** Seconds spent resting between walks: [min, max]. */
  rest: readonly [number, number];
  /** Clip to loop while walking / resting; `null` freezes the pose. Missing clips fall back to a procedural bob. */
  walkClip: string | null;
  restClip: string | null;
  /** Beyond this camera distance the animal is hidden and paused. */
  drawDistance: number;
  /** Large animals get a solid body the explorer, bikes and cars bump into. */
  solid?: { halfWidth: number; halfHeight: number; halfLength: number };
}

const DIR = '/assets/living-beings';
export const SPECIES: readonly SpeciesProfile[] = [
  { id: 'elephant', url: `${DIR}/elephant.glb`, height: 3, rotationY: -Math.PI / 2, count: 3, speed: 1.1, roam: 45, rest: [4, 12],
    walkClip: 'Walking', restClip: null, drawDistance: 200, solid: { halfWidth: .9, halfHeight: 1.4, halfLength: 2.1 } },
  { id: 'cow', url: `${DIR}/cow.glb`, height: 1.6, rotationY: 0, count: 5, speed: .55, roam: 18, rest: [8, 22],
    walkClip: 'Idle', restClip: 'Eating', drawDistance: 130, solid: { halfWidth: .4, halfHeight: .7, halfLength: 1 } },
  { id: 'dog', url: `${DIR}/cartoon_dog.glb`, height: .8, rotationY: 0, count: 10, speed: 1.7, roam: 25, rest: [3, 9],
    walkClip: null, restClip: null, drawDistance: 90 },
  { id: 'cat', url: `${DIR}/toon_cat_free.glb`, height: .45, rotationY: 0, count: 8, speed: 1.1, roam: 14, rest: [4, 12],
    walkClip: 'Scene', restClip: null, drawDistance: 70 },
  { id: 'chicken', url: `${DIR}/chicken_character.glb`, height: .4, rotationY: 0, count: 15, speed: .8, roam: 10, rest: [2, 6],
    walkClip: 'Take 001', restClip: 'Take 001', drawDistance: 70 },
];

const TOWN_FOOTPRINTS = V2_LAYOUT.towns.map(t => t.footprint);
const MALAKKAPPARA = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!;
const SETTLEMENTS = [...V2_LAYOUT.towns.map(t => t.center), ...LANDMARKS.filter(l => ['paddy', 'spice-garden', 'temple', 'tea-shop', 'fishing-bank', 'market', 'harbor'].includes(l.id)).map(l => l.position)];
/** Above this no animal roams; the Kodassery peak and hill country stay wild and empty. */
const MAX_ELEVATION = 100;

function distanceToPath(x: number, z: number, path: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

function roadGap(x: number, z: number) {
  const route = EXPANSION_GROUND.field(x, z), v2 = EXPANSION_GROUND.v2?.field(x, z);
  return Math.min(route ? route.distance - route.width : Infinity, v2 ? v2.distance - v2.width : Infinity, distanceToPath(x, z, MAIN_PATH) - 3);
}

function distanceOutsideFootprint(x: number, z: number, footprint: readonly (readonly [number, number])[]) {
  const xs = footprint.map(p => p[0]), zs = footprint.map(p => p[1]);
  const dx = Math.max(Math.min(...xs) - x, 0, x - Math.max(...xs)), dz = Math.max(Math.min(...zs) - z, 0, z - Math.max(...zs));
  return Math.hypot(dx, dz);
}

const parkBounds = () => {
  const f = V2_LAYOUT.park.footprint;
  return { xMin: Math.min(...f.map(p => p[0])) - 5, xMax: Math.max(...f.map(p => p[0])) + 5, zMin: Math.min(...f.map(p => p[1])) - 5, zMax: Math.max(...f.map(p => p[1])) + 5 };
};
const PARK = parkBounds();

/** Where each species may stand. Walks are checked against this along their whole path. */
export function isHabitat(species: SpeciesId, x: number, z: number): boolean {
  if (!isCarTerrainAllowed(x, z) || isWater(x, z) || containsPoint(PARK, x, z) || isStuntGround(x, z, 4)) return false;
  const area = getAreaAt(x, z);
  // No animals on the hills: the summit, the Kodassery Peaks slopes, or any high ground.
  if (area === 'kodassery-summit' || containsPoint(KODASSERY_BOUNDS, x, z) || terrainHeight(x, z) > MAX_ELEVATION) return false;
  switch (species) {
    case 'elephant': {
      // Forests and the wild edge of Malakkappara only: never in a town, never on or beside a road.
      if (TOWN_FOOTPRINTS.some(f => pointInPolygon(x, z, f)) || roadGap(x, z) < 8) return false;
      const nearMalakkappara = distanceOutsideFootprint(x, z, MALAKKAPPARA.footprint) < 70;
      return area === 'chokkana' || area === 'athirappilly' || nearMalakkappara;
    }
    case 'cow':
      // Village cattle: Kadambode's paddy fields and temple village, not inside its towns.
      return !area && getZoneAtPosition(x, z) === 'kadambode' && !TOWN_FOOTPRINTS.some(f => pointInPolygon(x, z, f));
    default:
      return true;
  }
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Candidate home spots for one species, seeded so the same animals live in the same places every visit. */
export function homeCandidates(species: SpeciesProfile, seed: number): [number, number][] {
  const r = rng(seed), out: [number, number][] = [];
  const b = WORLD_BOUNDS;
  // Village animals mostly stay close to people; everything else samples the whole map.
  const village = species.id === 'dog' || species.id === 'cat' || species.id === 'chicken';
  for (let attempt = 0; attempt < 6000 && out.length < species.count * 6; attempt++) {
    let x: number, z: number;
    if (village && r() < .75) {
      const [sx, , sz] = SETTLEMENTS[Math.floor(r() * SETTLEMENTS.length)], a = r() * Math.PI * 2, d = 6 + r() * 45;
      x = sx + Math.cos(a) * d; z = sz + Math.sin(a) * d;
    } else {
      x = b.xMin + r() * (b.xMax - b.xMin); z = b.zMin + r() * (b.zMax - b.zMin);
    }
    if (!isHabitat(species.id, x, z)) continue;
    // Herds and flocks spread out rather than stacking on one spot.
    if (out.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < (species.id === 'elephant' ? 60 : 12))) continue;
    out.push([x, z]);
  }
  return out;
}
