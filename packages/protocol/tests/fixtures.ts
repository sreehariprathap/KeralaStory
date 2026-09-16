import { z } from 'zod';
import { ClientMessageSchema, MAX_CHAT_GRAPHEMES } from '../src/index.ts';
import type { ServerEventDto } from '../src/index.ts';

type ClientMessageDto = z.infer<typeof ClientMessageSchema>;

const guest = 'guest_maya1234';
const secondGuest = 'guest_arjun5678';
const appearance = {
  avatarPresetId: 'canopy' as const,
  characterModelId: 'uniform' as const,
  colors: { skin: '#dba77e' as const, hair: '#292a25' as const, clothing: '#285943' as const },
};

export const maximumChatMessage = 'ക'.repeat(MAX_CHAT_GRAPHEMES);

export const validClientMessages: ReadonlyArray<readonly [string, ClientMessageDto]> = [
  ['input', { type: 'input', payload: { sequence: 42, moveX: -1, moveZ: 0.5, actions: ['jump', 'interact'] } }],
  ['enterVehicle with seat', { type: 'enterVehicle', payload: { vehicleId: 'ferry-jeep', preferredSeat: 'rearLeft' } }],
  ['exitVehicle', { type: 'exitVehicle', payload: {} }],
  ['chatSend with maximum Unicode message', { type: 'chatSend', payload: { text: maximumChatMessage } }],
  ['ready', { type: 'ready', payload: { worldVersion: 'kerala-2000s-v1' } }],
  ['leave', { type: 'leave', payload: {} }],
  ['ping', { type: 'ping', payload: { clientTimeMs: 1_728_000_000_000 } }],
];

const player = {
  id: guest,
  displayName: 'മായ 🌴',
  appearance,
  transform: { position: [12.5, 1, -24] as [number, number, number], headingRad: Math.PI / 2, velocity: [0, 0, 0] as [number, number, number] },
  travel: { kind: 'vehicle' as const, vehicleId: 'ferry-jeep', seatId: 'driver' as const },
  connected: true,
  lastProcessedInput: 42,
};

const vehicle = {
  id: 'ferry-jeep',
  kind: 'car' as const,
  modelId: 'ks-jeep-a',
  transform: {
    position: [12.5, 1, -24] as [number, number, number],
    rotation: [0, 0.707106, 0, 0.707106] as [number, number, number, number],
    linearVelocity: [0, 0, 0] as [number, number, number],
    angularVelocity: [0, 0, 0] as [number, number, number],
  },
  controls: { driverId: guest, throttle: 0, steering: 0, brake: false, nitro: false },
  seats: { driver: guest, rearLeft: secondGuest },
};

export const fullRoomSnapshot = {
  phase: 'playing' as const,
  worldVersion: 'kerala-2000s-v1',
  players: [player],
  vehicles: [vehicle],
  roster: [{ id: guest, displayName: 'മായ 🌴', connected: true }, { id: secondGuest, displayName: 'Arjun', connected: false }],
  serverTimeMs: 1_728_000_000_123,
};

export const validServerEvents: ReadonlyArray<readonly [string, ServerEventDto]> = [
  ['roomSnapshot with seats and transforms', { type: 'roomSnapshot', payload: fullRoomSnapshot }],
  ['chatAccepted with Unicode sender', { type: 'chatAccepted', payload: { id: 7, senderId: guest, senderName: 'മായ 🌴', text: 'നമസ്കാരം കൂട്ടുകാരേ', sentAtMs: 1_728_000_000_123 } }],
  ['roomError', { type: 'roomError', payload: { code: 'ROOM_FULL', message: 'Room is full' } }],
];

export const invalidClientMessages: ReadonlyArray<readonly [string, string, unknown, string]> = [
  ['input axis', 'payload.moveX', { type: 'input', payload: { sequence: 1, moveX: 1.01, moveZ: 0, actions: [] } }, 'Too big'],
  ['input action', 'payload.actions.0', { type: 'input', payload: { sequence: 1, moveX: 0, moveZ: 0, actions: ['teleport'] } }, 'Invalid option'],
  ['chat control character', 'payload.text', { type: 'chatSend', payload: { text: 'hello\u0000' } }, 'unsupported'],
  ['enter vehicle id', 'payload.vehicleId', { type: 'enterVehicle', payload: { vehicleId: 'Bad Vehicle' } }, 'Invalid string'],
  ['ready world version', 'payload.worldVersion', { type: 'ready', payload: { worldVersion: '' } }, 'Too small'],
];

export const invalidServerEvents: ReadonlyArray<readonly [string, string, unknown, string]> = [
  ['snapshot transform', 'payload.players.0.transform.position.0', { type: 'roomSnapshot', payload: { ...fullRoomSnapshot, players: [{ ...player, transform: { ...player.transform, position: [Number.NaN, 0, 0] } }] } }, 'Invalid input'],
  ['snapshot seat id', 'payload.players.0.travel.seatId', { type: 'roomSnapshot', payload: { ...fullRoomSnapshot, players: [{ ...player, travel: { kind: 'vehicle', vehicleId: 'ferry-jeep', seatId: 'captain' } }] } }, 'Invalid option'],
  ['error code', 'payload.code', { type: 'roomError', payload: { code: 'NOT_A_CODE', message: 'Bad request' } }, 'Invalid option'],
  ['chat message id', 'payload.id', { type: 'chatAccepted', payload: { id: -1, senderId: guest, senderName: 'Maya', text: 'hello', sentAtMs: 1 } }, 'Too small'],
];
