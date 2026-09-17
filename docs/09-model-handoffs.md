# Model assignments and executable handoffs

> **Active v2 handoffs:** use task ownership in [Kodassery Diaries v2.0](superpowers/plans/2026-09-15-kodassery-diaries-v2.md). Astra owns shared layout, terrain, physics and integration. V2-02 terrain is approved and committed. For the first Chalakkudy street, Luna owns only `v2TownPlacements.ts` and bounded `chalakkudyStreet.test.ts`; Astra owns grounded layout, collision, asset adapter and scene integration. The first street is provisional pending user visuals, not full V2-04 completion. [Current evidence](validation/2026-09-15-kodassery-diaries-v2.md).

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development`. Complete the checklist for each task and return evidence before integration.

**Goal:** Execute [08-complete-app-plan.md](08-complete-app-plan.md) through bounded tasks with minimal Astra spend.

**Architecture:** Frozen contracts and world footprints precede Luna work; one owner integrates shared runtime files.

**Tech stack:** Existing pinned React/TypeScript/R3F/Rapier/Vite/Vitest project.

**Spec:** Read [08](08-complete-app-plan.md), [02](02-design-bible.md), [03](03-architecture.md), [07](07-kerala-2000s-direction.md) and the relevant task only. [06](06-build-log.md) is status, not this checklist.

## Dispatch rules

- Task checkboxes track implemented scopes; see `docs/06-build-log.md` for partial/deferred tasks and real-device limits. Dependency completion requires accepted evidence, not a preceding task number.
- Model labels are execution assignments, not a claim these workers have already run. Astra handles only hard systems; Luna receives exact bounded files and inputs.
- The coordinator sends the task block, actual frozen exports/fixtures and the dependency commit or current patch reference. Do not send a full repository dump. If a required interface or asset is absent, return the specific blocker without inventing one.
- Writable files are listed per task; all other files are read-only. Wildcards are limited to the named asset/fixture directory; A01 must name files before parallel dispatch. Tests files shared between tasks run sequentially. No package, lockfile or app-composition changes by Luna.
- L00 follows A01 before L01/L02/L03/L04 dispatch. L03 completes before A02/A03 integration; A03 completes before L07 edits ExplorerMap. A06 and A07/A08/A09 run sequentially. L16 follows A09; L17 follows L16 (phase table groups work, not dependencies).
- R01/R02 are asset-production deliverables. Luna can inventory supplied art; do not ask it to magically manufacture a rig through TypeScript. Asset approval remains an explicit gate.
- Do not add dependencies by default. A core owner may name a concrete browser-test dependency when needed and verify current official documentation then.

## Standard per-task work cycle

1. Read dependencies and exact allowed paths; inspect neighboring implementation.
2. For behavioral changes, write a failing acceptance test from the cases listed in the task and run it. For content/presentation-only work, validate the supplied fixture directly rather than adding mirror tests.
3. Implement only the specified deliverable using frozen contracts and shared tokens.
4. Run the listed commands/checks; inspect the running view for visual changes.
5. Return changed paths, test output, screenshots when visual, and blockers. Coordinator reviews and integrates sequentially, records 06, then marks the checkbox. Never commit unrelated user work.

## Copyable Luna dispatch

```text
Use GPT-5.6 Luna. Execute exactly task Lxx below.
Read the linked spec sections and the attached frozen exports/fixtures.
Writable paths are exactly those in the task; all other files are read-only.
Use the existing tokens and types. No dependency, engine, schema, global
terrain, camera, app composition or unrequested translation changes.
Follow the task's steps and acceptance checks. If inputs are missing,
return their exact names; do not redesign a shared interface.
Return changed files, checks/results, screenshot for visual work and blockers.
```

Replace Lxx with the concrete task ID and attach that task verbatim. Actual exports come from A01's `docs/plans/contract-handoff.md`, placements from A04's `docs/plans/region-footprints.md`; those documents are planned outputs and cannot be assumed present today.

## [x] A00 — Repair movement baseline

**Model:** GPT-6 Astra  
**Dependencies:** None  
**Writable paths:** `src/game/player/controllerMath.ts`, `src/game/player/characterMotor.ts`, `tests/controller.test.ts`, `tests/physics.test.ts`

**Implementation steps:** Read the three failing assertions in 06. Reproduce individually. Separate obsolete one-region expectations from actual motor/ramp behavior; document physical distance tolerances before changing assertions. Repair the responsible layer, keeping existing walk/run/jump tuning unless evidence demands a change.

**Acceptance and handoff:** npm test -- tests/controller.test.ts tests/physics.test.ts; then npm test. Demonstrate ramp-to-bridge traversal, not just a relaxed position threshold.

## [ ] A01 — Freeze shared contracts and migration policy

**Model:** GPT-6 Astra  
**Dependencies:** A00  
**Writable paths:** `src/contracts/index.ts`, `src/contracts/input.ts`, `src/contracts/world.ts`, `src/contracts/assets.ts`, `src/contracts/save.ts`, `tests/contracts.test.ts`, `tests/fixtures/*`, `docs/plans/contract-handoff.md`

**Implementation steps:** Publish the exact interfaces in 08 section 4, preserving current imports. Define Vec3/meters, SourceId, TravelMode foot/bicycle, action snapshots, RegionDefinition, AssetManifest, Placement, named parking/safe spawns and loader/audio UI props. Define SaveV2 with locale and nullable validated parked bicycle data; retain SaveV1 reader. Put old/current/future/corrupt save fixtures, touch command recorder, region footprint fixtures and long-label fixtures at named paths. Publish file ownership and exports so Luna does not design engine APIs.

**Acceptance and handoff:** npm test -- tests/contracts.test.ts. Verify invalid IDs, nonfinite coordinates and bad locale/vehicle values are rejected. Supply actual fixture paths and contract examples in contract-handoff.md.

## [ ] L00 — Contract regression fixtures

**Model:** GPT-5.6 Luna  
**Dependencies:** A01  
**Writable paths:** `tests/contracts.test.ts`, `tests/fixtures/contracts.ts`

**Implementation steps:** Consume the frozen schemas. Add representative valid V1/V2 and malformed records, region neighbor references and duplicate asset/landmark cases using the published fixture shapes. Preserve current profile Unicode and color-palette tests. Do not change a schema to fit a test.

**Acceptance and handoff:** npm test -- tests/contracts.test.ts. Each rejected fixture must fail for its intended field; no snapshots that only mirror implementation.

## [x] L01 — Translation resolver and inventory

**Model:** GPT-5.6 Luna  
**Dependencies:** A01  
**Writable paths:** `src/features/i18n/translate.ts`, `src/content/locales/en.json`, `src/content/locales/ml.json`, `tests/i18n.test.ts`, `docs/10-translations.md`

**Implementation steps:** Use the existing English sheet as canonical keys. Implement translate(key, locale) with trimmed nonempty Malayalam or English fallback. Extract remaining UI strings and descriptions to English keys; append blank Malayalam keys without overwriting user values. Export TranslationKey from keyof English. Do not translate any uncertain words or mutate IDs/coordinates.

**Acceptance and handoff:** npm test -- tests/i18n.test.ts. Assert en returns original; ml blank/whitespace falls back; supplied Malayalam is preserved; key sets match; every existing region/place key resolves.

## [x] L02 — Language selector

**Model:** GPT-5.6 Luna  
**Dependencies:** A01, L01  
**Writable paths:** `src/features/i18n/LanguageToggle.tsx`, `src/features/i18n/language-toggle.css`

**Implementation steps:** Implement the exact value/onChange props from 08. Display English / മലയാളം with a labeled select or two accessible buttons. Use tokens, correct lang attributes and at least 44 px targets. Import no persistence, physics or app state. Provide a component fixture screenshot in both states.

**Acceptance and handoff:** npm run typecheck. Keyboard select both languages; verify callback values en/ml, visible focus, narrow layout and 200% zoom using the integrator fixture.

## [x] L03 — Mobile panel presentation and settings controls

**Model:** GPT-5.6 Luna  
**Dependencies:** A01  
**Writable paths:** `src/features/controls/MobileControls.tsx`, `src/features/controls/mobile-controls.css`, `src/features/settings/SettingsPanel.tsx`, `src/features/settings/settings-panel.css`

**Implementation steps:** Implement MobileControls props from 08 with directional buttons, analog-pad visual slot, sprint lock, jump, brake and mount/dismount. Pointer routing is supplied by A02, not implemented here. Use supplied commands for button intents; no synthetic key events. Render disabled jump during cycling, aria-pressed sprint state, safe-area padding and responsive portrait/landscape positioning. Add supplied Auto/Touch/Desktop and mute/volume settings fields; no engine wiring.

**Acceptance and handoff:** npm run typecheck. In fixture inspect 390x844 portrait and 844x390 landscape, long labels and disabled/mounted states. Buttons never overlap map/pause. Return screenshot and callback trace.

## [x] L04 — Save migration and language preferences

**Model:** GPT-5.6 Luna  
**Dependencies:** A01  
**Writable paths:** `src/persistence/localSaveRepository.ts`, `src/persistence/preferencesRepository.ts`, `tests/persistence.test.ts`, `tests/preferences.test.ts`

**Implementation steps:** Implement A01 V1-to-V2 migration and locale preference storage. Missing locale defaults en; missing bicycle defaults null. Preserve malformed/future originals and last-good backup. Preserve user profile/discoveries. Read pre-profile locale independently and honor latest explicit preference per contract. Catch denied/quota storage without crashing or erasing data. Do not choose spawns or query physics.

**Acceptance and handoff:** npm test -- tests/persistence.test.ts tests/preferences.test.ts. Include V1 migration, V2 roundtrip, future preservation, partial write failure, corrupt primary/backup, no-profile locale and unknown locale.

## [ ] A02 — Unified mobile/desktop input lifecycle

**Model:** GPT-6 Astra  
**Dependencies:** A01  
**Writable paths:** `src/game/input/inputState.ts`, `src/game/input/useExplorerInput.ts`, `src/game/input/touchRouter.ts`, `src/game/player/ExplorerController.tsx`, `src/game/camera/ThirdPersonCamera.tsx`, `tests/input.test.ts`, `tests/touchRouter.test.ts`

**Implementation steps:** Implement source-aware InputCommands without per-frame React state. Track pointer IDs separately for movement/look/action; wire capture/release/cancel and delta look independent of pointer lock. Normalize mixed input deterministically; latest active movement source wins, releasing it clears motion until another input event. Implement deliberate auto-forward sprint toggle and all cancellation cases from 08. Preserve keyboard and camera collision. Publish pointer adapter hook to L03 and integration bindings to A03.

**Acceptance and handoff:** npm test -- tests/input.test.ts tests/touchRouter.test.ts tests/controller.test.ts. Real touch: move/look/jump simultaneously, lift one finger, cancel capture, rotate, blur, menu, resume; no stuck action or camera jump.

## [x] A03 — Integrate locale and mobile UI

**Model:** GPT-6 Astra  
**Dependencies:** L01, L02, L03, L04, A02  
**Writable paths:** `src/app/App.tsx`, `src/app/WorldCanvas.tsx`, `src/app/app.css`, `src/features/map/ExplorerMap.tsx`, `src/features/profile/ProfileForm.tsx`, `src/game/world/KeralaWorld.tsx`, `src/main.tsx`

**Implementation steps:** Connect preference state, toggle at entry/settings, mobile panel and touch adapter. Pass localized names into every listed surface and sign texture; rebuild sign textures only on locale/font readiness and dispose replaced textures. Set document language and remove touch-coming-later copy only once touch works. Use source IDs/translation keys everywhere. Preserve profile name and discovery IDs. This is cross-system wiring; do not redesign panel markup.

**Acceptance and handoff:** npm run typecheck; npm test; npm run build. Inspect desktop and compact portrait/landscape. Change a Malayalam fixture label, switch locale, reload, and verify HUD/atlas/signs agree without resetting the explorer.

## [ ] A04 — Canonical world and safe route topology

**Model:** GPT-6 Astra  
**Dependencies:** A01, A00  
**Writable paths:** `src/content/world/definition.ts`, `src/content/world/kodassery.ts`, `src/game/world/KeralaWorld.tsx`, `src/game/world/KodasseryWorld.tsx`, `src/game/player/controllerMath.ts`, `tests/world-topology.test.ts`, `docs/plans/region-footprints.md`

**Implementation steps:** Move shared geography to the frozen WorldDefinition with compatibility exports. Author all four region briefs: bounds/heights, neighbors, route timing, collision ownership, map anchors, safe spawns, bicycle parking and placement footprints. Preserve compressed envelope and all landmark IDs. Audit bridge seams and harbor pier against water/bounds reset, waterfall stream connection and sole river crossing. Supply reachable spice-garden and second fishing anchors, canopy walking detour and cycle main route; map must share these polygons.

**Acceptance and handoff:** npm test -- tests/world-topology.test.ts tests/controller.test.ts. Actually walk both directions through all regions and onto allowed elevated bridge/jetty surfaces; capture coordinates of any failed edge. Publish exact per-region placement budgets/asset IDs for Luna.

## [x] L05 — Landmarks and parking data validation

**Model:** GPT-5.6 Luna  
**Dependencies:** A04  
**Writable paths:** `src/content/zones/landmarks.ts`, `tests/landmarks.test.ts`

**Implementation steps:** Copy existing landmark IDs to the frozen catalog and add spice-garden at the exact supplied anchor. Keep tea-shop. Use translation keys, supplied region ownership and approved parking references. Do not infer new coordinates, rename saved IDs or alter discovery radius logic. Report missing input anchors rather than selecting positions yourself.

**Acceptance and handoff:** npm test -- tests/landmarks.test.ts. Assert unique IDs, finite positions, resolvable labels/zone IDs and accepted route proximity; all old IDs still exist.

## [ ] A05 — Bicycle motor and mount state machine

**Model:** GPT-6 Astra  
**Dependencies:** A01, A02, A04  
**Writable paths:** `src/game/vehicle/bicycleMotor.ts`, `src/game/vehicle/BicycleController.tsx`, `src/game/vehicle/mountState.ts`, `src/game/player/ExplorerController.tsx`, `tests/bicycleMotor.test.ts`, `tests/mountState.test.ts`

**Implementation steps:** Implement fixed-step kinematic bicycle translation, acceleration/braking/reverse transition and speed-dependent steering from 08. Only one controlled collider active. Mount requires range/ground/clearance; dismount requires low speed and valid side clearance. Handle wall/bridge/water/walking-only boundaries, stuck recovery and safe reset without teleport shortcuts. Do not approximate cycling by multiplying walking speed.

**Acceptance and handoff:** npm test -- tests/bicycleMotor.test.ts tests/mountState.test.ts tests/physics.test.ts. Compare fixed-step results at 30/60/120 render rates; collision sweep at top speed, stops, ramp/bridge and blocked dismount. Record measured stopping distances.

## [x] L06 — Bicycle prompts and pure motion helpers

**Model:** GPT-5.6 Luna  
**Dependencies:** A05  
**Writable paths:** `src/features/controls/BicyclePrompt.tsx`, `src/game/vehicle/wheelMath.ts`, `tests/wheelMath.test.ts`

**Implementation steps:** Render core-supplied available/blocked action text with F or touch labels. No distance checks, mount decisions or persistence in UI. Implement wheelAngle(distanceM, radiusM) = distanceM/radiusM with positive finite radius validation and reverse movement support. Return localizable message keys, not ad hoc English error text.

**Acceptance and handoff:** npm test -- tests/wheelMath.test.ts; npm run typecheck. Test one revolution, reverse and invalid radius; inspect long blocked prompt and touch/desktop forms.

## [ ] A06 — Bicycle integration, camera and safe restore

**Model:** GPT-6 Astra  
**Dependencies:** A05, L04, L06  
**Writable paths:** `src/app/App.tsx`, `src/app/WorldCanvas.tsx`, `src/game/vehicle/BicycleVisual.tsx`, `src/game/vehicle/parking.ts`, `src/game/camera/ThirdPersonCamera.tsx`, `tests/bicycleRestore.test.ts`

**Implementation steps:** Connect ride state to input/camera/HUD, bike placeholder and snapshot stream. Clear sprint/jump on mount. Park/return bicycle only at validated authored slots. Restore on foot with a stopped safe nearby bike after collision readiness. Camera retracts for combined rider/bike envelope and eases with speed without shake. Keep visual prototype explicitly labeled until R01/A07 supplies approved rider/bike.

**Acceptance and handoff:** npm test -- tests/bicycleRestore.test.ts; npm run typecheck; npm run build. Ride the entire route and return; verify at least 25% time saving over running, mount/dismount at all parking points, reload on bridge and while cycling.

## [x] L07 — Map geometry helpers and localized atlas

**Model:** GPT-5.6 Luna  
**Dependencies:** A04, L01, L05  
**Writable paths:** `src/features/map/projection.ts`, `src/features/map/ExplorerMap.tsx`, `src/features/map/mapGeometry.ts`, `tests/projection.test.ts`, `tests/mapGeometry.test.ts`

**Implementation steps:** Consume WorldDefinition for region centers, coast, river, bridge and paths; remove hardcoded copied world coordinates from atlas. Implement inverse viewport projection including pan/zoom/letterbox, map click/touch waypoint and keyboard landmark equivalent. Centralize bearing = atan2(dx,-dz) normalized north-up and straight-line distance. Label cycling/walking-only route portions with text/shape. Use translate for names; no geography edits.

**Acceptance and handoff:** npm test -- tests/projection.test.ts tests/mapGeometry.test.ts. Test corners, center, roundtrip, letterboxing, heading, zoom/pan waypoint picks and route IDs. Screenshot full/compact maps in both locales.

## [ ] R01 — Approved traveler and bicycle assets

**Model:** Art production + Luna manifest entry  
**Dependencies:** A01  
**Writable paths:** `public/assets/characters/*`, `public/assets/vehicles/*`, `docs/assets/character-bike-intake.md`

**Implementation steps:** Deliver actual original/licensed GLBs with meters/Y-up/+Z, feet pivot, shared skeleton, three preset appearances, idle/walk/run/jump/fall/land clips without root drift and cycle seated/pedal poses. Roadster bicycle needs separate wheel transforms and documented wheel radius. Meet 02 budgets and provide source/license, dimensions, clip list and standard-light views. Luna only records supplied metadata; absent art tools/files remain an open production dependency.

**Acceptance and handoff:** Inspect imported GLBs and all clips with scale marker; record measured triangle/material cost and provenance. A pretty image or primitive preview does not pass.

## [ ] R02 — Approved regional environment and sound kit

**Model:** Art production + Luna manifest entry  
**Dependencies:** A01  
**Writable paths:** `public/assets/environment/*`, `public/assets/audio/*`, `docs/assets/environment-intake.md`

**Implementation steps:** Produce/licence the 02 sample kit first, then required regional modules from 08: canopy, paddy/spices, homes/temple/tank, river/fishing, six harbor facades/jetty/lighthouse. Supply simple collision proxies, LODs, texture budgets and shared material palette. Provide reusable regional loops/footsteps/cycle sounds with licenses. No asset purchase is assumed; document unavailable production inputs explicitly.

**Acceptance and handoff:** Standard-light reference views beside approved traveler; actual files/licenses and per-asset costs; verify six facade variants and distinctive regional cues.

## [ ] L08 — Asset catalog audit

**Model:** GPT-5.6 Luna  
**Dependencies:** R01, R02  
**Writable paths:** `src/content/assets/manifest.ts`, `tests/assets.test.ts`, `docs/assets/audit.md`

**Implementation steps:** Enter supplied manifest fields using A01 schema. Validate referenced files exist, IDs resolve, required clips/collision/LOD/source/license fields are present and budgets are exceeded only with recorded art decision. Report absent files honestly; do not fabricate licenses, dimensions or animation clips to satisfy schema.

**Acceptance and handoff:** npm test -- tests/assets.test.ts. Publish missing-asset list and cost outliers; no automatic substitution.

## [ ] A07 — Rigged character and bicycle visual integration

**Model:** GPT-6 Astra  
**Dependencies:** R01, L08, A06  
**Writable paths:** `src/game/player/ExplorerAvatar.tsx`, `src/game/player/AvatarVisual.tsx`, `src/game/player/animationAdapter.ts`, `src/game/vehicle/BicycleVisual.tsx`, `src/app/WorldCanvas.tsx`

**Implementation steps:** Load approved GLBs with shared resources and blend clips from actual motor state. Align feet/seat/hands/pedals, drive wheel animation from measured distance, avoid root drift and dispose unique resources safely. Profile preview and world show the same preset. Add animation-state checks for jump/fall/land and ride transitions; no duplicate physics.

**Acceptance and handoff:** Inspect every preset and clip in preview and live walking/riding. Check measured model cost, foot sliding and seat alignment. npm run typecheck; npm test; npm run build.

## [ ] L09 — Kodassery placement data

**Model:** GPT-5.6 Luna  
**Dependencies:** A04, R02, L08  
**Writable paths:** `src/content/zones/kodassery.ts`, `tests/kodasseryPlacement.test.ts`

**Implementation steps:** Two canopy homes, canopy bridge surroundings, waterfall/overlook vegetation and ground-trail dressing; no obstruction of walking platforms or bicycle descent. Consume the exact footprint, asset IDs, instance budget and deterministic seed in region-footprints.md. Export placements with A01 schema. Do not author geometry, colliders, light, coordinates outside footprints or shaders. All positions are world data and all signs use locale keys.

**Acceptance and handoff:** npm test -- tests/kodasseryPlacement.test.ts. Validate deterministic instances, bounds, allowed asset IDs and route exclusion zones. Return a renderer-fixture screenshot, counts and unresolved visual issues.

## [ ] L10 — Kadambode placement data

**Model:** GPT-5.6 Luna  
**Dependencies:** A04, R02, L08  
**Writable paths:** `src/content/zones/kadambode.ts`, `tests/kadambodePlacement.test.ts`

**Implementation steps:** Four house exteriors, paddy/banana/pepper/cardamom placements, spice garden, tea-shop frontage and temple/tank surroundings; preserve all supplied bund and courtyard clearances. Consume the exact footprint, asset IDs, instance budget and deterministic seed in region-footprints.md. Export placements with A01 schema. Do not author geometry, colliders, light, coordinates outside footprints or shaders. All positions are world data and all signs use locale keys.

**Acceptance and handoff:** npm test -- tests/kadambodePlacement.test.ts. Validate deterministic instances, bounds, allowed asset IDs and route exclusion zones. Return a renderer-fixture screenshot, counts and unresolved visual issues.

## [ ] L11 — Kurumali placement data

**Model:** GPT-5.6 Luna  
**Dependencies:** A04, R02, L08  
**Writable paths:** `src/content/zones/kurumali.ts`, `tests/kurumaliPlacement.test.ts`

**Implementation steps:** Two fishing banks, approved ambient figures, boats and nets; preserve bridge approaches and the sole main crossing; no NPC logic or boat controls. Consume the exact footprint, asset IDs, instance budget and deterministic seed in region-footprints.md. Export placements with A01 schema. Do not author geometry, colliders, light, coordinates outside footprints or shaders. All positions are world data and all signs use locale keys.

**Acceptance and handoff:** npm test -- tests/kurumaliPlacement.test.ts. Validate deterministic instances, bounds, allowed asset IDs and route exclusion zones. Return a renderer-fixture screenshot, counts and unresolved visual issues.

## [ ] L12 — Kodaly placement data

**Model:** GPT-5.6 Luna  
**Dependencies:** A04, R02, L08  
**Writable paths:** `src/content/zones/kodaly.ts`, `tests/kodalyPlacement.test.ts`

**Implementation steps:** Six supplied facade variants, market frontage, quay equipment, jetty and lighthouse surroundings; preserve street loop, parking and pedestrian access. Consume the exact footprint, asset IDs, instance budget and deterministic seed in region-footprints.md. Export placements with A01 schema. Do not author geometry, colliders, light, coordinates outside footprints or shaders. All positions are world data and all signs use locale keys.

**Acceptance and handoff:** npm test -- tests/kodalyPlacement.test.ts. Validate deterministic instances, bounds, allowed asset IDs and route exclusion zones. Return a renderer-fixture screenshot, counts and unresolved visual issues.

## [ ] A08 — Four-region final assembly and map integration

**Model:** GPT-6 Astra  
**Dependencies:** L05, L07, A07, L09, L10, L11, L12  
**Writable paths:** `src/game/world/KeralaWorld.tsx`, `src/game/world/KodasseryWorld.tsx`, `src/game/world/RegionScene.tsx`, `src/content/world/definition.ts`, `src/app/App.tsx`, `src/features/map/ExplorerMap.tsx`

**Implementation steps:** Assemble approved placements/assets using instancing and shared material/shadow rules. Validate every required identity, both-route connectivity, scene/map parity, discovery triggers and safe spawns. Fix actual seams centrally. Integrate bearing HUD and map callbacks without reintroducing duplicated coordinates. Preserve all walk/cycle access contracts and measure route durations.

**Acceptance and handoff:** Full route walking/riding and every detour; fixed screenshots at four entrances, temple, waterfall, bridge and harbor. npm run typecheck; npm test; npm run build; record draw calls/triangles.

## [x] L13 — Loading and recovery UI

**Model:** GPT-5.6 Luna  
**Dependencies:** A01  
**Writable paths:** `src/ui/LoadingView.tsx`, `src/ui/LoadError.tsx`

**Implementation steps:** Consume published loading status and callbacks only. Known loaded/total displays real progress; unknown counts use activity text. Essential failures provide retry and title exit; optional failures use supplied nonblocking notice. Keyboard focus, status announcement and long localized messages; no fetch/cache/physics code.

**Acceptance and handoff:** npm run typecheck. Inspect loading, unknown-count, failed-essential and optional-warning fixtures; verify every action fires exactly once and title exit is reachable.

## [ ] L14 — Ambient audio data and quality profiles

**Model:** GPT-5.6 Luna  
**Dependencies:** A01, R02  
**Writable paths:** `src/content/audio/regions.ts`, `src/content/render/qualityProfiles.ts`, `tests/audioData.test.ts`

**Implementation steps:** Populate four region-loop records and movement/cycle cues from approved assets. Enter core-specified quality values with low-tier DPR 1 and reduced foliage/shadows; never remove collision or landmarks. Do not initialize audio contexts or choose new renderer algorithms. Missing licensed clips remain explicit intake issues.

**Acceptance and handoff:** npm test -- tests/audioData.test.ts. All IDs resolve; loops/cues have supplied gains; low tier preserves essential navigation set.

## [ ] L15 — HUD, discovery and help polish

**Model:** GPT-5.6 Luna  
**Dependencies:** A01, L01, A06  
**Writable paths:** `src/ui/PlayerBadge.tsx`, `src/ui/LocationLabel.tsx`, `src/ui/ControlHints.tsx`, `src/ui/DiscoveryToast.tsx`, `src/features/controls/help.ts`

**Implementation steps:** Extract presentational components from supplied props and approved existing UI appearance. Include real key bindings, touch look, sprint cancellation, bicycle restore and walking-only detours. No invented health/stamina/quests. Use localized names, reduced motion and once-per-event announcement; do not own discovery radius/state. Leave App composition to A09.

**Acceptance and handoff:** npm run typecheck. Inspect long profile/region names, Malayalam fixtures, bright/dark surfaces, 200% zoom and discovery repeated-event fixture.

## [ ] L16 — Lifecycle and recovery regression coverage

**Model:** GPT-5.6 Luna  
**Dependencies:** A09  
**Writable paths:** `tests/lifecycle.test.ts`, `tests/discoveries.test.ts`, `tests/fixtures/lifecycle.ts`

**Implementation steps:** Consume exposed lifecycle/discovery helpers and contract fixtures. Cover once-only discovery after reload, map/pause/resume clearing, settings without profile, title exit on failed load, invalid spawn fallback and migration preservation. If helpers are not exposed, return an exact A09 dependency; do not restructure App or add a fake engine.

**Acceptance and handoff:** npm test -- tests/lifecycle.test.ts tests/discoveries.test.ts. Assertions verify user-visible state/events and preserved data, not component internals.

## [ ] A09 — Zone loading, audio and app lifecycle finish

**Model:** GPT-6 Astra  
**Dependencies:** A08, L04, L13, L14, L15  
**Writable paths:** `src/game/world/zoneLoader.ts`, `src/game/world/RegionScene.tsx`, `src/game/audio/AudioDirector.ts`, `src/app/App.tsx`, `src/app/WorldCanvas.tsx`, `src/game/render/quality.ts`, `tests/zoneLoader.test.ts`, `tests/audioLifecycle.test.ts`

**Implementation steps:** Implement essentials/current/neighbor detail loading, shared cache ownership, preloading near boundaries and safe collision-ready transitions; distant silhouettes remain. Validate saves only after relevant colliders load. Connect L13 error/retry/title paths and WebGL recovery. Audio begins on user gesture, blends loops, reacts to real footsteps/cycle movement, supports persisted mute/volume and suspends while hidden. Integrate extracted HUD and preference controls; publish testable lifecycle helpers for L16. Repair reduced-motion/quality wiring and input focus across all flows.

**Acceptance and handoff:** npm test -- tests/zoneLoader.test.ts tests/audioLifecycle.test.ts; npm run typecheck; npm run build. Slow/failing loads, repeated region roundtrips, hidden tab audio, denied storage, no WebGL, context loss and title/continue manual trials.

## [ ] L17 — Release evidence and documentation

**Model:** GPT-5.6 Luna  
**Dependencies:** A09, L16  
**Writable paths:** `docs/05-validation.md`, `docs/06-build-log.md`, `docs/validation/*`, `README.md`

**Implementation steps:** Run the 08 acceptance matrix and record actual device/browser, viewport, settings, build, cold/warm cache and results. Gather fixed-view screenshots, route timings, 60-second median/p95 samples, ten-minute mobile thermal trial and repeated-loop memory trend. Report unsupported/unavailable devices as untested. Update controls/translation/user instructions from working behavior. Do not fix engine code or mark failures passing.

**Acceptance and handoff:** npm run typecheck; npm test; npm run build. Publish pass/fail/untested matrix, artifact paths, original errors and reproducible blocker steps.

## [ ] A10 — Resolve release blockers and sign off

**Model:** GPT-6 Astra  
**Dependencies:** L17  
**Writable paths:** `Only explicitly failing implementation/test paths from L17`, `docs/06-build-log.md`

**Implementation steps:** Review measured evidence and fix cross-system blockers at their responsible layer. Dispatch small isolated corrections to Luna with new exact file bounds; do not assign Astra document formatting. Recheck affected routes and final full commands. Completion requires finished art and real desktop/mobile evidence, not just build success. If a device or art dependency remains unavailable, label release blocked with exact remaining work.

**Acceptance and handoff:** npm run typecheck; npm test; npm run build plus affected real device checks. Record release status and remaining limitations; never infer support from emulation alone.

## Concrete starter examples for bounded code tasks

These examples are planned code, not files already implemented. They establish small public APIs so handoffs do not invent different names.

### L01 — resolver and focused fallback checks

```ts
import en from '../../content/locales/en.json';
import ml from '../../content/locales/ml.json';
import type { Locale } from '../../contracts';
export type TranslationKey = keyof typeof en;
export function translate(key: TranslationKey, locale: Locale): string {
  const candidate = locale === 'ml' ? ml[key] : '';
  return candidate.trim() ? candidate : en[key];
}
```

L01 should test fallback with an isolated mocked Malayalam module, so tests continue to work when the user fills the real sheet:

```ts
import { expect, it, vi } from 'vitest';
vi.mock('../src/content/locales/ml.json', () => ({ default: {
  'region.kodassery': '', 'region.kadambode': '   ',
  'region.kurumali': 'USER_SUPPLIED_LABEL',
}}));
import { translate } from '../src/features/i18n/translate';
it('uses English when a Malayalam name is empty', () => {
  expect(translate('region.kodassery', 'ml')).toBe('Kodassery Peaks');
  expect(translate('region.kadambode', 'ml')).toBe('Kadambode');
});
it('preserves supplied text and switches back to English', () => {
  expect(translate('region.kurumali', 'ml')).toBe('USER_SUPPLIED_LABEL');
  expect(translate('region.kurumali', 'en')).toBe('Kurumali Puzha');
});
```

Add a separate real-catalog key-parity test and Unicode fixture; do not replace the user's strings to test fallback. `USER_SUPPLIED_LABEL` is a test sentinel, never application content.

### L06 — pure wheel rotation helper

```ts
export function wheelAngle(distanceM: number, radiusM: number): number {
  if (!Number.isFinite(distanceM) || !Number.isFinite(radiusM) || radiusM <= 0) {
    throw new RangeError('Wheel distance must be finite and radius positive');
  }
  return distanceM / radiusM;
}
```

```ts
import { expect, it } from 'vitest';
import { wheelAngle } from '../src/game/vehicle/wheelMath';
it('rotates once for one wheel circumference and supports reverse', () => {
  expect(wheelAngle(2 * Math.PI * 0.35, 0.35)).toBeCloseTo(2 * Math.PI);
  expect(wheelAngle(-0.7, 0.35)).toBeCloseTo(-2);
});
it('rejects invalid dimensions', () => {
  expect(() => wheelAngle(1, 0)).toThrow(RangeError);
  expect(() => wheelAngle(Infinity, 0.35)).toThrow(RangeError);
});
```

For A01/A04-dependent data/physics tests, use the actual frozen fixtures when those tasks complete. Do not implement speculative schemas merely to run future handoffs today.

## Map expansion handoffs — 15 September 2026

Use [the expansion plan](superpowers/plans/2026-09-15-mountain-chokkana-athirappilly.md), sections 5–6, for MX task order, exact writable paths and acceptance checks. Core terrain, mountain, roads/driving, waterfalls, summit camera, map/save integration and final verification stay with GPT-6 Astra. GPT-5.6 Luna receives MX-L1 landmark/localization data, MX-L2 deterministic forest placements, MX-L3 pure panorama math and MX-L4 independent regression tests only after the listed dependencies are ready.

Luna completed the read-only planning review (MX-P2); no implementation handoff is complete. Only Astra updates canonical contracts/composition and status records. Workers return files, actual check results and remaining issues; Astra marks Done after review and required visual/playtest evidence.

## Bike handoffs — 16 September 2026

## [ ] BK-A1 — Fine-tune bike stunts

**Model:** GPT-6 Astra  
**Dependencies:** Bike spawner and stunt prototype (spawnable Roadster, Electric, Yamaha FZ8 and Cyberpunk bikes; hop, ramp launch, flips/spins and landing checks).  
**Writable paths:** `src/game/vehicle/bikeStunts.ts`, `src/game/vehicle/bikeGrounding.ts`, `src/game/vehicle/bicycleMotor.ts`, `src/content/assets/bikeProfiles.ts`, the `BIKE_*` constants and bike stunt block in `src/game/player/ExplorerController.tsx`, the bike overrides in `src/game/player/characterMotor.ts`, new `tests/bikeStunts.test.ts`

**Current prototype (untuned, never playtested):**
- **Controls:** SPACE hops. Above `BIKE_LAUNCH_SPEED` (5 m/s) the bike is no longer snapped to the ground, so crests and ramps launch it. The launch keeps the last grounded climb rate, capped at `BIKE_MAX_LAUNCH` (11).
- **Airtime:** gravity is `BIKE_AIR_GRAVITY` (−17) instead of −22. The bike keeps its speed and heading in the air.
- **Tricks:** W/S flip at `FLIP_RATE` 5.5 rad/s and A/D spin at `SPIN_RATE` 6.5 rad/s. Keys held at takeoff count only after being released.
- **Landing:** clean if within `FLIP_TOLERANCE` 0.7 rad and `SPIN_TOLERANCE` 0.75 rad of level/forward; otherwise a wipeout that zeroes speed. Callouts need 0.35 s airtime; "Big air" needs 1.1 s.
- **Visuals:** tricks are visual only. They pivot at `BIKE_TRICK_PIVOT` (0.7 m) while the collider stays upright and yaw-only.

**Implementation steps:** Playtest every bike on flat ground, hill crests and downhill runs. Tune hop height, launch strength, airtime, rotation rates and landing tolerances so jumps feel deliberate. Downhill riding must not flicker between grounded and airborne; a fast bike must not skip or lose control on ordinary slopes. If the fast bikes (Yamaha 20 m/s, Cyberpunk 24 m/s plus nitro) launch far more than the others, consider per-bike stunt tuning in `bikeProfiles.ts`. Decide whether a wipeout should also dismount the rider, and whether landings should nudge small leftover spin into the heading instead of snapping. Keep the trick logic pure and cover it with `tests/bikeStunts.test.ts`: arming, flip/spin counting, tolerance edges and labels.

**Acceptance and handoff:** `npm test -- tests/bikeStunts.test.ts tests/bicycleMotor.test.ts`, then `npm test`. Provide a short screen capture or screenshots per bike showing a hop, a ramp launch, a clean trick landing and a wipeout. Also confirm that normal riding (no SPACE, no trick keys) never triggers a flip or wipeout on the existing roads.
