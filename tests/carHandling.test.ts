import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createCarPhysics } from '../src/game/vehicle/carPhysics';
import type { CarModelId } from '../src/content/assets/models';
import { MAIN_PATH, safeGroundPosition } from '../src/content/world/definition';
import { terrainMeshData } from '../src/game/world/traversalGeometry';

const DT = 1 / 60;
const models: CarModelId[] = ['admin', 'muscle', 'car-carton', 'fennec', 'bronco', 'cyberpunk'];
const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const worlds: RAPIER.World[] = [];

beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });

function fixture(model: CarModelId, heading: number) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = DT;
  worlds.push(world);
  world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 0.2, 1000).setTranslation(0, -0.2, 0));
  const car = createCarPhysics(world, [0, 3, 0], heading, model);
  const step = (forward = 0, steer = 0, brake = false, occupied = true) => {
    car.step({ forward, steer, brake }, DT, occupied);
    world.step();
  };
  return { world, car, step };
}

function surfaceFixture(model: CarModelId, point: readonly [number, number] | null, slope: boolean) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = DT;
  worlds.push(world);
  if (slope) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 0.2, 1000).setTranslation(0, -0.2, 0)
      .setRotation({ x: Math.sin(Math.PI / 36), y: 0, z: 0, w: Math.cos(Math.PI / 36) }));
  } else {
    for (const region of ['north', 'south'] as const) {
      const mesh = terrainMeshData(region);
      world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
    }
  }
  const feet: [number, number, number] = slope ? [0, 3, 0] : safeGroundPosition([point![0], 0, point![1]]);
  const car = createCarPhysics(world, feet, 0, model);
  const step = (forward = 0, steer = 0, brake = false, occupied = true) => {
    car.step({ forward, steer, brake }, DT, occupied);
    world.step();
  };
  return { car, step };
}

function diagnostics(car: ReturnType<typeof createCarPhysics>) {
  const q = car.body.rotation();
  const v = car.body.linvel();
  const forward = { x: 2 * (q.x * q.z + q.w * q.y), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
  const right = { x: forward.z, z: -forward.x };
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
  const contacts = [0, 1, 2, 3].filter(i => car.vehicle.wheelIsInContact(i)).length;
  return {
    x: car.body.translation().x,
    z: car.body.translation().z,
    lateralSpeed: v.x * right.x + v.z * right.z,
    speed: Math.hypot(v.x, v.z),
    tilt: Math.acos(Math.max(-1, Math.min(1, upY))),
    contacts,
  };
}

describe('prolonged car handling on a large flat Rapier ground', () => {
  for (const model of models) {
    it(`${model} remains grounded and bounded during sustained steering at every heading`, () => {
      const reports: string[] = [];
      const failures: string[] = [];
      for (const heading of headings) {
        const { car, step } = fixture(model, heading);
        for (let frame = 0; frame < 600; frame++) step();
        let maxTilt = 0;
        let maxLateral = 0;
        let minContacts = 4;
        let maxStep = 0;
        let maxStepDelta = 0;
        let previousStep = 0;
        let maxAbsPosition = 0;
        let previous = diagnostics(car);
        for (let frame = 0; frame < 600; frame++) {
          step(1, 1);
          const current = diagnostics(car);
          maxTilt = Math.max(maxTilt, current.tilt);
          maxLateral = Math.max(maxLateral, Math.abs(current.lateralSpeed));
          minContacts = Math.min(minContacts, current.contacts);
          const stepDistance = Math.hypot(current.x - previous.x, current.z - previous.z);
          maxStep = Math.max(maxStep, stepDistance);
          maxStepDelta = Math.max(maxStepDelta, Math.abs(stepDistance - previousStep));
          previousStep = stepDistance;
          maxAbsPosition = Math.max(maxAbsPosition, Math.abs(current.x), Math.abs(current.z));
          previous = current;
        }
        const report = `heading=${heading.toFixed(2)} tilt=${maxTilt.toFixed(3)} lateral=${maxLateral.toFixed(3)} contacts=${minContacts} step=${maxStep.toFixed(3)} jitter=${maxStepDelta.toFixed(3)} maxAbs=${maxAbsPosition.toFixed(2)}`;
        reports.push(report);
        console.info(`[car handling] ${model} sustained ${report}`);
        if (!Number.isFinite(maxTilt)) failures.push(`${report} non-finite tilt`);
        if (minContacts < 2) failures.push(`${report} lost wheel contact`);
        if (maxTilt >= 0.9) failures.push(`${report} excessive tilt`);
        if (maxStep >= 0.5) failures.push(`${report} excessive frame displacement`);
        if (maxAbsPosition >= 900) failures.push(`${report} approached ground edge`);
      }
      expect(failures, reports.join('\n')).toEqual([]);
    });

    it(`${model} does not develop sideways velocity or chassis jitter under alternating steering`, () => {
      const reports: string[] = [];
      const failures: string[] = [];
      for (const heading of headings) {
        const { car, step } = fixture(model, heading);
        for (let frame = 0; frame < 600; frame++) step();
        let maxTilt = 0;
        let maxLateral = 0;
        let minContacts = 4;
        let maxStep = 0;
        let maxStepDelta = 0;
        let previousStep = 0;
        let maxAbsPosition = 0;
        let previous = diagnostics(car);
        for (let frame = 0; frame < 900; frame++) {
          step(1, Math.floor(frame / 45) % 2 === 0 ? 1 : -1);
          const current = diagnostics(car);
          maxTilt = Math.max(maxTilt, current.tilt);
          maxLateral = Math.max(maxLateral, Math.abs(current.lateralSpeed));
          minContacts = Math.min(minContacts, current.contacts);
          const stepDistance = Math.hypot(current.x - previous.x, current.z - previous.z);
          maxStep = Math.max(maxStep, stepDistance);
          maxStepDelta = Math.max(maxStepDelta, Math.abs(stepDistance - previousStep));
          previousStep = stepDistance;
          maxAbsPosition = Math.max(maxAbsPosition, Math.abs(current.x), Math.abs(current.z));
          previous = current;
        }
        const report = `heading=${heading.toFixed(2)} tilt=${maxTilt.toFixed(3)} lateral=${maxLateral.toFixed(3)} contacts=${minContacts} step=${maxStep.toFixed(3)} jitter=${maxStepDelta.toFixed(3)} maxAbs=${maxAbsPosition.toFixed(2)}`;
        reports.push(report);
        console.info(`[car handling] ${model} alternating ${report}`);
        if (minContacts < 2) failures.push(`${report} lost wheel contact`);
        if (maxTilt >= 0.9) failures.push(`${report} excessive tilt`);
        if (maxLateral >= 3) failures.push(`${report} excessive lateral speed`);
        if (maxStep >= 0.5) failures.push(`${report} excessive frame displacement`);
        if (maxAbsPosition >= 900) failures.push(`${report} approached ground edge`);
      }
      expect(failures, reports.join('\n')).toEqual([]);
    });

    it(`${model} damps low speed sideways impulses and remains stable while steering under braking`, () => {
      const reports: string[] = [];
      const failures: string[] = [];
      for (const heading of headings) {
        const impulseResults: string[] = [];
        for (const magnitude of [1, 5]) {
          const impulse = fixture(model, heading);
          for (let frame = 0; frame < 600; frame++) impulse.step();
          const q = impulse.car.body.rotation();
          const forward = { x: 2 * (q.x * q.z + q.w * q.y), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
          impulse.car.body.setLinvel({ x: forward.z * magnitude, y: 0, z: -forward.x * magnitude }, true);
          impulse.step();
          const initialLateral = Math.abs(diagnostics(impulse.car).lateralSpeed);
          for (let frame = 0; frame < 120; frame++) impulse.step();
          const settledLateral = Math.abs(diagnostics(impulse.car).lateralSpeed);
          impulseResults.push(`${magnitude}:${initialLateral.toFixed(3)}->${settledLateral.toFixed(3)}`);
          if (settledLateral > initialLateral + 0.2) failures.push(`heading=${heading.toFixed(2)} impulse=${magnitude} not damped`);
        }

        const braking = fixture(model, heading);
        for (let frame = 0; frame < 600; frame++) braking.step();
        for (let frame = 0; frame < 180; frame++) braking.step(1);
        let maxTilt = 0;
        let minContacts = 4;
        let maxLateral = 0;
        for (let frame = 0; frame < 300; frame++) {
          braking.step(0, frame % 90 < 45 ? 1 : -1, true);
          const current = diagnostics(braking.car);
          maxTilt = Math.max(maxTilt, current.tilt);
          minContacts = Math.min(minContacts, current.contacts);
          maxLateral = Math.max(maxLateral, Math.abs(current.lateralSpeed));
        }
        const report = `heading=${heading.toFixed(2)} impulses=${impulseResults.join(',')} brakeTilt=${maxTilt.toFixed(3)} brakeLateral=${maxLateral.toFixed(3)} brakeContacts=${minContacts}`;
        reports.push(report);
        console.info(`[car handling] ${model} braking ${report}`);
        if (maxTilt >= 0.9) failures.push(`${report} excessive braking tilt`);
        if (minContacts < 2) failures.push(`${report} lost braking wheel contact`);
      }
      expect(failures, reports.join('\n')).toEqual([]);
    });

    it(`${model} stays parked when occupancy changes without input on authored terrain and slope`, () => {
      const reports: string[] = [];
      const failures: string[] = [];
      const cases: Array<{ label: string; point: readonly [number, number] | null; slope: boolean }> = [
        { label: 'slope10', point: null, slope: true },
        ...([MAIN_PATH[1], MAIN_PATH[4], MAIN_PATH[12]] as const).map((point, index) => ({ label: `terrain${index}`, point, slope: false })),
      ];
      for (const testCase of cases) {
        const { car, step } = surfaceFixture(model, testCase.point, testCase.slope);
        for (let frame = 0; frame < 600; frame++) step(0, 0, false, false);
        const parked = diagnostics(car);
        let maxDrift = 0;
        let maxTilt = parked.tilt;
        let minContacts = parked.contacts;
        for (let frame = 0; frame < 300; frame++) {
          step(0, 0, false, true);
          const current = diagnostics(car);
          maxDrift = Math.max(maxDrift, Math.hypot(current.x - parked.x, current.z - parked.z));
          maxTilt = Math.max(maxTilt, current.tilt);
          minContacts = Math.min(minContacts, current.contacts);
        }
        const report = `${testCase.label} drift=${maxDrift.toFixed(3)} tilt=${maxTilt.toFixed(3)} contacts=${minContacts}`;
        reports.push(report);
        if (maxDrift >= 0.35) failures.push(`${report} parked drift`);
        if (maxTilt >= 0.9) failures.push(`${report} excessive tilt`);
        if (minContacts < 2) failures.push(`${report} lost wheel contact`);
      }
      expect(failures, reports.join('\n')).toEqual([]);
    });
  }
});
