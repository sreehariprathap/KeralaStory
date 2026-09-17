# Collectables and Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the player 100 daily coins and 10 daily hidden hearts to pick up across the map, banked in a local wallet that survives reloads and reshuffles at local midnight.

**Architecture:** Pure, seeded TypeScript modules under `src/game/collectables/` decide where items are, which are collected, and whether the player is close enough. One React component draws them with an `InstancedMesh` and runs the pickup test inside `useFrame`, so no React state changes per frame. The wallet lives in save v3 in localStorage.

**Tech Stack:** TypeScript, React 19, @react-three/fiber 9, three 0.186, zod 4, vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-collectables-and-wallet-design.md`

## Global Constraints

- No React state updates per frame. Physics and frame loops own movement; UI gets events. (`AGENTS.md`)
- Style UI with the shared tokens in `src/ui/tokens.css`. (`AGENTS.md`)
- All map coordinates come from world data in `src/content/world/definition.ts`, never hardcoded duplicates. (`AGENTS.md`)
- This work adds no quests, backend or accounts. Missions are a later spec.
- Every user-visible string has a key in both `src/content/locales/en.json` and `src/content/locales/ml.json`.
- Coin value is 1, heart value is 10, money bundle value is 25.
- 100 coins per day, 10 hearts per day, reset at local midnight.
- Coins are collectable on foot or in any vehicle; hearts on foot only.
- Pickup radius: 1.2m on foot, 2.5m in a vehicle. Vertical limit 3m.
- Minimum spacing between coin spots: 15m.
- Before handoff: `npm run typecheck`, `npm test`, `npm run build` must all pass.
- Code style in this repo is dense (short lines, few blank lines). Match the file you are editing.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/game/collectables/types.ts` | Shared item and state types |
| `src/game/collectables/collectState.ts` | Wallet, today's collected ids, midnight rollover (pure) |
| `src/game/collectables/coinPlacement.ts` | Seeded daily coin spots (pure) |
| `src/game/collectables/heartSpots.ts` | The 10 fixed heart spots (data, derived from world data) |
| `src/game/collectables/pickup.ts` | Spatial grid and radius test (pure) |
| `src/game/collectables/collectChime.ts` | Short WebAudio blip for pickups |
| `src/game/collectables/Collectables.tsx` | Instanced rendering and the frame-loop pickup check |
| `src/game/collectables/PickupBurst.tsx` | The "+1" label that rises and fades on a pickup |
| `src/features/wallet/WalletHud.tsx` | Coin and heart counters |
| `src/features/wallet/wallet-hud.css` | HUD styling using shared tokens |
| `src/contracts/index.ts` | `CollectSaveSchema`, `SaveV3Schema` (modify) |
| `src/persistence/localSaveRepository.ts` | v3 parse, migrate, write (modify) |
| `src/app/WorldCanvas.tsx` | Mount `Collectables` inside `Physics` (modify) |
| `src/app/App.tsx` | Own wallet state, save it, render the HUD (modify) |
| `src/content/assets/manifest.ts` | Register the three collectable models (modify) |
| `tests/collectables*.test.ts` | Unit tests |

---

### Task 1: Types and collect state

**Files:**
- Create: `src/game/collectables/types.ts`
- Create: `src/game/collectables/collectState.ts`
- Test: `tests/collectState.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type CollectKind = 'coin' | 'heart' | 'money'`
  - `interface CollectItem { id: string; kind: CollectKind; x: number; y: number; z: number }`
  - `interface CollectState { coins: number; dateKey: string; collectedIds: string[] }`
  - `COLLECT_VALUE: Record<CollectKind, number>`
  - `todayKey(now?: Date): string`
  - `createCollectState(now?: Date): CollectState`
  - `rollOver(state: CollectState, dateKey: string): CollectState`
  - `collect(state: CollectState, item: CollectItem): CollectState`
  - `isCollected(state: CollectState, id: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/collectState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COLLECT_VALUE, collect, createCollectState, isCollected, rollOver, todayKey } from '../src/game/collectables/collectState';
import type { CollectItem } from '../src/game/collectables/types';

const coin = (id: string): CollectItem => ({ id, kind: 'coin', x: 0, y: 0, z: 0 });
const heart: CollectItem = { id: 'heart:jetty', kind: 'heart', x: 1, y: 2, z: 3 };

describe('collect state', () => {
  it('uses local time for the date key, not UTC', () => {
    // 2026-03-01T00:30 local time, whatever the runner's zone is.
    const local = new Date(2026, 2, 1, 0, 30, 0);
    expect(todayKey(local)).toBe('2026-03-01');
  });

  it('values a coin at 1, a heart at 10 and money at 25', () => {
    expect(COLLECT_VALUE).toEqual({ coin: 1, heart: 10, money: 25 });
  });

  it('adds a coin once and ignores a repeat of the same id', () => {
    const start = createCollectState(new Date(2026, 8, 16, 12));
    const once = collect(start, coin('coin:2026-09-16:4'));
    const twice = collect(once, coin('coin:2026-09-16:4'));
    expect(once.coins).toBe(1);
    expect(twice.coins).toBe(1);
    expect(twice.collectedIds).toEqual(['coin:2026-09-16:4']);
  });

  it('adds ten coins for a heart', () => {
    const start = createCollectState(new Date(2026, 8, 16, 12));
    expect(collect(start, heart).coins).toBe(10);
  });

  it('reports collected ids', () => {
    const state = collect(createCollectState(new Date(2026, 8, 16, 12)), heart);
    expect(isCollected(state, 'heart:jetty')).toBe(true);
    expect(isCollected(state, 'heart:quay')).toBe(false);
  });

  it('clears collected ids on a new day but keeps the wallet', () => {
    const state = collect(createCollectState(new Date(2026, 8, 16, 12)), heart);
    const next = rollOver(state, '2026-09-17');
    expect(next.coins).toBe(10);
    expect(next.collectedIds).toEqual([]);
    expect(next.dateKey).toBe('2026-09-17');
  });

  it('is a no-op when the date key has not changed', () => {
    const state = collect(createCollectState(new Date(2026, 8, 16, 12)), heart);
    expect(rollOver(state, state.dateKey)).toBe(state);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/collectState.test.ts`
Expected: FAIL, cannot resolve `../src/game/collectables/collectState`.

- [ ] **Step 3: Write the implementation**

Create `src/game/collectables/types.ts`:

```ts
export type CollectKind = 'coin' | 'heart' | 'money';
export interface CollectItem { id: string; kind: CollectKind; x: number; y: number; z: number }
export interface CollectState { coins: number; dateKey: string; collectedIds: string[] }
export type Carrier = 'foot' | 'bicycle' | 'car';
```

Create `src/game/collectables/collectState.ts`:

```ts
import type { CollectItem, CollectKind, CollectState } from './types';

/** A heart is worth ten coins; a money bundle (spawned by activity rewards) twenty-five. */
export const COLLECT_VALUE: Record<CollectKind, number> = { coin: 1, heart: 10, money: 25 };

const pad = (value: number) => String(value).padStart(2, '0');

/** Local calendar day, so the reset lands at the player's own midnight. */
export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createCollectState(now?: Date): CollectState {
  return { coins: 0, dateKey: todayKey(now), collectedIds: [] };
}

export function isCollected(state: CollectState, id: string): boolean {
  return state.collectedIds.includes(id);
}

/** New day: today's finds are forgotten, the wallet is not. */
export function rollOver(state: CollectState, dateKey: string): CollectState {
  if (state.dateKey === dateKey) return state;
  return { coins: state.coins, dateKey, collectedIds: [] };
}

export function collect(state: CollectState, item: CollectItem): CollectState {
  if (isCollected(state, item.id)) return state;
  return { ...state, coins: state.coins + COLLECT_VALUE[item.kind], collectedIds: [...state.collectedIds, item.id] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collectState.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/collectables/types.ts src/game/collectables/collectState.ts tests/collectState.test.ts
git commit -m "feat: collect state with wallet, daily rollover and item values"
```

---

### Task 2: Seeded daily coin placement

**Files:**
- Create: `src/game/collectables/coinPlacement.ts`
- Test: `tests/coinPlacement.test.ts`
- Read for reference: `src/game/world/coconutPlacement.ts:16-20` (the `rng` helper), `src/content/world/definition.ts`

**Interfaces:**
- Consumes: `CollectItem` from Task 1.
- Produces:
  - `COIN_COUNT = 100`
  - `MIN_COIN_SPACING = 15`
  - `dailyCoinSpots(dateKey: string, count?: number): CollectItem[]`
  - `isCoinSpotOpen(x: number, z: number): boolean`

Placement rules (from the spec): inside `WORLD_BOUNDS`, not water, ground slope at most about 25 degrees, outside the waterfall footprint, at least 15m from every accepted spot. Roads are allowed. Coin `y` is `terrainHeight(x, z) + 1`.

- [ ] **Step 1: Write the failing test**

Create `tests/coinPlacement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COIN_COUNT, MIN_COIN_SPACING, dailyCoinSpots, isCoinSpotOpen } from '../src/game/collectables/coinPlacement';
import { WORLD_BOUNDS, isWater, terrainHeight } from '../src/content/world/definition';

const spots = dailyCoinSpots('2026-09-16');

describe('daily coin placement', () => {
  it('returns the full set of coins', () => {
    expect(spots).toHaveLength(COIN_COUNT);
    expect(spots.every(s => s.kind === 'coin')).toBe(true);
  });

  it('is deterministic for one date', () => {
    expect(dailyCoinSpots('2026-09-16')).toEqual(spots);
  });

  it('places coins differently on a different date', () => {
    const other = dailyCoinSpots('2026-09-17');
    const same = other.filter((s, i) => Math.hypot(s.x - spots[i].x, s.z - spots[i].z) < 1);
    expect(same.length).toBeLessThan(COIN_COUNT / 2);
  });

  it('gives every coin a stable id carrying the date', () => {
    expect(spots[0].id).toBe('coin:2026-09-16:0');
    expect(new Set(spots.map(s => s.id)).size).toBe(COIN_COUNT);
  });

  it('keeps every coin inside the world and out of the water', () => {
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMin);
      expect(spot.x).toBeLessThanOrEqual(WORLD_BOUNDS.xMax);
      expect(spot.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.zMin);
      expect(spot.z).toBeLessThanOrEqual(WORLD_BOUNDS.zMax);
      expect(isWater(spot.x, spot.z)).toBe(false);
    }
  });

  it('floats each coin a metre above the ground', () => {
    for (const spot of spots) expect(spot.y).toBeCloseTo(terrainHeight(spot.x, spot.z) + 1, 5);
  });

  it('keeps coins at least the minimum spacing apart', () => {
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThanOrEqual(MIN_COIN_SPACING);
      }
    }
  });

  it('rejects a spot in the river', () => {
    expect(isCoinSpotOpen(0, -100)).toBe(false);
  });

  it('returns a smaller set when asked for fewer', () => {
    expect(dailyCoinSpots('2026-09-16', 10)).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/coinPlacement.test.ts`
Expected: FAIL, cannot resolve `../src/game/collectables/coinPlacement`.

- [ ] **Step 3: Write the implementation**

Create `src/game/collectables/coinPlacement.ts`:

```ts
import { WORLD_BOUNDS, hasGroundAt, isWater, terrainHeight } from '../../content/world/definition';
import { isWaterfallFootprint } from '../world/waterfallGeometry';
import type { CollectItem } from './types';

export const COIN_COUNT = 100;
export const MIN_COIN_SPACING = 15;
/** Coins float at chest height so they read against the ground. */
const COIN_HEIGHT = 1;
/** Roughly 25 degrees, sampled over a 2 m span. */
const MAX_SLOPE = .47;
const TRY_BUDGET = 20000;

/** Same small PRNG the coconut placement uses: cheap, stable, seeded. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hashDate(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) { hash ^= dateKey.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function slope(x: number, z: number): number {
  const h = terrainHeight(x, z);
  return Math.max(
    Math.abs(terrainHeight(x + 1, z) - h), Math.abs(terrainHeight(x - 1, z) - h),
    Math.abs(terrainHeight(x, z + 1) - h), Math.abs(terrainHeight(x, z - 1) - h),
  );
}

/** Dry, walkable, reasonably level ground. Roads are welcome: coins are meant to be found while travelling. */
export function isCoinSpotOpen(x: number, z: number): boolean {
  if (x < WORLD_BOUNDS.xMin || x > WORLD_BOUNDS.xMax || z < WORLD_BOUNDS.zMin || z > WORLD_BOUNDS.zMax) return false;
  if (isWater(x, z) || !hasGroundAt(x, z)) return false;
  if (isWaterfallFootprint(x, z)) return false;
  return slope(x, z) <= MAX_SLOPE;
}

/** The day's coins. Pure and seeded by the date, so any client (or a server later) builds the same set. */
export function dailyCoinSpots(dateKey: string, count: number = COIN_COUNT): CollectItem[] {
  const random = rng(hashDate(dateKey));
  const spots: CollectItem[] = [];
  const width = WORLD_BOUNDS.xMax - WORLD_BOUNDS.xMin, depth = WORLD_BOUNDS.zMax - WORLD_BOUNDS.zMin;
  for (let attempt = 0; attempt < TRY_BUDGET && spots.length < count; attempt++) {
    const x = WORLD_BOUNDS.xMin + random() * width, z = WORLD_BOUNDS.zMin + random() * depth;
    if (!isCoinSpotOpen(x, z)) continue;
    if (spots.some(s => Math.hypot(s.x - x, s.z - z) < MIN_COIN_SPACING)) continue;
    spots.push({ id: `coin:${dateKey}:${spots.length}`, kind: 'coin', x, y: terrainHeight(x, z) + COIN_HEIGHT, z });
  }
  return spots;
}
```

Note: if `isWaterfallFootprint` is not exported from `src/game/world/waterfallGeometry.ts` with the signature `(x: number, z: number) => boolean`, check the file and call it as it is actually declared; `coconutPlacement.ts` imports the same helper and shows the correct usage.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/coinPlacement.test.ts`
Expected: PASS, 9 tests. If the count test fails because the try budget runs out, raise `TRY_BUDGET`; do not lower `MIN_COIN_SPACING`.

- [ ] **Step 5: Commit**

```bash
git add src/game/collectables/coinPlacement.ts tests/coinPlacement.test.ts
git commit -m "feat: seeded daily coin placement across walkable land"
```

---

### Task 3: The ten heart spots

**Files:**
- Create: `src/game/collectables/heartSpots.ts`
- Test: `tests/heartSpots.test.ts`

**Interfaces:**
- Consumes: `CollectItem` from Task 1, `isCoinSpotOpen` is not used here.
- Produces:
  - `HEART_COUNT = 10`
  - `interface HeartSpot extends CollectItem { kind: 'heart'; label: string }`
  - `dailyHeartSpots(): HeartSpot[]`

Positions are written as expressions over world data so they follow the world. Each spot is verified reachable on foot in Task 9.

- [ ] **Step 1: Write the failing test**

Create `tests/heartSpots.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HEART_COUNT, dailyHeartSpots } from '../src/game/collectables/heartSpots';
import { WORLD_BOUNDS, isWater } from '../src/content/world/definition';

const hearts = dailyHeartSpots();

describe('heart spots', () => {
  it('offers ten hearts', () => {
    expect(hearts).toHaveLength(HEART_COUNT);
    expect(hearts.every(h => h.kind === 'heart')).toBe(true);
  });

  it('gives each a unique, date-free id and a label', () => {
    expect(new Set(hearts.map(h => h.id)).size).toBe(HEART_COUNT);
    expect(hearts.every(h => h.id.startsWith('heart:') && !/\d{4}-\d{2}-\d{2}/.test(h.id))).toBe(true);
    expect(hearts.every(h => h.label.length > 0)).toBe(true);
  });

  it('keeps every heart inside the world and out of the water', () => {
    for (const heart of hearts) {
      expect(heart.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.xMin);
      expect(heart.x).toBeLessThanOrEqual(WORLD_BOUNDS.xMax);
      expect(heart.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.zMin);
      expect(heart.z).toBeLessThanOrEqual(WORLD_BOUNDS.zMax);
      expect(isWater(heart.x, heart.z)).toBe(false);
      expect(Number.isFinite(heart.y)).toBe(true);
    }
  });

  it('spreads hearts out, at least 30 m apart', () => {
    for (let i = 0; i < hearts.length; i++) {
      for (let j = i + 1; j < hearts.length; j++) {
        expect(Math.hypot(hearts[i].x - hearts[j].x, hearts[i].z - hearts[j].z)).toBeGreaterThan(30);
      }
    }
  });

  it('is the same list every call', () => {
    expect(dailyHeartSpots()).toEqual(hearts);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/heartSpots.test.ts`
Expected: FAIL, cannot resolve `../src/game/collectables/heartSpots`.

- [ ] **Step 3: Write the implementation**

Create `src/game/collectables/heartSpots.ts`. Start from the skeleton below. Every position must be derived from an existing export of `src/content/world/definition.ts` (`LANDMARKS`, `V2_LAYOUT`, `PARKING_SPOTS`, `JETTY_BOUNDS`, `QUAY_BOUNDS`, `BRIDGE_X`, `BRIDGE_DECK_Y`, `BRIDGE_NORTH_Z`, `BRIDGE_SOUTH_Z`, `terrainHeight`). Read that file and pick the landmark ids that exist; do not invent ids.

```ts
import { BRIDGE_DECK_Y, BRIDGE_NORTH_Z, BRIDGE_SOUTH_Z, BRIDGE_X, JETTY_BOUNDS, LANDMARKS, QUAY_BOUNDS, V2_LAYOUT, terrainHeight } from '../../content/world/definition';
import type { CollectItem } from './types';

export const HEART_COUNT = 10;
export interface HeartSpot extends CollectItem { kind: 'heart'; label: string }

/** Hearts hang a little above head height so they are spotted, not stumbled over. */
const LIFT = 2.2;
const landmark = (id: string) => LANDMARKS.find(l => l.id === id);

function ground(id: string, label: string, x: number, z: number, lift = LIFT): HeartSpot {
  return { id: `heart:${id}`, kind: 'heart', label, x, z, y: terrainHeight(x, z) + lift };
}

/**
 * Ten hand-picked hiding places, hard to find but reachable on foot. Positions follow
 * world data so they move with the map. Each one is walked in the running app before release.
 */
export function dailyHeartSpots(): HeartSpot[] {
  const waterfall = landmark('waterfall'), canopy = landmark('canopy'), origin = landmark('origin');
  const spots: HeartSpot[] = [
    ground('waterfall-ledge', 'Behind Silverthread falls', (waterfall?.position[0] ?? 31) + 6, (waterfall?.position[2] ?? -386) - 5),
    ground('canopy-branch', 'A treehouse branch', (canopy?.position[0] ?? 18) - 5, (canopy?.position[2] ?? -415) + 4),
    ground('first-overlook', 'Above the first overlook', (origin?.position[0] ?? 0) - 9, (origin?.position[2] ?? -460) - 7),
    // Remaining spots: bridge underside, jetty end, quay breakwater, the park high point,
    // a town rooftop edge and two more from V2_LAYOUT. Fill these in from the real data.
  ];
  return spots;
}
```

Finish the list to exactly 10 spots, spread at least 30m apart, covering all four regions. Use `BRIDGE_X`, `BRIDGE_DECK_Y` and the midpoint of `BRIDGE_NORTH_Z`/`BRIDGE_SOUTH_Z` for the bridge spot (a fixed `y` rather than `terrainHeight`, since the deck is above the river), the east end of `JETTY_BOUNDS` for the jetty, the north edge of `QUAY_BOUNDS` for the breakwater, and `V2_LAYOUT.park.center` plus `V2_LAYOUT.towns` centers for the rest.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/heartSpots.test.ts`
Expected: PASS, 5 tests. If the spacing test fails, move the offending spot, do not relax the test.

- [ ] **Step 5: Commit**

```bash
git add src/game/collectables/heartSpots.ts tests/heartSpots.test.ts
git commit -m "feat: ten fixed heart spots derived from world data"
```

---

### Task 4: Pickup grid and radius test

**Files:**
- Create: `src/game/collectables/pickup.ts`
- Test: `tests/pickup.test.ts`

**Interfaces:**
- Consumes: `CollectItem`, `Carrier` from Task 1.
- Produces:
  - `pickupRadius(carrier: Carrier): number`
  - `buildPickupGrid(items: readonly CollectItem[]): PickupGrid`
  - `findPickup(grid: PickupGrid, x: number, y: number, z: number, carrier: Carrier, taken: ReadonlySet<string>): CollectItem | null`

- [ ] **Step 1: Write the failing test**

Create `tests/pickup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPickupGrid, findPickup, pickupRadius } from '../src/game/collectables/pickup';
import type { CollectItem } from '../src/game/collectables/types';

const coin: CollectItem = { id: 'coin:a', kind: 'coin', x: 10, y: 20, z: -30 };
const heart: CollectItem = { id: 'heart:a', kind: 'heart', x: 40, y: 12, z: -30 };
const grid = buildPickupGrid([coin, heart]);
const none = new Set<string>();

describe('pickup', () => {
  it('reaches further from a vehicle than on foot', () => {
    expect(pickupRadius('foot')).toBe(1.2);
    expect(pickupRadius('car')).toBe(2.5);
    expect(pickupRadius('bicycle')).toBe(2.5);
  });

  it('takes a coin the player is standing on', () => {
    expect(findPickup(grid, 10.5, 20, -30, 'foot', none)?.id).toBe('coin:a');
  });

  it('leaves a coin that is out of reach', () => {
    expect(findPickup(grid, 13, 20, -30, 'foot', none)).toBeNull();
  });

  it('lets a driver sweep up a coin the walker would miss', () => {
    expect(findPickup(grid, 12, 20, -30, 'foot', none)).toBeNull();
    expect(findPickup(grid, 12, 20, -30, 'car', none)?.id).toBe('coin:a');
  });

  it('ignores a coin far below or above, such as one under a bridge', () => {
    expect(findPickup(grid, 10, 26, -30, 'foot', none)).toBeNull();
  });

  it('gives hearts only to a player on foot', () => {
    expect(findPickup(grid, 40, 12, -30, 'car', none)).toBeNull();
    expect(findPickup(grid, 40, 12, -30, 'foot', none)?.id).toBe('heart:a');
  });

  it('skips items already collected', () => {
    expect(findPickup(grid, 10, 20, -30, 'foot', new Set(['coin:a']))).toBeNull();
  });

  it('returns the nearest item when two are close', () => {
    const near = buildPickupGrid([coin, { ...coin, id: 'coin:b', x: 10.4 }]);
    expect(findPickup(near, 10.5, 20, -30, 'foot', none)?.id).toBe('coin:b');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/pickup.test.ts`
Expected: FAIL, cannot resolve `../src/game/collectables/pickup`.

- [ ] **Step 3: Write the implementation**

Create `src/game/collectables/pickup.ts`:

```ts
import type { Carrier, CollectItem } from './types';

const CELL = 20;
/** A coin under a bridge should not jump to a player on the deck. */
const VERTICAL_REACH = 3;
const FOOT_RADIUS = 1.2, VEHICLE_RADIUS = 2.5;

export interface PickupGrid { cells: Map<string, CollectItem[]> }

export function pickupRadius(carrier: Carrier): number {
  return carrier === 'foot' ? FOOT_RADIUS : VEHICLE_RADIUS;
}

const key = (x: number, z: number) => `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;

export function buildPickupGrid(items: readonly CollectItem[]): PickupGrid {
  const cells = new Map<string, CollectItem[]>();
  for (const item of items) {
    const cell = key(item.x, item.z);
    const bucket = cells.get(cell);
    if (bucket) bucket.push(item); else cells.set(cell, [item]);
  }
  return { cells };
}

/** Nearest reachable item, or null. Cheap enough to call every frame: it tests at most nine cells. */
export function findPickup(grid: PickupGrid, x: number, y: number, z: number, carrier: Carrier, taken: ReadonlySet<string>): CollectItem | null {
  const radius = pickupRadius(carrier), limit = radius * radius;
  let best: CollectItem | null = null, bestDistance = Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const bucket = grid.cells.get(key(x + dx * CELL, z + dz * CELL));
    if (!bucket) continue;
    for (const item of bucket) {
      if (taken.has(item.id)) continue;
      // Hearts hide on ledges and rooftops: they are a reward for getting out of the vehicle.
      if (item.kind === 'heart' && carrier !== 'foot') continue;
      if (Math.abs(item.y - y) > VERTICAL_REACH) continue;
      const distance = (item.x - x) ** 2 + (item.z - z) ** 2;
      if (distance <= limit && distance < bestDistance) { best = item; bestDistance = distance; }
    }
  }
  return best;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/pickup.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/collectables/pickup.ts tests/pickup.test.ts
git commit -m "feat: pickup grid with carrier-aware reach"
```

---

### Task 5: Save version 3 with the wallet

**Files:**
- Modify: `src/contracts/index.ts` (after the `SaveV2Schema` line, around line 69)
- Modify: `src/persistence/localSaveRepository.ts`
- Test: `tests/collectPersistence.test.ts`
- Read for reference: `tests/persistence.test.ts` for the existing storage-stub style

**Interfaces:**
- Consumes: `createCollectState`, `todayKey` from Task 1.
- Produces:
  - `CollectSaveSchema`, `SaveV3Schema`, `type SaveV3`
  - `LocalSave` widened to `SaveV1 | SaveV2 | SaveV3`
  - `loadLocalSave(storage?): { save: SaveV3 | null; warning: string | null }`
  - `writeLocalSave(save: LocalSave, storage?): { ok: boolean; warning: string | null }`

- [ ] **Step 1: Write the failing test**

Create `tests/collectPersistence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadLocalSave, writeLocalSave } from '../src/persistence/localSaveRepository';
import { DEFAULT_SETTINGS, type SaveV3 } from '../src/contracts';
import { todayKey } from '../src/game/collectables/collectState';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  } as Storage;
}

const profile = { id: 'p1', displayName: 'Meera', avatarPresetId: 'canopy' as const, colors: { skin: '#ba805b' as const, hair: '#292a25' as const, clothing: '#285943' as const } };
const baseV2 = {
  version: 2 as const, locale: 'en' as const, bicycle: null, worldVersion: 'test-world', profile,
  position: [0, 1, 0] as [number, number, number], headingRad: 0, safeSpawnId: 'origin',
  visitedLandmarkIds: [], settings: DEFAULT_SETTINGS, updatedAt: new Date().toISOString(),
};

describe('save v3 wallet', () => {
  it('migrates a v2 save forward with an empty wallet', () => {
    const storage = memoryStorage();
    storage.setItem('kerala-story:save:v1', JSON.stringify(baseV2));
    const { save } = loadLocalSave(storage);
    expect(save?.version).toBe(3);
    expect(save?.collect).toEqual({ coins: 0, dateKey: todayKey(), collectedIds: [] });
    expect(save?.profile.displayName).toBe('Meera');
  });

  it('round-trips a wallet through a write and a load', () => {
    const storage = memoryStorage();
    const save: SaveV3 = { ...baseV2, version: 3, collect: { coins: 42, dateKey: '2026-09-16', collectedIds: ['coin:2026-09-16:1'] } };
    expect(writeLocalSave(save, storage).ok).toBe(true);
    expect(loadLocalSave(storage).save?.collect).toEqual({ coins: 42, dateKey: '2026-09-16', collectedIds: ['coin:2026-09-16:1'] });
  });

  it('refuses a negative wallet', () => {
    const storage = memoryStorage();
    const broken = { ...baseV2, version: 3, collect: { coins: -5, dateKey: '2026-09-16', collectedIds: [] } };
    expect(writeLocalSave(broken as never, storage).ok).toBe(false);
  });

  it('preserves a save from a newer version', () => {
    const storage = memoryStorage();
    storage.setItem('kerala-story:save:v1', JSON.stringify({ ...baseV2, version: 4 }));
    const { save, warning } = loadLocalSave(storage);
    expect(save).toBeNull();
    expect(warning).toContain('newer version');
    expect(storage.getItem('kerala-story:save:v1')).toContain('"version":4');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/collectPersistence.test.ts`
Expected: FAIL, `SaveV3` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/contracts/index.ts`, directly after the `SaveV2Schema` and `SaveV2` lines, add:

```ts
export const CollectSaveSchema = z.object({
  coins: z.number().int().min(0),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  collectedIds: z.array(z.string()).max(400),
});
export type CollectSave = z.infer<typeof CollectSaveSchema>;
export const SaveV3Schema = SaveV2Schema.extend({ version: z.literal(3), collect: CollectSaveSchema });
export type SaveV3 = z.infer<typeof SaveV3Schema>;
```

Then change the `LocalSave` line to:

```ts
export type LocalSave = SaveV1 | SaveV2 | SaveV3;
```

In `src/persistence/localSaveRepository.ts`:

1. Extend the import to `SaveV3Schema`, `type SaveV3`.
2. Add the migration next to `migrateV1`:

```ts
function migrateV2(save: SaveV2): SaveV3 {
  return { ...save, version: 3, collect: createCollectState() };
}
```
with `import { createCollectState } from '../game/collectables/collectState';` at the top.

3. In `parseSave`, try v3 first, then v2, then v1:

```ts
const v3 = SaveV3Schema.safeParse(value);
if (v3.success) return v3.data;
```
placed above the existing v2 attempt.

4. Replace `toV2` with:

```ts
function toV3(save: LocalSave): SaveV3 {
  const v2 = save.version === 1 ? migrateV1(save) : save;
  return v2.version === 2 ? migrateV2(v2) : v2;
}
```
and update every call site (`loadLocalSave` returns `toV3(...)`, the backup write uses `toV3(current)`).

5. In `loadLocalSave`, change the return type to `{ save: SaveV3 | null; warning: string | null }` and the migration warning to fire for versions below 3: `save.version < 3 ? 'Older save migrated to version 3.' : null`.

6. In `isFutureSave`, change `value.version > 2` to `value.version > 3`.

7. In `writeLocalSave`, change the encode line to validate v3:

```ts
encoded = JSON.stringify(SaveV3Schema.parse(toV3(SaveSchema.safeParse(save).success ? SaveSchema.parse(save) : save)));
```
If that reads awkwardly in context, the simpler equivalent is fine: parse with the schema matching `save.version`, migrate with `toV3`, then `SaveV3Schema.parse`.

8. Update the v1 archive condition, which currently checks `current?.version === 1`, to `current !== null && current.version < 3`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/collectPersistence.test.ts tests/persistence.test.ts tests/contracts.test.ts tests/expanded-contracts.test.ts`
Expected: PASS. The existing persistence tests may assert "version 2" strings or a `save.version === 2`; update those assertions to 3, since migrating forward is the intended behaviour change. Do not weaken what they check.

- [ ] **Step 5: Fix the App type error**

`src/app/App.tsx` builds a `SaveV2` literal around line 88 and stores `SaveV2` state. Run `npm run typecheck` and update those annotations to `SaveV3`, adding `collect: collectRef.current` in Task 7. For now, add `collect: createCollectState()` so the file compiles.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/contracts/index.ts src/persistence/localSaveRepository.ts src/app/App.tsx tests/collectPersistence.test.ts tests/persistence.test.ts
git commit -m "feat: save v3 carrying the coin wallet"
```

---

### Task 6: Pickup chime

**Files:**
- Create: `src/game/collectables/collectChime.ts`
- Test: `tests/collectChime.test.ts`

**Interfaces:**
- Consumes: `CollectKind` from Task 1, `GameSettings` from `src/contracts`.
- Produces: `playCollectChime(kind: CollectKind, settings: Pick<GameSettings, 'muted' | 'volume'>): void`

`AudioDirector` owns the ambience graph and has no cue API, so pickups get their own tiny oscillator. It must never throw when WebAudio is unavailable, which is the case under vitest.

- [ ] **Step 1: Write the failing test**

Create `tests/collectChime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { playCollectChime } from '../src/game/collectables/collectChime';

describe('collect chime', () => {
  it('does nothing and throws nothing when audio is unavailable', () => {
    expect(() => playCollectChime('coin', { muted: false, volume: .5 })).not.toThrow();
  });

  it('stays silent when muted', () => {
    let created = 0;
    const original = globalThis.AudioContext;
    // @ts-expect-error test double
    globalThis.AudioContext = class { constructor() { created++; } };
    playCollectChime('coin', { muted: true, volume: 1 });
    globalThis.AudioContext = original;
    expect(created).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/collectChime.test.ts`
Expected: FAIL, cannot resolve `../src/game/collectables/collectChime`.

- [ ] **Step 3: Write the implementation**

Create `src/game/collectables/collectChime.ts`:

```ts
import type { GameSettings } from '../../contracts';
import type { CollectKind } from './types';

/** A coin dings brightly, a heart lands softer and lower, money rings twice. */
const TONE: Record<CollectKind, { frequency: number; duration: number; type: OscillatorType }> = {
  coin: { frequency: 1180, duration: .16, type: 'triangle' },
  heart: { frequency: 560, duration: .34, type: 'sine' },
  money: { frequency: 880, duration: .42, type: 'triangle' },
};

let context: AudioContext | null = null;

export function playCollectChime(kind: CollectKind, settings: Pick<GameSettings, 'muted' | 'volume'>): void {
  if (settings.muted || settings.volume <= 0) return;
  try {
    const Ctor = globalThis.AudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const { frequency, duration, type } = TONE[kind];
    const now = context.currentTime;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration * .6);
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, settings.volume)) * .12, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Audio is a nicety; a browser that refuses it must not break the pickup.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collectChime.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/collectables/collectChime.ts tests/collectChime.test.ts
git commit -m "feat: pickup chime that degrades quietly without WebAudio"
```

---

### Task 7: Render the collectables and run the pickup loop

**Files:**
- Create: `src/game/collectables/Collectables.tsx`
- Modify: `src/app/WorldCanvas.tsx`
- Modify: `src/app/App.tsx`
- Read for reference: `src/game/world/CoconutGroves.tsx` (instancing and GLTF loading in this codebase)

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces:
  - `<Collectables playerRef quality settings onCollect />` where
    `playerRef: RefObject<PlayerSnapshot>`, `quality: GameSettings['quality']`,
    `settings: GameSettings`, `onCollect: (item: CollectItem) => void`
  - `WorldCanvas` gains props `playerRef?: RefObject<PlayerSnapshot>`, `collect?: CollectState`, `onCollect?: (item: CollectItem) => void`

- [ ] **Step 1: Write the component**

Create `src/game/collectables/Collectables.tsx`:

```tsx
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Box3, InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GameSettings, PlayerSnapshot } from '../../contracts';
import { dailyCoinSpots } from './coinPlacement';
import { dailyHeartSpots } from './heartSpots';
import { buildPickupGrid, findPickup } from './pickup';
import { playCollectChime } from './collectChime';
import { todayKey } from './collectState';
import type { Carrier, CollectItem } from './types';

const COIN_URL = '/assets/collectables/coin.glb';
const HEART_URL = '/assets/collectables/pumping_heart_model.glb';
const DRAW_RADIUS = 150;
const COIN_SIZE = .9, HEART_SIZE = 1.4;
const SPIN_RATE = .8, BOB = .15, BOB_RATE = 2.2;
/** A session left running overnight should pick up the new day without a reload. */
const DATE_CHECK_SECONDS = 30;

interface Props {
  playerRef: RefObject<PlayerSnapshot>;
  settings: GameSettings;
  collectedIds: readonly string[];
  onCollect: (item: CollectItem) => void;
}

/** First mesh in a GLTF, normalized to unit height with its centre at the origin. */
function useNormalized(url: string): { geometry: BufferGeometry; material: Material } | null {
  const gltf = useLoader(GLTFLoader, url);
  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    let found: Mesh | null = null;
    scene.traverse(object => { if (!found && object instanceof Mesh) found = object; });
    const mesh = found as Mesh | null;
    if (!mesh) return null;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z, .001);
    geometry.translate(-centre.x, -centre.y, -centre.z);
    geometry.scale(scale, scale, scale);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    return { geometry, material };
  }, [gltf]);
}

function CollectableField({ playerRef, settings, collectedIds, onCollect }: Props) {
  const coin = useNormalized(COIN_URL), heart = useNormalized(HEART_URL);
  const [dateKey, setDateKey] = useState(() => todayKey());
  const items = useMemo(() => [...dailyCoinSpots(dateKey), ...dailyHeartSpots()], [dateKey]);
  const grid = useMemo(() => buildPickupGrid(items), [items]);
  const taken = useMemo(() => new Set(collectedIds), [collectedIds]);
  const coins = useMemo(() => items.filter(i => i.kind === 'coin'), [items]);
  const hearts = useMemo(() => items.filter(i => i.kind === 'heart'), [items]);
  const coinMesh = useRef<InstancedMesh>(null), heartMesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const sinceDateCheck = useRef(0);
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;
    sinceDateCheck.current += delta;
    if (sinceDateCheck.current >= DATE_CHECK_SECONDS) {
      sinceDateCheck.current = 0;
      const key = todayKey();
      if (key !== dateKey) setDateKey(key);
    }
    const player = playerRef.current;
    if (!player) return;
    const [px, py, pz] = player.position;
    // Draw only what is near, and hide anything already collected by parking it under the world.
    const write = (mesh: InstancedMesh | null, list: CollectItem[], size: number, spin: boolean) => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const near = Math.hypot(item.x - px, item.z - pz) < DRAW_RADIUS && !taken.has(item.id);
        dummy.position.set(item.x, near ? item.y + Math.sin(clock.current * BOB_RATE + i) * BOB : -1000, item.z);
        dummy.rotation.set(spin ? Math.PI / 2 : 0, spin ? clock.current * SPIN_RATE + i : Math.sin(clock.current + i) * .3, 0);
        const pulse = spin ? 1 : 1 + Math.sin(clock.current * 3 + i) * .06;
        dummy.scale.setScalar(size * pulse);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(coinMesh.current, coins, COIN_SIZE, true);
    write(heartMesh.current, hearts, HEART_SIZE, false);

    const carrier: Carrier = player.travelMode ?? 'foot';
    const hit = findPickup(grid, px, py, pz, carrier, taken);
    if (hit) { playCollectChime(hit.kind, settings); onCollect(hit); }
  });

  if (!coin || !heart) return null;
  return <group>
    <instancedMesh ref={coinMesh} args={[coin.geometry, coin.material, Math.max(1, coins.length)]} frustumCulled={false}/>
    <instancedMesh ref={heartMesh} args={[heart.geometry, heart.material, Math.max(1, hearts.length)]} frustumCulled={false}/>
  </group>;
}

export const Collectables = memo(CollectableField);
```

Unused imports (`Matrix4`, `Quaternion`) must be removed; keep the import list to what the file actually uses so `npm run typecheck` passes.

- [ ] **Step 2: Wire it into the canvas**

In `src/app/WorldCanvas.tsx`:

1. Import the component and types:

```tsx
import { Collectables } from '../game/collectables/Collectables';
import type { CollectItem } from '../game/collectables/types';
import type { PlayerSnapshot } from '../contracts';
```
2. Add to the `SceneCanvas` props: `playerRef:RefObject<PlayerSnapshot>;collectedIds:readonly string[];onCollect:(item:CollectItem)=>void` (import `type RefObject` from react).
3. Inside `<Physics>`, right after `{active?<ExplorerController {...controller}/>:<EstablishingCamera/>}`, add:

```tsx
{active&&<Suspense fallback={null}><Collectables playerRef={playerRef} settings={settings} collectedIds={collectedIds} onCollect={onCollect}/></Suspense>}
```

- [ ] **Step 3: Own the wallet in App**

In `src/app/App.tsx`:

1. Import:

```tsx
import { collect as applyCollect, createCollectState, rollOver, todayKey } from '../game/collectables/collectState';
import type { CollectItem } from '../game/collectables/types';
```
2. Add state next to the other `useState` calls, using the loaded save and rolling it over if the day changed:

```tsx
const [collectState,setCollectState]=useState(()=>rollOver(initial.save?.collect??createCollectState(),todayKey()));
const collectRef=useRef(collectState);collectRef.current=collectState;
```
3. Add the pickup handler:

```tsx
const onCollect=useCallback((item:CollectItem)=>{setCollectState(state=>applyCollect(state,item));},[]);
```
4. Include the wallet in the save literal (the `const save:SaveV3={...}` line): add `collect:collectRef.current`, and change the annotation to `SaveV3` with `version:3`.
5. Save after a pickup, debounced so a run of coins is one write. Add near the other effects:

```tsx
useEffect(()=>{if(!active)return;const id=setTimeout(()=>persist(),500);return()=>clearTimeout(id);},[collectState,active]);
```
where `persist` is the existing save function in the file (match its real name; around line 88).
6. Pass the props through to `WorldCanvas`: `playerRef={snapshotRef} collectedIds={collectState.collectedIds} onCollect={onCollect}`.

- [ ] **Step 4: Verify it compiles and the suite still passes**

Run: `npm run typecheck && npx vitest run`
Expected: no type errors, all tests pass.

- [ ] **Step 5: Verify in the running app**

Run: `npm run dev`, open `http://127.0.0.1:5000`, start a journey.
Expected: gold coins are visible around the map, spinning and bobbing. Walking into one makes it vanish with a chime. Driving into one also picks it up. Reload: the coins you took stay taken.
If nothing appears, check the browser console for a GLTF load error and confirm `/assets/collectables/coin.glb` is served.

- [ ] **Step 6: Commit**

```bash
git add src/game/collectables/Collectables.tsx src/app/WorldCanvas.tsx src/app/App.tsx
git commit -m "feat: draw collectables and collect them in the frame loop"
```

---

### Task 7b: Pickup feedback, fallbacks and the in-building check

**Files:**
- Create: `src/game/collectables/PickupBurst.tsx`
- Modify: `src/game/collectables/Collectables.tsx`
- Test: `tests/pickupBurst.test.ts`

**Interfaces:**
- Consumes: `CollectItem`, `COLLECT_VALUE` from Tasks 1 and 6.
- Produces:
  - `burstStep(age: number): { scale: number; rise: number; opacity: number } | null`
  - `<PickupBurst bursts={...}/>` where `bursts: { id: string; kind: CollectKind; x: number; y: number; z: number; born: number }[]`
  - `fallbackParts(kind: CollectKind)` inside `Collectables.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/pickupBurst.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BURST_SECONDS, burstStep } from '../src/game/collectables/PickupBurst';

describe('pickup burst', () => {
  it('starts at full size and full opacity', () => {
    const start = burstStep(0);
    expect(start?.scale).toBeCloseTo(1, 5);
    expect(start?.opacity).toBeCloseTo(1, 5);
    expect(start?.rise).toBeCloseTo(0, 5);
  });

  it('grows, rises and fades over its life', () => {
    const mid = burstStep(BURST_SECONDS / 2)!;
    expect(mid.scale).toBeGreaterThan(1);
    expect(mid.rise).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.opacity).toBeGreaterThan(0);
  });

  it('is finished once its life is over', () => {
    expect(burstStep(BURST_SECONDS + .01)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/pickupBurst.test.ts`
Expected: FAIL, cannot resolve `../src/game/collectables/PickupBurst`.

- [ ] **Step 3: Write the burst**

Create `src/game/collectables/PickupBurst.tsx`:

```tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Sprite, SpriteMaterial } from 'three';
import { COLLECT_VALUE } from './collectState';
import type { CollectKind } from './types';

export const BURST_SECONDS = .45;
export interface Burst { id: string; kind: CollectKind; x: number; y: number; z: number; born: number }

/** Scale, rise and opacity for a burst of the given age, or null once it is spent. */
export function burstStep(age: number): { scale: number; rise: number; opacity: number } | null {
  if (age < 0 || age > BURST_SECONDS) return null;
  const t = age / BURST_SECONDS;
  return { scale: 1 + t * .6, rise: t * 1.1, opacity: 1 - t * t };
}

/** A "+1" drawn once per value and reused, so a pickup costs no texture work. */
function labelTexture(value: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.strokeStyle = 'rgba(30,26,12,.85)';
  ctx.lineWidth = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(`+${value}`, 64, 32);
  ctx.fillText(`+${value}`, 64, 32);
  return new CanvasTexture(canvas);
}

export function PickupBurst({ bursts }: { bursts: readonly Burst[] }) {
  const sprites = useRef<Map<string, Sprite>>(new Map());
  const materials = useMemo(() => {
    const byValue = new Map<number, SpriteMaterial>();
    for (const value of new Set(Object.values(COLLECT_VALUE))) {
      byValue.set(value, new SpriteMaterial({ map: labelTexture(value), transparent: true, depthTest: false }));
    }
    return byValue;
  }, []);
  useFrame(({ clock }) => {
    for (const burst of bursts) {
      const sprite = sprites.current.get(burst.id);
      if (!sprite) continue;
      const step = burstStep(clock.elapsedTime - burst.born);
      if (!step) { sprite.visible = false; continue; }
      sprite.visible = true;
      sprite.position.set(burst.x, burst.y + step.rise, burst.z);
      sprite.scale.setScalar(step.scale);
      (sprite.material as SpriteMaterial).opacity = step.opacity;
    }
  });
  return <group>
    {bursts.map(burst => <sprite
      key={burst.id}
      ref={node => { if (node) sprites.current.set(burst.id, node); else sprites.current.delete(burst.id); }}
      material={materials.get(COLLECT_VALUE[burst.kind])}
      position={[burst.x, burst.y, burst.z]}
    />)}
  </group>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/pickupBurst.test.ts`
Expected: PASS, 3 tests. `burstStep` is pure, so it runs without a DOM; the component is exercised in the running app in step 7.

- [ ] **Step 5: Show bursts when something is collected**

In `src/game/collectables/Collectables.tsx`:

1. Import `PickupBurst`, `BURST_SECONDS`, `type Burst`.
2. Hold live bursts in a ref and a small state list:

```tsx
const [bursts,setBursts]=useState<Burst[]>([]);
```
3. On a hit inside `useFrame`, before `onCollect(hit)`:

```tsx
const born=clock.current;
setBursts(list=>[...list.filter(b=>born-b.born<BURST_SECONDS),{id:`${hit.id}:${born}`,kind:hit.kind,x:hit.x,y:hit.y,z:hit.z,born}]);
```
This is a state update per pickup, not per frame, which is what the guardrail allows.
4. Render `<PickupBurst bursts={bursts}/>` inside the returned group.
5. `PickupBurst` reads `clock.elapsedTime`, while `Collectables` counts its own `clock.current`. Use one of the two everywhere: pass `born` from `useFrame(({ clock }) => ...)`'s `clock.elapsedTime` in both files so the ages agree.

- [ ] **Step 6: Add the model fallbacks and the in-building check**

Still in `Collectables.tsx`:

1. Wrap the loaders so a failed GLTF does not blank the field. `useNormalized` currently throws through `useLoader`; add a sibling that returns simple geometry, and select it when the loader fails:

```tsx
import { ErrorBoundary } from '../../ui/LoadError';
```
If `src/ui/LoadError.tsx` does not export a reusable boundary, add a tiny local class boundary in `Collectables.tsx` (the same three-method shape as the one in `src/app/App.tsx:32`) that renders `<FallbackField .../>` on error. `FallbackField` draws coins as `<cylinderGeometry args={[.45,.45,.08,16]}/>` with a `#e8c15a` basic material and hearts as `<sphereGeometry args={[.5,12,12]}/>` in `#d2504f`, instanced the same way.

2. Drop coins that landed inside a building. Import `bareGroundHeight` and `terrainCollidersReady` from `../world/terrainProbe` and `useRapier` from `@react-three/rapier`, then once, after the colliders are ready:

```tsx
const { world } = useRapier();
const [checked,setChecked]=useState(false);
useFrame(()=>{
  if(checked||!terrainCollidersReady(world))return;
  setChecked(true);
  setBlocked(new Set(items.filter(i=>i.kind==='coin'&&bareGroundHeight(world,i.x,i.z)===null).map(i=>i.id)));
});
```
Hold `blocked` in state, initialise it as an empty `Set<string>`, reset it to empty and set `checked` to false whenever `dateKey` changes, and treat a blocked id like a taken one in both the draw loop and `findPickup` (union the two sets in a `useMemo`).

- [ ] **Step 7: Verify in the running app**

Run: `npm run dev` and collect a coin and a heart.
Expected: the item vanishes, a "+1" or "+10" floats up and fades in under half a second, and the chime plays. No coin is left floating inside a building. Temporarily renaming `public/assets/collectables/coin.glb` shows plain gold discs instead of an empty world; rename it back afterwards.

- [ ] **Step 8: Commit**

```bash
git add src/game/collectables/PickupBurst.tsx src/game/collectables/Collectables.tsx tests/pickupBurst.test.ts
git commit -m "feat: pickup burst labels, model fallbacks and in-building coin check"
```

---

### Task 8: Wallet HUD and translations

**Files:**
- Create: `src/features/wallet/WalletHud.tsx`
- Create: `src/features/wallet/wallet-hud.css`
- Modify: `src/app/App.tsx` (the `hud` block, around line 152)
- Modify: `src/content/locales/en.json`, `src/content/locales/ml.json`
- Test: `tests/walletHud.test.ts`

**Interfaces:**
- Consumes: `CollectState` from Task 1, `HEART_COUNT` from Task 3.
- Produces: `<WalletHud coins heartsFound locale />`, plus `heartsFoundToday(state: CollectState): number` exported from `src/features/wallet/WalletHud.tsx`.

- [ ] **Step 1: Write the failing test**

Create `tests/walletHud.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { heartsFoundToday } from '../src/features/wallet/WalletHud';
import { ENGLISH_CATALOG, MALAYALAM_CATALOG } from '../src/features/i18n/translate';

describe('wallet hud', () => {
  it('counts only the hearts among the day\'s finds', () => {
    expect(heartsFoundToday({ coins: 30, dateKey: '2026-09-16', collectedIds: ['coin:2026-09-16:1', 'heart:jetty', 'heart:quay'] })).toBe(2);
  });

  it('has wallet strings in both catalogs', () => {
    for (const key of ['wallet.coins', 'wallet.hearts'] as const) {
      expect(ENGLISH_CATALOG[key]).toBeTruthy();
      expect(MALAYALAM_CATALOG[key]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/walletHud.test.ts`
Expected: FAIL, cannot resolve `../src/features/wallet/WalletHud`.

- [ ] **Step 3: Write the implementation**

Create `src/features/wallet/WalletHud.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Coins, Heart } from '@phosphor-icons/react';
import type { Locale } from '../../contracts';
import type { CollectState } from '../../game/collectables/types';
import { HEART_COUNT } from '../../game/collectables/heartSpots';
import { translate } from '../i18n/translate';
import './wallet-hud.css';

export function heartsFoundToday(state: CollectState): number {
  return state.collectedIds.filter(id => id.startsWith('heart:')).length;
}

export function WalletHud({ coins, heartsFound, locale }: { coins: number; heartsFound: number; locale: Locale }) {
  const [bumped, setBumped] = useState(false);
  const previous = useRef(coins);
  useEffect(() => {
    if (coins === previous.current) return;
    previous.current = coins;
    setBumped(true);
    const id = setTimeout(() => setBumped(false), 420);
    return () => clearTimeout(id);
  }, [coins]);
  return <div className={`wallet-hud ${bumped ? 'is-bumped' : ''}`} role="status" aria-label={translate('wallet.coins', locale)}>
    <span className="wallet-hud__coins"><Coins size={18} weight="fill"/> {coins}</span>
    <span className="wallet-hud__hearts"><Heart size={14} weight="fill"/> {heartsFound} / {HEART_COUNT}</span>
  </div>;
}
```

Create `src/features/wallet/wallet-hud.css`, using the existing token names from `src/ui/tokens.css` (read that file and use the real variable names; the values below are the intent, not literal tokens to invent):

```css
.wallet-hud { display: flex; flex-direction: column; gap: .2rem; align-items: flex-end; padding: .45rem .7rem; border-radius: var(--radius-md, 12px); background: var(--surface-glass, rgba(18, 26, 22, .55)); color: var(--text-on-dark, #f4f1e6); font-variant-numeric: tabular-nums; transition: transform .18s ease; }
.wallet-hud.is-bumped { transform: scale(1.08); }
.wallet-hud__coins { display: flex; align-items: center; gap: .35rem; font-size: 1.05rem; font-weight: 600; }
.wallet-hud__hearts { display: flex; align-items: center; gap: .3rem; font-size: .78rem; opacity: .8; }
@media (prefers-reduced-motion: reduce) { .wallet-hud { transition: none; } }
```

Add to `src/content/locales/en.json`:

```json
"wallet.coins": "Coins",
"wallet.hearts": "Hearts found today"
```

Add to `src/content/locales/ml.json`:

```json
"wallet.coins": "നാണയങ്ങൾ",
"wallet.hearts": "ഇന്ന് കണ്ടെത്തിയ ഹൃദയങ്ങൾ"
```

In `src/app/App.tsx`, inside the `active&&<div className="hud" ...>` block, next to `hud-actions`, render:

```tsx
<WalletHud coins={collectState.coins} heartsFound={heartsFoundToday(collectState)} locale={locale}/>
```
with the matching import. Place it so it does not overlap the minimap; check in the running app and adjust the surrounding container class in `src/app/app.css` if needed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/walletHud.test.ts tests/i18n.test.ts tests/v2Localization.test.ts`
Expected: PASS. The locale parity tests confirm both catalogs carry the new keys.

- [ ] **Step 5: Check the HUD in the running app**

Run: `npm run dev` and pick up a coin.
Expected: the counter rises, briefly scales, and the hearts line reads "0 / 10". Nothing overlaps the minimap or the compass at 1280px wide.

- [ ] **Step 6: Commit**

```bash
git add src/features/wallet src/app/App.tsx src/app/app.css src/content/locales/en.json src/content/locales/ml.json tests/walletHud.test.ts
git commit -m "feat: wallet HUD with coin and heart counters"
```

---

### Task 9: Register the assets and verify every heart on foot

**Files:**
- Modify: `src/content/assets/manifest.ts`
- Modify: `src/game/collectables/heartSpots.ts` (adjust any spot that proves unreachable)
- Test: `tests/assets.test.ts` (read it first; it may already assert manifest shape)

- [ ] **Step 1: Add the three models to the manifest**

In `src/content/assets/manifest.ts`, inside `ASSET_MANIFEST`, after the animal entries:

```ts
  ...['coin.glb', 'coins_and_money.glb', 'pumping_heart_model.glb']
    .map(file => ({ id: `collectable-${file.replace(/\.glb$/, '').replace(/_/g, '-')}`, status: 'prototype' as const, sourcePath: `public/assets/collectables/${file}`, license: null, kind: 'environment' as const })),
```

- [ ] **Step 2: Run the asset tests**

Run: `npx vitest run tests/assets.test.ts`
Expected: PASS. If the test asserts every `sourcePath` exists on disk, the three files are already present.

- [ ] **Step 3: Walk to all ten hearts in the running app**

Run: `npm run dev`. For each heart in `dailyHeartSpots()`, use the dev overlay's position readout (`data-player-position` on `main`, shown in the dev aside) to navigate there on foot and collect it.
Expected: every heart is reachable on foot without clipping through geometry, and gives 10 coins.
Any heart that is floating unreachably, buried inside a building, or over water gets its coordinates adjusted in `heartSpots.ts` and re-checked. Record in the commit message which spots moved.

- [ ] **Step 4: Re-run the heart tests**

Run: `npx vitest run tests/heartSpots.test.ts`
Expected: PASS, including the 30m spacing rule after any adjustment.

- [ ] **Step 5: Commit**

```bash
git add src/content/assets/manifest.ts src/game/collectables/heartSpots.ts
git commit -m "feat: register collectable models and confirm heart spots on foot"
```

---

### Task 10: Full verification and build log

**Files:**
- Modify: `docs/06-build-log.md`

- [ ] **Step 1: Run the whole suite**

Run: `npm run typecheck && npm test && npm run build`
Expected: all three succeed. Paste the real output into the final report; if anything fails, fix it before continuing.

- [ ] **Step 2: Check the frame rate with coins on screen**

Run: `npm run dev`, play in a coin-dense area, and read the dev overlay's `Frame … ms / p95 …` line.
Expected: the median frame time is no worse than about 1ms above the same area before this feature. If it is worse, lower `DRAW_RADIUS` in `Collectables.tsx` to 100 and re-measure.

- [ ] **Step 3: Verify the midnight rollover without waiting**

In the browser console, set the saved date back a day and reload:

```js
const key='kerala-story:save:v1';const s=JSON.parse(localStorage.getItem(key));s.collect.dateKey='2000-01-01';localStorage.setItem(key,JSON.stringify(s));location.reload();
```
Expected: after the reload the wallet total is unchanged, every coin is back, and the hearts counter is 0 / 10.

- [ ] **Step 4: Record the work honestly in the build log**

Append a dated entry to `docs/06-build-log.md` stating what was built (daily coins, hearts, wallet, save v3), which checks were actually run, and what is still missing (no way to spend coins, no reward drops, no missions, single player only).

- [ ] **Step 5: Commit**

```bash
git add docs/06-build-log.md
git commit -m "docs: record collectables and wallet in the build log"
```

---

## Notes for the executor

- `AGENTS.md` forbids quests in this iteration. This plan adds none. If a task seems to need one, stop and ask.
- Do not claim the feature works from tests alone. Tasks 7, 8, 9 and 10 each require looking at the running app.
- `src/app/App.tsx` is dense and central. Keep the edits to it as small as the steps describe; do not restructure it.
