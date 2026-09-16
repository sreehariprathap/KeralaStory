# Kodassery Diaries v2.0 — implementation and review record

## Latest: expansion sign and route-surface corrections — 15 September 2026

A user-supplied screenshot of Athirappilly Upper View exposed two visual defects: the location-board support crossed its painted face, and the footpath paint competed with the vehicle-road paint at their junction. The shared board geometry now terminates its post below the board; the route renderer now suppresses only a foot trail's leading overlay while it remains inside a connected vehicle road's painted width. Terrain, collision and travel connectivity are unchanged.

Three focused visual-geometry checks, including the actual Athirappilly junction, pass. Full checks: `npm run typecheck` PASS; `npm test` PASS (480 tests / 84 files); `npm run build` PASS. Please recheck `http://127.0.0.1:5000/?inspect` → **Athirappilly — upper view** in a hardware-accelerated browser. This automation environment cannot render WebGL, so no post-fix visual approval is claimed.

## Latest: Athirappilly road grade correction — 15 September 2026

The follow-up screenshot showed the approach road visibly crooked/cut into the hill. The rendered ribbon was using coarse terrain samples even where the authored road centerline was 6 m higher. It now keeps the authored route elevation along the centerline and derives only the shoulder slope from nearby terrain. The underlying route and collision data are unchanged.

The new centerline-grade regression and the existing visual-geometry checks pass. Full checks: `npm run typecheck` PASS; `npm test` PASS (481 tests / 84 files); `npm run build` PASS. Please recheck **Athirappilly — upper view**; this automation environment cannot render WebGL, so visual acceptance remains pending.

## Latest: Chalakkudy location-board post correction — 15 September 2026

The first-street location boards now pass their actual deck height to the shared board component, so their support posts reach the foundation instead of beginning 1.25 m above it. `npm run typecheck`, `npm test` (477 tests / 83 files), and `npm run build` pass. This automation browser could not start the WebGL scene, so no rendered verification or Chalakkudy visual approval is claimed. Please still review `http://127.0.0.1:5000/?inspect` → **Chalakkudy — coffee street** for building scale, street proportions, porch arrival and walkability.

## Latest: Chalakkudy first street — 15 September 2026

User authorized continuation with “proceed.” First-street placement is provisional; no asset-yard visual approval is inferred. The supplied coffee shop now appears in Chalakkudy, accompanied by three modest procedural shops and two houses. This is not the complete Tier A town. Other new towns, Silver Storm and vehicle additions remain unfinished.

Review `http://127.0.0.1:5000/?inspect` → **Chalakkudy — coffee street**. Walk up the coffee forecourt, check its orientation/size beside the traveler and nearby houses, then follow the pedestrian lane back toward the town center/road. Interior is closed in this prototype. Please provide a street-level screenshot if scale, colors, roof shapes or entrance placement look wrong.

Luna provided canonical-center-relative placement data and four focused tests. Astra implemented exact triangle-based foundations, shared render/collision boxes and deck queries, merged procedural geometry, optional GLB adapter and inspection integration. A separate Astra read-only integration review found no blocking issue. All six footprints have zero terrain relief and are clear of roads/water. The actual Rapier capsule traverses the coffee ramp both ways without jumping; ramp ray heights agree with the shared deck query. Coffee collision extents are checked against extracted source geometry. World geometry version is `kodassery-diaries-v2-street-1`.

Street architecture is 1,020 merged procedural triangles plus the existing 15,884-triangle coffee asset. This is a geometry count, not a measured frame-rate claim. Optional GLB loading/failure keeps physical foundations and a visible fallback in place. No browser visual inspection performed: user owns looks/feel. Local game HTTP delivery returned 200; final full checks are recorded in the build log.

## Latest: V2-03 asset preparation review — 15 September 2026

Approved terrain checkpoint committed as `cb09c95`; user-added asset commit `ad0ec4c` preserved. The next review is `http://127.0.0.1:5000/v2-assets.html`. It is a development-only entry, like the layout review page, not a production game screen.

One selected model loads at a time with orbit/view controls, measured width/height/depth and scale references. Coffee presentation plane, fuel presentation/car/text/fence geometry and park navigation/camera/deep skirt geometry are removed from clones only. Legacy Bronco/park diffuse colors/textures are adapted to the current loader. Original files are untouched. Every model remains a prototype.

G2 is pending user review. Please verify coffee/fuel building sizes and colors, then vehicle orientation/scale. Park foundations and unrelated source-game props need further curation; Bronco paint/wheels and the rigged car's tall pose remain explicitly unresolved. Nothing has been inserted into the towns or car-spawn menu in this stage. Collision dimensions will not be frozen from unapproved source bounds.

HTTP page delivery returned 200; this is not a rendered visual acceptance. Final engineering checks: `npm test` PASS (473 tests / 82 files), `npm run build` PASS including workspace typecheck, `git diff --check` PASS. Initial checks exposed a test-only TypeScript annotation and a 5-second fixture timeout when loading all seven source files under the full suite; both were corrected. Development script/CSS transforms returned output successfully, but the standalone Vite transform harness exited 13 during shutdown; it is not counted as a clean command pass. User still owns actual rendered review.

## Latest: V2-02 terrain blockout — 15 September 2026

**User terrain/visual gate approved:** “Looks good, Commit this and proceed.” Approval covers the reviewed blockout, not future buildings, park or vehicles. Proceeding to V2-03 asset calibration.

- Shared render/collision terrain extends to Chalakkudy, Kodakara, Malakkappara and Silver Storm. All four development inspection destinations now have safe dry ground and are enabled; “planned site only” means buildings/park assets are still pending.
- Added graded access roads, riverbed cuts and downhill river surfaces from upstream through the existing waterfall into the downstream fork/outlets. Water queries and the atlas use the same river triangles. Old Kodaly harbor/lighthouse and original river/bridge are retained. New roads avoid new river crossings.
- Road endpoints/parking use sampled terrain. Fixed a north/west mesh seam and road junction access restriction during focused physical tests. Chalakkudy's access starts at the existing Chokkana road bend to avoid crossing that road at an incompatible height.
- Fresh checks: `npm test` PASS, **464 tests / 81 files**; `npm run build` PASS including full workspace typecheck. Added river geometry, dry ground/clearance, Rapier ray contacts, bidirectional walking on all four roads and uphill/downhill dynamic car tests. Focused traversal/terrain run: 11/11 PASS. Existing Three.js CJS and scene bundle-size warnings remain.
- Running local app HTTP check: **200** at port 5000. Actual rendered UI, river appearance, driving feel and performance have **not** been accepted; these belong to the user. No automated screenshot loop performed.
- Review at `http://127.0.0.1:5000/?inspect`: visit the four V2 sites, then inspect Athirappilly upper/lower views and drive the new roads. Please report gaps/floating water, awkward road grades/joins, or bad arrivals, with screenshots where helpful. Terrain is a blockout, not finished town/park art.
- World geometry version is now `kodassery-diaries-v2-terrain-1`; existing safe restore logic remains in use. Full v2.0 completion, dressing, supplied vehicles/picker, final branding and visual gates remain outstanding. The earlier sections below are historical stage evidence, superseded by this section where terrain availability differs.

Plan: [v2.0 delivery plan](../superpowers/plans/2026-09-15-kodassery-diaries-v2.md).

## Stage 1: spatial blueprint and asset inventory

**Status: G1 approved by user, 15 September 2026.** Following the inspection fast-travel update, the user replied “this looks right.” This accepts the current layout/site review, not future terrain, assets or vehicle behavior. All new safe spawns, collision, roads and town/park placement remain inactive until their implementation stages. Existing uncommitted expansion work is preserved on `feature/map-expansion`.

### Implemented

- Astra: typed town, road and connected river contracts in `src/contracts/worldV2.ts`; layout factory in `src/content/world/v2Layout.ts`; separate canonical `V2_LAYOUT` export. Existing live bounds/save version/landmarks are unchanged by this stage.
- Luna: standalone data-driven `/v2-layout.html` review page, seven focused spatial tests, and [seven-asset intake report](../assets/2026-09-15-v2-intake.md). Core reviewed the data/UI/test changes; corrected map orientation and a test that initially did not exercise factory mutation.
- Town tiers: Chalakkudy A; Kodakara B; Kodaly and Malakkappara C. Kodaly retains its harbor and lighthouse.
- Directed water: Malakkappara → Athirappilly → Chalakkudy → fork → main outlet and Kurumalippuzha → existing river/estuary. Existing river samples are reused exactly.
- Proposed footprint envelope including review margins: X −722 to 141 m, Z −822 to 258 m. The new downstream outlet requires an authored shore; an expanded rectangle is not itself traversable land.

| Proposed road | Control-polyline distance | Maximum segment grade |
|---|---:|---:|
| Malakkappara forest road | 260 m | 4.55% |
| Falls–Chalakkudy road | 450 m | 7.65% |
| Chalakkudy–Kodakara–existing village connection | 453 m | 7.50% |
| Silver Storm access | 309 m | 3.07% |

These numbers establish initial profile feasibility only. Rounded bends, road surface/collision, riverbank clearance, terrain seams, driving and panorama visibility require V2-02 and subsequent gates. New town/park heights are design targets, not validated safe spawn positions.

### User review G1

Open **http://127.0.0.1:5000/v2-layout.html** while the development server runs. The review page is a development entry; it is not part of the production game build.

Please judge these three choices:

1. Malakkappara upstream of Athirappilly, and the larger Chalakkudy / smaller Kodakara positions.
2. Silver Storm east/right of Kodassery summit, with the pool beside it.
3. The downstream fork joining Kurumalippuzha to the existing Kodaly river approach, retaining harbor/lighthouse.

User approval is recorded above. No screenshot was supplied. Fine building placement, materials, tire movement and driving feel belong to later review gates.

### Carryover and next work

The previous expansion source is ahead of its old status tables: terrain, mountain, forest, waterfall and visibility components exist, but full route acceptance remains open. Nine expansion place records still need canonical discovery/HUD integration in V2-08. MX-A1 and MX-L3 retain their earlier recorded completion; the other runtime gates remain Partial/unverified as described in the plan.

After G1, V2-02 constructs the actual shared river/road terrain; V2-03 asset extraction/calibration can proceed independently. The remaining blueprint-freeze checkbox in V2-01 stays open until terrain grounding and final anchors are ready. Runtime visual inspection is deliberately assigned to the user per the agreed workflow.

### Engineering checks

- Focused V2 layout tests: 7 passed (Luna).
- Integrated typecheck: PASS through `npm run build`'s required `npm run typecheck`, including all workspaces. Initial checks found tuple-type errors in the new test and an SVG visibility property in the review page; corrected before this pass.
- `npm test`: PASS, 452 tests / 78 files. Seven new layout tests also passed in a focused run. Subsequent changes were test type annotations and review-page label corrections; no terrain/physics behavior changed.
- `npm run build`: PASS. Existing ~3.30 MB WorldCanvas chunk warning remains; Three.js CommonJS deprecation warnings appear in tests. Neither is a measured performance acceptance.
- Local HTTP checks: review HTML and its TypeScript module both returned HTTP 200 on port 5000.
- Changed canonical definition passes `git diff --check`. Repository-wide check still reports pre-existing trailing whitespace in `src/game/world/KodasseryWorld.tsx:180`; unrelated user work was left intact.
- Browser rendering and all visual/feel acceptance: pending user review; HTTP/module delivery checks do not establish visual correctness.

## Development inspection fast travel

User requested fast travel for inspecting the expansion. Open `http://127.0.0.1:5000/?inspect` to enable the existing development panel.

- Existing twelve landmarks remain selectable, with their previous view offsets/headings.
- Nine mountain/forest/falls destinations are now selectable, using grounded expansion anchors, including summit, trailhead, Chokkana stops and Athirappilly upper/lower views.
- Malakkappara and Silver Storm are selectable as **planned site only**. They use current live terrain heights, not future blueprint elevations; the town/park assets are not built yet.
- Chalakkudy and Kodakara are listed but disabled because there is no current ground at their proposed centers. Kodaly remains accessible through its existing market/harbor/lighthouse entries.
- Luna implemented the typed destination catalog; Astra integrated the dropdown/reset flow. Selection closes menus and clears stale discovery text. The dropdown resets so the same destination can be selected again.
- Direct catalog validation: 25 unique records, nine expansion entries enabled, two grounded planned sites enabled, two unbuilt sites disabled. Actual in-game arrival and looks remain user verification.
