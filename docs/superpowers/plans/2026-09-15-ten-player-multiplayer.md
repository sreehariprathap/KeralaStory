# Ten-player private-room multiplayer implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` to execute this plan one task at a time. Each Luna task is a fresh, bounded handoff; an Astra integrator must review and merge it before its dependants start.

**Goal:** Add an authoritative, ephemeral, invite-only Colyseus room service that lets up to ten guests explore the current connected Kerala world, use shared cars/bicycles, and chat safely without changing solo persistence.

**Architecture:** A Node/Colyseus process owns all admission, state, Rapier stepping, player/vehicle decisions and chat acceptance. The Vite client sends intent, predicts only its own walking presentation, and renders immutable replicated snapshots for remote players and all shared vehicles. Existing browser Rapier controllers remain solo-only reference behaviour; shared pure math/world data is extracted rather than synchronizing the browser physics world.

**Tech stack:** TypeScript, pnpm/npm workspaces, Colyseus server/client, server-safe `@dimforge/rapier3d-compat`, Zod, React 19, R3F, Vitest, Playwright (added only after the M0 compatibility spike).

**Spec:** `docs/superpowers/specs/2026-09-15-ten-player-multiplayer-design.md`

## Global constraints

- Read `docs/02-design-bible.md`, `docs/03-architecture.md`, `docs/07-kerala-2000s-direction.md`, this plan, and the named task files before editing.
- The existing four-region world is a prototype. Do not claim it is four-region multiplayer playable until the M1 route evidence exists.
- No accounts, database, Redis, public discovery, quests, cross-room travel, multiplayer saves, voice, NPC synchronization, or client authority.
- Room capacity is exactly 10; room codes are normalized restricted-alphabet, eight-character unlisted invitations, not secrets.
- Simulation is 60 Hz; patches are 20 Hz; input is 20–30 Hz while changed plus 5 Hz heartbeat; remote render buffer is 100 ms and extrapolation never exceeds 250 ms.
- Simulation code has no React, R3F, DOM, `window`, browser storage, GLTF, or Three.js imports. Network/UI code must not mutate Rapier bodies for remote guests.
- Retain disconnected guests and occupied seats for 60 seconds; close empty rooms after five minutes; keep only 100 in-memory chat messages.
- Use shared UI tokens and accessible DOM controls. Chat text is plain text only, maximum 280 graphemes, maximum four accepted messages per ten seconds, and typing clears gameplay input.
- Preserve all existing local save/profile behavior. Reconnect tokens live only in `sessionStorage`, never URLs or saves.
- Core physics, camera/input lifecycle, terrain/collider extraction, package/workspace changes, server integration, and app composition are Astra-owned. Luna receives only the bounded tasks marked **Luna** below.
- Before each merge run the task's focused test. Before each milestone handoff run `npm run typecheck`, `npm test`, and `npm run build`; inspect the running UI and record actual results in `docs/06-build-log.md`.

## Locked file structure and contracts

| Area | Responsibility |
| --- | --- |
| `packages/protocol/src/` | Zod DTOs, message constants, compact wire types, code/text normalization; no server or React imports. |
| `packages/simulation/src/` | Canonical collider recipe, fixed-step world, pure movement/seat/dismount rules, deterministic replay support. |
| `apps/server/src/` | Colyseus bootstrap, room admission/lifecycle, authoritative simulation loop, patch projection, metrics/logging. |
| `src/features/multiplayer/` | Lobby, room status/roster, chat DOM UI, local mute and accessible user feedback. |
| `src/game/network/` | WebSocket lifecycle, intent sender, snapshot buffering, local reconciliation; no remote-body mutation. |
| `src/game/player/` | Solo controller remains intact; multiplayer local/remote visual adapters consume snapshots. |
| `src/game/vehicle/` | Solo motors remain intact; multiplayer visual adapters consume server vehicle/seat snapshots. |

The Astra foundation tasks must export these names before a Luna task begins:

```ts
// packages/protocol/src/messages.ts
export type RoomCode = string;
export type GuestId = string;
export interface TransformDto { position: [number, number, number]; headingRad: number; velocity: [number, number, number] }
export interface ReplicatedPlayerDto { id: GuestId; displayName: string; appearance: AvatarAppearanceDto; transform: TransformDto; travel: TravelDto; connected: boolean; lastProcessedInput: number }
export interface ReplicatedVehicleDto { id: string; kind: 'car' | 'bicycle'; modelId: string; transform: VehicleTransformDto; controls: VehicleControlsDto; seats: Partial<Record<SeatId, GuestId>> }
export interface RoomSnapshotDto { phase: 'waiting' | 'playing' | 'closing'; worldVersion: string; players: ReplicatedPlayerDto[]; vehicles: ReplicatedVehicleDto[]; roster: RoomRosterEntryDto[]; serverTimeMs: number }

// src/game/network/snapshotBuffer.ts
export interface TimedSnapshot<T> { serverTimeMs: number; value: T }
export function sampleSnapshot<T>(samples: readonly TimedSnapshot<T>[], renderTimeMs: number, interpolate: (older: T, newer: T, alpha: number) => T): T | null;
```

## Dependency and handoff order

```text
A01 → A02 → A03 → A04 → A05 → A06
                    ├── L01 → L02 → A07
                    ├── L03 → A08
                    └── L04 → A09
A06 → A10 → L05 → A11 → L06 → A12 → L07 → A13
A12 → A14 → L08 → A15 → L09 → A16 → A17
```

Luna work is deliberately not parallelized unless its dependency is merged and the writable paths are disjoint. No Luna handoff may edit `package.json`, `package-lock.json`, workspace configuration, `src/app/App.tsx`, `src/app/WorldCanvas.tsx`, simulation code, server room code, or shared contracts.

## Tasks

### A01 — compatibility spike and workspace boundary (**Astra**)

**Files:** modify `package.json`, `package-lock.json`, `tsconfig.json`; create workspace manifests plus `packages/protocol/`, `packages/simulation/`, `apps/server/`, `tests/multiplayer/compatibility.test.ts`.

**Deliverable:** Pin mutually compatible Colyseus server/client and server Rapier packages. Prove a Node-only test can construct and step Rapier and a Colyseus client can receive a patch. Configure root typechecking so client and workspace code compile without leaking DOM types into the server.

**Acceptance:** focused compatibility test passes; `npm run typecheck`, `npm test`, and `npm run build` pass; versions and commands are written to the build log. Do not let a Luna agent perform this task.

### A02 — protocol source of truth (**Astra**)

**Files:** create `packages/protocol/src/{index,messages,schemas,constants,text}.ts`, `packages/protocol/tests/{schemas,text}.test.ts`.

**Deliverable:** Define Zod-validated DTOs and event-name constants for `input`, `enterVehicle`, `exitVehicle`, `chatSend`, `ready`, `leave`, `ping`, `roomSnapshot`, `roomError`, and `chatAccepted`. Use tuple vectors, finite numbers, monotonic input sequence validation, axes in `[-1,1]`, known action keys only, and small explicit payload maxima. Export `normalizeRoomCode`, `createRoomCode`, `sanitizePlainText`, and `countGraphemes`.

**Tests:** reject control/bidi characters, HTML-like input, an unknown event, non-finite vectors, a ninth room-code character, and input axis `1.01`; accept a normalized lower-case code and a 280-grapheme Malayalam message. Keep text policy deterministic by using `Intl.Segmenter` with a documented fallback.

**Acceptance:** package tests pass and all consumers import types from `@kerala-story/protocol`, not `src/contracts`.

### A03 — canonical server collider recipe and deterministic step (**Astra**)

**Files:** create `packages/simulation/src/{index,worldDefinition,staticColliders,fixedStep,playerRules,spawnRules}.ts`, `packages/simulation/tests/{worldDefinition,fixedStep,spawnRules}.test.ts`; modify only pure data exports in `src/content/world/definition.ts` or `src/content/world/kodassery.ts` as needed.

**Deliverable:** Extract a canonical data-only world definition from existing terrain, bridge, quay, jetty, safe-spawn, parking and water rules. Assemble static Rapier colliders server-side from that definition; no JSX/collider scraping. Provide `createSimulationWorld(world)`, `stepSimulation(world, dt)`, `findSafeSpawn`, and `findSafeDismount`.

**Tests:** server world creates all static colliders; each named spawn is grounded and clear; a bridge/jetty surface is retained; invalid/falling positions reset rather than enter water. A fixed 600-step run produces the same rounded checksum twice in one Node process.

**Acceptance:** no browser import in the simulation dependency graph; document any unavoidable physics non-determinism and use replay tolerances only at the final serialized precision.

### A04 — authoritative player state and replay harness (**Astra**)

**Files:** create `packages/simulation/src/{playerSimulation,replay}.ts`, `packages/simulation/tests/{playerSimulation,replay}.test.ts`.

**Deliverable:** Turn validated `InputDto` records into player state in the fixed server world. Ignore client coordinates/timestamps, sequence duplicates, and disallowed actions. Emit the last processed sequence so a client can reconcile. Add a headless two-guest replay fixture with join, movement, disconnect, reconnect and checksum output.

**Tests:** ordered movement advances only from input; duplicate/out-of-order sequences do not move a player; reconnect reuses state; two identical scripted replays produce identical DTO checksum.

**Acceptance:** browser `ExplorerController` and its Rapier body are not imported.

### A05 — room bootstrap, admission, and lifecycle (**Astra**)

**Files:** create `apps/server/src/{index,config,KeralaRoom,roomRegistry,admission,metrics}.ts`, `apps/server/tests/{admission,roomLifecycle}.test.ts`, `.env.example`.

**Deliverable:** Start a single in-memory Colyseus process with origin allow-list, frame-size configuration and structured non-chat-body logs. Create/join by normalized code; issue server guest ID and opaque reconnect token; enforce 10 connected-or-grace guests; retain disconnected state for 60 seconds; dispose empty rooms after five minutes.

**Tests:** create returns eight-character code; tenth guest joins; eleventh receives `ROOM_FULL`; malformed/stale token cannot reclaim a guest; valid token reclaims exactly one guest; empty room moves to close after fake-clock expiry.

**Acceptance:** token is never part of a URL or snapshot; server restart is detectable by clients as a room-ended condition.

### A06 — server simulation loop and compact patch projection (**Astra**)

**Files:** modify `apps/server/src/KeralaRoom.ts`; create `apps/server/src/{roomState,patchProjector,inputQueue}.ts`, `apps/server/tests/{inputQueue,roomPatches}.test.ts`.

**Deliverable:** Run simulation on a capped 60 Hz fixed accumulator and project only compact DTO state at 20 Hz, with immediate patches for admission/disconnect/mount/dismount/chat. Reject an incompatible `worldVersion` before state admission. Record rolling metrics: active guests, joins/reconnects, rejected input/chat, patch size, tick duration, RTT, occupancy and close reason.

**Tests:** a client cannot set position by message; 60 simulated ticks result in 20 patch opportunities; known world version joins and mismatch returns `WORLD_VERSION_MISMATCH`; metrics exclude chat text.

**Acceptance:** median/p95 tick and patch instrumentation is queryable in test; no Three/R3F assets are sent.

### L01 — protocol fixture catalogue (**Luna**)

**Dependencies:** A02 merged. **Allowed files:** create `packages/protocol/tests/fixtures.ts`, `packages/protocol/tests/messages.fixtures.test.ts` only.

**Deliverable:** Add reusable valid and invalid DTO fixtures for all C2S and S2C schemas, including Unicode names, maximum message, seats, transforms, patch snapshot and error replies.

**Tests:** table-driven `safeParse` assertions name the rejected field and expected protocol error. Add no production code and do not alter schemas.

**Handoff prompt:** “Implement L01 only. Read A02 exports. Edit exactly the two allowed fixture/test files. Do not change protocol production files or dependencies. Return changed paths and `npm test -- packages/protocol/tests/messages.fixtures.test.ts` result.”

### L02 — deterministic replay reports (**Luna**)

**Dependencies:** A04 merged. **Allowed files:** create `packages/simulation/tests/replayScenarios.test.ts`, `docs/validation/multiplayer-replay.md`.

**Deliverable:** Use existing replay exports to add named two-player scenarios: walking apart, duplicate input, disconnect/reconnect and safe-spawn reset. Document checksum, step count and expected result format without changing the simulator.

**Tests:** each named scenario executes twice with equal checksum and asserts the specific final ownership/connection state.

**Handoff prompt:** “Implement L02 against existing `replay` exports only. Do not modify `packages/simulation/src`. Use fake time, not sleeps. Report focused Vitest output and the four recorded scenarios.”

### L03 — lobby form parsing and session token storage (**Luna**)

**Dependencies:** A02 merged. **Allowed files:** create `src/features/multiplayer/{lobbyModel,sessionToken}.ts`, `tests/multiplayer/{lobbyModel,sessionToken}.test.ts`.

**Deliverable:** Parse pasted room code/share URL with `normalizeRoomCode`; expose `LobbyMode`, `LobbyViewState`, and a sessionStorage-only token repository keyed by room code. Handle absent/disabled storage with an explicit recoverable result.

**Tests:** lower/mixed-case code and URL normalize; malformed URL/code produces a specific validation result; token is scoped to code, removable, never serializes profile data, and storage exceptions are surfaced.

**Handoff prompt:** “Implement L03 in the four allowed files. Consume `@kerala-story/protocol`; do not edit App, server, persistence repositories, or package files. Use Vitest mocks for storage.”

### L04 — snapshot interpolation utility (**Luna**)

**Dependencies:** A02 merged. **Allowed files:** create `src/game/network/{snapshotBuffer,transformInterpolation}.ts`, `tests/multiplayer/{snapshotBuffer,transformInterpolation}.test.ts`.

**Deliverable:** Maintain time-ordered bounded snapshot samples. Interpolate Vec3/heading/quaternion at a 100 ms buffer; return the newest snapshot only for gaps up to 250 ms and `null` after that. Heading interpolation takes the shortest arc.

**Tests:** exact sample, midpoint position, angle crossing ±π, reordered packet rejection, capacity eviction, 249 ms hold, and 251 ms null.

**Handoff prompt:** “Implement L04 as pure TypeScript. Do not import React, Three, Rapier, sockets, or mutate game bodies. Expose `sampleSnapshot` exactly as specified in this plan.”

### A07 — client room connection, intent sender, and local reconciliation (**Astra**)

**Files:** create `src/game/network/{roomClient,inputSender,reconciliation,networkTypes}.ts`, `tests/multiplayer/{roomClient,inputSender,reconciliation}.test.ts`.

**Deliverable:** Own Colyseus client lifecycle, ready/leave/ping and reconnect token exchange. Send changed inputs at ≤30 Hz plus 5 Hz heartbeat, clear input when chat/menu gains focus, and reconcile self walking to server `lastProcessedInput`; blend corrections over 100–180 ms when beyond 0.35 m/20°, with a clear safety-reset status.

**Tests:** sender clamps frequency and includes monotonic sequence; server ack clears only acknowledged pending inputs; small error blends; large error uses bounded blend; safety reset snaps and announces. No remote body is ever addressed.

### A08 — multiplayer player visual adapters (**Astra**)

**Files:** create `src/game/player/{MultiplayerLocalAvatar,RemoteExplorerAvatar,remoteAnimation}.tsx`, `tests/multiplayer/remoteAnimation.test.ts`; modify `src/app/WorldCanvas.tsx` only after standalone visual test harness works.

**Deliverable:** Render remote avatars from sampled snapshots and velocity/grounded/travel state, without `RigidBody` or `CharacterController`. Use existing `ExplorerAvatar` assets. Local multiplayer rendering accepts reconciliation output rather than browser physics authority.

**Tests:** remote state has no physics body; foot/vehicle animation selections match snapshot state; disconnected guest remains visibly marked until grace expiry.

### A09 — lobby and room-status UI (**Astra integration + L05**)

**Astra files:** create `src/features/multiplayer/MultiplayerEntry.tsx`, `src/features/multiplayer/multiplayer.css`; modify `src/app/App.tsx`, translations. Integrate `Play together`, create/join/error/waiting/full/room-ended states without altering solo start/save behavior.

### L05 — room-code and roster presentational controls (**Luna**)

**Dependencies:** A09 integration interface merged. **Allowed files:** create `src/features/multiplayer/{RoomCodeCard,RoomRoster}.tsx`, `src/features/multiplayer/room-ui.css`, `tests/multiplayer/roomUi.test.tsx`.

**Deliverable:** Render supplied code/share URL with a copy action and readable copied/failure status; render supplied roster and connected/grace state. All buttons are 44px minimum, use shared tokens, and work at 200% zoom. Components take props/callbacks only—no socket, storage or App access.

**Tests:** code is text-selectable, copy failure becomes accessible status, long Unicode display name does not disappear, and grace guest is labelled reconnecting rather than removed.

**Handoff prompt:** “Implement L05 only after the exact props interface is merged. Do not invent lobby state or use a networking library. Edit only the four allowed paths and return a screenshot plus focused test output.”

### A10 — M1 integration and bot-cap test (**Astra**)

**Files:** modify `src/app/App.tsx`, `src/app/WorldCanvas.tsx`; create `tests/multiplayer/{createJoinReconnect,tenGuestBots}.test.ts` and a documented local server test command.

**Deliverable:** Integrate lobby, connection, room snapshot, roster, local/remote avatars and mode ownership. In multiplayer, map/pause are browser-local and never pause the room. Add a ten-client bot integration test covering create, join, walking, rejection of guest eleven and reconnect.

**Acceptance:** solo flow tests still pass; ten guests traverse the scripted origin-to-harbor route in the server harness. Record that server-harness evidence separately from actual browser playability.

### A11 — authoritative vehicle state, seat rules, and server physics (**Astra**)

**Files:** create `packages/simulation/src/{vehicleSimulation,seatRules,vehicleSpawns}.ts`, `packages/simulation/tests/{seatRules,vehicleSimulation}.test.ts`; modify `apps/server/src/KeralaRoom.ts`, `apps/server/src/roomState.ts`.

**Deliverable:** Instantiate named, stable server car/bicycle states. Enforce named car seats (`driver`, `frontPassenger`, `rearLeft`, `rearRight`) and bicycle seats (`rider`, `passenger`) atomically. Only driver/rider inputs control the server vehicle. Require range, grounded/low-speed checks and clear grounded dismount point. Driver disconnect brakes; seats persist through grace.

**Tests:** simultaneous driver requests yield one winner; four car/two bicycle occupants; passenger controls ignored; fast exit rejected; unsafe dismount rejected; driver braking/disconnect/reconnect; no duplicate seat holder.

**Acceptance:** do not import or reuse browser `carPhysics.ts`/`bicycleMotor.ts` as authority; shared pure constants may be extracted with regression coverage.

### L06 — passive vehicle snapshot and seat-anchor helpers (**Luna**)

**Dependencies:** A11 merged. **Allowed files:** create `src/game/vehicle/{multiplayerVehicleView,seatAnchors}.ts`, `tests/multiplayer/{multiplayerVehicleView,seatAnchors}.test.ts`.

**Deliverable:** Convert server `ReplicatedVehicleDto` to immutable render props and derive each named local seat anchor from replicated vehicle transform/model dimensions. Reject impossible seat-kind combinations with `null`; do not touch Rapier or existing motor files.

**Tests:** all four car anchors differ; bicycle anchor positions differ; a passenger is bound to seat transform; invalid `rearLeft` bicycle and `rider` car assignments reject.

**Handoff prompt:** “Implement L06 against the A11 DTOs and supplied vehicle dimensions. Pure functions only. Do not change any existing car/bicycle component or physics code.”

### A12 — shared vehicle visual integration (**Astra**)

**Files:** create `src/game/vehicle/{MultiplayerCarVisual,MultiplayerBicycleVisual,MultiplayerPassengerVisual}.tsx`; modify `src/app/WorldCanvas.tsx` and existing solo-only vehicle mounting boundaries as needed; create `tests/multiplayer/multiplayerVehicles.test.tsx`.

**Deliverable:** Render server snapshots for all shared vehicles and mount passenger avatars to L06 anchors. Disable local car spawn, browser vehicle forces, and solo mount ownership while in a multiplayer room. Driver/rider may receive visual prediction but server snapshots always win.

**Acceptance:** ten-minute scripted server drive has matching car/bicycle transforms/seats in two browser clients; no duplicate passenger body.

### L07 — chat reducer, mute repository, and UI panel (**Luna**)

**Dependencies:** A02 and A10 merged. **Allowed files:** create `src/features/multiplayer/{chatReducer,localMuteRepository,RoomChat}.tsx`, `src/features/multiplayer/chat.css`, `tests/multiplayer/{chatReducer,localMuteRepository,RoomChat}.test.tsx`.

**Deliverable:** Given supplied accepted-chat events/callbacks, render a right-edge non-modal panel, local mute, bounded message list, unread count and accessible send/rejection status. Opening focuses input and invokes supplied `onChatFocusChange(true)`; close restores focus to icon through supplied callback. Render text nodes, never HTML/markdown/link markup.

**Tests:** muted sender hides locally only; four closed-panel messages show unread four; opening clears unread; close callback restores focus; 281 graphemes disable send; typing invokes movement-clear callback; HTML text renders literal characters.

**Handoff prompt:** “Implement L07 strictly as a controlled UI/reducer. No sockets, server edits, App edits, dependencies or raw `dangerouslySetInnerHTML`. Use shared tokens and current icon family.”

### A13 — authoritative chat service and HUD integration (**Astra**)

**Files:** create `apps/server/src/chatService.ts`, `apps/server/tests/chatService.test.ts`; modify `apps/server/src/KeralaRoom.ts`, `src/app/App.tsx`, `src/features/multiplayer/MultiplayerEntry.tsx`, translations.

**Deliverable:** Validate membership/text, apply four-per-ten-second rate limit and 30-second mute on repeated violations, assign immutable sequence/server time, retain/send last 100 messages, and connect L07 to HUD. Add status copy for server rejection and room-ended recovery. Do not log message body in structured metrics/errors.

**Tests:** plain-text acceptance, bidi/control rejection, rate-limit/mute timeline with fake time, history limit 100, new join gets bounded history, and typing cannot move local player.

### A14 — transport and operational hardening (**Astra**)

**Files:** modify `apps/server/src/{config,index,admission,metrics,KeralaRoom}.ts`, `.env.example`; create `apps/server/tests/{config,abuse}.test.ts`, `docs/multiplayer-operations.md`.

**Deliverable:** Require production HTTPS/WSS configuration, explicit origin allow-list, per-IP join/chat limiter, message-size cap, unknown-message rejection and metric thresholds/logging. Document one-process deployment, WebSocket-capable host, static-client WebSocket environment configuration, server-loss recovery and explicit non-goals for public rooms.

**Tests:** disallowed origin/IP burst/frame size/unknown message fail with safe error; messages do not appear in logs; config fails closed in production when origin is absent.

### L08 — multilingual multiplayer copy catalogue (**Luna**)

**Dependencies:** A09, A13 text-key interface merged. **Allowed files:** modify `src/content/locales/en.json`, `src/content/locales/ml.json`; create `tests/multiplayer/multiplayerTranslations.test.ts`.

**Deliverable:** Add every supplied multiplayer lobby, code, roster, chat, full-room, reconnect, version-mismatch and room-ended key in English and Malayalam. Preserve all existing keys, JSON formatting and tone; no component edits.

**Tests:** exact key parity between locale files and no empty translation values.

**Handoff prompt:** “Implement L08 only. Do not change components. Keep English concise and Malayalam natural; report the parity test result.”

### A15 — browser integration, accessibility, and resilience (**Astra**)

**Files:** modify composed multiplayer UI only; create `tests/multiplayer/{accessibility,clientRecovery}.test.tsx` and Playwright scenarios under `tests/e2e/multiplayer/`.

**Deliverable:** Verify lobby through room UI works with keyboard, touch and 200% zoom; chat focus clears movement; app recovers to lobby on server restart; background/resume reconnect behaves honestly. Ensure far-right chat does not obscure existing map/pause layout on compact screens.

**Acceptance:** manual screenshots on bright/dark terrain and real UI inspection, with device/browser/version recorded—automated DOM assertions alone are insufficient.

### L09 — test-matrix report template and result normalizer (**Luna**)

**Dependencies:** A14 test command/interface merged. **Allowed files:** create `docs/validation/multiplayer-test-matrix.md`, `scripts/normalize-multiplayer-metrics.mjs`, `tests/multiplayer/normalizeMetrics.test.ts`.

**Deliverable:** Supply a committed matrix for 2/6/10 guests, desktop/touch, latency/packet-loss/background/restart, and 30-minute soak. The pure script reads a named JSON metrics export and outputs median/p95 tick, RTT, patch size, rejection counts and pass/fail against 16.7/25 ms tick thresholds; it must not contact a server.

**Tests:** fixture values produce a passing result and a p95=25.1 result produces failure. Document fields that must be measured rather than invented.

**Handoff prompt:** “Implement L09 only. No load generator, dependency, server, or runtime UI edits. Use checked-in JSON fixtures and report focused test output.”

### A16 — soak, chaos, and release evidence (**Astra**)

**Files:** create/modify server bot/load harness and `docs/validation/2026-09-15-multiplayer-release.md`; append `docs/06-build-log.md`.

**Deliverable:** Execute named 2/6/10 guest routes; a 30-minute ten-player soak; reconnect chaos; latency/packet-loss simulation; server restart recovery; car/bicycle seat scenarios; and device/browser matrix. Feed metrics to L09 normalizer and retain raw run identifiers/configuration, not chat bodies.

**Acceptance:** do not declare release if median server tick is ≥16.7 ms or p95 is ≥25 ms, any security/cap/reconnect criterion fails, or running UI was not inspected. State actual gaps and blockers.

### A17 — final integration review and release gate (**Astra**)

**Files:** review all changed paths; modify only defects/docs/build log discovered during review.

**Deliverable:** Verify each spec acceptance criterion maps to test/manual evidence; confirm solo save/profile behavior is unchanged; run root checks; inspect actual multiplayer UI; record precise versions, environment, screenshots and remaining warnings. Document public-room prerequisites without implementing them.

**Acceptance:** `npm run typecheck`, `npm test`, `npm run build`, focused server tests and browser evidence are all recorded truthfully. Existing warnings or unrun checks remain explicit in `docs/06-build-log.md`.

## Luna dispatch protocol

For every Luna task, the Astra integrator must first confirm its dependencies are merged and paste the current exported interfaces and one relevant test pattern. Dispatch exactly one task using its embedded prompt plus:

```text
Repository: /Users/sreehariprathap/Documents/OpenAI/KeralaStory
Read: AGENTS.md, docs/02-design-bible.md, docs/03-architecture.md, this plan's Global Constraints, and Task [ID].
Your writable paths are exactly those listed by Task [ID].
Do not edit any other path, package/workspace configuration, contracts, server, App, WorldCanvas, terrain, physics, camera, input lifecycle, or existing solo behavior.
Use TDD: add the named failing test, run it, implement the smallest change, rerun it. Do not commit.
Return: summary, changed paths, exact commands/results, screenshot for visual work, and blockers. Do not claim unrun checks pass.
```

After every Luna return, Astra reviews the diff for scope, contract drift, accessibility and test quality; runs the focused test plus typecheck; then merges/integrates before dispatching the next dependent task. If a required export is absent, stop the Luna task and complete its Astra dependency—do not ask Luna to design a substitute contract.

## Milestone gates

| Gate | Required completed tasks | Observable evidence |
| --- | --- | --- |
| M0 | A01–A06, L01–L04 | Two headless clients move, disconnect and reclaim one identity; deterministic replay/checksum; no browser simulation imports. |
| M1 | A07–A10, L05 | Ten guests create/join/reconnect and walk the current route; eleventh is clearly rejected; solo remains unchanged. |
| M2 | A11–A12, L06 | Four car and two bicycle seats match across clients; only driver/rider controls; no duplicate passenger body. |
| M3 | A13, L07–L08 | Accessible per-room chat, local mute, focus/input safety, plain text/rate limits/history and translated copy. |
| M4 | A14–A17, L09 | Actual soak/chaos/browser evidence and operational documentation meet the stated release thresholds. |

## Self-review

The plan covers admission/codes/capacity/reconnect (A05/A10), 60 Hz authority and 20 Hz DTO patches (A03–A06), client prediction/interpolation (L04/A07/A08), vehicles/seats (A11/A12/L06), chat (L07/A13), transport/metrics/deployment (A14), and release validation (A15–A17/L09). It explicitly excludes public rooms, identity, persistence and database work. Core integration remains Astra-owned as required by `AGENTS.md`; Luna handoffs are limited to fixtures, pure helpers, controlled UI, translations and reports.
