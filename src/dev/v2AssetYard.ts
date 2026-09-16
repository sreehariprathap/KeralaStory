import { AmbientLight, Box3, BoxGeometry, Color, CylinderGeometry, DirectionalLight, GridHelper, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, type BufferGeometry, type Material, type Object3D, type Texture } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { V2_ASSET_PROFILES } from '../content/assets/v2AssetProfiles';
import { configureLegacyAssetMaterials } from '../game/render/legacyAssetMaterials';
import { prepareEnvironmentAsset } from '../game/render/prepareEnvironmentAsset';
import './v2-asset-yard.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!import.meta.env.DEV) throw new Error('Asset yard is development-only');
app.innerHTML = `<header><a href="/?inspect">← Back to game</a><h1>Kodassery Diaries · Asset yard</h1><p>Size and palette review · not production placement</p></header>
<main><section class="yard-controls" aria-label="Asset review controls"><label for="asset">Model</label><select id="asset"></select>
<p id="note"></p><p id="status" role="status" aria-live="polite">Choose a model.</p><p id="measure"></p>
<div class="yard-buttons"><button id="frame">Frame model</button><button id="front">Front</button><button id="side">Side</button><button id="top">Top</button><button id="retry">Reload</button></div>
<p>Drag to orbit · scroll to zoom · right-drag to pan. View buttons also work by keyboard.</p><p>Grid: 1 m squares. Gold post: 1 m. Figure: 1.7 m scale reference, not final character art.</p>
<p>Check shape, orientation, size and colors. Cars are static here; wheels and spawning are a later stage.</p></section>
<section id="viewport" aria-label="3D model review"><canvas aria-label="Selected model beside scale references"></canvas></section></main>`;
const select = document.querySelector<HTMLSelectElement>('#asset')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const measure = document.querySelector<HTMLParagraphElement>('#measure')!;
const note = document.querySelector<HTMLParagraphElement>('#note')!;
const viewport = document.querySelector<HTMLElement>('#viewport')!;
for (const profile of V2_ASSET_PROFILES) select.add(new Option(profile.label, profile.id));

function disposeSource(root: Object3D) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

try {
  const renderer = new WebGLRenderer({ canvas: viewport.querySelector('canvas')!, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new Scene(); scene.background = new Color('#c6dbd2');
  scene.add(new AmbientLight('#dbe5d6', .7), new HemisphereLight('#e3efd6', '#657952', 1.35));
  const sun = new DirectionalLight('#fff0cd', 2.2); sun.position.set(30, 60, 35); scene.add(sun);
  const camera = new PerspectiveCamera(50, 1, .05, 2000);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false;
  const grid = new GridHelper(200, 200, '#657952', '#a7bb83'); scene.add(grid);
  const references = new Group(); scene.add(references);
  const addReference = (geometry: BoxGeometry | CylinderGeometry | SphereGeometry, color: string, x: number, y: number, z: number) => {
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: .9 })); mesh.position.set(x, y, z); references.add(mesh);
  };
  addReference(new BoxGeometry(.12, 1, .12), '#d5aa54', 0, .5, 0);
  addReference(new CylinderGeometry(.19, .15, .85, 8), '#285943', .9, .975, 0);
  addReference(new SphereGeometry(.15, 12, 8), '#b98260', .9, 1.55, 0);
  for (const x of [.8, 1]) addReference(new BoxGeometry(.13, .55, .15), '#24382e', x, .275, 0);
  let current: ReturnType<typeof prepareEnvironmentAsset> | null = null;
  let source: Object3D | null = null, sequence = 0, closed = false;
  const render = () => { if (!closed) renderer.render(scene, camera); };
  controls.addEventListener('change', render);
  function frame(direction = new Vector3(1, .65, 1)) {
    const box = current ? new Box3().setFromObject(current.root, true) : new Box3(new Vector3(-2, 0, -2), new Vector3(2, 3, 2));
    box.union(new Box3().setFromObject(references));
    const center = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
    const radius = size.length() / 2;
    const halfFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));
    camera.position.copy(center).addScaledVector(direction.normalize(), Math.max(4, radius / Math.sin(halfFov) * 1.15));
    controls.target.copy(center); controls.update(); render();
  }
  function resize() {
    renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
    camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight); camera.updateProjectionMatrix(); render();
  }
  const observer = new ResizeObserver(resize); observer.observe(viewport); resize(); frame();
  const load = async () => {
    const request = ++sequence;
    const profile = V2_ASSET_PROFILES.find(p => p.id === select.value)!;
    note.textContent = profile.note; status.textContent = 'Loading selected model…'; measure.textContent = '';
    if (current) { scene.remove(current.root); current.dispose(); current = null; }
    if (source) { disposeSource(source); source = null; }
    render();
    let loaded: Object3D | null = null;
    try {
      const gltf = await configureLegacyAssetMaterials(new GLTFLoader()).loadAsync(profile.url);
      loaded = gltf.scene;
      if (request !== sequence || closed) { disposeSource(loaded); return; }
      const prepared = prepareEnvironmentAsset(loaded, profile);
      source = loaded; current = prepared; scene.add(prepared.root);
      references.position.set(prepared.size.x / 2 + 1.5, 0, 0);
      measure.textContent = `Width ${prepared.size.x.toFixed(2)} m · height ${prepared.size.y.toFixed(2)} m · depth ${prepared.size.z.toFixed(2)} m. ${prepared.meshes} meshes · ${prepared.triangles.toLocaleString()} triangles.`;
      status.textContent = 'Ready for your visual review.'; frame();
    } catch (error) {
      if (loaded) disposeSource(loaded);
      if (request === sequence && !closed) status.textContent = `Could not prepare model: ${error instanceof Error ? error.message : String(error)}. Use Reload to retry.`;
    }
  };
  select.addEventListener('change', () => { void load(); });
  document.querySelector('#retry')!.addEventListener('click', () => { void load(); });
  document.querySelector('#frame')!.addEventListener('click', () => frame());
  document.querySelector('#front')!.addEventListener('click', () => frame(new Vector3(0, .05, -1)));
  document.querySelector('#side')!.addEventListener('click', () => frame(new Vector3(1, .05, 0)));
  document.querySelector('#top')!.addEventListener('click', () => frame(new Vector3(0, 1, .001)));
  addEventListener('pagehide', () => {
    closed = true; sequence++; observer.disconnect(); controls.dispose();
    current?.dispose(); if (source) disposeSource(source); disposeSource(references);
    grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose()); renderer.dispose();
  }, { once: true });
  void load();
} catch (error) {
  status.textContent = `3D review unavailable: ${error instanceof Error ? error.message : String(error)}`;
}
