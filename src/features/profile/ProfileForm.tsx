import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  AVATAR_PRESETS,
  CLOTHING_COLORS,
  HAIR_COLORS,
  ProfileSchema,
  SKIN_COLORS,
  type ExplorerProfile,
} from '../../contracts';
import './profile-form.css';
import { useT } from '../i18n/translate';

interface ProfileFormProps {
  onSubmit: (profile: ExplorerProfile) => void;
  onPreview?: (profile: ExplorerProfile) => void;
  initialProfile?: ExplorerProfile;
}

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `explorer-${Date.now().toString(36)}`;

export function ProfileForm({ onSubmit, onPreview, initialProfile }: ProfileFormProps) {
  const t = useT();
  const id = useId();
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? '');
  const [avatarPresetId, setAvatarPresetId] = useState(initialProfile?.avatarPresetId ?? AVATAR_PRESETS[0].id);
  const [skin, setSkin] = useState(initialProfile?.colors.skin ?? SKIN_COLORS[0]);
  const [hair] = useState(initialProfile?.colors.hair ?? HAIR_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const profileId = useMemo(() => initialProfile?.id ?? makeId(), [initialProfile?.id]);
  const preset = AVATAR_PRESETS.find((candidate) => candidate.id === avatarPresetId) ?? AVATAR_PRESETS[0];
  const nameInputId = `${id}-name`;
  const errorId = `${id}-error`;

  useEffect(() => {
    if (!onPreview) return;
    const preview = ProfileSchema.safeParse({
      id: profileId,
      displayName: displayName.trim() || 'Traveler',
      avatarPresetId,
      colors: { skin, hair, clothing: preset.clothing },
    });
    if (preview.success) onPreview(preview.data);
  }, [avatarPresetId, displayName, hair, onPreview, preset.clothing, profileId, skin]);

  const validate = () => {
    const result = ProfileSchema.safeParse({
      id: profileId,
      displayName,
      avatarPresetId,
      colors: { skin, hair, clothing: preset.clothing },
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      const message = issue?.path[0] === 'displayName'
        ? issue.message.includes('1–24') ? t('profile.error.length') : issue.message.includes('plain-text') ? t('profile.error.plainText') : t('profile.validation')
        : t('profile.validation');
      setError(message);
      return null;
    }
    setError(null);
    return result.data;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    const profile = validate();
    if (profile) onSubmit(profile);
  };

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <div className="profile-form__field">
        <label htmlFor={nameInputId}>{t('profile.name')}</label>
        <input
          id={nameInputId}
          name="displayName"
          type="text"
          value={displayName}
          onChange={(event) => { setDisplayName(event.target.value); if (touched) setError(null); }}
          onBlur={() => { setTouched(true); validate(); }}
          placeholder={t('profile.namePlaceholder')}
          autoComplete="name"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          required
        />
        {error && <p id={errorId} className="profile-form__error" role="alert">{error}</p>}
      </div>

      <fieldset className="profile-form__fieldset">
        <legend>{t('profile.style')}</legend>
        <div className="profile-form__preset-grid">
          {AVATAR_PRESETS.map((candidate) => (
            <label className={`profile-form__preset ${candidate.id === avatarPresetId ? 'is-selected' : ''}`} key={candidate.id}>
              <input type="radio" name="avatarPresetId" value={candidate.id} checked={candidate.id === avatarPresetId} onChange={() => setAvatarPresetId(candidate.id)} />
              <span className="profile-form__preset-mark" style={{ backgroundColor: candidate.clothing }} aria-hidden="true" />
              <span><strong>{t(`profile.preset.${candidate.id}.name` as Parameters<typeof t>[0])}</strong><small>{t(`profile.preset.${candidate.id}.description` as Parameters<typeof t>[0])}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="profile-form__fieldset">
        <legend>{t('profile.skinTone')}</legend>
        <div className="profile-form__swatches">
          {SKIN_COLORS.map((color, index) => (
            <label className="profile-form__swatch-label" key={color}>
              <input type="radio" name="skin" value={color} checked={skin === color} onChange={() => setSkin(color)} />
              <span className="profile-form__swatch" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="profile-form__visually-hidden">{t('profile.skinTone')} {index + 1}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <input type="hidden" name="hair" value={hair} readOnly />
      <input type="hidden" name="clothing" value={CLOTHING_COLORS.includes(preset.clothing) ? preset.clothing : CLOTHING_COLORS[0]} readOnly />
      <button type="submit" className="button button-primary profile-form__submit">{t('profile.begin')}</button>
    </form>
  );
}

export type { ProfileFormProps };
