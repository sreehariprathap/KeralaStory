import { Suspense, lazy, useState } from 'react';
import type { ExplorerProfile } from '../../contracts';
import { ProfileForm } from '../profile/ProfileForm';
import { useT } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

const AvatarPreview = lazy(() => import('../../app/WorldCanvas').then(m => ({ default: m.AvatarPreview })));

export function CharacterScreen({ initialProfile, initialCharacterId, reducedMotion, onSubmit, onBack }: { initialProfile?: ExplorerProfile; initialCharacterId: string; reducedMotion: boolean; onSubmit: (profile: ExplorerProfile) => void; onBack: () => void }) {
  const t = useT();
  const [preview, setPreview] = useState<ExplorerProfile | null>(null);
  useMenuNavigation({ count: 1, disabled: [true], onActivate: () => undefined, onBack });
  return <ShellFrame title={t('shell.character.title')} hints={t('shell.hints.back')} onBack={onBack}>
    <div className="shell-store">
      <div className="shell-stage"><div className="shell-stage__view"><Suspense fallback={null}>{preview && <AvatarPreview profile={preview} reducedMotion={reducedMotion}/>}</Suspense></div></div>
      <div><ProfileForm onSubmit={onSubmit} onPreview={setPreview} initialProfile={initialProfile} initialCharacterId={initialCharacterId}/></div>
    </div>
  </ShellFrame>;
}
