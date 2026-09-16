type Counter = 'joins' | 'reconnects' | 'rejectedInput' | 'rejectedChat';
type Sample = 'tickMs' | 'patchBytes' | 'rttMs';
export class RoomMetrics {
  private counters: Record<Counter, number> = { joins: 0, reconnects: 0, rejectedInput: 0, rejectedChat: 0 };
  private samples: Record<Sample, number[]> = { tickMs: [], patchBytes: [], rttMs: [] };
  activeGuests = 0;
  occupancy = 0;
  closeReason: 'empty' | 'shutdown' | null = null;
  increment(name: Counter) { this.counters[name]++; }
  sample(name: Sample, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    const values = this.samples[name];
    values.push(value);
    if (values.length > 1_200) values.shift();
  }
  snapshot() {
    const stats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { count: sorted.length, median: sorted.length ? sorted[Math.ceil(sorted.length * .5) - 1] : null, p95: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null };
    };
    return { ...this.counters, activeGuests: this.activeGuests, occupancy: this.occupancy, closeReason: this.closeReason, tickMs: stats(this.samples.tickMs), patchBytes: stats(this.samples.patchBytes), rttMs: stats(this.samples.rttMs) };
  }
}
