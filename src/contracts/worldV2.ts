import type { MapBounds, Vec3, ZoneId } from './index';
import type { PolygonXZ } from './worldExpansion';

export type TownId = 'chalakkudy' | 'kodakara' | 'kodaly' | 'malakkappara';
export interface TownSite {
  id: TownId;
  label: string;
  tier: 'A' | 'B' | 'C';
  regionId: ZoneId;
  footprint: PolygonXZ;
  center: Vec3;
  existing: boolean;
  /** Further districts of the same town: levelled to `y` when given, otherwise town area only (zone and map). */
  districts?: readonly { id: string; label: string; footprint: PolygonXZ; y?: number }[];
}
export interface RiverNode {
  id: string;
  position: Vec3;
  kind: 'source' | 'join' | 'lip' | 'basin' | 'fork' | 'outlet';
}
export interface RiverReach {
  id: string;
  label: string;
  from: string;
  to: string;
  kind: 'channel' | 'waterfall' | 'pool';
  /** Surface-center samples in meters, ordered downstream. Widths align one-to-one. */
  points: readonly Vec3[];
  widthsM: readonly number[];
}
export interface RoadProposal {
  id: string;
  label: string;
  /** Control points only: V2-02 must round bends and construct matching terrain. */
  points: readonly Vec3[];
  widthM: number;
}
export interface WorldV2Layout {
  status: 'layout-approved';
  bounds: MapBounds;
  towns: readonly TownSite[];
  riverNodes: readonly RiverNode[];
  riverReaches: readonly RiverReach[];
  roads: readonly RoadProposal[];
  park: { id: 'silver-storm'; label: string; footprint: PolygonXZ; center: Vec3; poolFootprint: PolygonXZ };
  /** Heights are design targets until shared terrain/collision is built. Not safe spawns. */
  reviewNotes: readonly string[];
}
