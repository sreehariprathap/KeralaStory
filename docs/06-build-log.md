# Build log — observed implementation status

## 15 September 2026 — multiplayer Luna-isolated slice

- Implemented the unblocked plan tasks L03 and L04 without touching server contracts, app composition, physics, or world integration. L03 now parses direct or shared-link room codes and provides session-only, room-scoped token storage with recoverable storage warnings. L04 now buffers ordered snapshots with bounded capacity, interpolates render-time samples, handles short newest-sample gaps, and provides shortest-arc heading/vector interpolation.
- Added focused regressions under `tests/multiplayer/` for direct/link lobby parsing, malformed input, storage failures, token scoping, snapshot ordering/eviction/extrapolation, vector interpolation, and heading wraparound.
- The user-provided Luna labels do not match the current multiplayer plan: room/chat UI, seat HUD, guest labels, room-code dialog, and invite-copy controls map to later dependency-gated work rather than current L03/L04. They remain unimplemented until the documented Astra foundations (A09–A14 as applicable) exist.
- Checks: focused multiplayer tests PASS (9 tests); `npm run typecheck` PASS; `npm test` PASS (88 files, 490 tests); `npm run build` PASS; `git diff --check` PASS. Existing Three.js CommonJS deprecation and large `WorldCanvas` chunk warnings remain.

## 15 September 2026 — multiplayer M0/A01 compatibility workspace

- Added npm workspaces for the protocol, server-safe simulation, and Colyseus server boundaries. Pinned Colyseus core `0.18.14`, SDK `0.18.2`, schema `5.0.32`, WebSocket transport `0.18.2`, and server Rapier `0.19.2`.
- Server Rapier intentionally matches the existing `@react-three/rapier@2.2.0` dependency. The initial `0.20.0` candidate created incompatible duplicate private Rapier types, so it was rejected. `@types/three` retains an unrelated type-only nested Rapier package; runtime/server simulation resolves `0.19.2`.
- The Node-only compatibility test constructs and steps Rapier, then starts an ephemeral localhost Colyseus room and confirms the SDK client receives a real schema state patch. It requires local-port permission in this sandbox; no external network service is used.
- Checks: focused compatibility test PASS (2 tests); `npm run typecheck` PASS; `npm test` PASS (33 files, 182 tests); `npm run build` PASS. Existing Three.js CommonJS deprecation and large `WorldCanvas` chunk warnings remain.

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

## 15 September 2026 — complete avatar limb coverage and supplied Kodassery trees

- Corrected the previous incomplete static/generic animation handling. Added separate weighted limb rigs for Achu, Kichu, Tommy and Kuttu; mapped Appu's existing eight VRoid limb joints explicitly. Every selectable imported avatar now uses skeletal locomotion for walk/run/airborne/cycle states. Original GLBs and textures are preserved. These are fitted procedural rigs, not authored animation clips or terrain foot-placement completion.
- Added instanced supplied tree variants at a deterministic subset of existing Kodassery forest locations, normalized upright/base-centered, with procedural low-quality fallbacks and retained trunk collision proxies.
- Visually inspected the live Chrome avatar preview, all nine production avatar components in a temporary motion-review scene, three production tree imports and the Kodassery entry scene. Temporary review files removed. See [review and next visual passes](validation/2026-09-15-avatar-and-forest-review.md).
- Checks: `npm run typecheck` PASS; `npm test` PASS (**166 tests, 29 files**); `npm run build` PASS; `git diff --check` PASS. Existing large scene-chunk and Three.js CommonJS deprecation warnings remain. Mobile, full-route performance and artist-quality skinning review remain outside these checks.

## 15 September 2026 — terrain-following foundations and accessible approaches

- Replaced flat, terrain-cutting building bases with foundations derived from the rendered south-terrain triangles. The temple, lighthouse, shops, houses and short retaining walls now use level capped plinths that remain buried into the terrain below.
- Kept the dressed visible stair treads, but placed one continuous, terrain-joined collision face beneath each south-facing approach. This prevents the capsule from catching on the first terrain-to-tread seam while retaining the masonry silhouette. The temple west approach now joins the foundation edge directly, preserving the open gate.
- Added foundation interpolation/clipping and live Rapier access coverage. The tea shop, bazaar shop, lighthouse and temple west gate are each traversed from terrain onto their raised decks in the physics suite.
- Visual review: reloaded the local quality-review scene and inspected the saved temple, house and waterfall review artifacts. The retaining plinth and broad temple approach are visually present; this is a scene-art review, not a full player-controlled route playtest.
- Checks: `npm run typecheck` PASS; focused foundation/waterfall/movement tests PASS (**24 tests, 5 files**); `npm test` PASS (**181 tests, 32 files**); `npm run build` PASS; `git diff --check` PASS. The production build still reports the pre-existing 3.29 MB minified WorldCanvas chunk warning and Three.js CommonJS deprecation warning. Full-device performance and the complete route remain unmeasured.

## 15 September 2026 — mountain, Chokkana and Athirappilly planning

- Completed MX-P1–MX-P3: inspected the current world/design/code, obtained a GPT-5.6 Luna read-only risk review, and wrote [the expansion implementation plan](superpowers/plans/2026-09-15-mountain-chokkana-athirappilly.md). Updated backlog and model-handoff pointers.
- Planned experience: walkable Kodassery summit with a real whole-map panorama; Chokkana flat/uphill/downhill forest road and return loop; separate Athirappilly waterfall reached after a substantial forest journey; nine new landmarks with Kerala circa 2000 styling. Original four regions and Silverthread Falls remain preserved in the design.
- Eight Astra core tasks and four bounded Luna tasks have explicit dependencies, writable files, interfaces and acceptance gates. Runtime implementation is **not started: 0/12 complete**. Planning review completion is not map-feature completion.
- Baseline checks: `npm run typecheck` PASS; `npm test` PASS (**412 tests, 70 files**); `npm run build` PASS. Existing Three.js CommonJS deprecation and approximately 3.29 MB minified WorldCanvas chunk warnings remain.
- Actual current app visually inspected in Chrome at `http://127.0.0.1:5000`: title screen, rendered Kodassery canopy/homestead background and four region entries. An initial DOM request timed out; subsequent screenshot inspection succeeded. No gameplay route, new location or performance acceptance is claimed from this planning-only inspection.
- Status rule recorded: mark each implementation task Done only after its own checks and required visual/playtest evidence pass; otherwise retain Planned, Partial or Blocked with the missing condition.


## MX-L3 — panorama helpers (15 September 2026)

Owner: GPT-5.6 Luna, reviewed by Astra. Added `panoramaMath.ts` and six numerical tests. Computes a far plane from target distances and a clamped smoothstep visibility factor; rejects invalid vectors and ranges, including sparse vectors. Focused Vitest: 1 file / 6 tests pass. Helper milestone Done; runtime fog/camera integration remains MX-A6. No visual or performance claim.


## MX-A1 — authored spatial contracts (15 September 2026)

Owner GPT-6 Astra; bounded read-only review GPT-5.6 Luna. Added typed area, route, anchor and water contracts, deterministic layout, boundary-inclusive polygon and route sampling helpers. Canonical definition exports inactive EXPANSION_LAYOUT and X/Z-aware area queries; active ground bounds, original landmarks and save version preserved.

Measured: summit 551.480 m planar / 562.343 m surface, +110 m, max grade 19.95%; main forest road 1131.411 / 1132.434 m, first 170 m flat, max grade 8%; access spur 44 m / +2 m, max 6.82%; return loop 284.301 / 284.391 m; falls trail 153.738 / 156.344 m, -26 m, max25.37%. Drivable bend radii >=14 m. Summit moved to (-130,-690); main road extends west of the original corridor as far south as -280 for travel separation.

Seven layout tests pass, including connectivity, grades, lengths, unique anchors, separate water and finite layout values; typecheck passes. This completes authored blockout only. Rendered terrain, actual contacts, final grounded anchors, manual travel and panorama remain subsequent gates.

## 15 September 2026 — Kodassery Diaries v2.0, first implementation stage

- User authorized staged implementation and Luna handoffs, keeping visual/feel verification with the user. Kodaly keeps its harbor and lighthouse.
- Astra added `worldV2.ts`, `v2Layout.ts` and the separate canonical `V2_LAYOUT` export: four town tiers, connected directed water from Malakkappara through Athirappilly to a two-way fork, proposed road profiles and an east-of-summit Silver Storm/pool footprint. This is a review blueprint; live terrain/bounds, collision and save version were not changed by this stage.
- Luna implemented `/v2-layout.html` and its SVG/CSS, seven focused layout tests, and the supplied-asset intake document. Core reviewed and corrected north-up map orientation, labels, type issues and the factory-immutability test. All source GLBs remain untouched.
- Reconciled previous expansion progress against actual working-tree files: terrain, mountain, forest, waterfall and summit visibility source exists beyond the old log's A1/L3 status. Runtime route/visual gates remain unaccepted. Expansion landmark records are still absent from canonical discovery assembly; carried into V2-08.
- Checks: full typecheck PASS via build; `npm test` PASS (452 tests, 78 files); `npm run build` PASS. Existing large WorldCanvas chunk and Three.js CJS warnings remain. Review HTML/module return HTTP 200. Repository diff check flags pre-existing whitespace at `KodasseryWorld.tsx:180`, left untouched.
- **V2-01 Review / G1 pending:** user reviews the layout at `http://127.0.0.1:5000/v2-layout.html`. **V2-03 Partial:** metadata inventory done; geometry extraction, calibrated dimensions and G2 visuals pending. Actual running visuals and driving remain user verification; no screenshot acceptance is claimed.
- Details and next stage: [v2 evidence/review record](validation/2026-09-15-kodassery-diaries-v2.md). V2-02 terrain implementation follows accepted G1 placement; existing user work remains preserved on `feature/map-expansion`.

## 15 September 2026 — development fast travel for expansion review

- Added grouped inspection destinations: twelve existing landmarks, nine grounded mountain/forest/falls stops, and four v2 planned sites. Luna implemented `src/dev/inspectionDestinations.ts`; Astra wired the App dropdown through the existing reset lifecycle.
- Malakkappara and Silver Storm are enabled as planned-site visits on current terrain; buildings/park are not yet implemented. Chalakkudy/Kodakara remain visibly disabled until their terrain exists. No teleport uses a proposed unsupported elevation. Existing Kodaly harbor/lighthouse navigation is retained.
- Checks: catalog assertions PASS (25 unique records and expected availability/grounding); typecheck and build PASS; full tests PASS (452 tests, 78 files); App diff whitespace check PASS. Existing scene bundle/CJS warnings remain. User verifies actual arrivals at `http://127.0.0.1:5000/?inspect`; no browser/visual pass claimed.

## 15 September 2026 — user acceptance of layout/site review

- User replied “this looks right” after the development inspection update. Recorded G1 layout/site review approval; no screenshot supplied and no acceptance of unimplemented terrain, town assets, park or cars inferred.
- Next implementation stage is V2-02: shared river/road terrain and physical traversal. Final grounded anchors remain outstanding. Existing 452-test/typecheck/build evidence belongs to the preceding code handoff; this acceptance update changes documentation only.

## 15 September 2026 — V2-02 live terrain and river blockout

- Astra integrated shared terrain/collision, riverbed cuts, downhill river surfaces/queries, four graded access roads and ground-derived parking. Bounds now cover the new sites; save geometry version is `kodassery-diaries-v2-terrain-1`. Existing Kodaly harbor/lighthouse retained. Roads avoid new river crossings; existing bridge retained.
- Luna handled atlas geometry/site labels, review-page status copy and bounded river/terrain tests; Astra reviewed/integrated and added actual bidirectional walking and dynamic uphill/downhill car checks. Resolved a shared terrain seam and road/foot-trail permission overlap.
- Chalakkudy and Kodakara inspection visits are now enabled alongside Malakkappara and Silver Storm. Sites have terrain/signs, not finished buildings or attractions.
- Fresh verification: `npm test` PASS (464 tests, 81 files); `npm run build` PASS including workspace typechecks. Focused physical/terrain suite PASS (11 tests). Local HTTP 200. Existing CJS/large-bundle warnings remain. No commit made; unrelated dirty work and assets preserved.
- User review requested for actual river/falls joins, site arrivals and driving feel at `http://127.0.0.1:5000/?inspect`. No rendered visual/performance acceptance claimed. Stop at this terrain gate before dressing; asset calibration and later v2 milestones remain open. See the latest section of the [validation record](validation/2026-09-15-kodassery-diaries-v2.md).

## 15 September 2026 — approved terrain committed; asset review yard

- User approved the terrain blockout and requested commit/proceed. Created `cb09c95` (51 world-expansion/plan/test files), leaving unrelated asset changes out. Subsequent user asset commit `ad0ec4c` is preserved.
- Added development-only `/v2-assets.html`: selected-model loading, explicit extraction, uniform target-axis sizing, measured bounds, metre grid/reference figure, keyboard view buttons and resource cleanup. Source GLBs unchanged; no production placement or new car-spawn registrations.
- Luna audited exact source selectors and added nine preparation tests; core built/integrated normalization, profiles, yard and legacy material compatibility. Coffee presentation plane removed while structural floor remains. Fuel kit reduced to 17,499 triangles; park export helpers/deep skirts removed. Park curation, Bronco paint/wheel separation and rigged car pose/axes remain outstanding. All manifest entries stay prototypes with unknown licensing.
- Fresh final checks: full tests PASS (473 / 82 files), production build PASS including workspace typecheck, diff whitespace PASS. Yard HTML HTTP 200. Existing CJS/bundle warnings remain. Separate script/CSS transform harness produced both modules but exited 13 during shutdown, so no clean harness pass claimed. Browser/visual review delegated to user, as requested.
- Read-only Luna review found no current-profile lifecycle defect; noted future global/sticky regex selectors would require state-reset handling. Current explicit selectors use neither flag. This optional API-hardening observation is deferred until such selectors are introduced.
- G2 partial asset review requested via the yard. New asset-preparation work remains uncommitted pending review; approved terrain is committed. No claim of completed v2.0, finished park, moving tires, collision profiles or visual acceptance.

## 15 September 2026 — Chalakkudy first street, provisional placement review

- User said “proceed.” Continued with a reviewable first street, without recording asset palette/size acceptance. Added supplied coffee shop, tea shop, provision store, bakery and two houses relative to canonical Chalakkudy center. Other towns, riverfront dressing, Silver Storm, fuel placement and new cars remain later work.
- Luna authored bounded placement data and four focused tests. Astra moved frontage off sloped road shoulders onto the flat town terrace, built shared foundations/floor/ramp collision and deck queries, a merged procedural street kit, GLB adapter/local fallback and direct “Chalakkudy — coffee street” inspection stop. Core read-only Astra review found no blocking integration issue.
- All six foundations have zero terrain relief and clear roads/water. Actual Rapier ray/capsule tests verify the coffee ramp and return walk. Conservative coffee shell/floor proxies are checked against extracted geometry; interior remains closed, forecourt open. Cached source materials/geometry/textures remain owned by the loader. World version advanced to `kodassery-diaries-v2-street-1`.
- Fresh final checks: `npm test` PASS **477 tests / 83 files**; `npm run build` PASS including all workspace typechecks; `git diff --check` PASS. Focused street tests 4/4 PASS. Running game HTTP 200. Existing scene bundle/CJS warnings remain. No actual visual/performance acceptance claimed; no automated browser screenshot pass, as requested.
- User review at `http://127.0.0.1:5000/?inspect` → **Chalakkudy — coffee street**: size/orientation of coffee model, street proportions/palette, porch arrival and walkability. This is a first street, not a complete Tier A city. No new commit this turn; preceding asset-yard work is preserved alongside the street changes.

## 15 September 2026 — Chalakkudy location-board post correction

- Corrected the shared location-board call in the first Chalakkudy street so every board starts at its building's actual deck height. The non-coffee boards previously supplied a raised position, leaving their posts floating above the foundation.
- This is a visual-grounding correction only: no terrain, collision, landmark, asset-calibration, vehicle or save behavior changed. G2 asset approval and the Chalakkudy coffee-street review remain pending user input.
- Checks: `npm run typecheck` PASS; `npm test` PASS (**477 tests / 83 files**); `npm run build` PASS. The existing Three.js CommonJS deprecation and 3.30 MB `WorldCanvas` chunk warnings remain. The local app opened, but this automated browser could not initialize the 3D scene because WebGL/hardware acceleration is unavailable; no rendered acceptance is claimed.

## 15 September 2026 — screenshot-driven expansion sign and route-surface corrections

- A user-supplied Athirappilly screenshot showed an expansion-sign post crossing the board face and competing footpath/vehicle-road paint at the upper-view junction. The shared board layout now ends each post at the board's lower edge, so supports cannot cover its painted text.
- Added a shared visual-route rule that trims only a foot trail's leading overlay where it lies on a connected vehicle road. The underlying terrain, physical route connectivity and collision remain unchanged; the foot trail becomes visible once it leaves the road surface.
- Added three focused visual-geometry regressions, including the actual Athirappilly junction. Checks: `npm run typecheck` PASS; `npm test` PASS (**480 tests / 84 files**); `npm run build` PASS. Existing Three.js CommonJS deprecation and 3.31 MB `WorldCanvas` chunk warnings remain. Await user recheck in a hardware-accelerated browser; no post-fix rendered acceptance is claimed.
- Follow-up screenshot showed the road itself dipping into coarse terrain facets near Athirappilly. Measurement found a 6 m mismatch at the rendered ribbon centerline (`Y≈83.45` authored versus `Y≈77.45` terrain sample). The ribbon now preserves authored route elevation at its center and uses terrain only for shoulder cross-slope, preventing the road from appearing crooked or cut into the hill.
- Added a centerline-grade regression. Checks: `npm run typecheck` PASS; `npm test` PASS (**481 tests / 84 files**); `npm run build` PASS. Existing CJS/large-chunk warnings remain; user visual recheck is still required.
