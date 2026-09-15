import { beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { buildArchitecture } from '../src/game/world/KeralaWorld';
import { createTerrainSurface, planFoundation, planFoundationSteps } from '../src/game/world/buildingFoundation';
import { terrainMeshData } from '../src/game/world/traversalGeometry';
import { computeExplorerMovement, createExplorerMotor } from '../src/game/player/characterMotor';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, WALK_SPEED } from '../src/game/player/controllerMath';

beforeAll(async () => { await RAPIER.init(); });

function walkApproach(start: [number, number], target: [number, number], deckY: number) {
  const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
  world.timestep = 1 / 60;
  try {
    const terrain = terrainMeshData('south'), surface = createTerrainSurface(terrain);
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(terrain.vertices), new Uint32Array(terrain.indices)));
    const architecture = buildArchitecture();
    for (const mesh of architecture.meshes) mesh.geometry.dispose();
    for (const shape of architecture.colliders) {
      const rotation = new Quaternion().setFromEuler(new Euler(...shape.rotation));
      world.createCollider(RAPIER.ColliderDesc.cuboid(...shape.size).setTranslation(...shape.position).setRotation(rotation));
    }
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start[0], surface.heightAt(...start) + FEET_TO_CENTER + .05, start[1]));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), body);
    const motor = createExplorerMotor(world), state = { grounded: false, verticalSpeed: 0 };
    world.step();
    let arrived = false;
    for (let frame = 0; frame < 1800; frame++) {
      const p = body.translation(), distance = Math.hypot(target[0] - p.x, target[1] - p.z);
      if (distance < .12) { arrived = true; break; }
      const move = computeExplorerMovement(motor, collider, state, { xVelocity: (target[0] - p.x) / distance * WALK_SPEED, zVelocity: (target[1] - p.z) / distance * WALK_SPEED, jump: false }, 1 / 60);
      body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
      world.step();
    }
    expect(arrived, `Approach blocked at ${JSON.stringify(body.translation())}`).toBe(true);
    expect(body.translation().y - FEET_TO_CENTER).toBeCloseTo(deckY, 0);
  } finally { world.free(); }
}

it.each([
  { name: 'hillside tea shop', x: -10, z: -194, width: 8, depth: 8 },
  { name: 'bazaar shop', x: 13, z: -28, width: 9, depth: 8 },
  { name: 'lighthouse base', x: 65, z: 54, width: 8, depth: 8 },
])('walks from terrain up the $name steps onto its level porch', ({ x, z, width, depth }) => {
  const surface = createTerrainSurface(terrainMeshData('south'));
  const foundation = planFoundation(surface, { x, z, width, depth });
  const steps = planFoundationSteps(surface, { x, edgeZ: foundation.bounds.zMax, deckY: foundation.deckY });
  const outerStep = steps.at(-1)!;
  walkApproach([x, outerStep.position[2] + outerStep.size[2] / 2 + 2], [x, foundation.bounds.zMax - .7], foundation.deckY);
});

it('walks from the village road through the raised temple west gate', () => {
  const foundation = planFoundation(createTerrainSurface(terrainMeshData('south')), { x: 25, z: -238, width: 26, depth: 24 });
  walkApproach([-6, -238], [16, -238], foundation.deckY);
});
