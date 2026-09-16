import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {
  CHALAKKUDY_STREET,
  EXPANSION_GROUND,
  EXPANSION_LAYOUT,
  V2_ROUTES,
  isWater,
  safeGroundPosition,
} from '../src/content/world/definition';
import { createRouteField } from '../src/game/world/expansionTerrain';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, WALK_SPEED } from '../src/game/player/controllerMath';
import { createExplorerMotor, computeExplorerMovement } from '../src/game/player/characterMotor';

beforeAll(async () => { await RAPIER.init(); });

describe('Chalakkudy prototype street', () => {
  it('has six authored buildings with level foundations and dry footprints', () => {
    expect(CHALAKKUDY_STREET.buildings).toHaveLength(6);
    expect(new Set(CHALAKKUDY_STREET.buildings.map(building => building.id)).size).toBe(6);
    for (const building of CHALAKKUDY_STREET.buildings) {
      expect(building.foundation.groundMax - building.foundation.groundMin).toBeLessThan(0.5);
      const b = building.foundation.bounds;
      const perimeter: [number, number][] = [];
      for (let i = 0; i <= 10; i++) {
        const tx = i / 10, tz = i / 10;
        perimeter.push([b.xMin + (b.xMax - b.xMin) * tx, b.zMin]);
        perimeter.push([b.xMax, b.zMin + (b.zMax - b.zMin) * tz]);
        perimeter.push([b.xMax - (b.xMax - b.xMin) * tx, b.zMax]);
        perimeter.push([b.xMin, b.zMax - (b.zMax - b.zMin) * tz]);
      }
      expect(perimeter.some(([x, z]) => isWater(x, z)), `${building.id} foundation intersects water`).toBe(false);
    }
  });

  it('keeps foundation perimeters clear of every authored road corridor', () => {
    const routeField = createRouteField([...EXPANSION_LAYOUT.routes, ...V2_ROUTES]);
    for (const building of CHALAKKUDY_STREET.buildings) {
      const b = building.foundation.bounds;
      const samples: [number, number][] = [[b.xMin, b.zMin], [b.xMax, b.zMin], [b.xMax, b.zMax], [b.xMin, b.zMax]];
      for (let i = 0; i <= Math.ceil(Math.max(b.xMax - b.xMin, b.zMax - b.zMin)); i++) {
        const t = i / Math.ceil(Math.max(b.xMax - b.xMin, b.zMax - b.zMin));
        samples.push([b.xMin + (b.xMax - b.xMin) * t, b.zMin], [b.xMax, b.zMin + (b.zMax - b.zMin) * t]);
        samples.push([b.xMax - (b.xMax - b.xMin) * t, b.zMax], [b.xMin, b.zMax - (b.zMax - b.zMin) * t]);
      }
      for (const [x, z] of samples) {
        const route = routeField(x, z);
        if (route) expect(route.distance, `${building.id} near road at ${x},${z}`).toBeGreaterThanOrEqual(route.width + 1.5);
      }
    }
  });

  it('grounds the coffee approach and resolves its ramp and floor through Rapier', () => {
    const coffee = CHALAKKUDY_STREET.buildings.find(b => b.kind === 'coffee')!;
    const safeApproach = safeGroundPosition(coffee.approach);
    expect(safeApproach[0]).toBe(coffee.approach[0]);
    expect(safeApproach[2]).toBe(coffee.approach[2]);
    expect(Math.abs(safeApproach[1] - coffee.approach[1])).toBeLessThanOrEqual(0.02);
    const world = streetWorld();
    try {
      world.step();
      // The shell intentionally closes the rear half; sample the open forecourt floor.
      for (const [x, z] of [
        [coffee.approach[0], coffee.approach[2]],
        [coffee.origin[0], coffee.origin[2] - 7.58],
        [coffee.origin[0], coffee.origin[2] - 4],
      ] as const) {
        const hit = world.castRay(new RAPIER.Ray({ x, y: 80, z }, { x: 0, y: -1, z: 0 }), 100, true);
        expect(hit, `no Rapier surface at ${x},${z}`).not.toBeNull();
        const y = 80 - hit!.timeOfImpact;
        expect(y).toBeCloseTo(CHALAKKUDY_STREET.deckHeightAt(x, z)!, 1);
      }
    } finally { world.free(); }
  });

  it('walks from the coffee approach onto the entrance and back on actual colliders', () => {
    const coffee = CHALAKKUDY_STREET.buildings.find(b => b.kind === 'coffee')!;
    const world = streetWorld();
    try {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(coffee.approach[0], coffee.approach[1] + FEET_TO_CENTER, coffee.approach[2]));
      const capsule = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), body);
      const motor = createExplorerMotor(world), state = { grounded: false, verticalSpeed: 0 };
      world.step();
      for (const target of [coffee.entrance, coffee.approach]) {
        let reached = false;
        for (let frame = 0; frame < 240; frame++) {
          const p = body.translation(), distance = Math.hypot(target[0] - p.x, target[2] - p.z);
          if (distance < .35) { reached = true; break; }
          const move = computeExplorerMovement(motor, capsule, state, { xVelocity: (target[0] - p.x) / distance * WALK_SPEED, zVelocity: (target[2] - p.z) / distance * WALK_SPEED, jump: false }, 1 / 60);
          body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
          world.step();
        }
        expect(reached, `blocked walking toward ${target}`).toBe(true);
      }
      world.removeCharacterController(motor); world.removeRigidBody(body);
    } finally { world.free(); }
  }, 30000);
});

function streetWorld() {
  const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
  for (const mesh of EXPANSION_GROUND.chunks) world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
  for (const box of CHALAKKUDY_STREET.boxes) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...box.rotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(box.size[0] / 2, box.size[1] / 2, box.size[2] / 2).setTranslation(...box.position).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  }
  return world;
}
