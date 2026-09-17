import { describe, expect, it } from 'vitest';
import { Admission } from '../src/admission.ts';
import { RoomRegistry } from '../src/roomRegistry.ts';

describe('room lifecycle', () => {
  it('closes five minutes after last connection, with grace expiring earlier', () => {
    const admission = new Admission('world', 0);
    const joined = admission.join('a', { displayName: 'Maya', appearance: { avatarPresetId: 'canopy', colors: { skin: '#dba77e', hair: '#292a25', clothing: '#285943' } }, worldVersion: 'world' }, 0);
    admission.disconnect('a', 20);
    expect(admission.expire(60_019)).toEqual([]);
    expect(admission.expire(60_020)).toEqual([joined.guest.id]);
    expect(admission.shouldClose(300_019)).toBe(false);
    expect(admission.shouldClose(300_020)).toBe(true);
  });
  it('normalizes codes, resolves only registered rooms and removes disposal entries', () => {
    const registry = new RoomRegistry();
    const code = registry.register('room-id');
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(registry.resolve(code.toLowerCase())).toBe('room-id');
    registry.remove(code, 'wrong-room');
    expect(registry.resolve(code)).toBe('room-id');
    registry.remove(code, 'room-id');
    expect(registry.resolve(code)).toBeNull();
    expect(registry.resolve('bad')).toBeNull();
  });
});
