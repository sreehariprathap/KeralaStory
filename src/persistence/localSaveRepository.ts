import { SaveSchema, SaveV2Schema, SaveV3Schema, type LocalSave, type SaveV1, type SaveV2, type SaveV3 } from '../contracts/index.ts';
import { createCollectState } from '../game/collectables/collectState';

const PRIMARY_KEY = 'kerala-story:save:v1';
const BACKUP_KEY = 'kerala-story:save:backup';
const ARCHIVE_KEY = 'kerala-story:save:archive';

type RepositoryResult = { ok: boolean; warning: string | null };

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function migrateV1(save: SaveV1): SaveV2 {
  return { ...save, version: 2, locale: 'en', bicycle: null };
}

function migrateV2(save: SaveV2): SaveV3 {
  return { ...save, version: 3, collect: createCollectState() };
}

function parseSave(raw: string | null): LocalSave | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const v3 = SaveV3Schema.safeParse(value);
    if (v3.success) return v3.data;
    const v2 = SaveV2Schema.safeParse(value);
    if (v2.success) return v2.data;
    const v1 = SaveSchema.safeParse(value);
    return v1.success ? v1.data : null;
  } catch {
    return null;
  }
}

function toV3(save: LocalSave): SaveV3 {
  const v2 = save.version === 1 ? migrateV1(save) : save;
  return v2.version === 2 ? migrateV2(v2) : v2;
}

function isFutureSave(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && 'version' in value &&
      typeof value.version === 'number' && value.version > 3;
  } catch {
    return false;
  }
}

function archiveRaw(target: Storage, raw: string): void {
  if (target.getItem(ARCHIVE_KEY) === null) {
    target.setItem(ARCHIVE_KEY, raw);
    return;
  }
  let suffix = 1;
  while (target.getItem(`${ARCHIVE_KEY}:${suffix}`) !== null) suffix += 1;
  target.setItem(`${ARCHIVE_KEY}:${suffix}`, raw);
}

export function loadLocalSave(storage?: Storage): { save: SaveV3 | null; warning: string | null } {
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
  if (save) return { save: toV3(save), warning: save.version < 3 ? 'Older save migrated to version 3.' : null };
  const recovered = parseSave(backup);
  if (recovered) {
    return { save: toV3(recovered), warning: isFutureSave(primary)
      ? 'A newer primary save was preserved; recovered the last known-good backup.'
      : 'Primary save was invalid; recovered the last known-good save.' };
  }
  if (primary !== null || backup !== null) {
    return { save: null, warning: isFutureSave(primary) ? 'This save was created by a newer version and was preserved.' : 'Saved data was invalid and could not be recovered.' };
  }
  return { save: null, warning: null };
}

export function writeLocalSave(save: LocalSave, storage?: Storage): RepositoryResult {
  const target = getStorage(storage);
  if (!target) return { ok: false, warning: 'Local storage is unavailable; this visit will not persist.' };
  let encoded: string;
  try {
    encoded = JSON.stringify(SaveV3Schema.parse(toV3(save.version === 1 ? SaveSchema.parse(save) : save.version === 2 ? SaveV2Schema.parse(save) : SaveV3Schema.parse(save))));
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
    if (primary !== null && !current) archiveRaw(target, primary);
    if (primary !== null && current !== null && current.version < 3 && target.getItem(ARCHIVE_KEY) === null) archiveRaw(target, primary);
    if (current) target.setItem(BACKUP_KEY, JSON.stringify(toV3(current)));
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
