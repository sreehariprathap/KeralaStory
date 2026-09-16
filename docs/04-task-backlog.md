# Task backlog and handoff system

> Execution update: use [08-complete-app-plan.md](08-complete-app-plan.md) and [09-model-handoffs.md](09-model-handoffs.md) for the complete-app task sequence and Astra/Luna assignments. This original inventory is preserved; [06-build-log.md](06-build-log.md) records actual status.

The original inventory below was authored as **planned**; it is not a current implementation-status statement. See [06-build-log.md](06-build-log.md) for completed and partial work. Suggested ownership: **Core** for a stronger coding model with integration review; **Luna** for bounded work against stable contracts; **Art** for asset production/selection and visual review. These are task-sizing recommendations, not guarantees about any model's output.

Luna tasks should fit one focused session, normally one component, pure utility, or content fixture with a few supporting files. If a task needs engine research, new contracts, more than about three production files, or a new dependency, split it or move it to Core. Do not delegate an entire biome or ask a smaller model to invent the visual style.

The paths below are intended ownership boundaries. Foundation tasks create the structure first. Dependencies must be merged and their interfaces demonstrated before a dependent handoff starts. Core reviews integration and shared contract changes.

## Foundation and first slice

| ID / owner | Dependencies | Scope and allowed area | Acceptance / handoff evidence |
|---|---|---|---|
| F01 / Core | None | Scaffold Vite, React, TS, 3D/physics dependencies; scripts, lockfile, shell, neutral test scene | Pin compatible versions; install, typecheck and build pass; scene renders on two desktop browsers; record versions |
| F02 / Core | F01 | `src/contracts/`, typed world/asset fixtures; finalize interfaces in architecture document | Runtime schema checks reject invalid IDs/positions and unresolved references; example zone/profile/save compile |
| F03 / Luna | F01, F02 | `src/ui/tokens.css`, `src/ui/UiSample.tsx`; implement documented color, type, spacing, focus tokens | One review screen shows button, text, input, status, panel over bright/dark backgrounds; contrast checked; no new palette |
| C01 / Core | F02 | `src/game/input/`; one input owner with action bindings and mode transitions | Held keys clear on blur; menu input never moves the player; lock denied/released handled; drag and keyboard camera alternatives specified |
| C02 / Core | C01 | `src/game/player/`; kinematic capsule, gravity, walk/run/jump, steps, safe reset on test fixtures | Flat ground, stairs, slope, drop, bridge and wall fixtures pass; diagonal speed normalized; no movement while paused |
| C03 / Core | C02 | `src/game/camera/`; follow/orbit, pitch bounds, collision retraction | No wall penetration in narrow lane or treehouse; returns smoothly after occlusion; keyboard controls and sensitivity usable |
| A01 / Art | F02 | Asset intake report + one licensed/original rigged anime avatar, clips, source record | Meets dimensions/rig/material constraints; inspect actual GLB and clips; placeholders do not satisfy completion |
| A02 / Core | A01, C02 | `src/game/player/AvatarVisual.tsx` and animation adapter | Idle/walk/run/jump/fall/land use controller state; feet align to ground; no root drift; geometry cost recorded |
| A03 / Art | A01 | Approved sample kit: treehouse, canopy tree, banana plant, rock, tile roof, bridge and water treatment | Standard-light renders match avatar and bible; export/license/collider/LOD metadata complete; report missing assets explicitly |
| W01 / Core | C03, A02, A03 | `src/game/world/` and origin content; 80–120 m polished Kodassery trail with bridge and overlook | Five-minute playable art slice, no critical clipping; screenshot set and baseline frame report; establishes reusable assembly recipe |

A01/A03 are production dependencies, not “small code tasks.” If art tooling is unavailable, select usable licensed assets and document style adaptations, or deliver a precise production brief. Do not mark the visual slice finished with primitive substitutes.

## Isolated UI, map, and persistence tasks

| ID / owner | Dependencies | Scope and allowed area | Acceptance / handoff evidence |
|---|---|---|---|
| U01 / Luna | F02, F03 | `src/features/profile/ProfileForm.tsx`; name and preset/color controls, supplied callback and mock preview slot | Keyboard selection; invalid/blank name feedback; outputs approved `ExplorerProfile` values; no persistence or renderer edits |
| U02 / Core | U01, A02 | Profile preview integration and entry/continue flow | Same avatar appearance in preview and world; no duplicate physics loop; first visit → create → load → play works |
| U03 / Luna | F03, C01 | `src/ui/ModalShell.tsx`; native dialog with labeled title, explicit close, focus return, input-mode adapter | Keyboard open/close; Escape invokes one close callback; movement remains paused; caller owns Resume |
| U04 / Luna | F02, F03 | `src/ui/PlayerBadge.tsx`, `src/ui/LocationLabel.tsx`; presentational props only | Long names and region names fit at 200% zoom; bright/dark screenshots; no invented health/XP display |
| U05 / Luna | F03, C01 | `src/ui/ControlHints.tsx`; use supplied binding labels and collapsed state | Hints match actual bindings; keyboard-toggle works; hidden while map/menu open |
| M01 / Luna | F02 | `src/features/map/projection.ts` and tests; world↔normalized map projection | Corners, center, heading, inverse projection and letterbox/pan/zoom fixtures pass; no duplicated world bounds |
| M02 / Core | M01, W01 | Shared world geometry/map data, map viewport and minimap rendering | Both maps track test route and camera-independent heading; map clicks invert transforms correctly; stable at 200% zoom |
| M03 / Luna | M02, U03 | `src/features/map/LandmarkList.tsx`; accessible region/landmark list and legend, supplied callbacks | Keyboard selection sets supplied waypoint callback; visited/unvisited distinction uses shape/text as well as color |
| P01 / Luna | F02 | `src/persistence/localSaveRepository.ts` and tests; implement frozen repository interface | Roundtrip, missing save, corrupt JSON, future version, storage failure and last-good backup tests pass; never silently clears data |
| P02 / Core | P01, C02, U02 | Lifecycle save/restore and spawn validation | Reload returns valid profile/location; midair or obsolete save respawns safely; unavailable storage leaves game playable with message |
| D01 / Core | F02, C02 | `src/features/discoveries/`; once-only radius triggers, low-frequency events | Crossing one landmark repeatedly emits once per save; reset works; no frame-by-frame notifications |
| D02 / Luna | D01, F03 | `src/ui/DiscoveryToast.tsx`; event-driven presentation | Long label fits; short accessible announcement once; duplicate suppression; reduced-motion variant; no quest language |
| S01 / Luna | U03, F02, F03 | `src/features/settings/SettingsPanel.tsx`; supplied settings/actions, no engine wiring | Labeled audio/quality/motion/sensitivity controls; keyboard and reset-to-safe-point action; renders saved settings accurately |

## World assembly and finish

| ID / owner | Dependencies | Scope and allowed area | Acceptance / handoff evidence |
|---|---|---|---|
| W02 / Core | W01, M02 | All-region terrain blockout, canonical route/water polygons and bridge seam | Origin → harbor → origin continuous; no alternate river crossing; map matches; measure route duration and revise empty spacing |
| W03 / Core | W02 | Zone detail loading, shared cache, collision readiness and recovery | Slow/failing loads cannot drop player into void; repeat round trip without accumulating duplicate colliders/assets |
| A04 / Art | A03, W02 | Modular farm/temple/harbor kit and two further avatar presets using approved rig | All four region identity kits ready; no incompatible scale/shader packs; documented licenses and performance figures |
| L01 / Luna | F02, W02 | `src/content/zones/landmarks.ts`; enter the eleven approved landmark records at supplied blockout anchors | Unique resolvable IDs, correct zone ownership, placement validated; no terrain or discovery logic changes |
| L02 / Luna | W02, W03, A04 | Kadambode plant placement data only, from supplied plot bounds and approved seed/template | Banana/pepper/cardamom groups stay off paths, use instancing recipe, deterministic output; compare before/after screenshot |
| L03 / Luna | W02, W03, A04 | Kadambode house exterior placement data only, using supplied footprints and four approved variants | Doors face reachable paths; collision proxies align; palette/scale unchanged; no new building generator |
| L04 / Luna | W02, W03, A04 | Kurumali bank dressing data only: approved boats, nets, fishing figures | Both bridge approaches stay clear; objects stay on authored banks; no boat controls/NPC logic; within supplied instance budget |
| L05 / Luna | W02, W03, A04 | Kodaly street facade placement data only, with supplied street footprints and approved modules | Colonial and modern variants coexist; no blocked streets/jetty access; correct paved-road alignment |
| L06 / Luna | W02, A04 | Asset manifest audit/report only | Report missing sources/licenses, clips, LODs and cost outliers; do not silently substitute assets or change metadata to pass |
| W04 / Core | W03, L01–L06 | Regional assembly review: scenic vistas, landscape blending, temple courtyard, lighthouse/jetty, full avatar palette | Every required region identity present; intentional sightlines; integrate placement fixes and verify all navigation |
| X01 / Core | W04, S01 | Ambient audio and movement sounds, quality settings wiring | Audio starts after user gesture; mute/volume persist; region loops blend without duplication; low tier retains navigation landmarks |
| X02 / Luna | W03, F03 | `src/ui/LoadingView.tsx`, `src/ui/LoadError.tsx`; consume supplied loader status/actions | Determinate vs indeterminate states honest; retry and return controls accessible; no fake percentages or loader internals edits |
| Q01 / Core | All above | Release integration, performance profiling and browser/recovery tests | Complete validation matrix with actual device/version/results, resolve blockers, capture visual baselines |

W04 and Q01 are integration work. They are not appropriate to compress into cheap “finish everything” prompts. Split further if their changes become broad; maintain one integrator for shared scene ownership.

## Suggested assignment order

1. Foundation and movement: F01, F02/F03, C01–C03. Use a placeholder only while A01/A03 are prepared.
2. Prove art: A02 and W01. Stop region dressing if the avatar, camera, or sample scene still fails review.
3. Create map/blockout and loading: M01–M02, W02–W03. UI tasks can progress against reviewed fixtures.
4. Profile/save/discoveries: U01–U05, P01–P02, D01–D02, M03, S01.
5. Content: A04, L01–L06, W04. Assign one placement file per task; a central world-layout owner supplies footprints.
6. Finish: X01–X02 and Q01.

No agents are dispatched by this plan. If the user later requests parallel execution, only run tasks with disjoint writable paths and satisfied dependencies. Shared contracts, package files, app composition, and world terrain stay with the integrator.

## Copyable task handoff

```text
Implement task [ID] from docs/04-task-backlog.md.

Read README.md, docs/02-design-bible.md, docs/03-architecture.md,
and this task's row. Inspect the existing interfaces before editing.
The dependency tasks [IDs] are complete at [commit/reference].

Goal: [one observable result].
Allowed files: [explicit paths from the task, plus named test file].
Inputs/fixtures: [actual exported types and exact fixture paths].
Acceptance checks: [copy task's checks, with executable command if available].

Use the existing tokens, data schema, assets, and components.
Do not change contracts, dependencies, shared terrain, renderer, camera,
physics, or unrelated files. Do not add quests or new visual conventions.
If a required interface/asset is missing, report the precise dependency;
do not invent a replacement that changes scope.

Return: changed files, checks run and results, one screenshot if visual,
and any unresolved issue. Do not call unrun checks passing.
```

Integrator fills every bracket before dispatch. Keep the context packet small: the relevant contract exports, task row, applicable bible rules, a good neighboring implementation, and a screenshot/fixture. Do not send a smaller model an open-ended request to “build the game.”

## Definition of done for every handoff

The requested observable behavior works; unrelated behavior remains intact; no undeclared dependencies or schema drift; appropriate type/build/behavior checks pass; visual work has a real screenshot; documentation distinguishes completed behavior from placeholders. Merge small changes sequentially through the integrator. If a check fails, return the original task with the concrete failure instead of adding a vague cleanup task.

## Mountain, Chokkana and Athirappilly expansion — 15 September 2026

Task definitions and acceptance gates: [map expansion plan](superpowers/plans/2026-09-15-mountain-chokkana-athirappilly.md). This extends the existing world with a climbable summit and whole-map view, a forest driving loop, a separate Athirappilly destination and nine landmarks. Preserve all existing regions and Silverthread Falls.

- Planning MX-P1–MX-P3: **Done**, including Luna read-only review.
- Core MX-A1–MX-A8: **Planned**, GPT-6 Astra ownership.
- Bounded MX-L1–MX-L4: **Planned**, GPT-5.6 Luna handoffs after contracts/dependencies are ready.
- Mark tasks Done only after their acceptance gates pass; append actual results to the build log. Runtime expansion work has not started.
