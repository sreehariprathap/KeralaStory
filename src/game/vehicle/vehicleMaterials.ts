import { Color, MeshStandardMaterial, type Material, type Mesh, type Object3D } from 'three';
import type { CarModelId } from '../../content/assets/models';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';

/** Removes source nodes that are not part of the vehicle. Must run before measuring bounds. */
export function removeHiddenVehicleNodes(scene: Object3D, carModel: CarModelId) {
  const hidden = VEHICLE_PROFILES[carModel].hiddenNodes ?? [];
  if (!hidden.length) return;
  const doomed: Object3D[] = [];
  scene.traverse(object => { if (hidden.includes(object.name)) doomed.push(object); });
  doomed.forEach(object => object.removeFromParent());
}

/** Replaces source materials per the vehicle profile. The caller owns and disposes `owned`. */
export function applyVehicleMaterials(scene: Object3D, carModel: CarModelId) {
  const profile = VEHICLE_PROFILES[carModel];
  const owned: Material[] = [], paint: MeshStandardMaterial[] = [];
  if (!profile.paint && !profile.materialOverrides) return { owned, paint };
  const byName = new Map<string, Material>();
  scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const sourceName = mesh.material.name;
    let replacement = byName.get(sourceName);
    if (!replacement) {
      if (profile.paint?.materials.includes(sourceName)) {
        const material = new MeshStandardMaterial({ name: `paint-${sourceName}`, color: profile.paint.defaultColor, metalness: .45, roughness: .32 });
        paint.push(material);
        replacement = material;
      } else {
        const look = profile.materialOverrides?.[sourceName] ?? profile.materialOverrides?.['*'];
        if (!look) return;
        replacement = new MeshStandardMaterial({
          name: `look-${sourceName}`, color: look.color, metalness: look.metalness ?? 0, roughness: look.roughness ?? .6,
          transparent: look.opacity !== undefined && look.opacity < 1, opacity: look.opacity ?? 1, emissive: new Color(look.emissive ?? '#000000'),
        });
      }
      byName.set(sourceName, replacement);
      owned.push(replacement);
    }
    mesh.material = replacement;
  });
  return { owned, paint };
}
