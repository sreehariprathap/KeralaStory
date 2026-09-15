# Build log — observed implementation status

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

## 15 September 2026 — supplied default BGM

- Replaced synthesized ambient playback with `public/assets/bgm.mp3`, keeping playback user-gesture gated, looped, pause/mute aware, and cleaned up with the audio context. Bicycle preview sound remains procedural.
- The existing default settings volume is `0.5` (50%). The live settings panel displayed `Volume 50%` during inspection.
- Checks: `npm run typecheck` PASS; `npm test` PASS (89 tests, 20 files); `npm run build` PASS. The existing large scene chunk warning remains. `public/assets/bgm.mp3` served from the dev app with HTTP 200 and `audio/mpeg` content type.
