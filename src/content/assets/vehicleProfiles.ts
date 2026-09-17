import type { CarModelId } from './models';

export interface VehicleWheel { x: number; y: number; z: number; radius: number; nodes: readonly string[] }
export interface VehicleProfile {
  length: number;
  legacyBoundsCap?: boolean;
  chassis: { x: number; y: number; z: number; offset: number };
  wheels: readonly VehicleWheel[];
}
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
  bronco: { length: 4.5, chassis: { x: 1.1719, y: 1.0374, z: 1.9688, offset: .2876 }, wheels: [
    wheel(1.0445,.42,1.65,.42), wheel(-1.0445,.42,1.65,.42),
    wheel(1.0445,.42,-1.5,.42), wheel(-1.0445,.42,-1.5,.42),
  ] },
  'mazda-rx7': { length: 4.3, chassis: { x: .9716, y: .5898, z: 1.8813, offset: -.1989 }, wheels: [
    wheel(.866,.22,1.65,.22), wheel(-.866,.22,1.65,.22),
    wheel(.866,.22,-1.5,.22), wheel(-.866,.22,-1.5,.22),
  ] },
  cyberpunk: { length: 4.5, chassis: { x: 1.2387, y: .8576, z: 1.9688, offset: .0922 }, wheels: [
    wheel(0.8024,0.4424,1.2636,0.4198,"��������������_����������������3_0"),
    wheel(-0.8024,0.4424,1.2636,0.4198,"��������������_1_����������������3_0"),
    wheel(0.8024,0.4424,-1.4536,0.4198,"��������������_2_����������������3_0"),
    wheel(-0.8024,0.4424,-1.4536,0.4198,"��������������_1_2_����������������3_0"),
  ] },
};
