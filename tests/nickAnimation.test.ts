import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Bone, Object3D, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createNickAnimation } from '../src/game/player/nickAnimation';

const nickUrl = '/assets/characters/nick_unused_model.glb';

if (typeof globalThis.ProgressEvent === 'undefined') {
  class NodeProgressEvent extends Event {
    readonly lengthComputable = false;
    readonly loaded = 0;
    readonly total = 0;
  }
  globalThis.ProgressEvent = NodeProgressEvent as typeof ProgressEvent;
}

type NickRig = {
  root: Object3D;
  bones: Map<string, Bone>;
};

function readNickJsonAndBinary() {
  const file = readFileSync(resolve(process.cwd(), 'public', nickUrl.slice(1)));
  expect(file.subarray(0, 4).toString('ascii')).toBe('glTF');
  let offset = 12;
  let json: {
    buffers?: { byteLength: number; uri?: string }[];
    materials?: unknown[];
    textures?: unknown[];
    images?: unknown[];
    samplers?: unknown[];
    meshes?: { primitives?: { material?: number }[] }[];
  } | undefined;
  let binary: Uint8Array | undefined;
  while (offset < file.byteLength) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const chunk = file.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as typeof json;
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error('Nick GLB is missing JSON or binary data.');
  return { json, binary };
}

async function loadNickRig(): Promise<NickRig> {
  const { json, binary } = readNickJsonAndBinary();
  // Keep nodes, skins, accessors, and meshes, but avoid Node-only image decoding.
  delete json.materials;
  delete json.textures;
  delete json.images;
  delete json.samplers;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material;
  }
  json.buffers = [{ byteLength: binary.byteLength, uri: `data:application/octet-stream;base64,${Buffer.from(binary).toString('base64')}` }];
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const root = clone(gltf.scene);
  const bones = new Map<string, Bone>();
  root.traverse((object) => {
    if (object instanceof Bone && object.name.match(/Nick:?(Hip|Knee|Shoulder|Elbow)_([LR])_0\d+$/)) bones.set(object.name, object);
  });
  return { root, bones };
}

function boneWorldPosition(bone: Bone) {
  bone.updateWorldMatrix(true, false);
  return bone.getWorldPosition(new Vector3());
}

function snapshotLocalPose(rig: NickRig) {
  return [...rig.bones.entries()].map(([name, bone]) => [name, bone.quaternion.clone()] as const);
}

function rigFromRoot(root: Object3D): NickRig {
  const bones = new Map<string, Bone>();
  root.traverse((object) => {
    if (object instanceof Bone && object.name.match(/Nick:?(Hip|Knee|Shoulder|Elbow)_([LR])_0\d+$/)) bones.set(object.name, object);
  });
  return { root, bones };
}

function expectPoseEqual(a: NickRig, b: NickRig) {
  for (const [name, quaternion] of snapshotLocalPose(a)) {
    expect(b.bones.get(name)?.quaternion.angleTo(quaternion)).toBeLessThan(1e-5);
  }
}

describe('Nick GLB animation', () => {
  it('loads the actual rig and drops both hands from its T pose at idle', async () => {
    const rig = await loadNickRig();
    expect(rig.bones.size).toBe(8);
    const leftElbow = rig.bones.get('NickElbow_L_017');
    const rightElbow = rig.bones.get('NickElbow_R_036');
    if (!leftElbow || !rightElbow) throw new Error('Nick elbow bones are missing.');
    const leftRest = boneWorldPosition(leftElbow);
    const rightRest = boneWorldPosition(rightElbow);
    const animator = createNickAnimation(rig.root);
    animator.update(0, { speed: 0, grounded: true });
    expect(boneWorldPosition(leftElbow).y).toBeLessThan(leftRest.y - 0.01);
    expect(boneWorldPosition(rightElbow).y).toBeLessThan(rightRest.y - 0.01);
  });

  it('moves the skinned rig and alternates feet and arms while walking', async () => {
    const rig = await loadNickRig();
    const skinnedMeshes: SkinnedMesh[] = [];
    rig.root.traverse((object) => { if (object instanceof SkinnedMesh) skinnedMeshes.push(object); });
    const leftKnee = rig.bones.get('NickKnee_L_00');
    const rightKnee = rig.bones.get('NickKnee_R_06');
    const leftShoulder = rig.bones.get('NickShoulder_L_016');
    const rightShoulder = rig.bones.get('NickShoulder_R_035');
    if (skinnedMeshes.length === 0 || !leftKnee || !rightKnee || !leftShoulder || !rightShoulder) throw new Error('Nick skinned limb bones are missing.');
    const animator = createNickAnimation(rig.root);
    animator.update(0, { speed: 3.5, grounded: true });
    rig.root.updateMatrixWorld(true);
    const vertexBefore = skinnedMeshes.map((mesh) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => mesh.getVertexPosition(index, new Vector3()).clone()));
    const first = [leftKnee.quaternion.clone(), rightKnee.quaternion.clone(), leftShoulder.quaternion.clone(), rightShoulder.quaternion.clone()];
    animator.update(0.18, { speed: 3.5, grounded: true });
    rig.root.updateMatrixWorld(true);
    const maxVertexMovement = skinnedMeshes.reduce((max, mesh, meshIndex) => Math.max(max, vertexBefore[meshIndex].reduce((meshMax, before, index) => Math.max(meshMax, mesh.getVertexPosition(index, new Vector3()).distanceTo(before)), 0)), 0);
    const second = [leftKnee.quaternion, rightKnee.quaternion, leftShoulder.quaternion, rightShoulder.quaternion];
    expect(second.some((quaternion, index) => quaternion.angleTo(first[index]) > 0.03)).toBe(true);
    expect(leftKnee.quaternion.angleTo(rightKnee.quaternion)).toBeGreaterThan(0.03);
    expect(leftShoulder.quaternion.angleTo(rightShoulder.quaternion)).toBeGreaterThan(0.03);
    expect(maxVertexMovement).toBeGreaterThan(0.001);
  });

  it('settles back to a stable idle pose after walking stops', async () => {
    const rig = await loadNickRig();
    const animator = createNickAnimation(rig.root);
    animator.update(0, { speed: 0, grounded: true });
    const idle = snapshotLocalPose(rig);
    for (let i = 0; i < 90; i++) animator.update(1 / 60, { speed: 0, grounded: true });
    const settled = snapshotLocalPose(rig);
    for (let i = 0; i < idle.length; i++) expect(settled[i][1].angleTo(idle[i][1])).toBeLessThan(0.01);
  });

  it('does not mutate the parsed source and keeps cloned rigs independent', async () => {
    const source = await loadNickRig();
    const first = rigFromRoot(clone(source.root));
    const second = rigFromRoot(clone(source.root));
    const firstAnimator = createNickAnimation(first.root);
    const sourceBefore = snapshotLocalPose(source);
    firstAnimator.update(0.2, { speed: 4, grounded: true });
    expect(snapshotLocalPose(source)).toEqual(sourceBefore);
    expectPoseEqual(source, second);
    expect(snapshotLocalPose(first)).not.toEqual(snapshotLocalPose(second));
  });

  it('preserves the same local pose when the character root heading changes', async () => {
    const first = await loadNickRig();
    const second = await loadNickRig();
    second.root.rotation.y = Math.PI * 0.63;
    const firstAnimator = createNickAnimation(first.root);
    const secondAnimator = createNickAnimation(second.root);
    const sequence = [
      [0.16, { speed: 2.8, grounded: true }],
      [0.16, { speed: 2.8, grounded: true }],
      [0.16, { speed: 0, grounded: true }],
    ] as const;
    for (const [delta, motion] of sequence) {
      firstAnimator.update(delta, motion);
      secondAnimator.update(delta, motion);
    }
    expectPoseEqual(first, second);
  });
});
