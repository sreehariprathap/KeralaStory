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
