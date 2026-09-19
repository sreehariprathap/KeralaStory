# Malakkappara Phase 2 — The Town — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Malakkappara into a busy hill-station tourist town: shop-houses on both sides of the main road, a KSRTC bus stand, hotels, a hillside resort, and houses stacked up the north slope, all standing on clean, walled ground.

**Architecture:** A pure-data plan (`malakkapparaPlan.ts`, no imports) lists every lot, the hillside footprint and the walled pad edges. `malakkapparaTown.ts` turns the plan plus terrain into Chalakkudy-kit output (`CityPiece[]`, `TraversalBox[]`, `CitySign[]`, `CityPaint[]`). `MalakkapparaTown.tsx` renders it with `createCityGeometry`, `createPaintGeometry` and `Signboard`. The ground is fixed first: the main road rises to pad level, and the pad's fill sides get a short blend faced by dry-stone walls.

**Tech Stack:** TypeScript, React Three Fiber, three.js, Rapier colliders, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-malakkappara-hill-town-design.md` (Phase 2)

## Global Constraints

- Town pad height is `V2_LAYOUT.towns.malakkappara.center[1]` (82 m). Road control grades ≤ 10 % (`tests/v2Layout.test.ts`).
- Every building stands on a plinth reaching its lowest ground sample (5 samples along each side); floors sit on the highest.
- No lot within `road half-width + 1.5 m` of any car road, on water, or overlapping another lot.
- Tea rows, hill trees and boulders stay out of lots and the hillside footprint.
- Colliders for every shell, plinth, wall and bus go to both the client and `packages/simulation/src/worldDefinition.ts`.
- Signs bilingual where it is a town name: `Malakkappara · മലക്കപ്പാറ`.
- Palette (walls): `#f2c230` yellow, `#e8772e` orange, `#b5d334` lime, `#e98aa8` pink, `#7fc3e8` sky, `#f1e6c8` cream, `#c9d6b0` sage. Roofs: `#9b4a2f` tile, `#7c3b28` dark tile, `#8f949a` sheet.

---

### Task 1: Level ground — road at pad height, walled fill edges

**Files:** Modify `src/content/world/v2Layout.ts` (malakkappara-road control point), `src/content/world/v2Ground.ts` (short fill blend). Create `src/content/world/malakkapparaPlan.ts` (plan data incl. `MALAKKAPPARA_FILL_BLEND_M = 3.5`, `MALAKKAPPARA_HILLSIDE`). Test `tests/malakkapparaGround.test.ts`.

- Add control point `[-552, base + 7, -625]` to `malakkappara-road` before the town centre so the carriageway is at pad height through town (grade 5 m / 55 m ≈ 9 %).
- In `createV2GroundProfile().apply`, for the Malakkappara site: when the natural ground is **below** the pad, blend over `3.5 m` instead of `25 m` (a crisp step the walls face); cuts keep the 25 m slope.

Test:

```ts
import { describe, expect, it } from 'vitest';
import { V2_LAYOUT, V2_ROUTES, terrainHeight } from '../src/content/world/definition';

const town = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!, padY = town.center[1];
describe('Malakkappara ground', () => {
  it('carries the main road at pad height through town', () => {
    const road = V2_ROUTES.find(r => r.id === 'malakkappara-road')!;
    for (const p of road.points.filter(p => p[2] < -628)) expect(Math.abs(p[1] - padY)).toBeLessThan(.35);
  });
  it('drops off the fill edges within a few metres instead of a long sag', () => {
    // East edge above the valley: pad at x=-497, valley floor 6 m out.
    expect(Math.abs(terrainHeight(-497, -650) - padY)).toBeLessThan(.2);
    expect(padY - terrainHeight(-489, -650)).toBeGreaterThan(6);
  });
});
```

Commit: `feat: carry Malakkappara's main road at pad level; crisp walled fill edges`

### Task 2: Town plan data and generator

**Files:** Extend `malakkapparaPlan.ts`; create `src/content/world/malakkapparaTown.ts`; test `tests/malakkapparaTown.test.ts`.

**Interfaces (produces):**

```ts
// malakkapparaPlan.ts
export type LotKind = 'shop' | 'house' | 'hotel' | 'resort-cottage' | 'tea-stop' | 'bus-shelter';
export interface TownLot { id: string; kind: LotKind; x: number; z: number; width: number; depth: number; /** Heading the front faces (radians, 0 = +z). */ yaw: number; floors: 1 | 2 | 3; wall: string; roof: 'flat' | 'tile' | 'sheet'; label?: string; accent?: string }
export const MALAKKAPPARA_LOTS: readonly TownLot[];
export const MALAKKAPPARA_HILLSIDE: readonly (readonly [number, number])[]; // polygon, x/z
export const MALAKKAPPARA_WALL_EDGES: readonly { id: string; a: readonly [number, number]; b: readonly [number, number] }[];
export const MALAKKAPPARA_BUS_BAY: { x: number; z: number; length: number; width: number; yaw: number };
// malakkapparaTown.ts
export const MALAKKAPPARA_TOWN: { pieces: CityPiece[]; boxes: TraversalBox[]; signs: CitySign[]; paint: CityPaint[]; clear: (x: number, z: number, margin: number) => boolean };
export function malakkapparaTownBoxes(): TraversalBox[];
export function isMalakkapparaBuilt(x: number, z: number, margin?: number): boolean; // lots + hillside
```

Layout (world x, z; pad y 82):
- **Main road bazaar** (road x ≈ −552…−555, z −628…−664): west lots x −562, east lots x −543 at z −632, −641, −650, −659; 8.6 × 9 m, 2–3 floors; west face +x (`yaw = π/2`), east face −x (`yaw = −π/2`). East side z −628…−646 is the bus stand instead of shops.
- **Dam-road bazaar** (road z ≈ −695, x −535…−497): north lots z −705, south lots z −685 at x −527, −518, −509, −500; 8.4 × 9 m; north face +z (`yaw = 0`), south face −z (`yaw = π`).
- **Bus stand:** bay 18 × 7 m at x −545.5, z −636 along the road; shelter behind it; KSRTC bus parked in the bay.
- **Tea stop** (existing place anchor −532, −642): 9 × 7 m, faces the bus stand (−x).
- **Hotel High Range:** 16 × 12 m, 3 floors, at −512, −652, faces −x. Car park strip beside it.
- **Tea County Inn:** 16 × 12 m, 3 floors, at −578, −718, faces +z to the dam-road corner.
- **West quarter houses:** x −575…−605, z −632…−668 and z −705…−742 (2 floors, varied colours).
- **Hillside houses:** three terraces along the north slope at z −752, −762, −771, x −600…−520, 7–9 m wide, 2 floors, on tall plinths (the downhill storey reads as a basement, as in hill towns).
- **Misty Hills Resort:** four cottages 6 × 6 m near the dam road's hill-top stretch (z ≈ −774, x −600…−570) plus a reception block and sign facing the dam road.

Kit details per building (all boxes, `yaw`-rotated): plinth to lowest ground; shell; storey bands; windows as dark-blue `glass` panels; shops get a rolling shutter (light grey), awning (accent), signboard; flat roofs get a parapet and one or two black water tanks; tile roofs are two pitched slabs (`pitch ±0.42`) with a ridge; sheet roofs are one shallow pitched slab.

Tests:

```ts
import { describe, expect, it } from 'vitest';
import { MALAKKAPPARA_LOTS } from '../src/content/world/malakkapparaPlan';
import { MALAKKAPPARA_TOWN } from '../src/content/world/malakkapparaTown';
import { EXPANSION_LAYOUT, V2_ROUTES, isWater, terrainHeight } from '../src/content/world/definition';

const roads = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'));
const corners = (l: typeof MALAKKAPPARA_LOTS[number]) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
  const ax = u * l.width / 2, az = v * l.depth / 2;
  return [l.x + Math.cos(l.yaw) * ax + Math.sin(l.yaw) * az, l.z - Math.sin(l.yaw) * ax + Math.cos(l.yaw) * az] as const;
});
const roadGap = (x: number, z: number) => Math.min(...roads.map(r => { let best = Infinity; for (let i = 1; i < r.points.length; i++) { const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[2] - a[2]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t)); } return best - r.widthM / 2; }));

describe('Malakkappara town', () => {
  it('builds a real town', () => {
    const kinds = MALAKKAPPARA_LOTS.map(l => l.kind);
    expect(kinds.filter(k => k === 'shop').length).toBeGreaterThanOrEqual(18);
    expect(kinds.filter(k => k === 'house').length).toBeGreaterThanOrEqual(20);
    expect(kinds.filter(k => k === 'hotel').length).toBe(2);
    expect(kinds.filter(k => k === 'resort-cottage').length).toBeGreaterThanOrEqual(4);
    expect(kinds).toContain('bus-shelter');
  });
  it('keeps every lot off roads and water', () => {
    for (const l of MALAKKAPPARA_LOTS) for (const [x, z] of corners(l)) {
      expect(roadGap(x, z), l.id).toBeGreaterThan(1.5);
      expect(isWater(x, z), l.id).toBe(false);
    }
  });
  it('never overlaps two lots', () => {
    const boxes = MALAKKAPPARA_LOTS.map(l => { const c = corners(l); return { id: l.id, xs: c.map(p => p[0]), zs: c.map(p => p[1]) }; });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const apart = Math.max(...a.xs) <= Math.min(...b.xs) || Math.max(...b.xs) <= Math.min(...a.xs) || Math.max(...a.zs) <= Math.min(...b.zs) || Math.max(...b.zs) <= Math.min(...a.zs);
      expect(apart, `${a.id} × ${b.id}`).toBe(true);
    }
  });
  it('stands every building on a plinth that reaches the ground', () => {
    for (const l of MALAKKAPPARA_LOTS) {
      const plinth = MALAKKAPPARA_TOWN.boxes.find(b => b.id === `${l.id}-plinth`)!;
      expect(plinth, l.id).toBeDefined();
      const bottom = plinth.position[1] - plinth.size[1] / 2;
      for (const [x, z] of corners(l)) expect(bottom, l.id).toBeLessThanOrEqual(terrainHeight(x, z) + .01);
    }
  });
});
```

Commit: `feat: Malakkappara town plan and building kit`

### Task 3: Render, colliders, retaining walls, bus, sign, integration

**Files:** Create `src/game/world/MalakkapparaTown.tsx`; modify `KeralaWorld.tsx` (mount), `packages/simulation/src/worldDefinition.ts` (boxes), `v2Dressing.ts` (remove the eight old Malakkappara entries), `V2WorldDressing.tsx` (remove the two town palms), `ExpansionGround.tsx` (no "· site" board for Malakkappara), `teaEstate.ts` + `mountainDressing.ts` (skip `isMalakkapparaBuilt`).

- Walls: along each `MALAKKAPPARA_WALL_EDGES` segment, 2 m dry-stone blocks from the ground at the wall's foot up to pad height + 0.9 m parapet, thickness = `MALAKKAPPARA_FILL_BLEND_M`, skipped within `road half-width + 4 m` of a car road; each block is a collider.
- Bus: KSRTC-style box bus (11 × 2.5 × 3.1 m): red lower body `#b3261e`, cream upper `#efe3c2`, yellow band `#f2c230`, dark windows, route board "Chalakkudy" (signboard), wheels; one collider.
- Gateway: arch over the main road at the pad's south edge, board `Welcome to Malakkappara · മലക്കപ്പാറ`.
- Street lamps along both bazaar stretches; zebra crossing at the bus stand.

Verify: screenshots of the bazaar, bus stand, hillside and east wall; `npx vitest run --dir tests`; typecheck.

Commit: `feat: render Malakkappara town with bus stand, hotels, resort and hillside homes`
