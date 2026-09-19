# Luttappi & Mayavi NPCs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two roaming NPCs (Luttappi, mischievous coin-thief; Mayavi, kind coin-blesser) with proximity-triggered coin effects, LLM-backed chat, and live head icons on the world map.

**Architecture:** Movement, proximity, and coin effects are pure client simulation ticked inside the existing R3F game loop (same pattern as `Collectables.tsx`), feeding a plain position/coin-toast callback up to `App.tsx` exactly like `onSnapshot`/`onCollect` already do. Chat is the only networked part: a thin client fetch wrapper posts to a new `POST /npc/chat` endpoint on the existing `apps/server` Colyseus/Express host, which holds the Gemini/OpenRouter keys and never returns an error to the client (always a reply, real or canned-fallback).

**Tech Stack:** React 19 + React Three Fiber (client), Zod validation, Vitest, Node/Express-style HTTP handler on `@colyseus/core`'s `createEndpoint` (apps/server), Gemini API + OpenRouter API (server-side only).

**Spec:** `docs/superpowers/specs/2026-09-18-npc-agents-design.md`

## Global Constraints

- `GEMINI_API_KEY` and `OPENROUTER_API_KEY` live only in `apps/server` environment variables, never prefixed `VITE_`, never sent to or read by client code.
- Luttappi's coin theft must never take `collectState.coins` below 0.
- Mayavi's blessing has a soft daily cap (mirrors the existing local-midnight `dateKey` pattern already used by `collectState.ts`).
- `/npc/chat` is rate-limited per IP (reuse `IpLimiter` from `apps/server/src/config.ts`), tighter than the existing chat limiter since LLM calls cost money.
- Chat never surfaces a network/provider error to the player — on any failure the server returns `NPC_UNAVAILABLE` and/or the client falls back to a canned in-character line.
- Before calling any task complete: `npm run typecheck`, `npm test`, `npm run build` must all pass.

---

### Task 1: NPC definitions and pure wander/proximity/coin-effect state

**Files:**
- Create: `src/game/npc/npcDefinitions.ts`
- Create: `src/game/npc/npcState.ts`
- Test: `tests/npcState.test.ts`

**Interfaces:**
- Produces: `NpcId = 'luttappi' | 'mayavi'`, `NpcDefinition` (from `npcDefinitions.ts`), `NPC_DEFINITIONS: Record<NpcId, NpcDefinition>`, and from `npcState.ts`: `NpcRuntimeState`, `createNpcState(def, now, rngSeed)`, `tickNpcWander(state, def, dtMs, rng)`, `isPlayerInRange(state, def, playerPos): boolean`, `rollCoinEffect(state, def, now, rng): { state: NpcRuntimeState; coinsDelta: number } | null`, `scareAway(state, def, mayaviPos, rng): NpcRuntimeState`.
- Consumes: `Vec3`, `ZoneId` from `../../contracts`; `LANDMARKS`, `terrainHeight`, `isWater`, `hasGroundAt`, `WORLD_BOUNDS` from `../../content/world/definition`.

- [ ] **Step 1: Write `npcDefinitions.ts`**

```ts
// src/game/npc/npcDefinitions.ts
import type { ZoneId } from '../../contracts';

export type NpcId = 'luttappi' | 'mayavi';

export interface NpcDefinition {
  id: NpcId;
  name: string;
  disposition: 'mischievous' | 'kind';
  skin: string;
  cloth: string;
  horn: string;
  zoneIds: ZoneId[];
  proximityRadiusM: number;
  scareRadiusM: number;
  effectIntervalMs: number;
  effectChance: number;
  minCoinDelta: number;
  maxCoinDelta: number;
}

export const NPC_DEFINITIONS: Record<NpcId, NpcDefinition> = {
  luttappi: {
    id: 'luttappi', name: 'Luttappi', disposition: 'mischievous',
    skin: '#c9622f', cloth: '#4c8a55', horn: '#2b2117',
    zoneIds: ['kodassery', 'kadambode', 'kurumali', 'kodaly'],
    proximityRadiusM: 4, scareRadiusM: 12,
    effectIntervalMs: 8000, effectChance: 0.35,
    minCoinDelta: -2, maxCoinDelta: -1,
  },
  mayavi: {
    id: 'mayavi', name: 'Mayavi', disposition: 'kind',
    skin: '#e0b27a', cloth: '#d7a92a', horn: '#1c1a17',
    zoneIds: ['kodassery', 'kadambode', 'kurumali', 'kodaly'],
    proximityRadiusM: 4, scareRadiusM: 12,
    effectIntervalMs: 12000, effectChance: 0.3,
    minCoinDelta: 1, maxCoinDelta: 3,
  },
};
```

- [ ] **Step 2: Write the failing test for `npcState.ts`**

```ts
// tests/npcState.test.ts
import { describe, expect, it } from 'vitest';
import { NPC_DEFINITIONS } from '../src/game/npc/npcDefinitions';
import { createNpcState, tickNpcWander, isPlayerInRange, rollCoinEffect, scareAway } from '../src/game/npc/npcState';

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('npcState', () => {
  it('picks a new target on arrival and stays within the configured zones', () => {
    const def = NPC_DEFINITIONS.mayavi;
    let state = createNpcState(def, 0, 1);
    const firstTarget = state.targetPosition;
    // Force arrival by placing the NPC on the target, then tick once more.
    state = { ...state, position: firstTarget };
    state = tickNpcWander(state, def, 500, seededRng(2));
    expect(state.targetPosition).not.toEqual(firstTarget);
  });

  it('reports in-range only within proximityRadiusM', () => {
    const def = NPC_DEFINITIONS.luttappi;
    const state = createNpcState(def, 0, 3);
    const close: [number, number, number] = [state.position[0] + 1, state.position[1], state.position[2]];
    const far: [number, number, number] = [state.position[0] + 100, state.position[1], state.position[2]];
    expect(isPlayerInRange(state, def, close)).toBe(true);
    expect(isPlayerInRange(state, def, far)).toBe(false);
  });

  it('never rolls a coin effect before effectIntervalMs has elapsed', () => {
    const def = NPC_DEFINITIONS.luttappi;
    let state = createNpcState(def, 0, 4);
    state = { ...state, nextEffectAt: 8000 };
    expect(rollCoinEffect(state, def, 1000, seededRng(5))).toBeNull();
  });

  it('is deterministic for a seeded rng and clamps to the defined delta range', () => {
    const def = NPC_DEFINITIONS.luttappi;
    const state = { ...createNpcState(def, 0, 6), nextEffectAt: 0 };
    const a = rollCoinEffect(state, def, 8000, seededRng(7));
    const b = rollCoinEffect(state, def, 8000, seededRng(7));
    expect(a?.coinsDelta).toBe(b?.coinsDelta);
    if (a) expect(a.coinsDelta).toBeGreaterThanOrEqual(def.minCoinDelta);
    if (a) expect(a.coinsDelta).toBeLessThanOrEqual(def.maxCoinDelta);
  });

  it('moves Luttappi away from a player when Mayavi is within scareRadiusM', () => {
    const def = NPC_DEFINITIONS.luttappi;
    const state = createNpcState(def, 0, 8);
    const mayaviPos: [number, number, number] = [state.position[0] + 2, state.position[1], state.position[2]];
    const scared = scareAway(state, def, mayaviPos, seededRng(9));
    const before = Math.hypot(state.targetPosition[0] - mayaviPos[0], state.targetPosition[2] - mayaviPos[2]);
    const after = Math.hypot(scared.targetPosition[0] - mayaviPos[0], scared.targetPosition[2] - mayaviPos[2]);
    expect(after).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/npcState.test.ts`
Expected: FAIL — `npcState` module does not exist.

- [ ] **Step 4: Write `npcState.ts`**

```ts
// src/game/npc/npcState.ts
import type { Vec3 } from '../../contracts';
import { LANDMARKS, terrainHeight, isWater, hasGroundAt, WORLD_BOUNDS } from '../../content/world/definition';
import type { NpcDefinition, NpcId } from './npcDefinitions';

export interface NpcRuntimeState {
  id: NpcId;
  position: Vec3;
  targetPosition: Vec3;
  nextEffectAt: number;
}

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

/** A walkable point within `radius` of an anchor, falling back to the anchor itself. */
function sampleNear(anchor: Vec3, radius: number, rng: () => number): Vec3 {
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = rng() * Math.PI * 2, dist = rng() * radius;
    const x = clamp(anchor[0] + Math.cos(angle) * dist, WORLD_BOUNDS.xMin, WORLD_BOUNDS.xMax);
    const z = clamp(anchor[2] + Math.sin(angle) * dist, WORLD_BOUNDS.zMin, WORLD_BOUNDS.zMax);
    if (isWater(x, z) || !hasGroundAt(x, z)) continue;
    return [x, terrainHeight(x, z), z];
  }
  return anchor;
}

function pickAnchor(def: NpcDefinition, rng: () => number): Vec3 {
  const candidates = LANDMARKS.filter(l => def.zoneIds.includes(l.zoneId));
  const pool = candidates.length ? candidates : LANDMARKS;
  const chosen = pool[Math.floor(rng() * pool.length) % pool.length];
  return chosen.position;
}

export function createNpcState(def: NpcDefinition, now: number, rngSeed: number): NpcRuntimeState {
  const rng = seededRng(rngSeed);
  const start = sampleNear(pickAnchor(def, rng), 20, rng);
  return { id: def.id, position: start, targetPosition: sampleNear(pickAnchor(def, rng), 30, rng), nextEffectAt: now + def.effectIntervalMs };
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const WALK_SPEED_MPS = 1.2;
const ARRIVE_M = 1.5;

export function tickNpcWander(state: NpcRuntimeState, def: NpcDefinition, dtMs: number, rng: () => number): NpcRuntimeState {
  const [px, , pz] = state.position, [tx, , tz] = state.targetPosition;
  const dx = tx - px, dz = tz - pz, dist = Math.hypot(dx, dz);
  if (dist <= ARRIVE_M) {
    return { ...state, targetPosition: sampleNear(pickAnchor(def, rng), 30, rng) };
  }
  const step = Math.min(dist, WALK_SPEED_MPS * (dtMs / 1000));
  const nx = px + (dx / dist) * step, nz = pz + (dz / dist) * step;
  return { ...state, position: [nx, terrainHeight(nx, nz), nz] };
}

export function isPlayerInRange(state: NpcRuntimeState, def: NpcDefinition, playerPos: Vec3): boolean {
  const distance = Math.hypot(state.position[0] - playerPos[0], state.position[2] - playerPos[2]);
  return distance <= def.proximityRadiusM;
}

export function rollCoinEffect(state: NpcRuntimeState, def: NpcDefinition, now: number, rng: () => number): { state: NpcRuntimeState; coinsDelta: number } | null {
  if (now < state.nextEffectAt) return null;
  const next = { ...state, nextEffectAt: now + def.effectIntervalMs };
  if (rng() > def.effectChance) return { state: next, coinsDelta: 0 };
  const span = def.maxCoinDelta - def.minCoinDelta;
  const magnitude = def.minCoinDelta + Math.round(rng() * span);
  return { state: next, coinsDelta: magnitude };
}

export function scareAway(state: NpcRuntimeState, def: NpcDefinition, mayaviPos: Vec3, rng: () => number): NpcRuntimeState {
  const dx = state.position[0] - mayaviPos[0], dz = state.position[2] - mayaviPos[2];
  const away = Math.hypot(dx, dz) > 0 ? [dx, dz] : [1, 0];
  const len = Math.hypot(away[0], away[1]);
  const anchor: Vec3 = [state.position[0] + (away[0] / len) * 25, state.position[1], state.position[2] + (away[1] / len) * 25];
  return { ...state, targetPosition: sampleNear(anchor, 15, rng) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/npcState.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/game/npc/npcDefinitions.ts src/game/npc/npcState.ts tests/npcState.test.ts
git commit -m "feat: add NPC wander/proximity/coin-effect state"
```

---

### Task 2: Mission stubs data

**Files:**
- Create: `src/content/world/missionStubs.ts`
- Test: `tests/missionStubs.test.ts`

**Interfaces:**
- Produces: `MissionStub { id: string; zoneId: ZoneId; title: string; hint: string }`, `MISSION_STUBS: MissionStub[]`.
- Consumes: `ZoneId` from `../../contracts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/missionStubs.test.ts
import { describe, expect, it } from 'vitest';
import { MISSION_STUBS } from '../src/content/world/missionStubs';

describe('missionStubs', () => {
  it('has at least four unique, non-empty stubs with valid zone ids', () => {
    const zoneIds = new Set(['kodassery', 'kadambode', 'kurumali', 'kodaly']);
    expect(MISSION_STUBS.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(MISSION_STUBS.map(m => m.id));
    expect(ids.size).toBe(MISSION_STUBS.length);
    for (const stub of MISSION_STUBS) {
      expect(zoneIds.has(stub.zoneId)).toBe(true);
      expect(stub.title.length).toBeGreaterThan(0);
      expect(stub.hint.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/missionStubs.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `missionStubs.ts`**

```ts
// src/content/world/missionStubs.ts
import type { ZoneId } from '../../contracts';

export interface MissionStub { id: string; zoneId: ZoneId; title: string; hint: string }

export const MISSION_STUBS: MissionStub[] = [
  { id: 'lost-boat-key', zoneId: 'kodaly', title: 'The jetty boatman lost his key', hint: 'Somewhere near the harbor jetty, half-buried in the sand.' },
  { id: 'tea-shop-delivery', zoneId: 'kadambode', title: "Rajan's tea needs a delivery", hint: 'A basket is waiting near the tea shop for someone headed to the market.' },
  { id: 'coconut-count', zoneId: 'kodassery', title: 'The canopy homes need a coconut count', hint: 'Climb toward the forest junction and count what you find along the way.' },
  { id: 'bridge-toll-riddle', zoneId: 'kurumali', title: 'The bridge keeper has a riddle', hint: 'Ask around near the river bridge — the answer floats downstream.' },
  { id: 'summit-flag', zoneId: 'kodassery', title: 'A flag waits at the summit trailhead', hint: 'Follow the summit track as far as your legs can carry you.' },
  { id: 'fishing-bank-net', zoneId: 'kodaly', title: 'A net went missing from the fishing bank', hint: 'Check along the shoreline near where the fishers gather at dawn.' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/missionStubs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/world/missionStubs.ts tests/missionStubs.test.ts
git commit -m "feat: add placeholder mission stubs for NPC chat context"
```

---

### Task 3: NPC procedural character + in-scene container

**Files:**
- Create: `src/game/npc/NpcCharacter.tsx`
- Create: `src/game/npc/Npcs.tsx`
- Modify: `src/app/WorldCanvas.tsx`

**Interfaces:**
- Consumes: `NPC_DEFINITIONS`, `NpcId` from `./npcDefinitions`; `NpcRuntimeState`, `createNpcState`, `tickNpcWander`, `isPlayerInRange`, `rollCoinEffect`, `scareAway` from `./npcState`; `RefObject<PlayerSnapshot>` (same `playerRef` prop `Collectables` already takes).
- Produces: `Npcs` component with props `{ playerRef: RefObject<PlayerSnapshot>; onCoinEffect: (npcId: NpcId, coinsDelta: number) => void; onPositionsChange: (positions: Record<NpcId, Vec3>) => void; onProximity: (npcId: NpcId | null) => void }`. `NpcCharacter` component with props `{ definition: NpcDefinition; position: Vec3 }`.

- [ ] **Step 1: Write `NpcCharacter.tsx`**

Reuses the box/capsule primitive style already used by `ProceduralAvatar` in `src/game/player/ExplorerAvatar.tsx`, adding two horn cones.

```tsx
// src/game/npc/NpcCharacter.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Vec3 } from '../../contracts';
import type { NpcDefinition } from './npcDefinitions';

export function NpcCharacter({ definition, position }: { definition: NpcDefinition; position: Vec3 }) {
  const root = useRef<Group>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    if (!root.current) return;
    phase.current += delta * 3;
    root.current.position.set(position[0], position[1], position[2]);
    root.current.rotation.z = Math.sin(phase.current) * 0.03;
  });
  return (
    <group ref={root}>
      <mesh position={[0, 0.55, 0]} castShadow><capsuleGeometry args={[0.22, 0.5, 4, 8]}/><meshStandardMaterial color={definition.cloth}/></mesh>
      <mesh position={[0, 1.02, 0]} castShadow><sphereGeometry args={[0.16, 16, 16]}/><meshStandardMaterial color={definition.skin}/></mesh>
      <mesh position={[-0.08, 1.16, 0]} rotation={[0, 0, -0.4]} castShadow><coneGeometry args={[0.03, 0.12, 8]}/><meshStandardMaterial color={definition.horn}/></mesh>
      <mesh position={[0.08, 1.16, 0]} rotation={[0, 0, 0.4]} castShadow><coneGeometry args={[0.03, 0.12, 8]}/><meshStandardMaterial color={definition.horn}/></mesh>
    </group>
  );
}
```

- [ ] **Step 2: Write `Npcs.tsx`**

```tsx
// src/game/npc/Npcs.tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { PlayerSnapshot, Vec3 } from '../../contracts';
import { NPC_DEFINITIONS, type NpcId } from './npcDefinitions';
import { createNpcState, tickNpcWander, isPlayerInRange, rollCoinEffect, scareAway, type NpcRuntimeState } from './npcState';
import { NpcCharacter } from './NpcCharacter';

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Props {
  playerRef: RefObject<PlayerSnapshot>;
  onCoinEffect: (npcId: NpcId, coinsDelta: number) => void;
  onPositionsChange: (positions: Record<NpcId, Vec3>) => void;
  onProximity: (npcId: NpcId | null) => void;
}

export function Npcs({ playerRef, onCoinEffect, onPositionsChange, onProximity }: Props) {
  const rng = useMemo(() => seededRng(Date.now() >>> 0), []);
  const states = useRef<Record<NpcId, NpcRuntimeState>>({
    luttappi: createNpcState(NPC_DEFINITIONS.luttappi, 0, 101),
    mayavi: createNpcState(NPC_DEFINITIONS.mayavi, 0, 202),
  });
  const positionsThrottle = useRef(0);

  useFrame((_, delta) => {
    const now = performance.now();
    const dtMs = delta * 1000;
    const player = playerRef.current;
    let luttappi = tickNpcWander(states.current.luttappi, NPC_DEFINITIONS.luttappi, dtMs, rng);
    let mayavi = tickNpcWander(states.current.mayavi, NPC_DEFINITIONS.mayavi, dtMs, rng);

    if (Math.hypot(luttappi.position[0] - mayavi.position[0], luttappi.position[2] - mayavi.position[2]) <= NPC_DEFINITIONS.luttappi.scareRadiusM
      && player && isPlayerInRange(luttappi, NPC_DEFINITIONS.luttappi, player.position)) {
      luttappi = scareAway(luttappi, NPC_DEFINITIONS.luttappi, mayavi.position, rng);
    }

    let inRangeId: NpcId | null = null;
    if (player) {
      for (const [id, state, def] of [['luttappi', luttappi, NPC_DEFINITIONS.luttappi], ['mayavi', mayavi, NPC_DEFINITIONS.mayavi]] as const) {
        if (isPlayerInRange(state, def, player.position)) {
          inRangeId = id;
          const rolled = rollCoinEffect(state, def, now, rng);
          if (rolled) {
            if (id === 'luttappi') luttappi = rolled.state; else mayavi = rolled.state;
            if (rolled.coinsDelta !== 0) onCoinEffect(id, rolled.coinsDelta);
          }
        }
      }
    }
    onProximity(inRangeId);

    states.current = { luttappi, mayavi };
    positionsThrottle.current += dtMs;
    if (positionsThrottle.current >= 150) {
      positionsThrottle.current = 0;
      onPositionsChange({ luttappi: luttappi.position, mayavi: mayavi.position });
    }
  });

  return <><NpcCharacter definition={NPC_DEFINITIONS.luttappi} position={states.current.luttappi.position}/><NpcCharacter definition={NPC_DEFINITIONS.mayavi} position={states.current.mayavi.position}/></>;
}
```

- [ ] **Step 3: Wire `Npcs` into `WorldCanvas.tsx`**

In `src/app/WorldCanvas.tsx`, add the import and a new required prop to `SceneCanvas`'s props type and render call, next to the existing `Collectables` line (~line 73):

```tsx
import { Npcs } from '../game/npc/Npcs';
import type { NpcId } from '../game/npc/npcDefinitions';
```

Extend the `SceneCanvas` props destructure and type (same line as `collectedIds,onCollect,soccer,multiplayer`) with `onNpcCoinEffect,onNpcPositions,onNpcProximity`:

```tsx
onNpcCoinEffect:(npcId:NpcId,coinsDelta:number)=>void;onNpcPositions:(positions:Record<NpcId,[number,number,number]>)=>void;onNpcProximity:(npcId:NpcId|null)=>void
```

And render unconditionally under `active` (works in both solo and multiplayer, unlike `Collectables`):

```tsx
{active&&<Npcs playerRef={playerRef} onCoinEffect={onNpcCoinEffect} onPositionsChange={onNpcPositions} onProximity={onNpcProximity}/>}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: fails only on `App.tsx` not yet passing the new `WorldCanvas` props — confirm the error is exactly the three missing props, nothing else.

- [ ] **Step 5: Commit**

```bash
git add src/game/npc/NpcCharacter.tsx src/game/npc/Npcs.tsx src/app/WorldCanvas.tsx
git commit -m "feat: render wandering NPCs in the game scene"
```

---

### Task 4: Wire NPCs into App.tsx (positions, coin effects, wallet toast)

**Files:**
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `Npcs` props from Task 3 (`onNpcCoinEffect`, `onNpcPositions`, `onNpcProximity`); `NpcId` from `../game/npc/npcDefinitions`; existing `setCollectState`, `haptic`.
- Produces: `npcPositions: Record<NpcId, Vec3> | null` state (consumed by Task 5's map pins and Task 6's chat panel); `npcInRange: NpcId | null` state (consumed by Task 6); `npcToast: { npcId: NpcId; coinsDelta: number } | null` state.

- [ ] **Step 1: Add state and callbacks**

Near the existing `collectState`/`onCollect` block (~line 120-121 of `src/app/App.tsx`):

```tsx
const [npcPositions,setNpcPositions]=useState<Record<NpcId,Vec3>|null>(null);
const [npcInRange,setNpcInRange]=useState<NpcId|null>(null);
const [npcToast,setNpcToast]=useState<{npcId:NpcId;coinsDelta:number}|null>(null);
// Session-only anti-farming cap on Mayavi's blessing; not persisted to the save (a soft
// nudge, not a ledger), so it resets on reload as well as at local midnight.
const NPC_BLESS_DAILY_CAP=40;
const npcBlessedRef=useRef<{dateKey:string;total:number}>({dateKey:todayKey(),total:0});
const onNpcPositions=useCallback((positions:Record<NpcId,Vec3>)=>setNpcPositions(positions),[]);
const onNpcProximity=useCallback((npcId:NpcId|null)=>setNpcInRange(npcId),[]);
const onNpcCoinEffect=useCallback((npcId:NpcId,coinsDelta:number)=>{
  const today=todayKey();
  if(npcBlessedRef.current.dateKey!==today)npcBlessedRef.current={dateKey:today,total:0};
  if(coinsDelta>0){
    if(npcBlessedRef.current.total>=NPC_BLESS_DAILY_CAP)return;
    npcBlessedRef.current.total+=coinsDelta;
  }
  setCollectState(state=>({...state,coins:Math.max(0,state.coins+coinsDelta)}));
  haptic(coinsDelta<0?[10,30,10]:12);
  setNpcToast({npcId,coinsDelta});
},[haptic]);
useEffect(()=>{if(!npcToast)return;const t=setTimeout(()=>setNpcToast(null),3200);return()=>clearTimeout(t);},[npcToast]);
```

`todayKey` is already imported from `../game/collectables/collectState` (used a few lines above by `collectState`'s initializer) — no new import needed for it.

Add the import: `import type { NpcId } from '../game/npc/npcDefinitions';`

- [ ] **Step 2: Pass the new props to `WorldCanvas`**

On the `<WorldCanvas .../>` line (~line 275), add:

```tsx
onNpcCoinEffect={onNpcCoinEffect} onNpcPositions={onNpcPositions} onNpcProximity={onNpcProximity}
```

- [ ] **Step 3: Render the coin-effect toast**

Next to the existing discovery toast rendering in the HUD (search for `discovery` usage in the JSX), add a sibling toast for `npcToast`:

```tsx
{npcToast&&<div className="npc-toast" role="status">{npcToast.coinsDelta<0?`Luttappi took ${Math.abs(npcToast.coinsDelta)} coin${Math.abs(npcToast.coinsDelta)>1?'s':''}!`:`Mayavi blessed you with ${npcToast.coinsDelta} coin${npcToast.coinsDelta>1?'s':''}!`}</div>}
```

(Task 9 replaces these literals with the localized, interpolated versions once the locale keys exist.)

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS — `WorldCanvas` now receives all required props.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: wire NPC coin effects and positions into App state"
```

---

### Task 5: NPC head pins on the world map

**Files:**
- Modify: `src/features/map/ExplorerMap.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/npcMapPins.test.ts`

**Interfaces:**
- Consumes: `npcPositions` state from Task 4; `NPC_DEFINITIONS` from `../../game/npc/npcDefinitions`; existing `Pin`, `point` helpers in `ExplorerMap.tsx`.
- Produces: exported pure helper `npcPinIcon(npcId: NpcId): Icon` (a Phosphor-`Icon`-shaped component) from a new small module, testable without rendering the map.

- [ ] **Step 1: Write the failing test**

```ts
// tests/npcMapPins.test.ts
import { describe, expect, it } from 'vitest';
import { npcPinIcon } from '../src/features/map/npcPinIcon';

describe('npcPinIcon', () => {
  it('returns a distinct renderable icon per NPC id', () => {
    expect(npcPinIcon('luttappi')).toBeDefined();
    expect(npcPinIcon('mayavi')).toBeDefined();
    expect(npcPinIcon('luttappi')).not.toBe(npcPinIcon('mayavi'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/npcMapPins.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `npcPinIcon.tsx`**

A minimal SVG "face" matching the `Icon` shape `Pin` already expects (`x,y,width,height,color`), horns colored per NPC:

```tsx
// src/features/map/npcPinIcon.tsx
import type { NpcId } from '../../game/npc/npcDefinitions';

function makeFaceIcon(hornColor: string) {
  return function FaceIcon({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) {
    const cx = x + width / 2, cy = y + height / 2, r = width / 2;
    return (
      <g>
        <path d={`M ${cx - r * 0.7} ${cy - r * 0.55} L ${cx - r * 0.25} ${cy - r} L ${cx - r * 0.1} ${cy - r * 0.4} Z`} fill={hornColor}/>
        <path d={`M ${cx + r * 0.7} ${cy - r * 0.55} L ${cx + r * 0.25} ${cy - r} L ${cx + r * 0.1} ${cy - r * 0.4} Z`} fill={hornColor}/>
        <circle cx={cx} cy={cy} r={r * 0.55} fill={color}/>
      </g>
    );
  };
}

const ICONS = { luttappi: makeFaceIcon('#2b2117'), mayavi: makeFaceIcon('#1c1a17') };

export function npcPinIcon(id: NpcId) { return ICONS[id]; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/npcMapPins.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `npcs` prop to `ExplorerMap`**

In `src/features/map/ExplorerMap.tsx`, extend `Props` (line 17):

```tsx
interface Props {player:PlayerSnapshot;visited:string[];waypoint:Vec3|null;onWaypoint:(position:Vec3|null)=>void;compact?:boolean;npcs?:{id:NpcId;position:Vec3}[]}
```

Add imports:

```tsx
import type { NpcId } from '../../game/npc/npcDefinitions';
import { npcPinIcon } from './npcPinIcon';
import { NPC_DEFINITIONS } from '../../game/npc/npcDefinitions';
```

Render pins alongside the existing `LANDMARKS.map(...)` line (~line 269), using each NPC's `skin` color from `NPC_DEFINITIONS` for the fill:

```tsx
{npcs?.map(n=>{const [x,y]=point(n.position),def=NPC_DEFINITIONS[n.id];return <Pin key={n.id} x={x} y={y} r={(compact?4:5.5)*k*(compact?2.2:1)} color={def.horn} fill={def.skin} icon={npcPinIcon(n.id)} iconColor={def.skin}/>;})}
```

- [ ] **Step 6: Pass `npcPositions` from `App.tsx` into `ExplorerMap`**

`App.tsx` renders `ExplorerMap` twice: the minimap button (`compact`) and the full map screen. Add to both call sites:

```tsx
npcs={npcPositions?(Object.entries(npcPositions) as [NpcId,Vec3][]).map(([id,position])=>({id,position})):undefined}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/map/npcPinIcon.tsx src/features/map/ExplorerMap.tsx src/app/App.tsx tests/npcMapPins.test.ts
git commit -m "feat: show live Luttappi/Mayavi head pins on the world map"
```

---

### Task 6: Client chat fetch wrapper with canned fallback

**Files:**
- Create: `src/game/npc/npcClient.ts`
- Test: `tests/npcClient.test.ts`

**Interfaces:**
- Consumes: `NpcId` from `./npcDefinitions`.
- Produces: `NpcChatRequest { npcId: NpcId; message: string; zoneId: string }`, `NpcChatResult { reply: string; fallback: boolean }`, `askNpc(req: NpcChatRequest, baseUrl: string): Promise<NpcChatResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/npcClient.test.ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import { askNpc } from '../src/game/npc/npcClient';

describe('askNpc', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns the server reply on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Hee hee, catch me if you can!' }) }));
    const result = await askNpc({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, 'http://example.test');
    expect(result).toEqual({ reply: 'Hee hee, catch me if you can!', fallback: false });
  });

  it('falls back to a canned line on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'NPC_UNAVAILABLE' }) }));
    const result = await askNpc({ npcId: 'mayavi', message: 'hi', zoneId: 'kodaly' }, 'http://example.test');
    expect(result.fallback).toBe(true);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it('falls back to a canned line when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await askNpc({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, 'http://example.test');
    expect(result.fallback).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/npcClient.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `npcClient.ts`**

```ts
// src/game/npc/npcClient.ts
import type { NpcId } from './npcDefinitions';

export interface NpcChatRequest { npcId: NpcId; message: string; zoneId: string }
export interface NpcChatResult { reply: string; fallback: boolean }

const FALLBACK_LINES: Record<NpcId, string> = {
  luttappi: "Luttappi vanishes into the trees, giggling — he'll be back.",
  mayavi: 'Mayavi smiles quietly and points ahead before fading from view.',
};

const TIMEOUT_MS = 6000;

export async function askNpc(req: NpcChatRequest, baseUrl: string): Promise<NpcChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/npc/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!response.ok) return { reply: FALLBACK_LINES[req.npcId], fallback: true };
    const data = await response.json() as { reply?: string };
    if (!data.reply) return { reply: FALLBACK_LINES[req.npcId], fallback: true };
    return { reply: data.reply, fallback: false };
  } catch {
    return { reply: FALLBACK_LINES[req.npcId], fallback: true };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/npcClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/npc/npcClient.ts tests/npcClient.test.ts
git commit -m "feat: add NPC chat client with offline-safe fallback"
```

---

### Task 7: Server-side `/npc/chat` handler (Gemini primary, OpenRouter fallback)

**Files:**
- Create: `apps/server/src/npcChat.ts`
- Test: `apps/server/tests/npcChat.test.ts`

**Interfaces:**
- Consumes: `ChatTextSchema`-style validation approach via `sanitizePlainText` from `@kerala-story/protocol`; `IpLimiter` from `./config.ts`.
- Produces: `NpcChatEnv { geminiApiKey?: string; openRouterApiKey?: string; openRouterModel?: string; fetchImpl?: typeof fetch }`, `handleNpcChat(body: unknown, env: NpcChatEnv): Promise<{ reply: string } | { error: 'INVALID_MESSAGE' | 'NPC_UNAVAILABLE' }>`, `npcChatLimiter: IpLimiter` (instantiated in this module, tighter window than the existing default).

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/tests/npcChat.test.ts
import { describe, expect, it, vi } from 'vitest';
import { handleNpcChat } from '../src/npcChat.ts';

function fetchSequence(...responses: Array<{ ok: boolean; json: () => Promise<unknown> } | Error>) {
  let i = 0;
  return vi.fn(async () => {
    const next = responses[Math.min(i++, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
}

describe('handleNpcChat', () => {
  it('rejects an invalid body', async () => {
    const result = await handleNpcChat({ npcId: 'not-real', message: 'hi', zoneId: 'kodaly' }, {});
    expect(result).toEqual({ error: 'INVALID_MESSAGE' });
  });

  it('rejects an over-length message', async () => {
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'x'.repeat(500), zoneId: 'kodaly' }, {});
    expect(result).toEqual({ error: 'INVALID_MESSAGE' });
  });

  it('returns the Gemini reply on success', async () => {
    const fetchImpl = fetchSequence({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hee hee!' }] } }] }) });
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, { geminiApiKey: 'g', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ reply: 'Hee hee!' });
  });

  it('falls back to OpenRouter when Gemini fails', async () => {
    const fetchImpl = fetchSequence(
      { ok: false, json: async () => ({}) },
      { ok: true, json: async () => ({ choices: [{ message: { content: 'Be careful, traveler.' } }] }) },
    );
    const result = await handleNpcChat({ npcId: 'mayavi', message: 'hi', zoneId: 'kodaly' }, { geminiApiKey: 'g', openRouterApiKey: 'o', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ reply: 'Be careful, traveler.' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns NPC_UNAVAILABLE when both providers fail', async () => {
    const fetchImpl = fetchSequence(new Error('down'), new Error('down'));
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, { geminiApiKey: 'g', openRouterApiKey: 'o', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ error: 'NPC_UNAVAILABLE' });
  });

  it('returns NPC_UNAVAILABLE when no keys are configured', async () => {
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, {});
    expect(result).toEqual({ error: 'NPC_UNAVAILABLE' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run tests/npcChat.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `npcChat.ts`**

```ts
// apps/server/src/npcChat.ts
import { z } from 'zod';
import { sanitizePlainText } from '@kerala-story/protocol';
import { MISSION_STUBS } from '../../../src/content/world/missionStubs.ts';
import { IpLimiter } from './config.ts';

const NpcChatBodySchema = z.object({
  npcId: z.enum(['luttappi', 'mayavi']),
  message: z.string().min(1).max(300),
  zoneId: z.enum(['kodassery', 'kadambode', 'kurumali', 'kodaly']),
}).strict();

export interface NpcChatEnv {
  geminiApiKey?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  fetchImpl?: typeof fetch;
}

const PERSONAS: Record<'luttappi' | 'mayavi', string> = {
  luttappi: "You are Luttappi, a naughty kuttichathan (a mischievous forest spirit from Kerala folklore). You love pranks, teasing travelers, and playful misdirection — but never anything truly mean or unsafe. Keep replies short (1-3 sentences), in character, a little cheeky. When asked about missions, you may playfully misdirect rather than give the real answer.",
  mayavi: 'You are Mayavi, a kind kuttichathan who protects travelers, offers gentle guidance, and keeps Luttappi in check. Keep replies short (1-3 sentences), warm and encouraging. When asked about missions, give a genuine, helpful hint.',
};

function missionContext(zoneId: string): string {
  const relevant = MISSION_STUBS.filter(m => m.zoneId === zoneId);
  const list = (relevant.length ? relevant : MISSION_STUBS).map(m => `- ${m.title}: ${m.hint}`).join('\n');
  return `Known local happenings you can reference:\n${list}`;
}

export const npcChatLimiter = new IpLimiter(10, 60_000);

async function askGemini(apiKey: string, systemPrompt: string, message: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: message }] }] }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

async function askOpenRouter(apiKey: string, model: string, systemPrompt: string, message: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }] }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

export async function handleNpcChat(body: unknown, env: NpcChatEnv): Promise<{ reply: string } | { error: 'INVALID_MESSAGE' | 'NPC_UNAVAILABLE' }> {
  const parsed = NpcChatBodySchema.safeParse(body);
  if (!parsed.success) return { error: 'INVALID_MESSAGE' };
  let message: string;
  try { message = sanitizePlainText(parsed.data.message); } catch { return { error: 'INVALID_MESSAGE' }; }

  const systemPrompt = `${PERSONAS[parsed.data.npcId]}\n\n${missionContext(parsed.data.zoneId)}`;
  const fetchImpl = env.fetchImpl ?? fetch;

  if (env.geminiApiKey) {
    const reply = await askGemini(env.geminiApiKey, systemPrompt, message, fetchImpl);
    if (reply) return { reply };
  }
  if (env.openRouterApiKey) {
    const reply = await askOpenRouter(env.openRouterApiKey, env.openRouterModel ?? 'google/gemini-2.0-flash-001', systemPrompt, message, fetchImpl);
    if (reply) return { reply };
  }
  return { error: 'NPC_UNAVAILABLE' };
}
```

`@kerala-story/protocol`'s package export must include `sanitizePlainText`; if it is not currently re-exported from the package root, add `export { sanitizePlainText } from './text.ts';` to `packages/protocol/src/index.ts` (check the file first — only add if missing).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && npx vitest run tests/npcChat.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/npcChat.ts apps/server/tests/npcChat.test.ts packages/protocol/src/index.ts
git commit -m "feat: add server-side NPC chat handler with Gemini/OpenRouter fallback"
```

---

### Task 8: Register the `/npc/chat` endpoint and env vars

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `handleNpcChat`, `npcChatLimiter` from `./npcChat.ts` (Task 7).

- [ ] **Step 1: Add the endpoint**

In `apps/server/src/index.ts`, add the import and a second `createEndpoint` entry alongside `/rooms/:code` (both inside the same `createRouter({...})` object, ~line 16):

```ts
import { handleNpcChat, npcChatLimiter } from './npcChat.ts';
```

```ts
npcChat: createEndpoint('/npc/chat', { method: 'POST' }, async context => {
  const ip = context.request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!npcChatLimiter.accept(ip, Date.now())) return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429, headers: { 'content-type': 'application/json' } });
  let body: unknown;
  try { body = await context.request.json(); } catch { return new Response(JSON.stringify({ error: 'INVALID_MESSAGE' }), { status: 400, headers: { 'content-type': 'application/json' } }); }
  const result = await handleNpcChat(body, { geminiApiKey: process.env.GEMINI_API_KEY, openRouterApiKey: process.env.OPENROUTER_API_KEY, openRouterModel: process.env.OPENROUTER_MODEL });
  if ('error' in result) return new Response(JSON.stringify(result), { status: result.error === 'INVALID_MESSAGE' ? 400 : 503, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
}),
```

(Confirm the exact context/request shape against the existing `resolveRoom` endpoint in the same file — mirror its `context.params`/`context.request` access pattern exactly, since `createEndpoint`'s context type is defined by `@colyseus/core` and must match what `resolveRoom` already uses.)

- [ ] **Step 2: Add env vars**

In `.env.example`, append:

```
# NPC chat (server-side only; never expose these to the client)
GEMINI_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `npm run server:dev` in one terminal, then from another: `curl -s -X POST http://127.0.0.1:2567/npc/chat -H 'content-type: application/json' -d '{"npcId":"luttappi","message":"hello","zoneId":"kodaly"}' -H 'origin: http://127.0.0.1:5000'`
Expected (no API keys set locally): `{"error":"NPC_UNAVAILABLE"}` with HTTP 503 — confirms the endpoint is wired and fails closed without keys.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/index.ts .env.example
git commit -m "feat: register POST /npc/chat endpoint"
```

---

### Task 9: Chat panel UI, proximity prompt, and i18n strings

**Files:**
- Create: `src/features/npc/NpcChatPanel.tsx`
- Create: `src/features/npc/npc-chat.css`
- Modify: `src/app/App.tsx`
- Modify: `src/content/locales/en.json`
- Modify: `src/content/locales/ml.json`

**Interfaces:**
- Consumes: `npcInRange`, `npcPositions` from Task 4 App state; `askNpc` from `../../game/npc/npcClient`; `NPC_DEFINITIONS` from `../../game/npc/npcDefinitions`; `translate`, `useLocale` from `../i18n/translate`.
- Produces: `NpcChatPanel` component with props `{ npcId: NpcId; zoneId: ZoneId; baseUrl: string; onClose: () => void }`.

- [ ] **Step 1: Add locale keys**

In `src/content/locales/en.json`, add near the other HUD-ish keys:

```json
"npc.talk.luttappi": "Press E to talk to Luttappi",
"npc.talk.mayavi": "Press E to talk to Mayavi",
"npc.talk.luttappi.touch": "Tap to talk to Luttappi",
"npc.talk.mayavi.touch": "Tap to talk to Mayavi",
"npc.chat.placeholder": "Say something...",
"npc.chat.send": "Send",
"npc.chat.close": "Close",
"npc.toast.stolen": "Luttappi took {n} coin{s}!",
"npc.toast.blessed": "Mayavi blessed you with {n} coin{s}!"
```

Add the same keys with Malayalam text to `src/content/locales/ml.json` (mirror the existing entries' tone — short, colloquial). If uncertain of exact Malayalam phrasing, leave the English string as a placeholder value for those keys only (the existing `translateFromCatalog` falls back to English for any key `ml.json` is missing, so this degrades safely) and flag it for the user to refine.

- [ ] **Step 2: Write `NpcChatPanel.tsx`**

```tsx
// src/features/npc/NpcChatPanel.tsx
import { useState } from 'react';
import { X } from '@phosphor-icons/react';
import type { ZoneId } from '../../contracts';
import { NPC_DEFINITIONS, type NpcId } from '../../game/npc/npcDefinitions';
import { askNpc } from '../../game/npc/npcClient';
import { translate, useLocale } from '../i18n/translate';
import './npc-chat.css';

interface Props { npcId: NpcId; zoneId: ZoneId; baseUrl: string; onClose: () => void }

export function NpcChatPanel({ npcId, zoneId, baseUrl, onClose }: Props) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const def = NPC_DEFINITIONS[npcId];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ from: 'player' | 'npc'; text: string }[]>([]);
  const [sending, setSending] = useState(false);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    setMessages(m => [...m, { from: 'player', text: trimmed }]);
    setSending(true);
    const result = await askNpc({ npcId, message: trimmed, zoneId }, baseUrl);
    setMessages(m => [...m, { from: 'npc', text: result.reply }]);
    setSending(false);
  };

  return (
    <div className="npc-chat-panel" role="dialog" aria-label={def.name}>
      <div className="npc-chat-header"><strong>{def.name}</strong><button aria-label={t('npc.chat.close')} onClick={onClose}><X size={18}/></button></div>
      <div className="npc-chat-log">{messages.map((m, i) => <div key={i} className={`npc-chat-line npc-chat-${m.from}`}>{m.text}</div>)}</div>
      <form className="npc-chat-input" onSubmit={e => { e.preventDefault(); void send(); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('npc.chat.placeholder')} maxLength={300} disabled={sending}/>
        <button type="submit" disabled={sending || !input.trim()}>{t('npc.chat.send')}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write `npc-chat.css`**

```css
.npc-chat-panel{position:fixed;right:16px;bottom:16px;width:min(340px,90vw);max-height:50vh;display:flex;flex-direction:column;background:rgba(20,24,18,.92);color:#fbf3d9;border-radius:12px;padding:10px;z-index:40;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.npc-chat-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.npc-chat-header button{background:none;border:none;color:inherit;cursor:pointer}
.npc-chat-log{overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.npc-chat-line{padding:6px 9px;border-radius:8px;font-size:.9rem;max-width:85%}
.npc-chat-player{align-self:flex-end;background:#2f5a3e}
.npc-chat-npc{align-self:flex-start;background:#463421}
.npc-chat-input{display:flex;gap:6px}
.npc-chat-input input{flex:1;border-radius:8px;border:none;padding:6px 8px}
.npc-chat-input button{border-radius:8px;border:none;padding:6px 10px;background:#d7a92a;cursor:pointer}
```

- [ ] **Step 4: Wire proximity prompt + panel into `App.tsx`**

In the HUD JSX (near where `interactionMessage`/boarding prompts already render), add a proximity prompt keyed off `npcInRange`, and mount `NpcChatPanel` when opened:

```tsx
const [npcChatOpen,setNpcChatOpen]=useState<NpcId|null>(null);
const npcBaseUrl=(import.meta.env.VITE_MULTIPLAYER_URL??'ws://127.0.0.1:2567').replace(/^ws/,'http');
useEffect(()=>{
  if(!npcInRange)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key.toLowerCase()==='e')setNpcChatOpen(npcInRange);};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
},[npcInRange]);
```

```tsx
{npcInRange&&!npcChatOpen&&<button className="npc-prompt" onClick={()=>setNpcChatOpen(npcInRange)}>{t(touch?`npc.talk.${npcInRange}.touch`:`npc.talk.${npcInRange}` as TranslationKey)}</button>}
{npcChatOpen&&<NpcChatPanel npcId={npcChatOpen} zoneId={getZoneAtPosition(snapshot.position[0],snapshot.position[2])} baseUrl={npcBaseUrl} onClose={()=>setNpcChatOpen(null)}/>}
```

Add the import: `import { NpcChatPanel } from '../features/npc/NpcChatPanel';`. Confirm `getZoneAtPosition` (already imported at the top of `App.tsx` from `../content/world/kodassery`) returns a `ZoneId` — reuse it exactly as `LANDMARKS` discovery logic already does a few lines above.

- [ ] **Step 5: Replace the Task 4 literal toast strings with localized, interpolated text**

Add a small helper near the top of `App.tsx` (module scope, outside the component):

```tsx
function formatNpcToast(key:'npc.toast.stolen'|'npc.toast.blessed',n:number,locale:Locale):string{
  return translate(key,locale).replace('{n}',String(n)).replace('{s}',n===1?'':'s');
}
```

Replace the Task 4 toast JSX with:

```tsx
{npcToast&&<div className="npc-toast" role="status">{formatNpcToast(npcToast.coinsDelta<0?'npc.toast.stolen':'npc.toast.blessed',Math.abs(npcToast.coinsDelta),locale)}</div>}
```

- [ ] **Step 6: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Manual verification**

Run: `npm run dev` and, separately, `npm run server:dev`. Load the game, walk near Luttappi or Mayavi (visible on the minimap as a head pin from Task 5), confirm the proximity prompt appears, open chat, send a message, and confirm a reply (or the canned fallback if no API keys are configured) appears. Confirm the coin toast fires and the wallet HUD updates when standing near either NPC for ~10-15 seconds.

- [ ] **Step 8: Commit**

```bash
git add src/features/npc/NpcChatPanel.tsx src/features/npc/npc-chat.css src/app/App.tsx src/content/locales/en.json src/content/locales/ml.json
git commit -m "feat: add NPC chat panel, proximity prompt, and i18n strings"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including all new files from Tasks 1, 2, 5, 6, 7.

- [ ] **Step 2: Typecheck everything**

Run: `npm run typecheck`
Expected: PASS (root, sw, protocol, simulation, server workspaces).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS with no new warnings about the `npc` modules.

- [ ] **Step 4: Manual playtest checklist**

- Both NPCs are visible and wandering within their zones, on foot and from a vehicle.
- Map pins (minimap and full map) track each NPC's live position.
- Proximity prompt appears/disappears correctly at the 4m radius.
- Chat opens, sends, and shows a reply; stopping `apps/server` still shows a graceful in-character fallback line, never an error screen.
- Coin theft never drops the wallet below 0; blessing respects the daily cap.
- Mayavi visibly redirects Luttappi's wander target when both converge on the player.

- [ ] **Step 5: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found in full verification pass"
```
