import { normalizeRoomCode, type ReplicatedPlayerDto, type RoomSnapshotDto } from '@kerala-story/protocol';
import type { ConnectionPhase } from '../../network/roomClient';

/** Reads ?room=CODE from a query string. Returns null rather than throwing on a malformed code. */
export function roomCodeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('room');
  if (!raw) return null;
  try { return normalizeRoomCode(raw); } catch { return null; }
}

export function remoteGuests(snapshot: RoomSnapshotDto | null, selfId: string | null): ReplicatedPlayerDto[] {
  if (!snapshot || !selfId) return [];
  return snapshot.players.filter(player => player.id !== selfId);
}

export function localGuest(snapshot: RoomSnapshotDto | null, selfId: string | null): ReplicatedPlayerDto | null {
  if (!snapshot || !selfId) return null;
  return snapshot.players.find(player => player.id === selfId) ?? null;
}

/** The world only opens once authority has confirmed this guest exists in it. */
export function canEnterWorld(phase: ConnectionPhase, snapshot: RoomSnapshotDto | null, selfId: string | null): boolean {
  return phase === 'connected' && localGuest(snapshot, selfId) !== null;
}

const ROOM_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: 'That room code was not found. Check the code, or ask for a new invite.',
  ROOM_FULL: 'That room is full. Rooms hold up to 10 guests.',
  WORLD_VERSION_MISMATCH: 'That room runs a different build of the world. Reload this page and try again.',
  ROOM_ENDED: 'That room has ended.',
  RECONNECT_DENIED: 'Your place in that room expired. Join again to get a new one.',
  INVALID_MESSAGE: 'The server rejected that request. Try again.',
};

/** Server codes and transport failures become sentences; anything else is already a sentence. */
export function roomErrorMessage(raw: string): string {
  const code = raw.split(':')[0].trim();
  if (ROOM_ERRORS[code]) return ROOM_ERRORS[code];
  if (/failed to fetch|networkerror|econnrefused|timeout|aborted/i.test(raw)) {
    return 'Could not reach the multiplayer server. If you are running locally, start it with: npm run server:dev';
  }
  return raw;
}

/** The solo save describes a client-owned body that does not exist in a room. */
export function shouldPersistSave(inRoom: boolean): boolean {
  return !inRoom;
}
