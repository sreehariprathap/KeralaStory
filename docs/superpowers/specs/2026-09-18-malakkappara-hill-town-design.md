# Malakkappara hill town and tea estate — design

Date: 2026-09-18 · Branch: `feature/map-expansion` · Status: all three phases built (2026-09-19)

## Goal

Malakkappara should read as a busy hill-station tourist town (colourful stacked shop-houses and
homes on the slopes, as in Ooty/Munnar) set in tea estates that look like real Kerala highland
plantations: tightly clipped contour rows, dark gaps between them, silver oaks, red-earth paths.
Roads are tarred and marked. Nothing floats, no terrain lips, no raw sheer banks.

## Today

- Town: `V2_LAYOUT.towns` `malakkappara`, a 120 × 130 m pad levelled to y ≈ 82
  (x −615…−495, z −755…−625). Eight plain box houses from `TOWN_BUILDINGS` (`v2Dressing.ts`).
- Roads: `malakkappara-road` enters from the south to the town centre (−555, −680);
  `chalakudy-dam-road` leaves east and climbs round the valley head to the dam crest.
  Both are graded (`GRADED_SIDE_ROADS`). Road ribbons carry no paint.
- Tea: `teaEstate.ts` offsets 17 rows each side of the dam road; `TeaEstate.tsx` draws them as
  smooth tubes, with sphere-on-stick shade trees. Road cuts leave bare near-vertical grass banks.
- River: `malakkappara-river` runs north–south ~50 m west of the pad (x ≈ −690…−665).
  The west bank is a flat plain at y ≈ 73–75 (x −800…−715).

## Approach

Reuse the Chalakkudy city kit: a pure-data town module emits `CityPiece`s (boxes merged per
material by `createCityGeometry`), `TraversalBox` colliders, `CitySign`s and `CityPaint` strips.
One component renders it in ~5 draw calls. Rejected: GLB building packs (too few varied,
colourful Indian hill-town houses; heavier), and extending `TOWN_BUILDINGS` (too plain).

## Phase 1 — tea estate, road markings, clean edges

1. **Tea rows** (`teaEstate.ts`, `TeaEstate.tsx`)
   - Hedges become chains of overlapping rounded bush domes (width/height jitter per bush), a
     dark soil strip between rows, bright new-leaf crown, darker skirts.
   - More rows (band ≈ 40 m each side), still contour-following offsets of the road, still
     clear of roads/water/town/steep ground. The same generator plants along any road listed in
     a `TEA_ROADS` set (dam road now; the new estate roads in Phase 2).
   - Silver oaks: tall slim trunks, sparse small crown tufts up the upper third.
   - Picker paths: winding red-earth tracks through the rows (dirt ribbons, no collision change).
2. **Retaining walls**: where a graded road or the town pad meets ground more than ~1.5 m
   above/below within a few metres, a dry-stone wall mesh along the cut (visual + collider).
3. **Road markings** for two-lane roads (`malakkappara-road`, `chalakudy-dam-road`, all new town
   roads, the bridge): dashed white centre line, solid white edges, gaps at junctions/caps.
   Built with the existing `createPaintGeometry`.

## Phase 2 — the town on both sides of the main road

- Town footprint grows to cover the main road's approach and the dam-road start; the pad keeps
  its level, hillside lots follow the terrain on plinths.
- **Bazaar**: 2–3 storey shop-houses both sides of the main road and the dam-road start. Palette
  yellow, orange, lime, pink, sky blue, cream; flat roofs with black water tanks or tiled hip
  roofs; rolling shutters, awnings, bilingual signboards (Tea & Spices, Homemade Chocolates,
  Bakery, Textiles, Pharmacy, Lodge, STD Booth, Hotel).
- **KSRTC bus stand**: bay beside the main road, shelter, benches, timetable board, parked bus.
- **Hillside homes**: terraces stepping up the slopes behind the bazaar. Built change: they are
  reached by three stone stairways, not tarred side streets — the slope climbs 30 m in 45 m, so a
  street would need a 60 % grade against the layout's 10 % limit. The tarred, tea-lined climb is
  the dam road above them.
- **Hotels**: Hotel High Range, Tea County Inn (3 storeys). **Resort**: Misty Hills Resort,
  cottages on the hill facing the river and dam.
- The existing tea-stop, house and frontage entries in `TOWN_BUILDINGS` for Malakkappara are
  replaced by the town module.

## Phase 3 — west bank

- **Bridge**: two-lane `beam` bridge (`CHALAKKUDY_BRIDGES` list, which already drives deck,
  underside dig, abutments and ceiling) from the town's west edge to the west bank.
- **West-bank district**: levelled district pad (own y, like `chalakkudy-east`), a riverside road,
  homestays, houses, a riverside resort.
- **Malakkappara Botanical Garden** (~45 × 35 m): gate + signboard, flower beds (existing flower
  assets), gravel paths, small glasshouse, fountain, benches.

## Invariants and tests

- Every building sits on a plinth reaching its lowest ground sample; no lot overlaps a road
  (with kerb margin), water, another lot, or the tea band.
- Road grades ≤ 12 %; every new road ends on another road or a turning cap.
- Bridge deck ≥ 2 m above the river surface; no terrain above the deck line.
- Tea rows stay clear of roads, water, lots and paths.
- Tests follow the existing `tests/*.test.ts` patterns for Chalakkudy and the tea estate.

## Performance

Town geometry merged per material; signs are small canvases. Low tier: hedge sampling halves and
the hedge profile drops from seven points to five. The town itself is drawn at every tier: it costs
five draw calls, so thinning it would not buy anything.

## Verification

In-game screenshots after each phase (town, estate, bridge, garden; medium and low tiers),
`npm run typecheck`, `npx vitest run tests`.
