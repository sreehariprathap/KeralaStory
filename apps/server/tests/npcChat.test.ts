import { describe, expect, it, vi } from 'vitest';
import { handleNpcChat } from '../src/npcChat.ts';

function fetchSequence(...responses: Array<{ ok: boolean; json: () => Promise<unknown> } | Error>) {
  let i = 0;
  return vi.fn(async () => {
    const next = responses[Math.min(i++, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
}

describe('handleNpcChat', () => {
  it('rejects an invalid body', async () => {
    const result = await handleNpcChat({ npcId: 'not-real', message: 'hi', zoneId: 'kodaly' }, {});
    expect(result).toEqual({ error: 'INVALID_MESSAGE' });
  });

  it('rejects an over-length message', async () => {
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'x'.repeat(500), zoneId: 'kodaly' }, {});
    expect(result).toEqual({ error: 'INVALID_MESSAGE' });
  });

  it('returns the Gemini reply on success', async () => {
    const fetchImpl = fetchSequence({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hee hee!' }] } }] }) });
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, { geminiApiKey: 'g', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ reply: 'Hee hee!' });
  });

  it('falls back to OpenRouter when Gemini fails', async () => {
    const fetchImpl = fetchSequence(
      { ok: false, json: async () => ({}) },
      { ok: true, json: async () => ({ choices: [{ message: { content: 'Be careful, traveler.' } }] }) },
    );
    const result = await handleNpcChat({ npcId: 'mayavi', message: 'hi', zoneId: 'kodaly' }, { geminiApiKey: 'g', openRouterApiKey: 'o', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ reply: 'Be careful, traveler.' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns NPC_UNAVAILABLE when both providers fail', async () => {
    const fetchImpl = fetchSequence(new Error('down'), new Error('down'));
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, { geminiApiKey: 'g', openRouterApiKey: 'o', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ error: 'NPC_UNAVAILABLE' });
  });

  it('returns NPC_UNAVAILABLE when no keys are configured', async () => {
    const result = await handleNpcChat({ npcId: 'luttappi', message: 'hi', zoneId: 'kodaly' }, {});
    expect(result).toEqual({ error: 'NPC_UNAVAILABLE' });
  });
});
