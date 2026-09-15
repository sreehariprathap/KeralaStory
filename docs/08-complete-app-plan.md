# Complete Kerala Story implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute reviewed tasks. Check off tasks only with evidence. Detailed Luna handoffs are in [09-model-handoffs.md](09-model-handoffs.md).

**Goal:** Complete a connected four-region Kerala circa 2000–2005 exploration app, with finished anime travelers, English/Malayalam labels, a rideable bicycle, and usable desktop/mobile controls.

**Architecture:** Keep the existing React/Three/Rapier app. One canonical world definition drives terrain, routes, maps, regions and safe spawns. One input owner merges desktop and touch commands; physics owns walking and cycling, while DOM UI consumes low-frequency snapshots.

**Tech stack:** Existing pinned Vite, React, TypeScript, React Three Fiber, Rapier, Zod and Vitest. Keep the current lockfile; select browser-test tooling only when implementing its task.

**Spec:** This document records the 14 September 2026 request together with [01](01-product-plan.md), [02](02-design-bible.md), [03](03-architecture.md) and [07](07-kerala-2000s-direction.md). It adds mobile, language and cycling scope and resolves conflicts below. [06](06-build-log.md) records actual status; plans never prove completion.

> **Implementation update:** Gameplay work is now in progress; see [06](06-build-log.md) for the per-task ledger. The user has deferred final GLB art until assets are supplied. The audit below is the pre-implementation baseline, not current status.

## 1. Is the whole docs package implemented?

**No.** Source contains a substantial procedural prototype and all four region definitions, but the complete documented app is unfinished. Declaring `available: true` is not proof of continuous playability.

| Area | Evidence in current repository | Remaining delivery |
|---|---|---|
| Foundation | Pinned app, tokens, Zod profile/settings/save schemas, six test files | Contracts need region/asset/input/vehicle extensions and validation |
| Movement/camera | Rapier kinematic motor, jump/run, collision-aware camera, blur/pause handling | Three baseline test failures; real route and mobile lifecycle validation |
| Four regions | `KeralaWorld.tsx`, `KodasseryWorld.tsx`, world data and eleven landmarks | Prove both-direction traversal, finish every regional identity and safe route |
| Maps | North-up minimap/full map, zoom/pan buttons, filters, landmark waypoints | Remove duplicated geography, add map hit testing and actual bearing, localize all labels |
| Profile/save/discovery | Create/continue, presets, local repository/backup, once-only discovery UI | Stronger safe spawn/recovery, lifecycle and accessibility evidence |
| 2000s setting | Tiled homes, paddy, palms, tea shops, painted bilingual boards, poles, boats, lighthouse | Cohesive finished assets, complete regional content and sound |
| Anime art | Procedural character and scenery | Approved rigged GLBs, six locomotion clips, cycling pose/animation, asset/license/LOD records |
| Language | Malayalam font dependency and hardcoded painted shop boards | No locale setting or runtime switch; translation sheets created in this planning pass |
| Mobile | Desktop input and a notice saying touch is coming later | Left movement panel, simultaneous camera touch, jump, sprint lock, bicycle controls |
| Bicycle | No vehicle subsystem | Safe mount/dismount, ride physics, camera, animations, parking and restore |
| Loading/audio/release | Lazy canvas, retry/context-loss UI, quality settings | Neighbor loading, collision readiness, actual audio, device/browser/performance matrix |

Fresh baseline: typecheck PASS; build PASS with large-chunk warning; tests **29 passed / 3 failed**. See build log for exact failures. Entry scene inspected in Chrome; full traversal and mobile play were not verified.

## 2. Scope and design decisions

### Complete app boundary

Four connected regions: **Kodassery Peaks → Kadambode → Kurumali Puzha → Kodaly**, traversable back to origin. Include entry, three avatar presets, walking/running/jumping, cycling, discovery, maps, settings, sound, local persistence, loading/recovery, accessibility and release testing. No quests, backend, accounts, multiplayer, combat, inventory, economy or day/night cycle.

Use the current **166 × 576 m** compressed world first. The older **420 × 1,050 m** envelope is a later scale expansion, not another unbuilt set of maps. Keep all required content from the original plan, measure route times, and expand only where density requires it. Do not add extra unnamed regions.

Three possible approaches:

1. **Recommended: finish the connected world in stages.** Repair baseline, freeze interfaces, enable touch/language/cycling, then complete art and release gates. Reuses working code and exposes traversal problems early.
2. Dress all four regions first. Produces attractive views earlier, but risks rebuilding assets around changed bicycle clearance and mobile budgets.
3. Rebuild in another engine or enlarge the world now. Adds migration and content cost without resolving current missing features.

### Kerala around 2000–2005

Preserve the warm, hand-painted anime direction from 02. Use red oxide verandas, clay tile roofs, laterite walls, coconut/banana/pepper/cardamom planting, paddy bunds, narrow tar roads, sandy shoulders, tiled temple courtyard/tank/brass lamp, modest shops and utility wires, wooden boats and fishing equipment. Signs must use the shared translation catalog. No modern delivery branding, smartphones, neon city imagery or luxury-resort replacement of village identity.

| Region | Required finish and routes | Bicycle access |
|---|---|---|
| Kodassery | Origin overlook, two canopy homes, traversable canopy bridge, waterfall overlook, descent, mist and canopy variation | Main ground trail; canopy bridge/stairs are walking detours with visible parking |
| Kadambode | Paddy loop, four house exteriors, banana/pepper/cardamom groups, spice garden, stream edge, temple courtyard and tank, tea shop | Main village road and sufficiently wide farm loop; park at narrow bunds/temple approach |
| Kurumali | Single main wooden river crossing, both approaches, two fishing spots with ambient figures, boats and nets | Continuous main bridge, low-speed steering, guarded edges; no water shortcut |
| Kodaly | Compact street loop, six facade variants mixing colonial and modest concrete buildings, harbor ambience, jetty and lighthouse exterior | Streets and harbor approach; park before narrow jetty/lighthouse steps |

Keep existing landmark IDs and discoveries. Add `spice-garden` as an additional landmark; do not replace `tea-shop`. Review `canopy` to ensure its marker describes the reachable homestead/bridge accurately. Landmarks may exceed eleven after this restoration; counters derive from the catalog.

### English / Malayalam

- Visible `English / മലയാളം` selector at entry and in settings; works before profile creation and persists on this device.
- Malayalam selection changes region and place names in entry captions, HUD, minimap/full atlas, filters, landmark list, discoveries, waypoints and authored signs. English selection restores English names everywhere.
- Extract other UI copy into an English catalog and blank Malayalam companion so the user can translate menus as well. Place names are the first required language deliverable.
- `src/content/locales/en.json` is the reference; **edit only string values in `src/content/locales/ml.json`** to supply Malayalam. Empty or whitespace Malayalam falls back to English. Never show an empty name or raw translation key.
- Do not invent or machine-translate uncertain Malayalam, including existing handwritten sign strings. Leave slots blank for user review. Keep IDs and coordinates independent of language. User-entered explorer names are never translated.
- Use the already-installed Malayalam font, set language metadata correctly, allow longer labels and full grapheme shaping. Sign textures wait for font readiness and refresh/dispose only on locale/content change.
- These JSON files are created now as editable data; the runtime toggle is a planned task, not implemented by creating them.

### Mobile controls

A PUBG/BGMI-familiar arrangement, styled with Kerala Story tokens: **bottom-left movement pad**, sprint-lock button just above it, **right-side camera drag area**, jump and bicycle action buttons on the lower right. Keep the middle clear, pause/map at the top, and reserve safe-area margins.

- Movement pad supports analog dragging and visible directional buttons; minimum 44 px targets, target 48–56 px. Normalize diagonal motion and use a dead zone.
- Different pointer IDs own movement, look and actions. Move + look + jump works with three contacts. Buttons never rotate the camera. Do not synthesize keyboard events.
- Sprint lock means auto-forward running after a deliberate tap; steering remains available. Tap again, pull backward, brake, mount, pause, open map, lose focus, rotate screen or cancel input to clear it. Jump does not re-enable a cleared lock. A blocked character never accumulates extra speed.
- Jump is edge-triggered: one jump per press. Touch release, cancellation, lost capture, blur and unmount clear held actions.
- Cycling changes the action cluster to brake and dismount; sprint lock clears and jump is disabled. Hold forward to pedal. No automatic sprint/ride continuation after closing a modal.
- Landscape is the main compact-phone layout; portrait still offers functional controls and may suggest rotation without blocking play. Tablet/hybrid users can choose Auto / Touch / Desktop controls.
- Touch input never requires pointer lock. Preserve drag/orbit, Q/E and keyboard controls on desktop. UI snapshots remain at at most 10 Hz; no React updates per frame.

### Bicycle

Use one personal, period-appropriate roadster bicycle with mudguards, rear carrier and bell styling. One rideable instance; no rentals, inventory, stamina or vehicle customization.

- Start parked at the origin ground trail. Desktop **F** and a touch action mount/dismount within 2 m, grounded, with clearance. Prompts explain unavailable actions.
- One authoritative controlled collider at a time. Use an arcade kinematic motor at fixed 60 Hz; visual wheel rotation/lean follows measured movement. No full two-wheel balance simulation.
- Initial tuning targets: cruising maximum **9 m/s**, acceleration **3 m/s²**, braking **7 m/s²**, coasting deceleration **1.2 m/s²**, reverse capped **2 m/s**. Tune after route trials; walking/run speeds remain unchanged. Require at least 25% faster end-to-end main-route travel than running.
- Steering depends on speed and has bounded turn rate; camera may orbit independently. No instant sideways strafing at speed, wall tunneling, water riding, jump tricks or automatic uphill launch.
- Brake with S/down/backward pad input; reverse only after stopping and a new backward input. Reject dismount above 0.5 m/s with “Brake to get off”; find grounded clearance beside the bike, otherwise stay mounted and show a reason.
- Walking-only detours are authored route metadata with parking positions. Block unsafe bicycle entry without changing walking access. If the bicycle is left behind, “Return bicycle” at a named parking point moves it only while unmounted and only to a validated free slot.
- Save validated parked bicycle position and heading. Reload always starts the explorer on foot at a safe spawn near the last valid location and parks the bike safely nearby; do not restore velocity, sprint lock or held input. Explain this restore behavior in settings/help.

## 3. Ownership and execution order

**GPT-6 Astra:** only complex movement, camera, pointer lifecycle, terrain/loading, contract design/migration policy and final integration. **GPT-5.6 Luna:** bounded UI, pure helpers/tests, content placement, asset bookkeeping and validation reporting after contracts exist. Art production is an explicit artist/asset-tool deliverable; assigning Luna a filename cannot produce an approved rig.

The implementation coordinator reads returned patches; Astra is called only for the listed core tasks or a concrete cross-system failure. Do not spend an Astra task on copying labels, formatting docs or entering placements. Only run independent ready tasks in parallel. Maximum three workers beside the coordinator; explicit disjoint writable paths. Shared contracts, app composition, terrain, camera, physics and package files have one integrator owner.

| Phase | Tasks | Exit gate |
|---|---|---|
| 0: repair and freeze | A00 baseline, A01 contracts, L00 fixtures | Existing tests pass for justified reasons; shared interfaces/data ownership published |
| 1: language and touch | L01–L04, A02, A03 | Names switch/persist; full simultaneous mobile input without stuck movement |
| 2: world and cycling | A04, L05, A05, L06, A06 | Walk and ride origin → harbor → origin; detours and restores safe |
| 3: maps, art and regions | L07, L08, R01/R02, A07, L09–L12, A08 | Every required regional identity and approved animated character present |
| 4: app finish | L13–L16, A09 | Real sound/loading/recovery/settings; complete entry/continue flows |
| 5: release | L17, A10 | Browser/device route, art and performance gates pass with recorded evidence |

R01/R02 asset intake can begin alongside phase 0; use prototype visuals for movement development but keep final art gates open. L09–L12 await approved assets and authored footprints. A07 and A06 can run in sequence without reopening frozen contracts.

## 4. Contract and file boundaries to establish in A01

| File / module | Responsibility |
|---|---|
| `src/contracts/index.ts` | Preserve existing exports; add Locale, controls preference, TravelMode, snapshot, versioned save and small region/asset/placement schemas |
| `src/contracts/input.ts` | `InputCommands`: `setMove(source, x, forward)`, `addLook(source, dx, dy)`, `press(action)`, `setBrake(held)`, `clear(source?)`; sources keyboard/touch, actions jump/toggleSprint/interact |
| `src/content/world/definition.ts` | Canonical bounds, region polygons, route segments with walk/cycle access, water, bridge, map anchors and named safe/parking spawns |
| `src/content/world/kodassery.ts` | Compatibility re-exports during conversion; remove only after every consumer moves |
| `src/content/locales/{en,ml}.json` | Flat stable text keys; blank Malayalam values supported |
| `src/features/i18n/translate.ts` | `translate(key: TranslationKey, locale: Locale): string`; `TranslationKey = keyof typeof en` |
| `src/features/i18n/LanguageToggle.tsx` | Props `{value: Locale; onChange: (locale: Locale) => void}`; no persistence or engine logic |
| `src/features/controls/MobileControls.tsx` | Props `{enabled: boolean; sprintLocked: boolean; travelMode: TravelMode; canInteract: boolean; commands: InputCommands}` |
| `src/game/input/` | Mutable action state, pointer routing, lifecycle cleanup and source arbitration |
| `src/game/vehicle/` | Bicycle motor, mount state, parking/clearance and visual adapter |
| `src/content/zones/*.ts` | Declarative placements within core-supplied footprints and budgets |
| `src/content/assets/manifest.ts` | Validated asset IDs, sources, licenses, scale, LOD, collision and clip records |
| `src/app/` | Composition and lifecycle; localization, input adapter, save/load, loader and audio connections |

A01 publishes actual exported types and fixtures before dispatch. Proposed names above are the handoff targets, not existing APIs. Keep additive V1 reading; write V2 with locale and bicycle data only after successful migration/validation. Preserve original and last-good saves. Pre-profile language preference has its own small local preference record; latest explicit choice takes priority when continuing an older save.

## 5. Acceptance and completion

Every task returns changed paths, checks/results and unresolved dependencies. Visual tasks include an actual running screenshot; motion tasks include route/playtest evidence. Never call an asset placeholder, a compilation result or a list of four names “complete.”

- Regression: `npm run typecheck`, `npm test`, `npm run build` before integration handoff.
- Route: both directions, all four regions, main river bridge, canopy detour, temple, spice garden, harbor/jetty; walking and cycling; no reload/teleport on main route.
- Input: simultaneous touch move/look/jump; sprint-lock cancellation; mobile camera; mount/dismount; map/pause/blur/orientation/capture loss and mixed keyboard/touch.
- Localization: switch on entry and while paused; all names and signs; blank fallback; long user-supplied Malayalam; reload without losing profile/discoveries; translation inventory coverage.
- Saves: existing V1, V2, corrupt/future version, denied/quota storage, invalid bicycle/spawn, midair/bridge/loading interruption; originals preserved.
- Loading: cold/slow/failed essentials, optional decoration failures, retry/title, WebGL unavailable/lost, repeated region loads without duplicate colliders/material disposal errors.
- Desktop targets: retain 03's median ≤16.7 ms / p95 ≤25 ms medium and low p95 ≤33.3 ms; actual named hardware required.
- Mobile proposed gate: low quality, capped DPR 1, p95 ≤33.3 ms over warm route on a nominated midrange Android and iPhone; 10-minute thermal and repeated-loop check. Record device/OS/browser and failures. These are targets, not measured support claims.
- Accessibility: keyboard entry/settings/map, visible focus, 200% zoom, bright/dark label contrast, 44 px targets, reduced motion, mute and non-color status. Browser smoke: current Chrome/Edge/Firefox/Safari desktop plus real Android Chrome and iOS Safari at execution time.
- Art: approved original/licensed GLBs, six foot-locomotion clips plus cycle pose/pedal animation, three preset appearances, all regional kits; provenance and budget report.

## 6. Coverage of the original backlog

| Original IDs | Completion work in this plan |
|---|---|
| F01–F03 | A00/A01, L00, L03, L17 |
| C01–C03 | A00, A02, A05/A06, A10 |
| A01–A04 | R01/R02, A07, L08, A08 |
| U01–U05 | L02/L03/L15, A03, A09 |
| M01–M03 | A04, L07, A08 |
| P01–P02 | A01, L04, A06, A09 |
| D01–D02 | L05/L15, A08/A09 |
| S01 | L02/L03, A03/A09 |
| W01–W04 | A04, R02, L09–L12, A08/A09 |
| L01–L06 | L05, L08–L12 |
| X01–X02 | L13/L14, A09 |
| Q01 | L17, A10 |

Mobile and cycling are now release scope, superseding “touch later” in 01/02. Current-world dimensions from 07 override older coordinate examples. Other art, topology, persistence and performance requirements remain. Execution should follow this plan and 09; 04 remains the original requirement inventory, 06 is the only status ledger.
