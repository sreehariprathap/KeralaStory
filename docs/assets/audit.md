# Asset intake audit

Updated 2026-09-14 from the files present in this repository. This is an
inventory of evidence, not an approval record.

## Present

| ID | Evidence | Status | Provenance |
| --- | --- | --- | --- |
| `traveler-procedural-preview` | `src/game/player/ExplorerAvatar.tsx` | Prototype | Original project code; explicitly not a rigged GLB |
| `bicycle-procedural-roadster-preview` | `src/game/vehicle/BicycleVisual.tsx` | Prototype | Original project code; explicitly not the approved bicycle model |
| `regional-details-prototype` | `src/game/world/RegionalDetails.tsx` | Prototype | Original project code; procedural spice and fishing details |
| `world-reference` | `public/assets/world-reference.jpeg` | Reference | Provenance and license not supplied |
| `world-reference-2000s` | `public/assets/world-reference-2000s.jpeg` | Reference | Provenance and license not supplied |

The manifest records these as `prototype` or `reference`; none is marked
`ready`. The reference images are concept material and do not satisfy an
environment asset approval gate.

## Open production work

- Supply three approved traveler appearances as an original or licensed GLB,
  using meters, Y-up, +Z forward, feet pivot, shared skeleton, and idle/walk/
  run/jump/fall/land clips without root drift.
- Supply the seated cycling pose and pedal animation, plus an approved
  roadster bicycle GLB with separate wheel transforms and documented wheel
  radius. The procedural bicycle is only a motion prototype.
- Supply the required environment kit: canopy homesteads and bridge dressing,
  paddy/spice groups, four Kadambode home exteriors, temple courtyard/tank,
  river/fishing props, six Kodaly facade variants, harbor/jetty/lighthouse.
- Provide collision proxies, LODs, texture/material budgets, standard-light
  review views, and authored footprints for each approved environment asset.
- Provide licensed period-appropriate ambience, footsteps, bicycle and UI
  sounds with source, license, looping/format metadata, and a loading failure
  fallback plan.
- Record source URLs or author statements, license text, dimensions, triangle
  and material counts, clip names, LODs, collision ownership, and review
  evidence before changing any record to `ready`.

No asset purchase, download, generated imagery, license inference, or GLB
approval is represented by this audit.
