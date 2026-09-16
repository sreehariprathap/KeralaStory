import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { convertLegacyMaterials } from '../src/game/render/legacyAssetMaterials';
import { prepareEnvironmentAsset } from '../src/game/render/prepareEnvironmentAsset';
import { COFFEE_COLLISION_PROFILE, V2_ASSET_PROFILES, type V2AssetProfile } from '../src/content/assets/v2AssetProfiles';

// GLTFLoader's FileLoader reports progress in browsers; provide the tiny subset
// it constructs when these extraction tests run under Node.
if (typeof globalThis.ProgressEvent === 'undefined') {
  class NodeProgressEvent {
    readonly type: string;
    readonly lengthComputable = false;
    readonly loaded = 0;
    readonly total = 0;
    constructor(type: string) { this.type = type; }
  }
  (globalThis as unknown as { ProgressEvent: typeof NodeProgressEvent }).ProgressEvent = NodeProgressEvent;
}

function profile(overrides: Partial<V2AssetProfile> = {}): V2AssetProfile {
  return { id: 'test', label: 'test', url: '', rotationY: 0, sizeAxis: 'y', sizeM: 2,
    removeNodes: [], note: '', ...overrides };
}

function mesh(name: string, size: [number, number, number], position: [number, number, number]) {
  const object = new Mesh(new BoxGeometry(...size), new MeshStandardMaterial({ color: 0x336699 }));
  object.name = name;
  object.position.set(...position);
  return object;
}

describe('environment asset preparation', () => {
  it('excludes explicitly selected nodes before computing bounds', () => {
    const source = new Group();
    source.add(mesh('keep', [2, 2, 2], [0, 1, 0]), mesh('presentation', [100, 100, 100], [0, 50, 0]));
    const prepared = prepareEnvironmentAsset(source, profile({ removeNodes: ['presentation'] }));
    expect(prepared.meshes).toBe(1);
    expect(prepared.size.y).toBeCloseTo(2);
    expect(new Box3().setFromObject(prepared.root).getSize(new Vector3()).y).toBeCloseTo(2);
  });

  it('normalizes the target axis and centers the base', () => {
    const prepared = prepareEnvironmentAsset(mesh('source', [4, 4, 2], [3, 7, -2]), profile({ sizeAxis: 'y', sizeM: 8 }));
    const bounds = new Box3().setFromObject(prepared.root, true);
    expect(prepared.size.y).toBeCloseTo(8);
    expect(bounds.min.y).toBeCloseTo(0);
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(0);
    expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(0);
  });

  it('does not mutate source transforms/materials and dispose only cleans clone materials', () => {
    const material = new MeshStandardMaterial({ color: 0x123456 });
    const texture = new Texture();
    material.map = texture;
    const source = mesh('source', [1, 2, 3], [4, 5, 6]);
    source.material = material;
    const beforePosition = source.position.clone();
    const beforeColor = material.color.getHex();
    let sourceGeometryDisposed = false;
    const disposeGeometry = source.geometry.dispose.bind(source.geometry);
    source.geometry.dispose = () => { sourceGeometryDisposed = true; disposeGeometry(); };
    const prepared = prepareEnvironmentAsset(source, profile());
    const cloneMesh = prepared.root.getObjectByName('source') as Mesh;
    const cloneMaterial = cloneMesh.material as MeshStandardMaterial;
    const sourceMaterialDispose = vi.spyOn(material, 'dispose');
    const sourceTextureDispose = vi.spyOn(texture, 'dispose');
    const cloneMaterialDispose = vi.spyOn(cloneMaterial, 'dispose');
    expect(source.position.equals(beforePosition)).toBe(true);
    expect(material.color.getHex()).toBe(beforeColor);
    expect(cloneMesh.material).not.toBe(material);
    prepared.dispose();
    expect(sourceGeometryDisposed).toBe(false);
    expect(sourceMaterialDispose).not.toHaveBeenCalled();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
    expect(cloneMaterialDispose).toHaveBeenCalledOnce();
  });

  it('reports missing selectors and degenerate bounds', () => {
    expect(() => prepareEnvironmentAsset(new Group(), profile({ removeNodes: ['missing'] }))).toThrow(/missing extraction node/);
    expect(() => prepareEnvironmentAsset(new Group(), profile({ removePatterns: [/missing-pattern/] }))).toThrow(/missing extraction pattern/);
    expect(() => prepareEnvironmentAsset(mesh('flat', [1, 0, 1], [0, 0, 0]), profile())).toThrow(/invalid model bounds/);
  });
});

type LegacyTestMaterial = {
  pbrMetallicRoughness?: object;
  extensions?: { KHR_materials_pbrSpecularGlossiness?: {
    diffuseFactor?: number[];
    diffuseTexture?: object;
    glossinessFactor?: number;
  } };
};

describe('legacy material conversion', () => {
  it('retains diffuse texture and factor while creating nonmetallic PBR', () => {
    const diffuseTexture = { index: 3 };
    const materials: LegacyTestMaterial[] = [{ extensions: { KHR_materials_pbrSpecularGlossiness: {
      diffuseFactor: [0.2, 0.4, 0.6, 1], diffuseTexture, glossinessFactor: 0.8,
    } } }];
    convertLegacyMaterials(materials);
    expect(materials[0].pbrMetallicRoughness).toEqual({ baseColorFactor: [0.2, 0.4, 0.6, 1], baseColorTexture: diffuseTexture, metallicFactor: 0, roughnessFactor: 0.45 });
  });

  it('does not overwrite an existing PBR material', () => {
    const pbr = { baseColorFactor: [1, 0, 0, 1] };
    const materials: LegacyTestMaterial[] = [{ pbrMetallicRoughness: pbr, extensions: { KHR_materials_pbrSpecularGlossiness: { diffuseFactor: [0, 1, 0, 1] } } }];
    convertLegacyMaterials(materials);
    expect(materials[0].pbrMetallicRoughness).toBe(pbr);
  });
});

function sanitizedGlb(url: string): ArrayBuffer {
  const file = readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
  let offset = 12;
  let json: Record<string, any> | undefined;
  let bin: Uint8Array | undefined;
  while (offset < file.byteLength) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const chunk = file.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    offset += 8 + length;
  }
  if (!json || !bin) throw new Error(`Invalid GLB: ${url}`);
  json.buffers = json.buffers ?? [{}];
  json.buffers[0] = { byteLength: bin.byteLength, uri: `data:application/octet-stream;base64,${Buffer.from(bin).toString('base64')}` };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  if (json.materials) json.materials = json.materials.map((material: { name?: string }) => ({ name: material.name }));
  return new TextEncoder().encode(JSON.stringify(json)).buffer;
}

describe('supplied V2 GLB extraction and normalization', () => {
  it('loads every review profile and produces finite target-axis dimensions', async () => {
    for (const assetProfile of V2_ASSET_PROFILES) {
      const gltf = await new GLTFLoader().parseAsync(sanitizedGlb(assetProfile.url), '');
      const prepared = prepareEnvironmentAsset(gltf.scene, assetProfile);
      expect(prepared.size[assetProfile.sizeAxis]).toBeCloseTo(assetProfile.sizeM, 4);
      expect(prepared.size.toArray().every(Number.isFinite)).toBe(true);
      prepared.dispose();
    }
  }, 15000);

  it('removes the coffee presentation plane while retaining Piso_3', async () => {
    const gltf = await new GLTFLoader().parseAsync(sanitizedGlb('/assets/buildings/coffee_shop_isometric.glb'), '');
    const prepared = prepareEnvironmentAsset(gltf.scene, V2_ASSET_PROFILES.find(asset => asset.id === 'coffee-shop')!);
    expect(prepared.root.getObjectByName('Plane003_61')).toBeUndefined();
    expect(prepared.root.getObjectByName('Piso_3')).toBeDefined();
    const shell = new Box3().setFromObject(prepared.root.getObjectByName('Edificio_0')!, true);
    const proxy = new Box3().setFromCenterAndSize(new Vector3(...COFFEE_COLLISION_PROFILE.shellPosition), new Vector3(...COFFEE_COLLISION_PROFILE.shellSize));
    expect(proxy.containsBox(shell)).toBe(true);
    expect(proxy.getSize(new Vector3()).distanceTo(shell.getSize(new Vector3()))).toBeLessThan(.06);
    const floor = new Box3().setFromObject(prepared.root.getObjectByName('Piso_3')!, true);
    expect(Math.abs(floor.max.y - COFFEE_COLLISION_PROFILE.floorSize[1])).toBeLessThan(.02);
    prepared.dispose();
  });

  it('removes the Silver Storm navigation and camera helpers', async () => {
    const gltf = await new GLTFLoader().parseAsync(sanitizedGlb('/park/amusement_park.glb'), '');
    const prepared = prepareEnvironmentAsset(gltf.scene, V2_ASSET_PROFILES.find(asset => asset.id === 'silver-storm')!);
    expect(prepared.root.getObjectByName('CubeNavigationCollider')).toBeUndefined();
    const remainingNames: string[] = [];
    prepared.root.traverse(node => remainingNames.push(node.name));
    expect(remainingNames.some(name => /^NavCollider__/.test(name))).toBe(false);
    expect(remainingNames.some(name => /^camera__[124]_$/.test(name))).toBe(false);
    prepared.dispose();
  }, 15000);
});
