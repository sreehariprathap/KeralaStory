# Multiplayer Room Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-built private-room multiplayer reachable from the running game, so up to ten guests can create or join a room by code and explore Kerala together on foot.

**Architecture:** `WorldCanvas` gains an optional `multiplayer` prop, mirroring its existing `soccer` prop. When present it mounts `MultiplayerRoomScene` (server-authoritative local controller plus one render-only remote avatar per guest) instead of the solo `ExplorerController`. A new `useRoomSession` hook holds lobby and room state so `App.tsx` does not grow further. No server, protocol, or simulation code changes.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/rapier 2, Three 0.186, Colyseus SDK 0.18, Zod 4, Vitest 5, TypeScript 5.9.

**Spec:** `docs/superpowers/specs/2026-09-17-multiplayer-room-integration-design.md`

## Global Constraints

- Branch: `feature/multiplayer-rooms`. Do not commit to `main` or `feature/map-expansion`.
- The browser is never authoritative in a room: no Rapier body is mounted for the local guest, and no client code writes positions.
- The local save (`localSaveRepository`) must never be written while the player is in a room.
- Vehicles stay single-player this milestone. The server answers `enterVehicle` / `exitVehicle` with `VEHICLE_DENIED` and always sends `vehicles: []`. Do not add seat UI.
- No per-frame React state updates. Physics and network state live in refs; React receives snapshots at 10 Hz or slower.
- No new npm dependencies.
- Tests run in Vitest's default Node environment. There is no DOM testing library in this repo, so React components are not rendered in tests. Test pure functions instead; components are verified by running the app.
- Multiplayer UI copy stays English-only, matching the existing `MultiplayerEntry` and `RoomStatus`. i18n for these strings is out of scope.
- Style UI with the shared tokens in `src/ui/tokens.css` and the existing `button button-primary` / `button button-secondary` classes.
- Before handoff: `npm run typecheck`, `npm test`, `npm run build`, plus the manual checks in Task 7.

---

## File Structure

**Create:**
- `src/features/multiplayer/roomSessionModel.ts` — pure helpers: URL room code, remote guest selection, error copy, enter-gate predicate, save-guard predicate.
- `src/features/multiplayer/MultiplayerRoomScene.tsx` — in-Canvas scene: local controller plus remote avatars.
- `src/app/useRoomSession.ts` — App-level hook over `useMultiplayer`; owns lobby open / entered state.
- `tests/multiplayer/roomSessionModel.test.ts`
- `tests/multiplayer/soloIsolation.test.ts`

**Modify:**
- `src/app/WorldCanvas.tsx` — optional `multiplayer` prop; suppress solo-only scene children in a room.
- `src/app/App.tsx` — title-screen action, lobby modal, HUD room panel, solo-system suppression, persistence guard.
- `src/features/multiplayer/RoomStatus.tsx` — remove seat/vehicle controls for this milestone.
- `src/features/multiplayer/multiplayer.css` — lobby modal and HUD room panel styling.
- `package.json` — `dev:all` script.
- `docs/06-build-log.md` — honest record of what was verified.

**Deviation from the spec:** the spec named `tests/multiplayer/roomSession.test.ts` and `roomScene.test.ts`. Because components cannot be rendered in this test setup, that coverage moves into `roomSessionModel.test.ts` against pure selectors. The behaviour covered is the same.

---

## Task 1: Room session model

Pure functions that the hook, the scene, and the App all depend on. No React, no network.

**Files:**
- Create: `src/features/multiplayer/roomSessionModel.ts`
- Test: `tests/multiplayer/roomSessionModel.test.ts`

**Interfaces:**
- Consumes: `normalizeRoomCode` from `@kerala-story/protocol`; `RoomSnapshotDto`, `ReplicatedPlayerDto` types from the same package.
- Produces:
  - `roomCodeFromSearch(search: string): string | null`
  - `remoteGuests(snapshot: RoomSnapshotDto | null, selfId: string | null): ReplicatedPlayerDto[]`
  - `localGuest(snapshot: RoomSnapshotDto | null, selfId: string | null): ReplicatedPlayerDto | null`
  - `canEnterWorld(phase: ConnectionPhase, snapshot: RoomSnapshotDto | null, selfId: string | null): boolean`
  - `roomErrorMessage(raw: string): string`
  - `shouldPersistSave(inRoom: boolean): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/multiplayer/roomSessionModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RoomSnapshotDto } from '@kerala-story/protocol';
import { canEnterWorld, localGuest, remoteGuests, roomCodeFromSearch, roomErrorMessage, shouldPersistSave } from '../../src/features/multiplayer/roomSessionModel';

const player = (id: string, connected = true) => ({
  id,
  displayName: id,
  connected,
  appearance: { avatarPresetId: 'canopy' as const, colors: { skin: '#ba805b' as const, hair: '#292a25' as const, clothing: '#285943' as const } },
  transform: { position: [0, 0, 0] as [number, number, number], velocity: [0, 0, 0] as [number, number, number], headingRad: 0 },
  travel: { kind: 'foot' as const },
  lastProcessedInput: 0,
});
const snapshot = (ids: string[]): RoomSnapshotDto => ({
  phase: 'playing',
  worldVersion: 'test-world',
  serverTimeMs: 0,
  players: ids.map(id => player(id)),
  vehicles: [],
  roster: ids.map(id => ({ id, displayName: id, connected: true })),
});

describe('roomCodeFromSearch', () => {
  it('reads and normalizes a room code from the query string', () => {
    expect(roomCodeFromSearch('?room=abcdefgh')).toBe('ABCDEFGH');
  });
  it('returns null when there is no code', () => {
    expect(roomCodeFromSearch('')).toBeNull();
    expect(roomCodeFromSearch('?other=1')).toBeNull();
  });
  it('returns null for a malformed code rather than throwing', () => {
    expect(roomCodeFromSearch('?room=NOT-A-CODE-AT-ALL')).toBeNull();
  });
});

describe('guest selection', () => {
  it('excludes the local guest from the remote list', () => {
    expect(remoteGuests(snapshot(['a', 'b', 'c']), 'b').map(guest => guest.id)).toEqual(['a', 'c']);
  });
  it('returns an empty list when the snapshot or self id is missing', () => {
    expect(remoteGuests(null, 'a')).toEqual([]);
    expect(remoteGuests(snapshot(['a']), null)).toEqual([]);
  });
  it('finds the local guest by id', () => {
    expect(localGuest(snapshot(['a', 'b']), 'b')?.id).toBe('b');
    expect(localGuest(snapshot(['a']), 'b')).toBeNull();
  });
});

describe('canEnterWorld', () => {
  it('allows entry only when connected and present in the snapshot', () => {
    expect(canEnterWorld('connected', snapshot(['a']), 'a')).toBe(true);
    expect(canEnterWorld('connecting', snapshot(['a']), 'a')).toBe(false);
    expect(canEnterWorld('connected', snapshot(['b']), 'a')).toBe(false);
    expect(canEnterWorld('connected', null, 'a')).toBe(false);
  });
});

describe('roomErrorMessage', () => {
  it('translates server codes into player-facing sentences', () => {
    expect(roomErrorMessage('ROOM_NOT_FOUND')).toBe('That room code was not found. Check the code, or ask for a new invite.');
    expect(roomErrorMessage('ROOM_FULL')).toBe('That room is full. Rooms hold up to 10 guests.');
    expect(roomErrorMessage('WORLD_VERSION_MISMATCH')).toBe('That room runs a different build of the world. Reload this page and try again.');
    expect(roomErrorMessage('ROOM_ENDED')).toBe('That room has ended.');
    expect(roomErrorMessage('RECONNECT_DENIED')).toBe('Your place in that room expired. Join again to get a new one.');
  });
  it('recognises a failure to reach the server', () => {
    expect(roomErrorMessage('Failed to fetch')).toBe('Could not reach the multiplayer server. If you are running locally, start it with: npm run server:dev');
  });
  it('passes through anything else unchanged', () => {
    expect(roomErrorMessage('Something odd happened.')).toBe('Something odd happened.');
  });
});

describe('shouldPersistSave', () => {
  it('refuses to write the local save while in a room', () => {
    expect(shouldPersistSave(true)).toBe(false);
    expect(shouldPersistSave(false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/multiplayer/roomSessionModel.test.ts`
Expected: FAIL — cannot resolve `src/features/multiplayer/roomSessionModel`.

- [ ] **Step 3: Write the implementation**

Create `src/features/multiplayer/roomSessionModel.ts`:

```ts
import { normalizeRoomCode, type ReplicatedPlayerDto, type RoomSnapshotDto } from '@kerala-story/protocol';
import type { ConnectionPhase } from '../../network/roomClient';

/** Reads ?room=CODE from a query string. Returns null rather than throwing on a malformed code. */
export function roomCodeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('room');
  if (!raw) return null;
  try { return normalizeRoomCode(raw); } catch { return null; }
}

export function remoteGuests(snapshot: RoomSnapshotDto | null, selfId: string | null): ReplicatedPlayerDto[] {
  if (!snapshot || !selfId) return [];
  return snapshot.players.filter(player => player.id !== selfId);
}

export function localGuest(snapshot: RoomSnapshotDto | null, selfId: string | null): ReplicatedPlayerDto | null {
  if (!snapshot || !selfId) return null;
  return snapshot.players.find(player => player.id === selfId) ?? null;
}

/** The world only opens once authority has confirmed this guest exists in it. */
export function canEnterWorld(phase: ConnectionPhase, snapshot: RoomSnapshotDto | null, selfId: string | null): boolean {
  return phase === 'connected' && localGuest(snapshot, selfId) !== null;
}

const ROOM_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: 'That room code was not found. Check the code, or ask for a new invite.',
  ROOM_FULL: 'That room is full. Rooms hold up to 10 guests.',
  WORLD_VERSION_MISMATCH: 'That room runs a different build of the world. Reload this page and try again.',
  ROOM_ENDED: 'That room has ended.',
  RECONNECT_DENIED: 'Your place in that room expired. Join again to get a new one.',
  INVALID_MESSAGE: 'The server rejected that request. Try again.',
};

/** Server codes and transport failures become sentences; anything else is already a sentence. */
export function roomErrorMessage(raw: string): string {
  const code = raw.split(':')[0].trim();
  if (ROOM_ERRORS[code]) return ROOM_ERRORS[code];
  if (/failed to fetch|networkerror|econnrefused|timeout|aborted/i.test(raw)) {
    return 'Could not reach the multiplayer server. If you are running locally, start it with: npm run server:dev';
  }
  return raw;
}

/** The solo save describes a client-owned body that does not exist in a room. */
export function shouldPersistSave(inRoom: boolean): boolean {
  return !inRoom;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/multiplayer/roomSessionModel.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/multiplayer/roomSessionModel.ts tests/multiplayer/roomSessionModel.test.ts
git commit -m "feat: add room session selectors and error copy"
```

---

## Task 2: Solo-save isolation guard

Proves the rule that matters most: a room session never touches the local save.

**Files:**
- Test: `tests/multiplayer/soloIsolation.test.ts`
- Modify: `src/app/App.tsx:98-104` (the `persist` callback)

**Interfaces:**
- Consumes: `shouldPersistSave` from Task 1; `writeLocalSave`, `loadLocalSave` from `src/persistence/localSaveRepository`.
- Produces: nothing new; `persist()` in App gains an `inRoom` guard.

- [ ] **Step 1: Write the failing test**

Create `tests/multiplayer/soloIsolation.test.ts`:

```ts
import { beforeEach, expect, it } from 'vitest';
import { shouldPersistSave } from '../../src/features/multiplayer/roomSessionModel';
import { loadLocalSave, writeLocalSave } from '../../src/persistence/localSaveRepository';
import { createCollectState } from '../../src/game/collectables/collectState';
import { WORLD_VERSION } from '../../src/content/world/definition';
import type { SaveV3 } from '../../src/contracts';

const soloSave: SaveV3 = {
  version: 3,
  worldVersion: WORLD_VERSION,
  collect: createCollectState(),
  locale: 'en',
  bicycle: null,
  profile: { id: 'solo', displayName: 'Solo', avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } },
  position: [11, 2, -33],
  headingRad: 1.25,
  safeSpawnId: 'origin',
  visitedLandmarkIds: ['origin'],
  settings: { quality: 'medium', muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1, cameraControl: 'auto', touchOpacity: 0.75 },
  updatedAt: new Date().toISOString(),
};

// Simulates App's persist() gate: the room position is only written when the guard allows it.
function persistOnce(inRoom: boolean, position: [number, number, number]) {
  if (!shouldPersistSave(inRoom)) return;
  writeLocalSave({ ...soloSave, position, updatedAt: new Date().toISOString() });
}

beforeEach(() => { localStorage.clear(); writeLocalSave(soloSave); });

it('leaves the solo save untouched while the player is in a room', () => {
  persistOnce(true, [900, 90, 900]);
  expect(loadLocalSave().save?.position).toEqual([11, 2, -33]);
});

it('still writes the solo save outside a room', () => {
  persistOnce(false, [42, 3, 7]);
  expect(loadLocalSave().save?.position).toEqual([42, 3, 7]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/multiplayer/soloIsolation.test.ts`
Expected: FAIL. If it fails with `localStorage is not defined`, the file needs a browser-like environment: add `// @vitest-environment jsdom` as the first line **only if** `jsdom` is already resolvable; otherwise replace `localStorage.clear()` with a minimal in-memory stub assigned to `globalThis.localStorage` before the imports run, using the same `Storage`-shaped object the repository expects. Verify which by running the test once before choosing.

- [ ] **Step 3: Add the guard in App.tsx**

In `src/app/App.tsx`, the `persist` callback currently opens with:

```tsx
  const persist=useCallback(()=>{
    if(!active||profile.id==='preview'||!restored.current)return;
```

Change it to (the `room` value arrives in Task 4; until then import `shouldPersistSave` and pass `false`):

```tsx
  const persist=useCallback(()=>{
    if(!active||profile.id==='preview'||!restored.current)return;
    if(!shouldPersistSave(inRoom))return;
```

Add the import beside the other multiplayer imports:

```tsx
import { shouldPersistSave } from '../features/multiplayer/roomSessionModel';
```

Declare the placeholder above `persist` so this task typechecks on its own; Task 4 replaces it with the real session value:

```tsx
  const inRoom=false;
```

Add `inRoom` to the `persist` dependency array.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run tests/multiplayer/soloIsolation.test.ts && npm run typecheck`
Expected: tests PASS, typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/multiplayer/soloIsolation.test.ts src/app/App.tsx
git commit -m "feat: guard the local save against room sessions"
```

---

## Task 3: Multiplayer room scene

The in-Canvas half: one authoritative local controller, one render-only avatar per other guest.

**Files:**
- Create: `src/features/multiplayer/MultiplayerRoomScene.tsx`
- Modify: `src/app/WorldCanvas.tsx`

**Interfaces:**
- Consumes: `MultiplayerSession` from `useMultiplayer`; `MultiplayerLocalController` from `src/game/player/MultiplayerLocalController`; `RemoteExplorer` from `src/game/player/RemoteExplorer`; `remoteGuests` / `localGuest` from Task 1.
- Produces:
  - `export interface MultiplayerSceneProps { session: MultiplayerSession; selfId: string | null; chatFocused: boolean }`
  - `export function MultiplayerRoomScene(props: MultiplayerSceneProps): JSX.Element | null`
  - `WorldCanvas` prop: `multiplayer?: MultiplayerSceneProps`

- [ ] **Step 1: Create the scene component**

Create `src/features/multiplayer/MultiplayerRoomScene.tsx`:

```tsx
import type { ExplorerControllerProps } from '../../contracts';
import type { MultiplayerSession } from './useMultiplayer';
import { localGuest, remoteGuests } from './roomSessionModel';
import { MultiplayerLocalController } from '../../game/player/MultiplayerLocalController';
import { RemoteExplorer } from '../../game/player/RemoteExplorer';

export interface MultiplayerSceneProps {
  session: MultiplayerSession;
  selfId: string | null;
  chatFocused: boolean;
}

/** Render-only guests sample from refs, so a moving room never re-renders React. */
export function MultiplayerRoomScene({ session, selfId, chatFocused, controller }: MultiplayerSceneProps & { controller: ExplorerControllerProps }) {
  const self = localGuest(session.snapshot, selfId);
  const others = remoteGuests(session.snapshot, selfId);
  if (!self) return null;
  return <>
    <MultiplayerLocalController player={self} session={session} controller={controller} focused={!chatFocused}/>
    {others.map(player => (
      <RemoteExplorer
        key={player.id}
        player={player}
        sample={() => session.remote.current.sample(player.id, Date.now() + (session.client.current?.serverOffsetMs ?? 0))}
        reducedMotion={controller.reducedMotion}
      />
    ))}
  </>;
}
```

- [ ] **Step 2: Wire the prop into WorldCanvas**

In `src/app/WorldCanvas.tsx`:

Add the import and extend the `SceneCanvas` signature:

```tsx
import { MultiplayerRoomScene, type MultiplayerSceneProps } from '../features/multiplayer/MultiplayerRoomScene';
```

Add `multiplayer` to the destructured props and to the props type:

```tsx
multiplayer?: MultiplayerSceneProps;
```

Replace the scene-children line:

```tsx
      {active?<ExplorerController {...controller}/>:<EstablishingCamera/>}<Ready onReady={onReady}/>
```

with:

```tsx
      {active
        ? multiplayer
          ? <MultiplayerRoomScene {...multiplayer} controller={controller}/>
          : <ExplorerController {...controller}/>
        : <EstablishingCamera/>}<Ready onReady={onReady}/>
```

Suppress the solo-only children in a room. Change the football line to require no room:

```tsx
      {active&&!multiplayer&&soccer?.active&&<SoccerMatch active playing={controller.mode==='playing'} kick={soccer.kick} onEvent={soccer.onEvent} chargeBar={soccer.chargeBar}/>}
```

and the collectables line likewise:

```tsx
      {active&&!multiplayer&&<Suspense fallback={null}><Collectables playerRef={playerRef} settings={settings} collectedIds={collectedIds} onCollect={onCollect}/></Suspense>}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If `MultiplayerLocalController` reports a missing `controller.onReady`, note that App already supplies `onPlayerReady`; do not add a default here.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS at the same counts as before this task. The two stale worktrees under `.worktrees/` may time out; report those separately and do not treat them as regressions.

- [ ] **Step 5: Commit**

```bash
git add src/features/multiplayer/MultiplayerRoomScene.tsx src/app/WorldCanvas.tsx
git commit -m "feat: render shared-room guests inside the world canvas"
```

---

## Task 4: Room session hook

Holds every piece of room state App needs, so App gains state fields rather than logic.

**Files:**
- Create: `src/app/useRoomSession.ts`

**Interfaces:**
- Consumes: `useMultiplayer` / `MultiplayerSession`; `roomCodeFromSearch`, `canEnterWorld`, `roomErrorMessage` from Task 1.
- Produces:

```ts
export interface RoomSession {
  session: MultiplayerSession;
  lobbyOpen: boolean;
  entered: boolean;
  inRoom: boolean;            // entered && a welcome exists
  selfId: string | null;
  chatFocused: boolean;
  initialCode: string;        // from ?room=, '' when absent
  canEnter: boolean;
  errorMessage: string;
  openLobby(): void;
  closeLobby(): void;
  enter(): void;
  leave(): void;
  setChatFocused(focused: boolean): void;
}
export function useRoomSession(): RoomSession;
```

- [ ] **Step 1: Write the hook**

Create `src/app/useRoomSession.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMultiplayer, type MultiplayerSession } from '../features/multiplayer/useMultiplayer';
import { canEnterWorld, roomCodeFromSearch, roomErrorMessage } from '../features/multiplayer/roomSessionModel';

export interface RoomSession {
  session: MultiplayerSession;
  lobbyOpen: boolean;
  entered: boolean;
  inRoom: boolean;
  selfId: string | null;
  chatFocused: boolean;
  initialCode: string;
  canEnter: boolean;
  errorMessage: string;
  openLobby(): void;
  closeLobby(): void;
  enter(): void;
  leave(): void;
  setChatFocused(focused: boolean): void;
}

export function useRoomSession(): RoomSession {
  const session = useMultiplayer();
  const [initialCode] = useState(() => roomCodeFromSearch(location.search) ?? '');
  const [lobbyOpen, setLobbyOpen] = useState(() => initialCode.length > 0);
  const [entered, setEntered] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);
  const selfId = session.welcome?.guestId ?? null;
  const inRoom = entered && session.welcome !== null;
  const canEnter = canEnterWorld(session.phase, session.snapshot, selfId);
  const errorMessage = useMemo(() => (session.error ? roomErrorMessage(session.error) : ''), [session.error]);

  // A room that ends underneath the player returns them to the title rather than a frozen world.
  useEffect(() => {
    if (entered && (session.phase === 'ended' || session.phase === 'error')) setEntered(false);
  }, [entered, session.phase]);

  const openLobby = useCallback(() => setLobbyOpen(true), []);
  const closeLobby = useCallback(() => setLobbyOpen(false), []);
  const enter = useCallback(() => { setEntered(true); setLobbyOpen(false); }, []);
  const leave = useCallback(() => { session.leave(); setEntered(false); setChatFocused(false); }, [session]);

  return { session, lobbyOpen, entered, inRoom, selfId, chatFocused, initialCode, canEnter, errorMessage, openLobby, closeLobby, enter, leave, setChatFocused };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/useRoomSession.ts
git commit -m "feat: add room session hook for app-level lobby state"
```

---

## Task 5: Lobby and HUD wiring in App

The task that makes multiplayer reachable. Everything before it is unreferenced until this lands.

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/multiplayer/MultiplayerEntry.tsx`
- Modify: `src/features/multiplayer/multiplayer.css`

**Interfaces:**
- Consumes: `useRoomSession` (Task 4); `MultiplayerRoomScene` props type (Task 3); `MultiplayerEntry`, `RoomStatus`.
- Produces: no new exports. `MultiplayerEntry` gains `initialCode?: string` and `errorMessage?: string` props.

- [ ] **Step 1: Accept the deep-link code and shared error copy in MultiplayerEntry**

In `src/features/multiplayer/MultiplayerEntry.tsx`, change the signature and the two lines that derive `code` and the status text:

```tsx
export function MultiplayerEntry({ session, profile, initialCode = '', errorMessage = '', onEnter, onClose }: { session: MultiplayerSession; profile: ExplorerProfile; initialCode?: string; errorMessage?: string; onEnter: () => void; onClose: () => void }) {
  const [name, setName] = useState(profile.displayName);
  const [code, setCode] = useState(initialCode);
```

and replace `session.error` in the status paragraph with `errorMessage`:

```tsx
    <p role="status">{invalid || errorMessage || (busy ? 'Connecting to your room…' : session.welcome ? `Room ${session.welcome.roomCode} · ${session.snapshot?.roster.length ?? 1}/10 guests` : '')}</p>
```

Delete the now-unused `new URLSearchParams(location.search)` initialiser.

- [ ] **Step 2: Mount the session in App**

In `src/app/App.tsx`, add the imports beside the other feature imports:

```tsx
import { useRoomSession } from './useRoomSession';
import { MultiplayerEntry } from '../features/multiplayer/MultiplayerEntry';
import { RoomStatus } from '../features/multiplayer/RoomStatus';
```

Immediately after the `const [saved,setSaved]=useState(initial.save);` line, add:

```tsx
  const room=useRoomSession();
```

Replace the Task 2 placeholder `const inRoom=false;` with:

```tsx
  const inRoom=room.inRoom;
```

- [ ] **Step 3: Enter and leave the shared world**

Add these beside `start` and `exit`:

```tsx
  const enterRoom=()=>{
    room.enter();
    restored.current=false;
    setActive(true);setMenu('none');setMode('loading');
  };
  const leaveRoom=()=>{room.leave();setActive(false);setMode('menu');setMenu('none');setDiscovery(null);};
```

`restored.current=false` matters: it keeps `persist()` from firing before the room controller has reported a first snapshot.

- [ ] **Step 4: Add the title-screen action**

In the entry screen's `entry-actions` block, after the existing secondary button, add:

```tsx
<button className="entry-secondary" onClick={room.openLobby}>Play together</button>
```

- [ ] **Step 5: Add the lobby modal**

Beside the other `ModalShell` blocks, add:

```tsx
    <ModalShell open={room.lobbyOpen} title="Play together" onClose={()=>{room.closeLobby();if(room.session.welcome&&!room.entered)room.leave();}} className="multiplayer-modal">
      <MultiplayerEntry session={room.session} profile={profile} initialCode={room.initialCode} errorMessage={room.errorMessage} onEnter={enterRoom} onClose={()=>{room.closeLobby();if(room.session.welcome&&!room.entered)room.leave();}}/>
    </ModalShell>
```

- [ ] **Step 6: Pass the scene prop and show the room HUD**

Change the `WorldCanvas` element to pass the multiplayer scene when in a room:

```tsx
<WorldCanvas locale={locale} active={active} settings={settings} controller={controller} onReady={onWorldReady} onError={onSceneError} playerRef={snapshotRef} collectedIds={collectState.collectedIds} onCollect={onCollect} soccer={soccer} multiplayer={inRoom?{session:room.session,selfId:room.selfId,chatFocused:room.chatFocused}:undefined}/>
```

Inside the HUD block, after the `hud-actions` div, add:

```tsx
{inRoom&&<RoomStatus session={room.session} onLeave={leaveRoom} onChatFocus={room.setChatFocused}/>}
```

- [ ] **Step 7: Suppress solo-only affordances in a room**

Apply each of these in `src/app/App.tsx`:

- Car and bike HUD buttons: wrap both `hud-icon` buttons that call `openCarControls` / `openBikeControls` in `{!inRoom&&(...)}`.
- Football offer: change `const soccerOffer=active&&mode==='playing'&&...` to start `const soccerOffer=!inRoom&&active&&mode==='playing'&&...`.
- Wallet: change `<WalletHud .../>` to `{!inRoom&&<WalletHud .../>}` (keep its existing props).
- Settings extras: change `{active&&snapshot.travelMode!=='bicycle'&&<button ...returnBicycle...>}` to also require `!inRoom`, and pass `onResetPosition={active&&!inRoom?resetPosition:undefined}`.
- Pause modal: change the `Save & return to title` button's `onClick` to `inRoom?leaveRoom:exit` and its label to `{inRoom?'Leave room':t('app.saveAndReturn')}` — if that translation key does not exist, keep the existing literal text for the solo case exactly as it is today.
- Scene error recovery: in the `LoadError` `onExit` handler, call `leaveRoom()` instead of `exit()` when `inRoom`.

- [ ] **Step 8: Style the lobby modal and room panel**

In `src/features/multiplayer/multiplayer.css`, add rules for `.multiplayer-modal` and `.multiplayer-room` using the shared tokens already used by `multiplayer-panel` in that file. The room panel sits in the HUD: position it with the same spacing tokens the other HUD panels use, keep it above the canvas, and make sure it does not overlap `MobileControls` at phone widths (test at 400px wide).

- [ ] **Step 9: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: both PASS. Report any `.worktrees/` timeouts separately.

- [ ] **Step 10: Commit**

```bash
git add src/app/App.tsx src/features/multiplayer/MultiplayerEntry.tsx src/features/multiplayer/multiplayer.css
git commit -m "feat: reach shared rooms from the title screen"
```

---

## Task 6: Trim RoomStatus to this milestone

The seat selector offers an action the server refuses, so it must not ship.

**Files:**
- Modify: `src/features/multiplayer/RoomStatus.tsx`

**Interfaces:**
- Consumes: `MultiplayerSession`.
- Produces: unchanged component signature `RoomStatus({ session, onLeave, onChatFocus })`.

- [ ] **Step 1: Remove the vehicle and seat block**

Delete the entire ternary that renders `multiplayer-seat` (the `self?.travel.kind === 'vehicle' ? ... : nearest && nearest.distance < 6 ? ... : null` expression), plus the now-unused `seat` state, the `SeatId` import, and the `nearest` computation.

- [ ] **Step 2: Report room errors in player language**

Replace `{session.error && <p role="alert">{session.error}</p>}` with:

```tsx
{session.error && <p role="alert">{roomErrorMessage(session.error)}</p>}
```

and import `roomErrorMessage` from `./roomSessionModel`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS, with no unused-variable errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/multiplayer/RoomStatus.tsx
git commit -m "refactor: drop seat controls the server does not accept yet"
```

---

## Task 7: Dev script, verification, and build log

**Files:**
- Modify: `package.json`
- Modify: `docs/06-build-log.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `npm run dev:all`.

- [ ] **Step 1: Add the combined dev script**

In `package.json`, beside the existing `dev` and `server:dev` scripts:

```json
    "dev:all": "npm run server:dev & npm run dev",
```

- [ ] **Step 2: Run the app and verify the two-window flow**

Run: `npm run dev:all`

Then in a browser, with two windows on `http://127.0.0.1:5000`:

1. Window A: `Play together` → `Create room`. A code appears. `Copy invite`.
2. Window A: `Enter shared world`. The world loads and the camera follows the guest.
3. Window B: open the copied invite link. The lobby opens with the code filled. `Join room`, then `Enter shared world`.
4. Both windows: walk. Each guest sees the other move, with no stutter beyond the 100 ms render delay.
5. Window C: join by typing the code. Roster shows 3/10 in all three.
6. Chat both directions. Mute one guest in window A and confirm only that guest's messages disappear there.
7. In window B, go offline for 10 seconds then back online. The guest reconnects rather than duplicating; window A's roster shows `Reconnecting` during the gap.
8. Leave the room in window A, start a solo session, confirm the saved position and discoveries are the ones from before the room.
9. Toggle device emulation to a phone: touch controls drive the guest in the room, and the room panel does not cover them.

Record exactly which of these passed. Do not claim any that were not run.

- [ ] **Step 3: Run the release gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: all three PASS. Note pre-existing warnings (Three.js CommonJS deprecation, large `WorldCanvas` chunk) and any `.worktrees/` timeouts as known and unrelated.

- [ ] **Step 4: Write the build-log entry**

Add a dated section at the top of `docs/06-build-log.md` describing what now works (on-foot shared rooms reachable from the title screen), what is still not implemented (shared vehicles, seats, public lobbies, deployment), the exact check results from Steps 2 and 3, and any manual step that was not performed.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/06-build-log.md
git commit -m "chore: add combined dev script and record multiplayer verification"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `Play together` on the title screen | 5 |
| Lobby modal wrapping `MultiplayerEntry` | 5 |
| `?room=CODE` deep link | 1 (parse), 4 (open), 5 (prefill) |
| Shared world with remote guests | 3 |
| Roster, invite copy, chat, leave | 5 (mount `RoomStatus`), 6 (trim) |
| Local save never written in a room | 2 |
| Solo systems suppressed | 3 (scene children), 5 (HUD and modals) |
| Seat UI hidden | 6 |
| Error handling copy | 1, 5, 6 |
| Reconnect behaviour | verified in 7; implemented already by `roomClient` |
| Combined dev script | 7 |
| Testing and build gate | 1, 2, 7 |

**Type consistency:** `MultiplayerSceneProps` is defined in Task 3 and consumed by the same names in Tasks 4 and 5. `RoomSession` field names (`inRoom`, `selfId`, `chatFocused`, `canEnter`, `errorMessage`) are used unchanged in Task 5. `roomErrorMessage` is defined once in Task 1 and reused in Tasks 5 and 6.

**Known gap carried deliberately:** `canEnter` is produced by the hook but `MultiplayerEntry` computes its own enter-button gate from `session.snapshot`. That duplication is acceptable this milestone; collapsing it means changing the component's props further, which is not worth a second pass here.
