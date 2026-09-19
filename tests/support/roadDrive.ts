import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { CITY_PATH, EXPANSION_GROUND, EXPANSION_LAYOUT, KODASSERY_PATH, V2_ROUTES, VILLAGE_PATH, terrainHeight, walkableDeckHeight } from '../../src/content/world/definition';
import { CHALAKKUDY_BRIDGES } from '../../src/content/world/chalakkudyCityPlan';
import { terrainMeshData } from '../../src/game/world/traversalGeometry';
import { createCarPhysics } from '../../src/game/vehicle/carPhysics';
import { createCanonicalWorldDefinition } from '../../packages/simulation/src/worldDefinition';

type XZY = readonly [number, number, number];
export interface DriveRoute { id: string; points: readonly XZY[]; halfWidth: number }

const surface = (x: number, z: number) => Math.max(walkableDeckHeight(x, z) ?? -Infinity, terrainHeight(x, z));
/** Every road a car is meant to drive: authored car routes, the V2 network, the old village spine and the city bridges. */
export const ROAD_DRIVE_ROUTES: DriveRoute[] = [
  ...[...EXPANSION_LAYOUT.routes.filter(r => r.allowedModes.includes('car') && r.surface !== 'dirt'), ...V2_ROUTES]
    .map(r => ({ id: r.id, points: r.points as readonly XZY[], halfWidth: r.widthM / 2 })),
  { id: 'village-road', points: [...KODASSERY_PATH, ...VILLAGE_PATH.slice(1), ...CITY_PATH].map(([x, z]) => [x, surface(x, z), z] as const), halfWidth: 3 },
  ...CHALAKKUDY_BRIDGES.map(b => ({ id: b.id, points: [b.from, b.to] as readonly XZY[], halfWidth: b.width / 2 })),
];

/**
 * Paved places a road may run into instead of another road: the harbour quay, the dam crest walkway
 * (with its flush buttresses) and the Banyan circle's west avenue. Centre lines in x, z.
 */
export const ROAD_DESTINATIONS: { id: string; points: readonly (readonly [number, number])[]; halfWidth: number }[] = [
  { id: 'kodaly-harbor-quay', points: [[43, 79], [81, 79]], halfWidth: 9.5 },
  { id: 'kodassery-summit-cap', points: [[-130, -690], [-141, -695]], halfWidth: 10 },
  { id: 'peringalkuthu-dam-crest', points: [[-721, -798], [-659, -798]], halfWidth: 4.5 },
  { id: 'kodaly-banyan-west-avenue', points: [[-9, -18], [5, -18]], halfWidth: 3.5 },
];

let world: RAPIER.World | null = null;
/** One shared collision world: every terrain mesh and every static box the simulation knows. */
export function driveWorld(): RAPIER.World {
  if (world) return world;
  world = new RAPIER.World({ x: 0, y: -22, z: 0 });
  world.timestep = 1 / 60;
  for (const mesh of [...EXPANSION_GROUND.chunks, terrainMeshData('north'), terrainMeshData('south')])
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
  for (const b of createCanonicalWorldDefinition().boxes) {
    const q = new Quaternion().setFromEuler(new Euler(b.rotation[0], b.rotation[1], b.rotation[2], 'XYZ'));
    world.createCollider(RAPIER.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2).setTranslation(b.position[0], b.position[1], b.position[2]).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  }
  world.step();
  return world;
}

/** Dense 1 m resampling with cumulative distance. */
function resample(points: readonly XZY[]) {
  const out: { x: number; z: number; s: number }[] = [];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1e-6) continue;
    const n = Math.ceil(l);
    for (let k = out.length ? 1 : 0; k <= n; k++) out.push({ x: a[0] + (b[0] - a[0]) * k / n, z: a[2] + (b[2] - a[2]) * k / n, s: s + l * k / n });
    s += l;
  }
  return out;
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface DriveReport { events: string[]; finished: boolean; seconds: number; averageSpeed: number; airborneMs: number; maxJolt: number; joltAt: string; maxOffset: number; offsetAt: string; maxTilt: number; stuckAt: string }

/** Pure-pursuit driver at racing pace, slowing only for tight bends. */
export function roadDriveReport(route: DriveRoute, reverse = false, model: 'supercar' | 'admin' = 'supercar'): DriveReport {
  const w = driveWorld();
  const path = resample(reverse ? [...route.points].reverse() : route.points), total = path.at(-1)!.s;
  const start = path[0], ahead = path[Math.min(path.length - 1, 4)];
  const car = createCarPhysics(w, [start.x, surface(start.x, start.z) + .1, start.z], Math.atan2(ahead.x - start.x, -(ahead.z - start.z)), model);
  const dt = 1 / 60, report: DriveReport = { events: [], finished: false, seconds: 0, averageSpeed: 0, airborneMs: 0, maxJolt: 0, joltAt: '', maxOffset: 0, offsetAt: '', maxTilt: 0, stuckAt: '' };
  let index = 0, airborne = 0, stuck = 0, frames = 0;
  // Vertical velocity history: the jolt is the change in its 6-frame average over a tenth of a second,
  // which filters single-frame suspension chatter but keeps real kerbs, steps and dips.
  const vys: number[] = [];
  const limit = Math.ceil((total / 4 + 20) / dt);
  try {
    for (; frames < limit; frames++) {
      const p = car.body.translation();
      // Advance along the path to the nearest sample (forward-only window).
      let best = index, bestD = Infinity;
      for (let i = index; i < Math.min(path.length, index + 40); i++) { const d = Math.hypot(path[i].x - p.x, path[i].z - p.z); if (d < bestD) { bestD = d; best = i; } }
      index = best;
      if (path[index].s >= total - 2.5) { report.finished = true; break; }
      const speed = car.motion.speed;
      const look = Math.min(path.length - 1, index + Math.round(Math.max(7, speed * .8)));
      const heading = car.sample();
      const desired = Math.atan2(path[look].x - p.x, -(path[look].z - p.z));
      const err = wrap(desired - heading);
      // Corner speed from the heading change over the next 25 m.
      const far = Math.min(path.length - 1, index + 25), mid = Math.min(path.length - 1, index + 12);
      const h1 = Math.atan2(path[mid].x - path[index].x, -(path[mid].z - path[index].z)), h2 = Math.atan2(path[far].x - path[mid].x, -(path[far].z - path[mid].z));
      const turn = Math.abs(wrap(h2 - h1)) / Math.max(1, path[far].s - path[index].s);
      const target = Math.min(14, Math.sqrt(7 / Math.max(turn, 1e-3)));
      car.step({ forward: speed < target ? 1 : .08, steer: Math.max(-1, Math.min(1, err * 2.2)), brake: speed > target + 2 }, dt, true);
      w.step();
      car.sample();
      vys.push(car.body.linvel().y);
      const avg = (from: number) => vys.slice(from, from + 6).reduce((a, b) => a + b, 0) / 6;
      const jolt = vys.length >= 12 ? Math.abs(avg(vys.length - 6) - avg(vys.length - 12)) / (6 * dt) : 0;
      if (frames > 30 && path[index].s > 12 && jolt > report.maxJolt) { report.maxJolt = jolt; report.joltAt = `${p.x.toFixed(0)},${p.z.toFixed(0)}`; }
      if (frames > 30 && path[index].s > 12 && jolt > 9) {
        const at = `${Math.round(p.x)},${Math.round(p.z)}`, last = report.events.at(-1)?.split(' ')[0].split(',').map(Number);
        if (!last || Math.hypot(last[0] - p.x, last[1] - p.z) > 8) report.events.push(`${at} j=${jolt.toFixed(0)} v=${speed.toFixed(0)}`);
      }
      airborne = car.motion.grounded ? 0 : airborne + 1;
      if (frames > 30) report.airborneMs = Math.max(report.airborneMs, Math.round(airborne * dt * 1000));
      if (bestD > report.maxOffset) { report.maxOffset = bestD; report.offsetAt = `${p.x.toFixed(0)},${p.z.toFixed(0)}`; }
      const q = car.body.rotation(), upY = 1 - 2 * (q.x * q.x + q.z * q.z);
      report.maxTilt = Math.max(report.maxTilt, Math.acos(Math.max(-1, Math.min(1, upY))));
      stuck = speed < .6 && frames > 90 ? stuck + 1 : 0;
      if (stuck > 180) { report.stuckAt = `${p.x.toFixed(0)},${p.z.toFixed(0)}`; break; }
    }
  } finally { car.dispose(); }
  report.seconds = frames * dt;
  report.averageSpeed = path[index].s / Math.max(report.seconds, 1e-3);
  return report;
}
