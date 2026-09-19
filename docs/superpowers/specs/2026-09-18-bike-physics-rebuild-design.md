# Bike Physics Rebuild — Design

Date: 2026-09-18
Branch: `feature/map-expansion`
Status: approved for implementation (sub-project 2 of the vehicle-experience overhaul)

## Scope

Second of five sub-projects toward the "GTA-like" driving overhaul (see
`docs/superpowers/specs/2026-09-18-car-surface-traction-design.md` for the
full decomposition). Bikes move from the current character-controller-driven
analytic motor to a real Rapier vehicle controller, matching how cars
already work in `carPhysics.ts`:

- Real terrain/slope interaction through actual suspension physics, not a
  kinematic approximation.
- Surface-aware traction, reusing `roadSurface.ts` from sub-project 1
  unmodified.
- A genuine handbrake/drift, mirroring the car's rear-grip-loosening
  technique.
- Real ramp-launch physics (cars already get this for free; bikes currently
  fake it with a kinematic launch-boost hack).
- A real jump impulse (a "bunny-hop") replacing the kinematic jump-speed
  override, still opening the stunt-trick window.

Out of scope: fuel, speed HUD, nitro VFX, control toggles/Settings
(sub-projects 3-5, unaffected by this work). Multiplayer is untouched —
bikes, like cars, have no multiplayer network sync today and none is added.

## Decisions

| Question | Decision |
| --- | --- |
| Wheel model | A narrow single-track Rapier vehicle controller: the same 4-wheel raycast technique cars use, but all 4 wheels on the centerline (`x: 0`), front pair at `+halfWheelbase`, rear pair at `-halfWheelbase`. No real 2-wheel balance physics — a standard arcade-racer technique. `BicycleVisual` already only renders 2 wheels, so nothing changes visually. |
| Jump button | Kept, as a real upward impulse applied to the rigid body while grounded — a real "bunny-hop," not a kinematic override. Still opens the stunt-trick window on liftoff. |
| Ramp launches | Fall out of real suspension physics for free, exactly like cars. The kinematic `groundClimb`-based launch-boost hack (`BIKE_MAX_LAUNCH`) is deleted, not ported — it existed only because the old kinematic mover didn't carry momentum over a crest on its own. |
| Stunt tricks (`bikeStunts.ts`) | Unchanged in spirit: a cosmetic pitch/spin overlay rendered on top of the physics body's real transform while airborne. Never fed back into the physics simulation, so it can't fight the solver. Landing/wipeout detection triggers on the same airborne→grounded transition as today, now sourced from real wheel contact. |
| `bikeGrounding.ts` | Deleted. A real physics body's rotation already reflects ground slope, making the hand-rolled raycast tilt sampling redundant. |
| Water-loss | Mirrors the car's existing `useAfterPhysicsStep` check verbatim (translation vs. `openWaterSurfaceAt`/`isSunk`), just against the bike body. |
| Collision shape | The bike's physics chassis (sized from each `BikeModel`'s `length`/`halfWheelbase`) replaces the player capsule while riding — the same swap cars already do. This is a real behavior change: bikes will no longer fit through gaps only a walking-sized capsule could clear. Flagged as an edge case to verify, not a blocker. |
| `stepBicycle`/`bicycleMotor.ts` | Deleted once nothing calls it. |
| Multiplayer | Untouched; out of scope. |

## Architecture

A new module, `src/game/vehicle/bikePhysics.ts`, mirrors `carPhysics.ts`
structurally:

```ts
export interface BikeMotion {
  speed: number; signedSpeed: number; throttle: number; grounded: boolean;
  nitroActive: boolean; nitroRemaining: number;
  wheelRotation: number[]; wheelSteering: number[];
}
export function createBikePhysics(world: World, feet: Vec3, heading: number, model: BikeModelId) {
  // ...same shape as createCarPhysics: { body, vehicle, motion, sample, step, dispose }
}
```

`ExplorerController.tsx`'s bicycle branch changes from feeding `stepBicycle`'s
x/z deltas into the shared kinematic `computeExplorerMovement` mover, to
creating/disposing `bike.current: ReturnType<typeof createBikePhysics>`
exactly where `car.current` is created/disposed today (mount/dismount), and
syncing the character's rendered position/rotation *from*
`bike.current.body.translation()/rotation()` each frame — the same pattern
already used for cars in the existing `useAfterPhysicsStep` block:

```ts
if(car.current){const p=car.current.body.translation(),...
  if(vehicle.current==='car'){heading.current=carHeading;rigidBody.setTranslation(p,true);...}}
```

gets a `bike.current` twin. `bicycleMotor.ts` (`stepBicycle`, `BicycleMotorState`)
and `bikeGrounding.ts` (`measureBikeTilt`) are deleted once nothing calls
them. `bikeStunts.ts` is unchanged — it never touched physics.

### Wheel setup & traction

`BikeModel` (`bikeProfiles.ts`) gains a `wheelRadius: number` field (bikes
don't have one today; cars' `VehicleProfile.wheels[].radius` is the
precedent). `createBikePhysics` builds the vehicle controller with the same
suspension-stiffness/compression/relaxation constants `carPhysics.ts` already
uses as arcade-tuned defaults, narrowed for a single-track body. Each
physics step calls `surfaceAt(body.translation().x, body.translation().z)`
(unmodified import from `roadSurface.ts`) and scales `setWheelFrictionSlip`
and the drive-speed cap exactly like `carPhysics.ts` does — no new surface
logic, pure reuse.

Handbrake loosens the rear wheel pair's side-friction stiffness, mirroring
`HANDBRAKE_REAR_GRIP` in `carPhysics.ts`. Nitro keeps using the existing
`carNitro.ts` module (`createNitroState`/`stepNitro`) bikes already share
with cars — `BicycleTuning.nitro`'s `extraSpeed`/`accelerationMultiplier`
apply the same way they do today, just against the new physics-driven
`maxDriveSpeed` instead of the analytic motor's target speed.

### Jump, stunts, landing

On a jump press while `motion.grounded` is true, `bikePhysics.ts` exposes
a `hop()` method that applies an upward impulse
(`body.applyImpulse({x:0,y:magnitude,z:0},true)`) sized to produce roughly
the same liftoff feel the old kinematic `BIKE_HOP_SPEED` gave (exact
magnitude tuned during implementation/playtest, not fixed here).
`ExplorerController.tsx` calls `hop()` on the existing jump-queued input
instead of passing `jumpSpeed` into `computeExplorerMovement`.

`stepStuntAir`/`landStunt` (`bikeStunts.ts`) are called exactly as today,
gated on `!bike.current.motion.grounded` instead of the kinematic mover's
`state.grounded`. The resulting `stunt.current.pitch`/`spin` are applied as
an *additional* rotation on `BicycleVisual`'s rendered group, layered on
top of the physics body's real orientation — the rigid body itself is
never rotated by trick input.

### Mounting & water-loss

Mount creates `bike.current = createBikePhysics(world, feet, heading, bikeModelId)`;
dismount calls `bike.current.dispose()` and clears it — the same lifecycle
`car.current` already has. In `useAfterPhysicsStep`, a `loseBike()` check
mirrors the car's water-loss block verbatim:

```ts
if(bike.current){const p=bike.current.body.translation(),feetY=p.y-FEET_TO_CENTER;
  if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseBike();}
```

### Visuals

`BicycleVisual` and the rider pose read the bike physics body's real
position/rotation directly (via `bike.current.sample()`, mirroring
`car.current.sample()`), instead of `bikeGrounding.ts`'s hand-sampled pitch/
offset. The trick pitch/spin overlay composes on top of that real rotation
at render time only.

## Data flow

1. Mount: `bike.current` created at the parked bike's position/heading,
   same as today.
2. Each physics step: `bike.current.step(intent, dt, occupied)` — intent
   built from the same input sources `stepBicycle` used (forward, steer,
   brake, nitro, handbrake — `BicycleIntent` gains `handbrake?: boolean`,
   matching `CarIntent`).
3. `useAfterPhysicsStep`: character position/rotation synced from the bike
   body; water-loss checked; `motion.speed`/`signedSpeed` read from
   `bike.current.motion` instead of the kinematic delta.
4. Dismount or water-loss: `bike.current.dispose()`.

## Error handling / edge cases

- A bike that can't fit somewhere a walking capsule could (narrow gaps) is
  an accepted, flagged behavior change — verify by hand during
  implementation that no core paths (parking spots, existing stunt ramps,
  village lanes) become impassable.
- Water-loss, terrain-not-allowed rejection (`isVehicleTerrainAllowed`),
  and the "no clear space to spawn" checks all reuse existing car-side
  patterns rather than inventing new ones.
- If a bike model's `wheelRadius`/`halfWheelbase` produce a degenerate
  suspension setup (e.g. wheels intersecting), that surfaces immediately in
  the settling test (see Testing) the same way car regressions would.

## Testing

Mirrors `tests/carPhysics.test.ts`'s structure and fixture style
(`RAPIER.init()`, flat-ground and real-terrain fixtures) for every model in
`BIKE_MODELS`:

1. Each bike settles with tyre contact on flat ground at a sane ride height.
2. Each bike climbs a graded incline through real tyre contact (no
   velocity/position overrides), mirroring the car hill-start tests.
3. `hop()` while grounded produces a measurable upward impulse; calling it
   mid-air is a no-op.
4. Handbrake loosens rear-wheel side friction, producing more yaw under a
   turn than without it (mirrors the existing car drift test).
5. Surface-aware traction: reaches a lower steady-state top speed off-road
   than on the paved network (mirrors the car surface test, reusing the
   same verified real-world paved/off-road coordinates from sub-project 1).
6. Disposal removes the chassis and vehicle controller from the world.

`bikeStunts.ts` has no dedicated test file today and its logic is
unchanged by this plan (only what gates it — real wheel contact instead of
the kinematic mover's grounded flag — changes), so no new test is needed
for it specifically.

In the running app, verified by hand: mount a bike, ride off-road and
on-road and confirm a felt difference; climb a slope; drift with the
handbrake; hop and land a trick; ride a bike into water and confirm it's
lost the same way a car is; ride through the game's existing stunt parks
and confirm ramps still launch the bike believably.

Before handoff: `npm run typecheck`, `npm test`, `npm run build`.

## Out of scope

- Fuel, speed HUD, nitro VFX, control toggles/Settings (sub-projects 3-5)
- Multiplayer bike sync
- Real 2-wheel balance/lean physics
- New bike models or visual assets
