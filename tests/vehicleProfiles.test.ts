import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Box3, Group, Vector3, type Material, type Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAR_MODELS, CAR_PICKER_CATALOG } from '../src/content/assets/models';
import { VEHICLE_PROFILES } from '../src/content/assets/vehicleProfiles';
import { createCarWheelAnimation } from '../src/game/vehicle/carWheelAnimation';
import { applyVehicleMaterials, removeHiddenVehicleNodes } from '../src/game/vehicle/vehicleMaterials';

// Geometry-only loading keeps tests independent of browser image decoders.
async function loadGeometry(url: string) {
  const bytes = readFileSync(`public${url}`), jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const bin = bytes.subarray(28 + jsonLength);
  json.buffers = [{ byteLength: bin.length, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` }];
  delete json.images; delete json.textures; delete json.samplers;
  json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  if (!globalThis.ProgressEvent) Object.defineProperty(globalThis, 'ProgressEvent', { value: class {}, configurable: true });
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}

describe('measured vehicle calibration', () => {
  it('keeps the one unresolved source unavailable in the fourteen-car catalog', () => {
    expect(CAR_PICKER_CATALOG).toHaveLength(14);
    expect(CAR_PICKER_CATALOG.filter(car => !car.available).map(car => car.id)).toEqual(['car']);
  });
  it.each(['car-carton', 'fennec', 'cyberpunk', 'supercar', 'lambini', 'celero', 'willys-buggy'] as const)('%s physics matches actual four wheel meshes', async id => {
    const model = CAR_MODELS.find(car => car.id === id)!;
    const profile = VEHICLE_PROFILES[id], root = new Group(), scene = await loadGeometry(model.url);
    // The renderer drops hidden nodes before it measures, so the shadow plane never sets the scale.
    removeHiddenVehicleNodes(scene, id);
    scene.rotation.y += model.rotationY; root.add(scene); root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root, true), size = bounds.getSize(new Vector3());
    root.scale.setScalar(profile.length / size.z);
    scene.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
    root.updateMatrixWorld(true);
    profile.wheels.forEach(wheel => {
      const wheelBounds = new Box3();
      wheel.nodes.forEach(name => { const part = root.getObjectByName(name); expect(part, name).toBeTruthy(); wheelBounds.expandByObject(part!, true); });
      const center = wheelBounds.getCenter(new Vector3());
      expect(center.x).toBeCloseTo(wheel.x, 3); expect(center.y).toBeCloseTo(wheel.y, 3); expect(center.z).toBeCloseTo(wheel.z, 2);
      expect(wheelBounds.getSize(new Vector3()).y / 2).toBeCloseTo(wheel.radius, 3);
    });
    createCarWheelAnimation(root, id);
    for (let i = 0; i < 4; i++) expect(root.getObjectByName(`car-wheel-spin-${i}`)).toBeTruthy();
    expect(new Box3().setFromObject(root, true).getSize(new Vector3()).z).toBeCloseTo(profile.length, 3);
  });
});

describe('chassis belly clearance', () => {
  it.each(Object.keys(VEHICLE_PROFILES) as (keyof typeof VEHICLE_PROFILES)[])('%s keeps its collision belly clear of the ground at rest', id => {
    const { chassis } = VEHICLE_PROFILES[id];
    // Body origin rests FEET_TO_CENTER (0.84 m) above the ground.
    expect(.84 + chassis.offset - chassis.y).toBeGreaterThanOrEqual(.4);
  });
});

describe('supercar presentation', () => {
  it('drops the exported shadow plane and exposes recolourable paint', async () => {
    const scene = await loadGeometry(CAR_MODELS.find(car => car.id === 'supercar')!.url);
    removeHiddenVehicleNodes(scene, 'supercar');
    expect(scene.getObjectByName('488_shadow_488_SHADOW_0')).toBeUndefined();
    const { owned, paint } = applyVehicleMaterials(scene, 'supercar');
    expect(paint).toHaveLength(1);
    paint.forEach(material => material.color.set('#1f4fa8'));
    expect(paint.every(material => material.color.getHexString() === '1f4fa8')).toBe(true);
    scene.traverse(object => {
      const mesh = object as Mesh;
      // Only the paint material is replaced; the rest keep their exported textures.
      if (mesh.isMesh && (mesh.material as Material).name.startsWith('paint-')) expect((mesh.material as Material).name).toBe('paint-488_PAINT');
    });
    owned.forEach(material => material.dispose());
  });
});
