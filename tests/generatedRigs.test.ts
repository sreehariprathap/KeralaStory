import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Box3, Bone, Mesh, Object3D, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createNickAnimation } from '../src/game/player/nickAnimation';

if (typeof globalThis.ProgressEvent === 'undefined') {
  class NodeProgressEvent extends Event {
    readonly lengthComputable = false;
    readonly loaded = 0;
    readonly total = 0;
  }
  globalThis.ProgressEvent = NodeProgressEvent as typeof ProgressEvent;
}

type Json = {
  buffers?: { byteLength: number; uri?: string }[];
  materials?: unknown[];
  textures?: unknown[];
  images?: { bufferView?: number; mimeType?: string }[];
  samplers?: unknown[];
  meshes?: { primitives?: { material?: number }[] }[];
  skins?: { joints: number[] }[];
};

type ParsedGlb = { json: Json; binary: Uint8Array; file: Uint8Array };

function readGlb(name: string): ParsedGlb {
  const file = readFileSync(resolve(process.cwd(), 'public/assets/characters', name));
  expect(file.subarray(0, 4).toString('ascii')).toBe('glTF');
  let offset = 12;
  let json: Json | undefined;
  let binary: Uint8Array | undefined;
  while (offset < file.byteLength) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const chunk = file.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as Json;
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error(`${name} is missing JSON or binary data.`);
  return { json, binary, file };
}

async function loadTextureFree(name: string): Promise<Object3D> {
  const { json, binary } = readGlb(name);
  delete json.materials;
  delete json.textures;
  delete json.images;
  delete json.samplers;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material;
  }
  json.buffers = [{ byteLength: binary.byteLength, uri: `data:application/octet-stream;base64,${Buffer.from(binary).toString('base64')}` }];
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}

function meshes(root: Object3D): Mesh[] {
  const result: Mesh[] = [];
  root.traverse((object) => { if (object instanceof Mesh) result.push(object); });
  return result;
}

function skinnedMeshes(root: Object3D): SkinnedMesh[] {
  return meshes(root).filter((mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh);
}

function vertices(root: Object3D): Vector3[] {
  root.updateMatrixWorld(true);
  return meshes(root).flatMap((mesh) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) =>
    mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld)));
}

function normalizedSourceVertices(root: Object3D): Vector3[] {
  const source = vertices(root);
  const bounds = new Box3().setFromPoints(source);
  const height = bounds.max.y - bounds.min.y;
  const center = bounds.getCenter(new Vector3());
  return source.map((point) => new Vector3(
    ((point.x - center.x) / height) * 1.7,
    ((point.y - bounds.min.y) / height) * 1.7,
    ((point.z - center.z) / height) * 1.7,
  ));
}

function poseSnapshot(root: Object3D) {
  const pose: [string, ReturnType<Bone['quaternion']['clone']>][] = [];
  root.traverse((object) => { if (object instanceof Bone) pose.push([object.name, object.quaternion.clone()]); });
  return pose;
}

function expectSamePose(a: Object3D, b: Object3D) {
  const second = new Map(poseSnapshot(b));
  for (const [name, quaternion] of poseSnapshot(a)) {
    expect(second.get(name)?.angleTo(quaternion), name).toBeLessThan(1e-5);
  }
}

describe.each([
  { label: 'kid boy', rig: 'kid-boy' as const, original: 'kid_boy.glb', generated: 'kid_boy_rigged.glb', meshCount: 22 },
  { label: 'little girl', rig: 'little-girl' as const, original: 'the_little_girl.glb', generated: 'the_little_girl_rigged.glb', meshCount: 1 },
])('$label generated GLB rig', ({ rig, original, generated, meshCount }) => {
  it('contains the expected skinned meshes and valid four weight influences', async () => {
    const root = await loadTextureFree(generated);
    const skinned = skinnedMeshes(root);
    expect(skinned).toHaveLength(meshCount);
    const source = readGlb(generated);
    expect(source.json.skins?.[0]?.joints).toHaveLength(13);
    let invalidIndex = 0;
    let invalidWeight = 0;
    let maxWeightError = 0;
    for (const mesh of skinned) {
      const indices = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      expect(indices.itemSize).toBe(4);
      expect(weights.itemSize).toBe(4);
      for (let i = 0; i < indices.count; i++) {
        let sum = 0;
        for (let slot = 0; slot < 4; slot++) {
          const joint = indices.getComponent(i, slot);
          if (joint < 0 || joint >= 13) invalidIndex++;
          const weight = weights.getComponent(i, slot);
          if (weight < 0 || !Number.isFinite(weight)) invalidWeight++;
          sum += weight;
        }
        maxWeightError = Math.max(maxWeightError, Math.abs(sum - 1));
      }
    }
    expect(invalidIndex).toBe(0);
    expect(invalidWeight).toBe(0);
    expect(maxWeightError).toBeLessThan(1e-5);
  });

  it('keeps the normalized bind pose aligned with the original loaded model', async () => {
    const source = normalizedSourceVertices(await loadTextureFree(original));
    const generatedVertices = vertices(await loadTextureFree(generated));
    expect(generatedVertices).toHaveLength(source.length);
    for (let i = 0; i < source.length; i++) {
      expect(generatedVertices[i].distanceTo(source[i]), `vertex ${i}`).toBeLessThan(1e-5);
    }
  });

  it('moves arm and leg vertices while keeping root-weighted head and torso stable', async () => {
    const root = await loadTextureFree(generated);
    const animator = createNickAnimation(root, rig);
    const limbs = new Set([1, 2, 4, 5, 7, 8, 10, 11]);
    const moving: { mesh: SkinnedMesh; index: number; before: Vector3 }[] = [];
    const stable: { mesh: SkinnedMesh; index: number; before: Vector3 }[] = [];
    for (const mesh of skinnedMeshes(root)) {
      const position = mesh.geometry.getAttribute('position');
      const indices = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < position.count; i++) {
        const point = new Vector3().fromBufferAttribute(position, i);
        const dominant = Math.max(...Array.from({ length: 4 }, (_, slot) => weights.getComponent(i, slot)));
        const hasLimbWeight = Array.from({ length: 4 }, (_, slot) => indices.getComponent(i, slot)).some((index) => limbs.has(index));
        if (hasLimbWeight) moving.push({ mesh, index: i, before: mesh.getVertexPosition(i, new Vector3()) });
        if (!hasLimbWeight && dominant > 0.99 && point.y > 0.75) stable.push({ mesh, index: i, before: mesh.getVertexPosition(i, new Vector3()) });
      }
    }
    expect(moving.length).toBeGreaterThan(0);
    expect(stable.length).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) animator.update(1 / 60, { speed: 3.5, grounded: true });
    const maxMoving = moving.reduce((max, { mesh, index, before }) => Math.max(max, mesh.getVertexPosition(index, new Vector3()).distanceTo(before)), 0);
    const maxStable = stable.reduce((max, { mesh, index, before }) => Math.max(max, mesh.getVertexPosition(index, new Vector3()).distanceTo(before)), 0);
    expect(maxMoving).toBeGreaterThan(0.001);
    expect(maxStable).toBeLessThan(1e-5);
  });

  it('returns to the same idle pose after walking stops and leaves clones independent', async () => {
    const source = await loadTextureFree(generated);
    const first = clone(source);
    const second = clone(source);
    const animator = createNickAnimation(first, rig);
    animator.update(0, { speed: 0, grounded: true });
    const idle = poseSnapshot(first);
    for (let i = 0; i < 60; i++) animator.update(1 / 60, { speed: 3.5, grounded: true });
    for (let i = 0; i < 90; i++) animator.update(1 / 60, { speed: 0, grounded: true });
    for (let i = 0; i < idle.length; i++) expect(poseSnapshot(first)[i][1].angleTo(idle[i][1])).toBeLessThan(0.01);
    expectSamePose(source, second);
    expect(poseSnapshot(first)).not.toEqual(poseSnapshot(second));
  });
});
