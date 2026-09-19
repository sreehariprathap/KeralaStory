import { EXPANSION_LAYOUT, terrainHeight } from './definition';
import { KODALY_AVENUE_SHOPS, kodalyCircleBoxes } from './kodalyCircle';
import { createTerrainSurface, planFoundation, planFoundationSteps } from '../../game/world/buildingFoundation';
import { terrainMeshData, traversalBoxes, type TraversalBox } from '../../game/world/traversalGeometry';

/** Canonical full-size boxes shared by solo rendering and authoritative physics. */
export function staticArchitectureBoxes(): TraversalBox[] {
  const boxes = [...traversalBoxes()], terrain = createTerrainSurface(terrainMeshData('south'));
  const box = (position: [number, number, number], size: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => boxes.push({ id: `architecture-${boxes.length}`, position, size, rotation });
  const foundation = (x: number, z: number, width: number, depth: number) => {
    const plan = planFoundation(terrain, { x, z, width, depth, clearance: .22 });
    box(plan.body.position, plan.body.size); return plan;
  };
  const steps = (x: number, edgeZ: number, deckY: number, width = 3) => {
    const outer = planFoundationSteps(terrain, { x, edgeZ, deckY, width }).at(-1)!;
    const landingZ = outer.position[2] + outer.size[2] / 2 + 1.2, landingY = terrain.heightAt(x, landingZ) + .02;
    const length = landingZ - edgeZ, rise = deckY - landingY, angle = Math.atan2(rise, length), thickness = .16;
    box([x, (deckY + landingY) / 2 - Math.cos(angle) * thickness / 2, edgeZ + length / 2], [width, thickness, Math.hypot(length, rise)], [angle, 0, 0]);
  };
  const house = (x: number, z: number, w: number, d: number) => {
    const plan = foundation(x, z, w + 1, d + 2);
    box([x, plan.deckY + 3.1 / 2, z - .6], [w, 3.1, d - 1]); steps(x, plan.bounds.zMax, plan.deckY);
  };
  const temple = foundation(25, -238, 26, 24), y = temple.deckY;
  const approachY = terrain.heightAt(-1, -238) + .02, rise = y + .04 - approachY, angle = Math.atan2(rise, 13), thickness = Math.abs(rise) + 1.5;
  box([5.5 + Math.sin(angle) * thickness / 2, (approachY + y + .04) / 2 - Math.cos(angle) * thickness / 2, -238], [Math.hypot(13, rise), thickness, 3], [0, 0, angle]);
  for (const dz of [-12, 12]) box([25, y + .48, -238 + dz], [26, .95, .55]);
  box([38, y + .48, -238], [.55, .95, 24]);
  for (const dz of [-8, 8]) box([12, y + .48, -238 + dz], [.55, .95, 8]);
  box([27, y + .38, -240], [10, .75, 10]); box([27, y + 2.1, -240], [6, 3, 6]); box([27, y + .2, -231], [2, .4, 2]);
  const tankY = terrainHeight(48, -233);
  for (let step = 0; step < 4; step++) {
    const s = 12 - step * 1.3, yy = tankY + .14 + step * .14;
    for (const sign of [-1, 1]) { box([48 + sign * s / 2, yy, -233], [.65, .3, s + 1]); box([48, yy, -233 + sign * (s + 1) / 2], [s, .3, .65]); }
  }
  for (const [x, z, w] of [[-10, -194, 7], ...KODALY_AVENUE_SHOPS.map(shop => [shop.x, shop.z, shop.width]), [47, 7, 9], [43, 51, 6]]) {
    const plan = foundation(x, z, w + 1, 8); steps(x, plan.bounds.zMax, plan.deckY); box([x, plan.deckY + 1.6, z - 1], [w, 3.2, 3.2]);
  }
  for (const [x, z, w, d] of [[-25, -319, 8, 6], [31, -307, 8, 7], [31, -278, 9, 7], [-23, -250, 8, 6], [-31, -214, 9, 7], [36, -177, 8, 6], [-25, -157, 7, 6], [-7, -43, 8, 6], [-20, -10, 9, 7], [7, 21, 9, 6], [54, 31, 8, 6], [8, 51, 10, 7]]) {
    house(x, z, w, d);
    for (let i = 0; i < 9; i++) { const wall = planFoundation(terrain, { x: x - w * .65, z: z - .5 + (i + .5) * 13 / 9, width: .45, depth: 13 / 9, clearance: 1.1, burial: .35 }); box(wall.body.position, wall.body.size); }
  }
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    const x = -42 + col * 12, z = -310 + row * 10, h = terrainHeight(x, z);
    box([x, h - 1.2, z], [11, 2.4, 8.9]); box([x, h + .018, z], [11, .036, 8.9]);
  }
  const lighthouse = foundation(65, 54, 8, 8); steps(65, lighthouse.bounds.zMax, lighthouse.deckY);
  box([65, lighthouse.deckY + 7.5, 54], [4.2, 15, 4.2]); house(63, 73, 9, 5);
  for (const shape of kodalyCircleBoxes()) boxes.push(shape);
  return boxes;
}

export function canopyArchitectureBoxes(): TraversalBox[] {
  const boxes: TraversalBox[] = [];
  for (const [x, z, scale] of [[18, -415, 1], [32, -425, .8]]) {
    const y = terrainHeight(x, z) + 3;
    for (const [px, py, pz, w, h, d] of [[0, 0, 0, 7.2, .36, 6], [0, 1.5, 2, 4.8, 2.7, .32], [-2.4, 1.5, 0, .32, 2.7, 4], [2.4, 1.5, 0, .32, 2.7, 4]]) boxes.push({ id: `canopy-${boxes.length}`, position: [x + px * scale, y + py * scale, z + pz * scale], size: [w * scale, h * scale, d * scale], rotation: [0, 0, 0] });
  }
  const a = [8, terrainHeight(8, -434) + .1, -434], b = [18, terrainHeight(18, -415) + 3.2, -415];
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, Math.hypot(dx, dz));
  // Yaw(parent) × pitch(child), expressed as XYZ Euler (not pitch then yaw).
  const rotation: [number, number, number] = [Math.atan2(Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)), Math.asin(Math.sin(yaw) * Math.cos(pitch)), Math.atan2(-Math.sin(yaw) * Math.sin(pitch), Math.cos(yaw))];
  for (const [x, y, width, height] of [[0, 0, 2.2, .24], [-1.12, .55, .16, 1], [1.12, .55, .16, 1]]) {
    boxes.push({ id: `canopy-walkway-${boxes.length}`, position: [(a[0] + b[0]) / 2 + Math.cos(yaw) * x + Math.sin(yaw) * Math.sin(pitch) * y, (a[1] + b[1]) / 2 + Math.cos(pitch) * y, (a[2] + b[2]) / 2 - Math.sin(yaw) * x + Math.cos(yaw) * Math.sin(pitch) * y], size: [width, height, len], rotation });
  }
  return boxes;
}

export function mountainArchitectureBoxes(): TraversalBox[] {
  const summit = EXPANSION_LAYOUT.summitPosition, trail = EXPANSION_LAYOUT.routes.find(r => r.id === 'summit-trail')!;
  const boxes: TraversalBox[] = [
    { id: 'summit-north-rail', position: [summit[0], summit[1] + .75, summit[2] - 6], size: [16, 1.5, .18], rotation: [0, 0, 0] },
    { id: 'summit-east-rail', position: [summit[0] + 8, summit[1] + .75, summit[2]], size: [.18, 1.5, 12], rotation: [0, 0, 0] },
  ];
  // The gate stands a few metres down the footpath, clear of the access road's turning circle.
  const a0 = trail.points[0], b = trail.points[6], dx = b[0] - a0[0], dz = b[2] - a0[2], length = Math.hypot(dx, dz);
  const a = [a0[0] + dx / length * 6, 0, a0[2] + dz / length * 6];
  for (const side of [-1, 1]) {
    const x = a[0] - dz / length * side * 1.1, z = a[2] + dx / length * side * 1.1;
    boxes.push({ id: `summit-gate-${side}`, position: [x, terrainHeight(x, z) + .55, z], size: [.56, 1.1, .56], rotation: [0, 0, 0] });
  }
  return boxes;
}
export function waterfallBarrierBox(): TraversalBox {
  return { id: 'silverthread-rock-barrier', position: [50, terrainHeight(47, -385) + 6, -383], size: [8, 22, 8], rotation: [0, 0, 0] };
}
