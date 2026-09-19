import { describe, expect, it } from 'vitest';
import { npcPinIcon } from '../src/features/map/npcPinIcon';

describe('npcPinIcon', () => {
  it('returns a distinct renderable icon per NPC id', () => {
    expect(npcPinIcon('luttappi')).toBeDefined();
    expect(npcPinIcon('mayavi')).toBeDefined();
    expect(npcPinIcon('luttappi')).not.toBe(npcPinIcon('mayavi'));
  });
});
