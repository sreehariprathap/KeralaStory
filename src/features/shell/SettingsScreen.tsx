import type { ReactNode } from 'react';
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

export function SettingsScreen({ panel, canReset, onReset, onBack }: { panel: ReactNode; canReset: boolean; onReset: () => void; onBack: () => void }) {
  const t = useT();
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.menu.settings')} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-card" style={{ maxWidth: 720 }}>
      {panel}
      {canReset && <div className="shell-actions"><button className="shell-button" onClick={onReset}>{t('shell.settings.reset')}</button></div>}
    </div>
  </ShellFrame>;
}
