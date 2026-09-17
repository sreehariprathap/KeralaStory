import { beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_GROUND, V2_ROUTES, terrainHeight } from '../src/content/world/definition';
import { terrainMeshData } from '../src/game/world/traversalGeometry';
import { createExplorerMotor, computeExplorerMovement } from '../src/game/player/characterMotor';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, WALK_SPEED, needsSafeReset } from '../src/game/player/controllerMath';
import { createCarPhysics } from '../src/game/vehicle/carPhysics';
import type { Vec3 } from '../src/contracts';

beforeAll(async () => { await RAPIER.init(); });
function worldFixture() {
  const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
  world.timestep = 1 / 60;
  for (const mesh of [...EXPANSION_GROUND.chunks, terrainMeshData('north'), terrainMeshData('south')]) {
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
  }
  return world;
}

it('walks the new roads on their actual collision meshes in both directions', () => {
  const world = worldFixture();
  try {
    for (const route of V2_ROUTES) {
      const start = route.points[0];
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start[0], start[1] + FEET_TO_CENTER + .05, start[2]));
      const capsule = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), body);
      const motor = createExplorerMotor(world), state = { grounded: false, verticalSpeed: 0 };
      world.step();
      const points: readonly Vec3[] = [...route.points, ...route.points.slice().reverse()];
      for (const target of points) {
        let reached = false;
        for (let frame = 0; frame < 180; frame++) {
          const p = body.translation(), distance = Math.hypot(target[0] - p.x, target[2] - p.z);
          if (distance < .16) { reached = true; break; }
          const move = computeExplorerMovement(motor, capsule, state, { xVelocity: (target[0] - p.x) / distance * WALK_SPEED, zVelocity: (target[2] - p.z) / distance * WALK_SPEED, jump: false }, 1 / 60);
          body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
          world.step();
        }
        expect(reached, `${route.id} blocked at ${JSON.stringify(body.translation())} toward ${target}`).toBe(true);
        expect(needsSafeReset(body.translation()), route.id).toBe(false);
      }
      world.removeCharacterController(motor);
      world.removeRigidBody(body);
    }
  } finally { world.free(); }
}, 30000);

it('drives a dynamic car uphill and downhill on the new Chalakkudy grade', () => {
  const world = worldFixture();
  try {
    const route = V2_ROUTES.find(r => r.id === 'chalakkudy-road')!;
    for (const direction of [1, -1]) {
      const start = route.points[60], next = route.points[61];
      const heading = Math.atan2((next[0] - start[0]) * direction, -(next[2] - start[2]) * direction);
      const car = createCarPhysics(world, [start[0], terrainHeight(start[0], start[2]) + .08, start[2]], heading, 'admin');
      let contacts = 0;
      for (let i = 0; i < 300; i++) {
        car.step({ forward: i < 60 ? 0 : 1, steer: 0, brake: i < 60 }, 1 / 60, true);
        world.step(); car.sample();
        if (i >= 60 && car.motion.grounded) contacts++;
      }
      const end = car.body.translation();
      expect(Math.hypot(end.x - start[0], end.z - start[2])).toBeGreaterThan(5);
      expect(contacts).toBeGreaterThan(220);
      expect(needsSafeReset(end)).toBe(false);
      car.dispose();
    }
  } finally { world.free(); }
}, 15000);
