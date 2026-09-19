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
  /** Chase-camera distance in metres; defaults to the shared 7.6 m car framing. */
  cameraDistance?: number;
  /** Tailpipe position in metres; defaults to the shared rear position. */
  exhaust?: { x: number; y: number; z: number };
  /** Kerb mass in kilograms; defaults to CAR_MASS_KG. Principal inertia scales with it and length². */
  massKg?: number;
  /** Peak engine force in newtons before the top-of-range fade; defaults to 40000. */
  driveForce?: number;
  /** Steering lock in radians at parking speed; defaults to .55. */
  steerLock?: number;
  /** Whether nitrous is available at all; defaults to true. */
  nitro?: boolean;
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
const wheel = (x: number, y: number, z: number, radius: number, ...nodes: string[]): VehicleWheel => ({ x, y, z, radius, nodes });
/** Measured from transformed GLB mesh bounds. +Z forward, front-right/front-left first. */
export const VEHICLE_PROFILES: Record<CarModelId, VehicleProfile> = {
  admin: { length: 3.8, legacyBoundsCap: true, exhaust: { x: .5, y: .32, z: -1.5 }, chassis: { x: .65, y: .52, z: 1.35, offset: .26 }, wheels: [
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
  // Measured from the tyre meshes after the same normalization the renderer applies.
  'golf-gti': { length: 4, chassis: { x: .85, y: .45, z: 1.8, offset: .12 }, wheels: [
    wheel(.7141,.29143,1.19086,.29143), wheel(-.7141,.29143,1.19086,.29143),
    wheel(.73581,.29143,-1.28533,.29143), wheel(-.73581,.29143,-1.28533,.29143),
  ] },
  'sports-coupe': { length: 4.2, chassis: { x: 1, y: .5, z: 1.85, offset: .2 }, wheels: [
    wheel(.8993,.4803,.8091,.4803), wheel(-.8993,.4803,.8091,.4803),
    wheel(.8993,.4803,-1.1078,.4803), wheel(-.8993,.4803,-1.1078,.4803),
  ] },
  // The only new car whose corners are separate meshes, so its wheels steer and spin.
  supercar: { length: 4.4, chassis: { x: 1.05, y: .5, z: 1.95, offset: .18 }, topSpeed: 36,
    hiddenNodes: ['488_shadow_488_SHADOW_0'],
    paint: { materials: ['488_PAINT'], defaultColor: CAR_PAINT_COLORS[0].value },
    wheels: [
      wheel(.9111,.47504,1.24403,.47031,'tyre_fl_488_WHEELS_0','rim_fl_488_WHEELS_0','bdisk_fl_488_WHEELS_0','caliper_fl_488_WHEELS_0'),
      wheel(-.91111,.47504,1.24403,.47031,'tyre_fr_488_WHEELS_0','rim_fr_488_WHEELS_0','bdisk_fr_488_WHEELS_0','caliper_fr_488_WHEELS_0'),
      wheel(.9292,.47429,-1.43997,.47429,'tyre_rl_488_WHEELS_0','rim_rl_488_WHEELS_0','bdisk_rl_488_WHEELS_0','caliper_rl_488_WHEELS_0'),
      wheel(-.92922,.47429,-1.43997,.47429,'tyre_rr_488_WHEELS_0','rim_rr_488_WHEELS_0','bdisk_rr_488_WHEELS_0','caliper_rr_488_WHEELS_0'),
    ] },
  // Wheels are fused into the body: estimated from the lowest geometry at each corner.
  'toy-car': { length: 4, chassis: { x: 1, y: .7, z: 1.7, offset: .35 }, wheels: [
    wheel(.5995,.4648,1.101,.4648), wheel(-.5995,.4648,1.101,.4648),
    wheel(.5995,.4648,-1.2257,.4648), wheel(-.5995,.4648,-1.2257,.4648),
  ] },
  cyberpunk: { length: 4.5, chassis: { x: 1.2387, y: .6225, z: 1.9688, offset: .2525 }, topSpeed: 34, wheels: [
    wheel(0.8024,0.4424,1.2636,0.4198,"��������������_����������������3_0"),
    wheel(-0.8024,0.4424,1.2636,0.4198,"��������������_1_����������������3_0"),
    wheel(0.8024,0.4424,-1.4536,0.4198,"��������������_2_����������������3_0"),
    wheel(-0.8024,0.4424,-1.4536,0.4198,"��������������_1_2_����������������3_0"),
  ] },
  // Measured by replaying ModelAsset's normalization; see the design doc's calibration table.
  lambini: { length: 4.2, chassis: { x: .95, y: .45, z: 1.85, offset: .1 }, topSpeed: 34, wheels: [
    wheel(.7966,.39347,1.05764,.39347,'mesh_12_15nr012_mat_7011_0','mesh_12_19nr013_mat_8015_0','mesh_12_8nr012_mat_3009_0'),
    wheel(-.7966,.39347,1.05764,.39347,'mesh_12_15nr011_mat_7010_0','mesh_12_19nr012_mat_8014_0','mesh_12_8nr011_mat_3008_0'),
    wheel(.76823,.39347,-1.07211,.39347,'mesh_12_15nr013_mat_7012_0','mesh_12_19nr014_mat_8016_0','mesh_12_8nr013_mat_3010_0'),
    wheel(-.76823,.39347,-1.07211,.39347,'mesh_12_15nr010_mat_7009_0','mesh_12_19nr011_mat_8013_0','mesh_12_8nr010_mat_3007_0'),
  ] },
  celero: { length: 4.3, chassis: { x: .95, y: .42, z: 1.9, offset: .06 }, topSpeed: 30, wheels: [
    wheel(.8713,.41515,1.21039,.41515,'CarWheelRubberHW002_Car_Wheel_Rubber_HW006_0','CarWheelHubHWCelero_Steel002_Car_Wheel_Hub_HWCelero_Steel006_0','CarWheelBrakeBrake006_Car_Wheel_Brake_Brake013_0'),
    wheel(-.8713,.41515,1.21039,.41515,'CarWheelRubberHW001_Car_Wheel_Rubber_HW005_0','CarWheelHubHWCelero_Steel001_Car_Wheel_Hub_HWCelero_Steel005_0','CarWheelBrakeBrake005_Car_Wheel_Brake_Brake012_0'),
    wheel(.8713,.41515,-1.24832,.41515,'CarWheelRubberHW003_Car_Wheel_Rubber_HW007_0','CarWheelHubHWCelero_Steel003_Car_Wheel_Hub_HWCelero_Steel007_0','CarWheelBrakeBrake007_Car_Wheel_Brake_Brake014_0'),
    wheel(-.8713,.41515,-1.24832,.41515,'CarWheelRubberHW_Car_Wheel_Rubber_HW004_0','CarWheelHubHWCelero_Steel_Car_Wheel_Hub_HWCelero_Steel004_0','CarWheelBrakeBrake004_Car_Wheel_Brake_Brake004_0'),
  ] },
  // Tall off-roader: the belly sits .74 m clear, well above the .4 m floor the clearance test enforces.
  'willys-buggy': { length: 4, chassis: { x: 1.05, y: .6, z: 1.7, offset: .5 }, cameraDistance: 8, wheels: [
    wheel(1.01681,.58824,1.41221,.58824,'front_left_wheel_wheels_0','front_left_wheel_suspension_part_1_0'),
    wheel(-1.0168,.58824,1.41221,.58824,'front_right_wheel_wheels_0','front_right_wheel_suspension_part_1_0'),
    wheel(1.01681,.58824,-1.41221,.58824,'rear_left_wheel_wheels_0','rear_left_wheel_suspension_part_2_0'),
    wheel(-1.0168,.58824,-1.41221,.58824,'rear_right_wheel_wheels_0','rear_right_wheel_suspension_part_2_0'),
  ] },
  // 8.5 m, six wheels: a steering front pair and a dual rear axle. The slight x asymmetry on the
  // front wheels (.949 vs -.924) is in the source model and is preserved, not rounded.
  bus: { length: 8.5, chassis: { x: 1.25, y: 1.35, z: 3.9, offset: 1 }, topSpeed: 19,
    massKg: 8500, driveForce: 78000, steerLock: .34, nitro: false,
    cameraDistance: 13, exhaust: { x: -1, y: .5, z: -4.1 },
    wheels: [
      wheel(.94934,.47051,2.7029,.47051,'left_front_wheel_Material011_0'),
      wheel(-.92399,.47155,2.7029,.47051,'right_front_wheel_Material011_0'),
      wheel(1.0455,.47144,-1.79593,.47051,'left_rear_wheel_2_Material011_0'),
      wheel(.75881,.47051,-1.79593,.47051,'left_rear_wheel_1_Material011_0'),
      wheel(-.73347,.47155,-1.79593,.47051,'right_rear_wheel_1_Material011_0'),
      wheel(-1.02015,.47051,-1.79593,.47051,'right_rear_wheel_2_Material011_0'),
    ] },
};
