import type { CarModelId } from './models';

export interface VehicleWheel { x: number; y: number; z: number; radius: number; nodes: readonly string[] }
export interface MaterialLook { color: string; metalness?: number; roughness?: number; opacity?: number; emissive?: string }
export interface VehicleProfile {
  length: number;
  legacyBoundsCap?: boolean;
  chassis: { x: number; y: number; z: number; offset: number };
  wheels: readonly VehicleWheel[];
  /** Metres per second before nitro; defaults to DEFAULT_TOP_SPEED. */
  topSpeed?: number;
  /** Source nodes that are not part of the vehicle (e.g. an exported floor); removed before measuring. */
  hiddenNodes?: readonly string[];
  /** Source material names recoloured by the player's chosen paint. */
  paint?: { materials: readonly string[]; defaultColor: string };
  /** Replacement looks for source materials, keyed by material name; `*` applies to any other material. */
  materialOverrides?: Readonly<Record<string, MaterialLook>>;
}
export const CAR_PAINT_COLORS = [
  { id: 'red', label: 'Red', value: '#b3121f' },
  { id: 'white', label: 'White', value: '#eef0f2' },
  { id: 'black', label: 'Black', value: '#16181c' },
  { id: 'blue', label: 'Blue', value: '#1f4fa8' },
  { id: 'yellow', label: 'Yellow', value: '#e7b416' },
  { id: 'silver', label: 'Silver', value: '#a7adb4' },
] as const;
const TRIM: MaterialLook = { color: '#202226', metalness: .2, roughness: .7 };
const GLASS: MaterialLook = { color: '#1b2a36', metalness: .6, roughness: .08, opacity: .82 };
const wheel = (x: number, y: number, z: number, radius: number, ...nodes: string[]): VehicleWheel => ({ x, y, z, radius, nodes });
/** Measured from transformed GLB mesh bounds. +Z forward, front-right/front-left first. */
export const VEHICLE_PROFILES: Record<CarModelId, VehicleProfile> = {
  admin: { length: 3.8, legacyBoundsCap: true, chassis: { x: .65, y: .52, z: 1.35, offset: .26 }, wheels: [
    wheel(.771,.274,1.022,.274,'Front_wheel_Black_0','Front_wheel_Light_black_0'),
    wheel(-.771,.274,1.022,.274,'Front_wheel001_Black_0','Front_wheel001_Light_black_0'),
    wheel(.771,.302,-.534,.302,'Rear_wheel_Black_0','Rear_wheel_Light_black_0'),
    wheel(-.771,.302,-.534,.302,'Rear_wheel001_Black_0','Rear_wheel001_Light_black_0'),
  ] },
  muscle: { length: 3.8, legacyBoundsCap: true, chassis: { x: .78, y: .34, z: 1.72, offset: -.02 }, wheels: [
    wheel(.65,.258,1.095,.258,'Object_21','Object_22','Object_23'), wheel(-.65,.258,1.095,.258,'Object_13','Object_14','Object_15'),
    wheel(.65,.288,-1.059,.258,'Object_17','Object_18','Object_19'), wheel(-.65,.288,-1.059,.258,'Object_25','Object_26','Object_27'),
  ] },
  'car-carton': { length: 3.2, chassis: { x: .78, y: .46, z: 1.42, offset: .05 }, wheels: [
    wheel(.80772,.21624,1.12658,.21624,'Object_17'), wheel(-.80772,.21624,1.12658,.21624,'Object_19'),
    wheel(.80772,.21624,-.90767,.21624,'Object_21'), wheel(-.80772,.21624,-.90767,.21624,'Object_23'),
  ] },
  fennec: { length: 4, chassis: { x: .85, y: .38, z: 1.75, offset: -.03 }, wheels: [
    wheel(.85202,.35513,1.17043,.35513,'Alpha_-_FR_(Fennec)_Alpha_Rim_0','Alpha_-_FR_(Fennec)_Dieci_Tread_0'),
    wheel(-.83020,.35513,1.17587,.35513,'Alpha_-_FL_(Fennec)_Alpha_Rim_0','Alpha_-_FL_(Fennec)_Dieci_Tread_0'),
    wheel(.86343,.38638,-1.25729,.38267,'Alpha_-_BR_(Fennec)_Alpha_Rim_0','Alpha_-_BR_(Fennec)_Dieci_Tread_0'),
    wheel(-.86343,.38638,-1.25970,.38267,'Alpha_-_BL_(Fennec)_Alpha_Rim_0','Alpha_-_BL_(Fennec)_Dieci_Tread_0'),
  ] },
  // Belly boxes for estimated profiles keep their underside >= 0.43 m, like the hand-tuned cars, so they never scrape.
  bronco: { length: 4.5, chassis: { x: 1.1719, y: .785, z: 1.9688, offset: .445 }, wheels: [
    wheel(1.0445,.42,1.65,.42), wheel(-1.0445,.42,1.65,.42),
    wheel(1.0445,.42,-1.5,.42), wheel(-1.0445,.42,-1.5,.42),
  ] },
  'mazda-rx7': { length: 4.3, chassis: { x: .9716, y: .375, z: 1.8813, offset: -.035 },
    hiddenNodes: ['Floor'],
    // The source ships every material as flat unlit black; these looks were mapped from a per-mesh render.
    paint: { materials: ['02_-_Default', 'Material_9'], defaultColor: CAR_PAINT_COLORS[0].value },
    materialOverrides: {
      Material_3: GLASS,
      Material_4: { ...GLASS, color: '#3d5566' },
      Material_5: { ...GLASS, color: '#4e6878' },
      Material_7: { color: '#141414', roughness: .95 },
      Material_14: { color: '#f4f1e0', emissive: '#6b6650', roughness: .3 },
      Material_17: { color: '#8a0f16', emissive: '#3a0508', roughness: .4 },
      '*': TRIM,
    },
    wheels: [
    wheel(.866,.22,1.65,.22), wheel(-.866,.22,1.65,.22),
    wheel(.866,.22,-1.5,.22), wheel(-.866,.22,-1.5,.22),
  ] },
  cyberpunk: { length: 4.5, chassis: { x: 1.2387, y: .6225, z: 1.9688, offset: .2525 }, topSpeed: 14, wheels: [
    wheel(0.8024,0.4424,1.2636,0.4198,"��������������_����������������3_0"),
    wheel(-0.8024,0.4424,1.2636,0.4198,"��������������_1_����������������3_0"),
    wheel(0.8024,0.4424,-1.4536,0.4198,"��������������_2_����������������3_0"),
    wheel(-0.8024,0.4424,-1.4536,0.4198,"��������������_1_2_����������������3_0"),
  ] },
};
