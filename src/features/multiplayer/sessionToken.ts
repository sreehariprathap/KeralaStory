import { normalizeRoomCode } from '@kerala-story/protocol';

const STORAGE_PREFIX = 'kerala-story:multiplayer:session:';

export type SessionReadResult = {
  token: string | null;
  warning: string | null;
};

export type SessionWriteResult = {
  ok: boolean;
  warning: string | null;
};

export interface SessionTokenRepository {
  get(roomCode: string): SessionReadResult;
  set(roomCode: string, token: string): SessionWriteResult;
  remove(roomCode: string): SessionWriteResult;
}

export function createSessionTokenRepository(storage?: Storage): SessionTokenRepository {
  const backingStorage = storage ?? getSessionStorage();

  return {
    get(roomCode) {
      const keyResult = sessionKey(roomCode);
      if (!keyResult) {
        return { token: null, warning: 'Invalid room code; session token was not read.' };
      }
      if (!backingStorage) {
        return { token: null, warning: 'Session storage is unavailable.' };
      }

      try {
        return { token: backingStorage.getItem(keyResult), warning: null };
      } catch {
        return { token: null, warning: 'Session storage could not be read.' };
      }
    },
    set(roomCode, token) {
      const keyResult = sessionKey(roomCode);
      if (!keyResult) {
        return { ok: false, warning: 'Invalid room code; session token was not saved.' };
      }
      if (!token.trim()) {
        return { ok: false, warning: 'A non-empty session token is required.' };
      }
      if (!backingStorage) {
        return { ok: false, warning: 'Session storage is unavailable.' };
      }

      try {
        backingStorage.setItem(keyResult, token);
        return { ok: true, warning: null };
      } catch {
        return { ok: false, warning: 'Session storage could not save the token.' };
      }
    },
    remove(roomCode) {
      const keyResult = sessionKey(roomCode);
      if (!keyResult) {
        return { ok: false, warning: 'Invalid room code; session token was not removed.' };
      }
      if (!backingStorage) {
        return { ok: false, warning: 'Session storage is unavailable.' };
      }

      try {
        backingStorage.removeItem(keyResult);
        return { ok: true, warning: null };
      } catch {
        return { ok: false, warning: 'Session storage could not remove the token.' };
      }
    },
  };
}

function sessionKey(roomCode: string): string | null {
  try {
    return `${STORAGE_PREFIX}${normalizeRoomCode(roomCode)}`;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}
