import type { Vec3 } from '../../contracts';
import { pointInPolygon } from '../../content/world/expansionLayout';
import {
  BRIDGE_BOUNDS, EXPANSION_GROUND, JETTY_BOUNDS, KODASSERY_BOUNDS, LANDMARKS, MAIN_PATH, PARKING_SPOTS, QUAY_BOUNDS, SAFE_SPAWNS,
  V2_LAYOUT, WORLD_BOUNDS, containsPoint, getAreaAt, getZoneAtPosition, isCarTerrainAllowed, isOnWalkableDeck, isWater, terrainHeight,
} from '../../content/world/definition';
import { canopyArchitectureBoxes, mountainArchitectureBoxes, staticArchitectureBoxes } from '../../content/world/staticArchitecture';
import { staticForestBoxes } from '../../content/world/staticForest';
import { v2DressingBoxes } from '../../content/world/v2Dressing';
import { traversalBoxes } from './traversalGeometry';
import { STUNT_SITES } from './stuntSites.data';
import { STADIUM, isStadiumGround } from '../../content/world/stadiumLayout';
import { NEDUMBASSERY_AIRPORT, airportBoxes } from '../../content/world/airport';
import { snehaTheeramBoxes } from '../../content/world/snehaTheeramDressing';
import { SNEHA_THEERAM, coastDistance } from '../../content/world/snehaTheeram';

export type RampModelId = 'kicker' | 'wedge' | 'curve';

/**
 * Ramp art is baked into one frame: the ride-up direction is +Z, the entry (low) edge sits at z = 0 and the
 * lip at z = `length`, centred on x, resting on y = 0. `sourceYaw` turns the source so it rises toward +Z;
 * `scale` is applied in the source's own axes first. The bike controller cannot climb faces steeper than
 * 45°, so heights are squashed to keep every lip below ~40°.
 */
export const RAMP_MODELS: Record<RampModelId, { url: string; sourceYaw: number; scale: readonly [number, number, number]; length: number; width: number }> = {
  // 17 m industrial kicker: a long run-up that throws the bike high.
  kicker: { url: '/assets/stunt/industrial_stunt_ramp__racing__drift_game_prop.glb', sourceYaw: Math.PI, scale: [1, .8, 1], length: 16.77, width: 6.73 },
  // Short 27° wedge, used in pairs for gap jumps.
  wedge: { url: '/assets/stunt/ramp_a.glb', sourceYaw: Math.PI, scale: [1.6, .8, 1], length: 4.88, width: 4.45 },
  // Curved quarter ramp; the source is a thin profile, so it is widened to ride on.
  curve: { url: '/assets/stunt/stunt_ramp.glb', sourceYaw: -Math.PI / 2, scale: [1, .75, 5], length: 9.5, width: 3.1 },
};

export interface RampPlacement { model: RampModelId; entry: Vec3; /** Yaw so the ramp's ride-up direction (+Z) faces the given heading. */ yaw: number }
export interface StuntSite {
  id: string;
  label: string;
  kind: 'park' | 'river';
  ramps: RampPlacement[];
  sign: { position: Vec3; yaw: number };
  /** Where to start a run: a little before the main ramp, facing it. `headingRad` follows the controller convention. */
  start: { position: Vec3; headingRad: number };
  /** Areas palms, forests and animals must keep away from. */
  clear: { x: number; z: number; radius: number }[];
}

type XZ = [number, number];
const add = (p: XZ, dir: XZ, side: XZ, along: number, across: number): XZ => [p[0] + dir[0] * along + side[0] * across, p[1] + dir[1] * along + side[1] * across];
/** Turns local +Z to face `dir`. */
const yawFor = (dir: XZ) => Math.atan2(dir[0], dir[1]);
/** Controller heading for travelling along `dir` (forward = (sin h, -cos h)). */
const headingFor = (dir: XZ) => Math.atan2(dir[0], -dir[1]);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function distanceToPath(x: number, z: number, path: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

interface Obstacles { circles: { x: number; z: number; r: number }[] }
let obstacles: Obstacles | null = null;
function getObstacles(): Obstacles {
  if (obstacles) return obstacles;
  const boxes = [...staticArchitectureBoxes(), ...canopyArchitectureBoxes(), ...mountainArchitectureBoxes(), ...staticForestBoxes(), ...v2DressingBoxes(), ...traversalBoxes(), ...airportBoxes(), ...snehaTheeramBoxes()];
  const park = V2_LAYOUT.park.footprint, pcx = park.reduce((a, p) => a + p[0], 0) / park.length, pcz = park.reduce((a, p) => a + p[1], 0) / park.length;
  obstacles = { circles: [
    ...boxes.map(b => ({ x: b.position[0], z: b.position[2], r: Math.hypot(b.size[0], b.size[2]) / 2 + 3 })),
    ...LANDMARKS.map(l => ({ x: l.position[0], z: l.position[2], r: 28 })),
    ...[...PARKING_SPOTS, ...SAFE_SPAWNS].map(p => ({ x: p.position[0], z: p.position[2], r: 22 })),
    { x: pcx, z: pcz, r: 85 },
  ] };
  return obstacles;
}

const NO_GO = [JETTY_BOUNDS, QUAY_BOUNDS, BRIDGE_BOUNDS, KODASSERY_BOUNDS, ...NEDUMBASSERY_AIRPORT.clearAreas];

/** Open, dry, gentle ground that is off roads and clear of every known structure. */
export function isOpenGround(x: number, z: number, water: 'none' | 'allowed' = 'none') {
  if (water === 'none' && (isWater(x, z) || !isCarTerrainAllowed(x, z))) return false;
  if (isOnWalkableDeck(x, z) || NO_GO.some(b => containsPoint(b, x, z))) return false;
  if (V2_LAYOUT.towns.some(t => pointInPolygon(x, z, t.footprint))) return false;
  if (getAreaAt(x, z) === 'kodassery-summit' || isStadiumGround(x, z, STADIUM.pad.blend + 4)) return false;
  // Sneha Theeram's sand is for walking, not ramps.
  const coast = coastDistance(x, z);
  if (coast !== null && coast < SNEHA_THEERAM.sandWidthM + 12) return false;
  const route = EXPANSION_GROUND.field(x, z), v2 = EXPANSION_GROUND.v2?.field(x, z);
  if ((route && route.distance < route.width + 3) || (v2 && v2.distance < v2.width + 3) || distanceToPath(x, z, MAIN_PATH) < 6) return false;
  return !getObstacles().circles.some(c => Math.hypot(c.x - x, c.z - z) < c.r);
}

/** Samples a rectangle along `dir`: `along` from a to b, `across` ±half. Returns the height range, or null if any sample is unusable. */
function surveyStrip(origin: XZ, dir: XZ, side: XZ, a: number, b: number, half: number): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (let along = a; along <= b; along += 4) for (let across = -half; across <= half; across += 4) {
    const [x, z] = add(origin, dir, side, along, across);
    if (!isOpenGround(x, z)) return null;
    const y = terrainHeight(x, z);
    min = Math.min(min, y); max = Math.max(max, y);
  }
  return { min, max };
}

const ground = (p: XZ): Vec3 => [p[0], terrainHeight(p[0], p[1]), p[1]];

/** Height range under a ramp's footprint. */
function rampFootprint(model: RampModelId, entry: XZ, dir: XZ) {
  const { length, width } = RAMP_MODELS[model], side: XZ = [dir[1], -dir[0]];
  let min = Infinity, max = -Infinity;
  for (let along = 0; along <= length; along += length / 4) for (const across of [-width / 2, 0, width / 2]) {
    const [x, z] = add(entry, dir, side, along, across), y = terrainHeight(x, z);
    min = Math.min(min, y); max = Math.max(max, y);
  }
  return { min, max };
}
const MAX_RAMP_TILT = 1.8;
/** Seated on the lowest ground under it, so it never floats; any higher ground simply buries part of the ramp. */
const ramp = (model: RampModelId, entry: XZ, dir: XZ): RampPlacement =>
  ({ model, entry: [entry[0], rampFootprint(model, entry, dir).min - .05, entry[1]], yaw: yawFor(dir) });
const rampFits = (r: RampPlacement, tolerance = MAX_RAMP_TILT) => {
  const dir: XZ = [Math.sin(r.yaw), Math.cos(r.yaw)], f = rampFootprint(r.model, [r.entry[0], r.entry[2]], dir);
  return f.max - f.min <= tolerance;
};
const lipHeight = (r: RampPlacement) => {
  const length = RAMP_MODELS[r.model].length;
  return terrainHeight(r.entry[0] + Math.sin(r.yaw) * length, r.entry[2] + Math.cos(r.yaw) * length);
};

/** A park laid out along `dir`: a big kicker, a two-wedge gap jump and a curved ramp, each with its own run-out. */
function buildPark(id: string, label: string, center: XZ, dir: XZ): StuntSite {
  const side: XZ = [dir[1], -dir[0]];
  const wedge = RAMP_MODELS.wedge.length, gap = 14;
  const gapTakeoff = add(center, dir, side, -12, 7);
  const gapLanding = add(center, dir, side, -12 + wedge + gap + wedge, 7);
  const kickerEntry = add(center, dir, side, -24, -8);
  return {
    id, label, kind: 'park',
    ramps: [
      ramp('kicker', kickerEntry, dir),
      ramp('wedge', gapTakeoff, dir),
      // Mirrored wedge: its lip faces the takeoff, so riders land on its slope (and can jump back the other way).
      ramp('wedge', gapLanding, [-dir[0], -dir[1]]),
      ramp('curve', add(center, dir, side, -8, 15), dir),
    ],
    sign: { position: ground(add(center, dir, side, -34, 0)), yaw: yawFor([-dir[0], -dir[1]]) },
    start: { position: ground(add(kickerEntry, dir, side, -22, 0)), headingRad: headingFor(dir) },
    clear: [{ x: center[0], z: center[1], radius: 46 }],
  };
}

const MAX_PARKS = 7;
export function findParks(avoid: XZ[], stats?: Record<string, number>): StuntSite[] {
  const fail = (why: string) => { if (stats) stats[why] = (stats[why] ?? 0) + 1; };
  const r = rng(4242), b = WORLD_BOUNDS;
  const accepted: { bucket: string; score: number; center: XZ; dir: XZ }[] = [];
  for (let i = 0; i < 4000; i++) {
    const center: XZ = [b.xMin + r() * (b.xMax - b.xMin), b.zMin + r() * (b.zMax - b.zMin)];
    const angle = r() * Math.PI * 2, dir: XZ = [Math.sin(angle), Math.cos(angle)], side: XZ = [dir[1], -dir[0]];
    const zone = getAreaAt(center[0], center[1]) ?? getZoneAtPosition(center[0], center[1]);
    if (!isOpenGround(center[0], center[1]) || terrainHeight(center[0], center[1]) > 100) { fail(`centre ${zone}`); continue; }
    if (avoid.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 160)) continue;
    // Not out on the map's rim, where a park would sit in the backdrop hills or against the edge.
    if (Math.min(center[0] - b.xMin, b.xMax - center[0], center[1] - b.zMin, b.zMax - center[1]) < 90) continue;
    const survey = surveyStrip(center, dir, side, -46, 40, 19);
    // Hills are fine as long as the grade is gentle, each ramp sits nearly level, and the gap jump's lips match.
    if (!survey || survey.max - survey.min > 10) { fail(survey ? `steep ${zone}` : `blocked ${zone}`); continue; }
    const trial = buildPark('trial', '', center, dir);
    if (!trial.ramps.every(r => rampFits(r))) { fail(`ramp tilt ${zone}`); continue; }
    if (Math.abs(lipHeight(trial.ramps[1]) - lipHeight(trial.ramps[2])) > 2) { fail(`gap uneven ${zone}`); continue; }
    const bucket = getAreaAt(center[0], center[1]) ?? getZoneAtPosition(center[0], center[1]);
    const score = survey.max - survey.min + trial.ramps.reduce((sum, r) => { const f = rampFootprint(r.model, [r.entry[0], r.entry[2]], [Math.sin(r.yaw), Math.cos(r.yaw)]); return sum + f.max - f.min; }, 0) * 2;
    accepted.push({ bucket, score, center, dir });
  }
  // Best spots first, at most two per region, well spread across the map.
  const picked: StuntSite[] = [], perBucket = new Map<string, number>();
  for (const site of accepted.sort((a, b) => a.score - b.score)) {
    if (picked.length >= MAX_PARKS || (perBucket.get(site.bucket) ?? 0) >= 2) continue;
    if (picked.some(p => Math.hypot(p.clear[0].x - site.center[0], p.clear[0].z - site.center[1]) < 220)) continue;
    const n = (perBucket.get(site.bucket) ?? 0) + 1;
    perBucket.set(site.bucket, n);
    const name = site.bucket.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    picked.push(buildPark(`stunt-park-${site.bucket}-${n}`, `${name} Stunt Park${n > 1 ? ' II' : ''}`, site.center, site.dir));
  }
  return picked;
}

/** Scans across the river from `c` until dry land; returns the distance to the bank, or null. */
function bankDistance(c: XZ, dir: XZ): number | null {
  for (let d = 1; d <= 45; d += .5) if (!isWater(c[0] + dir[0] * d, c[1] + dir[1] * d)) return d;
  return null;
}

/** Longest step the bike can ride between run-up samples 3 m apart (about 36°). */
const MAX_RUNUP_STEP = 2.2;

/** Facing wedges on the crest of opposite levees: ride up the bank and jump the river either way. */
export function findRiverJumps(stats?: Record<string, number>): StuntSite[] {
  const fail = (why: string) => { if (stats) stats[why] = (stats[why] ?? 0) + 1; };
  const wedge = RAMP_MODELS.wedge.length, candidates: { score: number; reach: string; site: StuntSite; at: XZ }[] = [];
  const runUpOk = (entry: XZ, away: XZ) => {
    let previous = terrainHeight(entry[0], entry[1]);
    for (let d = 3; d <= 30; d += 3) {
      const [x, z] = add(entry, away, [0, 0], d, 0);
      if (!isOpenGround(x, z)) return false;
      const y = terrainHeight(x, z);
      if (Math.abs(y - previous) > MAX_RUNUP_STEP) return false;
      previous = y;
    }
    return true;
  };
  for (const reach of V2_LAYOUT.riverReaches) {
    if (reach.kind !== 'channel') continue;
    const pts = reach.points;
    for (let i = 1; i < pts.length; i++) {
      const [ax, , az] = pts[i - 1], [bx, , bz] = pts[i], len = Math.hypot(bx - ax, bz - az);
      for (let s = 10; s < len - 10; s += 6) {
        const t = s / len, c: XZ = [ax + (bx - ax) * t, az + (bz - az) * t];
        if (!isWater(c[0], c[1])) continue;
        const along: XZ = [(bx - ax) / len, (bz - az) / len], across: XZ = [along[1], -along[0]], back: XZ = [-across[0], -across[1]];
        const e1 = bankDistance(c, back), e2 = bankDistance(c, across);
        if (e1 === null || e2 === null || e1 + e2 > 34) { fail('too wide'); continue; }
        // Wedge lips sit 1.5 m back from each waterline, on the levee crest.
        const lipA = add(c, back, along, e1 + 1.5, 0), lipB = add(c, across, along, e2 + 1.5, 0);
        const entryA = add(lipA, back, along, wedge, 0), entryB = add(lipB, across, along, wedge, 0);
        if (![lipA, lipB, entryA, entryB].every(([x, z]) => isOpenGround(x, z))) { fail(`bank blocked ${reach.id}`); continue; }
        const rampA = ramp('wedge', entryA, across), rampB = ramp('wedge', entryB, back);
        // Levee crests are narrow; a wedge may sink up to 3 m at one end and still launch cleanly.
        if (!rampFits(rampA, 3) || !rampFits(rampB, 3)) { fail(`ramp tilt ${reach.id}`); continue; }
        if (Math.abs(rampA.entry[1] - rampB.entry[1]) > 2) { fail(`banks uneven ${reach.id}`); continue; }
        if (!runUpOk(entryA, back) || !runUpOk(entryB, across)) { fail(`run-up ${reach.id}`); continue; }
        const gap = e1 + e2 + 3, id = `river-jump-${reach.id}-${i}-${s}`;
        candidates.push({ score: gap + Math.abs(rampA.entry[1] - rampB.entry[1]) * 3, reach: reach.id, at: c, site: {
          id, label: `${reach.label} Jump`, kind: 'river',
          ramps: [rampA, rampB],
          sign: { position: ground(add(entryA, back, along, 8, 5)), yaw: yawFor(back) },
          start: { position: ground(add(entryA, back, along, 28, 0)), headingRad: headingFor(across) },
          clear: [entryA, entryB, lipA, lipB, add(entryA, back, along, 15, 0), add(entryB, across, along, 15, 0)].map(([x, z]) => ({ x, z, radius: 10 })),
        } });
      }
    }
  }
  const picked: typeof candidates = [];
  for (const candidate of candidates.sort((a, b) => a.score - b.score)) {
    if (picked.length >= 2) break;
    // Prefer different rivers, but two good spots on one river are fine if they are well apart.
    if (picked.some(p => Math.hypot(p.at[0] - candidate.at[0], p.at[1] - candidate.at[1]) < (p.reach === candidate.reach ? 120 : 200))) continue;
    picked.push(candidate);
  }
  return picked.map((p, i) => ({ ...p.site, label: picked.findIndex(q => q.site.label === p.site.label) < i ? `${p.site.label} II` : p.site.label }));
}

/** Baked by `npm run generate:stunts`: searching the whole world takes ~2 s, too slow for page load. */
export function stuntSites(): StuntSite[] {
  return STUNT_SITES;
}

/** Also covers the football ground: scatter and wildlife treat both as reserved sports ground. */
export function isStuntGround(x: number, z: number, margin = 0) {
  return isStadiumGround(x, z, margin) || stuntSites().some(site => site.clear.some(c => Math.hypot(c.x - x, c.z - z) < c.radius + margin));
}
