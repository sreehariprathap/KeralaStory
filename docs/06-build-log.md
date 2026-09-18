# Build log — observed implementation status

## 17 September 2026 — multiplayer rooms reachable from the running app

- Wired the previously-orphaned multiplayer server, protocol, and client (see the two entries below) into the actual running app on `feature/multiplayer-rooms`. Up to ten guests can now create or join a private on-foot room by an eight-character code or invite link, from the title screen's new `Play together` action, and explore the shared Kerala world together. Implementation followed `docs/superpowers/specs/2026-09-17-multiplayer-room-integration-design.md` and `docs/superpowers/plans/2026-09-17-multiplayer-room-integration.md`.
- New: `src/features/multiplayer/roomSessionModel.ts` (pure selectors and player-facing error copy), `src/features/multiplayer/MultiplayerRoomScene.tsx` (in-canvas local controller plus one render-only remote avatar per guest), `src/app/useRoomSession.ts` (lobby/entered/chat-focus state). Modified `WorldCanvas.tsx` (optional `multiplayer` prop, suppresses `Collectables`/`SoccerMatch` in a room), `App.tsx` (title action, lobby modal, HUD room panel, solo-system suppression, and a guard so `persist()` never writes the local save while in a room), `RoomStatus.tsx` (seat/vehicle controls removed — the server still answers `enterVehicle`/`exitVehicle` with `VEHICLE_DENIED` and always reports `vehicles: []`, so no seat UI ships this milestone), `multiplayer.css`, and `package.json` (`dev:all` runs the client and server together).
- **This milestone is explicitly on-foot only.** Shared vehicles, seats, public/named lobbies, and deployment remain out of scope and unimplemented, matching the design doc.
- Manual verification was performed live, not merely described: `npm run dev:all` was started for real and two independent headless-Chrome browser pages were driven end-to-end against the actual running client and server (no mocks). Confirmed working: creating a room and receiving a real server-issued code; `?room=CODE` deep-linking the lobby open with the code pre-filled; joining by that code resolving through the real `GET /rooms/:code` endpoint and `joinById`; the roster updating live in both windows as guests joined (1/10 → 2/10) purely from server state patches; entering the shared world showing the "Shared room" HUD panel with both guests listed; two-way chat delivered end-to-end through the real Colyseus room; car/bike HUD buttons and the wallet HUD correctly absent while in a room; `Leave room` returning to the title screen with `Continue your journey` still available; and, most importantly, the local save's `updatedAt`/`position` provably unchanged (read directly from `localStorage`) across a room session and after leaving it — the persistence guard holds under real conditions, not just in the unit test.
- Also verified live: a hard page reload while connected, followed by rejoining with the same room code, resumed the same guest slot (roster stayed at 1/10 rather than adding a duplicate) via the stored `sessionStorage` reconnect token — the reconnect-grace-period path works.
- **Known issue found during this verification, not introduced by this work:** immediately after that reload-and-rejoin path, the room HUD briefly showed a "The server rejected that request. Try again." banner (`roomErrorMessage('INVALID_MESSAGE')`), even though the guest resumed correctly and nothing else broke. This did not reproduce on a clean, non-reload join in either window. It touches `Admission`/`KeralaRoom`/`roomClient` reconnect internals that no task in this plan modified, so it was recorded rather than fixed here; it would be worth a focused look before this ships beyond local testing.
- **Not verified in this pass:** real touch/mobile input actually driving a guest in a room (the touch layout was confirmed non-overlapping under phone-width emulation and the reconnect flow above was run under that same emulation, but this sandboxed browser has no WebGL, so `MultiplayerLocalController` never mounts here and no physics-driven movement could be exercised — the `Canvas` fallback renders instead). A hardware-accelerated browser is needed to close this out. Also not run: the 10th-guest `ROOM_FULL` boundary, and an actual network-loss simulation (only a full reload was tested, which exercises a related but not identical path).
- Checks: `npm run typecheck` PASS (all 5 sub-projects). `npm test`: 222/225 files, 1377/1385 tests PASS. The 3 failing files are pre-existing and unrelated to this branch's changes — confirmed by isolating the diff (`git stash`) and re-running one of them in isolation, which failed identically on the unmodified tree: `apps/server/tests/roomIntegration.test.ts` (one snapshot-timeout test waiting on ten real Colyseus connections; reproduced identically three separate times during this work, including once against a completely clean stash) and its stale copy under `.worktrees/perf-pwa/`; `.worktrees/ten-player-multiplayer/tests/generatedRigs.test.ts` (6 failures, all `ENOENT` on `public/assets/characters/*.glb` files that don't exist in that stale worktree). `npm run build` PASS. Existing Three.js CommonJS deprecation and large `WorldCanvas` chunk warnings remain.

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

## 16 September 2026 — Astra camera/input, terrain-capable cars, and V2 dressing continuation

- Added heading-follow camera behavior for walking and driving. The camera now eases behind the current travel heading after a short manual-turn grace period; the player body is already synchronized to the active car, so the same POV follows vehicle turns. Removed mouse-drag/pointer-lock look from the input lifecycle; keyboard `Q/E` remains the explicit turn control.
- Simplified touch controls to the requested circular movement pad plus sprint-lock button. Direction arrows, touch look pad, jump, brake and mount/dismount buttons are no longer rendered; keyboard interaction remains available on desktop.
- Tuned the shared Rapier car setup for stable contact over authored inclines: increased suspension travel/rest, stronger spring/force limits, higher slip allowance, bounded drive speed, stopped-vehicle damping and heading-aligned velocity projection. Added real-Rapier hill-start coverage for admin and muscle at 20°, 30° and 35°. This improves terrain climbing; it does not authorize driving over water or outside authored routes.
- Added `V2WorldDressing`: Kodakara and Malakkappara houses/shops/tea stop, Chalakkudy fuel station with the approved profile, Silver Storm fallback/GLB placement with entrance sign, parking forecourt and a separate pool, plus palm accents. These are visible prototype placements grounded from `terrainHeight`; they are not final artist approval for the park/Bronco.
- Created the reusable bounded-work skill `kerala-world-content` at `/Users/sreehariprathap/.agents/skills/kerala-world-content/SKILL.md` for Luna/Claude placement, asset-prep, UI-copy and regression tasks. It explicitly excludes physics, camera, app composition, world contracts and server authority.
- Fixed authoritative replay snapshots to suppress sub-millimetre solver residue after disconnect/reconnect without changing full-precision physics. Added camera heading-follow tests. Fresh checks: `npm run typecheck` PASS; `npm test` PASS (**521 tests / 99 files**, including the mirrored multiplayer worktree); `npm run build` PASS; focused gameplay/layout suite PASS (**119 tests / 14 files**). Existing Three.js deprecation and large WorldCanvas chunk warnings remain.
- Live Chrome inspection at `http://127.0.0.1:5000/` reached the playable HUD and rendered Kodassery world with no app console errors. The desktop legend no longer advertises `DRAG`; hardware/mobile viewport, park/Bronco visual approval and full route feel remain open user gates. V2-04–V2-10 remain partial/open rather than complete.
- Follow-up terrain gate change: car travel now accepts any supported, dry authored ground (not only route ribbons), with neighbor-gradient protection for unsupported gaps/near-vertical edges and explicit water rejection. Added regression probes at Malakkappara/Kodakara off-road ground and the existing river. Focused car/terrain checks remain green (**76 tests / 5 files**).

## 16 September 2026 — Collectables and coin wallet (part 1 of the reward system)

- Added a daily collectable layer under `src/game/collectables/`: 100 coins placed from a date-seeded PRNG over walkable land (dry, not water, slope at most ~25°, outside the waterfall footprint, at least 15 m apart), and 10 fixed hearts worth 10 coins each, positioned from `LANDMARKS` and `V2_LAYOUT` so they follow world data. Placement is pure and reproducible, so a server can later build the same day.
- Coins and hearts reset at local midnight. A running session re-checks the date every 30 s and reshuffles without a reload. The wallet survives the reset; only the day's finds clear.
- Pickup is by touch, with no button: 1.2 m reach on foot, 2.5 m in a vehicle, and a 3 m vertical limit. Coins can be taken on foot or from any vehicle; hearts only on foot. A uniform 20 m grid keeps the per-frame cost to a handful of distance tests, and state updates happen once per pickup, never per frame.
- Rendering is two instanced meshes with 150 m distance culling, a "+N" sprite burst on pickup, and a WebAudio chime that degrades silently where audio is unavailable. A one-time physics probe drops coins that landed inside buildings.
- Save format moved to v3, adding `collect: { coins, dateKey, collectedIds }`. v1 and v2 saves migrate forward with an empty wallet, keeping the existing backup and archive behaviour. Writes are debounced at 500 ms.
- Added the wallet HUD (coin count plus "hearts today"), with `wallet.coins` and `wallet.hearts` in both locale catalogs, and registered the three collectable models in the asset manifest.
- Checks actually run: `npm run typecheck` PASS; `npm run build` PASS; `npm test` PASS (**712 tests / 118 files**) on a clean run. `apps/server/tests/roomIntegration.test.ts` fails intermittently on real Colyseus connections; it is unrelated to this work and predates it. Migration of a real browser save to v3 was observed live at `http://127.0.0.1:5000/`, and the midnight rollover was exercised directly against the save logic.
- NOT yet verified in the running 3D scene: the automated Chrome instance has no WebGL and falls back to the no-3D notice, so coin and heart visuals, in-world pickup, the burst labels, HUD placement, the reachability of all ten heart spots on foot, and the frame cost of 100 coins still need a user check in a real browser.
- Out of scope here and still open: nothing to spend coins on, no reward drops for stunts or activities (money bundles are defined at 25 but never spawned), no mini missions, and no multiplayer ownership of collectables.

## 16 September 2026 — Paragliding from Kodassery Summit

- Added a walk-in launch circle on the summit (`src/content/world/gliderSites.ts`, `src/game/world/GliderSites.tsx`): a 4 m saffron ring, a launch arrow, a windsock and a "Paragliding" board. The launch point and heading are derived from `summitPosition` and the direction to Kodassery junction, not hard-coded.
- Standing in the circle on foot shows "Paraglide from Kodassery Summit?" with **Yes, fly** (F / Enter) and **Not now** (N). "Not now" hides the card until the player leaves the circle.
- New `'glider'` travel mode. The pure motor (`src/game/vehicle/gliderMotor.ts`) is shared by the browser and the server:
  - Cruise 11 m/s with a sink of 1.4 m/s (about 8:1). W dives (16 m/s), S flares (7 m/s), A/D turn at up to 0.9 rad/s.
  - Launch holds altitude for 1.5 s.
  - Rough landings above 13 m/s only show a message.
  - River landings move the player to the nearest dry bank.
  - Near the map edge the glider turns back toward the middle of the world.
  - A glider wedged in scenery for 2 s is brought down.
- Five thermals are placed from world data: summit trail shoulder, Chokkana ridge, Chokkana tea stop, Malakkappara and Kodakara. Each lifts up to 4 m/s with an edge falloff and fades out 70 m above the summit. They are drawn as rising motes with two circling kites and culled beyond 260 m.
- Visuals: a procedural pack on the rider's back, with the canopy GLB (`public/assets/adventure/parachute_-_low_poly.glb`, registered in the manifest) scaled to a 4.2 m span. The model's harness bar rests on top of the pack and the canopy banks into turns. The pack and canopy are removed on landing. The chase camera pulls back to 8 m and lifts so the arch stays in frame.
- HUD: an altitude chip with a "Rising air" state and the control hint. `glider.*` keys were added to both locale catalogs; Malayalam values are left blank per the worksheet.
- Multiplayer:
  - `TravelSchema` gains `{ kind: 'glider' }`. There is a new `launchGlider` client message and a `GLIDER_DENIED` error code.
  - The simulation validates the launch (on foot, grounded, inside the circle) and simulates flight authoritatively with the same motor and thermals. The replay harness also accepts `launchGlider`.
  - The room routes the message.
  - `RemoteExplorer` draws the pack and canopy for gliding guests and infers bank from the heading rate. `MultiplayerLocalController` sends the launch and stick intent.
- Checks actually run: `npm run typecheck` PASS; `npm test` PASS (**744 tests / 122 files**); `vite build` PASS.
  - New tests cover the motor, thermals, the launch site (including clearing the lip) and the thermal reachability chain (`tests/gliderMotor.test.ts`, `tests/gliderSites.test.ts`), plus the protocol and authoritative flight: refused launch, launch → glide → land → walk, climbing in a thermal, and a deterministic replay (`packages/simulation/tests/glider.test.ts`).
  - `apps/server/tests/roomIntegration.test.ts` failed at the pre-change baseline and passed on the final run; it is still intermittent.
- Verified in the running app (headless Chrome with SwiftShader at `http://127.0.0.1:5174/?inspect`):
  - the card appears only inside the circle, and "Not now" re-arms after the player leaves and returns;
  - F launches, the altitude HUD updates, and steering banks the canopy;
  - diving into the hillside lands the player back on foot with the pack removed;
  - thermal motes are visible from the summit.
- NOT verified in the running app:
  - climbing in a thermal (covered by tests only, because scripted piloting at headless frame rates was unreliable);
  - a river landing, the map-edge turn-back, and touch controls;
  - a second client seeing the canopy (the lobby UI is still not wired into `App.tsx`);
  - frame cost on real hardware.
- The black quad beside the summit circle predates this work (it is present with the glider dressing hidden).

## Swimming, river currents, sinking vehicles, and exit at any time (single player)
- Water can be entered now. `needsSafeReset` no longer resets a player who is in water. It still resets a player who falls below the terrain or leaves the map.
  - `src/game/player/swimming.ts` holds the swim rules: buoyancy that settles the feet 1.25 m below the surface, a swim speed of 2.2 m/s (3.4 m/s sprinting), and hysteresis between 1.1 m and 0.9 m of depth so wading stays walking.
  - Space in water is a lunge under normal gravity, used to pull out onto low banks.
  - Swimmers can't cross into the open sea past the ground bounds.
- Currents: `createRiverField().flowAt` and `waterFlowAt` push swimmers downstream along each reach.
  - Speed is about 1.1 m/s on flat reaches, up to 3.2 m/s on steep ones, and 0.35 m/s in pools. The current is weaker near the banks. The sea and ponds have no current.
- `openWaterSurfaceAt` counts a bridge or pier deck only when the player stands on it, so swimmers pass under bridges.
- Vehicles can now enter water (`isVehicleTerrainAllowed`). A ridden or parked bike, or a car, whose wheels are more than 0.5 m under the surface is lost (`vehicle.bikeSank` / `vehicle.carSank`). Spawning a new one, or returning the bike to a parking spot, restores it.
  - A glider that touches water is lost, and the pilot swims. The old behaviour teleported the pilot to the bank.
- F always gets the rider off:
  - at speed;
  - mid-air (a bike is left on the ground below it, or lost if that ground is water);
  - while gliding (bail out; the wing is lost, `glider.bailed`);
  - when the vehicle is stuck. The exit tries each side, then behind and in front, then any open spot without dry footing, then (for a car) the roof, then the nearest dry ground.
  - `interactionReason` no longer returns `brake`.
- Both avatar types have a swim animation: front crawl while moving and treading water at rest.
- The multiplayer server simulation (`packages/simulation`) is unchanged, so guests in a room still cannot swim.
- Checks actually run: `npm run typecheck` PASS; `vitest` PASS (538 tests / 87 files, excluding `.worktrees/`); `vite build` PASS.
  - A full `npm test` also collects the `.worktrees/ten-player-multiplayer` copy, where 2 tests timed out after 30 s. This work does not change that copy.
- Verified in the running app (`?inspect`):
  - jumping off the Kurumali bridge splashes in and floats at the surface;
  - the swimmer drifts downstream and passes under the bridge;
  - stroking adds to the drift, and the crawl pose shows;
  - F at speed on a bike and F mid-hop both work.
- NOT verified in the running app:
  - a bike or car actually sinking. The Kurumali banks near the bridge have a 2 m terrain step, and the bike can't turn on the bridge deck, so I couldn't drive a vehicle into water there.
  - a stuck-car exit, a glider bail-out or water landing, and v2 river currents (these have tests only);
  - touch controls.
- Pre-existing console error seen: `Wildlife.tsx:101` "Cannot set properties of undefined (_cacheIndex)".

## Field atlas redesign and Leo Messi Stadium (single player)
- The atlas (`src/features/map/`) was redrawn:
  - A shaded relief raster (`mapRelief.ts`: elevation tints and north-west hillshade, built once, a slice of rows per frame).
  - Roads, trails, rivers and area outlines drawn as smooth curves (`smoothPath.ts`), with river names written along the channels.
  - Towns drawn as built-up districts with a street grid, real building roofs, and large city names.
  - A marked football pitch.
  - Highlight pins with a pulsing halo (`mapFeatures.ts`) for the paragliding launch, the football ground, stunt parks, river jumps, Silver Storm and Athirappilly Falls.
  - Collision-aware labels at a constant on-screen size (`labelLayout.ts`).
  - A scale bar.
  - Smooth wheel and pinch zoom (1–8×, anchored on the cursor), drag to pan, tap for a waypoint, and "centre on me".
  - A side panel with highlight cards (with distances) and city chips.
  - The minimap reuses the same drawing.
- Leo Messi Stadium, formerly "Kodakara Football Ground" (`src/content/world/stadiumLayout.ts`, `src/game/world/Stadium.tsx`):
  - Site: about 100 m north of Kodakara. `scripts/probe-stadium.ts` picked it as the flattest open ground clear of roads, buildings and stunt parks. The terrain is levelled to 62.6 m under the pad (`v2Ground.ts`).
  - The pitch uses `football_field.glb`, scaled so its markings form a true 40 × 60 m pitch. There are goals with nets and colliders, terraced stands (the west stand has an entrance), a roof, floodlights, and ad boards behind the goals.
  - A join circle beside the halfway line. `isStuntGround` also covers the pad, so palms, forest and animals stay off it.
- Football (`src/game/soccer/`): walking into the circle shows an offer (F / Enter to kick off, N for not now). A ball spawns at the centre spot.
  - Running into the ball dribbles it.
  - Holding K charges a kick (shown in a power bar); releasing kicks, harder and higher with more charge.
  - Goals update a North–South scoreboard and show a "GOAL!" banner, then the ball returns to the centre.
  - A ball that goes out is restarted on the pitch (a goal kick when it crosses a goal line).
  - The match ends with "End match" or by walking well off the ground. Touch players get a Kick button.
  - The explorer controller ignores the ball in collision (`userData.passThrough`), and publishes its pose each physics step (`explorerPose.ts`).
- Checks run:
  - `npm run typecheck` PASS; `vite build` PASS.
  - `vitest`, excluding `.worktrees/`: 563 of 564 passed, including new `tests/soccerRules.test.ts` and `tests/mapDrawing.test.ts`.
  - The one failure was `apps/server/tests/roomIntegration.test.ts` (snapshot timeout). It failed twice with the dev server and Chrome running, then passed on a later run. It also passed on a clean HEAD worktree. It is still intermittent.
- Verified in the running app (`?inspect`, "Leo Messi Stadium — join circle"):
  - the stadium renders, and the offer appears in the circle;
  - F starts a match;
  - dribbling carried the ball into the north goal (1–0);
  - a charged K kick (54 % power) sent the ball out and it was restarted;
  - the atlas shows relief, cities, highlights and labels;
  - wheel zoom works.
- NOT verified in the running app:
  - pinch zoom and the touch Kick button;
  - scoring with a kick, as opposed to a dribble;
  - "End match", and the automatic end when walking away;
  - frame cost on real hardware.
- Known rough edges:
  - The camera can get squeezed inside a goal net.
  - The relief looks soft at high zoom (2.5 m per pixel).
  - Multiplayer has no football.

## 2026-09-16 — Messi character, football animation, flower beds

- Messi is a new selectable character ("Messi", id `messi`). Its rig is `lionel_messi_qatar_2022_rigged.glb`, built by `node scripts/rig-characters.mjs lionel_messi_qatar_2022.glb`.
  - The source is a T-pose. The fitted joints were measured from vertex slices.
  - The script now accepts source names, so only the named rigs are rebuilt.
  - The id was added to both profile schemas (app contracts and protocol).
- Football animation (`src/game/soccer/soccerMotion.ts`). `SoccerMatch` writes kick, touch and goal counters, plus the charge. Only the local avatar's animator reads them.
  - During a match: a ready stance with soft knees and arms a little out.
  - Holding K winds the kicking leg back. Releasing it plays a strike and follow-through, even when the kick misses the ball.
  - A dribble touch plays about every 0.55 s, and running with the ball uses quicker, shorter strides.
  - After a goal, both arms point to the sky for 2.4 s.
  - Messi kicks with his left foot; every other character kicks with the right. All rigged characters get these poses.
- Flower beds (`FlowerBeds.tsx`, `flowerPlacement.ts`) use `flowers.glb`, `flowers (1).glb` and the 16 clumps in `flowers_pack_4.glb`.
  - Beds grow in a 2.2–5.5 m ring on one side of trunks: palms, the Kodassery forest and the Chokkana forest.
  - Meadow clumps grow above 110 m within 175 m of the summit. The 14 m viewpoint terrace stays clear.
  - Beds keep off roads and trails (the palms' route rules, now `isClearOfRoutes`), water, decks, sports ground and the glider launch. A physics ray then rejects anything over buildings.
  - This gives about 4.1k beds, about 600 of them on the peak. Only beds near the camera are drawn.
  - The heavy aster clump (about 95k vertices) is drawn within 40 m on medium and 60 m on high, and never on low.
- Refactors that keep behaviour the same:
  - The Chokkana forest generator moved to `chokkanaForest.ts`.
  - The variant baker moved from `CoconutGroves.tsx` to `render/bakeVariant.ts`.
- Checks run:
  - `npm run typecheck` PASS; `vite build` PASS.
  - `npm test`: 774 of 774 passed, including new `tests/soccerAnimation.test.ts`, `tests/flowerPlacement.test.ts` and the Messi cases in `tests/generatedRigs.test.ts`.
- NOT verified in the running app: the browser automation could not attach to Chrome. Messi's deformation, the football poses and how the flowers look and cost on real hardware all need a playtest.
- The stadium was renamed Leo Messi Stadium. A "MESSI STADIUM" banner (sky blue and white with a sun on each side) hangs on an entrance arch over the west gate (both faces) and along the front of the east stand roof. The seat rows now use sky blue and white. Verified in the running app: the roof banner and the arch banner render, and the offer reads "Play football at Leo Messi Stadium?".
- A goat (`public/assets/living-beings/goat.glb`, CC-BY-4.0 by sambasivarao) wanders at Leo Messi Stadium (`src/game/world/StadiumGoat.tsx`, route in `goatRoute.ts`).
  - It loops round the forecourt outside the west gate, rounds the south end of the west stand and walks its terraces, hopping between tiers and pausing to graze. The model has no animation, so the walk is a procedural bob and waddle.
  - `tests/stadiumGoat.test.ts` checks the route never enters the pitch or run-off. The goat has no collider and ignores the player.
  - The stand's back wall is now a 2.3 m rail, so the terraces (and the goat) can be seen from outside.
  - Verified in the running app, using renders from a camera placed next to the goat: it faces its walking direction and walks the terraces and forecourt.

## 2026-09-16 — Rendering performance, asset pipeline, installable app (branch `feature/perf-pwa`)

- Rendering (`src/game/render/renderBudget.ts`, `WorldCanvas.tsx`):
  - Each quality level now sets a resolution range, antialiasing, shadow map size and shadow refresh rate.
  - Phones get a lower resolution cap: 1.25× on Balanced and 1.5× on Detailed. Quiet renders at 1× with no antialiasing and no shadows.
  - Resolution adjusts itself: it drops after one slow 1.5 s window (p75 above 20 ms) and rises after two fast windows (p75 below 13.3 ms), waiting one window after each change.
  - Balanced redraws the shadow map every other frame, at 1024². Detailed redraws it every frame, at 2048².
  - The render loop stops when the tab is hidden and only renders on demand behind the pause menu and map.
  - Antialiasing is set when the scene loads, so a quality change applies it on the next load.
  - The game pauses when the app goes to the background, and the screen stays awake while playing (Wake Lock API).
- Asset pipeline (`scripts/optimize-assets.mjs`, part of `npm run build`):
  - Every served GLB is rebuilt into `.asset-cache/opt/`, which is gitignored and rebuilt only for changed files. The build then swaps these copies into `dist/`. Dev uses the originals.
  - Geometry is Draco-compressed, which decodes back to floats, so the palms, flowers and static batching still work. Textures are resized to at most 1024 px and saved as WebP.
  - Static models over 150k vertices are simplified with a tight error bound. Skinned models are never simplified. Material names are kept.
  - Safety checks: a simplification that overshoots its target, or bounds that move by more than 1%, make the script rebuild or ship the original.
  - Results: models 422 → 70 MB, `dist` 532 → 107 MB.
  - Every `GLTFLoader` gets a shared `DRACOLoader` (`gltfSetup.ts`), using three's bundled, hashed decoder.
  - Rig source models moved to `asset-sources/characters/` so they no longer ship. `rig-characters.mjs` and the rig tests now read them from there. The Messi rig rebuilds byte-identically.
- Installable app and caching (`vite-plugin-pwa`, custom worker in `src-sw/sw.ts`, helpers in `src/pwa/`):
  - Manifest: full screen (standalone fallback), landscape, and 192, 512 and maskable icons (`npm run generate:icons`).
  - Page shell: `viewport-fit=cover` and Apple web-app meta tags.
  - Hashed bundles now go to `/app/`.
  - Precache: the app shell only (29 entries, about 4.2 MB).
  - World assets are cached when first loaded, keyed by content hash from `dist/asset-hashes.json`. The page sends that file to the worker, which removes stale entries. Range requests work, and an older copy is served when offline.
  - "Download world" in Settings caches everything and requests persistent storage.
  - A prompt offers a reload when a new build is ready.
  - `public/_headers` sets cache rules: immutable for `/app/*`, no-cache for the shell, the worker and `asset-hashes.json`.
- Mobile:
  - A full-screen button on the title screen and HUD (locks landscape on Android). An install button where the browser offers one, or an Add to Home Screen hint on iOS Safari.
  - Vibration on pickups, kicks and goals. It can be turned off in Settings (a new `haptics` preference, default on).
  - Safe-area insets for the HUD and title screen. No pull-to-refresh and no tap highlight.
  - Short landscape screens: the title layout no longer overlaps the region strip (this overlap also existed on the main branch).
  - On merge, the Sprint lock override was dropped: `feature/map-expansion` had redesigned the touch layout (`495271b`). The HUD's safe-area inset now resets the controls' own edge variables, so notches aren't counted twice. The new layout has not been checked on a phone-sized screen yet.
- Checks run:
  - `tsc` for the app and the worker: PASS.
  - `vite build`: PASS.
  - Full `vitest` run: 581 of 583 passed. `tests/expanded-contracts.test.ts` needed the new `haptics` default and now passes. The known intermittent `apps/server/tests/roomIntegration.test.ts` failed once, then passed on re-run.
- Verified in headless Chrome against `vite preview`:
  - The title screen and game render from the optimized models, and Messi looks the same as with the originals.
  - The worker is active and the install prompt fires.
  - Download world cached 92 MB. With the preview server stopped, a reload still loaded and played.
  - The update prompt appeared after a rebuild.
  - In an Android landscape emulation, touch controls and the HUD work and the game renders at 1×.
- NOT yet done:
  - A screenshot of the icon-only install button, and a clean re-run of the update flow. The last attempt stalled because the test had left the tab hidden, not because of an app error.
  - Any real-device testing: iPhone Add to Home Screen, Android full screen and landscape lock, Wake Lock, vibration, and frame rate on a mobile GPU.
  - KTX2 textures (no encoder installed).
  - Region-based scenery loading and far-distance tree versions (Phase 4).

## 2026-09-17 — Chalakkudy Tier A city

- Chalakkudy is now built out as a Tier A city (`src/content/world/chalakkudyCityPlan.ts`, `chalakkudyCity.ts`, `src/game/world/ChalakkudyCity.tsx`):
  - Two four-lane (4 × 3.5 m) roads added to `V2_LAYOUT.roads`: MG Road (east–west, z = −60) and Chalakkudy Boulevard (north–south, x = −430). They level the terrain, draw on the map and are drivable. Road paint includes a double yellow centre line, dashed lane lines, edge lines and zebra crossings at the junction. Street lights line both sides.
  - Chalakkudy Central Mall: three floors, a glass atrium, an entrance canopy and a car park reached by a driveway off MG Road.
  - 15 modern shops along MG Road, each with a glass front and a painted signboard.
  - Chalakkudy Motors, a walk-in car showroom with three cars on display inside and two on the forecourt.
  - A gateway board for arrivals from the north.
  - The 12 placeholder `chalakkudy-frontage-*` blocks were removed. The coffee street, the houses and the fuel station are unchanged.
- All city colliders are shared with the multiplayer simulation. `WORLD_VERSION` is now `kodassery-diaries-v2-chalakkudy-city-1`.
- Checks run:
  - `npm run typecheck`: PASS.
  - `npm run build`: PASS.
  - New `tests/chalakkudyCity.test.ts`: 6/6 pass.
  - Full `npm test`: the same 8 failures as the unchanged baseline, all in `.worktrees/*` copies plus the known load-sensitive `apps/server/tests/roomIntegration.test.ts`. Run on its own, that test passes.
- Inspected in the dev server (Chrome) using the three new `?inspect` destinations: the mall and car park, the MG Road shops and lane paint, and the showroom with its display cars. Frame time was about 8 ms. Draw calls rise near the showroom (about 950) because each display car is a full GLB.
- NOT yet done: mobile GPU profiling of the city, and interiors (the mall and shops are closed shells).

## 2026-09-17 — Chalakkudy across the Kurumalippuzha

- Chalakkudy now covers both banks of the Kurumalippuzha, as marked on the atlas.
  - The town has two more districts. **Riverfront** covers the valley and both bridges; it counts as town area and draws on the map, but the ground is not levelled. **East** is a new district levelled at y = 37.
  - Zones, the map and the town list all include both districts.
- Two cable-stayed four-lane bridges (`CHALAKKUDY_BRIDGES`), each with a deck, walkways, parapets, piers, a pylon pair, stay cables and lamps:
  - MG Road Bridge runs from MG Road to East Avenue.
  - Kurumali North Bridge runs from the Link Road to Riverside Road.
  - Each deck is a separate walkable structure between two road ends, so every road sample stays on dry, carved terrain. Deck heights feed `walkableDeckHeight`, and the colliders are shared with the server.
- New four-lane roads:
  - The Chalakkudy–Kodakara Highway, which replaces the old narrow Chalakkudy–Kodakara stretch. `kodakara-road` now starts in Kodakara.
  - Riverside Road, East Avenue and Link Road.
  - The Chalakkudy–Kodaly Highway: a ghat that loops down the escarpment and joins Kodaly by its north gate, between the Kodaly Stunt Park and the river.
  - Every control segment is ≤10% grade.
- Chalakkudy East also has three glass towers (River View Towers, East Plaza and Chalakkudy Tech Park) and three shops.
- Checks run:
  - `npm run typecheck`: PASS.
  - `npm run build`: PASS.
  - `vitest` outside `.worktrees`: 605/605 PASS.
  - New tests cover: bridge ends meeting roads, decks over water keeping swimmers dry and cars allowed, the conversion of tilted collider rotations, highway endpoints, and every bridge sample lying inside Chalakkudy.
- Inspected in the dev server using the new `?inspect` stops: both bridges (including a car driving on the north deck), Chalakkudy East, the Kodaly ghat, and the world map. Shadow striping on the tilted decks was fixed: the deck surfaces now receive shadows without casting them.
- NOT yet done: mobile GPU profiling, and a drive from the ghat all the way into Kodaly in a car.

## 2026-09-17 — NH 544 loop, seamless roads, scenery off the carriageway

- **NH 544 loop.** The highway now runs Chalakkudy → Kodakara → Kurumali Bridge → Kodaly junction → up the ghat → Chalakkudy East → MG Road Bridge → Chalakkudy. A third cable-stayed bridge (`kurumali-highway-bridge`) crosses the Kurumalippuzha–Kurumali confluence. The Kodakara–village lane now branches from the loop at a fork east of Kodakara and falls with it through the fork, so the two roads meet at one grade. Kodaly Road runs from the junction into town. Green NH 544 direction boards stand at the junctions, and town boards moved off the carriageway.
- **Roads blend into the ground.** Road surfaces are rebuilt as a dense mesh (rows and columns about 1 m apart) that follows the walkable surface, takes the highest ground within ~0.7 m, and fades to a dusty shoulder at its outer edge. Where a road ends on another road, its end flares into rounded kerb corners. No terrain pokes through any road any more (was up to 3.8 m on the forest road, 0.5 m on the Kodaly road).
- **Road surfaces restored after carving.** River banks and town pads used to be carved after the authored roads, which cut steps across them — including a 26 m pit in the Chokkana forest road at Athirappilly. Each road's surface is now restored with the authored blend, while authored clearings and the Athirappilly walking trail keep their own levels so the trail still descends to the lower viewpoint.
- **Bridges keep air beneath them.** The ground under each span is dug out to 3.5 m below the deck, fading in past the abutments. This fixed a 9 m mound that buried the new Kurumali deck mid-span.
- **Nothing grows on a road.** A shared `isClearOfRoads` check now gates coconut palms (5 m clearance, so leaning fronds cannot overhang), village palms and shrubs, Kodassery trees and grass, and the forest colliders that mirror them. Chalakkudy's two street palms were removed: the mall car park and the MG Road shops stand there now.
- Checks run:
  - `npm run typecheck`: PASS. `npm run build`: PASS.
  - `vitest` outside `.worktrees`: 607 of 608 pass. The one failure is the known load-sensitive `apps/server/tests/roomIntegration.test.ts`, which passes 3 of 3 when run on its own (~1.1 s). It also fails on the unchanged baseline under the same parallel load.
  - New `tests/roadScenery.test.ts`: no palm, tree, shrub, flower or grass tuft stands within its own radius of any road or bridge; stunt ramps stay clear; every driveable road surface sits above the ground it covers.
  - `tests/chalakkudyCity.test.ts` now asserts the loop end to end, including that Kodaly Road reaches the town edge and that each bridge meets road ends on both banks.
- Inspected in the dev server: the MG Road/Boulevard crossroads (flared corners, zebra crossings), the Kodakara junction and NH boards, and the Kurumali bridge from the Kodaly junction.
- NOT yet done: a full drive of the loop in a car, and mobile GPU profiling.

## 2026-09-17 — Character and car catalogue refresh

- Removed at the user's request: the Maya (school uniform), Tommy, Appu and Kichu characters, and the Mazda RX-7. Their served GLBs and the three rig sources behind them are deleted, along with the rig profiles, the saved-profile enum entries, and the Mazda-specific calibration test. The showroom's red display car is now the muscle car.
- Added the four remaining car files, measured against the same normalization the renderer applies (rotate, centre, scale to `length`, wheels from the tyre meshes):
  - Golf GTI, Sports coupe and Toy car have tyres fused into one mesh per model, so their wheels are positioned for physics but do not spin, as with the Bronco. The Toy car is authored rotated 45 degrees and facing backwards; its catalog rotation corrects both.
  - The Supercar is the only new car with separate corner meshes, so its wheels steer and spin. It hides its exported shadow plane and exposes its `488_PAINT` material as recolourable paint.
  - Inspect-mode car cheats now reach the tenth car with the 0 key.
- Added the four remaining character files:
  - Spidey and Player 07 ship Mixamo skeletons. A new `mixamo` rig maps their limb bones onto the existing walk cycle, so they animate without a generated rig.
  - Raja (lungi) and Luffy are static sources rigged by `scripts/rig-characters.mjs` from measured joint positions. Raja's lungi reuses the skirt blend.
  - `lionel_messi.glb` is left out: it duplicates the rigged Qatar Messi already in the catalog.
- Checks run:
  - `npm run typecheck`: PASS. `npm run build`: PASS.
  - `vitest` outside `.worktrees`: all pass except the known load-sensitive `apps/server/tests/roomIntegration.test.ts`, which passes on its own.
  - The generated-rig suite runs over every catalog entry: each new character deforms both arms and both legs while walking, running, falling and riding, with normalized weights. The vehicle suite measures the Supercar's wheels against its meshes.
- Inspected in the dev server: Raja, Spidey, Player 07 and Luffy walking, and all four cars spawned (each sits on its wheels and faces forward).
- NOT yet done: mobile GPU profiling of the heavier new characters.
