# Malakkappara Phase 1 — Tea Estate, Road Markings, Clean Edges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Peringalkuthu tea estate look like a real Kerala highland plantation, paint lane lines on Malakkappara's two-lane roads, and replace raw road-cut banks with dry-stone walls.

**Architecture:** Deterministic data modules in `src/content/world/` (tea rows and picker paths, road paint strips, wall segments) consumed by render components in `src/game/world/`. Road paint reuses the Chalakkudy `CityPaint` type and `createPaintGeometry`. Everything is seeded and pure, so tests read the same data the renderer draws.

**Tech Stack:** TypeScript, React Three Fiber, three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-malakkappara-hill-town-design.md` (Phase 1 section)

## Global Constraints

- Two-lane markings: dashed white centre line, solid white edge lines, gaps at junctions and turning caps.
- Tea rows stay clear of roads, water, the town footprint and ground steeper than the estate limit.
- Picker paths are visual only (no terrain or travel-rule change).
- Deterministic output: fixed seeds, no `Math.random`.
- Low tier halves hedge sampling, as today.
- Match the surrounding code style (dense one-liners in world files, JSDoc on exports).

---

### Task 1: Tea estate data — wider contour band, steeper terraces, winding picker paths

**Files:**
- Modify: `src/content/world/teaEstate.ts`
- Test: `tests/teaEstate.test.ts` (create)

**Interfaces:**
- Produces: `TEA_ESTATE_PLANTING: { rows: TeaRow[]; shade: ShadeTree[]; paths: Vec3[][] }` (adds `paths`); `TEA_ESTATE.rows = 22`, `maxSlope = .85`; `isTeaEstateGround` unchanged signature.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { TEA_ESTATE, TEA_ESTATE_PLANTING } from '../src/content/world/teaEstate';
import { V2_LAYOUT, V2_ROUTES, EXPANSION_LAYOUT, isWater } from '../src/content/world/definition';
import { pointInPolygon } from '../src/content/world/expansionLayout';

const routes = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES];
function roadClearance(x: number, z: number) {
  let best = Infinity;
  for (const r of routes) for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) - r.widthM / 2);
  }
  return best;
}

describe('Peringalkuthu tea estate', () => {
  const points = TEA_ESTATE_PLANTING.rows.flatMap(r => r.points);
  const town = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!;
  it('plants a broad contour band up the slopes', () => {
    expect(TEA_ESTATE.rows).toBe(22);
    expect(points.length).toBeGreaterThan(9000);
  });
  it('keeps every hedge off roads, water and the town', () => {
    expect(points.filter(([x, , z]) => roadClearance(x, z) < 1.2 || isWater(x, z) || pointInPolygon(x, z, town.footprint)).length).toBe(0);
  });
  it('threads winding picker paths across the rows, never through a hedge', () => {
    expect(TEA_ESTATE_PLANTING.paths.length).toBeGreaterThan(20);
    for (const path of TEA_ESTATE_PLANTING.paths) {
      expect(path.length).toBeGreaterThanOrEqual(4);
      const xs = path.map(p => p[0]);
      // Winding, not a ruler-straight cut.
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    }
    const hedgeNear = (x: number, z: number) => points.some(p => Math.hypot(p[0] - x, p[2] - z) < .6);
    const sample = TEA_ESTATE_PLANTING.paths.flatMap(p => p.filter((_, i) => i % 3 === 1)).slice(0, 200);
    expect(sample.filter(([x, , z]) => hedgeNear(x, z)).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/teaEstate.test.ts`
Expected: FAIL (`TEA_ESTATE.rows` is 17; `paths` undefined).

- [ ] **Step 3: Implement**

In `teaEstate.ts`:
- `rows: 22`, `maxSlope: .85`; doc comment notes the terraces now climb the steeper cut banks.
- Replace the straight picker-path test with a winding gap: for path `k` the gap centre along the road is `k * pathEveryM + wobble(k, offset)` where `wobble = Math.sin(offset * .13 + k * 1.7) * 5`; a sample is in the path when within `1.1 m` of that centre.
- Build `paths`: for each `k` and side, one point per row offset (first row − 1 m … last row + 1 m) at the gap centre, kept only where `hasGroundAt`, not water, and `isClearOfRoads(x, z, 1.5)`; keep paths with ≥ 4 points.

```ts
const wobble = (k: number, offset: number) => Math.sin(offset * .13 + k * 1.7) * 5;
const pathK = (s: number, offset: number) => {
  const k = Math.round(s / TEA_ESTATE.pathEveryM);
  return Math.abs(s - (k * TEA_ESTATE.pathEveryM + wobble(k, offset))) < 1.1;
};
// in the row loop:  const inPath = pathK(p.s, offset);
// after the rows:
const paths: Vec3[][] = [];
const lineAt = (s: number) => line[Math.max(0, Math.min(line.length - 1, Math.round(s)))];
for (let k = 1; k * TEA_ESTATE.pathEveryM < line.at(-1)!.s; k++) for (const side of [-1, 1]) {
  const path: Vec3[] = [];
  for (let offset = TEA_ESTATE.firstRowM - 1; offset <= TEA_ESTATE.firstRowM + (TEA_ESTATE.rows - 1) * TEA_ESTATE.rowSpacingM + 1; offset += 1) {
    const p = lineAt(k * TEA_ESTATE.pathEveryM + wobble(k, offset));
    const x = p.x + p.nx * offset * side, z = p.z + p.nz * offset * side;
    if (!hasGroundAt(x, z) || isWater(x, z) || !isClearOfRoads(x, z, 1.5) || pointInPolygon(x, z, town.footprint)) { if (path.length >= 4) paths.push(path.splice(0)); else path.length = 0; continue; }
    path.push([x, terrainHeight(x, z), z]);
  }
  if (path.length >= 4) paths.push(path);
}
return { rows, shade, paths };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/teaEstate.test.ts tests/roadScenery.test.ts tests/v2Dressing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat: widen tea estate onto steeper terraces with winding picker paths`

### Task 2: Tea estate rendering — bush-chain hedges, dark soil, silver oaks, red-earth paths

**Files:**
- Modify: `src/game/world/TeaEstate.tsx`, `src/game/world/ExpansionGround.tsx` (tea soil colour)

**Interfaces:**
- Consumes: `TEA_ESTATE_PLANTING.paths` (Task 1), `createPaintGeometry(paint, heightAt)` from `chalakkudyCityGeometry.ts`.

- [ ] **Step 1: Hedges as bush chains.** Resample each row every `.5 m` (`1 m` on low). Along the row, `dome = Math.sqrt(Math.abs(Math.sin(Math.PI * s / bush)))` with `bush = 1.35`; per-bush jitter `j = hash(row, bushIndex)` in 0..1. Width scale `.8 + .2 * dome`, height scale `(.78 + .22 * dome) * (.92 + .16 * j)`. Waists darken toward `side` colour. Keep the rounded row ends.
- [ ] **Step 2: Dark soil.** In `ExpansionGround.tsx` set `TEA_SOIL` to `#4d4a2d` so the gaps between hedges read as shadowed earth.
- [ ] **Step 3: Silver oaks.** Trunk radius `.16–.26`, height `t.height`; three small crown tufts per tree (one instanced mesh with `3 × n` instances) at `.62`, `.76`, `.9` of the height, alternating sides by `.6 m`, scale `1.3–1.9`, colour `#6f8f4a`.
- [ ] **Step 4: Picker paths.** Convert each path polyline into `CityPaint` strips (`width 1.3`, colour `#9c6a43`) and draw with `createPaintGeometry(paint, terrainHeight)` under the hedges' material settings (`polygonOffset`).
- [ ] **Step 5: Verify visually** — screenshot the estate from `(-430, -705)` and compare against the reference photo; run `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `feat: render tea as clipped bush chains with silver oaks and earth paths`

### Task 3: Two-lane road markings

**Files:**
- Create: `src/content/world/roadMarkings.ts`
- Modify: `src/game/world/ExpansionGround.tsx`
- Test: `tests/roadMarkings.test.ts`

**Interfaces:**
- Produces: `MARKED_ROADS: ReadonlySet<string>`; `resampleRoute(points, step)` (also used by Task 4); `twoLaneMarkings(route: ExpansionRoute, others: readonly ExpansionRoute[], caps: readonly { center: Vec3; radius: number }[]): CityPaint[]`; `ROAD_MARKINGS: CityPaint[]` (all marked roads).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ROAD_MARKINGS, MARKED_ROADS } from '../src/content/world/roadMarkings';
import { V2_ROUTES, V2_LAYOUT } from '../src/content/world/definition';

const dist = (x: number, z: number, pts: readonly (readonly number[])[]) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[2] - a[2]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t)); }
  return best;
};
describe('two-lane road markings', () => {
  const marked = V2_ROUTES.filter(r => MARKED_ROADS.has(r.id));
  it('marks the Malakkappara roads', () => {
    expect(marked.map(r => r.id).sort()).toEqual(['chalakudy-dam-road', 'malakkappara-road']);
    expect(ROAD_MARKINGS.length).toBeGreaterThan(500);
  });
  it('keeps every strip on its carriageway', () => {
    for (const s of ROAD_MARKINGS) {
      const mx = (s.a[0] + s.b[0]) / 2, mz = (s.a[1] + s.b[1]) / 2;
      expect(Math.min(...marked.map(r => dist(mx, mz, r.points) - r.widthM / 2))).toBeLessThan(0);
      expect(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])).toBeLessThan(2.1);
    }
  });
  it('leaves turning caps unpainted', () => {
    for (const cap of V2_LAYOUT.roadCaps) for (const s of ROAD_MARKINGS) expect(Math.hypot(s.a[0] - cap.center[0], s.a[1] - cap.center[2])).toBeGreaterThan(cap.radius);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/roadMarkings.test.ts` → module not found.
- [ ] **Step 3: Implement `roadMarkings.ts`**

```ts
import type { Vec3 } from '../../contracts';
import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { CityPaint } from './chalakkudyCity';
import { EXPANSION_LAYOUT, V2_LAYOUT, V2_ROUTES } from './definition';

const WHITE = '#f1efe6';
/** Two-lane roads that get a dashed centre line and solid edge lines. */
export const MARKED_ROADS: ReadonlySet<string> = new Set(['malakkappara-road', 'chalakudy-dam-road']);

function polylineDistance(x: number, z: number, pts: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
}

/** The route resampled every ~`step` m, with smoothed left normals and distance along. */
export function resampleRoute(points: readonly Vec3[], step = 1.5) {
  const out: { x: number; y: number; z: number; s: number; nx: number; nz: number }[] = [];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1e-6) continue;
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = out.length ? 1 : 0; k <= n; k++) { const t = k / n; out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, s: s + l * t, nx: 0, nz: 0 }); }
    s += l;
  }
  for (let i = 0; i < out.length; i++) {
    const p = out[Math.max(0, i - 2)], q = out[Math.min(out.length - 1, i + 2)], l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    out[i].nx = -(q.z - p.z) / l; out[i].nz = (q.x - p.x) / l;
  }
  return out;
}

export function twoLaneMarkings(route: ExpansionRoute, others: readonly ExpansionRoute[], caps: readonly { center: Vec3; radius: number }[]): CityPaint[] {
  const half = route.widthM / 2, samples = resampleRoute(route.points), paint: CityPaint[] = [];
  const clear = (x: number, z: number) => others.every(o => polylineDistance(x, z, o.points) > o.widthM / 2 + 3) && caps.every(c => Math.hypot(x - c.center[0], z - c.center[2]) > c.radius + 2);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (!clear(a.x, a.z) || !clear(b.x, b.z)) continue;
    const strip = (o: number, width: number) => paint.push({ a: [a.x + a.nx * o, a.z + a.nz * o], b: [b.x + b.nx * o, b.z + b.nz * o], width, color: WHITE });
    for (const o of [-(half - .3), half - .3]) strip(o, .12);
    if (Math.floor((a.s + b.s) / 2 / 3) % 2 === 0) strip(0, .12);
  }
  return paint;
}

const carRoutes = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'));
export const ROAD_MARKINGS: CityPaint[] = V2_ROUTES.filter(r => MARKED_ROADS.has(r.id)).flatMap(r => twoLaneMarkings(r, carRoutes.filter(o => o.id !== r.id), V2_LAYOUT.roadCaps));
```


- [ ] **Step 4: Render** in `ExpansionGround.tsx`: `const paint = useMemo(() => createPaintGeometry(ROAD_MARKINGS, surfaceHeight), [])`, drawn as `<mesh geometry={paint} receiveShadow><meshStandardMaterial vertexColors roughness={.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/></mesh>` with disposal.
- [ ] **Step 5: Run tests** — `npx vitest run tests/roadMarkings.test.ts` → PASS.
- [ ] **Step 6: Commit** — `feat: paint lane lines on Malakkappara's two-lane roads`

### Task 4: Dry-stone retaining walls along road cuts

> **Dropped during execution (2026-09-18).** Measured along both graded roads, the ground within 10 m of the edge never rises more than 0.8 m: the verges are already graded to about 1:3, so there is no raw road cut to face. The sheer banks were 14–20 m out and are now covered by Task 2's terraces (slope limit 1.15). Walls move to Phase 2, where the town pad meets the steep bank east of town.

**Files:**
- Create: `src/content/world/retainingWalls.ts`, `src/game/world/RetainingWalls.tsx`
- Modify: `src/game/world/KeralaWorld.tsx` (mount next to `<TeaEstate/>`)
- Test: `tests/retainingWalls.test.ts`

**Interfaces:**
- Produces: `interface WallBlock { position: Vec3; size: Vec3; yaw: number; shade: number }`; `ROAD_RETAINING_WALLS: WallBlock[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ROAD_RETAINING_WALLS } from '../src/content/world/retainingWalls';
import { V2_ROUTES, terrainHeight } from '../src/content/world/definition';

describe('road retaining walls', () => {
  it('lines the uphill cuts of the graded mountain roads', () => {
    expect(ROAD_RETAINING_WALLS.length).toBeGreaterThan(40);
  });
  it('stands beside the carriageway, never on it', () => {
    const roads = V2_ROUTES.filter(r => r.id === 'chalakudy-dam-road' || r.id === 'malakkappara-road');
    for (const w of ROAD_RETAINING_WALLS) {
      const [x, , z] = w.position;
      const d = Math.min(...roads.flatMap(r => r.points.map(p => Math.hypot(p[0] - x, p[2] - z) - r.widthM / 2)));
      expect(d).toBeGreaterThan(.7);
      // Its top meets the bank: never a free-standing fence above the ground behind it.
      expect(w.position[1] + w.size[1] / 2).toBeLessThanOrEqual(terrainHeight(x, z) + w.size[1]);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails** — module not found.
- [ ] **Step 3: Implement `retainingWalls.ts`**: resample each graded road (`GRADED_SIDE_ROADS`) every 2 m with `resampleRoute` from Task 3; for each side, `edge = half + .75 + .45`; `rise = terrainHeight(edge + 2.5) − roadY`; where `rise > 1.4` emit a block centred at offset `edge`, along-length 2.05 m, thickness .7, bottom at `roadY − .3`, height `min(rise, 3.2) + .3 + jitter(.25)`, yaw from the road tangent, shade from a seeded hash. Skip blocks within 6 m of a turning cap or another road.
- [ ] **Step 4: Render** `RetainingWalls.tsx`: one `instancedMesh` of `boxGeometry`, `meshStandardMaterial flatShading roughness 1`, per-instance colour `#8d8a7e` scaled by `.8 + .3 * shade`. No colliders (the bank behind is already solid ground).
- [ ] **Step 5: Tests + typecheck** — `npx vitest run tests/retainingWalls.test.ts && npx tsc --noEmit`.
- [ ] **Step 6: Screenshot** the dam road cut near `(-470, -700)`.
- [ ] **Step 7: Commit** — `feat: dry-stone retaining walls along the mountain road cuts`
