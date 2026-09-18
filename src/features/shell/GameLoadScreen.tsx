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
