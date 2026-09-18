import { z } from 'zod';

export const ZoneIdSchema = z.enum(['kodassery', 'kadambode', 'kurumali', 'kodaly']);
export type ZoneId = z.infer<typeof ZoneIdSchema>;
export const Vec3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export type Vec3 = z.infer<typeof Vec3Schema>;
export type InputMode = 'menu' | 'playing' | 'map' | 'paused' | 'loading';
export const SKIN_COLORS = ['#ba805b', '#dba77e', '#8e5e43'] as const;
export const HAIR_COLORS = ['#292a25', '#4b3329', '#242d35'] as const;
export const CLOTHING_COLORS = ['#285943', '#a35a40', '#446d84'] as const;
export const AVATAR_PRESETS = [
  { id: 'canopy', name: 'Canopy wanderer', description: 'Forest green & warm linen', clothing: '#285943' },
  { id: 'clay', name: 'Earthbound traveler', description: 'Terracotta & sunwashed cotton', clothing: '#a35a40' },
  { id: 'river', name: 'River rambler', description: 'River blue & soft ivory', clothing: '#446d84' },
] as const;
export const ProfileSchema = z.object({
  id: z.string().min(1).max(80),
  displayName: z.string().trim().refine(s => Array.from(s).length >= 1 && Array.from(s).length <= 24, 'Use 1–24 characters').refine(s => !/[<>\u0000-\u001f]/.test(s), 'Use a plain-text name'),
  avatarPresetId: z.enum(['canopy', 'clay', 'river']),
  characterModelId: z.enum(['nick', 'little-girl', 'kid-boy', 'cartoon-kid', 'teenage-boy', 'messi', 'mask-player', 'straw-hat']).optional(),
  colors: z.object({ skin: z.enum(SKIN_COLORS), hair: z.enum(HAIR_COLORS), clothing: z.enum(CLOTHING_COLORS) }),
});
export type ExplorerProfile = z.infer<typeof ProfileSchema>;
export const CameraControlSchema = z.enum(['auto', 'mouse']);
export type CameraControl = z.infer<typeof CameraControlSchema>;
export const SettingsSchema = z.object({
  quality: z.enum(['low', 'medium', 'high']), muted: z.boolean(), volume: z.number().min(0).max(1),
  reducedMotion: z.boolean(), sensitivity: z.number().min(0.3).max(2),
  // .default() keeps older saves, which predate this setting, parsing successfully.
  cameraControl: CameraControlSchema.default('auto'),
  touchOpacity: z.number().min(0.2).max(1).default(0.75),
});
export type GameSettings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: GameSettings = { quality: 'medium', muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1, cameraControl: 'auto', touchOpacity: 0.75 };
export const SaveSchema = z.object({
  version: z.literal(1), worldVersion: z.string().min(1), profile: ProfileSchema,
  position: Vec3Schema, headingRad: z.number().finite(), safeSpawnId: z.string().min(1),
  visitedLandmarkIds: z.array(z.string()).max(500), settings: SettingsSchema, updatedAt: z.string().datetime(),
});
export type SaveV1 = z.infer<typeof SaveSchema>;
export interface PlayerSnapshot { position: Vec3; headingRad: number; speed: number; grounded: boolean; travelMode?: TravelMode; sprintLocked?: boolean; canInteract?: boolean; bicycle?: BicycleSave; interactionMessage?: string; nitroActive?: boolean; nitroRemaining?: number; nitroAvailable?: boolean; gliderAvailable?: boolean; soccerAvailable?: boolean; altitude?: number; climbing?: boolean }
export interface Landmark { id: string; zoneId: ZoneId; label: string; position: Vec3; discoveryRadiusM: number; iconId: string; description: string }
export interface MapBounds { xMin: number; xMax: number; zMin: number; zMax: number }
export interface ExplorerControllerProps {
  mode: InputMode; profile: ExplorerProfile; spawn: Vec3; initialHeading?: number; resetToken: number;
  sensitivity: number; reducedMotion: boolean; cameraControl: CameraControl;
  onSnapshot: (snapshot: PlayerSnapshot) => void; onPause: () => void; onMap: () => void;
  onReady?: () => void;
  onError?: (message:string) => void;
  inputCommands?: (commands: import("./input").InputCommands | null) => void;
  bicycleSpawn?: BicycleSave | null;
  returnBicycleToken?: number;
  carSpawnToken?: number;
  carModelId?: import('../content/assets/models').CarModelId;
  carColor?: string;
  bikeSpawnToken?: number;
  bikeModelId?: import('../content/assets/bikeProfiles').BikeModelId;
  gliderLaunchToken?: number;
  onCarSpawnResult?: (result: { ok: boolean; message: string }) => void;
}

export const LocaleSchema = z.enum(['en', 'ml']);
export type Locale = z.infer<typeof LocaleSchema>;
export const ControlsPreferenceSchema = z.enum(['auto', 'touch', 'desktop']);
export type ControlsPreference = z.infer<typeof ControlsPreferenceSchema>;
export const PreferencesSchema = z.object({ locale: LocaleSchema.default('en'), controls: ControlsPreferenceSchema.default('auto'), haptics: z.boolean().default(true) });
export type Preferences = z.infer<typeof PreferencesSchema>;
export type TravelMode = 'foot' | 'bicycle' | 'car' | 'glider';
export const BicycleSaveSchema = z.object({ position: Vec3Schema, headingRad: z.number().finite() });
export type BicycleSave = z.infer<typeof BicycleSaveSchema>;
export const SaveV2Schema = SaveSchema.extend({ version: z.literal(2), locale: LocaleSchema, bicycle: BicycleSaveSchema.nullable() });
export type SaveV2 = z.infer<typeof SaveV2Schema>;
export const CollectSaveSchema = z.object({
  coins: z.number().int().min(0), dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), collectedIds: z.array(z.string()).max(400),
});
export type CollectSave = z.infer<typeof CollectSaveSchema>;
export const SaveV3Schema = SaveV2Schema.extend({ version: z.literal(3), collect: CollectSaveSchema });
export type SaveV3 = z.infer<typeof SaveV3Schema>;
export type LocalSave = SaveV1 | SaveV2 | SaveV3;
export type { InputCommands, InputSource, InputAction } from './input';
