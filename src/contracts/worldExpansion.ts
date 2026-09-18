import type { Landmark, MapBounds, TravelMode, Vec3, ZoneId } from './index';

export type AreaId = 'kodassery-summit' | 'chokkana' | 'athirappilly';
export type PolygonXZ = readonly (readonly [number, number])[];
export interface ExpansionArea { id: AreaId; zoneId: ZoneId; footprint: PolygonXZ; labelPosition: readonly [number, number] }
/** `surface` defaults to paved; `dirt` routes are unsealed tracks (graded earth, no lane paint). */
export interface ExpansionRoute { id: string; points: readonly Vec3[]; widthM: number; shoulderM: number; allowedModes: readonly TravelMode[]; surface?: 'paved' | 'dirt' }
export interface ExpansionAnchor { id: string; areaId: AreaId; position: Vec3; discoveryRadiusM: number; iconId: Landmark['iconId'] }
export interface ExpansionWater { id: string; footprint: PolygonXZ; surfaceY: number; kind: 'river' | 'pool' }
export interface ExpansionLayout {
  bounds: MapBounds; areas: readonly ExpansionArea[]; routes: readonly ExpansionRoute[];
  anchors: readonly ExpansionAnchor[]; waterBodies: readonly ExpansionWater[];
  summitPosition: Vec3; panoramaTargets: readonly Vec3[];
}
