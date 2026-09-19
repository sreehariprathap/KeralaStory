import type { Locale } from '../../contracts';
import { useT, type TranslationKey } from '../i18n/translate';
import { useMenuNavigation } from './useMenuNavigation';
import { version } from '../../../package.json';

export type PauseItem = 'resume' | 'atlas' | 'settings' | 'quit';

/** The in-game pause screen, drawn like the main menu. Escape resumes, as it did from the old dialog. */
export function PauseMenu({ locale, inRoom, onSelect }: { locale: Locale; inRoom: boolean; onSelect: (item: PauseItem) => void }) {
  const t = useT();
  const items: { id: PauseItem; label: TranslationKey }[] = [
    { id: 'resume', label: 'pause.resume' },
    { id: 'atlas', label: 'pause.atlas' },
    { id: 'settings', label: 'shell.menu.settings' },
    { id: 'quit', label: inRoom ? 'pause.leaveRoom' : 'shell.pauseQuit' },
  ];
  const { index, setIndex } = useMenuNavigation({ count: items.length, onActivate: i => onSelect(items[i].id), onBack: () => onSelect('resume') });
  return <div className="shell shell--pause" lang={locale} role="dialog" aria-modal="true" aria-labelledby="pause-title">
    <div className="shell__bg" aria-hidden="true"/>
    <div className="shell__content">
      <section className="shell-menu">
        <div className="shell-pause__list">
          <h1 id="pause-title" className="shell-pause__title">{t('pause.title')}</h1>
          <ul className="shell-list" role="menu" aria-label={t('pause.title')}>
            {items.map((item, i) => <li key={item.id} role="none">
              <button role="menuitem" autoFocus={i === 0} tabIndex={i === index ? 0 : -1} className={`shell-list__item ${i === index ? 'is-selected' : ''}`}
                onMouseEnter={() => setIndex(i)} onFocus={() => setIndex(i)} onClick={() => onSelect(item.id)}>
                {t(item.label)}
              </button>
            </li>)}
          </ul>
        </div>
        <img className="shell-menu__logo" src="/assets/logo-english.png" alt="GTA Kodassery Diaries — A Kerala Saga" onError={event => { event.currentTarget.hidden = true; }}/>
        <footer className="shell-menu__foot">{t('shell.byline')} · v{version}<span className="shell-menu__hints"> · {t('pause.hints')}</span></footer>
      </section>
    </div>
  </div>;
}
