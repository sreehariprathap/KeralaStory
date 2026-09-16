import { normalizeRoomCode } from '@kerala-story/protocol';

export type LobbyMode = 'create' | 'join';

export type LobbyViewState = 'idle' | 'valid' | 'invalid';

export type LobbyInputResult =
  | { ok: true; roomCode: string }
  | { ok: false; reason: 'invalid-room-code' };

export function parseLobbyInput(value: string): LobbyInputResult {
  const directCode = normalizeCandidate(value);
  if (directCode) {
    return { ok: true, roomCode: directCode };
  }

  try {
    const url = new URL(value.trim());
    const queryCode = url.searchParams.get('room')
      ?? url.searchParams.get('roomCode')
      ?? url.searchParams.get('code');
    const pathCode = url.pathname.split('/').filter(Boolean).at(-1);
    const roomCode = normalizeCandidate(queryCode ?? pathCode ?? '');
    return roomCode
      ? { ok: true, roomCode }
      : { ok: false, reason: 'invalid-room-code' };
  } catch {
    return { ok: false, reason: 'invalid-room-code' };
  }
}

function normalizeCandidate(value: string): string | null {
  try {
    return normalizeRoomCode(value);
  } catch {
    return null;
  }
}
