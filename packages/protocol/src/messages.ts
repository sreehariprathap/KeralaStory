import { z } from 'zod';
import { MAX_ROOM_OCCUPANTS } from './constants.ts';
import { AvatarAppearanceSchema, ChatTextSchema, DisplayNameSchema, GuestIdSchema, QuatSchema, RoomPhaseSchema, SeatIdSchema, Vec3Schema, VehicleIdSchema } from './schemas.ts';

export const CLIENT_EVENT_TYPES = ['input', 'enterVehicle', 'exitVehicle', 'chatSend', 'ready', 'leave', 'ping'] as const;
export const SERVER_EVENT_TYPES = ['roomSnapshot', 'chatAccepted', 'roomError'] as const;

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Quat = z.infer<typeof QuatSchema>;
export type GuestId = z.infer<typeof GuestIdSchema>;
export type SeatId = z.infer<typeof SeatIdSchema>;
export type AvatarAppearanceDto = z.infer<typeof AvatarAppearanceSchema>;
export const TransformSchema = z.object({ position: Vec3Schema, headingRad: z.number().finite(), velocity: Vec3Schema }).strict();
export const TravelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('foot') }).strict(),
  z.object({ kind: z.literal('vehicle'), vehicleId: VehicleIdSchema, seatId: SeatIdSchema }).strict(),
]);
export const ReplicatedPlayerSchema = z.object({
  id: GuestIdSchema, displayName: DisplayNameSchema, appearance: AvatarAppearanceSchema, transform: TransformSchema,
  travel: TravelSchema, connected: z.boolean(), lastProcessedInput: z.number().int().min(0),
}).strict();
export const VehicleTransformSchema = z.object({ position: Vec3Schema, rotation: QuatSchema, linearVelocity: Vec3Schema, angularVelocity: Vec3Schema }).strict();
export const VehicleControlsSchema = z.object({ driverId: GuestIdSchema.nullable(), throttle: z.number().min(-1).max(1), steering: z.number().min(-1).max(1), brake: z.boolean(), nitro: z.boolean() }).strict();
export const SeatMapSchema = z.object({
  driver: GuestIdSchema.optional(), frontPassenger: GuestIdSchema.optional(), rearLeft: GuestIdSchema.optional(), rearRight: GuestIdSchema.optional(),
  rider: GuestIdSchema.optional(), passenger: GuestIdSchema.optional(),
}).strict();
export const ReplicatedVehicleSchema = z.object({
  id: VehicleIdSchema, kind: z.enum(['car', 'bicycle']), modelId: z.string().min(1).max(64), transform: VehicleTransformSchema,
  controls: VehicleControlsSchema, seats: SeatMapSchema,
}).strict();
export const RoomRosterEntrySchema = z.object({ id: GuestIdSchema, displayName: DisplayNameSchema, connected: z.boolean() }).strict();
export const ChatMessageSchema = z.object({ id: z.number().int().nonnegative(), senderId: GuestIdSchema, senderName: DisplayNameSchema, text: ChatTextSchema, sentAtMs: z.number().finite().nonnegative() }).strict();
export const RoomSnapshotSchema = z.object({
  phase: RoomPhaseSchema, worldVersion: z.string().min(1), players: z.array(ReplicatedPlayerSchema).max(MAX_ROOM_OCCUPANTS), vehicles: z.array(ReplicatedVehicleSchema), roster: z.array(RoomRosterEntrySchema).max(MAX_ROOM_OCCUPANTS), serverTimeMs: z.number().finite().nonnegative(),
}).strict();
export const RoomErrorCodeSchema = z.enum(['ROOM_FULL', 'ROOM_NOT_FOUND', 'WORLD_VERSION_MISMATCH', 'RECONNECT_DENIED', 'ROOM_ENDED', 'INVALID_MESSAGE', 'RATE_LIMITED', 'MUTED', 'VEHICLE_DENIED']);
export const RoomErrorSchema = z.object({ code: RoomErrorCodeSchema, message: z.string().min(1).max(160) }).strict();
export const ServerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('roomSnapshot'), payload: RoomSnapshotSchema }).strict(),
  z.object({ type: z.literal('chatAccepted'), payload: ChatMessageSchema }).strict(),
  z.object({ type: z.literal('roomError'), payload: RoomErrorSchema }).strict(),
]);
export type TransformDto = z.infer<typeof TransformSchema>;
export type TravelDto = z.infer<typeof TravelSchema>;
export type ReplicatedPlayerDto = z.infer<typeof ReplicatedPlayerSchema>;
export type VehicleTransformDto = z.infer<typeof VehicleTransformSchema>;
export type VehicleControlsDto = z.infer<typeof VehicleControlsSchema>;
export type ReplicatedVehicleDto = z.infer<typeof ReplicatedVehicleSchema>;
export type RoomRosterEntryDto = z.infer<typeof RoomRosterEntrySchema>;
export type ChatMessageDto = z.infer<typeof ChatMessageSchema>;
export type RoomSnapshotDto = z.infer<typeof RoomSnapshotSchema>;
export type RoomErrorDto = z.infer<typeof RoomErrorSchema>;
export type ServerEventDto = z.infer<typeof ServerEventSchema>;
