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
  colors: z.object({ skin: z.enum(SKIN_COLORS), hair: z.enum(HAIR_COLORS), clothing: z.enum(CLOTHING_COLORS) }),
});
export type ExplorerProfile = z.infer<typeof ProfileSchema>;
export const SettingsSchema = z.object({
  quality: z.enum(['low', 'medium', 'high']), muted: z.boolean(), volume: z.number().min(0).max(1),
  reducedMotion: z.boolean(), sensitivity: z.number().min(0.3).max(2),
});
export type GameSettings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: GameSettings = { quality: 'medium', muted: false, volume: 0.5, reducedMotion: false, sensitivity: 1 };
export const SaveSchema = z.object({
  version: z.literal(1), worldVersion: z.string().min(1), profile: ProfileSchema,
  position: Vec3Schema, headingRad: z.number().finite(), safeSpawnId: z.string().min(1),
  visitedLandmarkIds: z.array(z.string()).max(500), settings: SettingsSchema, updatedAt: z.string().datetime(),
});
export type SaveV1 = z.infer<typeof SaveSchema>;
export interface PlayerSnapshot { position: Vec3; headingRad: number; speed: number; grounded: boolean }
export interface Landmark { id: string; zoneId: ZoneId; label: string; position: Vec3; discoveryRadiusM: number; iconId: string; description: string }
export interface MapBounds { xMin: number; xMax: number; zMin: number; zMax: number }
export interface ExplorerControllerProps {
  mode: InputMode; profile: ExplorerProfile; spawn: Vec3; initialHeading?: number; resetToken: number;
  sensitivity: number; reducedMotion: boolean;
  onSnapshot: (snapshot: PlayerSnapshot) => void; onPause: () => void; onMap: () => void;
  onReady?: () => void;
}
