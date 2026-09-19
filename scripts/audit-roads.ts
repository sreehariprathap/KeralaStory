/**
 * Road network audit: dead ends, junction height mismatches, bumps, cross-slope, and solids on the carriageway.
 *   npx tsx scripts/audit-roads.ts
 */
import { EXPANSION_LAYOUT, V2_ROUTES, V2_LAYOUT, MAIN_PATH, CITY_PATH, terrainHeight, walkableDeckHeight, LANDMARKS, EXPANSION_GROUND } from '../src/content/world/definition';
import { createCanonicalWorldDefinition } from '../packages/simulation/src/worldDefinition';
import { CHALAKKUDY_BRIDGES } from '../src/content/world/chalakkudyCityPlan';
import { ROAD_DESTINATIONS } from '../tests/support/roadDrive';

type P = readonly number[];
const surface = (x: number, z: number) => Math.max(walkableDeckHeight(x, z) ?? -Infinity, terrainHeight(x, z));
const roads = [...EXPANSION_LAYOUT.routes.filter(r => r.allowedModes.includes('car')), ...V2_ROUTES]
  .map(r => ({ id: r.id, points: r.points as readonly P[], half: r.widthM / 2 }));
roads.push({ id: 'main-path', points: MAIN_PATH.map(([x, z]) => [x, surface(x, z), z]), half: 3 });
for (const b of CHALAKKUDY_BRIDGES) roads.push({ id: b.id, points: [b.from, b.to], half: b.width / 2 });
for (const d of ROAD_DESTINATIONS) roads.push({ id: d.id, points: d.points.map(([x, z]) => [x, surface(x, z), z]), half: d.halfWidth });
const dist = (x: number, z: number, pts: readonly P[]) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
};
console.log('== ENDS');
for (const r of roads) for (const [label, e] of [['start', r.points[0]], ['end', r.points.at(-1)!]] as const) {
  const joins = roads.filter(o => o !== r && dist(e[0], e[2], o.points) <= o.half + .5).map(o => o.id);
  for (const c of V2_LAYOUT.roadCaps) if (Math.hypot(c.center[0] - e[0], c.center[2] - e[2]) <= c.radius) joins.push(c.id);
  const lm = LANDMARKS.map(l => ({ l, d: Math.hypot(l.position[0] - e[0], l.position[2] - e[2]) })).sort((a, b) => a.d - b.d)[0];
  console.log(`${joins.length ? 'JOIN' : 'DEAD'} ${r.id} ${label} (${e[0].toFixed(0)},${e[2].toFixed(0)}) -> ${joins.join(',') || '-'} near=${lm.l.id}@${lm.d.toFixed(0)}`);
}
console.log('== SURFACE (1 m samples: bump = second difference of surface height, cross = slope across)');
const boxes = createCanonicalWorldDefinition().boxes;
for (const r of roads) {
  const s: { x: number; z: number; tx: number; tz: number }[] = [];
  for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1], b = r.points[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]); if (l < 1e-6) continue;
    for (let k = 0; k < Math.ceil(l); k++) s.push({ x: a[0] + (b[0] - a[0]) * k / Math.ceil(l), z: a[2] + (b[2] - a[2]) * k / Math.ceil(l), tx: (b[0] - a[0]) / l, tz: (b[2] - a[2]) / l });
  }
  let bump = 0, bumpAt = '', cross = 0, crossAt = '', grade = 0, gradeAt = '';
  const h = s.map(p => surface(p.x, p.z));
  for (let i = 1; i < s.length - 1; i++) {
    const d2 = Math.abs(h[i + 1] - 2 * h[i] + h[i - 1]); if (d2 > bump) { bump = d2; bumpAt = `${s[i].x.toFixed(0)},${s[i].z.toFixed(0)}`; }
    const g = Math.abs(h[i + 1] - h[i - 1]) / 2; if (g > grade) { grade = g; gradeAt = `${s[i].x.toFixed(0)},${s[i].z.toFixed(0)}`; }
    const nx = -s[i].tz, nz = s[i].tx, w = r.half * .8;
    const c = Math.abs(surface(s[i].x + nx * w, s[i].z + nz * w) - surface(s[i].x - nx * w, s[i].z - nz * w)) / (2 * w);
    if (c > cross) { cross = c; crossAt = `${s[i].x.toFixed(0)},${s[i].z.toFixed(0)}`; }
  }
  const hits = new Set<string>();
  for (const p of s) for (const b of boxes) {
    const yaw = b.rotation[1], dx = p.x - b.position[0], dz = p.z - b.position[2];
    const lx = Math.cos(yaw) * dx - Math.sin(yaw) * dz, lz = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
    const reach = r.half * .9;
    if (Math.abs(lx) < b.size[0] / 2 + reach && Math.abs(lz) < b.size[2] / 2 + reach) {
      const y = surface(p.x, p.z), bottom = b.position[1] - b.size[1] / 2, top = b.position[1] + b.size[1] / 2;
      if (!b.id.startsWith(r.id) && !/^(bridge-|chokkana-stream-deck)/.test(b.id) && top > y + .08 && bottom < y + 2.5 && Math.abs(lx) < b.size[0] / 2 + r.half * .9 - .01) {
        // only flag if the box footprint really overlaps the carriageway corridor at this sample
        const centerDist = dist(b.position[0], b.position[2], r.points);
        if (centerDist < r.half + Math.max(b.size[0], b.size[2]) / 2 - .3) hits.add(b.id);
      }
    }
  }
  const flag = bump > .12 || cross > .12 || grade > .13 || hits.size;
  console.log(`${flag ? '!!' : 'ok'} ${r.id} len=${s.length} maxBump=${bump.toFixed(3)}@${bumpAt} maxGrade=${grade.toFixed(3)}@${gradeAt} maxCross=${cross.toFixed(3)}@${crossAt}${hits.size ? ' SOLIDS=' + [...hits].slice(0, 6).join(',') : ''}`);
}
void EXPANSION_GROUND;
