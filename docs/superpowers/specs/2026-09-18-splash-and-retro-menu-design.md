# Splash screen and retro main menu design

Date: 18 September 2026
Branch: `feature/multiplayer-rooms`
Sub-project 1 of 5 in the login and access-mode redesign. Later specs: lobby browser (2), store prices and purchases (3), accounts (4), save slots (5).

## Decision

Replace the "AN EXPLORER'S TALE" title screen with a branded splash and a simple, retro, PS2-era main menu on a white background. The menu loads first and on its own. The 3D world mounts only after the player picks New Game, Load Game, or enters a multiplayer room, and loads behind a dedicated game load screen with real progress.

The Game Store is built for real, with everything free and unlocked; equipping sets the default car, bike, and character. Account and the lobby browser appear as "SOON" placeholders.

## Scope

### In scope

- Splash: Malayalam logo crossfading into the English logo, a segmented green loader, and a "BY SREEHARI" byline.
- Main menu: New Game, Load Game, Multiplayer, Game Store, Settings, Account (SOON), Exit (installed PWA only).
- Game load screen with real world-loading progress, rotating tips, and retry on error.
- Store screen with Cars, Bikes, and Characters tabs, 3D preview, and Equip.
- Restyled Multiplayer, Settings, New Game confirmation, and character creator screens inside the shell.
- "Quit to main menu" in the pause menu.
- Removal of the old hero, region strip, title-screen atlas overview, "Play together" and "Change explorer" buttons, and the canvas pre-mounted behind the title.

### Out of scope

- Lobby browser, public rooms, and password-protected private rooms (sub-project 2). Their tabs are shown disabled with a SOON tag.
- Coin prices and purchases (sub-project 3). The catalogue carries `price: 0` so pricing is later a data change.
- Sign-in and cloud saves (sub-project 4).
- Multiple save slots (sub-project 5). New Game still overwrites the single local save after confirmation.
- Changes to the in-game HUD, map, spawners (apart from the equipped default), or server.

## Visual direction

Direction "C · PS2-era open world" adapted to white:

- Background: white, with `kerala-story-map.png` at 20% opacity over it (white dominates).
- Type: Oswald 500/700, uppercase, bold, condensed. Self-hosted via `@fontsource/oswald` so the offline PWA works. With the Malayalam locale selected, menu text uses Noto Sans Malayalam, because Oswald has no Malayalam glyphs.
- Selection: a 4px green left bar plus a faint green gradient behind the selected row.
- Tokens in `shell.css`: `--shell-bg: #fff`, `--shell-ink: #0f3d1a`, `--shell-muted: #5d7a55`, `--shell-faint: #8aa383`, `--shell-accent: #2fbf3a`.
- Loader: a bordered bar of 10 green segments that light up in turn.

The source map is 8.2 MB (2048×2048 PNG). `scripts/optimize-assets.mjs` generates `public/assets/menu-map.webp` (about 1600px, target ≤ 200 KB) for the shell background, and the shell only ever references the WebP.

Mockups: `.superpowers/brainstorm/25127-1789760629/content/` (`retro-style-v2.html` option 3, `screens.html`, `subscreens.html`). That folder is gitignored and exists only locally.

## Architecture

### Shell flow

`src/features/shell/shellFlow.ts` is a pure reducer with no React or DOM imports.

```
splash ──(minimum time elapsed AND menu assets ready, or 6s cap)──▶ menu
splash ──(same gate, invite link present)───────────────────────▶ multiplayer
menu ─▶ newGame: confirm (only if a save exists) ─▶ character ─▶ loading ─▶ playing
menu ─▶ loadGame (disabled if no save) ────────────────────────▶ loading ─▶ playing
menu ─▶ multiplayer ─(enter shared world)──────────────────────▶ loading ─▶ playing
menu ─▶ store | settings | account ─(back)─▶ menu
menu ─▶ exit (PWA only)
loading ─(error)─▶ loadError ─(retry)─▶ loading | ─(back)─▶ menu
playing ─(pause ▸ Quit to main menu)─▶ menu
```

State: `{ screen, splashTimerDone, splashAssetsReady, hasSave, inviteCode, pendingGame }`, where `pendingGame` is `{ kind: 'new', profile } | { kind: 'load' } | { kind: 'room' } | null`. Events: `SPLASH_TIMER_DONE`, `SPLASH_ASSETS_READY`, `SPLASH_CAP`, `SELECT(item)`, `BACK`, `CONFIRM_NEW`, `PROFILE_SUBMITTED(profile)`, `ROOM_ENTERED`, `WORLD_READY`, `LOAD_FAILED`, `RETRY`, `QUIT_TO_MENU`, `SAVE_CHANGED(hasSave)`.

### Ownership

- `App.tsx` keeps all game and session state, as it does now. When no game is active it renders `<Shell/>`, passing `saved`, `room`, `settings`, `preferences`, `collectState.coins`, and callbacks that call the existing `start(profile, continuing)`, `enterRoom()`, `setSettings`, `updatePreferences`, and `clearLocalSave` paths.
- `WorldCanvas` mounts only while the shell is in `loading` or `playing`. The idle title-screen mount goes away, and so does the `ready` gate on the title button.
- The load screen reads progress from the existing asset loading callbacks (the ones behind `onWorldReady`) and completes on `onPlayerReady`. It fades into gameplay and unmounts.
- The pause modal's "Save & return to title" becomes "Quit to main menu". Solo play persists first, as `exit()` does today. In a room it calls `leaveRoom()`.

### Files

New, under `src/features/shell/`:

| File | Purpose |
|---|---|
| `shellFlow.ts` | Reducer, state and event types |
| `Shell.tsx` | Hosts the reducer, renders the current screen, owns the splash timers |
| `Splash.tsx` | Logo crossfade, segmented loader, byline |
| `MainMenu.tsx` | Menu list, keyboard, gamepad, and pointer input |
| `useMenuNavigation.ts` | Roving selection for any list: ↑/↓, W/S, Enter, Esc, gamepad D-pad, A, B |
| `GameLoadScreen.tsx` | Progress, tips, and the error state |
| `StoreScreen.tsx` | Store tabs, list, preview stage, Equip |
| `MultiplayerScreen.tsx` | Restyled `MultiplayerEntry` with the SOON tabs |
| `NewGameConfirm.tsx` | Overwrite confirmation |
| `CharacterScreen.tsx` | Hosts `ProfileForm` in the shell frame |
| `SettingsScreen.tsx` | Hosts `SettingsPanel` and Reset local explorer |
| `AccountScreen.tsx` | SOON card |
| `ShellFrame.tsx` | Shared header, Back, and footer key hints |
| `shell.css` | Tokens and styles |

Also new:

- `src/content/store/catalog.ts`: store items and equip resolution.

Changed:

- `src/app/App.tsx`: renders the shell, adds the canvas mount gate and the pause Quit to main menu, uses the equipped defaults, and removes the old title markup.
- `src/contracts/index.ts`: `PreferencesSchema` gains `equipped`.
- `src/features/multiplayer/MultiplayerEntry.tsx`: the logic moves to a hook or to props so `MultiplayerScreen` can reuse it, or it is restyled in place.
- `src/content/locales/en.json` and `ml.json`: new keys.
- `scripts/optimize-assets.mjs`: generates `menu-map.webp`.
- `package.json`: adds `@fontsource/oswald`.
- `.gitignore`: adds `.superpowers/`.

## Screens

### Splash

- The Malayalam logo holds for 1.2s, crossfades for 1.0s, then the English logo holds. Total minimum is 3.5s.
- The segmented bar fills over the same 3.5s. It does not fake asset progress.
- The splash moves on once the timer is done and `logo-english.png`, `logo-malayalam.png`, `menu-map.webp`, and the Oswald font have loaded. A 6s hard cap moves on regardless.
- Reduced motion (the setting, or `prefers-reduced-motion` when there is no save): the crossfade becomes a cut at 1.7s.
- Accessibility: `aria-busy="true"` and an accessible label "Loading, by Sreehari". Alt text is Malayalam for the Malayalam logo and English for the English logo.
- The splash runs on every cold start. Returning from a game goes straight to the menu.

### Main menu

- The list is on the left, with the English logo (about 52% width) on the right. On phones in portrait, the logo sits on top and the list below.
- Items, in order:
  - New Game
  - Load Game, disabled when there is no save
  - Multiplayer
  - Game Store
  - Settings
  - Account, with a SOON tag
  - Exit, rendered only when `matchMedia('(display-mode: standalone)')` or `(display-mode: fullscreen)` matches
- The footer shows "BY SREEHARI · v{version} · ↑↓ SELECT · ENTER CONFIRM". It hides the key hints on coarse pointers.
- `role="menu"` with `role="menuitem"` children and a roving `tabindex`. The focus ring is the selection bar.
- Exit calls `window.close()`. If `document.visibilityState` is still `visible` 300ms later, a "Thanks for playing" card shows the logo and a Back to menu button.

### Game load screen

- The English logo at about 34% width, "LOADING KODASSERY · NN%", the segmented bar at real progress, and a tip line from a translated tips list that rotates every 4s.
- On `onPlayerReady` it fades out over 400ms (instant with reduced motion) and gameplay starts.
- On a scene error (the existing `SceneBoundary` / `onSceneError`) it shows "The world couldn't load" with **Retry** (bumps `sceneKey`) and **Back to menu**. The save is untouched.
- If the room drops during loading, it goes back to the Multiplayer screen with the existing `room.errorMessage`.

### Game Store

- Tabs:
  - **Cars**, from `CAR_MODELS`. Pending cars are excluded.
  - **Bikes**, from `BIKE_MODELS`.
  - **Characters**: "Explorer", the procedural avatar, first, then `CHARACTER_MODELS`.
- Each row shows the name and a **FREE** tag, or **EQUIPPED** for the equipped item.
- The preview stage lazy-loads `CarPreview` (with paint swatches from `CAR_PAINT_COLORS` when `VEHICLE_PROFILES[id].paint` exists) or `AvatarPreview`. Bikes get a name card if no bike preview exists.
- The header shows the coin balance from `collectState.coins`. It is display only for now.
- Keys: ←/→ switch tabs, ↑/↓ select, Enter equips, Esc goes back.
- `catalog.ts` exports `STORE_ITEMS: { id, kind: 'car' | 'bike' | 'character', name, price: 0, unlocked: true }[]` and `resolveEquipped(prefs)`, which returns valid ids and falls back to `admin`, `roadster`, and `procedural`.

### Equip semantics

- `PreferencesSchema` gains `equipped: { carId, carColor, bikeId, characterId }` with `.default(...)`, so existing stored preferences still parse.
- In-game spawners start on `equipped.carId`, `carColor`, and `bikeId` instead of the hard-coded `'admin'` and `'roadster'`. Choices in the spawner stay per-session and do not change what is equipped.
- `equipped.characterId` is applied as `profile.characterModelId` (undefined for `procedural`):
  - on New Game, where the character creator preselects it and the player can still change it; the submitted choice is written back to `equipped`
  - on Load Game, where it overrides the saved profile's character
  - on entering a multiplayer room, where it sets the appearance
- Equipping writes preferences immediately through `updatePreferences`. Write failures show the existing warning banner.

### Multiplayer

- Same props and session as `MultiplayerEntry`, restyled into the shell frame.
- The tabs are **Join / Create** (active), **Browse lobbies** (disabled, SOON), and **Public · Private 🔒** (disabled, SOON).
- An invite link (`?room=`, read by `useRoomSession`) sends the splash straight to this screen with the code prefilled.
- "Enter shared world" moves to `loading`. Back closes the lobby, using the existing `closeLobby` semantics.

### New Game, character, Settings, Account

- New Game with a save shows the confirmation: "Start a new game? Your current journey ({name} · {n} discoveries) will be replaced." The buttons are **Keep playing** (back) and **Start new**. Without a save it goes straight to the character screen.
- The character screen hosts `ProfileForm`, restyled, and submitting starts `loading` with `start(profile, false)`. The save is overwritten only by the first persist after loading, which is the existing behaviour.
- Settings hosts `SettingsPanel` with the same props as the pause-menu version, minus in-game-only actions, plus "Reset local explorer" (the existing reset flow, now shell-styled).
- Account shows "Sign-in and cloud saves are coming. Your game is saved in this browser for now."

## Error handling

| Case | Behaviour |
|---|---|
| Splash assets fail to load (offline, cold cache) | The 6s cap moves on. The menu renders with no logo image and a plain white background. |
| World scene fails | Load-screen error with Retry and Back to menu. The save is preserved. |
| Room drops while loading | Back to the Multiplayer screen with the error message. |
| Preferences missing, old, or corrupt | Zod defaults fill in `equipped`. Unknown ids fall back via `resolveEquipped`. |
| Preferences write fails | The existing warning banner. The equip still applies for the session. |
| `window.close()` ignored | The goodbye card after 300ms. |

## Translation

All new copy goes through `translate()` with keys in `en.json` and `ml.json`: menu items, SOON, FREE, EQUIPPED, screen headers, key hints, confirm text, Account text, tips, and load errors. Malayalam text uses Noto Sans Malayalam.

## Testing

Unit tests (Vitest):

- `tests/shellFlow.test.ts`:
  - the splash gate: the timer alone does not advance, assets alone do not advance, both do, and the cap does
  - an invite link goes to multiplayer
  - Load Game is ignored with no save
  - New Game confirms only when a save exists
  - Back from every sub-screen returns to the menu
  - `LOAD_FAILED` → `RETRY` → `loading`
  - `QUIT_TO_MENU`
- `tests/storeCatalog.test.ts`:
  - the catalogue covers `CAR_MODELS`, `BIKE_MODELS`, and `CHARACTER_MODELS` exactly, plus procedural
  - every item has `price: 0` and `unlocked: true`
  - `resolveEquipped` falls back on unknown ids
- `tests/preferences.test.ts` (extend if it exists): old preferences without `equipped` parse to defaults.

Manual verification in the running app (Chrome DevTools MCP), at desktop size and at a 390×844 phone viewport:

1. A cold start plays the splash and crossfade, then the menu appears.
2. Keyboard-only navigation works through every menu item and every sub-screen, and Esc goes back.
3. In the Store, equip a car, a bike, and a character. New Game preselects the character. In game, the spawners start on the equipped car and bike.
4. Load Game shows the load screen with progress, gameplay starts, pause → Quit to main menu returns to the menu, and the save is kept.
5. An invite link lands on Multiplayer with the code filled in.
6. Offline with a cold cache, the splash still exits by the cap.
7. In the installed PWA, Exit closes the app or shows the goodbye card. In a browser tab, Exit is absent.

`npm run typecheck`, `npm test`, and `npm run build` must pass.
