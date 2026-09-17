# Paragliding from Kodassery Summit — execution plan

Status: implemented on `feature/map-expansion` (see docs/06-build-log.md, 16 September 2026 — Paragliding). Launch circle radius became 4 m and the canopy span 4.2 m during review.

## Goal

A marked launch circle sits on Kodassery summit. Walking into it opens a "Paraglide from here?" prompt. **Yes** puts a
glider pack on the explorer's back, opens the canopy (`public/assets/adventure/parachute_-_low_poly.glb`) above them and
launches them off the summit. The player steers, rides rising-air columns (thermals) to climb, and chooses where to land.
Landing removes the glider completely, pack included, and returns to walking. The next flight starts again from the
summit circle. In multiplayer, other players see your canopy.

## Decisions (confirmed by the user, 2026-09-16)

1. **Thermals:** yes. Rising-air columns let players climb and stay up longer.
2. **After landing:** the glider disappears, pack included. Launches happen only from the summit circle.
3. **Multiplayer:** other players see your canopy and pack.

## Facts from the codebase

- Summit: `EXPANSION_LAYOUT.summitPosition` (`src/content/world/expansionLayout.ts:88`), end of `summit-trail`, about
  **110 m above** `kodassery-junction`. Use the grounded copy from `WORLD_DEFINITION` (`src/content/world/definition.ts:69`).
- Travel modes: `TravelMode = 'foot' | 'bicycle' | 'car'` (`src/contracts/index.ts:66`). `ExplorerController` owns movement
  in `useBeforePhysicsStep` and switches modes with `setTravel()`.
- Token pattern for UI → physics commands: `carSpawnToken`, `bikeSpawnToken` and `returnBicycleToken` props, each handled
  by a `useEffect` in the controller. Paragliding uses the same pattern.
- UI feedback goes through throttled `onSnapshot` calls (every 6 ticks), never per-frame React state. The prompt reads
  `canInteract` and `interactionMessage` (`src/app/App.tsx:167`).
- Collision-safe motion: `computeExplorerMovement` (`src/game/player/characterMotor.ts`) accepts `gravity` and `snap`
  overrides.
- `needsSafeReset` (`src/game/player/controllerMath.ts:13`) teleports a player who is off the ground mesh. The glider must
  be allowed past it while airborne.
- Camera target kinds are `'foot' | 'car'` (`src/game/camera/ThirdPersonCamera.tsx:27`).
- GLB: one mesh, no animation, no rig. It is Sketchfab-exported (Z-up) and measures about 9.1 m × 5.2 m × 6.8 m. It holds
  the canopy and lines only, with no pack, so the backpack is a small procedural mesh.

## Flight model (simple, arcade)

| Input | Effect |
|---|---|
| none | cruise 11 m/s forward, sink 1.4 m/s (glide ratio ≈ 8:1 → ~880 m from 110 m) |
| A / D, ← / → | yaw rate up to 0.9 rad/s; canopy and rider bank visually up to 25° |
| W | dive: speed up to 16 m/s, sink 3.5 m/s |
| S | flare: speed down to 7 m/s, sink 0.9 m/s (use it just before landing) |
| inside a thermal | extra lift on top of sink (see below); the player keeps steering to stay inside |

- Speed and sink ease toward their targets, with no instant jumps.
- The launch gives an initial forward push of 9 m/s and a short 1.5 s hold on sink, so the player clears the summit lip.
- Collision uses `computeExplorerMovement` with `snap:false` and `gravity:0`, and vertical velocity is set directly, so
  cliffs and trees still block the player.
- **Landing:** when `grounded` goes true, or feet are < 0.4 m above the ground, the glider packs away and the mode switches
  to foot. A landing faster than 13 m/s shows a "Rough landing" message only, with no damage.
- **Water:** landing on a river (`waterLevelAt`, not on a deck) moves the player to the nearest bank with
  `safeGroundPosition` and shows a "Splash!" message, reusing the bike river-landing idea.
- **Map edge:** when the next position fails `hasGroundAt`, the heading turns back toward the world centre and the player
  sees "Edge of the map".
- **Cancel:** F mid-air is ignored ("Land to pack the glider"). Pause, reset and `resetToken` force foot mode, as other
  vehicles do.
- Tag the constants as tuning values in one place, `src/game/vehicle/gliderMotor.ts`.

## Thermals

- Data lives in `src/content/world/gliderSites.ts` next to the launch data, as `THERMALS: {id, x, z, radiusM, liftMps,
  ceilingY}[]`.
- Place 5 thermals. Derive each from world data (route samples and anchors, such as the `chokkana-ridge` anchor and points
  along `summit-trail`, the Chokkana road and the Athirappilly view trail) and don't hard-code coordinates.
  - The chain should carry a player from the summit to Chokkana, Athirappilly and back toward the town.
  - No thermal sits over the waterfall barrier or a river.
- Each thermal: radius 14 m, up to +3.8 m/s at the centre with a smooth falloff to 0 at the edge, so net climb is about
  +2.4 m/s at the centre.
- Lift fades to 0 over the last 15 m below `ceilingY` (summit y + 70 m), so players can't climb forever.
- Pure function: `thermalLift(x, y, z) → m/s`, in the shared motor file so client and server agree.
- **Visual (`src/game/world/Thermals.tsx`):**
  - Each column shows a faint spiral of drifting dust or leaf particles, drawn with instanced points and additive low
    opacity.
  - Each column also has a pair of kites or birds circling it, a readable Kerala cue.
  - Everything renders only within about 250 m of the player. Under `reducedMotion` the particles are static.
- **Feedback:** while inside a thermal, the HUD altitude chip shows a ▲ climb indicator, and `AudioDirector` can play an
  optional soft wind tone.
- **Tests:**
  - every thermal has ground under it (`hasGroundAt`) and no water;
  - lift is 0 at the edge and above the ceiling;
  - a simulated flight that circles a thermal gains height;
  - every thermal is reachable from the summit or from another thermal within glide range, via a chain check.

## Tasks

### 1. Contracts and data
- `src/contracts/index.ts`: add `'glider'` to `TravelMode`. Add `gliderAvailable?: boolean` (player is inside the launch
  circle) and `altitude?: number` to `PlayerSnapshot`. Add `gliderLaunchToken?: number` to `ExplorerControllerProps`.
- New `src/content/world/gliderSites.ts`: `GLIDER_LAUNCH = { position: grounded summit point pushed ~4 m toward the
  downhill edge, radiusM: 3, headingRad: facing out over the valley }`. Derive the heading from the last `summit-trail`
  segment or the direction to `kodassery-junction`, and don't hard-code it.
- Check whether `isTravelAllowed` / `configureTravelCollider` need a `'glider'` branch. Use the foot capsule for the
  glider.
- Add the `THERMALS` data here as well (see Thermals).

### 2. Pure glider motor (unit-tested)
- New `src/game/vehicle/gliderMotor.ts`: `createGliderState(heading)`,
  `stepGlider(state, {steer, pitch, lift}, dt) → {x, z, vy, bank}` and `thermalLift(x, y, z)`.
  - It has no Rapier, Three or React imports, because the server simulation imports it too. `packages/simulation`
    already imports `src/content/world/*`.
- New `tests/.../gliderMotor.test.ts`: thermal lift and ceiling, cruise sink, dive vs flare ordering, turn rate clamp, launch hold, and an 8:1
  glide ratio within tolerance.
- New pure helper `gliderLanding(feetY, groundY, grounded, speed) → 'fly' | 'land' | 'rough'`, with tests.

### 3. Launch circle in the world
- New `src/game/world/GliderLaunchPad.tsx`: a flat ring decal (torus or ring geometry, emissive saffron from design tokens,
  slow pulse, turned off under `reducedMotion`), a small windsock, and an `ExpansionSign` that reads "Paragliding".
- Mount it and `<Thermals/>` in `KeralaWorld.tsx`, next to the other summit dressing. Don't add a collider, so the pad stays walk-through.

### 4. Controller integration (`ExplorerController.tsx`)
- In the snapshot tick: `gliderAvailable = foot && grounded && distance to GLIDER_LAUNCH < radiusM`.
- New `useEffect` on `gliderLaunchToken`. It re-checks eligibility (foot, grounded, in the circle), sets
  `heading = GLIDER_LAUNCH.headingRad`, runs `glider.current = createGliderState(...)`, lifts the player 1 m, calls
  `setTravel('glider')` and reports "Glide! A/D steer · W dive · S flare".
- `useBeforePhysicsStep`: add a `vehicle.current === 'glider'` branch before the bike and foot code. It runs
  `stepGlider` with `lift = thermalLift(...)`, then `computeExplorerMovement` (gravity 0, snap false, vertical from the motor), then landing and water
  checks, then the edge steer. On landing it calls `setTravel('foot')`, clears the glider state and hides the pack and canopy. Nothing
  stays equipped.
- Bypass `needsSafeReset` while gliding if a valid ground column exists below. If the check is only about y, keep the
  guard for NaN and outside-world cases.
- Update `safePosition` only on foot, as now. A glider that gets stuck (zero movement for 2 s while airborne) is forced
  to land at `safePosition`.
- In the interaction handler, when `vehicle === 'glider'`, F bails out (superseded: the wing is lost and the pilot drops).
- In the snapshot, add `altitude` = feet y − ground y, sampled only at the throttled tick.

### 5. Visuals: pack on the back and canopy above
- New `src/game/vehicle/GliderVisual.tsx`:
  - **Backpack:** a procedural rounded box, about 0.35 × 0.45 × 0.2 m, with 2 shoulder straps. It is parented inside the
    avatar group at the upper spine, about 1.25 m high and −0.18 m back. It shows in glider mode. It could also show as a
    folded pack while `gliderAvailable`, but it shows only while flying and is removed on landing.
  - **Canopy:** loads the GLB through the existing `useLoader(GLTFLoader)` path. It is rotated −90° about X (the model is
    Z-up), scaled to about 8 m span, and placed about 6.5 m above the pack. The mesh origin sits at the lines' base, so
    measure its bounding box and offset it so the line convergence point lands on the pack.
  - A bank group rolls the canopy and rider by `glider.bank`. The canopy lags slightly with a damped roll. Everything
    runs in `useFrame` on refs, with no React state.
  - Opening: the canopy scales 0.2 → 1 over 0.6 s at launch. Under `reducedMotion` it appears at full size.
- Avatar pose: reuse the bicycle "seated" pose if `ExplorerAvatar` supports it, or the idle pose with legs forward. Don't
  run the walk cycle while flying (set `motion.speed` to 0 for the avatar, not for the snapshot).
- Register the GLB in `src/content/assets/manifest.ts` (as was done for collectables in e0a16f6) so it preloads with the
  summit area.

### 5b. Multiplayer: others see your canopy
The multiplayer server decides where every player is (`packages/simulation`), so gliding has to exist on the server too,
not only as a client visual.
- `packages/protocol/src/messages.ts`: add `z.object({ kind: z.literal('glider') }).strict()` to `TravelSchema`, and add a
  `launchGlider` client message with an empty payload.
- `packages/simulation/src/playerSimulation.ts`:
  - New `launchGlider(sim, id)`. It checks that the player is on foot, grounded and inside `GLIDER_LAUNCH.radiusM`, then
    sets `travel = {kind: 'glider'}` and stores glider state on the player.
  - Add a glider branch in `advancePlayers`, which currently skips non-foot players. It uses the shared `stepGlider` and
    `thermalLift`, the same landing and water rules, and the same edge turn-back. It maps intent `moveX` to steer and
    `moveZ` to pitch, and switches back to `foot` on landing.
- `apps/server`: route `launchGlider` to the simulation, with the same per-message rate limiting as `enterVehicle`.
- `MultiplayerLocalController.tsx`:
  - The Yes button sends `launchGlider`.
  - While `travel.kind === 'glider'`, send steer and pitch as in vehicles, and report `travelMode: 'glider'` in the
    snapshot.
  - F does not exit.
- `RemoteExplorer.tsx`: when `travel.kind === 'glider'`, render `<GliderVisual/>` (pack and canopy) on the remote avatar.
  - Bank is derived on the client from the heading change rate between interpolated snapshots, so the protocol needs no
    extra field.
  - The canopy GLB is loaded once and cloned for each remote player.
- Tests:
  - protocol schema accepts or rejects the glider travel kind;
  - simulation: launching outside the circle is rejected;
  - simulation: a glider descends and lands, then returns to foot;
  - simulation: a thermal gives lift;
  - a replayed flight produces the same result every run (use the existing `replay.ts`).
- Caveat (AGENTS.md): the lobby UI is not wired into `App.tsx` yet. This part can be verified only by tests and a local
  server session, and I can't claim it's playable until the lobby is wired.

### 6. Camera
- `ThirdPersonCamera`: add a `'glider'` target kind with a distance of about 9 m, a 12° higher pitch, and a slower follow
  damping, so the canopy stays in frame. The controller's `cameraTarget` returns `'glider'` while flying.

### 7. UI
- `App.tsx`: when `mode === 'playing' && snapshot.gliderAvailable`, show a small dialog-style card ("Paraglide from
  Kodassery Summit?" with **Yes** and **Not now**). Use shared tokens and the existing `ModalShell` or `bicycle-prompt`
  styles.
  - Yes: `setGliderLaunchToken(t => t + 1)`.
  - Not now: dismiss until the player leaves the circle. Track this with a `dismissed` ref that resets when
    `gliderAvailable` turns false.
  - Keyboard: F or Enter means Yes, Esc means Not now. On touch, the interact button means Yes.
- While gliding: a compact HUD chip showing altitude (m) and the controls hint. Update it from the snapshot only.
- Add `glider.*` keys to `src/content/locales/*.json`, following `docs/10-translations.md`.

### 8. Validation
- `npm run typecheck`, `npm test` and `npm run build`.
- Run the app. Add an inspection destination for the launch pad in `src/dev/inspectionDestinations.ts`. Then check each of
  these in the running app:
  1. the prompt appears only inside the circle;
  2. Not now suppresses the prompt until the player re-enters;
  3. the launch clears the lip;
  4. steering, dive and flare feel distinct;
  5. the player can land in Chokkana and near Athirappilly;
  6. circling a thermal climbs, and lift stops near the ceiling;
  7. a river landing moves the player to the bank;
  8. the map edge turns the player back;
  9. the pack is on the back and the lines meet it;
  10. the pack and canopy are gone after landing, and walking works right away;
  11. a pause or reset mid-flight recovers cleanly;
  12. multiplayer, only if a local server can be run: a second client sees the canopy.
- Take screenshots of the launch, the mid-flight view and the landing. Record results in `docs/06-build-log.md` and list
  unchecked items honestly.

## Order and sizing

| # | Task | Size | Depends on |
|---|---|---|---|
| 1 | Contracts and launch data | S | — |
| 2 | Glider motor and tests | S | 1 |
| 3 | Launch pad | S | 1 |
| 4 | Controller integration | M (riskiest) | 1, 2 |
| 5 | Pack and canopy visuals | M | 4 |
| 5b | Multiplayer glider (protocol, simulation, server, remote visual) | M | 2, 5 |
| 5c | Thermals visual | S | 1, 2 |
| 6 | Camera | S | 4 |
| 7 | Prompt and HUD | S | 1, 4 |
| 8 | Validation | S | all |

Tasks 2, 3, 5c and 7 can run in parallel once task 1 lands. Task 5b follows task 5.
