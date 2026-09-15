import type { ChangeEvent } from 'react';
import type { GameSettings } from '../../contracts';
import './settings-panel.css';

interface SettingsPanelProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onResetPosition?: () => void;
}

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Quiet', description: 'A lighter scene for steadier performance.' },
  { value: 'medium', label: 'Balanced', description: 'The recommended visual setting.' },
  { value: 'high', label: 'Detailed', description: 'Richer foliage and scene detail.' },
] as const;

export function SettingsPanel({ settings, onChange, onResetPosition }: SettingsPanelProps) {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleSensitivity = (event: ChangeEvent<HTMLInputElement>) => {
    update('sensitivity', Number(event.target.value));
  };

  return (
    <form className="settings-panel" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="settings-panel__group">
        <legend>Visual detail</legend>
        <p className="settings-panel__hint">Choose how much scene detail to draw.</p>
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
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-panel__group">
        <legend>Movement</legend>
        <label className="settings-panel__range-label" htmlFor="settings-sensitivity">
          Camera sensitivity <output htmlFor="settings-sensitivity">{settings.sensitivity.toFixed(1)}</output>
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
        <span className="settings-panel__range-scale" aria-hidden="true"><span>Less responsive</span><span>More responsive</span></span>
      </fieldset>

      <label className="settings-panel__check">
        <input
          type="checkbox"
          name="reducedMotion"
          checked={settings.reducedMotion}
          onChange={(event) => update('reducedMotion', event.target.checked)}
        />
        <span><strong>Reduce motion</strong><small>Limit decorative movement and transitions.</small></span>
      </label>

      {onResetPosition&&<button type="button" className="button button-secondary settings-panel__reset" onClick={onResetPosition}>
        Return to the overlook
      </button>}
    </form>
  );
}

export type { SettingsPanelProps };
