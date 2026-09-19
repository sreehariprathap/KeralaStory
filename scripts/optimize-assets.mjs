// Builds optimized copies of every served GLB into .asset-cache/opt/, mirroring public/.
// Run: node scripts/optimize-assets.mjs [--force] [path-substring ...]
// Sources are never modified. `vite build` swaps the optimized copies into dist/ (see vite.config.ts).
//
// Pipeline, chosen to be safe for this codebase:
// - Draco geometry: decodes back to float attributes, so runtime code that bakes geometry with
//   applyMatrix4 (palms, flowers, static batching) keeps working. Quantized/meshopt data would not.
// - Textures resized per asset class and re-encoded as WebP (alpha kept). Texture memory, not file size,
//   is what limits phones: one 1024x1024 texture costs ~5.5 MB of GPU memory whatever it compresses to.
// - Static models above the vertex budget are simplified with a tight error bound. Skinned models never are.
// - Materials are never merged: vehicle paint and removal lists look them up by name.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, getBounds, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const cacheDir = join(root, '.asset-cache', 'opt');
const indexFile = join(root, '.asset-cache', 'index.json');
/** Bump when the pipeline changes, so every cached output is rebuilt. */
const PIPELINE = 'draco-webp-budget-simplify150k-v5';
const VERTEX_BUDGET = 150_000;
/**
 * Texture size by what the asset is and how close players get to it. Faces need the detail;
 * scattered scenery and props seen from metres away do not.
 */
const TEXTURE_RULES = [
  { match: /^assets\/characters\//, size: 1024 },
  { match: /^assets\/(cars|bike)\//, size: 512 },
  { match: /^assets\/(grass|trees|Coconut-trees)\//, size: 256 },
  { match: /^assets\/(stunt|collectables|soccer|adventure)\//, size: 256 },
  { match: /^assets\/living-beings\//, size: 256 },
  { match: /^assets\/buildings\//, size: 512 },
];
const DEFAULT_TEXTURE_SIZE = 512;
/**
 * Megapixels of texture a single model may keep, which caps its GPU memory (~5.3 MB per megapixel
 * with mipmaps). A model with 26 textures gets smaller ones than a model with two.
 */
const TEXTURE_BUDGET_MP = [
  { match: /^assets\/characters\//, mp: 3 },
  { match: /^assets\/(cars|bike)\//, mp: 2.2 },
  { match: /^assets\/buildings\//, mp: 2 },
];
const DEFAULT_BUDGET_MP = 1;
const powerOfTwo = value => Math.max(128, 2 ** Math.floor(Math.log2(Math.max(1, value))));
function textureSize(rel, count) {
  const cap = TEXTURE_RULES.find(rule => rule.match.test(rel))?.size ?? DEFAULT_TEXTURE_SIZE;
  const budget = (TEXTURE_BUDGET_MP.find(rule => rule.match.test(rel))?.mp ?? DEFAULT_BUDGET_MP) * 1e6;
  return count > 0 ? Math.min(cap, powerOfTwo(Math.sqrt(budget / count))) : cap;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const filters = args.filter(arg => !arg.startsWith('--'));

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.toLowerCase().endsWith('.glb')) yield path;
  }
}

const sha = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
await MeshoptSimplifier.ready;

/** Vertices as drawn: a mesh shared by several nodes counts once per node. */
function vertexCount(doc) {
  let count = 0;
  for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) count += prim.getAttribute('POSITION')?.getCount() ?? 0;
  return count;
}

async function build(bytes, simplifyRatio, texture) {
  const doc = await io.readBinary(bytes);
  const steps = [
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
    prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }),
  ];
  if (simplifyRatio !== null) steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: .002 }));
  steps.push(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texture, texture], quality: 86 }),
    draco({ method: 'edgebreaker' }),
  );
  await doc.transform(...steps);
  return { doc, result: await io.writeBinary(doc) };
}

/** Scene bounds agree within 1% of the model's size on every axis. */
function sameBounds(a, b) {
  const ba = getBounds(a.getRoot().getDefaultScene() ?? a.getRoot().listScenes()[0]);
  const bb = getBounds(b.getRoot().getDefaultScene() ?? b.getRoot().listScenes()[0]);
  const size = Math.max(...ba.max.map((v, i) => v - ba.min[i]), 1e-6);
  return [0, 1, 2].every(i => Math.abs(ba.min[i] - bb.min[i]) <= size * .01 && Math.abs(ba.max[i] - bb.max[i]) <= size * .01);
}

let built = 0, skipped = 0, failed = 0, before = 0, after = 0;
for (const source of walk(publicDir)) {
  const rel = relative(publicDir, source);
  if (filters.length && !filters.some(f => rel.includes(f))) continue;
  const bytes = readFileSync(source);
  const key = `${PIPELINE}:${sha(bytes)}`;
  const output = join(cacheDir, rel);
  before += bytes.length;
  if (!force && index[rel]?.key?.startsWith(key) && existsSync(output)) { after += statSync(output).size; skipped++; continue; }
  mkdirSync(dirname(output), { recursive: true });
  const started = performance.now();
  try {
    const probe = await io.readBinary(bytes);
    const texture = textureSize(rel.split(sep).join('/'), probe.getRoot().listTextures().length);
    const skinned = probe.getRoot().listSkins().length > 0;
    const vertices = vertexCount(probe);
    const ratio = Math.max(.25, VERTEX_BUDGET / vertices);
    let { doc, result } = await build(bytes, !skinned && vertices > VERTEX_BUDGET ? ratio : null, texture);
    // Guards: a simplification that overshoots its target (e.g. thousands of tiny grass blades collapsing)
    // or moves the model's bounds is discarded, and the file is rebuilt without it.
    if (!skinned && vertices > VERTEX_BUDGET && (vertexCount(doc) < vertices * ratio * .6 || !sameBounds(probe, doc))) {
      console.warn(`${rel}: simplification rejected (${vertexCount(doc)} verts), rebuilding without it`);
      ({ doc, result } = await build(bytes, null, texture));
    }
    if (!sameBounds(probe, doc)) throw new Error('bounds changed after optimization');
    // Never ship a "optimized" file that grew.
    if (result.length < bytes.length) writeFileSync(output, result); else copyFileSync(source, output);
    const size = statSync(output).size;
    after += size;
    index[rel] = { key: `${key}:${texture}`, sourceBytes: bytes.length, bytes: size, texture, vertices: [vertices, vertexCount(doc)] };
    built++;
    console.log(`${rel}: ${(bytes.length / 1e6).toFixed(1)} → ${(size / 1e6).toFixed(1)} MB, ${vertices} → ${vertexCount(doc)} verts (${((performance.now() - started) / 1000).toFixed(1)} s)`);
  } catch (error) {
    // Keep the build working: an unoptimizable file ships as-is.
    copyFileSync(source, output);
    after += bytes.length;
    index[rel] = { key, sourceBytes: bytes.length, bytes: bytes.length, error: String(error?.message ?? error) };
    failed++;
    console.warn(`${rel}: kept original (${error?.message ?? error})`);
  }
  writeFileSync(indexFile, JSON.stringify(index, null, 2));
}
console.log(`optimized ${built}, cached ${skipped}, kept ${failed} originals · GLB total ${(before / 1e6).toFixed(0)} → ${(after / 1e6).toFixed(0)} MB`);
