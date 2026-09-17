import { Component, Suspense, memo, useEffect, useMemo, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { Box3, BufferGeometry, DoubleSide, Matrix4, Mesh, Raycaster, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ExpansionSign } from './ExpansionSign';
import { RAMP_MODELS, stuntSites, type RampModelId, type StuntSite } from './stuntSites';

interface Part { geometry: BufferGeometry; material: Material }
const MODEL_IDS = Object.keys(RAMP_MODELS) as RampModelId[];

function merge(pieces: BufferGeometry[]): BufferGeometry {
  if (pieces.length === 1) return pieces[0];
  const indexed = pieces.every(g => g.index);
  const shared = Object.keys(pieces[0].attributes).filter(name => pieces.every(g => g.getAttribute(name)));
  const prepared = pieces.map(g => {
    const source = indexed ? g : g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(source.attributes)) if (!shared.includes(name)) source.deleteAttribute(name);
    source.morphAttributes = {};
    return source;
  });
  return mergeGeometries(prepared, false) ?? prepared[0];
}

/**
 * Bakes a ramp into the shared frame from `RAMP_MODELS`: rises toward +Z, entry edge at z = 0, centred,
 * and lowered so the entry lip is flush with the ground (the controller can only step up ~0.3 m).
 */
function bakeRamp(gltf: GLTF, id: RampModelId): Part[] {
  const spec = RAMP_MODELS[id];
  const scene: Object3D = gltf.scene;
  scene.updateMatrixWorld(true);
  const toFrame = new Matrix4().makeRotationY(spec.sourceYaw).multiply(new Matrix4().makeScale(...spec.scale));
  const byMaterial = new Map<Material, BufferGeometry[]>();
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(new Matrix4().multiplyMatrices(toFrame, object.matrixWorld));
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), geometry]);
  });
  const parts = [...byMaterial].map(([material, pieces]) => {
    // Thin ramp faces must render from both sides once scaled and turned.
    const shown = material.clone();
    shown.side = DoubleSide;
    return { material: shown, geometry: merge(pieces) };
  });
  const bounds = new Box3();
  parts.forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!); });
  const shift = new Vector3(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -bounds.min.z);
  parts.forEach(p => p.geometry.translate(shift.x, shift.y, shift.z));
  // Measure the ramp surface just inside the entry edge and sink the ramp by that much.
  const probe = new Raycaster(new Vector3(0, bounds.max.y - bounds.min.y + 1, .15), new Vector3(0, -1, 0));
  const hits = probe.intersectObjects(parts.map(p => new Mesh(p.geometry, p.material)), false);
  const entryHeight = hits.length ? hits[0].point.y : 0;
  parts.forEach(p => { p.geometry.translate(0, -entryHeight, 0); p.geometry.computeBoundingSphere(); });
  return parts;
}

function Site({ site, ramps }: { site: StuntSite; ramps: Record<RampModelId, Part[]> }) {
  return <group name={`stunt-${site.id}`}>
    <RigidBody type="fixed" colliders="trimesh">
      {site.ramps.map((placement, i) => (
        <group key={i} position={placement.entry} rotation={[0, placement.yaw, 0]}>
          {ramps[placement.model].map((part, p) => <mesh key={p} geometry={part.geometry} material={part.material} castShadow receiveShadow/>)}
        </group>
      ))}
    </RigidBody>
    <group position={site.sign.position} rotation={[0, site.sign.yaw, 0]}>
      <ExpansionSign position={[0, 0, 0]} label={site.label} width={5}/>
    </group>
  </group>;
}

function Parks() {
  const gltfs = useLoader(GLTFLoader, MODEL_IDS.map(id => RAMP_MODELS[id].url));
  const ramps = useMemo(() => Object.fromEntries(MODEL_IDS.map((id, i) => [id, bakeRamp(gltfs[i], id)])) as Record<RampModelId, Part[]>, [gltfs]);
  useEffect(() => () => Object.values(ramps).flat().forEach(part => { part.geometry.dispose(); part.material.dispose(); }), [ramps]);
  return <group name="stunt-parks">{stuntSites().map(site => <Site key={site.id} site={site} ramps={ramps}/>)}</group>;
}

class ParkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Stunt parks unavailable', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Ramps and river jumps placed by `npm run generate:stunts`. Optional scenery: a load failure never takes the world down. */
export const StuntParks = memo(function StuntParks() {
  return <ParkBoundary><Suspense fallback={null}><Parks/></Suspense></ParkBoundary>;
});
