import { InputSchema } from '@kerala-story/protocol';
import type { z } from 'zod';
export type ServerInput = z.infer<typeof InputSchema>;

/** Latest intent wins, but accepted sequences never move backwards. Bounded per guest. */
export class InputQueue {
  private pending = new Map<string, ServerInput>();
  private sequences = new Map<string, number>();
  push(guestId: string, raw: unknown) {
    const input = InputSchema.safeParse(raw);
    if (!input.success || input.data.sequence <= (this.sequences.get(guestId) ?? -1)) return false;
    this.sequences.set(guestId, input.data.sequence);
    this.pending.set(guestId, input.data);
    return true;
  }
  drain() { const entries = [...this.pending]; this.pending.clear(); return entries; }
  clear(guestId: string) { this.pending.delete(guestId); }
  remove(guestId: string) { this.clear(guestId); this.sequences.delete(guestId); }
}

export class ServerTicker {
  private accumulator = 0;
  ticks = 0;
  advance(deltaMs: number, step: () => void, patch: () => void) {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return 0;
    const stepMs = 1000 / 60;
    this.accumulator = Math.min(this.accumulator + deltaMs, stepMs * 5);
    let steps = 0;
    while (this.accumulator + 1e-8 >= stepMs) {
      this.accumulator -= stepMs;
      step(); this.ticks++; steps++;
      if (this.ticks % 3 === 0) patch();
    }
    return steps;
  }
}
