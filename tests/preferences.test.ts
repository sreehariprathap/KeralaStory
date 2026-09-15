import { describe, expect, it } from 'vitest';
import { loadPreferences, writePreferences } from '../src/persistence/preferencesRepository.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('preferences repository', () => {
  it('loads defaults independently before a profile exists', () => {
    const result = loadPreferences(new MemoryStorage());
    expect(result.preferences).toEqual({ locale: 'en', controls: 'auto' });
    expect(result.exists).toBe(false);
    expect(result.warning).toBeNull();
  });

  it('round trips the latest explicit locale and controls choice', () => {
    const storage = new MemoryStorage();
    expect(writePreferences({ locale: 'ml', controls: 'touch' }, storage).ok).toBe(true);
    expect(loadPreferences(storage)).toEqual({ preferences: { locale: 'ml', controls: 'touch' }, warning: null, exists: true });
  });

  it('falls back safely for unknown locale data', () => {
    const storage = new MemoryStorage();
    storage.setItem('kerala-story:preferences:v1', '{"locale":"xx","controls":"auto"}');
    const result = loadPreferences(storage);
    expect(result.preferences).toEqual({ locale: 'en', controls: 'auto' });
    expect(result.exists).toBe(true);
    expect(result.warning).toMatch(/invalid/i);
  });

  it('reports denied storage without throwing', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } as unknown as Storage;
    expect(loadPreferences(broken).warning).toMatch(/read/i);
    expect(writePreferences({ locale: 'en', controls: 'auto' }, broken).ok).toBe(false);
  });
});
