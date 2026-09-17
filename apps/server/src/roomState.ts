import { schema, t, type SchemaType } from '@colyseus/schema';

/** Each DTO is a separately patched entity; static scenery never travels over the wire. */
export const RoomState = schema({
  phase: t.string(), worldVersion: t.string(), serverTimeMs: t.number(),
  players: t.map('string'), vehicles: t.map('string'),
}, 'KeralaRoomState');
export type RoomState = SchemaType<typeof RoomState>;
