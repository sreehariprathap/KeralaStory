export interface V2AssetProfile {
  id: string;
  label: string;
  url: string;
  /** Yaw in radians, applied before auto-grounding/scaling. Positive turns the model counter-clockwise when viewed from above. */
  rotationY: number;
  sizeAxis: 'x' | 'y' | 'z';
  sizeM: number;
  /** Manual vertical nudge in metres, applied after auto-grounding. Positive raises the model, negative sinks it into the ground. */
  groundOffsetM?: number;
  /** Manual horizontal nudge in metres, applied after auto-centering. +X is world-east/right, +Z is world-south. */
  offsetXM?: number;
  offsetZM?: number;
  /** Additive HSL saturation delta applied to every material's color, e.g. 0.2 = +20 saturation points. */
  saturationBoost?: number;
  /** Additive HSL lightness delta applied to every material's color, e.g. 0.1 = +10 lightness points. */
  lightnessBoost?: number;
  /** Exact loader-sanitized nodes; a missing selector is an error. */
  removeNodes: readonly string[];
  removePatterns?: readonly RegExp[];
  note: string;
  batchStatic?: boolean;
}

/** Metre-space coarse collision measured after the 5.6 m coffee extraction; interior stays closed. */
export const COFFEE_COLLISION_PROFILE = {
  floorSize: [8.86, .60, 9.16],
  shellPosition: [-1.30, 2.53, -2.28],
  shellSize: [6.26, 3.94, 4.60],
} as const;

/** Review targets, not approved collision dimensions or production-ready assets. */
export const V2_ASSET_PROFILES: readonly V2AssetProfile[] = [
  { id: 'coffee-shop', label: 'Chalakkudy coffee shop', url: '/assets/buildings/coffee_shop_isometric.glb', rotationY: 0, sizeAxis: 'y', sizeM: 5.6, removeNodes: ['Plane003_61'], note: 'Presentation plane removed; structural floor retained. Exterior furniture remains for this first review.' },
  { id: 'fuel-station', label: 'Roadside fuel station', url: '/assets/buildings/low_poly_fuel_station.glb', rotationY: 0, sizeAxis: 'y', sizeM: 5.2, removeNodes: ['Plane', 'Car003', 'Car001', 'WindowFront007', 'Text', 'Text001', 'Plane017', 'Plane018'], note: 'Presentation asphalt, cars, dense text and boundary fences removed. Simple local fuel signage will replace the text at placement; collision pending.' },
  { id: 'silver-storm', batchStatic: true, label: 'Silver Storm source park', url: '/park/amusement_park.glb', rotationY: 30, sizeAxis: 'x', sizeM: 90, groundOffsetM: -4.5, offsetXM: 15, offsetZM: 4, saturationBoost: .45, lightnessBoost: .08, removeNodes: ['CubeNavigationCollider', 'SC_COL_CityRoadMod01_floor_005_081', 'SC_COL_CityRoadMod01_floor_005_186', 'SC_COL_CityRoadMod01_floor_005_189', 'SC_COL_CityRoadMod01_floor_005_190', 'SC_COL_CityRoadMod01_floor_005_191', 'monster1__3_'], removePatterns: [/^NavCollider__/, /^camera__[124]_$/, /LootTrail|LiveFormStats/, /^sign_xxx/], note: 'Exported navigation/camera geometry and deep boundary skirts removed, including a floor collider (_186) that reached 32m below the visible plaza and was dragging the whole park upward off the ground on auto-grounding. Source-game health/loot markers, a buried monster prop and the adult sign removed; static meshes batched by material. Other props and foundations still require visual approval; pool is separate.' },
  { id: 'bronco', label: 'Bronco', url: '/assets/cars/bronco.glb', rotationY: -Math.PI / 2, sizeAxis: 'z', sizeM: 4.4, removeNodes: [], note: 'Source colors restored. Body-only paint and moving tires require mesh separation; neither is implemented yet.' },
  { id: 'car-carton', label: 'Cartoon car', url: '/assets/cars/car_carton.glb', rotationY: 0, sizeAxis: 'z', sizeM: 3.8, removeNodes: [], note: 'Static size review. Wheel animation and driving integration follow later.' },
  { id: 'car', label: 'Car — rigged source', url: '/assets/cars/car.glb', rotationY: 0, sizeAxis: 'z', sizeM: 3.8, removeNodes: [], note: 'Tall source bounds need visual review before fixing vehicle axes and collision.' },
  { id: 'fennec', label: 'Fennec', url: '/assets/cars/fennec_-_rocket_league_car.glb', rotationY: -Math.PI / 2, sizeAxis: 'z', sizeM: 4, removeNodes: [], note: 'Static size review. Wheel mapping and driving integration follow later.' },
];
