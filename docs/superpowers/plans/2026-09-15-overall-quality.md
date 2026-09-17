# Kerala Story Overall Quality Improvement Plan

> **For agentic workers:** Use superpowers:executing-plans to execute one scoped milestone at a time. Expand a milestone into a focused implementation plan before changing its subsystem. The project authorizes bounded Luna tasks after interfaces are ready; Astra owns core integration. This document creates no running agents or implementation work.

**Goal:** Make the existing four-region exploration prototype feel stable, visually cohesive, responsive and alive, with a repeatable quality standard rather than isolated asset upgrades.

**Architecture:** Preserve the current React/Three.js/Rapier structure. Physics owns movement; animation consumes motion snapshots; shared rendering and content rules apply across regions. Establish the standard on a short Kodassery route, then extend it region by region.

**Tech Stack:** Existing Vite, React, TypeScript, React Three Fiber, Three.js, Rapier, Vitest and Blender asset pipeline. Evaluate additional dependencies only against a measured need.

**Spec:** `docs/02-design-bible.md`, `docs/03-architecture.md`, `docs/07-kerala-2000s-direction.md`, `docs/08-complete-app-plan.md`, `docs/05-validation.md`. Current evidence: `docs/06-build-log.md` and `docs/validation/2026-09-15-avatar-and-forest-review.md`.

## Global constraints

- Preserve Kerala circa 2000, the shared warm painted palette, and connected four-region world coordinates.
- No quests, backend, accounts, multiplayer or unrelated gameplay expansion.
- Keep original supplied assets; produce derived runtime exports with source attribution.
- Preserve saved avatar IDs, user profiles and settings. Changes to persistence require explicit migration behavior and regression coverage.
- Farm assets belong in Kadambode farm fields. Kodassery uses appropriate forest/grass assets; terrace field grass follows the authored step surfaces.
- Do not add per-frame React state updates. Keep inputs, physics, animation and UI ownership separate.
- Use shared UI tokens and English/Malayalam catalogs. Honor reduced motion and low-quality settings.
- Keep visual review separate from automated correctness: moving vertices alone do not establish good animation, and a successful build does not establish a smooth game.
- Each milestone ends with typecheck, relevant tests, full test suite, build and actual running UI inspection. Record failed/unperformed checks honestly.

## Starting point

The latest recorded verification is 166 passing tests across 29 files plus typecheck/build passes. Nine imported avatars now have skeletal limb animation, with four newly fitted rigs and an explicit Appu bone mapping. This establishes movement coverage, not final deformation quality, authored animation clips or foot placement.

Kodassery has a small set of instanced supplied tree replacements with low-tier fallbacks. Character rigs still include large assets; the production build reports a large scene chunk. Real-device frame-time, cold-load and memory targets are not established as passing. Earlier car entry instability makes occupied/parked vehicle behavior a priority playtest even though regression tests exist.

## Priority and dependency order

| Milestone | Priority | Main result | Depends on |
|---|---|---|---|
| Q1: Capture a repeatable baseline | P0 | Evidence and ranked defect list | Current build |
| Q2: Stabilize movement and interaction | P0 | Reliable walking, driving, camera and modal controls | Q1 |
| Q3: Finish avatar motion and deformation | P0 | Natural limb motion for every selectable avatar | Q1; Q2 motion signals |
| Q4: Establish asset/performance budgets | P0 | Comfortable loading and frame-time headroom | Q1; final Q3 asset exports |
| Q5: Polish a Kodassery reference route | P1 | Cohesive five-minute visual slice | Q2–Q4 |
| Q6: Carry the standard across regions | P1 | Consistent quality with distinct regional identities | Q5 |
| Q7: Refine sound, UI and accessibility | P1 | Clear feedback and usable controls | Q2; integrate with Q5–Q6 |
| Q8: Release-quality validation | P0 release gate | Verified full route and device matrix | Q2–Q7 |

P0 means necessary for a dependable experience; P1 improves presentation after that foundation. Q2 and avatar art preparation can progress independently after Q1. Do not run concurrent edits to shared contracts, app composition or package files.

## Q1 — Capture a repeatable baseline

**Owner:** Astra integration; Luna may compile asset reports and test fixtures.
**Relevant files:** `src/app/WorldCanvas.tsx` (existing RenderMeter), `src/app/App.tsx` (development inspection), `docs/05-validation.md`, `docs/assets/audit.md`.
**Output:** `docs/validation/quality-baseline.md`, with dated screenshot/video references and a severity-ranked defect table.

- [ ] Record commit/build identifier, hardware, browser version, viewport, pixel ratio and quality setting.
- [ ] Record all nine avatars from front, side and back: idle, walk, run, jump/fall, landing and bicycle riding. Use a flat surface, stairs and a slope.
- [ ] Capture both cars: idle before/after entry, steering, braking, reversing, nitro, exit, pause/resume and respawn rejection while mounted.
- [ ] Record the existing validation route from Kodassery to Kodaly and back. Capture one fixed reference view per region.
- [ ] Measure a warmed 60-second route, cold first-play timing, draw calls, triangles and memory trend across three round trips.
- [ ] Rank findings as blocker, major or cosmetic. Every finding includes reproduction steps, expected behavior, evidence and affected subsystem.

**Acceptance:** Another developer can reproduce the route and camera positions. Unknown performance values are explicitly marked unmeasured. Baseline screenshots and motion recordings exist as saved artifacts, not only tool output.

## Q2 — Stabilize movement and interaction

**Owner:** Astra.
**Relevant files:** `src/game/player/ExplorerController.tsx`, `src/game/player/travelCollider.ts`, `src/game/camera/ThirdPersonCamera.tsx`, `src/game/input/`, `src/game/vehicle/carPhysics.ts`, `src/game/vehicle/carNitro.ts`, `src/app/App.tsx`, `src/ui/ModalShell.tsx`.
**Coverage:** Existing car entry/handling/nitro, input, controller, mount-state, clearance and traversal tests.

- [ ] Reproduce baseline blockers before editing. Fix the responsible layer and add regression coverage for each behavior defect.
- [ ] Verify cars settle without input, remain assembled through turning/uneven ground, and cannot receive forces from the hidden occupied player collider.
- [ ] Verify nitro duration, cooldown/refill, cancellation on braking/exit/pause, and HUD readiness against the actual physics state. Driving hints must describe driving actions.
- [ ] Audit car modal opening, closing and spawning: only one modal visible, gameplay input cleared, accessible model selection, clear blocked-spawn feedback.
- [ ] Check camera collision, slope transitions, bridge approaches, stairs, water resets and mount/dismount clearances. Preserve working behavior rather than retuning everything together.

**Acceptance:** Ten repeated car enter/exit and pause/resume cycles without jitter or displaced parts; both cars complete the designated handling loop; modal/form input never moves the player; no persistent camera clipping on the baseline route.

## Q3 — Finish avatar motion and deformation

**Owner:** Astra for runtime and animation signals; asset/art work for rig fitting and clips.
**Relevant files:** `scripts/rig-characters.mjs`, `src/content/assets/models.ts`, `src/game/player/nickAnimation.ts`, `src/game/player/ImportedAvatar.tsx`, `src/game/player/ExplorerAvatar.tsx`, `src/game/render/ModelAsset.tsx`, `tests/generatedRigs.test.ts`, `tests/nickAnimation.test.ts`.
**Output:** A per-avatar motion acceptance sheet in `docs/assets/character-rigs.md` and derived runtime assets.

- [ ] Review shoulder, elbow, wrist, hip, knee and ankle placement individually. Correct weights where sleeves, skirts, hands or legs stretch or remain partly attached to the torso. Inspect loose source mesh fragments and preserve intentional accessories.
- [ ] Validate idle arm position, walking opposition between arms/legs, running stride, jump/fall/land transitions and bicycle hand/foot contact for all nine avatars.
- [ ] Establish a shared locomotion state sequence driven by measured velocity and grounded/vertical motion, with smooth transitions and no movement of the gameplay root from visual clips.
- [ ] Produce or retarget authored idle/walk/run/jump/fall/land clips on one reference avatar first. Validate remaining rigs individually before assigning the same clips to them; retain working procedural animation until each replacement passes.
- [ ] Add foot placement on slopes/stairs: clamp leg reach, smooth ankle targets, disable planting in air/on bicycles, and preserve deterministic physics movement.
- [ ] Add restrained head/torso idle motion after locomotion passes. Facial and finger animation remain a separate optional refinement.

**Acceptance:** No detached hands/feet, severe triangle stretching, wrong facing or obvious floating in the reference recordings. Both feet visibly alternate; standing feet meet the ground; motion returns smoothly to idle. Actual GLB deformation tests and artist/visual review both pass. Cycling contacts are judged against the bicycle, not a floating pose.

## Q4 — Establish asset and performance budgets

**Owner:** Astra for loader/rendering integration; Luna for bounded manifests/reporting.
**Relevant files:** `public/assets/`, `src/game/render/ModelAsset.tsx`, `src/game/world/ImportedTrees.tsx`, `src/game/world/KeralaWorld.tsx`, `src/app/WorldCanvas.tsx`, `docs/assets/audit.md`.

- [ ] Inventory each runtime asset's file size, triangle/material count, texture dimensions, skeleton/clip status and source/license. Inspect loaded transforms, not only raw GLB coordinates.
- [ ] Optimize the largest avatar first: preserve silhouette, joints, UVs and material meaning while reducing unnecessary geometry and texture resolution. Compare identical close-up and gameplay views before/after.
- [ ] Create lower-detail foliage and distant building versions where the baseline shows geometry/overdraw cost. Reuse geometry/materials and instance repeated content.
- [ ] Measure whether download/decode, texture memory, draw calls, fill rate or physics causes the current bottleneck. Make one corresponding change at a time.
- [ ] Evaluate compressed textures with verified loader support and visual comparison; keep source color/data texture handling correct. Do not upscale small textures as a substitute for painted detail.
- [ ] Introduce neighboring-region detail loading only if measurements justify it. Keep collision ready before entry and provide recovery when assets fail.

**Acceptance targets from the architecture, to be verified on named devices:** medium-tier median ≤16.7 ms and p95 ≤25 ms; low-tier p95 ≤33.3 ms; visible scene ≤250 draw calls and ≤600k triangles; essentials ≤15 MB compressed; first play ≤10 s at 20 Mbps/100 ms RTT; estimated active texture budget ≤128 MB. If a target cannot be met, record the measured result and explicit budget decision. Test three round trips for sustained memory growth.

## Q5 — Polish a Kodassery reference route

**Owner:** Astra integration plus asset/art work.
**Relevant files:** `src/game/world/KodasseryWorld.tsx`, `src/game/world/ImportedTrees.tsx`, `src/app/WorldCanvas.tsx`, `src/content/world/kodassery.ts`, `public/assets/grass/`, `public/assets/trees/`.
**Route:** An 80–120 m selected portion of the existing canopy/bridge/waterfall route, forming a roughly five-minute exploration review.

- [ ] Establish one standard daylight view containing a traveler, tree, grass, rock, timber and roof material. Match saturation, roughness and texture scale before distributing assets.
- [ ] Create a small shared painted material kit: laterite, dirt, moss, timber, roof tile and rock. Add broad surface variation without noisy microdetail or a new photorealistic style.
- [ ] Blend path edges and terrain material transitions; reduce repetitive vertex-color bands and visibly floating vegetation.
- [ ] Compose tree/grass variation around the actual trail, keeping views, route clearance and collisions readable. Keep shrubs tiny and avoid farm-field assets here.
- [ ] Add subtle leaf-tip wind with anchored trunks, varied instance phase and corresponding shadow deformation. Disable decorative motion for reduced motion and reduce its cost on low quality.
- [ ] Improve waterfall/stream movement and contact foam, retaining stylized blue-green water and avoiding an expensive refraction requirement.

**Acceptance:** The reference route reads as one art style at player-camera distance. Imported and procedural scenery do not clash in scale or brightness. No blocked paths, floating trunks/grass or major texture seams. The Q4 frame budget still passes. Save before/after daylight views as the standard for regional work.

## Q6 — Carry the standard across all regions

**Owner:** Astra supplies terrain/placement contracts; Luna may implement bounded placement data against them.
**Relevant files:** `src/game/world/KeralaWorld.tsx`, `src/game/world/RegionalDetails.tsx`, `src/content/world/`, `docs/plans/region-footprints.md`, regional assets under `public/assets/`.

- [ ] Kadambode: fit `field.glb` grass to terrace tops; keep bunds and steps visible; constrain farm assets to farm footprints; improve temple courtyard, planted rows and house/road edges with the shared kit.
- [ ] Kurumali: align banks, waterline, bridge approaches and fishing props; improve shallow/deep-water readability; retain the intended river crossing topology.
- [ ] Kodaly: improve shop and roof silhouettes, road/footpath materials, harbor/jetty edges, boats and lighthouse views using existing regional footprints.
- [ ] Revisit transitions between regions: shared sun/material response, continuous terrain, gradual foliage changes and views that naturally guide exploration.
- [ ] Review one region at a time against the Kodassery standard and its own regional identity brief. Re-run the route both ways after placement changes.

**Acceptance:** All four regions have distinct, recognizable identities and a consistent rendering style. Map markers remain tied to world data. Main routes, bridge, fields and harbor stay accessible. No new area is described as polished solely because extra props were added.

## Q7 — Refine sound, UI and accessibility

**Owner:** Astra for audio/input lifecycle and integration; Luna for bounded presentation/localization tasks.
**Relevant files:** `src/game/audio/AudioDirector.tsx`, `src/game/audio/audioPolicy.ts`, `src/features/controls/`, `src/features/profile/`, `src/features/settings/`, `src/features/i18n/`, `src/content/locales/`, `src/ui/`, `src/app/app.css`.

- [ ] Add restrained surface footsteps and bicycle/car feedback using reusable audio sources. Blend ambient water/forest/harbor sound gradually; retain user-gesture startup, mute, volume and pause lifecycle.
- [ ] Match control hints to foot/bicycle/car mode and device. Show nitro status only from actual state; keep HUD text readable without covering the traveler or road.
- [ ] Improve profile presentation with consistent framing and accurate motion previews. Show useful player-facing copy rather than loader/rig implementation details.
- [ ] Complete English/Malayalam copy for new controls. Audit 200% zoom, long names, bright/dark backdrops, portrait/landscape touch and keyboard focus return.
- [ ] Verify empty/error/loading states, retry, unavailable storage and scene recovery without duplicate overlays or lost profiles.

**Acceptance:** Menus work by keyboard and touch; active hints match real bindings; readable token-based type and controls; no duplicated sound after repeated start/exit or tab switching; mute and reduced motion work consistently across regions.

## Q8 — Validate the whole experience

**Owner:** Astra integration; bounded independent verification may be delegated.
**Relevant files:** `docs/05-validation.md`, `docs/06-build-log.md`, `docs/validation/`, relevant existing tests.

- [ ] Execute the complete origin → harbor → origin route on foot; use the designated safe vehicle loop for bicycle and both cars. Include all region transitions and the sole main-river bridge.
- [ ] Verify create/continue, save/reload, switching avatars, settings persistence, invalid-save recovery, reset and failed-load recovery.
- [ ] Run the existing browser/device matrix and record exact tested versions. Include an actual touch device for touch/performance claims; desktop emulation alone does not satisfy that gate.
- [ ] Repeat baseline screenshots and frame/memory measurements under the same settings. Classify remaining issues by severity and owner.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build` and `git diff --check`; archive results alongside the visual and performance evidence.

**Acceptance:** No open release blockers from `docs/05-validation.md`. Remaining cosmetic issues are documented. The build, real playtest, art and performance gates have separate recorded results.

## Recommended first delivery

Complete Q1, fix the highest-impact Q2 regressions, and finish Q3 deformation review for the newly rigged avatars. Optimize the largest asset enough to establish Q4 headroom, then deliver the Q5 Kodassery slice. Use that concrete result to judge the quality bar before expanding regional detail.

## Optional work after these gates

Facial expressions, finger articulation, cloth/hair secondary motion, richer NPC ambience and additional post-processing can be assessed later. They are not dependencies of this quality pass. Avoid camera shake, mandatory motion blur and expensive effects that undermine readability or low-tier performance.
