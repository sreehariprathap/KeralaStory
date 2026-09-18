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
