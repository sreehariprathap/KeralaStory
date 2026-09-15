import { SaveSchema, type SaveV1 } from '../contracts/index.ts';

const PRIMARY_KEY = 'kerala-story:save:v1';
const BACKUP_KEY = 'kerala-story:save:backup';

type RepositoryResult = { ok: boolean; warning: string | null };

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function parseSave(raw: string | null): SaveV1 | null {
  if (raw === null) return null;
  try {
    return SaveSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isFutureSave(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && 'version' in value &&
      typeof value.version === 'number' && value.version > 1;
  } catch {
    return false;
  }
}

export function loadLocalSave(storage?: Storage): { save: SaveV1 | null; warning: string | null } {
  const target = getStorage(storage);
  if (!target) return { save: null, warning: 'Local storage is unavailable; this visit will not persist.' };
  let primary: string | null;
  let backup: string | null;
  try {
    primary = target.getItem(PRIMARY_KEY);
    backup = target.getItem(BACKUP_KEY);
  } catch {
    return { save: null, warning: 'Unable to read local save storage; this visit will not persist.' };
  }
  const save = parseSave(primary);
  if (save) return { save, warning: null };
  const recovered = parseSave(backup);
  if (recovered) {
    return { save: recovered, warning: isFutureSave(primary)
      ? 'A newer primary save was preserved; recovered the last known-good backup.'
      : 'Primary save was invalid; recovered the last known-good save.' };
  }
  if (primary !== null || backup !== null) {
    return { save: null, warning: isFutureSave(primary) ? 'This save was created by a newer version and was preserved.' : 'Saved data was invalid and could not be recovered.' };
  }
  return { save: null, warning: null };
}

export function writeLocalSave(save: SaveV1, storage?: Storage): RepositoryResult {
  const target = getStorage(storage);
  if (!target) return { ok: false, warning: 'Local storage is unavailable; this visit will not persist.' };
  let encoded: string;
  try {
    encoded = JSON.stringify(SaveSchema.parse(save));
  } catch {
    return { ok: false, warning: 'Save data is invalid and was not written.' };
  }
  let primary: string | null;
  try {
    primary = target.getItem(PRIMARY_KEY);
  } catch {
    return { ok: false, warning: 'Unable to read local save storage; existing data was preserved.' };
  }
  if (isFutureSave(primary)) {
    return { ok: false, warning: 'A newer save version exists; it was preserved and not overwritten.' };
  }
  try {
    const current = parseSave(primary);
    if (current) target.setItem(BACKUP_KEY, JSON.stringify(current));
    target.setItem(PRIMARY_KEY, encoded);
    return { ok: true, warning: null };
  } catch {
    return { ok: false, warning: 'Unable to write local save; existing data was preserved.' };
  }
}

export function clearLocalSave(storage?: Storage): RepositoryResult {
  const target = getStorage(storage);
  if (!target) return { ok: false, warning: 'Local storage is unavailable; saved data was not cleared.' };
  try {
    target.removeItem(PRIMARY_KEY);
    target.removeItem(BACKUP_KEY);
    return { ok: true, warning: null };
  } catch {
    return { ok: false, warning: 'Unable to clear local save data.' };
  }
}
