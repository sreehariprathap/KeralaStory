import { describe, expect, it } from 'vitest';
import { createSessionTokenRepository } from '../../src/features/multiplayer/sessionToken';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('multiplayer session token repository', () => {
  it('scopes tokens to room code and removes them without profile data', () => {
    const storage = new MemoryStorage();
    const repository = createSessionTokenRepository(storage);

    expect(repository.set('ABCD2345', 'token-a')).toEqual({ ok: true, warning: null });
    expect(repository.set('EFGH2345', 'token-b')).toEqual({ ok: true, warning: null });
    expect(repository.get('ABCD2345')).toEqual({ token: 'token-a', warning: null });
    expect(repository.get('EFGH2345')).toEqual({ token: 'token-b', warning: null });
    expect(storage.getItem('kerala-story:multiplayer:session:ABCD2345')).toBe('token-a');
    expect(storage.getItem('kerala-story:multiplayer:session:ABCD2345')).not.toContain('profile');
    expect(repository.remove('ABCD2345')).toEqual({ ok: true, warning: null });
    expect(repository.get('ABCD2345')).toEqual({ token: null, warning: null });
  });

  it('surfaces unavailable storage instead of throwing', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } } as unknown as Storage;
    const repository = createSessionTokenRepository(broken);

    expect(repository.get('ABCD2345').warning).toMatch(/read/i);
    expect(repository.set('ABCD2345', 'token').warning).toMatch(/save/i);
    expect(repository.remove('ABCD2345').warning).toMatch(/remove/i);
  });
});
