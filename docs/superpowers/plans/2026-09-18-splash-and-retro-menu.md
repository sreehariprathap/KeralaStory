# Splash Screen and Retro Main Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "AN EXPLORER'S TALE" title screen with a logo splash, a retro PS2-era white main menu, a real Game Store with Equip, and a game load screen, mounting the 3D world only after the player starts a game.

**Architecture:** A pure reducer (`shellFlow.ts`) owns which shell screen is showing. `App.tsx` keeps all game and session state, hosts the reducer, and renders `<Shell/>` whenever the game is not in play. `WorldCanvas` mounts only while loading or playing, and reports real asset progress through a tiny three-free store fed by `THREE.DefaultLoadingManager`. Equip choices live in preferences.

**Tech Stack:** React 19, TypeScript 5.9 (strict, `noUnusedLocals`), Zod 4, Vite 8, Vitest (node environment, no DOM), three / @react-three/fiber, sharp (asset script), `@fontsource/oswald`.

**Spec:** `docs/superpowers/specs/2026-09-18-splash-and-retro-menu-design.md`

## Global Constraints

- Background: white (`#fff`) with the Kerala story map at 20% opacity. The shell references only `/assets/menu-map.webp` and never the 8.2 MB PNG.
- Tokens: `--shell-bg: #fff`, `--shell-ink: #0f3d1a`, `--shell-muted: #5d7a55`, `--shell-faint: #8aa383`, `--shell-accent: #2fbf3a`.
- Type: Oswald 500/700, self-hosted via `@fontsource/oswald`. With the Malayalam locale, shell text uses `'Noto Sans Malayalam'`.
- Splash: the Malayalam logo holds 1.2s, crossfades 1.0s, then the English logo holds. The minimum is 3.5s and the hard cap is 6s. With reduced motion, the crossfade is a cut at 1.7s.
- Menu order: New Game, Load Game, Multiplayer, Game Store, Settings, Account (SOON), Exit (installed PWA only).
- The byline text is exactly "BY SREEHARI".
- Store items are all `price: 0`, `unlocked: true`. The default equipped values are car `admin`, colour `#b3121f`, bike `roadster`, character `procedural`.
- All new user-facing copy goes through `translate()`. Every key is added to both `src/content/locales/en.json` and `ml.json`, because `tests/i18n.test.ts` enforces key parity.
- Unit tests run under Vitest in node, with no DOM. Keep logic in pure modules and test those.
- Run commands from the repo root: `npx vitest run <file>`, `npm run typecheck`, `npm test`, `npm run build`.
- **Deviation from the spec (intentional):** `menu-map.webp` is produced by a dedicated one-off script (`scripts/generate-menu-art.mjs`, same pattern as `generate-icons.mjs`) and committed. It is not added to `optimize-assets.mjs`, which only processes GLBs.
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/contracts/index.ts` | modify | `EquippedSchema`, `Preferences.equipped` |
| `src/content/store/catalog.ts` | create | `STORE_ITEMS`, `resolveEquipped`, `applyEquippedCharacter` |
| `src/features/shell/shellFlow.ts` | create | Pure screen reducer |
| `src/features/shell/menuNavigation.ts` | create | Pure `stepIndex` for list navigation |
| `src/features/shell/useMenuNavigation.ts` | create | Keyboard and gamepad input hook |
| `src/game/render/loadProgress.ts` | create | Three-free progress store |
| `src/app/WorldCanvas.tsx` | modify | Feeds `DefaultLoadingManager` progress into the store |
| `scripts/generate-menu-art.mjs` | create | Writes `public/assets/menu-map.webp` |
| `src/features/shell/shell.css` | create | Theme and screen styles |
| `src/features/shell/ShellFrame.tsx` | create | Shared header, Back, and footer hints |
| `src/features/shell/Splash.tsx` | create | Logo crossfade and loader |
| `src/features/shell/MainMenu.tsx` | create | Menu list and Exit |
| `src/features/shell/GameLoadScreen.tsx` | create | Progress, tips, and the error state |
| `src/features/shell/StoreScreen.tsx` | create | Store tabs, preview, Equip |
| `src/features/shell/MultiplayerScreen.tsx` | create | Shell-framed `MultiplayerEntry` |
| `src/features/shell/NewGameConfirm.tsx` | create | Overwrite confirmation |
| `src/features/shell/CharacterScreen.tsx` | create | Shell-framed `ProfileForm` |
| `src/features/shell/SettingsScreen.tsx` | create | Shell-framed `SettingsPanel` |
| `src/features/shell/AccountScreen.tsx` | create | SOON card |
| `src/features/shell/GoodbyeScreen.tsx` | create | Shown when `window.close()` is ignored |
| `src/features/shell/Shell.tsx` | create | Splash timers, screen switch, load fade |
| `src/features/multiplayer/MultiplayerEntry.tsx` | modify | Optional `showBack` prop |
| `src/features/profile/ProfileForm.tsx` | modify | Optional `initialCharacterId` prop |
| `src/app/App.tsx` | modify | Hosts the reducer, canvas gate, removes old title, pause Quit, equipped defaults |
| `src/content/locales/en.json`, `ml.json` | modify | `shell.*` keys |
| `tests/storeCatalog.test.ts`, `tests/shellFlow.test.ts`, `tests/menuNavigation.test.ts`, `tests/loadProgress.test.ts` | create | Unit tests |
| `tests/preferences.test.ts` | modify | Add the `equipped` default |
| `docs/06-build-log.md` | modify | Build log entry |

---

### Task 1: Equipped preferences and store catalogue

**Files:**
- Modify: `src/contracts/index.ts:66-67`
- Create: `src/content/store/catalog.ts`
- Create: `tests/storeCatalog.test.ts`
- Modify: `tests/preferences.test.ts`

**Interfaces:**
- Consumes: `CAR_MODELS`, `CHARACTER_MODELS` (`src/content/assets/models.ts`), `BIKE_MODELS` (`src/content/assets/bikeProfiles.ts`), `CAR_PAINT_COLORS` (`src/content/assets/vehicleProfiles.ts`), `ExplorerProfile`.
- Produces:
  - `EquippedSchema`, `type Equipped = { carId: string; carColor: string; bikeId: string; characterId: string }`, `DEFAULT_EQUIPPED: Equipped`; `Preferences.equipped: Equipped`.
  - `type StoreKind = 'car' | 'bike' | 'character'`; `interface StoreItem { id: string; kind: StoreKind; name: string; price: 0; unlocked: true }`; `STORE_ITEMS: readonly StoreItem[]`; `storeItems(kind: StoreKind): StoreItem[]`.
  - `type CharacterChoiceId = 'procedural' | typeof CHARACTER_MODELS[number]['id']`; `interface ResolvedEquipped { carId: CarModelId; carColor: string; bikeId: BikeModelId; characterId: CharacterChoiceId }`; `resolveEquipped(equipped: Partial<Equipped> | undefined): ResolvedEquipped`; `applyEquippedCharacter(profile: ExplorerProfile, characterId: CharacterChoiceId): ExplorerProfile`; `PROCEDURAL_CHARACTER_ID = 'procedural'`.

- [ ] **Step 1: Write the failing catalogue test**

Create `tests/storeCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CAR_MODELS, CHARACTER_MODELS } from '../src/content/assets/models';
import { BIKE_MODELS } from '../src/content/assets/bikeProfiles';
import { STORE_ITEMS, storeItems, resolveEquipped, applyEquippedCharacter, PROCEDURAL_CHARACTER_ID } from '../src/content/store/catalog';
import type { ExplorerProfile } from '../src/contracts';

const profile: ExplorerProfile = { id: 'p1', displayName: 'Sree', avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } };

describe('store catalogue', () => {
  it('lists exactly the spawnable cars, bikes, and characters plus the procedural explorer', () => {
    expect(storeItems('car').map(i => i.id)).toEqual(CAR_MODELS.map(m => m.id));
    expect(storeItems('bike').map(i => i.id)).toEqual(BIKE_MODELS.map(m => m.id));
    expect(storeItems('character').map(i => i.id)).toEqual([PROCEDURAL_CHARACTER_ID, ...CHARACTER_MODELS.map(m => m.id)]);
  });

  it('prices everything at zero and unlocks everything', () => {
    expect(STORE_ITEMS.every(i => i.price === 0 && i.unlocked)).toBe(true);
  });

  it('resolves defaults when nothing is equipped', () => {
    expect(resolveEquipped(undefined)).toEqual({ carId: 'admin', carColor: '#b3121f', bikeId: 'roadster', characterId: 'procedural' });
  });

  it('keeps valid equipped ids and falls back per field on unknown ones', () => {
    expect(resolveEquipped({ carId: 'supercar', carColor: '#16181c', bikeId: 'yamaha', characterId: 'straw-hat' }))
      .toEqual({ carId: 'supercar', carColor: '#16181c', bikeId: 'yamaha', characterId: 'straw-hat' });
    expect(resolveEquipped({ carId: 'mazda-rx7', carColor: 'purple', bikeId: 'nope', characterId: 'tommy' }))
      .toEqual({ carId: 'admin', carColor: '#b3121f', bikeId: 'roadster', characterId: 'procedural' });
  });

  it('applies the equipped character to a profile', () => {
    expect(applyEquippedCharacter(profile, 'messi').characterModelId).toBe('messi');
    expect(applyEquippedCharacter({ ...profile, characterModelId: 'messi' }, 'procedural').characterModelId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/storeCatalog.test.ts`
Expected: FAIL. The import of `../src/content/store/catalog` cannot be resolved.

- [ ] **Step 3: Add `EquippedSchema` to the preferences contract**

In `src/contracts/index.ts`, replace the `PreferencesSchema` line (line 66) with:

```ts
export const DEFAULT_EQUIPPED = { carId: 'admin', carColor: '#b3121f', bikeId: 'roadster', characterId: 'procedural' } as const;
// Ids are validated against the catalogues by resolveEquipped, so removed models never break parsing.
export const EquippedSchema = z.object({
  carId: z.string().min(1).max(64).default(DEFAULT_EQUIPPED.carId),
  carColor: z.string().min(1).max(32).default(DEFAULT_EQUIPPED.carColor),
  bikeId: z.string().min(1).max(64).default(DEFAULT_EQUIPPED.bikeId),
  characterId: z.string().min(1).max(64).default(DEFAULT_EQUIPPED.characterId),
});
export type Equipped = z.infer<typeof EquippedSchema>;
export const PreferencesSchema = z.object({ locale: LocaleSchema.default('en'), controls: ControlsPreferenceSchema.default('auto'), haptics: z.boolean().default(true), equipped: EquippedSchema.default({ ...DEFAULT_EQUIPPED }) });
```

- [ ] **Step 4: Create the catalogue**

Create `src/content/store/catalog.ts`:

```ts
import { CAR_MODELS, CHARACTER_MODELS, type CarModelId } from '../assets/models';
import { BIKE_MODELS, type BikeModelId } from '../assets/bikeProfiles';
import { CAR_PAINT_COLORS } from '../assets/vehicleProfiles';
import { DEFAULT_EQUIPPED, type Equipped, type ExplorerProfile } from '../../contracts';

export type StoreKind = 'car' | 'bike' | 'character';
/** Everything is free for now; prices become a data change when purchases arrive. */
export interface StoreItem { id: string; kind: StoreKind; name: string; price: 0; unlocked: true }

export const PROCEDURAL_CHARACTER_ID = 'procedural';
export type CharacterChoiceId = typeof PROCEDURAL_CHARACTER_ID | typeof CHARACTER_MODELS[number]['id'];

const item = (kind: StoreKind) => (model: { id: string; name: string }): StoreItem => ({ id: model.id, kind, name: model.name, price: 0, unlocked: true });

export const STORE_ITEMS: readonly StoreItem[] = [
  ...CAR_MODELS.map(item('car')),
  ...BIKE_MODELS.map(item('bike')),
  item('character')({ id: PROCEDURAL_CHARACTER_ID, name: 'Explorer' }),
  ...CHARACTER_MODELS.map(item('character')),
];

export function storeItems(kind: StoreKind): StoreItem[] {
  return STORE_ITEMS.filter(entry => entry.kind === kind);
}

export interface ResolvedEquipped { carId: CarModelId; carColor: string; bikeId: BikeModelId; characterId: CharacterChoiceId }

const has = (kind: StoreKind, id: string | undefined) => id !== undefined && STORE_ITEMS.some(entry => entry.kind === kind && entry.id === id);

export function resolveEquipped(equipped: Partial<Equipped> | undefined): ResolvedEquipped {
  return {
    carId: (has('car', equipped?.carId) ? equipped!.carId : DEFAULT_EQUIPPED.carId) as CarModelId,
    carColor: CAR_PAINT_COLORS.some(color => color.value === equipped?.carColor) ? equipped!.carColor! : DEFAULT_EQUIPPED.carColor,
    bikeId: (has('bike', equipped?.bikeId) ? equipped!.bikeId : DEFAULT_EQUIPPED.bikeId) as BikeModelId,
    characterId: (has('character', equipped?.characterId) ? equipped!.characterId : DEFAULT_EQUIPPED.characterId) as CharacterChoiceId,
  };
}

export function applyEquippedCharacter(profile: ExplorerProfile, characterId: CharacterChoiceId): ExplorerProfile {
  const { characterModelId: _previous, ...rest } = profile;
  return characterId === PROCEDURAL_CHARACTER_ID ? rest : { ...rest, characterModelId: characterId };
}
```

`_previous` is intentionally unused. If `noUnusedLocals` flags it, replace the destructuring with `const rest = { ...profile }; delete rest.characterModelId;`.

- [ ] **Step 5: Run the catalogue test**

Run: `npx vitest run tests/storeCatalog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Update the preferences tests for the new default**

In `tests/preferences.test.ts`, add the import `import { DEFAULT_EQUIPPED } from '../src/contracts';`. Then change every expected preferences object to include `equipped`. Each one is an object literal containing `locale`, `controls` and `haptics`. For example, the first expectation becomes:

```ts
expect(result.preferences).toEqual({ locale: 'en', controls: 'auto', haptics: true, equipped: { ...DEFAULT_EQUIPPED } });
```

Any `writePreferences({...})` call in the tests also needs `equipped: { ...DEFAULT_EQUIPPED }` added to satisfy the type. Then append this test inside the `describe` block:

```ts
it('keeps an explicit equip choice and fills equip defaults for older preferences', () => {
  const storage = new MemoryStorage();
  storage.setItem('kerala-story:preferences:v1', '{"locale":"en","controls":"auto","haptics":true}');
  expect(loadPreferences(storage).preferences.equipped).toEqual(DEFAULT_EQUIPPED);
  const equipped = { carId: 'supercar', carColor: '#16181c', bikeId: 'yamaha', characterId: 'messi' };
  expect(writePreferences({ locale: 'en', controls: 'auto', haptics: true, equipped }, storage).ok).toBe(true);
  expect(loadPreferences(storage).preferences.equipped).toEqual(equipped);
});
```

- [ ] **Step 7: Run the preferences tests and typecheck**

Run: `npx vitest run tests/preferences.test.ts tests/storeCatalog.test.ts && npm run typecheck`
Expected: all PASS, and typecheck exits 0. If typecheck flags other `Preferences` literals (e.g. in `src/app/App.tsx`), they already spread `...preferences`, so no change should be needed. Fix any literal that doesn't spread by adding `equipped: preferences.equipped`.

- [ ] **Step 8: Commit**

```bash
git add src/contracts/index.ts src/content/store/catalog.ts tests/storeCatalog.test.ts tests/preferences.test.ts
git commit -m "feat: add store catalogue and equipped preferences

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Shell flow reducer

**Files:**
- Create: `src/features/shell/shellFlow.ts`
- Create: `tests/shellFlow.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ShellScreen = 'splash' | 'menu' | 'newGameConfirm' | 'character' | 'multiplayer' | 'store' | 'settings' | 'account' | 'goodbye' | 'loading' | 'loadError' | 'playing'`
  - `type MenuItem = 'newGame' | 'loadGame' | 'multiplayer' | 'store' | 'settings' | 'account' | 'exit'`
  - `type PendingGame = 'new' | 'load' | 'room'`
  - `interface ShellState { screen: ShellScreen; splashTimerDone: boolean; splashAssetsReady: boolean; hasSave: boolean; inviteCode: string; pendingGame: PendingGame | null }`
  - `type ShellEvent` (the union below)
  - `createShellState(init: { hasSave: boolean; inviteCode: string }): ShellState`
  - `reduceShell(state: ShellState, event: ShellEvent): ShellState`

- [ ] **Step 1: Write the failing tests**

Create `tests/shellFlow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createShellState, reduceShell, type ShellEvent, type ShellState } from '../src/features/shell/shellFlow';

const run = (state: ShellState, ...events: ShellEvent[]) => events.reduce(reduceShell, state);
const menu = (hasSave = false) => run(createShellState({ hasSave, inviteCode: '' }), { type: 'SPLASH_TIMER_DONE' }, { type: 'SPLASH_ASSETS_READY' });

describe('shell flow', () => {
  it('starts on the splash', () => {
    expect(createShellState({ hasSave: false, inviteCode: '' }).screen).toBe('splash');
  });

  it('leaves the splash only when both the timer and the assets are done', () => {
    const start = createShellState({ hasSave: false, inviteCode: '' });
    expect(run(start, { type: 'SPLASH_TIMER_DONE' }).screen).toBe('splash');
    expect(run(start, { type: 'SPLASH_ASSETS_READY' }).screen).toBe('splash');
    expect(run(start, { type: 'SPLASH_ASSETS_READY' }, { type: 'SPLASH_TIMER_DONE' }).screen).toBe('menu');
  });

  it('leaves the splash at the hard cap regardless of assets', () => {
    expect(run(createShellState({ hasSave: false, inviteCode: '' }), { type: 'SPLASH_CAP' }).screen).toBe('menu');
  });

  it('sends an invite link straight to multiplayer after the splash', () => {
    const state = run(createShellState({ hasSave: false, inviteCode: 'K7Q2M9XA' }), { type: 'SPLASH_CAP' });
    expect(state.screen).toBe('multiplayer');
  });

  it('ignores Load Game without a save and loads with one', () => {
    expect(run(menu(false), { type: 'SELECT', item: 'loadGame' }).screen).toBe('menu');
    const loading = run(menu(true), { type: 'SELECT', item: 'loadGame' });
    expect(loading.screen).toBe('loading');
    expect(loading.pendingGame).toBe('load');
  });

  it('confirms New Game only when a save exists', () => {
    expect(run(menu(false), { type: 'SELECT', item: 'newGame' }).screen).toBe('character');
    expect(run(menu(true), { type: 'SELECT', item: 'newGame' }).screen).toBe('newGameConfirm');
    expect(run(menu(true), { type: 'SELECT', item: 'newGame' }, { type: 'CONFIRM_NEW' }).screen).toBe('character');
    expect(run(menu(true), { type: 'SELECT', item: 'newGame' }, { type: 'BACK' }).screen).toBe('menu');
  });

  it('starts loading a new game when the character is submitted', () => {
    const state = run(menu(false), { type: 'SELECT', item: 'newGame' }, { type: 'PROFILE_SUBMITTED' });
    expect(state.screen).toBe('loading');
    expect(state.pendingGame).toBe('new');
  });

  it('returns to the menu with Back from every sub-screen', () => {
    for (const item of ['multiplayer', 'store', 'settings', 'account'] as const) {
      expect(run(menu(), { type: 'SELECT', item }, { type: 'BACK' }).screen).toBe('menu');
    }
    expect(run(menu(), { type: 'SELECT', item: 'newGame' }, { type: 'BACK' }).screen).toBe('menu');
  });

  it('leaves Exit to the component and shows goodbye when closing is blocked', () => {
    expect(run(menu(), { type: 'SELECT', item: 'exit' }).screen).toBe('menu');
    expect(run(menu(), { type: 'EXIT_BLOCKED' }).screen).toBe('goodbye');
    expect(run(menu(), { type: 'EXIT_BLOCKED' }, { type: 'BACK' }).screen).toBe('menu');
  });

  it('enters a room through loading and falls back to multiplayer when the room is lost', () => {
    const loading = run(menu(), { type: 'SELECT', item: 'multiplayer' }, { type: 'ROOM_ENTERED' });
    expect(loading.screen).toBe('loading');
    expect(loading.pendingGame).toBe('room');
    expect(run(loading, { type: 'ROOM_LOST' }).screen).toBe('multiplayer');
  });

  it('plays when the world is ready, retries after a failure, and quits to the menu', () => {
    const loading = run(menu(true), { type: 'SELECT', item: 'loadGame' });
    expect(run(loading, { type: 'WORLD_READY' }).screen).toBe('playing');
    const failed = run(loading, { type: 'LOAD_FAILED' });
    expect(failed.screen).toBe('loadError');
    expect(run(failed, { type: 'RETRY' }).screen).toBe('loading');
    expect(run(failed, { type: 'BACK' }).screen).toBe('menu');
    const quit = run(loading, { type: 'WORLD_READY' }, { type: 'QUIT_TO_MENU' });
    expect(quit.screen).toBe('menu');
    expect(quit.pendingGame).toBeNull();
  });

  it('ignores WORLD_READY outside loading', () => {
    expect(run(menu(), { type: 'WORLD_READY' }).screen).toBe('menu');
  });

  it('tracks save changes so Load Game follows a reset', () => {
    expect(run(menu(true), { type: 'SAVE_CHANGED', hasSave: false }, { type: 'SELECT', item: 'loadGame' }).screen).toBe('menu');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/shellFlow.test.ts`
Expected: FAIL. The module cannot be resolved.

- [ ] **Step 3: Implement the reducer**

Create `src/features/shell/shellFlow.ts`:

```ts
export type ShellScreen = 'splash' | 'menu' | 'newGameConfirm' | 'character' | 'multiplayer' | 'store' | 'settings' | 'account' | 'goodbye' | 'loading' | 'loadError' | 'playing';
export type MenuItem = 'newGame' | 'loadGame' | 'multiplayer' | 'store' | 'settings' | 'account' | 'exit';
export type PendingGame = 'new' | 'load' | 'room';

export interface ShellState {
  screen: ShellScreen;
  splashTimerDone: boolean;
  splashAssetsReady: boolean;
  hasSave: boolean;
  inviteCode: string;
  pendingGame: PendingGame | null;
}

export type ShellEvent =
  | { type: 'SPLASH_TIMER_DONE' }
  | { type: 'SPLASH_ASSETS_READY' }
  | { type: 'SPLASH_CAP' }
  | { type: 'SELECT'; item: MenuItem }
  | { type: 'BACK' }
  | { type: 'CONFIRM_NEW' }
  | { type: 'PROFILE_SUBMITTED' }
  | { type: 'ROOM_ENTERED' }
  | { type: 'ROOM_LOST' }
  | { type: 'WORLD_READY' }
  | { type: 'LOAD_FAILED' }
  | { type: 'RETRY' }
  | { type: 'QUIT_TO_MENU' }
  | { type: 'EXIT_BLOCKED' }
  | { type: 'SAVE_CHANGED'; hasSave: boolean };

export function createShellState({ hasSave, inviteCode }: { hasSave: boolean; inviteCode: string }): ShellState {
  return { screen: 'splash', splashTimerDone: false, splashAssetsReady: false, hasSave, inviteCode, pendingGame: null };
}

const afterSplash = (state: ShellState): ShellState => ({ ...state, screen: state.inviteCode ? 'multiplayer' : 'menu' });
const loading = (state: ShellState, pendingGame: PendingGame): ShellState => ({ ...state, screen: 'loading', pendingGame });
const BACK_TO_MENU: readonly ShellScreen[] = ['newGameConfirm', 'character', 'multiplayer', 'store', 'settings', 'account', 'goodbye', 'loadError'];

export function reduceShell(state: ShellState, event: ShellEvent): ShellState {
  switch (event.type) {
    case 'SPLASH_TIMER_DONE':
      if (state.screen !== 'splash') return state;
      return state.splashAssetsReady ? afterSplash({ ...state, splashTimerDone: true }) : { ...state, splashTimerDone: true };
    case 'SPLASH_ASSETS_READY':
      if (state.screen !== 'splash') return state;
      return state.splashTimerDone ? afterSplash({ ...state, splashAssetsReady: true }) : { ...state, splashAssetsReady: true };
    case 'SPLASH_CAP':
      return state.screen === 'splash' ? afterSplash(state) : state;
    case 'SELECT':
      if (state.screen !== 'menu') return state;
      switch (event.item) {
        case 'newGame': return { ...state, screen: state.hasSave ? 'newGameConfirm' : 'character' };
        case 'loadGame': return state.hasSave ? loading(state, 'load') : state;
        case 'exit': return state; // MainMenu calls window.close() and reports EXIT_BLOCKED if it did not work.
        default: return { ...state, screen: event.item };
      }
    case 'CONFIRM_NEW':
      return state.screen === 'newGameConfirm' ? { ...state, screen: 'character' } : state;
    case 'PROFILE_SUBMITTED':
      return state.screen === 'character' ? loading(state, 'new') : state;
    case 'ROOM_ENTERED':
      return state.screen === 'multiplayer' ? loading(state, 'room') : state;
    case 'ROOM_LOST':
      return state.pendingGame === 'room' ? { ...state, screen: 'multiplayer', pendingGame: null } : state;
    case 'WORLD_READY':
      return state.screen === 'loading' ? { ...state, screen: 'playing' } : state;
    case 'LOAD_FAILED':
      return state.screen === 'loading' || state.screen === 'playing' ? { ...state, screen: 'loadError' } : state;
    case 'RETRY':
      return state.screen === 'loadError' ? { ...state, screen: 'loading' } : state;
    case 'BACK':
      return BACK_TO_MENU.includes(state.screen) ? { ...state, screen: 'menu', pendingGame: null } : state;
    case 'QUIT_TO_MENU':
      return { ...state, screen: 'menu', pendingGame: null };
    case 'EXIT_BLOCKED':
      return state.screen === 'menu' ? { ...state, screen: 'goodbye' } : state;
    case 'SAVE_CHANGED':
      return { ...state, hasSave: event.hasSave };
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/shellFlow.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/shell/shellFlow.ts tests/shellFlow.test.ts
git commit -m "feat: add shell flow reducer for splash, menu, and loading

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Menu navigation helper and input hook

**Files:**
- Create: `src/features/shell/menuNavigation.ts`
- Create: `src/features/shell/useMenuNavigation.ts`
- Create: `tests/menuNavigation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `stepIndex(disabled: readonly boolean[], current: number, delta: 1 | -1): number`, which wraps and skips disabled entries, and returns `current` if everything is disabled.
  - `firstEnabled(disabled: readonly boolean[]): number`
  - `useMenuNavigation(options: { count: number; disabled?: readonly boolean[]; onActivate: (index: number) => void; onBack?: () => void; onTab?: (delta: 1 | -1) => void; enabled?: boolean }): { index: number; setIndex: (index: number) => void }`

- [ ] **Step 1: Write the failing tests**

Create `tests/menuNavigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { firstEnabled, stepIndex } from '../src/features/shell/menuNavigation';

describe('menu navigation', () => {
  it('moves down and up with wrap-around', () => {
    const none = [false, false, false];
    expect(stepIndex(none, 0, 1)).toBe(1);
    expect(stepIndex(none, 2, 1)).toBe(0);
    expect(stepIndex(none, 0, -1)).toBe(2);
  });

  it('skips disabled entries', () => {
    const disabled = [false, true, false, true];
    expect(stepIndex(disabled, 0, 1)).toBe(2);
    expect(stepIndex(disabled, 2, 1)).toBe(0);
    expect(stepIndex(disabled, 0, -1)).toBe(2);
  });

  it('stays put when everything else is disabled', () => {
    expect(stepIndex([true, true], 0, 1)).toBe(0);
  });

  it('finds the first enabled entry', () => {
    expect(firstEnabled([true, false, false])).toBe(1);
    expect(firstEnabled([true, true])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/menuNavigation.test.ts`
Expected: FAIL. The module cannot be resolved.

- [ ] **Step 3: Implement the pure helper**

Create `src/features/shell/menuNavigation.ts`:

```ts
/** Next selectable index in a vertical list, wrapping at both ends and skipping disabled rows. */
export function stepIndex(disabled: readonly boolean[], current: number, delta: 1 | -1): number {
  const count = disabled.length;
  for (let step = 1; step <= count; step++) {
    const next = (current + delta * step + count * step) % count;
    if (!disabled[next]) return next;
  }
  return current;
}

export function firstEnabled(disabled: readonly boolean[]): number {
  const index = disabled.findIndex(value => !value);
  return index === -1 ? 0 : index;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/menuNavigation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the input hook**

Create `src/features/shell/useMenuNavigation.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { firstEnabled, stepIndex } from './menuNavigation';

interface MenuNavigationOptions {
  count: number;
  disabled?: readonly boolean[];
  onActivate: (index: number) => void;
  onBack?: () => void;
  onTab?: (delta: 1 | -1) => void;
  /** False while a text field or dialog owns the keyboard. */
  enabled?: boolean;
}

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;
// Standard gamepad mapping: 0 A, 1 B, 12 up, 13 down, 14 left, 15 right.
const PAD = { a: 0, b: 1, up: 12, down: 13, left: 14, right: 15 } as const;

export function useMenuNavigation({ count, disabled, onActivate, onBack, onTab, enabled = true }: MenuNavigationOptions) {
  const flags = disabled ?? Array.from({ length: count }, () => false);
  const [index, setIndex] = useState(() => firstEnabled(flags));
  const latest = useRef({ flags, index, onActivate, onBack, onTab });
  latest.current = { flags, index, onActivate, onBack, onTab };

  useEffect(() => {
    if (!enabled) return;
    const move = (delta: 1 | -1) => setIndex(current => stepIndex(latest.current.flags, current, delta));
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (TYPING.test(target.tagName) || target.isContentEditable);
      if (event.code === 'Escape') { if (latest.current.onBack) { event.preventDefault(); latest.current.onBack(); } return; }
      if (typing) return;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') { event.preventDefault(); move(1); }
      else if (event.code === 'ArrowUp' || event.code === 'KeyW') { event.preventDefault(); move(-1); }
      else if (latest.current.onTab && (event.code === 'ArrowRight' || event.code === 'KeyD')) { event.preventDefault(); latest.current.onTab(1); }
      else if (latest.current.onTab && (event.code === 'ArrowLeft' || event.code === 'KeyA')) { event.preventDefault(); latest.current.onTab(-1); }
      else if (event.code === 'Enter' || event.code === 'Space') {
        if (latest.current.flags[latest.current.index]) return;
        event.preventDefault(); latest.current.onActivate(latest.current.index);
      }
    };
    window.addEventListener('keydown', keydown);

    // Gamepads have no events for buttons, so poll once per frame and act on press edges only.
    let frame = 0; let previous: boolean[] = [];
    const poll = () => {
      const pad = navigator.getGamepads?.().find(Boolean);
      if (pad) {
        const pressed = pad.buttons.map(button => button.pressed);
        const edge = (button: number) => pressed[button] && !previous[button];
        if (edge(PAD.down)) move(1);
        if (edge(PAD.up)) move(-1);
        if (edge(PAD.right)) latest.current.onTab?.(1);
        if (edge(PAD.left)) latest.current.onTab?.(-1);
        if (edge(PAD.a) && !latest.current.flags[latest.current.index]) latest.current.onActivate(latest.current.index);
        if (edge(PAD.b)) latest.current.onBack?.();
        previous = pressed;
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => { window.removeEventListener('keydown', keydown); cancelAnimationFrame(frame); };
  }, [enabled]);

  // Keep the selection valid when the list or its disabled flags change.
  useEffect(() => {
    setIndex(current => (current >= count || flags[current] ? firstEnabled(flags) : current));
  }, [count, flags.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { index, setIndex };
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/shell/menuNavigation.ts src/features/shell/useMenuNavigation.ts tests/menuNavigation.test.ts
git commit -m "feat: add keyboard and gamepad menu navigation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Real world-loading progress

**Files:**
- Create: `src/game/render/loadProgress.ts`
- Modify: `src/app/WorldCanvas.tsx` (imports and module top level)
- Create: `tests/loadProgress.test.ts`

**Interfaces:**
- Consumes: `DefaultLoadingManager` from `three`. Every `useLoader(GLTFLoader, …)` in the game constructs a `GLTFLoader` with the default manager.
- Produces:
  - `nextProgress(previous: number, loaded: number, total: number): number`, which is monotonic, clamped to 0..1, and ignores `total <= 0`.
  - `reportLoadProgress(loaded: number, total: number): void`
  - `resetLoadProgress(): void`
  - `getLoadProgress(): number`
  - `subscribeLoadProgress(listener: () => void): () => void`, shaped for `useSyncExternalStore`.

This module must not import `three`. The shell imports it, and the shell must stay out of the three.js chunk.

- [ ] **Step 1: Write the failing tests**

Create `tests/loadProgress.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getLoadProgress, nextProgress, reportLoadProgress, resetLoadProgress, subscribeLoadProgress } from '../src/game/render/loadProgress';

describe('load progress', () => {
  beforeEach(() => resetLoadProgress());

  it('never moves backwards when more items are discovered', () => {
    expect(nextProgress(0, 5, 10)).toBe(0.5);
    expect(nextProgress(0.5, 6, 20)).toBe(0.5);
    expect(nextProgress(0.5, 18, 20)).toBe(0.9);
  });

  it('ignores empty totals and clamps to one', () => {
    expect(nextProgress(0.3, 0, 0)).toBe(0.3);
    expect(nextProgress(0.3, 12, 10)).toBe(1);
  });

  it('notifies subscribers and resets', () => {
    let calls = 0;
    const unsubscribe = subscribeLoadProgress(() => { calls++; });
    reportLoadProgress(1, 4);
    expect(getLoadProgress()).toBe(0.25);
    expect(calls).toBe(1);
    resetLoadProgress();
    expect(getLoadProgress()).toBe(0);
    unsubscribe();
    reportLoadProgress(2, 4);
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/loadProgress.test.ts`
Expected: FAIL. The module cannot be resolved.

- [ ] **Step 3: Implement the store**

Create `src/game/render/loadProgress.ts`:

```ts
// Three-free on purpose: the menu shell reads this without pulling the 3D chunk into the first load.
let progress = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

/** Loaders discover more files as they go, so the ratio can drop; the bar never should. */
export function nextProgress(previous: number, loaded: number, total: number): number {
  if (total <= 0) return previous;
  return Math.max(previous, Math.min(1, loaded / total));
}

export function reportLoadProgress(loaded: number, total: number): void {
  progress = nextProgress(progress, loaded, total);
  notify();
}

export function resetLoadProgress(): void {
  progress = 0;
  notify();
}

export function getLoadProgress(): number {
  return progress;
}

export function subscribeLoadProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/loadProgress.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Feed the store from three's default loading manager**

In `src/app/WorldCanvas.tsx`, change the three import on line 4 to:

```ts
import { PCFShadowMap, Object3D, DirectionalLight, DefaultLoadingManager } from 'three';
```

and add, after the last import:

```ts
import { reportLoadProgress } from '../game/render/loadProgress';

// Set at module load, before any scene renders, so the first GLB request is counted.
DefaultLoadingManager.onProgress = (_url, loaded, total) => reportLoadProgress(loaded, total);
```

- [ ] **Step 6: Typecheck and run all tests**

Run: `npm run typecheck && npm test`
Expected: exit 0, and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/game/render/loadProgress.ts src/app/WorldCanvas.tsx tests/loadProgress.test.ts
git commit -m "feat: report real world-loading progress

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Menu art, font, translations, and shell theme

**Files:**
- Create: `scripts/generate-menu-art.mjs`
- Create: `public/assets/menu-map.webp` (generated)
- Modify: `package.json` (dependency and script)
- Modify: `src/content/locales/en.json`, `src/content/locales/ml.json`
- Create: `src/features/shell/shell.css`
- Create: `src/features/shell/ShellFrame.tsx`

**Interfaces:**
- Consumes: `useT` from `src/features/i18n/translate.ts`.
- Produces:
  - `/assets/menu-map.webp`
  - the `shell.*` translation keys listed in Step 3
  - CSS classes used by every screen: `.shell`, `.shell__bg`, `.shell-list`, `.shell-list__item` (plus `.is-selected`, `.is-disabled`), `.shell-tag`, `.shell-button` (plus `.is-primary`), `.shell-segments`
  - `ShellFrame({ title, subtitle?, hints?, onBack?, children }: { title: string; subtitle?: ReactNode; hints?: string; onBack?: () => void; children: ReactNode }): JSX.Element`
  - `ShellSegments({ value }: { value: number }): JSX.Element`, where `value` is 0..1

- [ ] **Step 1: Add the font dependency and generate the menu art**

Run: `npm install @fontsource/oswald@5`
Expected: `package.json` lists `@fontsource/oswald` under dependencies.

Create `scripts/generate-menu-art.mjs`:

```js
// Renders the menu background from the Kerala story map. Run: node scripts/generate-menu-art.mjs
// The source is an 8 MB PNG; the menu shows it at 20% opacity, so a small WebP is indistinguishable.
import sharp from 'sharp';

const source = new URL('../public/assets/kerala-story-map.png', import.meta.url).pathname;
const target = new URL('../public/assets/menu-map.webp', import.meta.url).pathname;
const info = await sharp(source).resize(1600, 1600, { fit: 'inside' }).webp({ quality: 60 }).toFile(target);
console.log(`menu-map.webp written (${Math.round(info.size / 1024)} KB)`);
```

In `package.json` `scripts`, add after `"generate:icons"`:

```json
"generate:menu-art": "node scripts/generate-menu-art.mjs"
```

Run: `npm run generate:menu-art`
Expected: prints `menu-map.webp written (N KB)` with N ≤ 200. If N > 200, lower `quality` to 50 and rerun.

- [ ] **Step 2: Confirm key parity is enforced before adding keys**

Run: `npx vitest run tests/i18n.test.ts`
Expected: PASS. This is the baseline. Step 3 must keep it passing.

- [ ] **Step 3: Add the translation keys**

Add these entries to `src/content/locales/en.json`, inside the top-level object and before the closing `}` (watch the trailing commas):

```json
"shell.byline": "BY SREEHARI",
"shell.loading": "Loading, by Sreehari",
"shell.menu.newGame": "New Game",
"shell.menu.loadGame": "Load Game",
"shell.menu.multiplayer": "Multiplayer",
"shell.menu.store": "Game Store",
"shell.menu.settings": "Settings",
"shell.menu.account": "Account",
"shell.menu.exit": "Exit",
"shell.soon": "SOON",
"shell.free": "FREE",
"shell.equipped": "EQUIPPED",
"shell.equip": "Equip",
"shell.back": "Back",
"shell.hints.menu": "↑↓ SELECT · ENTER CONFIRM",
"shell.hints.list": "↑↓ SELECT · ENTER CONFIRM · ESC BACK",
"shell.hints.store": "← → TAB · ↑↓ SELECT · ENTER EQUIP · ESC BACK",
"shell.hints.back": "ESC BACK",
"shell.store.cars": "Cars",
"shell.store.bikes": "Bikes",
"shell.store.characters": "Characters",
"shell.store.coins": "coins",
"shell.store.explorer": "Explorer",
"shell.store.noPreview": "Preview coming soon",
"shell.mp.subtitle": "Up to 10 players",
"shell.mp.joinCreate": "Join / Create",
"shell.mp.browse": "Browse lobbies",
"shell.mp.publicPrivate": "Public · Private",
"shell.newGame.title": "Start a new game?",
"shell.newGame.body": "Your current journey ({name} · {count} discoveries) will be replaced.",
"shell.newGame.keep": "Keep playing",
"shell.newGame.start": "Start new",
"shell.character.title": "Create your character",
"shell.account.body": "Sign-in and cloud saves are coming. Your game is saved in this browser for now.",
"shell.settings.reset": "Reset local explorer",
"shell.goodbye.title": "Thanks for playing",
"shell.goodbye.back": "Back to menu",
"shell.load.label": "Loading Kodassery",
"shell.load.errorTitle": "The world couldn't load",
"shell.load.errorBody": "Your saved game is safe. Try loading the world again.",
"shell.load.retry": "Retry",
"shell.load.backToMenu": "Back to menu",
"shell.tip.1": "Hold SHIFT while driving for a nitrous boost.",
"shell.tip.2": "Press M to open the world map.",
"shell.tip.3": "Hearts reappear every day. Find them all.",
"shell.tip.4": "Walk into the circle at Kodakara for a football match.",
"shell.tip.5": "Equip a car in the Game Store to have it ready first.",
"shell.pauseQuit": "Quit to main menu"
```

Add the same keys to `src/content/locales/ml.json`:

```json
"shell.byline": "BY SREEHARI",
"shell.loading": "ലോഡ് ചെയ്യുന്നു, ശ്രീഹരി ഒരുക്കിയത്",
"shell.menu.newGame": "പുതിയ കളി",
"shell.menu.loadGame": "കളി തുടരുക",
"shell.menu.multiplayer": "കൂട്ടുകളി",
"shell.menu.store": "ഗെയിം സ്റ്റോർ",
"shell.menu.settings": "ക്രമീകരണങ്ങൾ",
"shell.menu.account": "അക്കൗണ്ട്",
"shell.menu.exit": "പുറത്തുകടക്കുക",
"shell.soon": "ഉടൻ",
"shell.free": "സൗജന്യം",
"shell.equipped": "തിരഞ്ഞെടുത്തു",
"shell.equip": "തിരഞ്ഞെടുക്കുക",
"shell.back": "തിരികെ",
"shell.hints.menu": "↑↓ തിരഞ്ഞെടുക്കുക · ENTER ഉറപ്പിക്കുക",
"shell.hints.list": "↑↓ തിരഞ്ഞെടുക്കുക · ENTER ഉറപ്പിക്കുക · ESC തിരികെ",
"shell.hints.store": "← → ടാബ് · ↑↓ തിരഞ്ഞെടുക്കുക · ENTER ഉപയോഗിക്കുക · ESC തിരികെ",
"shell.hints.back": "ESC തിരികെ",
"shell.store.cars": "കാറുകൾ",
"shell.store.bikes": "ബൈക്കുകൾ",
"shell.store.characters": "കഥാപാത്രങ്ങൾ",
"shell.store.coins": "നാണയങ്ങൾ",
"shell.store.explorer": "യാത്രികൻ",
"shell.store.noPreview": "പ്രിവ്യൂ ഉടൻ വരുന്നു",
"shell.mp.subtitle": "പരമാവധി 10 പേർ",
"shell.mp.joinCreate": "ചേരുക / തുടങ്ങുക",
"shell.mp.browse": "ലോബികൾ കാണുക",
"shell.mp.publicPrivate": "പൊതു · സ്വകാര്യം",
"shell.newGame.title": "പുതിയ കളി തുടങ്ങണോ?",
"shell.newGame.body": "നിലവിലെ യാത്ര ({name} · {count} കണ്ടെത്തലുകൾ) മാറ്റിസ്ഥാപിക്കപ്പെടും.",
"shell.newGame.keep": "തുടർന്നു കളിക്കുക",
"shell.newGame.start": "പുതിയത് തുടങ്ങുക",
"shell.character.title": "നിങ്ങളുടെ കഥാപാത്രം",
"shell.account.body": "സൈൻ-ഇൻ, ക്ലൗഡ് സേവ് എന്നിവ ഉടൻ വരുന്നു. ഇപ്പോൾ നിങ്ങളുടെ കളി ഈ ബ്രൗസറിൽ സൂക്ഷിച്ചിരിക്കുന്നു.",
"shell.settings.reset": "പ്രാദേശിക യാത്രികനെ പുനഃസജ്ജമാക്കുക",
"shell.goodbye.title": "കളിച്ചതിന് നന്ദി",
"shell.goodbye.back": "മെനുവിലേക്ക്",
"shell.load.label": "കോടശ്ശേരി ലോഡ് ചെയ്യുന്നു",
"shell.load.errorTitle": "ലോകം ലോഡ് ചെയ്യാനായില്ല",
"shell.load.errorBody": "നിങ്ങളുടെ സേവ് സുരക്ഷിതമാണ്. വീണ്ടും ശ്രമിക്കുക.",
"shell.load.retry": "വീണ്ടും ശ്രമിക്കുക",
"shell.load.backToMenu": "മെനുവിലേക്ക്",
"shell.tip.1": "ഡ്രൈവ് ചെയ്യുമ്പോൾ SHIFT അമർത്തിപ്പിടിച്ചാൽ നൈട്രോ വേഗം കിട്ടും.",
"shell.tip.2": "ലോക ഭൂപടം തുറക്കാൻ M അമർത്തുക.",
"shell.tip.3": "ഹൃദയങ്ങൾ ദിവസവും വീണ്ടും വരും. എല്ലാം കണ്ടെത്തൂ.",
"shell.tip.4": "ഫുട്ബോൾ കളിക്കാൻ കൊടകരയിലെ വൃത്തത്തിലേക്ക് നടക്കൂ.",
"shell.tip.5": "സ്റ്റോറിൽ ഒരു കാർ തിരഞ്ഞെടുത്താൽ അത് ആദ്യം തയ്യാറായിരിക്കും.",
"shell.pauseQuit": "പ്രധാന മെനുവിലേക്ക്"
```

- [ ] **Step 4: Verify parity**

Run: `npx vitest run tests/i18n.test.ts tests/v2Localization.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the theme**

Create `src/features/shell/shell.css`:

```css
.shell{--shell-bg:#fff;--shell-ink:#0f3d1a;--shell-muted:#5d7a55;--shell-faint:#8aa383;--shell-accent:#2fbf3a;position:absolute;inset:0;z-index:20;background:var(--shell-bg);color:var(--shell-ink);font-family:'Oswald','Noto Sans Malayalam',sans-serif;overflow:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.shell[lang="ml"]{font-family:'Noto Sans Malayalam','Oswald',sans-serif}
.shell__bg{position:absolute;inset:0;background:url(/assets/menu-map.webp) center/cover no-repeat;opacity:.2;pointer-events:none}
.shell__content{position:relative;height:100%}
.shell button{font-family:inherit}
.shell-segments{display:flex;gap:3px;width:min(420px,70vw);height:16px;border:2px solid var(--shell-ink);padding:3px}
.shell-segments i{flex:1;background:var(--shell-accent);opacity:.12;transition:opacity .2s}
.shell-segments i.is-on{opacity:1}
.shell-byline{font-size:12px;letter-spacing:4px;color:var(--shell-muted)}
.shell-list{display:flex;flex-direction:column;gap:4px;list-style:none;margin:0;padding:0}
.shell-list__item{display:flex;align-items:center;gap:10px;width:100%;border:0;border-left:5px solid transparent;background:none;padding:6px 12px;text-align:left;text-transform:uppercase;font-weight:700;font-size:clamp(20px,2.6vw,30px);letter-spacing:.5px;color:var(--shell-muted);cursor:pointer}
.shell-list__item.is-selected,.shell-list__item:focus-visible{outline:none;color:var(--shell-ink);border-left-color:var(--shell-accent);background:linear-gradient(90deg,rgba(47,191,58,.18),transparent)}
.shell-list__item.is-disabled{opacity:.4;cursor:not-allowed}
.shell-list__item small{margin-left:auto;font-size:.55em;font-weight:500;letter-spacing:1px}
.shell-tag{font-size:11px;font-weight:500;letter-spacing:1.5px;border:1px solid currentColor;padding:0 6px;border-radius:2px}
.shell-tag.is-equipped{background:var(--shell-accent);border-color:var(--shell-accent);color:#fff}
.shell-button{border:2px solid var(--shell-ink);background:#fff;color:var(--shell-ink);text-transform:uppercase;font-weight:700;letter-spacing:1px;padding:10px 20px;font-size:15px;cursor:pointer}
.shell-button.is-primary{background:var(--shell-accent);border-color:var(--shell-accent);color:#fff}
.shell-button:focus-visible{outline:3px solid var(--shell-accent);outline-offset:2px}
.shell-frame{position:relative;height:100%;display:flex;flex-direction:column;gap:18px;padding:28px clamp(16px,4vw,48px)}
.shell-frame__head{display:flex;align-items:center;gap:16px}
.shell-frame__head h1{margin:0;text-transform:uppercase;font-size:clamp(26px,3.4vw,40px);font-weight:700;letter-spacing:.5px}
.shell-frame__sub{margin-left:auto;font-size:13px;letter-spacing:2px;color:var(--shell-muted);text-transform:uppercase}
.shell-frame__back{border:0;background:none;color:var(--shell-muted);font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;padding:6px 0}
.shell-frame__body{flex:1;min-height:0;overflow:auto}
.shell-frame__foot{font-size:11px;letter-spacing:2px;color:var(--shell-faint);text-transform:uppercase}
.uses-touch .shell-frame__foot,.uses-touch .shell-menu__hints{display:none}
.shell-splash,.shell-load{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:16px}
.shell-splash__logos{position:relative;width:min(640px,86vw);aspect-ratio:684/353}
.shell-splash__logos img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity 1s ease}
.shell-splash__logos.is-cut img{transition:none}
.shell-menu{height:100%;display:grid;grid-template-columns:minmax(260px,40%) 1fr;align-items:center;padding:0 clamp(16px,5vw,64px)}
.shell-menu__logo{width:100%;max-width:640px;justify-self:center}
.shell-menu__corner{position:absolute;top:18px;right:18px;display:flex;gap:10px;align-items:center}
.shell-menu__foot{position:absolute;left:clamp(16px,5vw,64px);bottom:18px;font-size:11px;letter-spacing:2px;color:var(--shell-faint);text-transform:uppercase}
.shell-load__logo{width:min(420px,70vw)}
.shell-load__label{font-weight:700;letter-spacing:2px;text-transform:uppercase}
.shell-load__tip{color:var(--shell-muted);font-size:14px;letter-spacing:.5px;min-height:1.4em}
.shell-load.is-leaving{animation:shell-fade .4s ease forwards}
@keyframes shell-fade{to{opacity:0}}
.shell-tabs{display:flex;gap:22px;flex-wrap:wrap}
.shell-tab{border:0;border-bottom:4px solid transparent;background:none;padding:4px 0;text-transform:uppercase;font-weight:700;font-size:16px;color:var(--shell-faint);cursor:pointer}
.shell-tab.is-active{color:var(--shell-ink);border-bottom-color:var(--shell-accent)}
.shell-tab:disabled{opacity:.45;cursor:not-allowed}
.shell-store{display:grid;grid-template-columns:minmax(240px,38%) 1fr;gap:24px;height:100%;min-height:0}
.shell-store .shell-list{overflow:auto}
.shell-store .shell-list__item{font-size:18px}
.shell-stage{border:2px solid rgba(15,61,26,.15);background:rgba(255,255,255,.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;min-height:260px}
.shell-stage__view{width:100%;flex:1;min-height:220px;display:grid;place-items:center}
.shell-swatches{display:flex;gap:8px}
.shell-swatches button{width:28px;height:28px;border:2px solid #fff;outline:2px solid transparent;cursor:pointer}
.shell-swatches button[aria-pressed="true"]{outline-color:var(--shell-accent)}
.shell-card{max-width:560px;display:flex;flex-direction:column;gap:18px;font-size:17px;color:var(--shell-muted)}
.shell-actions{display:flex;gap:12px;flex-wrap:wrap}
.shell .multiplayer-panel,.shell .settings-panel{color:var(--shell-ink)}
@media (max-width:720px){.shell-menu{grid-template-columns:1fr;grid-template-rows:auto 1fr;align-content:center;gap:12px}.shell-menu__logo{order:-1;max-width:320px}.shell-store{grid-template-columns:1fr}.shell-stage{min-height:200px}}
@media (prefers-reduced-motion:reduce){.shell-splash__logos img{transition:none}.shell-load.is-leaving{animation:none;opacity:0}}
```

- [ ] **Step 6: Create the shared frame and segmented bar**

Create `src/features/shell/ShellFrame.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useT } from '../i18n/translate';

export function ShellSegments({ value }: { value: number }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return <div className="shell-segments" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lit * 10}>
    {Array.from({ length: 10 }, (_, index) => <i key={index} className={index < lit ? 'is-on' : ''}/>)}
  </div>;
}

export function ShellFrame({ title, subtitle, hints, onBack, children }: { title: string; subtitle?: ReactNode; hints?: string; onBack?: () => void; children: ReactNode }) {
  const t = useT();
  return <section className="shell-frame" aria-labelledby="shell-frame-title">
    <header className="shell-frame__head">
      {onBack && <button className="shell-frame__back" onClick={onBack}>← {t('shell.back')}</button>}
      <h1 id="shell-frame-title">{title}</h1>
      {subtitle && <span className="shell-frame__sub">{subtitle}</span>}
    </header>
    <div className="shell-frame__body">{children}</div>
    {hints && <footer className="shell-frame__foot">{hints}</footer>}
  </section>;
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck && npx vitest run tests/i18n.test.ts`
Expected: exit 0, PASS.

```bash
git add scripts/generate-menu-art.mjs public/assets/menu-map.webp package.json package-lock.json src/content/locales/en.json src/content/locales/ml.json src/features/shell/shell.css src/features/shell/ShellFrame.tsx
git commit -m "feat: add retro shell theme, menu art, and shell copy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Splash, main menu, account, and goodbye screens

**Files:**
- Create: `src/features/shell/Splash.tsx`
- Create: `src/features/shell/MainMenu.tsx`
- Create: `src/features/shell/AccountScreen.tsx`
- Create: `src/features/shell/GoodbyeScreen.tsx`

**Interfaces:**
- Consumes: `ShellFrame`, `ShellSegments` (Task 5); `useMenuNavigation` (Task 3); `MenuItem` (Task 2); `isStandalone` from `src/pwa/device.ts`; `LanguageToggle`, `InstallPrompt`, `FullscreenButton`.
- Produces:
  - `SPLASH_MIN_MS = 3500`, `SPLASH_CAP_MS = 6000`, `SPLASH_ASSETS: readonly string[]`, `preloadSplashAssets(): Promise<void>`
  - `Splash({ reducedMotion }: { reducedMotion: boolean })`
  - `MainMenu({ hasSave, locale, onLocaleChange, touch, onSelect, onExitBlocked }: { hasSave: boolean; locale: Locale; onLocaleChange: (l: Locale) => void; touch: boolean; onSelect: (item: MenuItem) => void; onExitBlocked: () => void })`
  - `AccountScreen({ onBack }: { onBack: () => void })`
  - `GoodbyeScreen({ onBack }: { onBack: () => void })`

- [ ] **Step 1: Create the splash**

Create `src/features/shell/Splash.tsx`:

```tsx
import { useEffect, useState } from 'react';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-700.css';
import { useT } from '../i18n/translate';
import { ShellSegments } from './ShellFrame';

export const SPLASH_MIN_MS = 3500;
export const SPLASH_CAP_MS = 6000;
const CROSSFADE_AT_MS = 1200;
const REDUCED_CUT_AT_MS = 1700;
export const SPLASH_ASSETS = ['/assets/logo-malayalam.png', '/assets/logo-english.png', '/assets/menu-map.webp'] as const;

/** Resolves once the menu's own art and font are usable. Failures resolve too: the menu degrades rather than waits. */
export function preloadSplashAssets(): Promise<void> {
  const images = SPLASH_ASSETS.map(src => new Promise<void>(resolve => { const image = new Image(); image.onload = image.onerror = () => resolve(); image.src = src; }));
  const font = document.fonts?.load('700 20px Oswald').then(() => undefined, () => undefined) ?? Promise.resolve();
  return Promise.all([...images, font]).then(() => undefined);
}

export function Splash({ reducedMotion }: { reducedMotion: boolean }) {
  const t = useT();
  const [english, setEnglish] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const swap = setTimeout(() => setEnglish(true), reducedMotion ? REDUCED_CUT_AT_MS : CROSSFADE_AT_MS);
    const started = performance.now();
    const tick = setInterval(() => setProgress(Math.min(1, (performance.now() - started) / SPLASH_MIN_MS)), 100);
    return () => { clearTimeout(swap); clearInterval(tick); };
  }, [reducedMotion]);
  return <section className="shell-splash" aria-busy="true" aria-label={t('shell.loading')}>
    <div className={`shell-splash__logos ${reducedMotion ? 'is-cut' : ''}`}>
      <img src="/assets/logo-malayalam.png" alt="GTA കോടശ്ശേരി ഡയറീസ് — ഒരു മലയാളി കളിക്കളം" lang="ml" style={{ opacity: english ? 0 : 1 }} onError={event => { event.currentTarget.hidden = true; }}/>
      <img src="/assets/logo-english.png" alt="GTA Kodassery Diaries — A Kerala Saga" lang="en" style={{ opacity: english ? 1 : 0 }} onError={event => { event.currentTarget.hidden = true; }}/>
    </div>
    <ShellSegments value={progress}/>
    <span className="shell-byline">{t('shell.byline')}</span>
  </section>;
}
```

- [ ] **Step 2: Create the main menu**

Create `src/features/shell/MainMenu.tsx`:

```tsx
import { useMemo } from 'react';
import type { Locale } from '../../contracts';
import { isStandalone } from '../../pwa/device';
import { useT, type TranslationKey } from '../i18n/translate';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { FullscreenButton, InstallPrompt } from '../app-shell/PwaControls';
import { useMenuNavigation } from './useMenuNavigation';
import type { MenuItem } from './shellFlow';
import { version } from '../../../package.json';

const ITEMS: { id: MenuItem; label: TranslationKey; soon?: boolean }[] = [
  { id: 'newGame', label: 'shell.menu.newGame' },
  { id: 'loadGame', label: 'shell.menu.loadGame' },
  { id: 'multiplayer', label: 'shell.menu.multiplayer' },
  { id: 'store', label: 'shell.menu.store' },
  { id: 'settings', label: 'shell.menu.settings' },
  { id: 'account', label: 'shell.menu.account', soon: true },
  { id: 'exit', label: 'shell.menu.exit' },
];
const EXIT_CHECK_MS = 300;

export function MainMenu({ hasSave, locale, onLocaleChange, touch, onSelect, onExitBlocked }: { hasSave: boolean; locale: Locale; onLocaleChange: (locale: Locale) => void; touch: boolean; onSelect: (item: MenuItem) => void; onExitBlocked: () => void }) {
  const t = useT();
  // A browser tab cannot close itself, so Exit only exists in the installed app.
  const items = useMemo(() => ITEMS.filter(item => item.id !== 'exit' || isStandalone()), []);
  const disabled = items.map(item => item.id === 'loadGame' && !hasSave);
  const activate = (index: number) => {
    const item = items[index];
    if (item.id === 'exit') {
      window.close();
      setTimeout(() => { if (document.visibilityState === 'visible') onExitBlocked(); }, EXIT_CHECK_MS);
      return;
    }
    onSelect(item.id);
  };
  const { index, setIndex } = useMenuNavigation({ count: items.length, disabled, onActivate: activate });
  return <section className="shell-menu">
    <div className="shell-menu__corner"><LanguageToggle value={locale} onChange={onLocaleChange}/><InstallPrompt/><FullscreenButton className="entry-settings" landscape={touch}/></div>
    <ul className="shell-list" role="menu" aria-label="Main menu">
      {items.map((item, i) => <li key={item.id} role="none">
        <button role="menuitem" tabIndex={i === index ? 0 : -1} aria-disabled={disabled[i]} className={`shell-list__item ${i === index ? 'is-selected' : ''} ${disabled[i] ? 'is-disabled' : ''}`}
          onMouseEnter={() => { if (!disabled[i]) setIndex(i); }} onFocus={() => setIndex(i)} onClick={() => { if (!disabled[i]) activate(i); }}>
          {t(item.label)}{item.soon && <span className="shell-tag">{t('shell.soon')}</span>}
        </button>
      </li>)}
    </ul>
    <img className="shell-menu__logo" src="/assets/logo-english.png" alt="GTA Kodassery Diaries — A Kerala Saga" onError={event => { event.currentTarget.hidden = true; }}/>
    <footer className="shell-menu__foot">{t('shell.byline')} · v{version}<span className="shell-menu__hints"> · {t('shell.hints.menu')}</span></footer>
  </section>;
}
```

If `import { version } from '../../../package.json'` fails typecheck (named JSON imports), use `import pkg from '../../../package.json';` and `pkg.version`. `resolveJsonModule` is already on because the locale JSON is imported.

- [ ] **Step 3: Create the Account and Goodbye screens**

Create `src/features/shell/AccountScreen.tsx`:

```tsx
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

export function AccountScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  useMenuNavigation({ count: 1, onActivate: onBack, onBack });
  return <ShellFrame title={t('shell.menu.account')} subtitle={<span className="shell-tag">{t('shell.soon')}</span>} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-card"><p>{t('shell.account.body')}</p><div className="shell-actions"><button className="shell-button" onClick={onBack} autoFocus>{t('shell.back')}</button></div></div>
  </ShellFrame>;
}
```

Create `src/features/shell/GoodbyeScreen.tsx`:

```tsx
import { useT } from '../i18n/translate';
import { useMenuNavigation } from './useMenuNavigation';

export function GoodbyeScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  useMenuNavigation({ count: 1, onActivate: onBack, onBack });
  return <section className="shell-splash">
    <img className="shell-load__logo" src="/assets/logo-english.png" alt="GTA Kodassery Diaries — A Kerala Saga" onError={event => { event.currentTarget.hidden = true; }}/>
    <h1 className="shell-load__label">{t('shell.goodbye.title')}</h1>
    <span className="shell-byline">{t('shell.byline')}</span>
    <button className="shell-button is-primary" onClick={onBack} autoFocus>{t('shell.goodbye.back')}</button>
  </section>;
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck`
Expected: exit 0.

```bash
git add src/features/shell/Splash.tsx src/features/shell/MainMenu.tsx src/features/shell/AccountScreen.tsx src/features/shell/GoodbyeScreen.tsx
git commit -m "feat: add splash, main menu, account, and goodbye screens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Game load screen

**Files:**
- Create: `src/features/shell/GameLoadScreen.tsx`

**Interfaces:**
- Consumes: `subscribeLoadProgress`, `getLoadProgress` (Task 4); `ShellSegments` (Task 5).
- Produces:
  - `GameLoadScreen({ failed, leaving, onRetry, onBack }: { failed: boolean; leaving: boolean; onRetry: () => void; onBack: () => void })`
  - `displayPercent(progress: number, leaving: boolean): number`, exported for the plan's manual checks. It holds real progress at ≤ 95 until the player is ready.

- [ ] **Step 1: Create the screen**

Create `src/features/shell/GameLoadScreen.tsx`:

```tsx
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getLoadProgress, subscribeLoadProgress } from '../../game/render/loadProgress';
import { useT, type TranslationKey } from '../i18n/translate';
import { ShellSegments } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

const TIPS: TranslationKey[] = ['shell.tip.1', 'shell.tip.2', 'shell.tip.3', 'shell.tip.4', 'shell.tip.5'];
const TIP_MS = 4000;

/** Files finish before the player spawns, so real progress tops out at 95 until the world reports ready. */
export function displayPercent(progress: number, leaving: boolean): number {
  return leaving ? 100 : Math.round(Math.min(progress, 1) * 95);
}

export function GameLoadScreen({ failed, leaving, onRetry, onBack }: { failed: boolean; leaving: boolean; onRetry: () => void; onBack: () => void }) {
  const t = useT();
  const progress = useSyncExternalStore(subscribeLoadProgress, getLoadProgress);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => { const id = setInterval(() => setTip(value => (value + 1) % TIPS.length), TIP_MS); return () => clearInterval(id); }, []);
  const { index } = useMenuNavigation({ count: 2, enabled: failed, onActivate: i => (i === 0 ? onRetry() : onBack()), onBack });
  const percent = displayPercent(progress, leaving);

  if (failed) return <section className="shell-load" role="alert">
    <h1 className="shell-load__label">{t('shell.load.errorTitle')}</h1>
    <p className="shell-load__tip">{t('shell.load.errorBody')}</p>
    <div className="shell-actions">
      <button className={`shell-button is-primary ${index === 0 ? 'is-selected' : ''}`} onClick={onRetry} autoFocus>{t('shell.load.retry')}</button>
      <button className={`shell-button ${index === 1 ? 'is-selected' : ''}`} onClick={onBack}>{t('shell.load.backToMenu')}</button>
    </div>
  </section>;

  return <section className={`shell-load ${leaving ? 'is-leaving' : ''}`} role="status" aria-live="polite" aria-busy={!leaving}>
    <img className="shell-load__logo" src="/assets/logo-english.png" alt="GTA Kodassery Diaries — A Kerala Saga" onError={event => { event.currentTarget.hidden = true; }}/>
    <span className="shell-load__label">{t('shell.load.label')} · {percent}%</span>
    <ShellSegments value={percent / 100}/>
    <p className="shell-load__tip">TIP · {t(TIPS[tip])}</p>
  </section>;
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck`
Expected: exit 0.

```bash
git add src/features/shell/GameLoadScreen.tsx
git commit -m "feat: add game load screen with real progress and retry

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Game Store screen

**Files:**
- Create: `src/features/shell/StoreScreen.tsx`

**Interfaces:**
- Consumes: `storeItems`, `resolveEquipped`, `applyEquippedCharacter`, `PROCEDURAL_CHARACTER_ID`, `type StoreKind` (Task 1); `Equipped`, `ExplorerProfile`; `CAR_PAINT_COLORS`, `VEHICLE_PROFILES`; lazy `CarPreview` (`src/features/vehicles/CarPreview.tsx`, props `{ modelId: CarModelId; color?: string }`); lazy `AvatarPreview` (`src/app/WorldCanvas.tsx`, props `{ profile: ExplorerProfile; reducedMotion: boolean }`); `useMenuNavigation`; `ShellFrame`.
- Produces: `StoreScreen({ equipped, coins, previewProfile, reducedMotion, onEquip, onBack }: { equipped: Equipped; coins: number; previewProfile: ExplorerProfile; reducedMotion: boolean; onEquip: (next: Equipped) => void; onBack: () => void })`

- [ ] **Step 1: Create the screen**

Create `src/features/shell/StoreScreen.tsx`:

```tsx
import { Suspense, lazy, useState } from 'react';
import type { Equipped, ExplorerProfile } from '../../contracts';
import type { CarModelId } from '../../content/assets/models';
import { CAR_PAINT_COLORS, VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';
import { applyEquippedCharacter, resolveEquipped, storeItems, PROCEDURAL_CHARACTER_ID, type CharacterChoiceId, type StoreKind } from '../../content/store/catalog';
import { useT, type TranslationKey } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

const CarPreview = lazy(() => import('../vehicles/CarPreview').then(m => ({ default: m.CarPreview })));
const AvatarPreview = lazy(() => import('../../app/WorldCanvas').then(m => ({ default: m.AvatarPreview })));

const TABS: { kind: StoreKind; label: TranslationKey }[] = [
  { kind: 'car', label: 'shell.store.cars' },
  { kind: 'bike', label: 'shell.store.bikes' },
  { kind: 'character', label: 'shell.store.characters' },
];
const equippedIdFor = (kind: StoreKind, equipped: Equipped) => (kind === 'car' ? equipped.carId : kind === 'bike' ? equipped.bikeId : equipped.characterId);

export function StoreScreen({ equipped, coins, previewProfile, reducedMotion, onEquip, onBack }: { equipped: Equipped; coins: number; previewProfile: ExplorerProfile; reducedMotion: boolean; onEquip: (next: Equipped) => void; onBack: () => void }) {
  const t = useT();
  const resolved = resolveEquipped(equipped);
  const [tab, setTab] = useState(0);
  const kind = TABS[tab].kind;
  const items = storeItems(kind);
  const [color, setColor] = useState(resolved.carColor);
  const equip = (i: number) => {
    const id = items[i].id;
    if (kind === 'car') onEquip({ ...equipped, carId: id, carColor: color });
    else if (kind === 'bike') onEquip({ ...equipped, bikeId: id });
    else onEquip({ ...equipped, characterId: id });
  };
  const changeTab = (delta: 1 | -1) => { setTab(value => (value + delta + TABS.length) % TABS.length); setIndex(0); };
  const { index, setIndex } = useMenuNavigation({ count: items.length, onActivate: equip, onBack, onTab: changeTab });
  const selected = items[Math.min(index, items.length - 1)];
  const nameOf = (id: string, name: string) => (id === PROCEDURAL_CHARACTER_ID ? t('shell.store.explorer') : name);
  const paintable = kind === 'car' && Boolean(VEHICLE_PROFILES[selected.id as CarModelId]?.paint);

  return <ShellFrame title={t('shell.menu.store')} subtitle={<>🪙 {coins} {t('shell.store.coins')}</>} hints={t('shell.hints.store')} onBack={onBack}>
    <div className="shell-tabs" role="tablist">
      {TABS.map((entry, i) => <button key={entry.kind} role="tab" aria-selected={i === tab} className={`shell-tab ${i === tab ? 'is-active' : ''}`} onClick={() => { setTab(i); setIndex(0); }}>{t(entry.label)}</button>)}
    </div>
    <div className="shell-store">
      <ul className="shell-list" role="listbox" aria-label={t(TABS[tab].label)}>
        {items.map((entry, i) => {
          const isEquipped = equippedIdFor(kind, resolved) === entry.id;
          return <li key={entry.id} role="none">
            <button role="option" aria-selected={i === index} className={`shell-list__item ${i === index ? 'is-selected' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => setIndex(i)} onDoubleClick={() => equip(i)}>
              {nameOf(entry.id, entry.name)}
              <small className={`shell-tag ${isEquipped ? 'is-equipped' : ''}`}>{isEquipped ? t('shell.equipped') : t('shell.free')}</small>
            </button>
          </li>;
        })}
      </ul>
      <div className="shell-stage">
        <div className="shell-stage__view">
          <Suspense fallback={null}>
            {kind === 'car' && <CarPreview modelId={selected.id as CarModelId} color={paintable ? color : undefined}/>}
            {kind === 'character' && <AvatarPreview profile={applyEquippedCharacter(previewProfile, selected.id as CharacterChoiceId)} reducedMotion={reducedMotion}/>}
          </Suspense>
          {kind === 'bike' && <span className="shell-load__label">{nameOf(selected.id, selected.name)}<br/><small className="shell-frame__sub">{t('shell.store.noPreview')}</small></span>}
        </div>
        {paintable && <div className="shell-swatches" role="group" aria-label="Paint">
          {CAR_PAINT_COLORS.map(paint => <button key={paint.id} aria-label={paint.label} aria-pressed={paint.value === color} style={{ background: paint.value }} onClick={() => setColor(paint.value)}/>)}
        </div>}
        <button className="shell-button is-primary" onClick={() => equip(index)}>{t('shell.equip')}</button>
      </div>
    </div>
  </ShellFrame>;
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck`
Expected: exit 0.

```bash
git add src/features/shell/StoreScreen.tsx
git commit -m "feat: add game store with equip for cars, bikes, and characters

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Multiplayer, New Game confirm, character, and settings screens

**Files:**
- Modify: `src/features/multiplayer/MultiplayerEntry.tsx:6,26`
- Modify: `src/features/profile/ProfileForm.tsx:14-18,22,27`
- Create: `src/features/shell/MultiplayerScreen.tsx`
- Create: `src/features/shell/NewGameConfirm.tsx`
- Create: `src/features/shell/CharacterScreen.tsx`
- Create: `src/features/shell/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `MultiplayerEntry` props `{ session, profile, initialCode, errorMessage, onEnter, onClose }`; `ProfileForm` props `{ onSubmit, onPreview, initialProfile }`; `SettingsPanel` props as used in `App.tsx:63`; `ShellFrame`; `useMenuNavigation`; lazy `AvatarPreview`.
- Produces:
  - `MultiplayerEntry` gains `showBack?: boolean` (default `true`).
  - `ProfileForm` gains `initialCharacterId?: string`, which wins over `initialProfile.characterModelId`.
  - `MultiplayerScreen({ session, profile, initialCode, errorMessage, onEnter, onBack })` with the same types as `MultiplayerEntry`, where `onBack: () => void`.
  - `NewGameConfirm({ name, discoveries, onConfirm, onBack }: { name: string; discoveries: number; onConfirm: () => void; onBack: () => void })`
  - `CharacterScreen({ initialProfile, initialCharacterId, reducedMotion, onSubmit, onBack }: { initialProfile?: ExplorerProfile; initialCharacterId: string; reducedMotion: boolean; onSubmit: (profile: ExplorerProfile) => void; onBack: () => void })`
  - `SettingsScreen({ panel, canReset, onReset, onBack }: { panel: ReactNode; canReset: boolean; onReset: () => void; onBack: () => void })`

- [ ] **Step 1: Add `showBack` to `MultiplayerEntry`**

In `src/features/multiplayer/MultiplayerEntry.tsx`, change the signature on line 6 to add `showBack = true` and its type:

```tsx
export function MultiplayerEntry({ session, profile, initialCode = '', errorMessage = '', onEnter, onClose, showBack = true }: { session: MultiplayerSession; profile: ExplorerProfile; initialCode?: string; errorMessage?: string; onEnter: () => void; onClose: () => void; showBack?: boolean }) {
```

and change the last button (line 26) to:

```tsx
    {showBack && <button className="button button-secondary" onClick={onClose}>Back to title</button>}
```

- [ ] **Step 2: Add `initialCharacterId` to `ProfileForm`**

In `src/features/profile/ProfileForm.tsx`, add to `ProfileFormProps`:

```ts
  /** Equipped store character; wins over the saved profile's character. */
  initialCharacterId?: string;
```

Destructure it in the component signature (`{ onSubmit, onPreview, initialProfile, initialCharacterId }`), and change line 27 to:

```ts
  const [characterModelId, setCharacterModelId] = useState(initialCharacterId ?? initialProfile?.characterModelId ?? 'procedural');
```

- [ ] **Step 3: Create the Multiplayer screen**

Create `src/features/shell/MultiplayerScreen.tsx`:

```tsx
import type { ExplorerProfile } from '../../contracts';
import { MultiplayerEntry } from '../multiplayer/MultiplayerEntry';
import type { MultiplayerSession } from '../multiplayer/useMultiplayer';
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

export function MultiplayerScreen({ session, profile, initialCode, errorMessage, onEnter, onBack }: { session: MultiplayerSession; profile: ExplorerProfile; initialCode: string; errorMessage: string; onEnter: () => void; onBack: () => void }) {
  const t = useT();
  // Only Esc/B are handled here; the form's own inputs and buttons own the rest of the keyboard.
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.menu.multiplayer')} subtitle={t('shell.mp.subtitle')} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-tabs" role="tablist">
      <button role="tab" aria-selected className="shell-tab is-active">{t('shell.mp.joinCreate')}</button>
      <button role="tab" aria-selected={false} className="shell-tab" disabled>{t('shell.mp.browse')} · {t('shell.soon')}</button>
      <button role="tab" aria-selected={false} className="shell-tab" disabled>{t('shell.mp.publicPrivate')} 🔒 · {t('shell.soon')}</button>
    </div>
    <MultiplayerEntry session={session} profile={profile} initialCode={initialCode} errorMessage={errorMessage} onEnter={onEnter} onClose={onBack} showBack={false}/>
  </ShellFrame>;
}
```

- [ ] **Step 4: Create the New Game confirmation**

Create `src/features/shell/NewGameConfirm.tsx`:

```tsx
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

export function NewGameConfirm({ name, discoveries, onConfirm, onBack }: { name: string; discoveries: number; onConfirm: () => void; onBack: () => void }) {
  const t = useT();
  const { index, setIndex } = useMenuNavigation({ count: 2, onActivate: i => (i === 0 ? onBack() : onConfirm()), onBack });
  const body = t('shell.newGame.body').replace('{name}', name).replace('{count}', String(discoveries));
  return <ShellFrame title={t('shell.newGame.title')} hints={t('shell.hints.list')} onBack={onBack}>
    <div className="shell-card">
      <p>{body}</p>
      <div className="shell-actions">
        <button className={`shell-button ${index === 0 ? 'is-primary' : ''}`} onMouseEnter={() => setIndex(0)} onClick={onBack}>{t('shell.newGame.keep')}</button>
        <button className={`shell-button ${index === 1 ? 'is-primary' : ''}`} onMouseEnter={() => setIndex(1)} onClick={onConfirm}>{t('shell.newGame.start')}</button>
      </div>
    </div>
  </ShellFrame>;
}
```

- [ ] **Step 5: Create the character screen**

Create `src/features/shell/CharacterScreen.tsx`:

```tsx
import { Suspense, lazy, useState } from 'react';
import type { ExplorerProfile } from '../../contracts';
import { ProfileForm } from '../profile/ProfileForm';
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

const AvatarPreview = lazy(() => import('../../app/WorldCanvas').then(m => ({ default: m.AvatarPreview })));

export function CharacterScreen({ initialProfile, initialCharacterId, reducedMotion, onSubmit, onBack }: { initialProfile?: ExplorerProfile; initialCharacterId: string; reducedMotion: boolean; onSubmit: (profile: ExplorerProfile) => void; onBack: () => void }) {
  const t = useT();
  const [preview, setPreview] = useState<ExplorerProfile | null>(null);
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.character.title')} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-store">
      <div className="shell-stage"><div className="shell-stage__view"><Suspense fallback={null}>{preview && <AvatarPreview profile={preview} reducedMotion={reducedMotion}/>}</Suspense></div></div>
      <div><ProfileForm onSubmit={onSubmit} onPreview={setPreview} initialProfile={initialProfile} initialCharacterId={initialCharacterId}/></div>
    </div>
  </ShellFrame>;
}
```

- [ ] **Step 6: Create the settings screen**

Create `src/features/shell/SettingsScreen.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

export function SettingsScreen({ panel, canReset, onReset, onBack }: { panel: ReactNode; canReset: boolean; onReset: () => void; onBack: () => void }) {
  const t = useT();
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.menu.settings')} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-card" style={{ maxWidth: 720 }}>
      {panel}
      {canReset && <div className="shell-actions"><button className="shell-button" onClick={onReset}>{t('shell.settings.reset')}</button></div>}
    </div>
  </ShellFrame>;
}
```

- [ ] **Step 7: Typecheck, test, and commit**

Run: `npm run typecheck && npm test`
Expected: exit 0, and all tests pass.

```bash
git add src/features/multiplayer/MultiplayerEntry.tsx src/features/profile/ProfileForm.tsx src/features/shell/MultiplayerScreen.tsx src/features/shell/NewGameConfirm.tsx src/features/shell/CharacterScreen.tsx src/features/shell/SettingsScreen.tsx
git commit -m "feat: add shell multiplayer, new game, character, and settings screens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Shell host and App integration

**Files:**
- Create: `src/features/shell/Shell.tsx`
- Modify: `src/app/App.tsx` (see steps; line numbers are from the pre-change file)
- Modify: `src/app/app.css` (removing old title styles is optional; leaving unused rules is harmless)

**Interfaces:**
- Consumes: everything from Tasks 1–9; the existing `App.tsx` functions `start(profile, continuing)`, `enterRoom()`, `leaveRoom()`, `exit()`, `retry()`, `updatePreferences(next)`, `closeLobby()`.
- Produces: `Shell(props: ShellProps)`, where

```ts
interface ShellProps {
  state: ShellState;
  dispatch: (event: ShellEvent) => void;
  locale: Locale;
  touch: boolean;
  reducedMotion: boolean;
  equipped: Equipped;
  coins: number;
  savedProfile: ExplorerProfile | null;
  savedDiscoveries: number;
  roomProfile: ExplorerProfile;
  room: RoomSession;
  settingsPanel: ReactNode;
  onLocaleChange: (locale: Locale) => void;
  onEquip: (next: Equipped) => void;
  onNewGame: (profile: ExplorerProfile) => void;
  onLoadGame: () => void;
  onEnterRoom: () => void;
  onLeaveLobby: () => void;
  onRetry: () => void;
  onAbandonLoad: () => void;
  onResetExplorer: () => void;
}
```

- [ ] **Step 1: Create the shell host**

Create `src/features/shell/Shell.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Equipped, ExplorerProfile, Locale } from '../../contracts';
import type { RoomSession } from '../../app/useRoomSession';
import { resolveEquipped } from '../../content/store/catalog';
import { AccountScreen } from './AccountScreen';
import { CharacterScreen } from './CharacterScreen';
import { GameLoadScreen } from './GameLoadScreen';
import { GoodbyeScreen } from './GoodbyeScreen';
import { MainMenu } from './MainMenu';
import { MultiplayerScreen } from './MultiplayerScreen';
import { NewGameConfirm } from './NewGameConfirm';
import { SettingsScreen } from './SettingsScreen';
import { Splash, SPLASH_CAP_MS, SPLASH_MIN_MS, preloadSplashAssets } from './Splash';
import { StoreScreen } from './StoreScreen';
import type { ShellEvent, ShellState } from './shellFlow';
import './shell.css';

const LOAD_FADE_MS = 400;

interface ShellProps {
  state: ShellState;
  dispatch: (event: ShellEvent) => void;
  locale: Locale;
  touch: boolean;
  reducedMotion: boolean;
  equipped: Equipped;
  coins: number;
  savedProfile: ExplorerProfile | null;
  savedDiscoveries: number;
  roomProfile: ExplorerProfile;
  room: RoomSession;
  settingsPanel: ReactNode;
  onLocaleChange: (locale: Locale) => void;
  onEquip: (next: Equipped) => void;
  onNewGame: (profile: ExplorerProfile) => void;
  onLoadGame: () => void;
  onEnterRoom: () => void;
  onLeaveLobby: () => void;
  onRetry: () => void;
  onAbandonLoad: () => void;
  onResetExplorer: () => void;
}

export function Shell(props: ShellProps) {
  const { state, dispatch } = props;
  const back = () => dispatch({ type: 'BACK' });

  // Splash gate: minimum time, menu assets, and a hard cap so a dead network never strands the player.
  useEffect(() => {
    if (state.screen !== 'splash') return;
    let live = true;
    const min = setTimeout(() => dispatch({ type: 'SPLASH_TIMER_DONE' }), SPLASH_MIN_MS);
    const cap = setTimeout(() => dispatch({ type: 'SPLASH_CAP' }), SPLASH_CAP_MS);
    void preloadSplashAssets().then(() => { if (live) dispatch({ type: 'SPLASH_ASSETS_READY' }); });
    return () => { live = false; clearTimeout(min); clearTimeout(cap); };
  }, [state.screen === 'splash']); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the load screen up briefly after the world is ready so gameplay fades in rather than pops.
  const [leaving, setLeaving] = useState(false);
  const previous = useRef(state.screen);
  useEffect(() => {
    if (previous.current === 'loading' && state.screen === 'playing') {
      setLeaving(true);
      const id = setTimeout(() => setLeaving(false), props.reducedMotion ? 0 : LOAD_FADE_MS);
      previous.current = state.screen;
      return () => clearTimeout(id);
    }
    previous.current = state.screen;
  }, [state.screen, props.reducedMotion]);

  if (state.screen === 'playing' && !leaving) return null;

  let screen: ReactNode;
  switch (state.screen) {
    case 'splash': screen = <Splash reducedMotion={props.reducedMotion}/>; break;
    case 'menu': screen = <MainMenu hasSave={state.hasSave} locale={props.locale} onLocaleChange={props.onLocaleChange} touch={props.touch}
      onSelect={item => { if (item === 'loadGame') props.onLoadGame(); dispatch({ type: 'SELECT', item }); }} onExitBlocked={() => dispatch({ type: 'EXIT_BLOCKED' })}/>; break;
    case 'newGameConfirm': screen = <NewGameConfirm name={props.savedProfile?.displayName ?? ''} discoveries={props.savedDiscoveries} onConfirm={() => dispatch({ type: 'CONFIRM_NEW' })} onBack={back}/>; break;
    case 'character': screen = <CharacterScreen initialProfile={props.savedProfile ?? undefined} initialCharacterId={resolveEquipped(props.equipped).characterId} reducedMotion={props.reducedMotion}
      onSubmit={profile => { props.onNewGame(profile); dispatch({ type: 'PROFILE_SUBMITTED' }); }} onBack={back}/>; break;
    case 'multiplayer': screen = <MultiplayerScreen session={props.room.session} profile={props.roomProfile} initialCode={props.room.initialCode} errorMessage={props.room.errorMessage}
      onEnter={() => { props.onEnterRoom(); dispatch({ type: 'ROOM_ENTERED' }); }} onBack={() => { props.onLeaveLobby(); back(); }}/>; break;
    case 'store': screen = <StoreScreen equipped={props.equipped} coins={props.coins} previewProfile={props.savedProfile ?? props.roomProfile} reducedMotion={props.reducedMotion} onEquip={props.onEquip} onBack={back}/>; break;
    case 'settings': screen = <SettingsScreen panel={props.settingsPanel} canReset={state.hasSave} onReset={props.onResetExplorer} onBack={back}/>; break;
    case 'account': screen = <AccountScreen onBack={back}/>; break;
    case 'goodbye': screen = <GoodbyeScreen onBack={back}/>; break;
    case 'loading':
    case 'playing': screen = <GameLoadScreen failed={false} leaving={leaving} onRetry={props.onRetry} onBack={props.onAbandonLoad}/>; break;
    case 'loadError': screen = <GameLoadScreen failed leaving={false} onRetry={() => { props.onRetry(); dispatch({ type: 'RETRY' }); }} onBack={() => { props.onAbandonLoad(); back(); }}/>; break;
  }
  return <div className="shell" lang={props.locale}><div className="shell__bg" aria-hidden="true"/><div className="shell__content">{screen}</div></div>;
}
```

- [ ] **Step 2: Host the reducer and equipped state in `App.tsx`**

In `src/app/App.tsx`:

1. Add `useReducer` to the React import on line 1.
2. Add imports:

```ts
import { Shell } from '../features/shell/Shell';
import { createShellState, reduceShell } from '../features/shell/shellFlow';
import { applyEquippedCharacter, resolveEquipped } from '../content/store/catalog';
import { resetLoadProgress } from '../game/render/loadProgress';
import type { Equipped } from '../contracts';
```

3. Right after `const inRoom=room.inRoom;` (line 81), add:

```ts
  const [shell,dispatchShell]=useReducer(reduceShell,undefined,()=>createShellState({hasSave:!!initial.save,inviteCode:room.initialCode}));
  const equipped=resolveEquipped(preferences.equipped);
```

4. Replace the hard-coded vehicle defaults (lines 66–67 and 72):

```ts
  const [carModelId,setCarModelId]=useState<CarModelId>(()=>resolveEquipped(initialPreferences.preferences.equipped).carId);
  const [carColor,setCarColor]=useState<string>(()=>resolveEquipped(initialPreferences.preferences.equipped).carColor);
  // ...
  const [bikeModelId,setBikeModelId]=useState<BikeModelId>(()=>resolveEquipped(initialPreferences.preferences.equipped).bikeId);
```

5. Narrow the `menu` state union on line 88 to `'none'|'settings'|'reset'|'car'|'bike'`, because `'profile'` and `'atlas'` leave with the old title.

6. Keep `hasSave` in step with the save:

```ts
  useEffect(()=>{dispatchShell({type:'SAVE_CHANGED',hasSave:!!saved});},[saved]);
```

- [ ] **Step 3: Route game starts through the equipped loadout**

In `App.tsx`:

1. Change `onPlayerReady` (line 100) so the shell leaves the load screen:

```ts
  const onPlayerReady=useCallback(()=>{restored.current=true;setMode(m=>m==='loading'?'playing':m);dispatchShell({type:'WORLD_READY'});},[]);
```

2. Change `onSceneError` (line 101) to also report to the shell:

```ts
  const onSceneError=useCallback((error:string)=>{setSceneError(error);setMenu('none');setMode(m=>m==='menu'?'menu':'paused');dispatchShell({type:'LOAD_FAILED'});},[]);
```

3. Change the `start` signature and head (line 113). The rest of the body keeps using `next` as it does today:

```ts
  const start=(chosen:ExplorerProfile,continuing=false,characterId?:CharacterChoiceId)=>{
    const loadout=resolveEquipped(preferences.equipped);
    setCarModelId(loadout.carId);setCarColor(loadout.carColor);setBikeModelId(loadout.bikeId);
    resetLoadProgress();
    // An explicit character (New Game) wins over the equipped one, which this render may not have seen yet.
    const next=applyEquippedCharacter(chosen,characterId??loadout.characterId);
    restored.current=false;
    // ...existing body unchanged from here
```

Add `type CharacterChoiceId` to the catalogue import from Step 2.

4. In `exit` (line 121), add `setReady(false);dispatchShell({type:'QUIT_TO_MENU'});` before the closing brace. In `leaveRoom` (line 127), add the same.

5. Change `enterRoom` (line 122) to apply the loadout and reset progress:

```ts
  const enterRoom=()=>{
    const loadout=resolveEquipped(preferences.equipped);
    setCarModelId(loadout.carId);setCarColor(loadout.carColor);setBikeModelId(loadout.bikeId);
    resetLoadProgress();
    room.enter();
    restored.current=false;
    setActive(true);setMenu('none');setMode('loading');
  };
```

6. Add the new-game and equip handlers after `leaveRoom`:

```ts
  const newGame=(chosen:ExplorerProfile)=>{
    // The creator's character choice becomes the equipped one, so the store and the game agree.
    const characterId=resolveEquipped({characterId:chosen.characterModelId??'procedural'}).characterId;
    if(characterId!==preferences.equipped.characterId)updatePreferences({...preferences,equipped:{...preferences.equipped,characterId}});
    setVisited([]);
    start(chosen,false,characterId);
  };
  const equip=(next:Equipped)=>updatePreferences({...preferences,equipped:next});
  const abandonLoad=()=>{if(inRoom)leaveRoom();else exit();setSceneError(null);setSceneKey(n=>n+1);};
```

7. Leave a room that ends underneath the player, including during loading:

```ts
  useEffect(()=>{
    if(active&&shell.pendingGame==='room'&&!room.entered){setActive(false);setMode('menu');setMenu('none');setReady(false);dispatchShell({type:'ROOM_LOST'});}
  },[active,shell.pendingGame,room.entered]);
```

- [ ] **Step 4: Mount the canvas only for a game, and render the shell**

In the JSX returned by `App` (line 216 onward):

1. Wrap the world viewport so it mounts only for a game. Replace

```tsx
<div className="world-viewport" aria-label="3D Kerala exploration world">
  <SceneBoundary ...>...</SceneBoundary>
</div>
```

with the same element guarded by `{active&&(` … `)}`. Leave the inner `SceneBoundary` and `WorldCanvas` props unchanged.

2. Delete the whole `{!active&&<div className="entry-shell">…</div>}` block (lines 219–227).

3. Delete `{(mode==='loading'||(!ready&&active))&&!sceneError&&<LoadingView/>}` and the `{sceneError&&<LoadError …/>}` line. The shell's load and error screens replace them.

4. Delete the `ModalShell` for `menu==='profile'` and the `ModalShell` for `room.lobbyOpen`.

5. Change the map `ModalShell` to in-game only:

```tsx
    <ModalShell open={mode==='map'} title={t('app.yourFieldAtlas')} onClose={()=>setMode('playing')} className="map-modal"><ExplorerMap player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint}/></ModalShell>
```

6. In the pause `ModalShell`, change the last button's label to `{inRoom?'Leave room':t('shell.pauseQuit')}`.

7. In the reset `ModalShell`, change both `setMenu('settings')` calls to `setMenu(active?'settings':'none')`.

8. Change the settings `ModalShell` `open` to `menu==='settings'&&active`, so the in-game settings modal never shows over the shell.

9. Render the shell right after the `AudioDirector` element:

```tsx
    <Shell state={shell} dispatch={dispatchShell} locale={locale} touch={touch} reducedMotion={settings.reducedMotion} equipped={preferences.equipped} coins={collectState.coins}
      savedProfile={saved?.profile??null} savedDiscoveries={saved?.visitedLandmarkIds.length??0}
      roomProfile={applyEquippedCharacter(saved?.profile??profile,equipped.characterId)} room={room}
      settingsPanel={<SettingsPanel settings={settings} onChange={setSettings} controls={preferences.controls} onControlsChange={value=>updatePreferences({...preferences,controls:value})} locale={locale} onLocaleChange={value=>updatePreferences({...preferences,locale:value})} developerMode={inspectMode} onDeveloperModeChange={import.meta.env.DEV?setDeveloperMode:undefined} haptics={preferences.haptics} onHapticsChange={touch?value=>updatePreferences({...preferences,haptics:value}):undefined} offline={<OfflineSettings/>}/>}
      onLocaleChange={value=>updatePreferences({...preferences,locale:value})} onEquip={equip}
      onNewGame={newGame} onLoadGame={()=>{if(saved)start(saved.profile,true);}} onEnterRoom={enterRoom} onLeaveLobby={closeLobby}
      onRetry={retry} onAbandonLoad={abandonLoad} onResetExplorer={()=>setMenu('reset')}/>
```

10. Change `SceneBoundary` so its error branch renders `null` instead of its own error card, because the shell's load error screen is now the single error surface. `componentDidCatch` still calls `onError`, which reaches `onSceneError` and dispatches `LOAD_FAILED`.

- [ ] **Step 5: Remove what the old title used**

Run: `npm run typecheck`

Expected: `noUnusedLocals` errors listing imports and locals the removed markup used. These typically include `ArrowUpRight`, `Compass`, `Mountains`, `WORLD_REGIONS` (only if nothing else uses it), `LanguageToggle`, `InstallPrompt`, `LoadingView`, `LoadError`, `ProfileForm`, `MultiplayerEntry`, `AvatarPreview`, `preview`/`setPreview`, `localizedRegion` and `ready`. Remove each one the compiler reports, and nothing it doesn't report. Keep `Footprints` (the controls hint uses it) and `FullscreenButton` (the HUD uses it). If `ready` is reported unused, delete the `ready` state and `onWorldReady`, and pass `onReady={()=>undefined}` to `WorldCanvas`. Otherwise leave them.

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Run the unit tests and build**

Run: `npm test && npm run build`
Expected: all tests pass, and the build completes. In the build output, confirm the main entry chunk does not contain three.js: the largest `app/*.js` chunk containing `WebGLRenderer` should be the lazy `WorldCanvas` chunk, not the entry. Check with `grep -l WebGLRenderer dist/app/*.js` and compare against the entry file referenced in `dist/index.html`.

- [ ] **Step 7: Commit**

```bash
git add src/features/shell/Shell.tsx src/app/App.tsx src/app/app.css
git commit -m "feat: boot into splash and retro menu, mount the world only for a game

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Manual verification in the running app and build log

**Files:**
- Modify: `docs/06-build-log.md`

**Interfaces:**
- Consumes: the whole feature.
- Produces: a verified feature and a build log entry.

- [ ] **Step 1: Start the app**

Run in the background: `npm run dev`
Expected: Vite serves on `http://127.0.0.1:5000`.

- [ ] **Step 2: Walk the desktop flow with Chrome DevTools MCP**

With `new_page` at `http://127.0.0.1:5000`, `take_screenshot` at each point, check:

1. The splash shows the Malayalam logo, then crossfades to English, with the segmented bar filling and "BY SREEHARI" below. The menu appears after about 3.5s.
2. The menu has a white background with the faint map, the list on the left and the logo on the right. Load Game is greyed out on a fresh profile (clear site data first). Exit is absent in a browser tab.
3. `press_key` ArrowDown, ArrowUp and Enter move the green bar and open screens. Escape returns from Store, Settings, Account and Multiplayer.
4. In the Store, switch tabs with ArrowRight, pick the Supercar, choose a paint colour and press Enter. It shows EQUIPPED. On the Characters tab, equip "Luffy".
5. New Game → the character creator preselects Luffy → submit. The load screen shows "LOADING KODASSERY · N%" rising, with tips. Gameplay fades in.
6. In game, open car controls: the Supercar is preselected in the spawner.
7. Pause → "Quit to main menu" → the menu appears with Load Game now enabled. Load Game → the load screen → gameplay at the saved position.
8. `list_console_messages` shows no errors.

- [ ] **Step 3: Walk the phone flow**

`emulate` or `resize_page` to 390×844 with touch. Check that the menu stacks the logo above the list, the store stacks the list above the preview, the key hints are hidden, and there is no horizontal scroll.

- [ ] **Step 4: Check the invite link and offline cap**

1. Open `http://127.0.0.1:5000/?room=K7Q2M9XA`. After the splash it lands on Multiplayer with the code filled in.
2. With network throttling set to offline and the cache cleared, reload. The splash still reaches the menu by about 6s, with no broken-image icons.

- [ ] **Step 5: Record the result**

Append to `docs/06-build-log.md`:

```markdown
## 2026-09-18 — Splash screen and retro main menu

- Replaced the "An Explorer's Tale" title with a logo splash (Malayalam → English crossfade, segmented green loader, "BY SREEHARI") and a white PS2-era main menu over the Kerala story map at 20%.
- The 3D world now mounts only after New Game, Load Game, or entering a room, behind a load screen fed by `THREE.DefaultLoadingManager`.
- Game Store: cars, bikes, and characters, all free; Equip sets the spawner defaults and the player character (stored in preferences).
- Account and the lobby browser are SOON placeholders; Exit appears only in the installed PWA.
- Verified: unit tests, typecheck, build, and a manual desktop plus 390×844 pass in Chrome (splash, menu keyboard navigation, store equip, new game, load game, quit to menu, invite link, offline splash cap).
```

Fill in the actual outcome of Steps 2–4. If any step failed and was fixed, say so. If a step was skipped (e.g. there was no installed PWA to test Exit), say that.

- [ ] **Step 6: Commit**

```bash
git add docs/06-build-log.md
git commit -m "docs: record splash and retro menu verification

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
