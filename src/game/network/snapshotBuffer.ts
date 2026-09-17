export type TimedSnapshot<T> = {
  serverTimeMs: number;
  value: T;
};

export class SnapshotBuffer<T> {
  private readonly capacity: number;
  private readonly entries: TimedSnapshot<T>[] = [];

  constructor(capacity = 20) {
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new Error('Snapshot buffer capacity must be an integer of at least 2.');
    }
    this.capacity = capacity;
  }

  get samples(): readonly TimedSnapshot<T>[] {
    return this.entries;
  }

  push(sample: TimedSnapshot<T>): boolean {
    if (!Number.isFinite(sample.serverTimeMs)) {
      return false;
    }
    const latest = this.entries.at(-1);
    if (latest && sample.serverTimeMs <= latest.serverTimeMs) {
      return false;
    }

    this.entries.push(sample);
    while (this.entries.length > this.capacity) {
      this.entries.shift();
    }
    return true;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

export function sampleSnapshot<T>(
  samples: readonly TimedSnapshot<T>[],
  renderTimeMs: number,
  interpolate: (from: T, to: T, alpha: number) => T,
): T | null {
  if (samples.length === 0) {
    return null;
  }

  if (renderTimeMs <= samples[0].serverTimeMs) {
    return samples[0].value;
  }

  for (let index = 1; index < samples.length; index += 1) {
    const next = samples[index];
    if (renderTimeMs <= next.serverTimeMs) {
      const previous = samples[index - 1];
      const duration = next.serverTimeMs - previous.serverTimeMs;
      const alpha = duration === 0 ? 1 : (renderTimeMs - previous.serverTimeMs) / duration;
      return interpolate(previous.value, next.value, alpha);
    }
  }

  const newest = samples[samples.length - 1];
  return renderTimeMs - newest.serverTimeMs < 250 ? newest.value : null;
}
