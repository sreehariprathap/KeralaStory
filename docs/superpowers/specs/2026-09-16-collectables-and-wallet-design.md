# Collectables and Wallet — Design

Date: 2026-09-16
Branch: `feature/map-expansion`
Status: approved for implementation (part 1 of 3)

## Scope

The collectable reward system is split into three parts. This spec covers **part 1
only**; parts 2 and 3 get their own specs because they depend on the wallet and
the collect pipeline built here.

1. **Collectables and wallet (this spec).** 100 daily coins, 10 daily hearts, the
   coin wallet, daily reset, pickup, HUD, save v3.
2. **Reward drops.** Money bundles worth 25 coins awarded for stunts and
   activities, plus placement of the stunt ramps in `public/assets/stunt/`.
3. **Mini missions.** Treasure hunts, stunt challenges, time trials, deliveries.

Part 3 changes the `AGENTS.md` rule "No quests, backend, or accounts in this
iteration". That rule stands until part 3 is specced and the user approves the
change; parts 1 and 2 add no quests.

Multiplayer is out of scope. Collectables are single-player and stored on the
device. The placement code is pure and seeded so a server can later run the same
function for the same day and produce the same world.

## Decisions

| Question | Decision |
| --- | --- |
| Ownership | Single player, local save. Server takes over later. |
| Respawn | All coins and hearts reset at local midnight. The whole set is rerolled from a date seed. |
| Coin count | 100 per day. |
| Coin placement | Evenly spread over walkable land across all regions. |
| Heart count | 10 per day, at fixed hand-picked hard spots. |
| Heart value | 10 coins each. |
| Pickup | Touch, no button. Coins on foot or in any vehicle; hearts on foot only. |
| Money bundle | Worth 25 coins, spawned only by the part 2 reward API. |

## Architecture

A pure logic core with a thin render layer. No React state changes per frame.

```
src/game/collectables/
  coinPlacement.ts    seeded daily coin spots (pure)
  heartSpots.ts       10 fixed heart spots (data)
  collectState.ts     wallet, today's collected ids, midnight reset (pure)
  pickup.ts           radius test and spatial grid (pure)
  Collectables.tsx    instanced rendering plus the frame-loop pickup check
  collectEvents.ts    pickup event emitter consumed by the HUD
src/features/wallet/
  WalletHud.tsx       coin counter and heart counter
  wallet-hud.css
```

Each unit has one purpose, a small interface, and can be tested without a
renderer. `Collectables.tsx` is the only file that touches three.js or React.

### Units

**`coinPlacement.ts`**

```ts
export interface CoinSpot { id: string; x: number; y: number; z: number }
export function dailyCoinSpots(dateKey: string, count?: number): CoinSpot[]
```

Seeds a small PRNG (the same `rng` shape as `coconutPlacement.ts`) from a hash of
`dateKey`. It samples candidate points inside `WORLD_BOUNDS`, keeps the ones that
pass the terrain rules, and stops at `count` (default 100) or after a fixed try
budget (2000 candidates), whichever comes first.

A spot is valid when it is:
- inside the world bounds and not water (`isWater`)
- on ground no steeper than roughly 25 degrees, sampled from `terrainHeight`
- not inside the waterfall footprint (`isWaterfallFootprint`)
- at least 15m from every spot already accepted

Coin `y` is `terrainHeight(x, z) + 1.0` so the coin floats at chest height.
Ids are `coin:<dateKey>:<index>` so they are stable across a reload of the same
day.

Placement deliberately reuses the helper style of `coconutPlacement.ts` rather
than importing its palm-specific rules, which exclude roads and gathering spots.
Coins are welcome on roads.

**`heartSpots.ts`**

Exports 10 hand-picked positions derived from world data, each with an id, a
position and a short label naming the place. Positions are written as
expressions over `LANDMARKS`, `V2_LAYOUT` and `terrainHeight` rather than raw
numbers, so they follow the world if it moves. Candidate places: the waterfall
ledge, a Kodassery treehouse branch, the temple roof edge, the jetty end, the
summit rock, the bridge underside, the park high point, a market rooftop, the
quay breakwater, and the mountain overlook. Each spot is confirmed reachable on
foot in the running app during implementation; any that is not is replaced.

Heart ids are fixed (`heart:<place>`) and do not include the date. Today's
collected set is what resets.

**`collectState.ts`**

```ts
export interface CollectState { coins: number; dateKey: string; collectedIds: string[] }
export function todayKey(now?: Date): string              // local YYYY-MM-DD
export function rollOver(state: CollectState, dateKey: string): CollectState
export function collect(state: CollectState, id: string, value: number): CollectState
```

`rollOver` clears `collectedIds` and sets the new `dateKey` when the key differs;
it never touches `coins`. `collect` is a no-op when the id is already collected,
which is what stops double counting.

**`pickup.ts`**

```ts
export type Carrier = 'foot' | 'bicycle' | 'car' | 'bike'
export function pickupRadius(carrier: Carrier): number     // 1.2 on foot, 2.5 otherwise
export function buildGrid(items: CollectItem[]): PickupGrid
export function findPickup(grid, x, z, y, carrier): CollectItem | null
```

A uniform 20m grid keeps the per-frame cost to a handful of distance tests.
`findPickup` rejects hearts when the carrier is not `foot`, and applies a
vertical limit of 3m so a player on a bridge does not vacuum up a coin below.

**`Collectables.tsx`**

- Builds today's item set on mount and whenever the date key changes.
- Draws coins with one `InstancedMesh` from `coin.glb` and hearts as 10 small
  nodes from `pumping_heart_model.glb`.
- Coins spin about 0.8 rad/s and bob 0.15m; hearts play their animation clip if
  the model has one, otherwise a scale pulse.
- Only items within 150m of the camera are drawn.
- In `useFrame`, reads the player position from the same source the camera uses,
  calls `findPickup`, and on a hit runs the collect path.
- Checks the date key every 30 seconds so a session running past midnight
  reshuffles without a reload.

### Data flow

1. On load, the save gives `{ coins, dateKey, collectedIds }`. If `dateKey` is not
   today's, `rollOver` runs before anything is drawn.
2. `dailyCoinSpots(todayKey())` plus the fixed hearts produce the day's items.
   Items whose id is in `collectedIds` are not drawn.
3. The frame loop tests the player position against the grid.
4. A hit calls `collect`, removes the instance, plays the effect and sound, emits
   a pickup event, and schedules a save.
5. The HUD listens for pickup events and re-renders only then.

Part 2 will add `spawnReward(position, value)`, which pushes a temporary item
through the same grid and collect path. Nothing in part 1 blocks that.

### Persistence

Save v3 extends v2:

```ts
export const CollectSaveSchema = z.object({
  coins: z.number().int().min(0),
  dateKey: z.string(),
  collectedIds: z.array(z.string()),
});
export const SaveV3Schema = SaveV2Schema.extend({
  version: z.literal(3),
  collect: CollectSaveSchema,
});
```

`migrateV2` sets `collect: { coins: 0, dateKey: todayKey(), collectedIds: [] }`.
`localSaveRepository.ts` gains the v3 branch in `parseSave` and `toV3`, keeping
the existing backup and archive behaviour, and `isFutureSave` moves to `> 3`.
Writes are debounced at 500ms so a run of pickups causes one write.

## Presentation

- **Pickup effect.** The item scales to 1.6 and fades over 0.25s, and a "+1",
  "+10" or "+25" label floats up about 1m and fades.
- **Audio.** A short coin chime and a softer heart thump, played through
  `AudioDirector` and following the existing mute and volume policy.
- **HUD.** A coin chip in a top corner using the shared tokens in
  `src/ui/tokens.css`, with a brief count-up animation, plus a
  "Hearts 3/10" line. Strings are added to `src/content/locales/en.json` and
  `ml.json`.
- **Map.** The explorer map shows neither coins nor hearts, so hearts stay hard
  to find.
- **Asset failure.** If a model fails to load, coins fall back to a gold disc and
  hearts to a red sphere, so play continues.

## Edge cases

| Case | Behaviour |
| --- | --- |
| No save or corrupt save | Start at 0 coins and today's key, through the existing archive path. |
| v1 or v2 save | Migrate forward; the wallet starts at 0. |
| Clock moved backwards | The wallet never decreases. A new key starts a new day. Offline farming is accepted and the server fixes it later. |
| Fewer than 100 valid spots | Use what the try budget found and log a dev warning. |
| Coin inside a building | Dropped on a one-time spawn check, as the coconut placement does. |
| Session crosses midnight | A 30 second date check reshuffles in place. |
| Heart unreachable on foot | Replaced during implementation after checking in the running app. |

## Testing

Vitest, on the pure modules:

1. `dailyCoinSpots` is deterministic for one date and differs across dates.
2. It returns 100 spots, all valid, all at least 15m apart.
3. No spot is in water or on a slope steeper than the limit.
4. `rollOver` clears collected ids on a new date and leaves coins alone; it is a
   no-op on the same date.
5. `collect` adds once per id and ignores a repeat.
6. Coin value 1, heart value 10, money bundle value 25.
7. `pickupRadius` differs by carrier, and `findPickup` never returns a heart for
   a non-foot carrier.
8. The v2 to v3 save migration preserves existing fields and starts the wallet at
   0.
9. `todayKey` is local time, not UTC.

In the running app, verified by hand: coins are visible and collectable on foot
and from a vehicle; hearts only on foot; all 10 heart spots are reachable; the
HUD counts up; coins survive a reload; the frame rate holds with 100 coins on
screen.

Before handoff: `npm run typecheck`, `npm test`, `npm run build`.

## Out of scope

- Any way to spend coins (no shop yet)
- Server ownership or shared collectables
- Missions, treasure hunts, ramp placement (parts 2 and 3)
- Lives or health, since a heart is only a coin bonus
