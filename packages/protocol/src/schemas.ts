import { z } from 'zod';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants.ts';
import { sanitizeDisplayName, sanitizePlainText } from './text.ts';

const finite = z.number().finite();
export const Vec3Schema = z.tuple([finite, finite, finite]);
export const QuatSchema = z.tuple([finite, finite, finite, finite]);
export const GuestIdSchema = z.string().regex(/^guest_[A-Za-z0-9_-]{8,80}$/);
export const VehicleIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const RoomCodeSchema = z.string().regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));
export const RoomPhaseSchema = z.enum(['waiting', 'playing', 'closing']);
export const SeatIdSchema = z.enum(['driver', 'frontPassenger', 'rearLeft', 'rearRight', 'rider', 'passenger']);
export const AvatarAppearanceSchema = z.object({
  avatarPresetId: z.enum(['canopy', 'clay', 'river']),
  characterModelId: z.enum(['nick', 'little-girl', 'kid-boy', 'cartoon-kid', 'teenage-boy', 'messi', 'spidey', 'mask-player', 'lungi-raja', 'straw-hat']).optional(),
  colors: z.object({
    skin: z.enum(['#ba805b', '#dba77e', '#8e5e43']),
    hair: z.enum(['#292a25', '#4b3329', '#242d35']),
    clothing: z.enum(['#285943', '#a35a40', '#446d84']),
  }),
}).strict();
function plainTextSchema(sanitize: (value: string) => string) {
  return z.string().superRefine((value, context) => {
    try {
      sanitize(value);
    } catch (error) {
      context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Text is invalid' });
    }
  }).transform(value => sanitize(value));
}
export const DisplayNameSchema = plainTextSchema(sanitizeDisplayName);
export const ChatTextSchema = plainTextSchema(value => sanitizePlainText(value));
export const InputActionSchema = z.enum(['jump', 'interact', 'brake', 'nitro']);
export const InputSchema = z.object({
  sequence: z.number().int().min(0).max(2_147_483_647),
  moveX: z.number().finite().min(-1).max(1),
  moveZ: z.number().finite().min(-1).max(1),
  actions: z.array(InputActionSchema).max(4),
}).strict();
export const EnterVehicleSchema = z.object({ vehicleId: VehicleIdSchema, preferredSeat: SeatIdSchema.optional() }).strict();
export const ExitVehicleSchema = z.object({}).strict();
/** Launch is only accepted on foot inside the summit launch circle; the server checks that. */
export const LaunchGliderSchema = z.object({}).strict();
export const ChatSendSchema = z.object({ text: ChatTextSchema }).strict();
export const ReadySchema = z.object({ worldVersion: z.string().min(1).max(80) }).strict();
export const LeaveSchema = z.object({}).strict();
export const PingSchema = z.object({ clientTimeMs: z.number().finite().nonnegative() }).strict();
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('input'), payload: InputSchema }).strict(),
  z.object({ type: z.literal('enterVehicle'), payload: EnterVehicleSchema }).strict(),
  z.object({ type: z.literal('exitVehicle'), payload: ExitVehicleSchema }).strict(),
  z.object({ type: z.literal('launchGlider'), payload: LaunchGliderSchema }).strict(),
  z.object({ type: z.literal('chatSend'), payload: ChatSendSchema }).strict(),
  z.object({ type: z.literal('ready'), payload: ReadySchema }).strict(),
  z.object({ type: z.literal('leave'), payload: LeaveSchema }).strict(),
  z.object({ type: z.literal('ping'), payload: PingSchema }).strict(),
]);
