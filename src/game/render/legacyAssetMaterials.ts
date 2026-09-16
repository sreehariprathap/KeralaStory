import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface LegacyMaterial {
  pbrMetallicRoughness?: object;
  extensions?: { KHR_materials_pbrSpecularGlossiness?: {
    diffuseFactor?: number[]; diffuseTexture?: object; glossinessFactor?: number;
  } };
}

/** Approximate diffuse/gloss legacy assets as nonmetallic PBR, retaining their texture palette. */
export function convertLegacyMaterials(materials: LegacyMaterial[]) {
  for (const material of materials) {
    const legacy = material.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (!legacy || material.pbrMetallicRoughness) continue;
    material.pbrMetallicRoughness = {
      baseColorFactor: legacy.diffuseFactor ?? [1, 1, 1, 1],
      ...(legacy.diffuseTexture ? { baseColorTexture: legacy.diffuseTexture } : {}),
      metallicFactor: 0, roughnessFactor: Math.max(.45, 1 - (legacy.glossinessFactor ?? .5)),
    };
  }
}

export function configureLegacyAssetMaterials(loader: GLTFLoader) {
  loader.register(parser => ({
    name: 'KHR_materials_pbrSpecularGlossiness',
    beforeRoot: async () => { convertLegacyMaterials(parser.json.materials ?? []); },
  }));
  return loader;
}
