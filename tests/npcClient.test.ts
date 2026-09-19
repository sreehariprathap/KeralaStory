import { describe, expect, it, vi, afterEach } from 'vitest';
import { askNpc } from '../src/game/npc/npcClient';

describe('askNpc', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns the server reply on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Hee hee, catch me if you can!' }) }));
    const result = await askNpc({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, 'http://example.test');
    expect(result).toEqual({ reply: 'Hee hee, catch me if you can!', fallback: false });
  });

  it('falls back to a canned line on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'NPC_UNAVAILABLE' }) }));
    const result = await askNpc({ npcId: 'mayavi', message: 'hi', zoneId: 'kodaly' }, 'http://example.test');
    expect(result.fallback).toBe(true);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it('falls back to a canned line when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await askNpc({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, 'http://example.test');
    expect(result.fallback).toBe(true);
  });
});
