import { describe, expect, it } from 'vitest';
import type { RoomSnapshotDto } from '@kerala-story/protocol';
import { canEnterWorld, localGuest, remoteGuests, roomCodeFromSearch, roomErrorMessage, shouldPersistSave } from '../../src/features/multiplayer/roomSessionModel';

const player = (id: string, connected = true) => ({
  id,
  displayName: id,
  connected,
  appearance: { avatarPresetId: 'canopy' as const, colors: { skin: '#ba805b' as const, hair: '#292a25' as const, clothing: '#285943' as const } },
  transform: { position: [0, 0, 0] as [number, number, number], velocity: [0, 0, 0] as [number, number, number], headingRad: 0 },
  travel: { kind: 'foot' as const },
  lastProcessedInput: 0,
});
const snapshot = (ids: string[]): RoomSnapshotDto => ({
  phase: 'playing',
  worldVersion: 'test-world',
  serverTimeMs: 0,
  players: ids.map(id => player(id)),
  vehicles: [],
  roster: ids.map(id => ({ id, displayName: id, connected: true })),
});

describe('roomCodeFromSearch', () => {
  it('reads and normalizes a room code from the query string', () => {
    expect(roomCodeFromSearch('?room=abcdefgh')).toBe('ABCDEFGH');
  });
  it('returns null when there is no code', () => {
    expect(roomCodeFromSearch('')).toBeNull();
    expect(roomCodeFromSearch('?other=1')).toBeNull();
  });
  it('returns null for a malformed code rather than throwing', () => {
    expect(roomCodeFromSearch('?room=NOT-A-CODE-AT-ALL')).toBeNull();
  });
});

describe('guest selection', () => {
  it('excludes the local guest from the remote list', () => {
    expect(remoteGuests(snapshot(['a', 'b', 'c']), 'b').map(guest => guest.id)).toEqual(['a', 'c']);
  });
  it('returns an empty list when the snapshot or self id is missing', () => {
    expect(remoteGuests(null, 'a')).toEqual([]);
    expect(remoteGuests(snapshot(['a']), null)).toEqual([]);
  });
  it('finds the local guest by id', () => {
    expect(localGuest(snapshot(['a', 'b']), 'b')?.id).toBe('b');
    expect(localGuest(snapshot(['a']), 'b')).toBeNull();
  });
});

describe('canEnterWorld', () => {
  it('allows entry only when connected and present in the snapshot', () => {
    expect(canEnterWorld('connected', snapshot(['a']), 'a')).toBe(true);
    expect(canEnterWorld('connecting', snapshot(['a']), 'a')).toBe(false);
    expect(canEnterWorld('connected', snapshot(['b']), 'a')).toBe(false);
    expect(canEnterWorld('connected', null, 'a')).toBe(false);
  });
});

describe('roomErrorMessage', () => {
  it('translates server codes into player-facing sentences', () => {
    expect(roomErrorMessage('ROOM_NOT_FOUND')).toBe('That room code was not found. Check the code, or ask for a new invite.');
    expect(roomErrorMessage('ROOM_FULL')).toBe('That room is full. Rooms hold up to 10 guests.');
    expect(roomErrorMessage('WORLD_VERSION_MISMATCH')).toBe('That room runs a different build of the world. Reload this page and try again.');
    expect(roomErrorMessage('ROOM_ENDED')).toBe('That room has ended.');
    expect(roomErrorMessage('RECONNECT_DENIED')).toBe('Your place in that room expired. Join again to get a new one.');
  });
  it('recognises a failure to reach the server', () => {
    expect(roomErrorMessage('Failed to fetch')).toBe('Could not reach the multiplayer server. If you are running locally, start it with: npm run server:dev');
  });
  it('passes through anything else unchanged', () => {
    expect(roomErrorMessage('Something odd happened.')).toBe('Something odd happened.');
  });
});

describe('shouldPersistSave', () => {
  it('refuses to write the local save while in a room', () => {
    expect(shouldPersistSave(true)).toBe(false);
    expect(shouldPersistSave(false)).toBe(true);
  });
});
