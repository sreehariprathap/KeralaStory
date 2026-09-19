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
