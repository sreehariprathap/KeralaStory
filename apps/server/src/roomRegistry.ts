import { randomInt } from 'node:crypto';
import { createRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from '@kerala-story/protocol';

export class RoomRegistry {
  private readonly rooms = new Map<string, string>();
  register(roomId: string) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const code = createRoomCode(() => randomInt(ROOM_CODE_ALPHABET.length) / ROOM_CODE_ALPHABET.length);
      if (!this.rooms.has(code)) { this.rooms.set(code, roomId); return code; }
    }
    throw new Error('Room-code capacity unavailable');
  }
  resolve(raw: string) {
    try { return this.rooms.get(normalizeRoomCode(raw)) ?? null; } catch { return null; }
  }
  remove(code: string, roomId: string) { if (this.rooms.get(code) === roomId) this.rooms.delete(code); }
}
export const roomRegistry = new RoomRegistry();
