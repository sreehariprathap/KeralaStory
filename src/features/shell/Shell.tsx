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
