import { Box3, Group, Object3D, Vector3 } from 'three';
import type { CarModelId } from '../../content/assets/models';
import type { CarMotion } from './carPhysics';

type WheelSpec = readonly string[];
const WHEEL_NAMES: Record<CarModelId, readonly WheelSpec[]> = {
  admin: [
    ['Front_wheel_Black_0', 'Front_wheel_Light_black_0'],
    ['Front_wheel001_Black_0', 'Front_wheel001_Light_black_0'],
    ['Rear_wheel_Black_0', 'Rear_wheel_Light_black_0'],
    ['Rear_wheel001_Black_0', 'Rear_wheel001_Light_black_0'],
  ],
  muscle: [['Object_21', 'Object_22', 'Object_23'], ['Object_13', 'Object_14', 'Object_15'], ['Object_17', 'Object_18', 'Object_19'], ['Object_25', 'Object_26', 'Object_27']],
};

export interface CarWheelAnimator { update(motion?: CarMotion): void }

/** Reparents wheel meshes under steering/spin pivots without changing their world pose. */
export function createCarWheelAnimation(root: Group, model: CarModelId): CarWheelAnimator {
  root.updateMatrixWorld(true);
  const names = WHEEL_NAMES[model];
  const wheels: ({ steering: Group; spin: Group; baseY: number; front: boolean } | null)[] = Array(names.length).fill(null);
  const scaleY = root.scale.y || 1;
  const sourceByName = new Map<string, Object3D>();
  root.traverse(object => { if (object.name) sourceByName.set(object.name, object); });
  names.forEach((wheelNames, index) => {
    const parts = wheelNames.map(name => sourceByName.get(name)).filter((item): item is Object3D => !!item);
    if (!parts.length) return;
    const bounds = new Box3();
    parts.forEach(part => bounds.expandByObject(part, true));
    const centerWorld = bounds.getCenter(new Vector3());
    root.worldToLocal(centerWorld);
    const steering = new Group();
    steering.name = `car-wheel-steering-${index}`;
    steering.position.copy(centerWorld);
    root.add(steering);
    const spin = new Group();
    spin.name = `car-wheel-spin-${index}`;
    steering.add(spin);
    parts.forEach(part => spin.attach(part));
    root.updateMatrixWorld(true);
    wheels[index] = { steering, spin, baseY: centerWorld.y, front: index < 2 };
  });
  // A missing/renamed wheel is intentionally left untouched; known wheels still animate.
  return {
    update(motion = { speed: 0, signedSpeed: 0, throttle: 0, grounded: false, wheelRotation: [], wheelSteering: [], wheelOffset: [] }) {
      wheels.forEach((wheel, index) => {
        if (!wheel) return;
        wheel.steering.rotation.y = wheel.front ? (motion.wheelSteering[index] ?? 0) : 0;
        // Native forward rotation is positive; +X rolls a +Z-facing wheel forward.
        wheel.spin.rotation.x = motion.wheelRotation[index] ?? 0;
        wheel.steering.position.y = wheel.baseY + (motion.wheelOffset[index] ?? 0) / scaleY;
      });
    },
  };
}
