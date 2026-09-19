import { EquippedSchema, SaveV3Schema, type Equipped, type SaveV3 } from '../contracts';

/** What an account keeps in Firestore at `users/{uid}`: the saved game (coins included) and the equipped loadout. */
export interface CloudRecord { save: SaveV3 | null; equipped: Equipped | null }

/**
 * The document shape. The save is stored as JSON text: Firestore rejects `undefined` fields and nested
 * arrays, and a string keeps the save byte-for-byte what the local repository writes.
 */
export interface CloudDoc { saveJson?: string; equipped?: Equipped }

/** Cloud data is untrusted input: anything that fails the schemas is treated as missing. */
export function parseCloudDoc(data: unknown): CloudRecord {
  const doc = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  let save: SaveV3 | null = null;
  if (typeof doc.saveJson === 'string') {
    try { const parsed = SaveV3Schema.safeParse(JSON.parse(doc.saveJson)); save = parsed.success ? parsed.data : null; } catch { save = null; }
  }
  const equipped = EquippedSchema.safeParse(doc.equipped);
  return { save, equipped: doc.equipped !== undefined && equipped.success ? equipped.data : null };
}

export function toCloudDoc(record: Partial<CloudRecord>): CloudDoc {
  const doc: CloudDoc = {};
  if (record.save) doc.saveJson = JSON.stringify(record.save);
  if (record.equipped) doc.equipped = { ...record.equipped };
  return doc;
}

export type SaveChoice = 'local' | 'cloud' | 'none';

/** On sign-in the newer save wins; a tie keeps the account's copy. */
export function chooseSave(local: SaveV3 | null, cloud: SaveV3 | null): SaveChoice {
  if (!local && !cloud) return 'none';
  if (!local) return 'cloud';
  if (!cloud) return 'local';
  return Date.parse(local.updatedAt) > Date.parse(cloud.updatedAt) ? 'local' : 'cloud';
}
