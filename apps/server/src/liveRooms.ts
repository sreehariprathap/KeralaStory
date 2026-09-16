import type { RoomMetrics } from './metrics.ts';

export interface LiveRoom {
  readonly roomId: string;
  readonly code: string;
  readonly metrics: RoomMetrics;
}

/** Tracks rooms live in this process only; each deployment runs a single process. */
class LiveRoomRegistry {
  private readonly rooms = new Map<string, LiveRoom>();
  register(room: LiveRoom) { this.rooms.set(room.roomId, room); }
  remove(roomId: string) { this.rooms.delete(roomId); }
  snapshot() {
    return [...this.rooms.values()].map(room => ({ roomId: room.roomId, code: room.code, ...room.metrics.snapshot() }));
  }
  get size() { return this.rooms.size; }
}
export const liveRooms = new LiveRoomRegistry();
