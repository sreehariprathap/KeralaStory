import type { ChangeEvent } from 'react';
import type { ControlsPreference, GameSettings } from '../../contracts';
import { useT } from '../i18n/translate';
import './settings-panel.css';

interface SettingsPanelProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onResetPosition?: () => void;
  controls?: ControlsPreference;
  onControlsChange?: (controls: ControlsPreference) => void;
  locale?: 'en' | 'ml';
  onLocaleChange?: (locale: 'en' | 'ml') => void;
}

const QUALITY_OPTIONS = [
  { value: 'low', label: 'settings.quiet', description: 'settings.quietDescription' },
  { value: 'medium', label: 'settings.balanced', description: 'settings.balancedDescription' },
  { value: 'high', label: 'settings.detailed', description: 'settings.detailedDescription' },
] as const;

export function SettingsPanel({ settings, onChange, onResetPosition, controls, onControlsChange, locale, onLocaleChange }: SettingsPanelProps) {
  const t = useT();
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleSensitivity = (event: ChangeEvent<HTMLInputElement>) => {
    update('sensitivity', Number(event.target.value));
  };

  return (
    <form className="settings-panel" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="settings-panel__group">
        <legend>{t('settings.visualDetail')}</legend>
        <p className="settings-panel__hint">{t('settings.visualHint')}</p>
        <div className="settings-panel__quality-grid">
          {QUALITY_OPTIONS.map((option) => (
            <label className={`settings-panel__quality ${settings.quality === option.value ? 'is-selected' : ''}`} key={option.value}>
              <input
                type="radio"
                name="quality"
                value={option.value}
                checked={settings.quality === option.value}
                onChange={() => update('quality', option.value)}
              />
              <span><strong>{t(option.label)}</strong><small>{t(option.description)}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-panel__group">
        <legend>{t('settings.movement')}</legend>
        <label className="settings-panel__range-label" htmlFor="settings-sensitivity">
          {t('settings.cameraSensitivity')} <output htmlFor="settings-sensitivity">{settings.sensitivity.toFixed(1)}</output>
        </label>
        <input
          id="settings-sensitivity"
          className="settings-panel__range"
          name="sensitivity"
          type="range"
          min="0.3"
          max="2"
          step="0.1"
          value={settings.sensitivity}
          onChange={handleSensitivity}
        />
        <span className="settings-panel__range-scale" aria-hidden="true"><span>{t('settings.lessResponsive')}</span><span>{t('settings.moreResponsive')}</span></span>
      </fieldset>

      {onControlsChange && <fieldset className="settings-panel__group">
        <legend>{t('settings.controls')}</legend>
        <div className="settings-panel__control-options">
          {(['auto', 'touch', 'desktop'] as const).map((value) => <label className="settings-panel__control-option" key={value}>
            <input type="radio" name="controls" value={value} checked={controls === value} onChange={() => onControlsChange(value)} />
            <span>{t(value === 'auto' ? 'settings.controlsAuto' : value === 'touch' ? 'settings.controlsTouch' : 'settings.controlsDesktop')}</span>
          </label>)}
        </div>
      </fieldset>}

      {onLocaleChange && <fieldset className="settings-panel__group">
        <legend>{t('language.label')}</legend>
        <select className="settings-panel__select" value={locale} onChange={(event) => onLocaleChange(event.target.value as 'en' | 'ml')}>
          <option value="en">{t('language.english')}</option>
          <option value="ml">മലയാളം</option>
        </select>
      </fieldset>}

      <fieldset className="settings-panel__group">
        <legend>{t('settings.sound')}</legend>
        <label className="settings-panel__check">
          <input type="checkbox" name="muted" checked={settings.muted} onChange={(event) => update('muted', event.target.checked)} />
          <span><strong>{t('settings.mute')}</strong></span>
        </label>
        <label className="settings-panel__range-label" htmlFor="settings-volume">{t('settings.volume')} <output htmlFor="settings-volume">{Math.round(settings.volume * 100)}%</output></label>
        <input id="settings-volume" className="settings-panel__range" name="volume" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => update('volume', Number(event.target.value))} />
      </fieldset>

      <label className="settings-panel__check">
        <input
          type="checkbox"
          name="reducedMotion"
          checked={settings.reducedMotion}
          onChange={(event) => update('reducedMotion', event.target.checked)}
        />
        <span><strong>{t('settings.reduceMotion')}</strong><small>{t('settings.reduceMotionDescription')}</small></span>
      </label>

      {onResetPosition&&<button type="button" className="button button-secondary settings-panel__reset" onClick={onResetPosition}>
        {t('settings.returnOverlook')}
      </button>}
    </form>
  );
}

export type { SettingsPanelProps };
