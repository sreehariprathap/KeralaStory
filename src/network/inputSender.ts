import { InputSchema } from '@kerala-story/protocol';

export type NetworkInput = ReturnType<typeof InputSchema.parse>;
export type InputIntent = Omit<NetworkInput, 'sequence'>;
export const NEUTRAL_INTENT: InputIntent = { moveX: 0, moveZ: 0, actions: [] };

/** Call from the animation loop. A neutral focus transition is queued at the next send slot. */
export class InputSender {
  private sequence = 0;
  private lastSentAt = -Infinity;
  private lastValue = '';
  private intent: InputIntent = NEUTRAL_INTENT;
  private focused = true;
  constructor(private readonly send: (input: NetworkInput) => void) {}
  setIntent(intent: InputIntent) {
    const parsed = InputSchema.parse({ ...intent, sequence: 0 });
    this.intent = { moveX: parsed.moveX, moveZ: parsed.moveZ, actions: [...new Set(parsed.actions)] };
  }
  setFocused(focused: boolean) { this.focused = focused; this.intent = NEUTRAL_INTENT; }
  /** Preserve sequence monotonicity when a browser rejoins an existing guest. */
  acknowledge(sequence: number) { this.sequence = Math.max(this.sequence, sequence + 1); }
  tick(nowMs: number): NetworkInput | null {
    if (!Number.isFinite(nowMs) || nowMs - this.lastSentAt < 1000 / 30) return null;
    const intent = this.focused ? this.intent : NEUTRAL_INTENT;
    const value = JSON.stringify(intent);
    if (value === this.lastValue && nowMs - this.lastSentAt < 200) return null;
    const input = { ...intent, actions: [...intent.actions], sequence: this.sequence++ };
    this.send(input);
    this.lastSentAt = nowMs; this.lastValue = value;
    // Edge-triggered actions must never be repeated by the heartbeat.
    this.intent = { ...this.intent, actions: this.intent.actions.filter(action => action !== 'jump' && action !== 'interact') };
    return input;
  }
}
