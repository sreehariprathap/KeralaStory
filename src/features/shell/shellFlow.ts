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
