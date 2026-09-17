import { describe, expect, it } from 'vitest';
import { parseLobbyInput } from '../../src/features/multiplayer/lobbyModel';

describe('multiplayer lobby model', () => {
  it('normalizes a pasted room code', () => {
    expect(parseLobbyInput(' abcd-2345 ')).toEqual({ ok: true, roomCode: 'ABCD2345' });
  });

  it('normalizes a room code from a share URL', () => {
    expect(parseLobbyInput('https://example.test/play?room=abcd2345')).toEqual({ ok: true, roomCode: 'ABCD2345' });
  });

  it('returns a specific recoverable validation result for malformed input', () => {
    expect(parseLobbyInput('ABCD1234')).toEqual({ ok: false, reason: 'invalid-room-code' });
    expect(parseLobbyInput('not a url')).toEqual({ ok: false, reason: 'invalid-room-code' });
  });
});
