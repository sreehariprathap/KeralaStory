import type { ReactNode } from 'react';
import './car-picker.css';

export interface CarPickerCatalogEntry {
  id: string;
  name: string;
  available: boolean;
  reason: string;
}

export interface CarPickerProps {
  catalog: readonly CarPickerCatalogEntry[];
  selectedId: string;
  status: string;
  busy: boolean;
  preview?: ReactNode;
  onSelect: (id: string) => void;
  onSpawn: () => void;
  onClose: () => void;
  /** Omits the card's own border/header/close button when a host (e.g. a dialog) already provides them. */
  embedded?: boolean;
  /** Paint presets; the colour section is shown only when the selected car supports paint. */
  colors?: readonly { id: string; label: string; value: string }[];
  selectedColor?: string;
  onColorSelect?: (value: string) => void;
  /** Singular vehicle word used in labels, e.g. 'car' or 'bike'. */
  noun?: string;
}

export function CarPicker({ catalog, selectedId, status, busy, preview, onSelect, onSpawn, onClose, embedded, colors, selectedColor, onColorSelect, noun = 'car' }: CarPickerProps) {
  const selected = catalog.find((entry) => entry.id === selectedId);
  const spawnDisabled = busy || !selected?.available;

  return (
    <section className={`car-picker${embedded ? ' car-picker--embedded' : ''}`} aria-labelledby={embedded ? undefined : 'car-picker-title'}>
      {!embedded && (
        <header className="car-picker__header">
          <div>
            <p className="car-picker__eyebrow">Vehicles</p>
            <h2 id="car-picker-title">Choose a {noun}</h2>
          </div>
          <button className="button button-secondary car-picker__close" type="button" onClick={onClose}>Close</button>
        </header>
      )}

      {preview && <div className="car-picker__preview" aria-label={`Selected ${noun} preview`}>{preview}</div>}

      <fieldset className="car-picker__options">
        <legend className="car-picker__legend">Available {noun}s</legend>
        <div className="car-picker__grid">
          {catalog.map((entry) => {
            const reasonId = `car-picker-reason-${entry.id}`;
            return (
              <label className={`car-picker__card${entry.id === selectedId ? ' is-selected' : ''}${!entry.available ? ' is-unavailable' : ''}`} key={entry.id}>
                <input
                  type="radio"
                  name={`${noun}-picker-model`}
                  value={entry.id}
                  checked={entry.id === selectedId}
                  disabled={!entry.available || busy}
                  onChange={() => onSelect(entry.id)}
                  aria-describedby={!entry.available && entry.reason ? reasonId : undefined}
                />
                <span className="car-picker__card-copy">
                  <strong>{entry.name}</strong>
                  {!entry.available && <small id={reasonId}>{entry.reason || 'Not available yet.'}</small>}
                </span>
                {!entry.available && <span className="car-picker__badge">Unavailable</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {colors && onColorSelect && (
        <fieldset className="car-picker__options">
          <legend className="car-picker__legend">Paint</legend>
          <div className="car-picker__swatches">
            {colors.map((color) => (
              <label className="car-picker__swatch" key={color.id} title={color.label}>
                <input type="radio" name="car-picker-color" value={color.value} checked={selectedColor?.toLowerCase() === color.value.toLowerCase()} disabled={busy} onChange={() => onColorSelect(color.value)} />
                <span className="car-picker__swatch-chip" style={{ background: color.value }} aria-hidden="true" />
                <span className="car-picker__swatch-label">{color.label}</span>
              </label>
            ))}
            <label className="car-picker__swatch" title="Custom colour">
              <input className="car-picker__custom-color" type="color" value={selectedColor ?? '#ffffff'} disabled={busy} onChange={(event) => onColorSelect(event.target.value)} />
              <span className="car-picker__swatch-label">Custom</span>
            </label>
          </div>
        </fieldset>
      )}

      <div className="car-picker__actions">
        <button className="button button-primary" type="button" disabled={spawnDisabled} onClick={onSpawn}>
          {busy ? 'Spawning…' : `Spawn ${noun}`}
        </button>
        {status && <p className="car-picker__status" role="status" aria-live="polite">{status}</p>}
      </div>
    </section>
  );
}
