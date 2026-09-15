# Build log — observed implementation status

## 15 September 2026 — School uniform arm-stretch correction

- Inspected the user's `Screenshot 2026-09-15 at 1.31.33 AM.png`: arms formed triangular fans when lowered. The uniform arm mask had been centered at normalized Z=0.10, while actual distal-arm vertices lie around Z=0.043. Thousands of vertices were partially root-weighted and stayed behind as the bones moved.
- Corrected fitted shoulder/elbow/wrist depth and height, regenerated the uniform GLB, and added a regression checking full distal-arm attachment plus triangle-edge stretch in idle and walking poses. Earlier bind-pose/weight-normalization tests were insufficient to catch this deformation. Other generated rigs and originals remain unchanged.
- Verification: typecheck PASS, 117 tests PASS (24 files), production build PASS, diff whitespace check PASS. Existing bundle warning remains. User screenshot inspected; gameplay/updated visual confirmation remains with the user per their testing preference. Reload the page to clear the cached old GLB.

## 15 September 2026 — School uniform movement

- Added `arms_out_in_uniform_rigged.glb` with 13 bones across six skinned meshes and connected the existing `uniform` profile selection to the shared runtime locomotion animation. Original model preserved. Includes the same idle, walk/run, airborne and bicycle poses as the other fitted rigs.
- Added uniform-specific joint fitting, arm depth/height masks to protect rear hair and face, and blended skirt weighting. Generator now transforms tangent vectors and handedness along with geometry to preserve normal-map shading. Texture bytes and material metadata are verified against the source. Existing Kid boy/Little girl generated files remain byte-identical.
- Checks: `npm run typecheck` PASS; `npm test` PASS (116 tests, 24 files); `npm run build` PASS; `git diff --check` PASS. Asset tests verify bind shape, skin weights, limb deformation, stable torso/head, idle recovery, cloned skeleton independence, tangents and source material/image preservation. Large-file tests use a 30-second timeout after the initial 5-second parsing limits were exceeded. Existing large scene-chunk build warning remains.
- User owns gameplay testing; no browser playtest performed. Rigged model is about 45 MiB and remains a prototype rig without cloth simulation or foot IK. See [rig details](assets/character-rigs.md).

## 15 September 2026 — Kid boy and Little girl fitted rigs

- Added separate `kid_boy_rigged.glb` and `the_little_girl_rigged.glb` assets, preserving originals. Both have 13 bones, normalized four-influence skin weights and fitted joint positions. Materials and any embedded texture bytes match the originals. Bind geometry is preserved after normalization (maximum measured vertex error below `1e-7` m).
- Selector uses the derived assets with the existing model IDs. Nick's procedural locomotion adapter now also drives these rigs: relaxed arms, alternating arms/legs, running, airborne and bicycle poses. Kid boy uses a smaller shoulder drop for its initial A pose; Little girl's skirt gets a broad hip/root blend. Animation is runtime-generated; these GLBs do not contain baked clips.
- Rebuild script and limitations: [character rigs](assets/character-rigs.md). These are fitted prototype rigs, without cloth simulation or foot IK, and do not complete the approved art/animation milestones.
- Final checks: `npm run typecheck` PASS; `npm test` PASS (109 tests, 24 files); `npm run build` PASS. Existing large-chunk warning remains. Actual-asset tests verify bind shape, weights, skinned deformation, stable head/torso, idle settling and clone independence. Browser/gameplay checks deliberately left to the user, per their request; visual deformation and movement feel await their playtest.

## 14 September 2026 — complete-app planning audit

This entry records evidence from the current workspace. It does not reconstruct earlier work or claim original backlog tasks complete.

### Delivered in this pass

- Reviewed docs 01–05 and 07 against source, tests and available assets.
- Created [08 complete-app plan](08-complete-app-plan.md), [09 model handoffs](09-model-handoffs.md) and [10 translation instructions](10-translations.md).
- Created English reference and blank Malayalam JSON worksheets under `src/content/locales/`. Runtime locale integration is still planned.
- Assigned hard architecture/input/physics/camera/world/integration tasks to GPT-6 Astra; bounded UI/data/helper/test/reporting tasks to GPT-5.6 Luna. A read-only Luna gap audit informed the plan.
- No runtime feature implementation or bug fix is claimed in this planning pass.

### Existing implementation observed

React/R3F/Rapier exploration prototype; profile/preview/continue; desktop walk/run/jump/camera; procedural four-region world and eleven landmarks; map/minimap/waypoints; local save/recovery and discovery; settings, error shell and context-loss handling. Procedural art remains prototype-only. There are no finished GLB/rig asset packages, bicycle, touch gameplay, language toggle, region streaming or audio system.

`src/content/world/kodassery.ts` declares all four regions available. This audit has not proved full route traversal. Region labels or static topology tests alone do not establish playable completion.

### Checks actually run

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | FAIL: 29 passed, 3 failed, 6 test files |
| `npm run build` | PASS; warning for large scene chunk (~3.20 MB minified / ~1.10 MB gzip) |
| `npm run dev` | New process could not start because port 5000 was already in use; existing app at that URL inspected |
| Chrome entry UI at `http://127.0.0.1:5000/` | Actual screenshot showed procedural canopy entry scene, Continue, settings and four-region strip |
| Full walking/cycling route, mobile controls, performance/device matrix | NOT RUN; cycling/mobile features absent |

Browser accessibility tree also exposed canvas-fallback text although the screenshot displayed the rendered scene. That observation does not establish a rendering failure; no-WebGL/fallback behavior needs targeted validation in A09/L17.

### Baseline failures to resolve in A00

1. `tests/controller.test.ts:39`: invalid-position test expects x=65 to reset; current connected bounds differ from the original slice. Inspect following z=-333 expectation as well. Establish intended boundaries before changing assertions.
2. `tests/physics.test.ts:43`: two-second run expected 11.4 m with 0.0005 m tolerance; observed 11.3799715 m. Determine contact/controller tolerance versus actual movement regression.
3. `tests/physics.test.ts:83`: slope-to-bridge test expected z >13; observed 12.4890251. Reproduce ramp collision and characterize the failure; do not simply weaken the assertion.

Rapier initialization also emitted a deprecated-parameters warning. Type/build success does not override these test failures.

### Completion rule

Append task ID, changed paths, accepted checks, actual screenshots/device data and remaining blockers after implementation. Keep untested, partial, prototype and complete distinct. Original task tables are requirements, not completion reports.

## 14 September 2026 — implementation, first integrated delivery

Work is on `implementation/complete-kerala-explorer`; earlier uncommitted plans and user source were retained. User subsequently deferred finished GLB art until they supply assets. That production work remains open, not replaced by procedural models.

### Delivered behavior

- **Connected maps:** one canonical `definition.ts` feeds world, region metadata, twelve landmarks, atlas, route/parking/safe positions. Existing IDs preserved; spice garden added. Repaired the southern bridge approach, harbor shop clearance, quay return ramp and jetty gate/ramp. Map includes the pier beyond the main terrain envelope.
- **Movement repair:** removed the obsolete 45 m global reset floor; recovery uses local terrain, water and authored elevated decks. Corrected obsolete test expectations using measured Rapier contact tolerance; retained walk/run/jump tuning.
- **Language:** English/Malayalam selector on entry and settings. Regions, places, atlas, discovery text, profile controls and authored boards use catalogs. Empty Malayalam falls back to English; short map names can fall back to the user's translated full place name. No uncertain translations were invented. A temporary Malayalam test label was visually inspected and then removed.
- **Mobile:** left analog movement pad and directional buttons, right look surface, jump, sprint lock, brake and bicycle action. Auto/Touch/Desktop preference works before a profile exists. Separate pointer ownership; cancellation on mode changes, blur, orientation and capture loss. Desktop WASD continues working after action-button focus.
- **Bicycle:** one original procedural roadster preview, seated preview pose, fixed-step acceleration/coasting/braking/reverse and speed-dependent steering. Mount/dismount checks proximity, ground and exact collider clearance; rotation checks intermediate poses; walking-only detours block riding. Named parking supports bicycle return. No stamina, inventory or rentals.
- **Persistence:** V1 reads migrate to V2; old/corrupt originals are archived before replacement, backups and future versions preserved. Locale/control preference has a separate record. Reload starts on foot; explorer/bicycle positions are validated against loaded collision before play begins.
- **Regional identity:** bounded procedural pepper/cardamom/banana details and two fishing-bank figures/nets. These remain prototypes.
- **Sound/recovery:** original synthesized preview ambience and bicycle hum with working mute/volume, user-gesture activation and hidden-tab suspension. Loading/error components provide honest activity and retry/title paths. Production sound recordings and full asset streaming remain open.

### Task-by-task status

“Implemented” below means the listed source/acceptance work is present; the shared real-device release gate still applies. Partial tasks are deliberately not checked off in 09.

| Task | Status | Evidence / remaining work |
|---|---|---|
| A00 | Implemented | Regional reset + real Rapier motor/ramp regression tests |
| A01 | Partial | Locale/input/preferences/V2/bicycle interfaces frozen and tested; production region/asset-loader schemas await actual asset intake |
| L00 | Partial | Expanded schema/locale/vehicle fixtures; production asset reference fixtures pending |
| L01 | Implemented | Resolver, catalog parity, blank/whitespace/full-name fallback tests |
| L02 | Implemented | Selector inspected at entry/settings; native keyboard select and persisted locale |
| L03 | Implemented | Portrait/landscape UI inspected; router/ownership tests; physical multi-touch gate remains |
| L04 | Implemented | V1/V2, backup/future/corrupt/archive/denied-storage and preference tests |
| A02 | Partial | Input integration and pure multi-contact regression pass; real iOS/Android cancellation matrix untested |
| A03 | Implemented | Locale and mobile UI wired; labels/shaping/fallback and top HUD access inspected |
| A04 | Partial | Canonical world and corrected route collision tested both ways; final regional art/clearance review pending |
| L05 | Implemented | Twelve stable world landmarks + parking data; tests validate authored placements and IDs |
| A05 | Partial | Motor, mount/dismount and exact clearance implemented/tested; full human ride-feel and real-device gate pending |
| L06 | Implemented | Signed wheel helper tested; bicycle prompts integrated in HUD |
| A06 | Partial | Ride/camera/restore/parking integration and browser mount/dismount; prolonged human steering/reload matrix pending |
| L07 | Implemented | Shared map geometry, inverse viewport click/touch waypoint, bearing, local names, keyboard list; focused tests and portrait map inspection |
| R01 | Deferred by user | Rigged anime travelers/roadster assets will be supplied later |
| R02 | Deferred by user | Approved regional GLBs/recorded audio will be supplied later |
| L08 | Partial | Honest existing/missing asset inventory; final provenance/LOD/clip validation depends on R01/R02 |
| A07 | Deferred | Procedural seated pose exists; approved rigged GLB integration depends on R01 |
| L09 | Deferred | Existing Kodassery procedural kit retained; approved replacement placement awaits R02 |
| L10 | Partial | Prototype spice planting added/tested; final house/plant placement waits for approved assets |
| L11 | Partial | Two prototype fishing spots added/tested; final figure/net kit pending |
| L12 | Deferred | Existing harbor procedural buildings retained; six approved facade variants pending |
| A08 | Partial | Procedural four-region integration and map parity; full approved-art assembly pending |
| L13 | Implemented | Honest loading + retry/title UI integrated |
| L14 | Partial | Synthesized preview audio and existing quality controls wired; recorded region cues/approved profiles pending |
| L15 | Partial | Localized help/profile/HUD/discovery; extraction into all separately named presentation files not done |
| L16 | Partial | Input/mount/save/clearance/map/audio/route regression coverage; full browser automation/lifecycle matrix remains |
| A09 | Partial | Collision-ready restore, recovery UI, audio lifecycle wired; compressed world keeps collision resident, production neighbor asset streaming not implemented |
| L17 | Partial | Command report and Chrome UI evidence available; physical device/performance matrix remains |
| A10 | Open | Release approval cannot be claimed while asset and real-device gates remain |

### Model use

GPT-6 Astra handled physics/reset, canonical terrain/topology, route collision and exact mount clearance; the primary integrator handled shared input, vehicle lifecycle and composition. GPT-5.6 Luna handled localization, profile/settings/touch presentation, migration/preferences, map helpers, regional detail data, asset inventory, loading UI, focused tests, read-only review and documentation. Workers had disjoint explicit writable paths.

### Checks and limits

See [implementation check report](validation/2026-09-14-implementation-checks.md) for timestamped commands. At its capture: typecheck PASS, **86 tests PASS across 20 files**, build PASS; later focused localization checks also pass. Final command totals are appended below when integration closes.

Chrome inspected: desktop entry/settings; 844×390 touch landscape; 390×844 portrait gameplay/atlas; mounting and dismounting; pad movement; sprint-lock running and pause/resume cancellation; map click waypoint (217 m / 178° in the inspected fixture); Malayalam-script test label in HUD and atlas, blank fallback. Screenshots were inspected through the live browser tool in this conversation; no screenshot file path is claimed.

Rapier route tests use actual rendered terrain arrays and architecture colliders in both directions for walking and bicycle envelopes, including acceleration and route access. Target-directed test headings do not prove human steering feel. Real phones/tablets, browser matrix, thermal soak, cold-network asset streaming and measured release performance remain untested.

### Final integration verification

- Final code checks: `npm run typecheck` PASS; `npm test` PASS (**88 tests, 20 files**); `npm run build` PASS. Build still reports the large scene-chunk warning; this is not a performance acceptance pass.
- Chrome: simulated scene interruption showed the recovery UI without a pause overlay. Reload restored the rendered Kodaly harbor scene; a second interruption successfully returned to the title. This verifies the simulated recovery path, not actual WebGL context loss.
- Temporary Malayalam rendering fixture removed; translation worksheet remains blank. Test viewport reset, English and Auto controls restored, normal `/` URL restored.
- Final assets explicitly deferred by the user. See [free asset sources](assets/free-sources.md) for options. Hardware/browser, streaming, performance and human full-route gates remain open.

## 15 September 2026 — supplied cars and character selection

- Vehicle spawner selects `admin-car.glb` or `classic_muscle_car.glb`. Models retain textures, normalize their ground pivot/scale to the car collision envelope, and face the driving direction. Parked cars retain their own heading. Spawning while mounted is rejected without moving the player.
- Car entry hides the avatar; exit restores it beside the car. Bicycle rider visibility is retained. Existing car physics and controls remain in use.
- Added all six supplied character GLBs to a separate profile model selector, live preview and persisted optional `characterModelId`. Older saves still load. Imported materials keep their authored colors; procedural color choices remain available for the original traveler.
- Shared loader clones skeletons and normalizes feet/height without altering cached source scenes. Local Suspense boundaries isolate model loading from physics. Supplied characters contain no animation clips and retain their authored static poses; car wheel/engine animation is not wired. These assets remain prototype intake, not completion of the approved rig/animation/art gates. Largest character file is approximately 39 MB; asset optimization remains outstanding.
- Chrome visual inspection: all six textured character previews; both car models spawned, entered, moved forward, braked and exited; avatar hidden inside and restored beside both cars. No browser console errors captured. Full-route vehicle handling, mobile and network/performance gates were not repeated.
- Final checks: `npm run typecheck` PASS; `npm test` PASS (96 tests, 22 files); `npm run build` PASS. Existing large scene-chunk warning remains. Added Node type declarations for GLB integrity tests. Existing user edits and deleted `cartoon_car.glb` were preserved.

## 15 September 2026 — supplied default BGM

- Replaced synthesized ambient playback with `public/assets/bgm.mp3`, keeping playback user-gesture gated, looped, pause/mute aware, and cleaned up with the audio context. Bicycle preview sound remains procedural.
- The existing default settings volume is `0.5` (50%). The live settings panel displayed `Volume 50%` during inspection.
- Checks: `npm run typecheck` PASS; `npm test` PASS (89 tests, 20 files); `npm run build` PASS. The existing large scene chunk warning remains. `public/assets/bgm.mp3` served from the dev app with HTTP 200 and `audio/mpeg` content type.

## 15 September 2026 — grounded cars, suspension and exhaust

- Replaced the car's upright character-controller movement with a persistent 1,100 kg dynamic Rapier chassis and four raycast suspension contacts calibrated to each supplied GLB's wheel positions. Gravity, chassis pitch/roll, momentum, impacts, braking and parked suspension are physics-driven; walking and bicycle movement remain separate.
- Animated the actual tyre meshes with wheel rotation, front steering and suspension travel. Added a pooled rear exhaust trail while driving; reduced-motion mode suppresses smoke. Kept the avatar hidden inside the car and excluded the occupied chassis from camera obstruction queries.
- Cars retain their physical pose when exited. Entry requires settled wheel contact and low speed; exit checks ground clearance and the path beside the chassis. Reset/unmount removes the extra physics controller and body; pause retains the car's pose and velocity without advancing simulation.
- Checks: `npm run typecheck` PASS; `npm test` PASS (**145 tests, 26 files**); `npm run build` PASS. Added 24 real-Rapier car tests and four wheel-animation tests, including actual GLB mappings and terrain-mesh contact. Existing large scene-chunk and Three.js CommonJS deprecation warnings remain. Browser/gameplay testing is left to the user as requested; full-route handling, steep-edge behaviour and the final visual feel are not claimed as playtested.
