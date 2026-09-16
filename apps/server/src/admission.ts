import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AvatarAppearanceSchema, DisplayNameSchema, EMPTY_ROOM_CLOSE_MS, MAX_ROOM_OCCUPANTS, ROOM_DISCONNECT_GRACE_MS, type AvatarAppearanceDto, type RoomErrorDto } from '@kerala-story/protocol';

export const JoinOptionsSchema = z.object({
  displayName: DisplayNameSchema,
  appearance: AvatarAppearanceSchema,
  worldVersion: z.string().min(1).max(80),
  reconnectToken: z.string().min(32).max(128).optional(),
}).strict();
export class AdmissionError extends Error {
  constructor(public readonly code: RoomErrorDto['code']) { super(code); }
}
export interface Guest {
  id: string;
  displayName: string;
  appearance: AvatarAppearanceDto;
  sessionId: string | null;
  disconnectedAt: number | null;
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Synchronous ownership transitions: no await between capacity check and claim. */
export class Admission {
  readonly guests = new Map<string, Guest>();
  private readonly tokens = new Map<string, string>();
  private emptySince: number | null;
  constructor(readonly worldVersion: string, now = 0) { this.emptySince = now; }

  join(sessionId: string, raw: unknown, now: number) {
    const parsed = JoinOptionsSchema.safeParse(raw);
    if (!parsed.success) throw new AdmissionError('INVALID_MESSAGE');
    const options = parsed.data;
    if (options.worldVersion !== this.worldVersion) throw new AdmissionError('WORLD_VERSION_MISMATCH');
    if (this.bySession(sessionId)) throw new AdmissionError('RECONNECT_DENIED');
    let guest: Guest;
    const token = options.reconnectToken ?? randomBytes(32).toString('base64url');
    if (options.reconnectToken) {
      const id = this.tokens.get(hash(token));
      const previous = id ? this.guests.get(id) : undefined;
      if (!previous || previous.sessionId !== null || previous.disconnectedAt === null || now - previous.disconnectedAt >= ROOM_DISCONNECT_GRACE_MS) throw new AdmissionError('RECONNECT_DENIED');
      guest = previous;
      guest.sessionId = sessionId;
      guest.disconnectedAt = null;
    } else {
      // Expiry is explicit so the caller also removes expired simulation bodies.
      if (this.guests.size >= MAX_ROOM_OCCUPANTS) throw new AdmissionError('ROOM_FULL');
      guest = { id: `guest_${randomUUID()}`, displayName: options.displayName, appearance: options.appearance, sessionId, disconnectedAt: null };
      this.guests.set(guest.id, guest);
      this.tokens.set(hash(token), guest.id);
    }
    this.emptySince = null;
    return { guest, token, reconnected: Boolean(options.reconnectToken) };
  }
  bySession(sessionId: string) { return [...this.guests.values()].find(guest => guest.sessionId === sessionId); }
  resumeTransport(id: string, sessionId: string, now: number) {
    const guest = this.guests.get(id);
    if (!guest || guest.sessionId !== null || guest.disconnectedAt === null || now - guest.disconnectedAt >= ROOM_DISCONNECT_GRACE_MS) return false;
    guest.sessionId = sessionId; guest.disconnectedAt = null; this.emptySince = null;
    return true;
  }
  disconnect(sessionId: string, now: number) {
    const guest = this.bySession(sessionId);
    if (!guest) return undefined;
    guest.sessionId = null;
    guest.disconnectedAt = now;
    if (![...this.guests.values()].some(item => item.sessionId !== null)) this.emptySince ??= now;
    return guest.id;
  }
  leave(sessionId: string, now = 0) {
    const guest = this.bySession(sessionId);
    if (!guest) return undefined;
    this.remove(guest.id);
    if (![...this.guests.values()].some(item => item.sessionId !== null)) this.emptySince ??= now;
    return guest.id;
  }
  private remove(id: string) {
    this.guests.delete(id);
    for (const [tokenHash, guestId] of this.tokens) if (guestId === id) this.tokens.delete(tokenHash);
  }
  expire(now: number) {
    const removed: string[] = [];
    for (const guest of this.guests.values()) {
      if (guest.disconnectedAt !== null && now - guest.disconnectedAt >= ROOM_DISCONNECT_GRACE_MS) { removed.push(guest.id); this.remove(guest.id); }
    }
    return removed;
  }
  shouldClose(now: number) { return this.emptySince !== null && now - this.emptySince >= EMPTY_ROOM_CLOSE_MS; }
}
