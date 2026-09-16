import { ChatTextSchema, type ChatMessageDto, type RoomErrorDto } from '@kerala-story/protocol';

/** Room-local state. No logging of submitted or accepted message bodies. */
export class ChatService {
  private messages: ChatMessageDto[] = [];
  private sequence = 0;
  private limits = new Map<string, { accepted: number[]; violations: number; mutedUntil: number }>();
  send(sender: { id: string; displayName: string } | undefined, raw: unknown, now: number): { message: ChatMessageDto } | { error: RoomErrorDto['code'] } {
    if (!sender) return { error: 'INVALID_MESSAGE' };
    const parsed = ChatTextSchema.safeParse(raw);
    if (!parsed.success) return { error: 'INVALID_MESSAGE' };
    const limit = this.limits.get(sender.id) ?? { accepted: [], violations: 0, mutedUntil: 0 };
    this.limits.set(sender.id, limit);
    if (now < limit.mutedUntil) return { error: 'MUTED' };
    if (limit.mutedUntil) { limit.mutedUntil = 0; limit.violations = 0; }
    limit.accepted = limit.accepted.filter(time => now - time < 10_000);
    if (limit.accepted.length >= 4) {
      if (++limit.violations >= 3) { limit.mutedUntil = now + 30_000; return { error: 'MUTED' }; }
      return { error: 'RATE_LIMITED' };
    }
    limit.accepted.push(now);
    const message = { id: ++this.sequence, senderId: sender.id, senderName: sender.displayName, text: parsed.data, sentAtMs: now };
    this.messages.push(message);
    if (this.messages.length > 100) this.messages.shift();
    return { message: { ...message } };
  }
  history(): ChatMessageDto[] { return this.messages.map(message => ({ ...message })); }
  removeGuest(id: string) { this.limits.delete(id); }
}
