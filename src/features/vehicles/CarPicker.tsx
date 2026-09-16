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
}

export function CarPicker({ catalog, selectedId, status, busy, preview, onSelect, onSpawn, onClose }: CarPickerProps) {
  const selected = catalog.find((entry) => entry.id === selectedId);
  const spawnDisabled = busy || !selected?.available;

  return (
    <section className="car-picker" aria-labelledby="car-picker-title">
      <header className="car-picker__header">
        <div>
          <p className="car-picker__eyebrow">Vehicles</p>
          <h2 id="car-picker-title">Choose a car</h2>
        </div>
        <button className="button button-secondary car-picker__close" type="button" onClick={onClose}>Close</button>
      </header>

      {preview && <div className="car-picker__preview" aria-label="Selected car preview">{preview}</div>}

      <fieldset className="car-picker__options">
        <legend className="car-picker__legend">Available cars</legend>
        <div className="car-picker__grid">
          {catalog.map((entry) => {
            const reasonId = `car-picker-reason-${entry.id}`;
            return (
              <label className={`car-picker__card${entry.id === selectedId ? ' is-selected' : ''}${!entry.available ? ' is-unavailable' : ''}`} key={entry.id}>
                <input
                  type="radio"
                  name="car-picker-model"
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

      <div className="car-picker__actions">
        <button className="button button-primary" type="button" disabled={spawnDisabled} onClick={onSpawn}>
          {busy ? 'Spawning…' : 'Spawn car'}
        </button>
        {status && <p className="car-picker__status" role="status" aria-live="polite">{status}</p>}
      </div>
    </section>
  );
}
