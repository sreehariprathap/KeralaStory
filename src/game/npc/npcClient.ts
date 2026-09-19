import type { NpcId } from './npcDefinitions';

export interface NpcChatRequest { npcId: NpcId; message: string; zoneId: string }
export interface NpcChatResult { reply: string; fallback: boolean }

const FALLBACK_LINES: Record<NpcId, string> = {
  luttappi: "Luttappi vanishes into the trees, giggling — he'll be back.",
  mayavi: 'Mayavi smiles quietly and points ahead before fading from view.',
};

const TIMEOUT_MS = 6000;

export async function askNpc(req: NpcChatRequest, baseUrl: string): Promise<NpcChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/npc/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!response.ok) return { reply: FALLBACK_LINES[req.npcId], fallback: true };
    const data = await response.json() as { reply?: string };
    if (!data.reply) return { reply: FALLBACK_LINES[req.npcId], fallback: true };
    return { reply: data.reply, fallback: false };
  } catch {
    return { reply: FALLBACK_LINES[req.npcId], fallback: true };
  } finally {
    clearTimeout(timer);
  }
}
