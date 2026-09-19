# Car Surface-Aware Traction — Design

Date: 2026-09-18
Branch: `feature/map-expansion`
Status: approved for implementation (sub-project 1a of the vehicle-experience overhaul)

## Scope

This is the first of several independent sub-projects toward a "GTA-like"
driving overhaul the user asked for. The full request was decomposed as:

1. **Car surface-aware traction (this spec).** Paved roads grip and drive
   differently from off-road terrain. Stunt parks and the football ground
   stay full-grip.
2. **Bike physics rebuild** (its own spec). Bikes move to a full Rapier
   vehicle controller, matching cars, including handbrake/drift — a much
   larger change that also touches the jump/hop launch, air-time stunt
   tricks, water-loss detection, and tilt visuals.
3. **Speed config completion + speed/fuel HUD.** Fuel is a cosmetic gauge
   only (drains while driving, never empties/stops the vehicle) — no fuel
   economy, refueling, or world placement in scope.
4. **Nitro flame VFX**, configurable single/dual per vehicle profile.
5. **Desktop control-panel toggle keybinds (B/C) + a controls config
   section in Settings.**

Each sub-project gets its own spec → plan → implementation cycle. This spec
covers **part 1 only**: cars, not bikes (bikes keep their current analytic
motor, unaffected, until part 2).

## Decisions

| Question | Decision |
| --- | --- |
| New colliders/geometry? | No. Pure data lookup layered onto existing physics (`carPhysics.ts` already runs a real Rapier vehicle controller). |
| Surface classification | Three tiers: `paved`, `dirt`, `offroad`, each with a `gripFactor` and `topSpeedFactor`. Not a continuous function of distance-from-road, except at the road edge (see shoulder blend below). |
| Stunt/park/stadium ground | Always full grip (`paved`-equivalent), regardless of surrounding terrain — reuses the existing `isStuntGround(x, z, margin)` from `stuntSites.ts`. Driving stunt sites must not get worse. |
| Incline difficulty | No separate slope formula. Reduced off-road grip makes climbs harder through the existing suspension/traction physics for free. |
| Tuning | The specific grip/speed multipliers are starting points for feel, not fixed values — tuned during implementation/playtest, not treated as spec requirements. |
| Bikes | Untouched by this spec. |

## Architecture

A new pure module, `src/content/world/roadSurface.ts`, assembles every
drivable route into one lookup table at module load (mirrors the network
already assembled ad hoc in `tests/roadNetwork.test.ts`: `EXPANSION_LAYOUT.routes`
filtered to routes that allow `car`, `V2_ROUTES`, `CHALAKKUDY_BRIDGES`, and
the city roads from `chalakkudyCity.ts`). It exposes one pure function:

```ts
export type SurfaceKind = 'paved' | 'dirt' | 'offroad';
export interface SurfaceSample { kind: SurfaceKind; gripFactor: number; topSpeedFactor: number }
export function surfaceAt(x: number, z: number): SurfaceSample
```

`carPhysics.ts`'s `step()` calls `surfaceAt(body.translation().x, body.translation().z)`
once per physics step and applies the result to values that already exist
in that file — no new physics concepts, just surface-dependent scaling of
existing ones.

### `surfaceAt` classification order

1. **Stunt/sport ground first.** If `isStuntGround(x, z)` is true (stunt
   parks, ramps, the football ground — already covers "reserved sports
   ground" per its existing doc comment), return `{ kind: 'paved', gripFactor: 1, topSpeedFactor: 1 }`
   immediately. This must never regress driving at existing stunt sites.
2. **On a route.** For each assembled route, compute distance from `(x, z)`
   to its polyline (the same point-to-polyline math already duplicated as
   `distanceToPolyline` in `chalakkudyCity.ts` — this module gets its own
   local copy, consistent with how that helper is already duplicated rather
   than shared). If within `widthM / 2`, that route's kind is `route.surface ?? 'paved'` —
   routes with no `surface` field default to paved; the ones already
   marked `'dirt'`, like the summit track, stay `'dirt'`.
3. **Shoulder blend.** Within `widthM / 2` to `widthM / 2 + 2` (a 2 m
   shoulder), linearly blend `gripFactor`/`topSpeedFactor` from the route's
   values toward the `offroad` values. This avoids a hard grip snap at the
   road edge — the same "avoid a snap that vibrates the chassis" problem
   `SPEED_LIMIT_FADE` already solves elsewhere in `carPhysics.ts`.
4. **Otherwise, `offroad`.**

Starting multipliers (tunable): `paved` = 1.0 / 1.0, `dirt` = 0.75 / 0.85,
`offroad` = 0.55 / 0.7. (Raised slightly off-road from the first draft's
0.5/0.65 — the goal is a noticeably different, still fun, feel, not a
punishing one.)

## Car physics integration (`carPhysics.ts`)

In `step()`, after `sample()`:

```ts
const surface = surfaceAt(body.translation().x, body.translation().z);
```

- `vehicle.setWheelFrictionSlip(i, 3.6 * surface.gripFactor)` and
  `vehicle.setWheelSideFrictionStiffness(i, (handbrake && rear ? HANDBRAKE_REAR_GRIP : 1) * surface.gripFactor)`
  — off-road cars both accelerate-slip more and slide sideways more; the
  handbrake's existing grip loosening stacks multiplicatively, so drifting
  off-road is looser than on pavement.
- `maxDriveSpeed`'s existing calculation gains `* surface.topSpeedFactor`
  alongside the nitro bonus already there.
- `DOWNFORCE` is untouched — it keeps fast cars planted over crests and
  isn't a traction mechanic, so it stays surface-independent.
- `driveForce` is untouched directly; grip reduction alone (less friction
  to convert engine force into acceleration) is enough to make off-road
  acceleration and hill-climbing harder without a second penalty stacked
  on top, keeping the tuning surface small.

## Data flow & edge cases

- `roadSurface.ts` builds its route list once at module load — pure data,
  no per-frame allocation.
- One `surfaceAt` call per car per physics step: O(routes) distance
  checks, ~60 Hz, a handful of nearby routes in practice. No spatial index
  needed at this scale (mirrors the same naive-scan approach already used
  in `tests/roadNetwork.test.ts` and `chalakkudyCity.ts`).
- Water: `isVehicleTerrainAllowed`/`isWater` already block car travel onto
  water elsewhere; `surfaceAt` does not need special water handling.
- Bridges count as paved, same as the roads they connect.
- An unoccupied (parked) car still gets `surfaceAt` applied (harmless —
  it only affects friction/speed cap, and a parked car already has zero
  drive force).

## Testing

Pure `surfaceAt` unit tests (`tests/roadSurface.test.ts`, no Rapier):

1. A point on `MAIN_PATH` (or another known paved route) returns `'paved'`.
2. A point on the dirt summit track returns `'dirt'`.
3. A point inside a known stunt-park `clear` circle returns full grip
   (`gripFactor: 1, topSpeedFactor: 1`) even though it sits off any route.
4. An arbitrary forest point far from any route returns `'offroad'`.
5. A point just past a route's half-width (inside the 2 m shoulder) returns
   a blended value strictly between the route's and `offroad`'s.

Real-physics tests added to `tests/carPhysics.test.ts`'s existing fixture
style (flat ground collider, `RAPIER.init()`), stubbing `surfaceAt` (or
using two fixtures whose ground position maps to a known paved vs. known
offroad `(x, z)`):

6. Steady-state top speed after N steps of full throttle is higher on
   paved than off-road, for the same car model.
7. Lateral slip under a hard turn + handbrake is greater off-road than on
   paved (drift is looser).

Before handoff: `npm run typecheck`, `npm test`, `npm run build`. Manual
verification: drive a stunt park and confirm it feels unchanged; drive off
the paved network onto open terrain and confirm a noticeably different but
still controllable feel; climb a steep off-road slope and confirm it's
harder than the equivalent paved climb.

## Out of scope

- Bikes (sub-project 2)
- Fuel, speed HUD, nitro VFX, control toggles/Settings (sub-projects 3-5)
- Per-tile/continuous surface variation beyond the three tiers
- New colliders, textures, or visual surface differentiation (this is a
  physics-feel change only, not a visual one)
