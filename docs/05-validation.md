# Validation and expansion

> Validation update: [06-build-log.md](06-build-log.md) records current failures and checks. [08-complete-app-plan.md](08-complete-app-plan.md) adds mobile, cycling and language acceptance gates. The original planning-only statement at the bottom is historical.

## Repeatable playtest

Use the same route for correctness and performance: spawn overlook → canopy bridge → waterfall overlook → Kadambode paddy loop → temple courtyard → spice garden → main river bridge → Kodaly street loop → harbor jetty → lighthouse → walk back to origin.

Record build ID, hardware, OS, browser version, viewport, device pixel ratio, quality, cold/warm cache, loading throttle, and median/p95 frame time. Capture fixed-camera screenshots at the four region entrances and bright/dark HUD test positions. All targets in the architecture document are unmeasured until this procedure runs.

## Release checklist

| Area | Required evidence |
|---|---|
| First visit | Clean storage → create named avatar → real progress/loading → safe origin; form validation and all presets verified |
| Movement | Walk/run/jump at 30/60/120 render rates where available; consistent speed; wall, stair, slope, bridge and ground contact correct |
| Camera | Orbit against wall/canopy/bridge; no geometry penetration, stuck zoom or abrupt unrequested spins |
| Region connection | Walk both directions through all four regions; no reload, missing border collision, unexpected teleport or invisible barrier on the main route |
| Water/falls | Deep water/drop resets to grounded safe point; shallow banks readable; no accidental second main-river crossing |
| Map | Corners/center and all landmarks project correctly; waypoint hit testing after pan/zoom; player heading agrees with north; keyboard landmark alternative |
| HUD | Long profile names, 200% zoom, compact viewport; no overlap; labels readable over bright water and dark forest |
| Input | M/Escape/Resume, pointer denied, pointer lost, tab switch, focused form and modal close all clear held movement; no cursor trap |
| Saves | Continue, reload, settings changes, invalid coordinate, obsolete world, malformed/future save, denied storage and explicit reset |
| Loading | Cold/slow network, failed essential asset, missing decorative asset, retry, return to title, context loss; no blank unrecoverable screen |
| Accessibility | Keyboard menus/focus, visible controls, labels/contrast, reduced motion, mute, status announcements; no color-only markers |
| Performance | Warm route frame timings, cold first-play timing, draw calls and triangles, repeated round-trip memory trend; all supported desktop browsers smoke tested |
| Art | Actual rigged anime avatar; cohesive shading/scale; required region identities, working-harbor ambience, approved UI and reference views |

Automate pure projection, data validation, persistence recovery, once-only discovery behavior, and application lifecycle flows. Use a real-browser movement check and manual art/physics playtests; screenshots and headless tests alone cannot certify camera feel or GPU performance. Do not add brittle pixel-perfect tests of changing scenic art.

Release blockers: cannot enter/continue, missing save without recovery, repeated movement/camera failures, inaccurate navigation, inaccessible bridge, unloaded ground, input trapping, critical asset load failures without exit, unreadable HUD, or performance below the low-tier target on the nominated test device. Report cosmetic issues separately with screenshots.

## Key risks and responses

| Risk | Response and decision point |
|---|---|
| “3D anime” becomes unrelated asset styles | Approve one avatar + small environment kit in the same lighting before buying/making every asset |
| Four-region scope becomes empty terrain | Finish a measured graybox loop before dressing; compress travel distance before adding filler |
| Canopy and terrain traversal conflict | Separate platform colliders from terrain; test multi-level paths in the first slice |
| Browser load and foliage cost | Instancing, LOD, capped pixel ratio, neighboring detail loading; profile early in W01 and again in W03 |
| Reference image cannot track player accurately | Derive functional map from authored world data; keep perspective image as concept/entry art |
| Local profile mistaken for an account | Entry copy states saved on this device; cloud identity is a later separately scoped feature |
| Small models change core systems | Explicit file boundaries and frozen interfaces; integrator owns composition and reviews each handoff |
| No usable 3D art production path | A01/A03 remain open; deliver asset briefs and provenance plan, not a false completed anime milestone |

## Region expansion contract

Before a new region is implemented, create a short region brief with:

1. Purpose, geography, palette variation within the shared style, two or three landmarks, and traversable footprint.
2. North-up position, height range, neighbor IDs, entry/exit connections, river/road topology, safe spawns, and route timing.
3. Approved asset IDs and budgets, collision plan, ambience preset, LOD/loading behavior, and distant silhouette.
4. Map polygons/routes/landmarks sourced from the same world definition.
5. A fixed-camera art comparison and traversal/performance evidence.

Use the existing data schema when possible. Review extensions centrally and migrate saves when IDs or spawns change. A region cannot privately redefine movement speed, avatar scale, global sun, map projection, input bindings, fonts, materials, or save format.

## Adding quests later

The exploration foundation emits stable `zoneEntered` and `landmarkDiscovered` events. Keep those events independent of quest state. Later, define quest data with stable IDs, prerequisites, objectives, rewards only if needed, dialogue references, and a versioned save extension.

First quest candidate: speak to a river keeper, visit a fishing bank, then return. Prototype it without blocking the bridge or replacing free exploration. If a later story deliberately closes the crossing, provide clear player feedback and test save/resume on both banks.

Do not build a quest engine, dialogue editor, economy, inventory, combat system, or speculative multiplayer network layer now. Add each only with its own behavior brief and testable acceptance criteria. The same style bible and task boundaries continue to apply.

## Planning package verification

The workspace was empty when planning began. This package defines proposed behavior and tasks only. No runtime, rigged assets, screenshots of a built game, browser compatibility results, or performance measurements are claimed. Verify the plan's internal links and task dependencies now; execute runtime checks when the corresponding code exists.
