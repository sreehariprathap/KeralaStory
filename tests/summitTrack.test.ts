import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, isCarTerrainAllowed, isTravelAllowed, isWater, terrainHeight } from '../src/content/world/definition';
import { createCarPhysics } from '../src/game/vehicle/carPhysics';
import { CAR_MODELS, SUMMIT_CAPABLE_CAR_IDS, type CarModelId } from '../src/content/assets/models';

const track = EXPANSION_LAYOUT.routes.find(route => route.id === 'summit-offroad-track')!;
const trail = EXPANSION_LAYOUT.routes.find(route => route.id === 'summit-trail')!;
const summit = EXPANSION_LAYOUT.summitPosition;
const foot = track.points[0], top = track.points.at(-1)!;

describe('summit off-road track', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('runs dead straight from the dam road to the summit cap as an unsealed track', () => {
    expect(track.surface).toBe('dirt');
    expect(track.allowedModes).toEqual(['foot', 'bicycle', 'car']);
    const length = Math.hypot(top[0] - foot[0], top[2] - foot[2]);
    for (const point of track.points) {
      // Every sample sits on the straight line between the two ends.
      const t = ((point[0] - foot[0]) * (top[0] - foot[0]) + (point[2] - foot[2]) * (top[2] - foot[2])) / (length * length);
      expect(Math.hypot(point[0] - foot[0] - (top[0] - foot[0]) * t, point[2] - foot[2] - (top[2] - foot[2]) * t)).toBeLessThan(.01);
    }
    // It ends on the levelled summit cap, not short of it.
    expect(Math.hypot(top[0] - summit[0], top[2] - summit[2])).toBeLessThan(15);
    expect(summit[1] - top[1]).toBeLessThan(.5);
  });

  it('carries every travel mode on ground that matches the route and stays level across', () => {
    const dx = top[0] - foot[0], dz = top[2] - foot[2], length = Math.hypot(dx, dz);
    const nx = -dz / length, nz = dx / length;
    for (const point of track.points) {
      expect(isWater(point[0], point[2])).toBe(false);
      expect(terrainHeight(point[0], point[2])).toBeCloseTo(point[1], 2);
      for (const mode of ['foot', 'bicycle', 'car'] as const) expect(isTravelAllowed(mode, point[0], point[2]), mode).toBe(true);
      // Flat across the carriageway, so a vehicle is never tipped sideways. The first few metres lie on the
      // dam road it leaves from, which is graded along its own direction, so they follow that instead.
      if (Math.hypot(point[0] - foot[0], point[2] - foot[2]) < 8) continue;
      const left = terrainHeight(point[0] + nx * 2.5, point[2] + nz * 2.5), right = terrainHeight(point[0] - nx * 2.5, point[2] - nz * 2.5);
      expect(Math.abs(left - right)).toBeLessThan(.2);
      expect(isCarTerrainAllowed(point[0], point[2])).toBe(true);
    }
  });

  it('keeps clear of the walking switchbacks except where both reach the peak', () => {
    for (const point of track.points.slice(0, -8)) {
      const distance = Math.min(...trail.points.map(p => Math.hypot(p[0] - point[0], p[2] - point[2])));
      expect(distance).toBeGreaterThan(15);
    }
  });

  it('excludes only the bus from the summit climb', () => {
    const excluded = CAR_MODELS.map(car => car.id as CarModelId).filter(id => !SUMMIT_CAPABLE_CAR_IDS.includes(id));
    expect(excluded).toEqual(['bus']);
  });

  it('lets every car drive from the foot to the peak', { timeout: 180_000 }, () => {
    const heading = Math.atan2(top[0] - foot[0], -(top[2] - foot[2]));
    for (const model of SUMMIT_CAPABLE_CAR_IDS) {
      const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
      world.timestep = 1 / 60;
      for (const chunk of EXPANSION_GROUND.chunks) {
        world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(chunk.vertices), new Uint32Array(chunk.indices)).setFriction(.9));
      }
      const car = createCarPhysics(world, [foot[0], terrainHeight(foot[0], foot[2]) + .5, foot[2]], heading, model);
      let peak = -Infinity, airborne = 0, climbing = 0;
      // Full throttle until the cap is reached; running on would just drive off the far side.
      for (let step = 0; step < 2700 && peak < summit[1] - 1; step++) {
        // Steady part throttle, like a driver picking a line up a rough track, not flat out over every crest.
        car.step({ forward: .45, steer: 0, brake: false }, 1 / 60, true);
        world.step(); car.sample();
        peak = Math.max(peak, car.body.translation().y);
        climbing++;
        if (!car.motion.grounded) airborne++;
      }
      // Reaches the levelled cap, with its wheels on the track nearly the whole way up.
      expect(peak, model).toBeGreaterThan(summit[1] - 1);
      expect(airborne / climbing, model).toBeLessThan(.15);
      car.dispose(); world.free();
    }
  });
});
