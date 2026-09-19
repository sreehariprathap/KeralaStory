# Multiplayer room integration design

Date: 17 September 2026
Branch: `feature/multiplayer-rooms`
Supersedes nothing. Completes the integration half of `2026-09-15-ten-player-multiplayer-design.md`.

## Decision

Make the already-built private-room multiplayer reachable from the running game. A player on the title screen creates a room, receives an eight-character code and share link, and up to ten guests walk, run, jump, and glide through the same Kerala world with room chat and a roster.

The server, protocol, simulation, room client, lobby components, and remote-avatar renderers already exist and are tested. Nothing in `src/app` references them, so no player can reach any of it. This design adds that wiring and nothing else.

Vehicles remain single-player. The server already answers `enterVehicle` and `exitVehicle` with `VEHICLE_DENIED`, and `RoomSnapshotDto.vehicles` is always empty. This milestone hides the seat UI rather than implementing shared vehicles.

## Scope

### In scope

- A `Play together` action on the title screen, beside `Continue journey` / `Create explorer`.
- A lobby modal wrapping the existing `MultiplayerEntry`: guest name, create room, join by code or invite link, live status, `Enter shared world`.
- `?room=CODE` in the URL opens the lobby with the code pre-filled.
- A shared-world session: server-authoritative local movement, up to nine remote guests rendered, roster, invite copy, room chat, reconnect, leave.
- Solo-only systems suppressed while in a room.
- A single dev script that runs the Vite client and the Colyseus server together.

### Out of scope

- Shared vehicles, seats, and passenger rendering (plan tasks A11, A12).
- Public lobbies, room browsing, named or persistent rooms.
- Deployment. The client keeps defaulting to `ws://<hostname>:2567`; `VITE_MULTIPLAYER_URL` overrides it.
- Collectables, wallet, and football in rooms. These stay solo.
- Accounts, friends, saved room state.

## Architecture

The existing `soccer?: SoccerSceneProps` prop on `WorldCanvas` is the pattern this follows: an optional feature object passed into the scene that swaps behaviour inside the Canvas without restructuring the app.

```text
App.tsx
├─ useMultiplayer()                → session { phase, welcome, snapshot, remote, reconciliation, sender, client }
├─ roomSession: 'solo' | 'room'    → derived from session.welcome + entered flag
├─ ModalShell menu='multiplayer'   → MultiplayerEntry (create / join / enter)
├─ RoomStatus                      → rendered inside the HUD while in a room
└─ WorldCanvas
   └─ multiplayer?: MultiplayerSceneProps
      ├─ present → MultiplayerLocalController (no Rapier body; camera + intent + reconciled transform)
      │             + RemoteExplorer per other guest, sampled from RemoteSnapshots
      └─ absent  → ExplorerController (unchanged solo path)
```

Authority split is unchanged from the original design: the browser sends intent and renders accepted server state. `LocalReconciliation` smooths the local guest; `RemoteSnapshots.sample()` interpolates the others at a 100 ms render delay and returns `null` past the stale limit, which hides that avatar.

## Components

### New

- `src/features/multiplayer/MultiplayerRoomScene.tsx` — mounted inside `Physics`. Renders `MultiplayerLocalController` for the local guest and one `RemoteExplorer` per other connected guest, driven by `session.remote.sample(id, serverNow)`.
- `src/app/useRoomSession.ts` — thin App-level hook over `useMultiplayer`: owns the `entered` flag, the lobby-open state, `?room=` detection, and `enter` / `leave` transitions. Keeps App.tsx from absorbing more state.

### Changed

- `src/app/WorldCanvas.tsx` — accepts `multiplayer?: MultiplayerSceneProps`. When present, mounts `MultiplayerRoomScene` in place of `ExplorerController` and skips `Collectables` and `SoccerMatch`.
- `src/app/App.tsx` — title-screen `Play together` button, lobby modal, `RoomStatus` in the HUD, the suppression rules below, and the persistence guard.
- `src/features/multiplayer/RoomStatus.tsx` — seat and vehicle controls removed for this milestone; roster, invite copy, phase status, chat, and leave stay.
- `package.json` — `dev:all` runs client and server together.

### Reused unchanged

`useMultiplayer`, `roomClient`, `inputSender`, `reconciliation`, `remoteSnapshots`, `sessionToken`, `lobbyModel`, `MultiplayerEntry`, `MultiplayerLocalController`, `RemoteExplorer`, and the whole of `apps/server`, `packages/protocol`, `packages/simulation`.

## Data flow

1. Title screen: `Play together` opens the lobby. If `?room=CODE` is present the lobby opens on load with the code filled.
2. `MultiplayerEntry` calls `session.connect(profile, code?)`. Create posts to Colyseus `create('kerala')`; join resolves `GET /rooms/:code` to a room id first.
3. `roomWelcome` yields the room code, guest id, and reconnect token; the token is written to `sessionStorage` keyed by room code. The client replies `ready` with `WORLD_VERSION`, which moves the room to `playing`.
4. `roomSnapshot` patches at 20 Hz. The local guest's transform feeds `LocalReconciliation`; all guests feed `RemoteSnapshots`.
5. `Enter shared world` sets `entered`, which mounts `WorldCanvas` with the `multiplayer` prop and switches `mode` to `playing`.
6. Each frame, `MultiplayerLocalController` reads input, sends intent at the sender's tick rate, advances the reconciled transform, drives the camera, and publishes a `PlayerSnapshot` to App at 10 Hz so the HUD, minimap, and place label keep working.
7. `Leave room` calls `session.leave()`, clears `entered`, and returns to the title screen.

## Behaviour rules while in a room

These exist because the local guest has no client-owned physics body in a room, so anything that assumes one is either meaningless or actively harmful.

- **Local save is not written.** `persist()` returns early when in a room. Position, bicycle, visited landmarks, and collectables in a room must never overwrite the solo save.
- **Hidden HUD affordances:** car spawner, bike spawner, return-bicycle, reset-position, football offer and match HUD, glider offer stays (the server implements `launchGlider`).
- **Collectables are not mounted.** They are client-authoritative pickups with no server counterpart.
- **Discovery toasts and the field atlas stay.** They are read-only over position.
- **Touch controls stay.** `MultiplayerLocalController` already routes `controller.inputCommands` through `useExplorerInput`, so `MobileControls` receives the same command object as solo. This is verified in the running app, not assumed.
- **Chat focus stops movement.** `RoomStatus` calls `onChatFocus`, which flips `sender.setFocused(false)` through the controller's `enabled` gate.

## Error handling

- `WORLD_VERSION_MISMATCH` on join: the lobby shows that the room runs a different world build and the player should reload. Client and server ship together, so this only appears mid-deploy.
- `ROOM_NOT_FOUND` / `ROOM_ENDED`: the lobby stays open with the message and the code kept, so the player can retype or ask for a new link.
- `ROOM_FULL`: stated plainly with the ten-guest limit.
- `RECONNECT_DENIED`: the stale token is dropped by `roomClient`; the retry is a fresh join.
- Transport drop: phase becomes `reconnecting`, `RoomStatus` says movement is paused, and Colyseus attempts reconnection within the 60 s grace period. On `ended`, the player is returned to the title screen with an explanatory message rather than left in a frozen world.
- Server unreachable (the common local case, server not started): the lobby says the multiplayer server is not running and names `npm run server:dev`.
- Scene errors inside a room hit the existing `SceneBoundary`, which must also leave the room so no orphan connection survives.

## Testing

Unit and integration tests run under Vitest, alongside the eight existing suites in `tests/multiplayer/`.

- `tests/multiplayer/roomSession.test.ts` — lobby open/close, `?room=` prefill, enter and leave transitions, and that leaving clears the session.
- `tests/multiplayer/soloIsolation.test.ts` — `persist()` writes nothing while in a room; the solo save is byte-identical before and after a room session.
- `tests/multiplayer/roomScene.test.ts` — `MultiplayerRoomScene` renders one `RemoteExplorer` per other guest, none for the local guest, and drops an avatar whose sample returns `null`.
- Existing server suites (`apps/server/tests`) and client suites must keep passing untouched.

Manual verification in the running app, recorded in `docs/06-build-log.md` honestly:

1. Two browser windows, one creates a room and copies the invite, the other joins by link. Both see each other move.
2. A third window joins by typing the code.
3. Chat both directions; local mute works.
4. Kill the network on one window, restore within 60 s, confirm the guest resumes rather than duplicating.
5. Leave the room, start a solo session, confirm the local save is intact.
6. Touch emulation: verify `MobileControls` drive the guest in a room.

Gate before handoff: `npm run typecheck`, `npm test`, `npm run build`, plus the manual list above.

## Risks

- **Ten guests rendering as full `ExplorerAvatar` rigs** may cost more than the mobile frame budget allows. Measured with the existing `RenderMeter`; if it bites, the fallback is a reduced avatar for distant guests, not a change in authority.
- **`App.tsx` is already dense at 259 lines.** `useRoomSession` exists to absorb the new state rather than grow the component further. If App still grows past roughly 300 lines, extracting the HUD is the next step and belongs in its own change.
- **The two stale worktrees** (`.worktrees/perf-pwa`, `.worktrees/ten-player-multiplayer`) are collected by `npm test` and already produce timeouts unrelated to this work. Results are reported per-suite so these do not mask a real failure.
