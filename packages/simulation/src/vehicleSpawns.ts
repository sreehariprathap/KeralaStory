import type { Vec3 } from '@kerala-story/protocol';
import type { SimulationWorldDefinition } from './worldDefinition';
export function sharedVehicleSpawns(definition: SimulationWorldDefinition) {
  const origin = definition.safeSpawns.find(spawn => spawn.id === 'origin-parking-spawn') ?? definition.safeSpawns[0];
  const position = (dx: number, dz: number): Vec3 => { const x = origin.position[0] + dx, z = origin.position[2] + dz; return [x, (definition.groundHeight(x, z) ?? origin.position[1]) + .06, z]; };
  return [
    { id: 'shared-origin-car', kind: 'car' as const, modelId: 'admin', position: position(0, 5), headingRad: Math.PI },
    { id: 'shared-origin-bicycle', kind: 'bicycle' as const, modelId: 'bicycle', position: position(-2, 0), headingRad: Math.PI },
  ];
}
