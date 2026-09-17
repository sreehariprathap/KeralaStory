import { describe, expect, it } from 'vitest';
import {
  ChatSendSchema,
  ChatMessageSchema,
  CLIENT_EVENT_TYPES,
  ClientMessageSchema,
  InputSchema,
  RoomCodeSchema,
  RoomErrorCodeSchema,
  TravelSchema,
  ServerEventSchema,
  createRoomCode,
  normalizeRoomCode,
  sanitizePlainText,
} from '../src/index.ts';

describe('multiplayer protocol schemas', () => {
  it('normalizes only unambiguous eight-character room codes', () => {
    expect(normalizeRoomCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(RoomCodeSchema.safeParse('ABCD1234').success).toBe(false);
    expect(() => normalizeRoomCode('ABCD12345')).toThrow('eight');
    expect(createRoomCode(() => 0)).toBe('AAAAAAAA');
  });

  it('rejects hostile or impossible input packets', () => {
    expect(InputSchema.safeParse({ sequence: 8, moveX: 1.01, moveZ: 0, actions: [] }).success).toBe(false);
    expect(InputSchema.safeParse({ sequence: 8, moveX: 0, moveZ: 0, actions: ['teleport'] }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: 'unknown', payload: {} }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: 'input', payload: { sequence: 8, moveX: 0, moveZ: 0, actions: [] }, unexpected: true }).success).toBe(false);
  });

  it('accepts bounded Malayalam chat and rejects control or bidi characters', () => {
    const text = 'കേരളം'.repeat(46) + '!' ;
    expect(Array.from(text).length).toBeLessThan(280);
    expect(ChatSendSchema.safeParse({ text }).success).toBe(true);
    expect(ChatSendSchema.safeParse({ text: 'hello\u0000' }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: 'hello\u202E' }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: '<script>alert(1)</script>' }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: 'visit https://example.test' }).success).toBe(false);
    expect(sanitizePlainText('  നല്ല ദിവസം  ')).toBe('നല്ല ദിവസം');
  });

  it('replicates gliding as a travel kind with no extra fields', () => {
    expect(TravelSchema.safeParse({ kind: 'glider' }).success).toBe(true);
    expect(TravelSchema.safeParse({ kind: 'glider', altitude: 40 }).success).toBe(false);
    expect(RoomErrorCodeSchema.safeParse('GLIDER_DENIED').success).toBe(true);
  });

  it('rejects malformed server events before they reach a renderer', () => {
    expect(ServerEventSchema.safeParse({ type: 'roomError', payload: { code: 'ROOM_FULL', message: 'Room is full' } }).success).toBe(true);
    expect(ServerEventSchema.safeParse({ type: 'chatAccepted', payload: { id: -1 } }).success).toBe(false);
    expect(ServerEventSchema.safeParse({ type: 'roomSnapshot', payload: { phase: 'playing' } }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ id: 1, senderId: 'guest_abcdefgh', senderName: '<b>Maya</b>', text: 'hello', sentAtMs: 1 }).success).toBe(false);
    expect(CLIENT_EVENT_TYPES).toEqual(['input', 'enterVehicle', 'exitVehicle', 'launchGlider', 'chatSend', 'ready', 'leave', 'ping']);
  });
});
