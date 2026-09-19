import { describe, expect, it } from 'vitest';
import { MISSION_STUBS } from '../src/content/world/missionStubs';

describe('missionStubs', () => {
  it('has at least four unique, non-empty stubs with valid zone ids', () => {
    const zoneIds = new Set(['kodassery', 'kadambode', 'kurumali', 'kodaly']);
    expect(MISSION_STUBS.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(MISSION_STUBS.map(m => m.id));
    expect(ids.size).toBe(MISSION_STUBS.length);
    for (const stub of MISSION_STUBS) {
      expect(zoneIds.has(stub.zoneId)).toBe(true);
      expect(stub.title.length).toBeGreaterThan(0);
      expect(stub.hint.length).toBeGreaterThan(0);
    }
  });
});
