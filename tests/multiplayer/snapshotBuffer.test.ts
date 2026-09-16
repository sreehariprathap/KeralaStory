import { describe, expect, it } from 'vitest';
import { SnapshotBuffer, sampleSnapshot } from '../../src/game/network/snapshotBuffer';

describe('multiplayer snapshot buffer', () => {
  it('interpolates between ordered samples and rejects reordered packets', () => {
    const buffer = new SnapshotBuffer<number>(3);
    expect(buffer.push({ serverTimeMs: 100, value: 10 })).toBe(true);
    expect(buffer.push({ serverTimeMs: 200, value: 20 })).toBe(true);
    expect(buffer.push({ serverTimeMs: 150, value: 15 })).toBe(false);
    expect(sampleSnapshot(buffer.samples, 150, (older, newer, alpha) => older + (newer - older) * alpha)).toBe(15);
  });

  it('evicts old samples and returns null after the extrapolation limit', () => {
    const buffer = new SnapshotBuffer<number>(2);
    buffer.push({ serverTimeMs: 100, value: 1 });
    buffer.push({ serverTimeMs: 200, value: 2 });
    buffer.push({ serverTimeMs: 300, value: 3 });

    expect(buffer.samples.map(sample => sample.serverTimeMs)).toEqual([200, 300]);
    expect(sampleSnapshot(buffer.samples, 549, (older, newer) => newer ?? older)).toBe(3);
    expect(sampleSnapshot(buffer.samples, 550, (older, newer) => newer ?? older)).toBeNull();
  });
});
