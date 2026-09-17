import type { GameSettings } from '../../contracts';
import type { CollectKind } from './types';

/** A coin dings brightly, a heart lands softer and lower, money rings longer. */
const TONE: Record<CollectKind, { frequency: number; duration: number; type: OscillatorType }> = {
  coin: { frequency: 1180, duration: .16, type: 'triangle' },
  heart: { frequency: 560, duration: .34, type: 'sine' },
  money: { frequency: 880, duration: .42, type: 'triangle' },
};

let context: AudioContext | null = null;

/** The ambience graph in AudioDirector has no cue API, so pickups get their own tiny oscillator. */
export function playCollectChime(kind: CollectKind, settings: Pick<GameSettings, 'muted' | 'volume'>): void {
  if (settings.muted || settings.volume <= 0) return;
  try {
    const Ctor = globalThis.AudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const { frequency, duration, type } = TONE[kind];
    const now = context.currentTime;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration * .6);
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, settings.volume)) * .12, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Audio is a nicety; a browser that refuses it must not break the pickup.
  }
}
