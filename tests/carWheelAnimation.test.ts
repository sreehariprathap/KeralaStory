import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createCarWheelAnimation } from '../src/game/vehicle/carWheelAnimation';
import { createCarMotion } from '../src/game/vehicle/carPhysics';

const wheelModel = () => {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(2, 1, 4), new MeshBasicMaterial());
  body.name = 'body'; root.add(body);
  for (const [name, x, z] of [['Object_21', 1, 1], ['Object_22', 1, 1], ['Object_23', 1, 1], ['Object_13', -1, 1], ['Object_14', -1, 1], ['Object_15', -1, 1], ['Object_17', 1, -1], ['Object_18', 1, -1], ['Object_19', 1, -1], ['Object_25', -1, -1], ['Object_26', -1, -1], ['Object_27', -1, -1]] as const) {
    const wheel = new Mesh(new BoxGeometry(.3, .3, .15), new MeshBasicMaterial());
    wheel.name = name; wheel.position.set(x, 0, z); root.add(wheel);
  }
  root.scale.setScalar(2); root.updateMatrixWorld(true);
  return { root, body };
};

describe('car wheel animation', () => {
  it('preserves the body while steering and spinning known wheel meshes', () => {
    const { root, body } = wheelModel();
    const before = body.matrixWorld.clone();
    const animator = createCarWheelAnimation(root, 'muscle');
    const motion = createCarMotion();
    motion.wheelSteering[0] = .4; motion.wheelRotation[0] = 1.2; motion.wheelOffset[0] = .2;
    animator.update(motion);
    expect(body.matrixWorld.elements).toEqual(before.elements);
    const wheel = root.getObjectByName('Object_21');
    expect(wheel?.getWorldPosition(new Vector3()).x).toBeCloseTo(2);
    expect(wheel?.parent?.name).toBe('car-wheel-spin-0');
    expect(wheel?.parent?.parent?.rotation.y).toBeCloseTo(.4);
    // Forward is +Z: positive X spin moves the tyre's bottom surface toward -Z.
    expect(wheel?.parent?.rotation.x).toBeCloseTo(1.2);
  });

  it('leaves unknown meshes untouched', () => {
    const root = new Group(); const unknown = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    unknown.name = 'not-a-wheel'; root.add(unknown); root.updateMatrixWorld(true);
    const before = unknown.matrixWorld.clone(); createCarWheelAnimation(root, 'admin').update(createCarMotion());
    expect(unknown.matrixWorld.elements).toEqual(before.elements);
  });

  it.each([
    ['admin', 'assets/cars/admin-car.glb', ['Front_wheel_Black_0', 'Front_wheel001_Black_0', 'Rear_wheel_Black_0', 'Rear_wheel001_Black_0']],
    ['muscle', 'assets/cars/classic_muscle_car.glb', ['Object_21', 'Object_13', 'Object_17', 'Object_25']],
  ] as const)('maps all four wheel pivots in the real %s GLB', async (model, asset, wheelNames) => {
    const bytes = readFileSync(resolve(process.cwd(), 'public', asset));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const root = new Group(); const scene = clone(gltf.scene); root.add(scene); root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root, true); const size = bounds.getSize(new Vector3());
    const scale = Math.min(3.8 / size.z, 1.8 / size.x, 1.7 / size.y); root.scale.setScalar(scale);
    scene.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
    root.updateMatrixWorld(true);
    const wheelNameSet = new Set<string>(wheelNames);
    const body = [...root.children].flatMap(child => { const meshes: Mesh[] = []; child.traverse(object => { if (object instanceof Mesh && !wheelNameSet.has(object.name)) meshes.push(object); }); return meshes; });
    const before = body.map(mesh => mesh.matrixWorld.clone());
    createCarWheelAnimation(root, model);
    root.updateMatrixWorld(true);
    expect(root.getObjectByName('car-wheel-steering-0')).toBeTruthy();
    expect(root.getObjectByName('car-wheel-steering-1')).toBeTruthy();
    expect(root.getObjectByName('car-wheel-steering-2')).toBeTruthy();
    expect(root.getObjectByName('car-wheel-steering-3')).toBeTruthy();
    body.forEach((mesh, index) => mesh.matrixWorld.elements.forEach((value, element) => expect(value).toBeCloseTo(before[index].elements[element], 7)));
  });
});
