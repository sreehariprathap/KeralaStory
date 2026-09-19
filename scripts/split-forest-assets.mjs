// Splits the multi-tree and multi-rock packs in asset-sources/forest/ into one small GLB per model,
// under public/assets/trees/forest/ and public/assets/rocks/forest/.
// Run: node scripts/split-forest-assets.mjs
//
// Every output is baked to world space, Y-up, centred on its footprint with its base at y = 0, so
// runtime code only needs to scale it. Heavy models are simplified, and pack bases (ground slabs)
// are dropped, and photo textures shrink to 256 px WebP (each split file carries its own copy). `npm run optimize:assets` still Draco-compresses the results for the build.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = join(root, 'asset-sources', 'forest');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

/**
 * group: 'node' keeps each mesh-bearing node's parent as one model (the pack stacks them at the origin);
 * 'spatial' splits merged meshes into connected pieces and gathers pieces that share a footprint.
 * shrinkTextures re-encodes photo textures. bakePalette turns a swatch-atlas texture into vertex
 * colours instead, since lossy resampling (here or in optimize-assets) bleeds swatches together. dropMaterials removes pack ground slabs. maxTriangles caps each output model. names gives each
 * model found, in pack order, its output name; null skips a model that does not suit the world
 * (bare dead trunks, a 21k-triangle baobab, near-duplicates).
 */
const PACKS = [
  { file: 'low_poly_tree_pack.glb', out: 'trees/forest', group: 'node', maxTriangles: 1500,
    names: ['round-broadleaf', 'pine', 'palm', null, 'cypress', 'wide-canopy', 'gnarled-dead', 'layered-bush'] },
  { file: 'low_poly_tree_with_twisting_branches.glb', out: 'trees/forest', group: 'all', maxTriangles: 1500, bakePalette: true, names: ['twisted'] },
  { file: 'low_poly_trees.glb', out: 'trees/forest', group: 'spatial', dropMaterials: /^Base/, maxTriangles: 1800,
    names: ['box-canopy', 'acacia-pair', null, 'slim-pine', null, 'tall-pine', 'drooping-palm', null] },
  { file: 'low_poly_rocks.glb', out: 'rocks/forest', group: 'spatial', maxTriangles: 400, shrinkTextures: true,
    names: Array.from({ length: 9 }, (_, i) => `rock-${i + 1}`) },
  { file: 'stylized_lowpoly_rock.glb', out: 'rocks/forest', group: 'all', maxTriangles: 600, shrinkTextures: true, names: ['boulder'] },
];

/** Every triangle in world space, tagged with its source primitive, so pieces can be regrouped. */
function collectTriangles(doc, dropMaterials) {
  const prims = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const matrix = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? '';
      if (dropMaterials?.test(name)) continue;
      const position = prim.getAttribute('POSITION');
      const count = position.getCount();
      const world = new Float32Array(count * 3), p = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        position.getElement(i, p);
        const [x, y, z] = p;
        world[i * 3] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        world[i * 3 + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        world[i * 3 + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
      }
      const indices = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: count }, (_, i) => i);
      prims.push({ node, prim, world, indices, group: node.getParentNode() ?? node });
    }
  }
  return prims;
}

/** Connected pieces across all primitives: shared indices, or coincident positions. */
function pieces(prims) {
  const offsets = [];
  let total = 0;
  for (const p of prims) { offsets.push(total); total += p.world.length / 3; }
  const parent = Int32Array.from({ length: total }, (_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  prims.forEach((p, k) => {
    for (let t = 0; t < p.indices.length; t += 3) { union(offsets[k] + p.indices[t], offsets[k] + p.indices[t + 1]); union(offsets[k] + p.indices[t], offsets[k] + p.indices[t + 2]); }
    for (let v = 0; v < p.world.length / 3; v++) {
      const key = `${p.world[v * 3].toFixed(3)},${p.world[v * 3 + 1].toFixed(3)},${p.world[v * 3 + 2].toFixed(3)}`;
      const other = seen.get(key);
      if (other === undefined) seen.set(key, offsets[k] + v); else union(other, offsets[k] + v);
    }
  });
  return { offsets, find };
}

function bounds(points) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], points[i + a]); max[a] = Math.max(max[a], points[i + a]); }
  return { min, max };
}

/**
 * Assigns each vertex of each primitive a model id. Returns one Int32Array per primitive.
 */
function assignModels(prims, group) {
  if (group === 'all') return prims.map(p => new Int32Array(p.world.length / 3));
  if (group === 'node') {
    const ids = new Map();
    return prims.map(p => { if (!ids.has(p.group)) ids.set(p.group, ids.size); return new Int32Array(p.world.length / 3).fill(ids.get(p.group)); });
  }
  // Spatial: connected pieces, then pieces whose ground footprints overlap belong to one model
  // (a trunk and the leaf clusters above it).
  const { offsets, find } = pieces(prims);
  const boxes = new Map();
  prims.forEach((p, k) => {
    for (let v = 0; v < p.world.length / 3; v++) {
      const r = find(offsets[k] + v);
      let b = boxes.get(r);
      if (!b) boxes.set(r, b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
      for (let a = 0; a < 3; a++) { b.min[a] = Math.min(b.min[a], p.world[v * 3 + a]); b.max[a] = Math.max(b.max[a], p.world[v * 3 + a]); }
    }
  });
  const roots = [...boxes.keys()];
  const cluster = new Map(roots.map(r => [r, r]));
  const top = r => { while (cluster.get(r) !== r) r = cluster.get(r); return r; };
  // Footprints must overlap by a real margin, so neighbouring trees stay apart.
  const overlaps = (a, b) => {
    const ox = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const oz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    const small = Math.min(a.max[0] - a.min[0], b.max[0] - b.min[0], a.max[2] - a.min[2], b.max[2] - b.min[2]);
    return ox > small * .3 && oz > small * .3;
  };
  let merged = true;
  while (merged) {
    merged = false;
    const groups = new Map();
    for (const r of roots) { const t = top(r); const b = boxes.get(r); const g = groups.get(t); if (!g) groups.set(t, { min: [...b.min], max: [...b.max] }); else for (let a = 0; a < 3; a++) { g.min[a] = Math.min(g.min[a], b.min[a]); g.max[a] = Math.max(g.max[a], b.max[a]); } }
    const keys = [...groups.keys()];
    for (let i = 0; i < keys.length && !merged; i++) for (let j = i + 1; j < keys.length && !merged; j++) {
      if (overlaps(groups.get(keys[i]), groups.get(keys[j]))) { cluster.set(keys[i], keys[j]); merged = true; }
    }
  }
  const ids = new Map();
  return prims.map((p, k) => Int32Array.from({ length: p.world.length / 3 }, (_, v) => {
    const t = top(find(offsets[k] + v));
    if (!ids.has(t)) ids.set(t, ids.size);
    return ids.get(t);
  }));
}

const srgbToLinear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;

/** Samples each vertex's swatch from the base colour texture into COLOR_0, then drops the textures. */
async function bakePalette(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const material = prim.getMaterial(), texture = material?.getBaseColorTexture(), uv = prim.getAttribute('TEXCOORD_0');
    if (!texture || !uv) continue;
    const { data, info } = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const colors = new Float32Array(uv.getCount() * 3), el = [0, 0];
    for (let i = 0; i < uv.getCount(); i++) {
      uv.getElement(i, el);
      const wrap = v => ((v % 1) + 1) % 1;
      const px = Math.min(info.width - 1, Math.floor(wrap(el[0]) * info.width)), py = Math.min(info.height - 1, Math.floor(wrap(el[1]) * info.height));
      const o = (py * info.width + px) * 4;
      colors.set([srgbToLinear(data[o] / 255), srgbToLinear(data[o + 1] / 255), srgbToLinear(data[o + 2] / 255)], i * 3);
    }
    prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(colors).setBuffer(doc.getRoot().listBuffers()[0]));
    prim.setAttribute('TEXCOORD_0', null);
    material.setBaseColorTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setNormalTexture(null);
  }
  await doc.transform(prune());
}

function triangleCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) n += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
  return n;
}

/** Re-reads the pack and rebuilds it as one model: baked, filtered primitives under a single node. */
async function writeModel(bytes, pack, modelId, primModels, path) {
  const doc = await io.readBinary(bytes);
  const prims = collectTriangles(doc, pack.dropMaterials);
  const rootNode = doc.createNode('model');
  const mesh = doc.createMesh('model');
  const buffer = doc.getRoot().listBuffers()[0];
  const allPoints = [];
  prims.forEach((p, k) => {
    const models = primModels[k];
    const keep = [];
    for (let t = 0; t < p.indices.length; t += 3) if (models[p.indices[t]] === modelId) keep.push(p.indices[t], p.indices[t + 1], p.indices[t + 2]);
    if (!keep.length) return;
    const used = [...new Set(keep)].sort((a, b) => a - b), remap = new Map(used.map((v, i) => [v, i]));
    const prim = doc.createPrimitive().setMaterial(p.prim.getMaterial());
    const normalMatrix = p.node.getWorldMatrix();
    for (const semantic of p.prim.listSemantics()) {
      const source = p.prim.getAttribute(semantic);
      const size = source.getElementSize(), el = new Array(size).fill(0);
      const out = new Float32Array(used.length * size);
      used.forEach((v, i) => {
        if (semantic === 'POSITION') { out.set(p.world.subarray(v * 3, v * 3 + 3), i * 3); return; }
        source.getElement(v, el);
        if (semantic === 'NORMAL') {
          const m = normalMatrix, [x, y, z] = el;
          const nx = m[0] * x + m[4] * y + m[8] * z, ny = m[1] * x + m[5] * y + m[9] * z, nz = m[2] * x + m[6] * y + m[10] * z;
          const l = Math.hypot(nx, ny, nz) || 1;
          out.set([nx / l, ny / l, nz / l], i * 3);
          return;
        }
        out.set(el, i * size);
      });
      if (semantic === 'TANGENT') continue;
      if (semantic === 'POSITION') allPoints.push(...out);
      prim.setAttribute(semantic, doc.createAccessor().setType(source.getType()).setArray(out).setBuffer(buffer));
    }
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(keep, v => remap.get(v))).setBuffer(buffer));
    mesh.addPrimitive(prim);
  });
  // Centre the footprint, base on the ground.
  const b = bounds(allPoints);
  const shift = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), arr = pos.getArray();
    for (let i = 0; i < arr.length; i += 3) { arr[i] += shift[0]; arr[i + 1] += shift[1]; arr[i + 2] += shift[2]; }
    pos.setArray(arr);
  }
  rootNode.setMesh(mesh);
  for (const scene of doc.getRoot().listScenes()) scene.dispose();
  for (const node of doc.getRoot().listNodes()) if (node !== rootNode) node.dispose();
  doc.createScene('model').addChild(rootNode);
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);
  await doc.transform(prune());
  const tris = triangleCount(doc);
  if (tris > pack.maxTriangles) {
    // Flat-shaded exports split every vertex by face normal, which leaves nothing to weld or collapse.
    // The runtime draws these flat-shaded, so normals can go.
    for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: pack.maxTriangles / tris, error: .04 }), prune());
  }
  if (pack.bakePalette) await bakePalette(doc);
  if (pack.shrinkTextures) await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [256, 256], quality: 86 }));
  writeFileSync(path, await io.writeBinary(doc));
  const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  return { tris: [tris, triangleCount(doc)], size };
}

// Clear each output folder once; several packs share one.
for (const out of new Set(PACKS.map(pack => pack.out))) rmSync(join(root, 'public', 'assets', out), { recursive: true, force: true });

for (const pack of PACKS) {
  const bytes = readFileSync(join(sources, pack.file));
  const doc = await io.readBinary(bytes);
  const prims = collectTriangles(doc, pack.dropMaterials);
  const primModels = assignModels(prims, pack.group);
  const count = Math.max(...primModels.map(m => Math.max(-1, ...m))) + 1;
  const dir = join(root, 'public', 'assets', pack.out);
  mkdirSync(dir, { recursive: true });
  if (count !== pack.names.length) throw new Error(`${pack.file}: found ${count} models, expected ${pack.names.length}`);
  for (let id = 0; id < count; id++) {
    if (!pack.names[id]) continue;
    const name = `${pack.names[id]}.glb`;
    const path = join(dir, name);
    const info = await writeModel(bytes, pack, id, primModels, path);
    console.log(`${pack.out}/${name}: ${info.tris[0]} → ${info.tris[1]} tris, size ${info.size.map(v => v.toFixed(2)).join(' × ')}`);
  }
}
