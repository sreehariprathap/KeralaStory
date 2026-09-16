import RAPIER from '@dimforge/rapier3d-compat';
import type { SimulationWorldDefinition } from './worldDefinition';

/** XYZ Euler convention matches the browser's authored boxes. */
function rotation([x, y, z]: readonly number[]) {
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2), cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return { x: sx * cy * cz + cx * sy * sz, y: cx * sy * cz - sx * cy * sz, z: cx * cy * sz + sx * sy * cz, w: cx * cy * cz - sx * sy * sz };
}
export function assembleStaticColliders(world: RAPIER.World, definition: SimulationWorldDefinition) {
  const colliders = new Map<string, RAPIER.Collider>();
  for (const mesh of definition.meshes) {
    colliders.set(mesh.id, world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)).setFriction(.9)));
  }
  for (const box of definition.boxes) {
    if (colliders.has(box.id)) throw new Error(`Duplicate collider ${box.id}`);
    colliders.set(box.id, world.createCollider(RAPIER.ColliderDesc.cuboid(box.size[0] / 2, box.size[1] / 2, box.size[2] / 2)
      .setTranslation(box.position[0], box.position[1], box.position[2]).setRotation(rotation(box.rotation)).setFriction(.9)));
  }
  return colliders;
}
