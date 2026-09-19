import type { ExplorerProfile } from '../../contracts';
import { MultiplayerEntry } from '../multiplayer/MultiplayerEntry';
import type { MultiplayerSession } from '../multiplayer/useMultiplayer';
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

export function MultiplayerScreen({ session, profile, initialCode, errorMessage, onEnter, onBack }: { session: MultiplayerSession; profile: ExplorerProfile; initialCode: string; errorMessage: string; onEnter: () => void; onBack: () => void }) {
  const t = useT();
  // Only Esc/B are handled here; the form's own inputs and buttons own the rest of the keyboard.
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.menu.multiplayer')} subtitle={t('shell.mp.subtitle')} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-tabs" role="tablist">
      <button role="tab" aria-selected className="shell-tab is-active">{t('shell.mp.joinCreate')}</button>
      <button role="tab" aria-selected={false} className="shell-tab" disabled>{t('shell.mp.browse')} · {t('shell.soon')}</button>
      <button role="tab" aria-selected={false} className="shell-tab" disabled>{t('shell.mp.publicPrivate')} 🔒 · {t('shell.soon')}</button>
    </div>
    <MultiplayerEntry session={session} profile={profile} initialCode={initialCode} errorMessage={errorMessage} onEnter={onEnter} onClose={onBack} showBack={false}/>
  </ShellFrame>;
}
