import type { Locale } from '../../contracts';
import './language-toggle.css';

interface LanguageToggleProps {
  value: Locale;
  onChange: (locale: Locale) => void;
}

export function LanguageToggle({ value, onChange }: LanguageToggleProps) {
  return (
    <label className="language-toggle">
      <span className="language-toggle__label" id="language-toggle-label">Language</span>
      <select
        aria-labelledby="language-toggle-label"
        value={value}
        onChange={event => onChange(event.target.value as Locale)}
      >
        <option value="en">English</option>
        <option value="ml" lang="ml">മലയാളം</option>
      </select>
    </label>
  );
}

export type { LanguageToggleProps };
