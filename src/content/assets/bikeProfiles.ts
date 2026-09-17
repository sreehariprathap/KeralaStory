export interface BicycleTuning {
  /** Cruise cap in m/s before nitro. */
  topSpeed: number;
  /** m/s gained per second under full throttle. */
  acceleration: number;
  /** m/s shed per second while braking; defaults to 7. */
  brake?: number;
  /** Hold SHIFT while riding. Reuses the car nitro timing (burn, then cooldown). */
  nitro?: { extraSpeed: number; accelerationMultiplier: number };
}

export interface BikeModel {
  id: string;
  name: string;
  /** GLB source; omitted for the procedural roadster. */
  url?: string;
  /** Yaw in radians so the model faces +Z (forward). Tune if a bike renders sideways or backwards. */
  rotationY: number;
  /** Target length in metres after scaling. */
  length: number;
  /** Distance from the bike's centre to each tyre's ground contact, in metres; used to lay the bike on slopes. */
  halfWheelbase: number;
  /**
   * Seat surface in the scaled bike's space, in metres: `height` above the ground, `z` forward (+) or back (-)
   * of the bike's centre. The rider's own hip height is measured at runtime, so any character sits on it.
   */
  seat: { height: number; z: number };
  /** Rider pose: `lean` tips the torso forward from the hips (radians) so hands reach low bars; `pedals: false` stops pedalling. */
  rider?: { lean?: number; pedals?: boolean };
  /** Source nodes to drop before measuring (e.g. a kickstand that reaches below the tyres). */
  hiddenNodes?: readonly string[];
  tuning: BicycleTuning;
}

export const BIKE_MODELS = [
  { id: 'roadster', name: 'Roadster bicycle', rotationY: 0, length: 1.9, halfWheelbase: .62, seat: { height: 1.08, z: -.3 },
    tuning: { topSpeed: 9, acceleration: 3 } },
  { id: 'electric', name: 'Electric bike', url: '/assets/bike/electric_bike_v_2.30.glb', rotationY: Math.PI / 2, length: 1.9, halfWheelbase: .56, seat: { height: .98, z: -.24 },
    tuning: { topSpeed: 14, acceleration: 6, brake: 9, nitro: { extraSpeed: 6, accelerationMultiplier: 1.8 } } },
  { id: 'yamaha', name: 'Yamaha FZ8', url: '/assets/bike/yamaha_bike.glb', rotationY: 0, length: 2.2, halfWheelbase: .78, seat: { height: .79, z: -.29 }, hiddenNodes: ['Cylinder266_758'], rider: { lean: .45, pedals: false },
    tuning: { topSpeed: 20, acceleration: 9, brake: 12, nitro: { extraSpeed: 10, accelerationMultiplier: 2 } } },
  { id: 'cyberpunk-bike', name: 'Cyberpunk bike', url: '/assets/bike/cyberpunk_bike.glb', rotationY: 0, length: 2.3, halfWheelbase: .86, seat: { height: .79, z: -.43 }, rider: { lean: .55, pedals: false },
    tuning: { topSpeed: 24, acceleration: 22, brake: 16, nitro: { extraSpeed: 16, accelerationMultiplier: 2.5 } } },
  { id: 'sports-bike', name: 'Sports bike', url: '/assets/bike/sports_bike.glb', rotationY: 0, length: 2.1, halfWheelbase: .72, seat: { height: .84, z: -.3 }, rider: { lean: .6, pedals: false },
    tuning: { topSpeed: 22, acceleration: 14, brake: 14, nitro: { extraSpeed: 12, accelerationMultiplier: 2.2 } } },
] as const satisfies readonly BikeModel[];

export type BikeModelId = typeof BIKE_MODELS[number]['id'];

export function bikeModel(id: BikeModelId | undefined): BikeModel {
  return BIKE_MODELS.find(model => model.id === id) ?? BIKE_MODELS[0];
}

export const BIKE_PICKER_CATALOG = BIKE_MODELS.map(model => ({ id: model.id, name: model.name, available: true as const, reason: '' }));
