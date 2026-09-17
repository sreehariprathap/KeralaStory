import { describe, expect, it } from 'vitest';
import { Admission, AdmissionError } from '../src/admission.ts';

const profile = { displayName: 'Maya', appearance: { avatarPresetId: 'canopy', colors: { skin: '#dba77e', hair: '#292a25', clothing: '#285943' } } };
describe('room admission', () => {
  it('counts grace guests toward ten and rejects eleven without evicting anyone', () => {
    const admission = new Admission('world');
    const guests = Array.from({ length: 10 }, (_, i) => admission.join(`session-${i}`, { ...profile, worldVersion: 'world' }, 0));
    admission.disconnect('session-0', 10);
    expect(() => admission.join('eleven', { ...profile, worldVersion: 'world' }, 20)).toThrow('ROOM_FULL');
    expect(admission.guests.size).toBe(10);
    const reclaimed = admission.join('reconnected', { ...profile, worldVersion: 'world', reconnectToken: guests[0].token }, 59_999);
    expect(reclaimed.guest.id).toBe(guests[0].guest.id);
    expect(reclaimed.reconnected).toBe(true);
    expect(admission.guests.size).toBe(10);
  });
  it('rejects invalid, expired, duplicate-connected tokens and wrong world versions', () => {
    const admission = new Admission('world');
    const first = admission.join('a', { ...profile, worldVersion: 'world' }, 0);
    expect(() => admission.join('b', { ...profile, worldVersion: 'other' }, 1)).toThrow('WORLD_VERSION_MISMATCH');
    expect(() => admission.join('b', { ...profile, worldVersion: 'world', reconnectToken: first.token }, 1)).toThrow('RECONNECT_DENIED');
    admission.disconnect('a', 1);
    expect(() => admission.join('b', { ...profile, worldVersion: 'world', reconnectToken: 'unknown-token-value-1234567890123456' }, 2)).toThrow(AdmissionError);
    expect(() => admission.join('b', { ...profile, worldVersion: 'world', reconnectToken: first.token }, 60_001)).toThrow('RECONNECT_DENIED');
  });
  it('keeps tokens out of guest records and invalidates them on explicit leave', () => {
    const admission = new Admission('world');
    const first = admission.join('a', { ...profile, worldVersion: 'world' }, 0);
    expect(JSON.stringify([...admission.guests.values()])).not.toContain(first.token);
    admission.leave('a');
    expect(() => admission.join('b', { ...profile, worldVersion: 'world', reconnectToken: first.token }, 1)).toThrow('RECONNECT_DENIED');
  });
});
