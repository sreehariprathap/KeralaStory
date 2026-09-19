# Car Surface-Aware Traction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cars grip, accelerate, and top out differently on paved roads versus off-road terrain, with stunt/park/stadium ground staying full-grip, using only existing world data — no new colliders or geometry.

**Architecture:** A new pure module (`src/content/world/roadSurface.ts`) assembles every authored drivable route into a lookup table and exposes `surfaceAt(x, z)`. `carPhysics.ts`'s existing per-step Rapier vehicle-controller loop calls it once per step and scales wheel friction, side-friction, and top speed by the result — no new physics concepts, just surface-dependent scaling of values that already exist.

**Tech Stack:** TypeScript, Rapier3D (`@dimforge/rapier3d-compat`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-car-surface-traction-design.md`

## Global Constraints

- No new colliders, textures, or visual surface differentiation — physics-feel only.
- Stunt parks, ramps, and the football ground (`isStuntGround`) must always resolve to full grip (`gripFactor: 1, topSpeedFactor: 1`), regardless of surrounding terrain.
- `MAIN_PATH` (the original spawn-area road corridor) must be included in the network as paved, at a fixed 3 m half-width (matching `isCycleAllowed`/`wildlifeRules.ts`'s existing treatment of it).
- Bikes are untouched by this plan.
- Grip/speed multipliers are tuning starting points, not fixed requirements: `paved` 1.0/1.0, `dirt` 0.75/0.85, `offroad` 0.55/0.7.
- Before calling any task complete: `npm run typecheck`, `npm test`, `npm run build` must all pass.

---

### Task 1: Surface classification module

**Files:**
- Create: `src/content/world/roadSurface.ts`
- Test: `tests/roadSurface.test.ts`

**Interfaces:**
- Consumes: `Vec3` from `../../contracts`; `EXPANSION_LAYOUT`, `V2_ROUTES`, `MAIN_PATH` from `./definition`; `CHALAKKUDY_BRIDGES`, `CHALAKKUDY_CITY_ROADS`, `CITY_ROAD_WIDTH_M` from `./chalakkudyCityPlan`; `isStuntGround` from `../../game/world/stuntSites`.
- Produces: `export type SurfaceKind = 'paved' | 'dirt' | 'offroad'`, `export interface SurfaceSample { kind: SurfaceKind; gripFactor: number; topSpeedFactor: number }`, `export function surfaceAt(x: number, z: number): SurfaceSample`. Task 2 imports `surfaceAt` from this module.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/roadSurface.test.ts
import { describe, expect, it } from 'vitest';
import { surfaceAt } from '../src/content/world/roadSurface';
import { MAIN_PATH } from '../src/content/world/definition';
import { stuntSites } from '../src/game/world/stuntSites';

describe('surfaceAt', () => {
  it('is paved on the original MAIN_PATH corridor near spawn', () => {
    const [x, z] = MAIN_PATH[0];
    const sample = surfaceAt(x, z);
    expect(sample.kind).toBe('paved');
    expect(sample.gripFactor).toBe(1);
    expect(sample.topSpeedFactor).toBe(1);
  });

  it('is dirt on the summit off-road track', () => {
    const sample = surfaceAt(-223.86061114968692, -732.7363076784491);
    expect(sample.kind).toBe('dirt');
    expect(sample.gripFactor).toBeCloseTo(0.75);
    expect(sample.topSpeedFactor).toBeCloseTo(0.85);
  });

  it('is full grip inside a stunt site even though it is far from any route', () => {
    const site = stuntSites()[0];
    const sample = surfaceAt(site.clear[0].x, site.clear[0].z);
    expect(sample.kind).toBe('paved');
    expect(sample.gripFactor).toBe(1);
    expect(sample.topSpeedFactor).toBe(1);
  });

  it('is off-road far from every route and stunt site', () => {
    const sample = surfaceAt(-835, -935);
    expect(sample.kind).toBe('offroad');
    expect(sample.gripFactor).toBeCloseTo(0.55);
    expect(sample.topSpeedFactor).toBeCloseTo(0.7);
  });

  it('blends smoothly in the shoulder just past a route edge, never snapping', () => {
    // 4m from MAIN_PATH's centerline: 1m past its 3m half-width, inside the 2m shoulder.
    const sample = surfaceAt(-4, -470.5);
    expect(sample.kind).toBe('paved');
    expect(sample.gripFactor).toBeLessThan(1);
    expect(sample.gripFactor).toBeGreaterThan(0.55);
    expect(sample.topSpeedFactor).toBeLessThan(1);
    expect(sample.topSpeedFactor).toBeGreaterThan(0.7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/roadSurface.test.ts`
Expected: FAIL — `src/content/world/roadSurface.ts` does not exist.

- [ ] **Step 3: Write `roadSurface.ts`**

```ts
// src/content/world/roadSurface.ts
import type { Vec3 } from '../../contracts';
import { EXPANSION_LAYOUT, V2_ROUTES, MAIN_PATH } from './definition';
import { CHALAKKUDY_BRIDGES, CHALAKKUDY_CITY_ROADS, CITY_ROAD_WIDTH_M } from './chalakkudyCityPlan';
import { isStuntGround } from '../../game/world/stuntSites';

export type SurfaceKind = 'paved' | 'dirt' | 'offroad';
export interface SurfaceSample { kind: SurfaceKind; gripFactor: number; topSpeedFactor: number }

const FACTORS: Record<SurfaceKind, { gripFactor: number; topSpeedFactor: number }> = {
  paved: { gripFactor: 1, topSpeedFactor: 1 },
  dirt: { gripFactor: .75, topSpeedFactor: .85 },
  offroad: { gripFactor: .55, topSpeedFactor: .7 },
};

/** Metres beyond a route's half-width where grip fades smoothly toward off-road, instead of snapping. */
const SHOULDER_M = 2;
/** MAIN_PATH predates the ExpansionRoute system and carries no width of its own; the rest of the
 * codebase (isCycleAllowed, wildlifeRules.ts) already treats it as this fixed paved corridor. */
const MAIN_PATH_HALF_WIDTH_M = 3;

interface Segment { a: Vec3; b: Vec3; halfWidth: number; surface: 'paved' | 'dirt' }

function buildSegments(): Segment[] {
  const segments: Segment[] = [];
  const addPolyline = (points: readonly Vec3[], halfWidth: number, surface: 'paved' | 'dirt') => {
    for (let i = 1; i < points.length; i++) segments.push({ a: points[i - 1], b: points[i], halfWidth, surface });
  };
  for (const route of [...EXPANSION_LAYOUT.routes, ...V2_ROUTES]) addPolyline(route.points, route.widthM / 2, route.surface ?? 'paved');
  for (const bridge of CHALAKKUDY_BRIDGES) addPolyline([bridge.from, bridge.to], bridge.width / 2, 'paved');
  for (const road of CHALAKKUDY_CITY_ROADS) addPolyline(road.points, CITY_ROAD_WIDTH_M / 2, 'paved');
  addPolyline(MAIN_PATH.map(([x, z]): Vec3 => [x, 0, z]), MAIN_PATH_HALF_WIDTH_M, 'paved');
  return segments;
}

const SEGMENTS = buildSegments();

function distanceToSegment(x: number, z: number, a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
}

function nearestSegment(x: number, z: number): { distance: number; halfWidth: number; surface: 'paved' | 'dirt' } | null {
  let best: { distance: number; halfWidth: number; surface: 'paved' | 'dirt' } | null = null;
  for (const segment of SEGMENTS) {
    const distance = distanceToSegment(x, z, segment.a, segment.b);
    if (!best || distance < best.distance) best = { distance, halfWidth: segment.halfWidth, surface: segment.surface };
  }
  return best;
}

function blendTowardOffroad(from: SurfaceKind, t: number): SurfaceSample {
  const a = FACTORS[from], b = FACTORS.offroad;
  return { kind: from, gripFactor: a.gripFactor + (b.gripFactor - a.gripFactor) * t, topSpeedFactor: a.topSpeedFactor + (b.topSpeedFactor - a.topSpeedFactor) * t };
}

export function surfaceAt(x: number, z: number): SurfaceSample {
  if (isStuntGround(x, z)) return { kind: 'paved', ...FACTORS.paved };
  const nearest = nearestSegment(x, z);
  if (!nearest) return { kind: 'offroad', ...FACTORS.offroad };
  if (nearest.distance <= nearest.halfWidth) return { kind: nearest.surface, ...FACTORS[nearest.surface] };
  if (nearest.distance <= nearest.halfWidth + SHOULDER_M) return blendTowardOffroad(nearest.surface, (nearest.distance - nearest.halfWidth) / SHOULDER_M);
  return { kind: 'offroad', ...FACTORS.offroad };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/roadSurface.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/world/roadSurface.ts tests/roadSurface.test.ts
git commit -m "feat: add surface-aware traction classification (paved/dirt/offroad)"
```

---

### Task 2: Wire surface sampling into car physics

**Files:**
- Modify: `src/game/vehicle/carPhysics.ts`
- Test: `tests/carPhysics.test.ts`

**Interfaces:**
- Consumes: `surfaceAt` from `../../content/world/roadSurface` (Task 1).
- Produces: no new exports — `step()`'s existing behavior is scaled by surface, callers (`ExplorerController.tsx`, tests) are unaffected.

- [ ] **Step 1: Write the failing tests**

Add to `tests/carPhysics.test.ts`. First add the import and a `surfaceFixture` helper near the existing `terrainFixture` (it mirrors `terrainFixture` but keeps the car occupied and driveable, which `terrainFixture`'s hardcoded `occupied: false` doesn't allow):

```ts
// Add to the existing import block at the top of tests/carPhysics.test.ts:
import { surfaceAt } from '../src/content/world/roadSurface';
```

```ts
// Add near terrainFixture, inside tests/carPhysics.test.ts:
function surfaceFixture(model: CarModelId, point: readonly [number, number]) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  worlds.push(world);
  for (const region of ['north', 'south'] as const) {
    const mesh = terrainMeshData(region);
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
  }
  const feet = safeGroundPosition([point[0], 0, point[1]]);
  const car = createCarPhysics(world, feet, Math.PI, model);
  const step = (forward = 0, steer = 0, brake = false) => { car.step({ forward, steer, brake }, DT, true); world.step(); };
  return { world, car, step };
}
```

```ts
// New describe block, appended to tests/carPhysics.test.ts:
describe('surface-aware traction', () => {
  const PAVED_POINT = MAIN_PATH[1] as readonly [number, number];
  const OFFROAD_POINT = [-73, -399] as const;

  it('classifies the two fixture points as paved and off-road respectively', () => {
    expect(surfaceAt(PAVED_POINT[0], PAVED_POINT[1]).kind).toBe('paved');
    expect(surfaceAt(OFFROAD_POINT[0], OFFROAD_POINT[1]).kind).toBe('offroad');
  });

  it('reaches a lower steady-state top speed off-road than on the paved network', () => {
    const paved = surfaceFixture('admin', PAVED_POINT);
    const offroad = surfaceFixture('admin', OFFROAD_POINT);
    for (let frame = 0; frame < 600; frame++) { paved.step(1); offroad.step(1); }
    expect(paved.car.motion.speed).toBeGreaterThan(offroad.car.motion.speed + 2);
  });

  it('slides more sideways off-road under a hard handbrake turn than on the paved network', () => {
    const paved = surfaceFixture('admin', PAVED_POINT);
    const offroad = surfaceFixture('admin', OFFROAD_POINT);
    for (const rig of [paved, offroad]) for (let frame = 0; frame < 120; frame++) rig.step(1);
    let pavedLateral = 0, offroadLateral = 0;
    for (let frame = 0; frame < 60; frame++) {
      paved.car.step({ forward: 1, steer: 1, brake: false, handbrake: true }, DT, true); paved.world.step();
      offroad.car.step({ forward: 1, steer: 1, brake: false, handbrake: true }, DT, true); offroad.world.step();
      pavedLateral = Math.max(pavedLateral, Math.abs(paved.car.body.angvel().y));
      offroadLateral = Math.max(offroadLateral, Math.abs(offroad.car.body.angvel().y));
    }
    expect(offroadLateral).toBeGreaterThan(pavedLateral);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/carPhysics.test.ts -t "surface-aware traction"`
Expected: The first sub-test (pure classification) PASSes already, since Task 1 is done. The steady-state speed and handbrake-slide tests FAIL, because `carPhysics.ts` doesn't yet call `surfaceAt` — paved and off-road behave identically.

- [ ] **Step 3: Wire `surfaceAt` into `carPhysics.ts`**

Add the import at the top of `src/game/vehicle/carPhysics.ts`:

```ts
import { surfaceAt } from '../../content/world/roadSurface';
```

In `step()`, immediately after the `sample();` call (`src/game/vehicle/carPhysics.ts:76`), add:

```ts
const surface=surfaceAt(body.translation().x,body.translation().z);
```

Change the `maxDriveSpeed` line (`src/game/vehicle/carPhysics.ts:93`) from:

```ts
const maxDriveSpeed = (nitro.active ? topSpeed + NITRO_EXTRA_SPEED : topSpeed) * Math.max(.2, Math.abs(throttle) || 1);
```

to:

```ts
const maxDriveSpeed = (nitro.active ? topSpeed + NITRO_EXTRA_SPEED : topSpeed) * surface.topSpeedFactor * Math.max(.2, Math.abs(throttle) || 1);
```

In the per-wheel loop (`src/game/vehicle/carPhysics.ts:105-113`), change:

```ts
vehicle.setWheelSideFrictionStiffness(i,handbrake&&rear?HANDBRAKE_REAR_GRIP:1);
```

to:

```ts
vehicle.setWheelFrictionSlip(i,3.6*surface.gripFactor);
vehicle.setWheelSideFrictionStiffness(i,(handbrake&&rear?HANDBRAKE_REAR_GRIP:1)*surface.gripFactor);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/carPhysics.test.ts`
Expected: PASS — every existing test in the file (hill starts, settling, top speed, disposal, etc.) plus the three new `surface-aware traction` tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/vehicle/carPhysics.ts tests/carPhysics.test.ts
git commit -m "feat: scale car grip and top speed by terrain surface"
```

---

### Task 3: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including every model in `tests/carPhysics.test.ts`'s existing per-model loop (the surface change must not break any of the pre-existing hill/slope/settling/top-speed tests for any of the 6 tested models).

- [ ] **Step 2: Typecheck everything**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual playtest checklist**

- Drive a stunt park or the stadium/football ground: feel unchanged from before this change.
- Drive off the paved network onto open terrain: noticeably lower top speed and looser handling, still controllable and fun, not punishing.
- Try the handbrake off-road versus on a paved road: looser, longer drift off-road.
- Climb a steep off-road slope versus an equivalent paved climb: off-road is harder, through reduced grip alone (no separate slope tuning was added).
- Drive through the spawn area (MAIN_PATH near `[0, -481]`): still reads as paved, not off-road.

- [ ] **Step 5: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found in full verification pass"
```
