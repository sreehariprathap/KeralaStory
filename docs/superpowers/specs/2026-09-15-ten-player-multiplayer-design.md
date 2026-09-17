# Ten-player multiplayer design

## Decision

Add an authoritative TypeScript multiplayer service for temporary, invite-only exploration rooms. A room holds at most ten guests, has its own ephemeral chat, and simulates the shared four-region Kerala world at a fixed 60 Hz. The same room service will support public matchmaking later, but public rooms are not part of the first release.

The browser is never authoritative for position, vehicle state, seat occupancy, collisions, or chat acceptance. It sends input and renders the accepted server state. This is necessary because players share dynamic cars and bicycles. Colyseus is the room and state-patch transport; a server-side Rapier world is the simulation authority. Colyseus supports TypeScript authoritative rooms, matchmaking, and state synchronization; Rapier exposes JavaScript 3D physics and deterministic simulation when initial conditions and operations are controlled. [Colyseus](https://0-15-x.docs.colyseus.io/), [Rapier JavaScript](https://rapier.rs/docs/user_guides/templates/getting_started_js/), [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/).

## Product scope

### First release

- A guest creates an invite-only room and receives an eight-character code plus a share URL containing that code.
- Up to ten guests join one shared Kerala world. A guest chooses a display name and current avatar appearance locally before joining; these fields are validated by the server but are not accounts.
- A right-edge HUD chat icon opens a per-room, YouTube-style scrolling chat panel. It has unread count, local mute, plain-text messages, sender name, timestamp, and an accessible close button.
- Cars have four named seats: `driver`, `frontPassenger`, `rearLeft`, and `rearRight`. Bicycles have `rider` and `passenger` seats. Every occupied seat is visible to all clients.
- Only the driver/rider can send vehicle control inputs. Passengers remain attached to their assigned seat and may leave through the normal exit action.
- The room persists only while occupied, then is retained for a short reconnect grace period and discarded. Chat, vehicles, and exploration state are not saved to a database.

### Explicitly out of scope

- Accounts, friends, persistent profiles, cross-device saves, purchases, quests, inventory, voice chat, direct messages, moderation dashboard, or permanent chat history.
- Public discovery/matchmaking, cross-room travel, more than ten occupants, AI or NPC synchronization, and server-side asset streaming.
- Client-hosted simulation or peer-to-peer authority.

The existing browser local save remains local. It continues to store display preferences and offline progress; it is neither trusted nor uploaded by multiplayer v1.

## User flows

### Create and join

1. The entry screen receives a `Play together` action beside the existing solo start.
2. `Create private room` validates the local guest display profile, requests a room, then displays an eight-character code, copyable share URL, and `Start exploring`.
3. `Join private room` accepts a normalized code or a URL. The server accepts at most ten connected or grace-period guests.
4. On join, the server sends an authoritative full room snapshot. The client spawns the guest at a named safe spawn, displays the room roster, and begins rendering other guests.
5. A reconnect token stored in `sessionStorage` permits the same browser to reclaim its guest ID and prior seat during a short grace period. It is not an account credential and is cleared when the room expires or the user explicitly leaves.

### Chat

1. A chat icon at the far right of the existing HUD opens a non-modal side panel; gameplay remains visible and chat focus intentionally stops movement input.
2. The client submits a chat request. The server validates room membership, text length, Unicode/control-character policy, and rate limit, assigns sequence/time, then broadcasts it only to that room.
3. Closing chat restores focus to its icon and displays an unread badge for later messages. A local mute list suppresses selected guest messages only on that browser.

### Vehicles

1. A nearby guest requests `enterVehicle(vehicleId, preferredSeat?)`; the server checks distance, grounded state, speed, ownership, seat capacity, collision clearance, and an atomic seat reservation.
2. The server assigns the first legal requested seat, or a passenger seat when the driver seat is occupied. It broadcasts the seat map and snaps the occupant to the vehicle anchor.
3. The driver/rider sends ordered vehicle inputs. The server alone advances car/bicycle physics and publishes snapshots. Passenger movement inputs are ignored except exit/chat/UI commands.
4. An exit request succeeds only at low speed and when the server finds a clear, grounded dismount point. The server detaches the guest, updates occupancy, and broadcasts the new state.
5. Disconnecting a driver engages braking; the vehicle remains until its grace interval ends. Disconnecting a passenger releases only that seat after grace expiry. A vehicle never becomes client-owned.

## Architecture

```text
React/R3F browser                  Authoritative game service
─────────────────                  ──────────────────────────
input + chat intent ─ WebSocket ─►  Colyseus KeralaRoom
render interpolation ◄ state patch ─ room state / chat stream
local prediction (self only)       └─ 60 Hz Rapier simulation
                                      ├─ static world colliders
                                      ├─ player character controllers
                                      ├─ cars and bicycle bodies
                                      └─ mount, seat and safety rules
```

### Repository boundaries

Create these boundaries without moving unrelated presentation code:

```text
packages/protocol/       validated messages, schema-safe DTOs, constants
packages/simulation/     deterministic terrain/collider assembly, player and vehicle rules
apps/server/             Colyseus bootstrap, KeralaRoom, admission, room lifecycle
src/features/multiplayer/ lobby/join/room/chat UI and network lifecycle
src/game/network/        input sender, interpolation, prediction/reconciliation adapters
src/game/player/         local and remote visual-controller adapters
src/game/vehicle/        visual adapters driven by replicated vehicle snapshots
```

`packages/simulation` must not import React, R3F, browser APIs, or UI code. It receives canonical terrain and world data and owns server physics. `src/game/network` cannot mutate Rapier bodies that belong to remote guests; it renders snapshots. This preserves the current rule that DOM UI does not move bodies directly.

### Room state

The server retains compact simulation state, not Three.js objects or GLTF assets:

```ts
type RoomPhase = 'waiting' | 'playing' | 'closing';
type SeatId = 'driver' | 'frontPassenger' | 'rearLeft' | 'rearRight' | 'rider' | 'passenger';

interface PlayerState {
  id: string;                 // server-issued guest ID
  displayName: string;        // validated, plain text, 1–24 chars
  appearance: AvatarAppearance;
  transform: { position: Vec3; headingRad: number; velocity: Vec3 };
  travel: { kind: 'foot' } | { kind: 'vehicle'; vehicleId: string; seatId: SeatId };
  connected: boolean;
  lastProcessedInput: number;
}

interface VehicleState {
  id: string;
  kind: 'car' | 'bicycle';
  modelId: string;
  transform: { position: Vec3; rotation: Quat; linearVelocity: Vec3; angularVelocity: Vec3 };
  controls: { driverId: string | null; throttle: number; steering: number; brake: boolean; nitro: boolean };
  seats: Partial<Record<SeatId, string>>;
}

interface ChatMessage {
  id: number;
  senderId: string;
  senderName: string;
  text: string;
  sentAtMs: number;
}
```

Do not replicate terrain, static scenery, asset paths, camera state, local settings, mouse motion, raw keys, or full Rapier internals. All clients load the same versioned static world bundle before joining. A world-version mismatch rejects entry with an update/retry message.

### Network messages

Client-to-server messages are validated with shared Zod schemas and have a small maximum size:

| Message | Frequency | Validation |
|---|---:|---|
| `input` | 20–30 Hz while changed; heartbeat at 5 Hz | monotonic sequence; axes [-1,1]; allowed actions only |
| `enterVehicle` / `exitVehicle` | event | current server state, range, speed, seat and clearance |
| `chatSend` | max 4 messages / 10 seconds | room membership; 280 grapheme max; plain text |
| `ready` / `leave` | event | membership and phase |
| `ping` | 2 Hz | timestamp only |

The server sends state patches at 20 Hz, plus immediate patches for join/leave, mount, dismount, and chat. The simulation remains 60 Hz. Clients interpolate remote players and vehicles with a 100 ms render buffer; they never extrapolate more than 250 ms. This is adequate for ten players in one compact world without premature interest-management complexity.

### Prediction and reconciliation

- **Walking local player:** predict locally using the same pure movement helpers, render immediately, attach input sequence numbers, and reconcile to the server transform. If correction exceeds 0.35 m or 20° the client blends over 100–180 ms; a safety reset snaps with a clear message.
- **Remote players:** no local physics body. Render an interpolated avatar transform and animation from replicated velocity/grounded/travel state.
- **Driver/rider:** may predict visual input for responsiveness, but server snapshots always win. A correction recalculates local vehicle rendering; the browser does not apply forces to shared authoritative state.
- **Passengers:** attach to immutable seat anchors derived from the replicated vehicle transform. No prediction, no hidden duplicate physics body.

The current client-only `ExplorerController`, bicycle motor, and car physics are reference behavior, not the multiplayer authority. Extract reusable pure constants/helpers first; do not try to synchronize existing browser Rapier worlds directly.

## Safety, capacity, and reliability

### Admission and lifecycle

- Generate room codes from a restricted alphabet, eight characters long; normalize case and reject ambiguous characters. A code is an invitation, not a security boundary; v1 rooms must be described as unlisted rather than confidential.
- The share URL uses the room code only. Never put reconnect tokens or profile data in URLs.
- Hard-reject the eleventh guest with a full-room response. Do not silently evict occupants.
- The creator is only the initial room creator, not a privileged simulation authority. Add room lock/kick controls only with a later moderation design.
- On browser disconnect, retain player/seat state for 60 seconds. A returning browser presents its reconnect token; otherwise the state is released. Empty rooms close after five minutes.

### Chat safeguards

- Escape and render all messages as plain text; disallow links, HTML, markdown embeds, control characters, and bidi override characters.
- Enforce 280 graphemes, four accepted messages per ten seconds, and a 30-second server mute after repeated rate-limit violations.
- Give every message an immutable sequence number. Keep the last 100 messages only in room memory; a new joiner receives that bounded history.
- Provide local mute immediately. Report/block tooling, audit storage, and public-chat moderation are prerequisites for public rooms and deliberately excluded from v1.

### Abuse and transport

- Use HTTPS/WSS, origin allow-listing, per-IP join/chat rate limiting, maximum frame sizes, and structured server logs without chat-body retention beyond error diagnostics.
- Treat all profile, movement, vehicle, and chat fields as hostile. Clamp axes and timestamps; reject unknown message types; never trust a client coordinate, seat map, speed, or collision result.
- Keep a server-side rolling room metric set: active players, joins, reconnects, input rejection count, state-patch size, simulation duration, RTT, chat rejections, vehicle occupancy, and crash/close reason.

## Deployment

For v1, run one Node.js process behind a WebSocket-capable host and keep rooms in memory. It supports the requested ten-player rooms and avoids database work. Deploy static Vite assets separately or from the same origin; configure the browser client with the WebSocket origin through environment configuration.

For horizontal scale later, introduce a room-presence adapter (Redis is the expected candidate) and sticky WebSocket routing. Do not add Redis, Postgres, an account provider, or a queue in the first slice. A server process loss closes active ephemeral rooms; the client must show an honest `Room ended—return to lobby` recovery state.

## Phased implementation plan

### M0 — contracts and server spike

- Add an isolated server workspace and protocol package; pin compatible Colyseus, its client SDK, and server-safe Rapier dependencies after a compatibility spike.
- Extract canonical static collider/world construction from rendering code. Prove one server world can load it deterministically.
- Implement a headless room with two scripted inputs, fixed-step snapshots, and deterministic replay checksum tests.
- Exit criterion: no browser dependency in simulation; two clients can connect, move, disconnect, and reconnect in a local test harness.

### M1 — guest rooms and replicated explorers

- Add create/join code/link UI, session reconnect token, roster, waiting/error/full states, and `Play together` mode separation from solo saves.
- Implement server admission, ten-player cap, 60 Hz simulation, 20 Hz patches, input validation, remote-avatar interpolation, and local reconciliation.
- Add browser tests for create/join/full/reconnect and integration tests for ten concurrent bots.
- Exit criterion: ten guests can walk across all four regions, pause/open map locally without pausing others, and rejoin within the grace window.

### M2 — shared bicycles and cars

- Replace local spawned vehicle ownership in multiplayer rooms with named server vehicles and stable IDs.
- Add seat anchors and visual passenger poses; implement atomic entry, driver/rider authority, speed-gated exit, driver disconnect braking, and server collision clearance.
- Add scenario tests: four car occupants, two bicycle occupants, simultaneous seat request, invalid mount, vehicle crash/recovery, driver reconnect, and occupied vehicle persistence during grace.
- Exit criterion: four car occupants and two bicycle occupants see matching transforms/seats after a 10-minute scripted drive, with no duplicate passenger body or client-controlled car.

### M3 — room chat and usability

- Add right-edge chat icon/panel, unread badge, focus restoration, keyboard/touch behavior, local mute, bounded history, server validation, rate limiting, and recovery copy.
- Complete English/Malayalam catalog entries and accessibility review at 200% zoom.
- Exit criterion: chat remains readable over bright/dark scenes, cannot move the player while typing, and rejected messages receive an accessible status response.

### M4 — hardening and release gate

- Run a named browser/device matrix, 10-player soak test for 30 minutes, reconnect chaos test, packet-loss/latency simulation, server restart recovery, and resource measurement.
- Set operational alarms for room crash, simulation tick overrun, high RTT, and rejected-message spikes.
- Document public-room prerequisites: moderation/reporting policy, abuse controls, room discovery, capacity model, and persistence decision.
- Exit criterion: no blocker in the multiplayer test matrix; median server tick remains below 16.7 ms and p95 below 25 ms at ten active guests in the named test environment.

## Test strategy

| Layer | Required evidence |
|---|---|
| Protocol | Zod acceptance/rejection, sequence handling, field bounds, backwards-compatible DTO fixture tests |
| Simulation | deterministic replay, collision, safe spawn/reset, mount/dismount, seat exclusivity, car/bicycle control ownership |
| Room | cap, codes, join/leave/reconnect, chat bounds/rate limits/history, state-patch behavior |
| Client | interpolation/reconciliation, chat focus/input clearing, HUD unread count, roster, errors and recovery |
| End-to-end | 2, 6, and 10 browser/bot clients; full origin-to-harbor route; both vehicles; 30-minute soak |
| Manual | real desktop and touch devices, packet loss, high latency, background/resume, server restart |

## Acceptance criteria

1. Ten guests can join one private room with a code or URL; an eleventh is rejected clearly.
2. All guests see matching player, car, bicycle, and seat state, while the server—not a browser—validates movement and vehicles.
3. Cars support four occupants and bicycles two, with only their designated driver/rider controlling movement.
4. Per-room chat is live, accessible, bounded, plain-text only, rate-limited, and disappears with the room.
5. Disconnect/reconnect works within 60 seconds without creating duplicate players or freeing occupied seats early.
6. Solo play and existing local profile/save behavior keep working unchanged.
7. At ten active guests, the named environment meets the 60 Hz server-tick and 20 Hz state-patch targets, with documented actual measurements.

## Decisions to revisit before public rooms

- Authentication and durable identity.
- Moderation, reporting, retention, privacy notice, and age/region requirements for public chat.
- Redis/sticky routing and regional deployment.
- Persistent rooms/world state, scalable interest management, and room discovery.
- Voice chat, friends, parties, cross-room invites, and dedicated host/admin powers.
