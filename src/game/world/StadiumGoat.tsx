import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STADIUM, stadiumToWorld } from '../../content/world/stadiumLayout';
import { terrainHeight } from '../../content/world/definition';
import { GOAT_HOP_HEIGHT, GOAT_LOOP, GOAT_SPEED } from './goatRoute';

const GOAT_URL = '/assets/living-beings/goat.glb';
const GOAT_HEIGHT = 1;
/** The model already faces local +Z (the walking direction) once the Sketchfab root is applied. */
const MODEL_YAW = 0;

interface Leg { from: [number, number, number]; to: [number, number, number]; length: number; pause: number; hop: boolean }

/** Pitch-space legs with resolved heights (stadium-local y). */
function buildLegs(): Leg[] {
  const points = GOAT_LOOP.map(stop => {
    const y = stop.y === 'ground' ? (() => { const p = stadiumToWorld(stop.u, stop.v); return terrainHeight(p.x, p.z) - STADIUM.groundY; })() : stop.y;
    return { at: [stop.u, y, stop.v] as [number, number, number], pause: stop.pause };
  });
  return points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return { from: p.at, to: next.at, length: Math.hypot(next.at[0] - p.at[0], next.at[2] - p.at[2]), pause: p.pause, hop: Math.abs(next.at[1] - p.at[1]) > .3 };
  });
}

function GoatModel() {
  const gltf = useLoader(GLTFLoader, GOAT_URL);
  const model = useMemo(() => {
    const root = new Group(), scene: Object3D = gltf.scene.clone(true);
    root.add(scene);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    scene.position.set(-center.x, -bounds.min.y, -center.z);
    root.scale.setScalar(GOAT_HEIGHT / size.y);
    root.rotation.y = MODEL_YAW;
    root.traverse(object => { object.castShadow = true; });
    return root;
  }, [gltf]);
  return <primitive object={model}/>;
}

class GoatFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/** A goat that ambles round the forecourt and the west stand terraces, pausing to graze. Stadium-local coordinates. */
export function StadiumGoat({ animated }: { animated: boolean }) {
  const legs = useMemo(buildLegs, []);
  const body = useRef<Group>(null), sway = useRef<Group>(null);
  const state = useRef({ leg: 0, walked: 0, waited: 0, heading: 0, phase: 0 });
  useFrame((_, delta) => {
    const goat = body.current, tilt = sway.current;
    if (!goat || !tilt) return;
    const s = state.current, dt = animated ? Math.min(delta, .05) : 0;
    let leg = legs[s.leg];
    let moving = false;
    if (s.waited < leg.pause) s.waited += dt;
    else {
      moving = true;
      s.walked += dt * GOAT_SPEED * (leg.hop ? 1.6 : 1);
      if (s.walked >= leg.length) { s.leg = (s.leg + 1) % legs.length; s.walked = 0; s.waited = 0; leg = legs[s.leg]; moving = false; }
    }
    const t = leg.length > 0 ? Math.min(1, s.walked / leg.length) : 1;
    // Terrace edges: rise on a quick arc rather than sliding up a wall.
    const climb = leg.hop ? Math.min(1, Math.max(0, (t - .35) / .3)) : t;
    const y = leg.from[1] + (leg.to[1] - leg.from[1]) * climb + (leg.hop ? Math.sin(Math.PI * climb) * GOAT_HOP_HEIGHT : 0);
    goat.position.set(leg.from[0] + (leg.to[0] - leg.from[0]) * t, y, leg.from[2] + (leg.to[2] - leg.from[2]) * t);
    const targetHeading = Math.atan2(leg.to[0] - leg.from[0], leg.to[2] - leg.from[2]);
    s.heading += Math.atan2(Math.sin(targetHeading - s.heading), Math.cos(targetHeading - s.heading)) * (1 - Math.exp(-6 * dt));
    goat.rotation.y = s.heading;
    // Walking bob and waddle; while paused, dip to graze.
    s.phase += dt * (moving ? 9 : 1.5);
    tilt.position.y = moving ? Math.abs(Math.sin(s.phase)) * .04 : 0;
    tilt.rotation.z = moving ? Math.sin(s.phase) * .05 : 0;
    tilt.rotation.x = moving ? 0 : .12 + Math.sin(s.phase) * .05;
  });
  return <group ref={body} name="stadium-goat">
    <group ref={sway}><GoatFallback><Suspense fallback={null}><GoatModel/></Suspense></GoatFallback></group>
  </group>;
}
