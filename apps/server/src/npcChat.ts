import { z } from 'zod';
import { sanitizePlainText } from '@kerala-story/protocol';
import { MISSION_STUBS } from '../../../src/content/world/missionStubs.ts';
import { IpLimiter } from './config.ts';

const NpcChatBodySchema = z.object({
  npcId: z.enum(['luttappi', 'mayavi']),
  message: z.string().min(1).max(300),
  zoneId: z.enum(['kodassery', 'kadambode', 'kurumali', 'kodaly']),
}).strict();

export interface NpcChatEnv {
  geminiApiKey?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  fetchImpl?: typeof fetch;
}

const PERSONAS: Record<'luttappi' | 'mayavi', string> = {
  luttappi: "You are Luttappi, a naughty kuttichathan (a mischievous forest spirit from Kerala folklore). You love pranks, teasing travelers, and playful misdirection — but never anything truly mean or unsafe. Keep replies short (1-3 sentences), in character, a little cheeky. When asked about missions, you may playfully misdirect rather than give the real answer.",
  mayavi: 'You are Mayavi, a kind kuttichathan who protects travelers, offers gentle guidance, and keeps Luttappi in check. Keep replies short (1-3 sentences), warm and encouraging. When asked about missions, give a genuine, helpful hint.',
};

function missionContext(zoneId: string): string {
  const relevant = MISSION_STUBS.filter(m => m.zoneId === zoneId);
  const list = (relevant.length ? relevant : MISSION_STUBS).map(m => `- ${m.title}: ${m.hint}`).join('\n');
  return `Known local happenings you can reference:\n${list}`;
}

export const npcChatLimiter = new IpLimiter(10, 60_000);

async function askGemini(apiKey: string, systemPrompt: string, message: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: message }] }] }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

async function askOpenRouter(apiKey: string, model: string, systemPrompt: string, message: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }] }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

export async function handleNpcChat(body: unknown, env: NpcChatEnv): Promise<{ reply: string } | { error: 'INVALID_MESSAGE' | 'NPC_UNAVAILABLE' }> {
  const parsed = NpcChatBodySchema.safeParse(body);
  if (!parsed.success) return { error: 'INVALID_MESSAGE' };
  let message: string;
  try { message = sanitizePlainText(parsed.data.message); } catch { return { error: 'INVALID_MESSAGE' }; }

  const systemPrompt = `${PERSONAS[parsed.data.npcId]}\n\n${missionContext(parsed.data.zoneId)}`;
  const fetchImpl = env.fetchImpl ?? fetch;

  if (env.geminiApiKey) {
    const reply = await askGemini(env.geminiApiKey, systemPrompt, message, fetchImpl);
    if (reply) return { reply };
  }
  if (env.openRouterApiKey) {
    const reply = await askOpenRouter(env.openRouterApiKey, env.openRouterModel ?? 'google/gemini-2.0-flash-001', systemPrompt, message, fetchImpl);
    if (reply) return { reply };
  }
  return { error: 'NPC_UNAVAILABLE' };
}
