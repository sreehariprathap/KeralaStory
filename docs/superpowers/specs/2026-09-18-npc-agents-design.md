# Luttappi & Mayavi NPCs — Design

Date: 2026-09-18
Branch: `feature/map-expansion`
Status: approved for implementation

## Scope

Two roaming, chattable NPCs, reusing existing game patterns wherever they fit:

- **Luttappi** — naughty kuttichathan. Periodically steals 1-2 coins from a
  nearby player. Chat responses lean mischievous/teasing and may misdirect
  when asked about missions.
- **Mayavi** — good kuttichathan. Periodically blesses a nearby player with
  coins. Chat responses are helpful and hint at nearby missions. Mayavi also
  scares Luttappi away when both are near the same player.

Both are visible and interactable in solo play and in multiplayer rooms.
Movement, proximity detection, and the coin effects are pure client
simulation — no server dependency, work fully offline. Chat is the only
network-dependent part: it calls a new server endpoint that holds the LLM
keys, with an in-character canned fallback line when the network or both LLM
providers are unavailable.

Each NPC also shows a small live head icon on the world map (`ExplorerMap`),
at its current wander position, so players can see roughly where Luttappi and
Mayavi are without having encountered them yet.

There is no mission system in the codebase yet. This spec adds a minimal
mission-stub data set (name, zone, one-line description) purely so the NPCs'
system prompts have real content to hint at or misdirect about. Building an
actual quest/objective system is out of scope.

## Decisions

| Question | Decision |
| --- | --- |
| Visuals | Procedural primitive-shape models (same technique as `ProceduralAvatar`), not rigged `.glb` assets. No external asset pipeline needed. |
| Movement | Autonomous wander within a set of zones/landmarks per NPC, not fixed spawns and not player-following. |
| Coin effects | Periodic chance while the player is within the NPC's proximity radius, not a one-shot per encounter. |
| Chat trigger | Proximity prompt + button/key, same pattern as car/boat boarding (`interactionMessage` / `canInteract`). |
| Solo vs multiplayer | Both. NPC chat calls the same server endpoint regardless of room membership; coin effects and movement never touch the server. |
| Mission tie-in | Stubbed: a small static list of placeholder missions gives the LLM something concrete to reference, confuse, or hint at. |
| LLM provider | Gemini Flash primary, OpenRouter fallback on error/timeout. Keys live only in `apps/server`. |
| Coin authority | Client-side, mirroring the existing collectables system (`collectState.ts`). No server validation, consistent with how coin pickups already work. |
| Map presence | Both NPCs show a small live head icon on `ExplorerMap` at their current wander position, always visible (not gated on discovery like landmarks). |

## Architecture

```
src/game/npc/
  npcDefinitions.ts   static persona data: id, name, kind, skin/cloth colors, zones, radius, effect rates
  npcState.ts          pure: wander position update, proximity checks, coin-effect roll (seeded)
  NpcCharacter.tsx      procedural mesh + idle/wander animation, reads npcState position
  npcClient.ts          fetch wrapper to POST /npc/chat, timeout + canned fallback

src/features/npc/
  NpcChatPanel.tsx       proximity prompt + open chat panel (text input, reply display)
  npc-chat.css

src/features/map/
  ExplorerMap.tsx (edit)  adds a live NPC head pin per NPC, alongside the existing landmark/highlight pins

src/content/world/
  missionStubs.ts        static placeholder missions: { id, zoneId, title, hint }

apps/server/src/
  npcChat.ts              request validation, persona + mission-stub prompt assembly,
                           Gemini call, OpenRouter fallback, rate limiting
  index.ts (edit)          registers POST /npc/chat on the existing router
```

Each unit keeps one job, consistent with the rest of the codebase: pure state
in `.ts` files, rendering/animation in `.tsx`, network isolated to one client
module and one server module.

### Units

**`npcDefinitions.ts`**

```ts
export type NpcId = 'luttappi' | 'mayavi';
export interface NpcDefinition {
  id: NpcId;
  name: string;
  disposition: 'mischievous' | 'kind';
  skin: string; cloth: string; horn: string;
  zoneIds: ZoneId[];        // where this NPC wanders
  proximityRadiusM: number; // 4m, matches other interaction radii in the codebase
  effectIntervalMs: number; // how often a coin-effect roll is attempted while in range
  effectChance: number;     // probability per roll
}
export const NPC_DEFINITIONS: Record<NpcId, NpcDefinition>;
```

**`npcState.ts`**

```ts
export interface NpcRuntimeState { id: NpcId; position: Vec3; targetPosition: Vec3; nextEffectAt: number }
export function createNpcState(def: NpcDefinition, now: number): NpcRuntimeState
export function tickNpcWander(state: NpcRuntimeState, def: NpcDefinition, dtMs: number): NpcRuntimeState
export function isPlayerInRange(state: NpcRuntimeState, def: NpcDefinition, playerPos: Vec3): boolean
export function rollCoinEffect(state: NpcRuntimeState, def: NpcDefinition, now: number, rng: () => number): { state: NpcRuntimeState; coinsDelta: number } | null
```

`tickNpcWander` picks a new random point within the NPC's zones when it
reaches `targetPosition` (reusing `terrainHeight` for ground height, the same
way coin placement does), and moves at a slow walk speed toward it.
`rollCoinEffect` only fires at most once per `effectIntervalMs` while the
player is in range, returns `null` otherwise, and is pure/seedable for
testing. Luttappi's `coinsDelta` is negative (−1 or −2, clamped so the wallet
never goes below 0); Mayavi's is positive. When Mayavi and Luttappi are both
within a small "Mayavi scares Luttappi" radius of the same player, Luttappi's
`nextEffectAt` is pushed out and `NpcCharacter` plays a brief flee animation
(cosmetic only — no new state needed beyond re-rolling `targetPosition` away
from Mayavi).

**`NpcCharacter.tsx`**

Extends the existing `ProceduralAvatar` build (box/capsule primitives) with
two horn cones and the definition's colors. Reads position from
`npcState` each frame, orients to face the movement direction, and plays a
simple idle bob plus a walk-cycle reusing `ExplorerAvatar`'s stride logic at
a fixed slow speed. No new geometry system — same materials/lighting
approach as the player avatar so it fits the existing visual style.

**`npcClient.ts`**

```ts
export interface NpcChatRequest { npcId: NpcId; message: string; zoneId: ZoneId }
export interface NpcChatResult { reply: string; fallback: boolean }
export async function askNpc(req: NpcChatRequest, baseUrl: string): Promise<NpcChatResult>
```

Sends only `npcId`, the player's free-text `message`, and their current
`zoneId` (coarse location, not exact coordinates or wallet state — the server
doesn't need to trust client-reported coins for a chat reply). A 6s timeout;
on any failure returns `{ reply: <canned per-NPC line>, fallback: true }`
rather than throwing, so the chat panel never shows an error state.

**`NpcChatPanel.tsx`**

Mirrors the existing boarding-prompt pattern: when `isPlayerInRange` is true
for an NPC, the HUD shows "Press E to talk to Mayavi" (desktop) or a tap
target (touch), matching `interactionMessage`/`canInteract` conventions
already in `ExplorerControllerProps`. Opening it shows a simple text input
and the running exchange (not persisted across sessions — this is flavor
chat, not a saved log). Closes on Escape/back button or moving out of range.

**`ExplorerMap.tsx` (edit)**

Takes a new `npcs?: { id: NpcId; position: Vec3 }[]` prop (App.tsx supplies
current `npcState` positions each frame, same as it already supplies
`player`). Renders one `Pin` per NPC using the existing `Pin` component, but
with a small custom round face icon instead of a phosphor `Icon` — a
Luttappi head (orange fill, two dark horn triangles) and a Mayavi head (tan
fill, lighter horns), sized like the existing landmark pins. Unlike
`LANDMARKS`, these pins are not discovery-gated and their position updates
live as the NPC wanders, matching how the player's own marker already moves
on the map.

**`missionStubs.ts`**

```ts
export interface MissionStub { id: string; zoneId: ZoneId; title: string; hint: string }
export const MISSION_STUBS: MissionStub[]
```

4-6 flavorful placeholders (e.g. a lost boat key near the jetty, a coconut
delivery in Kodassery) with a one-line hint each. Passed into the server
prompt so Mayavi can "guide" toward one and Luttappi can misdirect about it.
Not wired to any actual gameplay reward — purely conversational color until
a real mission system exists.

**`apps/server/src/npcChat.ts`**

```ts
export const NpcChatBodySchema: z.ZodType<{ npcId: 'luttappi' | 'mayavi'; message: string; zoneId: string }>
export async function handleNpcChat(body: unknown, env: NpcChatEnv): Promise<{ reply: string } | { error: string }>
```

- Validates the body (message length capped, e.g. 300 chars, mirroring
  `ChatTextSchema`'s spirit).
- Builds a system prompt from the NPC's persona (from a server-side copy of
  the persona text — small enough to duplicate rather than share across the
  client/server boundary) plus `MISSION_STUBS` and static map/landmark names.
- Calls Gemini Flash (`GEMINI_API_KEY`) with a short timeout; on non-2xx or
  timeout, calls OpenRouter (`OPENROUTER_API_KEY`) once as fallback; on that
  failing too, returns `{ error: 'NPC_UNAVAILABLE' }` and the client shows
  its own canned line.
- Reuses `IpLimiter` (already in `apps/server/src/config.ts`) with a tighter
  window than chat, since LLM calls cost money — e.g. 10 requests/minute/IP.
- Registered as `createEndpoint('/npc/chat', { method: 'POST' }, ...)` beside
  the existing `/rooms/:code` endpoint in `apps/server/src/index.ts`.

New env vars (server-only, never `VITE_`-prefixed): `GEMINI_API_KEY`,
`OPENROUTER_API_KEY`, added to `.env.example` with placeholder values and a
comment that they're server-side only.

### Data flow

**Movement/coin effects (client, always-on, no network):**
1. Each active NPC's `npcState` ticks every frame alongside the player
   snapshot loop.
2. `isPlayerInRange` is checked against the current player position.
3. When in range, `rollCoinEffect` may fire on its own interval; a non-null
   result updates `collectState.coins` through the same reducer path
   `onCollect` already uses in `App.tsx`, plus a brief HUD toast ("Luttappi
   took 2 coins!" / "Mayavi blessed you with 3 coins!").
4. `NpcChatPanel`'s proximity prompt uses the same `isPlayerInRange` result.

**Chat (client → server, network-dependent):**
1. Player opens the panel and sends a message.
2. `npcClient.askNpc` posts `{npcId, message, zoneId}` to `/npc/chat`.
3. Server assembles the persona + mission-stub + map-knowledge prompt,
   calls Gemini, falls back to OpenRouter on failure, returns `{reply}`.
4. Client renders the reply in the panel. On any client/server failure,
   `askNpc` already resolved to a fallback line — no error UI branch needed.

### Error handling

- Chat: LLM/network failure → canned per-NPC fallback line, no crash, no
  retry loop, `fallback: true` flag available if the UI wants a subtle
  "signal weak" indicator (not required for v1).
- Rate limiting on `/npc/chat` protects against runaway LLM spend.
- Coin theft is clamped so `collectState.coins` never goes negative.
- Coin blessing has a soft daily cap (reuse the `rollOver`/date-key pattern
  from `collectState.ts`: track `npcBlessedToday` count in a small local
  field, reset at local midnight) to avoid infinite farming by camping near
  Mayavi.
- If `terrainHeight`/zone data can't place a valid wander target (edge case
  already handled elsewhere via try-budgets), the NPC holds its last valid
  position rather than throwing.

## Testing

Vitest, on the pure modules:

1. `tickNpcWander` moves toward `targetPosition` and picks a new one on
   arrival; new targets stay within the NPC's configured zones.
2. `isPlayerInRange` is a correct radius test at the boundary.
3. `rollCoinEffect` never fires before `effectIntervalMs` has elapsed, is
   deterministic for a seeded RNG, and Luttappi's delta never takes the
   wallet below 0.
4. Mayavi's "scare Luttappi away" changes Luttappi's target away from the
   player when both are in range.
5. `apps/server/tests/npcChat.test.ts`: validates body shape, rejects
   over-length messages, falls back to OpenRouter when the Gemini mock
   fails, returns `NPC_UNAVAILABLE` when both mocked providers fail, and
   enforces the rate limit — no real network calls in CI.

In the running app, verified by hand: both NPCs are visible and wandering
within their zones; proximity prompt appears/disappears correctly; chat
opens, sends, and shows a reply (or fallback with the server stopped);
coin theft/blessing visibly changes the wallet HUD; Mayavi scares Luttappi
off when both converge on the player.

Before handoff: `npm run typecheck`, `npm test`, `npm run build`.

## Out of scope

- A real mission/quest system (only a static hint-source stub)
- Persisted chat history
- Server-authoritative coin state or anti-cheat for the coin effects
- Voice chat or streaming token-by-token replies (single request/response)
- Custom rigged `.glb` character art for the NPCs
