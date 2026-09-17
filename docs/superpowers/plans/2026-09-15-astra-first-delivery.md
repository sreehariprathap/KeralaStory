# Astra-first V2 and multiplayer delivery

> Execute the existing V2 and multiplayer plans with their acceptance criteria. This ledger orders that work; it does not replace the specifications or assert completion.

**Goal:** Complete the authorized V2 and invite-only multiplayer scope, prioritizing core engineering and using Luna only for small tasks against demonstrated interfaces.

**Architecture:** The canonical solo world remains the source for server collision. Server authority, client lifecycle and world/vehicle integration remain Astra-owned. Existing solo profile/save behavior and user map-art changes are preserved.

**Specifications:** [V2](2026-09-15-kodassery-diaries-v2.md), [multiplayer plan](2026-09-15-ten-player-multiplayer.md), [multiplayer design](../specs/2026-09-15-ten-player-multiplayer-design.md).

## Scope and evidence

- The current request explicitly authorizes multiplayer, superseding the older no-multiplayer guardrail for this work.
- No accounts, public matchmaking, database, quests or deployment are added.
- Work in the current feature checkout so latest world data and user changes are preserved. The older multiplayer worktree is not the integration target.
- Existing user changes at start: `src/app/App.tsx` atlas illustration, `public/assets/kerala-story-map.png`, untracked `public/assets/v2-famtasymap.jpeg`.
- L01 files already exist; verify rather than repeat the assignment. L03/L04 are also implemented. A03 simulation and server entry are empty exports at start.
- Crooked-road authored centerline correction is already recorded and implemented; its visual recheck is pending.
- G2–G7 visual/feel approvals, device review and user acceptance cannot be inferred from code, tests or silence. Continue independent engineering while those gates await feedback.
- User G2 response this session: coffee shop and fuel station size/palette approved; park and Bronco remain pending review. This permits their dependent placements, not blanket approval of other assets.
- No broad Luna delegation. One small task at a time only when its dependency has passed review.

## Execution order

| Order | Core deliverable | Existing task IDs | Bounded follow-up |
|---|---|---|---|
| 1 | Canonical colliders, deterministic player simulation, admission/reconnect and 60/20 Hz server loop | A03–A06 | Verify L01; L02 only after replay API is stable |
| 2 | Asset preparation, explicit selectors and calibrated vehicle dimensions/wheels | V2-03, V2-06 | G2 review yard; G5 dynamic wheel/feel review |
| 3 | Network client, reconciliation, passive avatars and room mode ownership | A07–A10 | L05 after controlled roster/code props exist |
| 4 | Shared vehicle authority, seats, dismount and passive visuals | A11–A12 | L06 after vehicle DTO/dimensions exist |
| 5 | Towns/park/stops, picker preview/spawn, landmarks and save recovery | V2-04–V2-08 | Picker UI/placement data only if useful; respect G2–G6 |
| 6 | Chat service, focus safety, room recovery and transport hardening | A13–A14 | L07 then L08 against frozen callbacks/text keys |
| 7 | Mountain/falls/panorama route review and measured fixes | V2-09 | User G7 review |
| 8 | Regression, browser/device/accessibility, soak/chaos and release evidence | V2-10, A15–A17 | L09 metrics normalizer after export format is stable |

Core tasks may proceed across independent tracks, but only one writer owns App, WorldCanvas, contracts and package configuration. Simulation work writes only its package and new pure data exports; room integration writes server files. Visual duplication remains gated by the V2 plan.

## Progress

- [x] Audit existing plans, user changes and multiplayer foundation files.
- [x] Verify existing protocol/client helper baseline: 59 tests in 10 files passed.
- [x] A03/A04 canonical simulation and replay (authoritative movement, reset, replay checksum and parity coverage integrated).
- [x] A05/A06 server admission and loop (room admission, reconnect, 60/20 Hz loop, patches and lifecycle coverage integrated).
- [ ] Remaining ordered deliverables above (V2 dressing/cars are partial; network client, picker/spawn, save migration and final gates remain).
- [x] Integrated typecheck/test/build and running UI inspection for this continuation; mobile/device and hardware-accelerated 3D acceptance remain open.
- [ ] User gates and hardware/release evidence.

Record measured results and precise gaps in `docs/06-build-log.md`; never convert implementation presence into visual or release acceptance.
