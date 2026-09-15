# Canonical region footprints — prototype handoff

`src/content/world/definition.ts` owns the world. `kodassery.ts` re-exports it for compatibility. Coordinates are meters, X east, -Z north, and position Y is feet height. Region metadata, landmarks, parking, safe spawns, river, coastline, routes, bridge and jetty footprints share those exports. These records are prototype navigation data, not approved art placements or proof of collider clearance.

## Regions and ownership

| Region | Z interval | Main ground/cycle route | Walking detours |
|---|---|---|---|
| Kodassery | -484 to -334 | `KODASSERY_PATH` | Canopy ascent at x8,z-434 to homestead x18,z-415; waterfall overlook remains existing landmark |
| Kadambode | -334 to -139 | `VILLAGE_PATH` | Paddy bunds, temple approach; spice garden x-8,z-226 approached from x-3,z-224 |
| Kurumali | -139 to -62 | Main wooden bridge, x12 | North fishing anchor x27,z-140 (approach on village side); south fishing anchor x-18,z-66 via bank z-58 |
| Kodaly | -62 to 92 | `CITY_PATH` | Harbor quay, narrow jetty, lighthouse exterior |

Terrain bounds remain x[-78,88], z[-484,92]. Map bounds extend east to x96.5 to include the existing jetty. The jetty exception must not expand the land collision envelope or permit walking into the surrounding sea. `getZoneAt` assigns each shared Z boundary to its southern region. Region bounds intentionally share their edge for map polygons.

The main bicycle corridor is ±3m from the polyline. Between the bridge approaches it narrows to ±1.5m from x12, matching a three-meter usable lane inside the four-meter deck. Jetty and offroute canopy/stair approaches reject cycling. This is route eligibility; physical collision still determines movement and clearance.

## Parking and safe restore

`PARKING_SPOTS` exports typed `{ id, zoneId, position, headingRad }` records. Origin parking is x1.3,z-460, within two meters of the explorer spawn. Further points serve canopy, village/tea shop, north bank, south bank and harbor. Safe spawn records refer to the same canonical positions.

`nearestParking(position)` uses horizontal distance and returns origin for nonfinite data. `safeGroundPosition(position)` projects valid land/deck coordinates onto their canonical feet surface plus 5cm; invalid coordinates and water without decks fall back to a named parking point. This helper does **not** prove building/foliage clearance and must be followed by collider validation after loading. It also intentionally normalizes arbitrary elevated saved positions rather than promising restoration onto unmodeled canopy platforms.

## Required integration fixes and validation

- Reset: accept the jetty outside terrain bounds only while its deck footprint and feet elevation are valid. `isOnWalkableDeck(x,z)` is a footprint check; `walkableDeckHeight(x,z)` supplies elevation. A footprint alone must not exempt submerged players from recovery.
- Map: use `MAP_BOUNDS`, region centers/labels and `COASTLINE` from the definition. Terrain continues to use `WORLD_BOUNDS`.
- Harbor: existing pier spans x77.5..96.5,z74.25..77.75, top y8.5. The quay top is roughly y7, with a wall at x77..79. Implemented a shared physical ramp x70..77.5 reaching the pier, and a wall gate at z73.7..78.3. A separate south quay ramp z89..85 fixes the reverse main-route blockage found at z86.28.
- Bridge: existing north ramp runs z-146..-122 and south ramp z-64..-55 at x12. The main route now stays x12 through z-55 to match the south ramp, then bends toward x16,z-48. Actual Rapier walking and bicycle-envelope traversal pass both ways.
- Spice garden: x-8,z-226 is outside the authored house footprints and beside the road; reserved approach is x-3,z-224 to x-8,z-226. Add actual pepper/cardamom planting later without blocking that approach. Preserve existing discovery IDs including `tea-shop`.
- Both fishing approach polylines are planning anchors. Add the second scene fishing identity/figures later; no extra completed scene is claimed.
- Waterfall stream-to-river continuity remains an art/terrain integration task. No new stream mesh or water polygon was fabricated during this handoff.
- A bicycle collider also exposed a tea-shop obstruction at x39.64,z47.49. The canonical city route now runs [38,43] → [36,58] → [47,68], and the rendered road follows it.
- Player steering, render/map overlays, full detour access and real-device checks remain unmeasured. Headless traversal confirms main-spine collision clearance and pier access, not all gameplay or all art milestones.

## Validation evidence

`npm test -- tests/traversal.test.ts tests/world-topology.test.ts tests/controller.test.ts tests/physics.test.ts`: **27 passed**, including the final bicycle acceleration and route-eligibility extension (21:09, 14 September 2026).

Topology samples every main-route segment at spacing ≤1m for bicycle eligibility; checks all four regions have parking/safe spawn metadata, mount range, legacy reference compatibility, all original topology tests and landmark IDs, new spice anchor, water rejection, bridge/pier restoration and map extent.

Traversal uses the **exact** `terrainMeshData('north'|'south')` arrays that render terrain and `buildArchitecture().colliders` from the scene's buildings, shops, bridge and harbor. It drives the real Rapier motor at 60Hz from origin to the south end of `MAIN_PATH` and back without safe reset. A separate pier route goes from x70 to x96,z76 and back. The bicycle case uses Cuboid(.38,.84,.95), rotated by heading, and `stepBicycle` acceleration to 9m/s, with `isCycleAllowed` checked before every intended step. Headings are guided directly toward polyline points to isolate clearance; this is explicitly **not** proof of real user steering. North canopy structure colliders are outside the tested spine and not included; the tests do not claim canopy detour completion.

`traversalBoxes()` returns shared full-size box recipes `{id,position,size,rotation}`; renderer assembly converts to collider half-extents. `buildArchitecture().colliders` already contains half-extents. `terrainMeshData()` returns vertices/triangle indices plus grid dimensions. Shared ramp centers offset along the normal so authored endpoints correspond to top surfaces.

Final full workspace typecheck/build and actual running UI inspection belong to the integrator after concurrent App/sign work is complete. Earlier transient SaveV1/SaveV2 and pending-module errors are not final results.
