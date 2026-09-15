# Implementation checks — 2026-09-14 scope

Checked 2026-09-15 in UTC from the shared workspace. This report records
source and command evidence; it does not mark the implementation backlog
complete.

## Automated checks

| UTC timestamp | Command | Result |
| --- | --- | --- |
| 2026-09-15T04:16:17Z | `npm run typecheck` | PASS |
| 2026-09-15T04:16:22Z | `npm test` | PASS — 20 files, 86 tests |
| 2026-09-15T04:16:26Z | `npm run build` | PASS — Vite production bundle generated |

Warnings and limits observed during these checks:

- `npm test` emitted the exact Three warning: `[THREE_CJS_DEPRECATED] DeprecationWarning: require("three") is deprecated and will be removed.`
- `npm run build` emitted the Vite warning: `Some chunks are larger than 1800 kB after minification.`
- The build reports `WorldCanvas-BBz0AUL0.js` at `3,215.16 kB` minified and `1,105.77 kB` gzip; this is above the documented chunk-size guidance.
- Automated tests do not prove a human-controlled full route on real hardware, browser compatibility, thermal behavior, or frame-time targets.

## Evidence currently available

Parent integration evidence includes Chrome screenshots of the entry scene,
native language selector, settings, bicycle mount/dismount, and touch-pad
activation at 844×390 landscape. Sprint-lock cancellation was observed after
movement from z=-458.874 to z=-427.992; pause/resume cleared the checkbox and
did not continue the previous intent. Compact map and pause controls were
accessible above the touch overlay. Pure input/router tests cover contact
ownership and cancellation.

## Implemented in source

- Four-region procedural world data, landmarks, route topology and authored
  walking detours, including spice-garden and both fishing-bank anchors.
- Desktop movement, camera, Rapier controller, bicycle motor/mount state,
  save migration, preferences persistence, map geometry and touch input
  lifecycle modules.
- English catalog plus blank Malayalam worksheet and locale-aware UI helpers.
- Responsive touch controls with movement pad, directional fallback buttons,
  look region, sprint lock, jump, brake and bicycle actions.
- Loading/error view components with honest indeterminate or known-count
  progress behavior.
- Procedural traveler, bicycle and regional scenery remain explicitly
  prototype details. `docs/assets/audit.md` records them as prototype or
  reference, not approved production assets.

## Pending release gates

- Approved original/licensed GLB traveler appearances, shared rig and six
  locomotion clips, seated cycling/pedal animation, and approved roadster GLB.
- Approved environment kit: canopy, paddy/spice, homes, temple/tank,
  river/fishing, six Kodaly facades, harbor/jetty/lighthouse; collision
  proxies, LODs, texture/material budgets and review views.
- Licensed period-appropriate ambience, footsteps, bicycle and UI audio with
  source/license metadata and failure fallback.
- Real multi-touch hardware test with simultaneous move/look/jump, orientation
  and capture-loss cases; the current evidence is Chrome UI plus pure router
  tests.
- Full current-browser matrix across Chrome, Edge, Firefox and Safari, plus
  nominated Android Chrome and iOS Safari devices.
- Thermal soak, repeated traversal, measured medium/low frame-time targets,
  cold/slow/failed loading, WebGL loss and repeated region-load disposal.
- Human full-route traversal in both directions on foot and bicycle. Existing
  Rapier/traversal tests are target-directed and do not substitute for a
  human route playtest.
- Accessibility validation at 200% zoom, bright/dark terrain contrast and
  device-specific safe-area layouts.

The implementation is therefore buildable and test-green, with the asset,
device, streaming/loading, performance and human traversal gates still open.

### Final integration verification

- Final code checks: `npm run typecheck` PASS; `npm test` PASS (**88 tests, 20 files**); `npm run build` PASS. Build still reports the large scene-chunk warning; this is not a performance acceptance pass.
- Chrome: simulated scene interruption showed the recovery UI without a pause overlay. Reload restored the rendered Kodaly harbor scene; a second interruption successfully returned to the title. This verifies the simulated recovery path, not actual WebGL context loss.
- Temporary Malayalam rendering fixture removed; translation worksheet remains blank. Test viewport reset, English and Auto controls restored, normal `/` URL restored.
- Final assets explicitly deferred by the user. See [free asset sources](../assets/free-sources.md) for options. Hardware/browser, streaming, performance and human full-route gates remain open.
