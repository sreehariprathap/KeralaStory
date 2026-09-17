import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Box3, Bone, Mesh, Object3D, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createNickAnimation } from '../src/game/player/nickAnimation';
import { CHARACTER_MODELS } from '../src/content/assets/models';

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
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength: number }[];
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

function embeddedImageBytes(glb: ParsedGlb, imageIndex: number): Uint8Array {
  const image = glb.json.images?.[imageIndex];
  const view = image?.bufferView === undefined ? undefined : glb.json.bufferViews?.[image.bufferView];
  if (!image || !view) throw new Error(`Image ${imageIndex} is not embedded in the GLB.`);
  const start = view.byteOffset ?? 0;
  return glb.binary.subarray(start, start + view.byteLength);
}

function imageMetadata(image: { bufferView?: number; mimeType?: string }) {
  const { bufferView: _bufferView, ...metadata } = image;
  return metadata;
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

describe.each(CHARACTER_MODELS)('$name selectable avatar', model => {
  it('deforms both arms and both legs in each locomotion state with finite normalized skin weights', {timeout:60000}, async () => {
    const root = await loadTextureFree(model.url.split('/').pop()!);
    root.rotation.y = model.rotationY;
    root.updateMatrixWorld(true);
    const animator = createNickAnimation(root, model.rig);
    animator.update(0, {speed:0,grounded:true});
    const samples = new Map<string, {mesh:SkinnedMesh; index:number; before:Vector3}[]>();
    for(const mesh of skinnedMeshes(root)){
      const weights=mesh.geometry.getAttribute('skinWeight'), indices=mesh.geometry.getAttribute('skinIndex');
      for(let i=0;i<weights.count;i++){
        let sum=0;
        for(let j=0;j<4;j++){
          const weight=weights.getComponent(i,j); sum+=weight;
          expect(Number.isFinite(weight)&&weight>=0).toBe(true);
          if(weight<.5)continue;
          const bone=mesh.skeleton.bones[indices.getComponent(i,j)];
          const match=bone.name.match(/(?:Hip|Knee|Shoulder|Elbow)_([LR])_/)??bone.name.match(/J_Bip_([LR])_(?:Upper|Lower)(?:Arm|Leg)_/);
          if(!match)continue;
          const limb=/(Shoulder|Elbow|Arm)/.test(bone.name)?'arm':'leg', key=limb+match[1];
          const list=samples.get(key)??[];
          if(list.length<100)list.push({mesh,index:i,before:mesh.getVertexPosition(i,new Vector3()).clone()});
          samples.set(key,list);
        }
        expect(Math.abs(sum-1)).toBeLessThan(.001);
      }
    }
    expect([...samples.keys()].sort()).toEqual(['armL','armR','legL','legR']);
    for(const motion of [{speed:3.5,grounded:true},{speed:6,grounded:true},{speed:2,grounded:false},{speed:2,grounded:true,riding:true}]){
      for(let i=0;i<30;i++)animator.update(1/60,motion);
      root.updateMatrixWorld(true);
      for(const [limb,list] of samples){
        const distances=list.map(s=>s.mesh.getVertexPosition(s.index,new Vector3()).distanceTo(s.before));
        expect(distances.every(Number.isFinite)).toBe(true);
        expect(Math.max(...distances),`${model.name} ${limb} ${JSON.stringify(motion)}`).toBeGreaterThan(.005);
      }
    }
  });
});

describe('School uniform arm weighting regression', () => {
  it('moves the whole arm surface together without stretching triangles back into the T pose', { timeout: 30_000 }, async () => {
    const root = await loadTextureFree('arms_out_in_uniform_rigged.glb');
    let armVertices = 0, minArmWeight = 1, maxStretch = 1;
    const samples = skinnedMeshes(root).map(mesh => {
      const position = mesh.geometry.getAttribute('position');
      const joints = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      const before = Array.from({ length: position.count }, (_, i) => mesh.getVertexPosition(i, new Vector3()).clone());
      const isArm = before.map((p, i) => {
        if (Math.abs(p.x) / 1.7 < .15 || p.y / 1.7 < .64 || p.y / 1.7 > .74) return false;
        const expected = p.x > 0 ? [4, 5, 6] : [10, 11, 12];
        let influence = 0;
        for (let slot = 0; slot < 4; slot++) if (expected.includes(joints.getComponent(i, slot))) influence += weights.getComponent(i, slot);
        minArmWeight = Math.min(minArmWeight, influence);
        armVertices++;
        return true;
      });
      return { mesh, before, isArm };
    });
    expect(armVertices).toBeGreaterThan(1000);
    expect(minArmWeight).toBeGreaterThan(.999);
    const animator = createNickAnimation(root, 'uniform');
    for (const speed of [0, 3.5]) {
      if (!speed) animator.update(0, { speed, grounded: true });
      else for (let i = 0; i < 30; i++) animator.update(1 / 60, { speed, grounded: true });
      root.updateMatrixWorld(true);
      for (const { mesh, before, isArm } of samples) {
        const index = mesh.geometry.index;
        const count = index?.count ?? before.length;
        const a = new Vector3(), b = new Vector3();
        for (let i = 0; i < count; i += 3) for (let edge = 0; edge < 3; edge++) {
          const u = index ? index.getX(i + edge) : i + edge;
          const v = index ? index.getX(i + (edge + 1) % 3) : i + (edge + 1) % 3;
          if (!isArm[u] || !isArm[v]) continue;
          const rest = before[u].distanceTo(before[v]);
          if (rest < 1e-5) continue;
          const current = mesh.getVertexPosition(u, a).distanceTo(mesh.getVertexPosition(v, b));
          maxStretch = Math.max(maxStretch, current / rest);
        }
      }
    }
    expect(maxStretch).toBeLessThan(1.6);
  });
});

describe.each([
  { label: 'kid boy', rig: 'kid-boy' as const, original: 'kid_boy.glb', generated: 'kid_boy_rigged.glb', meshCount: 22 },
  { label: 'little girl', rig: 'little-girl' as const, original: 'the_little_girl.glb', generated: 'the_little_girl_rigged.glb', meshCount: 1 },
  { label: 'school uniform', rig: 'uniform' as const, original: 'arms_out_in_uniform.glb', generated: 'arms_out_in_uniform_rigged.glb', meshCount: 6 },
])('$label generated GLB rig', ({ rig, original, generated, meshCount }) => {
  it('contains the expected skinned meshes and valid four weight influences', { timeout: 30_000 }, async () => {
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
      const tangents = mesh.geometry.getAttribute('tangent');
      if (tangents) {
        expect(tangents.itemSize).toBe(4);
        let invalidTangent = 0;
        let invalidHandedness = 0;
        let maxLengthError = 0;
        for (let i = 0; i < tangents.count; i++) {
          const x = tangents.getX(i);
          const y = tangents.getY(i);
          const z = tangents.getZ(i);
          const w = tangents.getW(i);
          if (![x, y, z, w].every(Number.isFinite)) {
            invalidTangent++;
            continue;
          }
          maxLengthError = Math.max(maxLengthError, Math.abs(Math.hypot(x, y, z) - 1));
          if (Math.abs(Math.abs(w) - 1) >= 1e-5) invalidHandedness++;
        }
        expect(invalidTangent).toBe(0);
        expect(maxLengthError).toBeLessThan(0.01);
        expect(invalidHandedness).toBe(0);
      }
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

  it('keeps the normalized bind pose aligned with the original loaded model', { timeout: 30_000 }, async () => {
    const source = normalizedSourceVertices(await loadTextureFree(original));
    const generatedVertices = vertices(await loadTextureFree(generated));
    expect(generatedVertices).toHaveLength(source.length);
    let maxError = 0;
    for (let i = 0; i < source.length; i++) maxError = Math.max(maxError, generatedVertices[i].distanceTo(source[i]));
    expect(maxError).toBeLessThan(1e-5);
  });

  it('moves arm and leg vertices while keeping root-weighted head and torso stable', { timeout: 30_000 }, async () => {
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

  it('returns to the same idle pose after walking stops and leaves clones independent', { timeout: 30_000 }, async () => {
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

  it('preserves source materials and embedded image data', () => {
    const source = readGlb(original);
    const derived = readGlb(generated);
    expect(derived.json.materials).toEqual(source.json.materials);
    expect(derived.json.textures).toEqual(source.json.textures);
    expect(derived.json.samplers).toEqual(source.json.samplers);
    const sourceImages = source.json.images ?? [];
    const derivedImages = derived.json.images ?? [];
    expect(derivedImages).toHaveLength(sourceImages.length);
    for (let i = 0; i < sourceImages.length; i++) {
      expect(imageMetadata(derivedImages[i]), `image ${i} metadata`).toEqual(imageMetadata(sourceImages[i]));
      expect(Buffer.from(embeddedImageBytes(derived, i)).equals(Buffer.from(embeddedImageBytes(source, i))), `image ${i} bytes`).toBe(true);
    }
  });
});
