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
