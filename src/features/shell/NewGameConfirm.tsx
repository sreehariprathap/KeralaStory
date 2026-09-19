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
