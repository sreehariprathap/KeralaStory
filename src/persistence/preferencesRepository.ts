import { PreferencesSchema, type Preferences } from '../contracts/index.ts';

export const PREFERENCES_KEY = 'kerala-story:preferences:v1';
type PreferenceResult = { ok: boolean; warning: string | null };
type LoadPreferencesResult = { preferences: Preferences; warning: string | null; exists: boolean };

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

export function loadPreferences(storage?: Storage): LoadPreferencesResult {
  const defaults = PreferencesSchema.parse({});
  const target = getStorage(storage);
  if (!target) return { preferences: defaults, warning: 'Local storage is unavailable; preferences will not persist.', exists: false };
  let raw: string | null;
  try { raw = target.getItem(PREFERENCES_KEY); } catch {
    return { preferences: defaults, warning: 'Unable to read preferences; defaults are in use.', exists: false };
  }
  if (raw === null) return { preferences: defaults, warning: null, exists: false };
  try { return { preferences: PreferencesSchema.parse(JSON.parse(raw)), warning: null, exists: true }; }
  catch { return { preferences: defaults, warning: 'Saved preferences were invalid; defaults are in use.', exists: true }; }
}

export function writePreferences(preferences: Preferences, storage?: Storage): PreferenceResult {
  const target = getStorage(storage);
  if (!target) return { ok: false, warning: 'Local storage is unavailable; preferences were not saved.' };
  let encoded: string;
  try { encoded = JSON.stringify(PreferencesSchema.parse(preferences)); }
  catch { return { ok: false, warning: 'Preferences are invalid and were not saved.' }; }
  try { target.setItem(PREFERENCES_KEY, encoded); return { ok: true, warning: null }; }
  catch { return { ok: false, warning: 'Unable to save preferences; existing preferences were preserved.' }; }
}
