import { Component, Suspense, memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Box3, CanvasTexture, DoubleSide, Group, RepeatWrapping, SRGBColorSpace, Vector3, type MeshBasicMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STADIUM } from '../../content/world/stadiumLayout';
import { ExpansionSign } from './ExpansionSign';
import { StadiumGoat } from './StadiumGoat';

const FIELD_URL = '/assets/soccer/football_field.glb';
/** The texture's touchlines are inset 20/512 and 15/256 of the image, so the plane is larger than the pitch. */
const FIELD_PLANE = { width: STADIUM.pitch.halfWidth * 2 * 256 / 226, length: STADIUM.pitch.halfLength * 2 * 512 / 472 };
const FIELD_THICKNESS = .4;
const SURFACE_LIFT = .03;
const SAFFRON = '#e8912d';
const { halfWidth: PW, halfLength: PL } = STADIUM.pitch;
const GOAL = STADIUM.goal;
const POST_RADIUS = .07;

/** The field model's top face becomes the pitch: long side along local +Z (v), surface just above the levelled pad. */
function FieldModel() {
  const gltf = useLoader(GLTFLoader, FIELD_URL);
  const model = useMemo(() => {
    const scene: Object3D = gltf.scene.clone(true);
    const root = new Group();
    root.add(scene);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root), size = bounds.getSize(new Vector3());
    // The source may be turned: map its longer horizontal side onto the pitch length.
    const longOnX = size.x > size.z;
    if (longOnX) scene.rotation.y = Math.PI / 2;
    root.updateMatrixWorld(true);
    const turned = new Box3().setFromObject(root), center = turned.getCenter(new Vector3()), turnedSize = turned.getSize(new Vector3());
    scene.position.set(-center.x, -turned.max.y, -center.z);
    const scaled = new Group();
    scaled.add(root);
    scaled.scale.set(FIELD_PLANE.width / turnedSize.x, FIELD_THICKNESS / turnedSize.y, FIELD_PLANE.length / turnedSize.z);
    scaled.position.y = SURFACE_LIFT;
    scaled.traverse(object => { object.receiveShadow = true; });
    return scaled;
  }, [gltf]);
  return <primitive object={model}/>;
}

class FieldFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    // Without the model the pitch is still playable: plain striped grass.
    if (this.state.failed) return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SURFACE_LIFT, 0]} receiveShadow><planeGeometry args={[FIELD_PLANE.width, FIELD_PLANE.length]}/><meshStandardMaterial color="#7fb33a"/></mesh>;
    return this.props.children;
  }
}

function useNetTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.strokeStyle = 'rgba(245,245,240,.95)';
    context.lineWidth = 3;
    context.strokeRect(0, 0, 64, 64);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(10, 4);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** A goal at one end: `side` is +1 for the +v (south) end. Posts, bar and net all stop the ball. */
function Goal({ side, color, net }: { side: 1 | -1; color: string; net: CanvasTexture }) {
  const line = side * PL, back = side * (PL + GOAL.depth), mid = side * (PL + GOAL.depth / 2);
  const netMaterial = <meshStandardMaterial map={net} color={color} transparent alphaTest={.3} side={DoubleSide} depthWrite={false}/>;
  return <group>
    {[-1, 1].map(s => <mesh key={s} position={[s * GOAL.halfWidth, GOAL.height / 2, line]} castShadow><cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL.height, 10]}/><meshStandardMaterial color="#f7f7f2"/></mesh>)}
    <mesh position={[0, GOAL.height, line]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL.halfWidth * 2 + POST_RADIUS * 2, 10]}/><meshStandardMaterial color="#f7f7f2"/></mesh>
    {/* Back frame and net. */}
    {[-1, 1].map(s => <mesh key={`b${s}`} position={[s * GOAL.halfWidth, GOAL.height / 2, back]}><cylinderGeometry args={[.035, .035, GOAL.height, 6]}/><meshStandardMaterial color={color}/></mesh>)}
    <mesh position={[0, GOAL.height / 2, back]}><planeGeometry args={[GOAL.halfWidth * 2, GOAL.height]}/>{netMaterial}</mesh>
    <mesh position={[0, GOAL.height, mid]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[GOAL.halfWidth * 2, GOAL.depth]}/>{netMaterial}</mesh>
    {[-1, 1].map(s => <mesh key={`s${s}`} position={[s * GOAL.halfWidth, GOAL.height / 2, mid]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[GOAL.depth, GOAL.height]}/>{netMaterial}</mesh>)}
    <RigidBody type="fixed" colliders={false}>
      {[-1, 1].map(s => <CylinderCollider key={s} args={[GOAL.height / 2, POST_RADIUS]} position={[s * GOAL.halfWidth, GOAL.height / 2, line]}/>)}
      <CuboidCollider args={[GOAL.halfWidth, POST_RADIUS, POST_RADIUS]} position={[0, GOAL.height, line]}/>
      <CuboidCollider args={[GOAL.halfWidth, GOAL.height / 2, .05]} position={[0, GOAL.height / 2, back + side * .05]}/>
      <CuboidCollider args={[GOAL.halfWidth, .05, GOAL.depth / 2]} position={[0, GOAL.height + .05, mid]}/>
      {[-1, 1].map(s => <CuboidCollider key={s} args={[.05, GOAL.height / 2, GOAL.depth / 2]} position={[s * (GOAL.halfWidth + .05), GOAL.height / 2, mid]}/>)}
    </RigidBody>
  </group>;
}

const STAND_INNER = 26, STAND_DEPTH = 4, STAND_TIERS = 3, STAND_HALF_LENGTH = 27, ENTRANCE_HALF = 6;
const SEAT_COLORS = ['#75aadb', '#ffffff', '#75aadb'];
/** Inner (pitch-side) edge of the east roof, where its banner hangs. */
const STADIUM_ROOF_FRONT = STAND_INNER + STAND_DEPTH - 4.8;
/** Stepped concrete terraces along a touchline, with coloured seat rows. The west stand has a central entrance. */
function Stand({ side }: { side: 1 | -1 }) {
  const step = STAND_DEPTH / STAND_TIERS;
  const segments: [number, number][] = side < 0 ? [[-STAND_HALF_LENGTH, -ENTRANCE_HALF], [ENTRANCE_HALF, STAND_HALF_LENGTH]] : [[-STAND_HALF_LENGTH, STAND_HALF_LENGTH]];
  return <RigidBody type="fixed" colliders={false}>
    {segments.map(([from, to]) => {
      const length = to - from, center = (from + to) / 2;
      return Array.from({ length: STAND_TIERS }, (_, tier) => {
        const height = .6 * (tier + 1), u = side * (STAND_INNER + step * (tier + .5));
        return <group key={`${from}-${tier}`}>
          <mesh position={[u, height / 2, center]} castShadow receiveShadow><boxGeometry args={[step, height, length]}/><meshStandardMaterial color="#c9c2b2" roughness={.95}/></mesh>
          <mesh position={[u + side * step * .1, height + .12, center]} castShadow><boxGeometry args={[step * .45, .24, length - .4]}/><meshStandardMaterial color={SEAT_COLORS[tier]} roughness={.7}/></mesh>
          <CuboidCollider args={[step / 2, height / 2, length / 2]} position={[u, height / 2, center]}/>
        </group>;
      });
    })}
    {/* Back rail: low enough that the terraces (and the goat on them) show from outside. */}
    {segments.map(([from, to]) => <mesh key={`wall${from}`} position={[side * (STAND_INNER + STAND_DEPTH + .15), 1.15, (from + to) / 2]} castShadow><boxGeometry args={[.3, 2.3, to - from]}/><meshStandardMaterial color="#b3ab98"/></mesh>)}
  </RigidBody>;
}

/** Cantilever roof over the east stand. */
function Roof() {
  const u = STAND_INNER + STAND_DEPTH;
  return <group>
    {[-24, -12, 0, 12, 24].map(v => <mesh key={v} position={[u + .2, 3.3, v]} castShadow><cylinderGeometry args={[.12, .14, 6.6, 8]}/><meshStandardMaterial color="#8e9aa3" metalness={.4} roughness={.5}/></mesh>)}
    <mesh position={[u - 2, 6.4, 0]} rotation={[0, 0, -.12]} castShadow><boxGeometry args={[5.6, .12, STAND_HALF_LENGTH * 2 + 1]}/><meshStandardMaterial color="#b8412f" roughness={.8}/></mesh>
  </group>;
}

function Floodlight({ u, v }: { u: number; v: number }) {
  const facing = Math.atan2(-u, -v);
  return <group position={[u, 0, v]}>
    <mesh position={[0, 8, 0]} castShadow><cylinderGeometry args={[.14, .24, 16, 8]}/><meshStandardMaterial color="#8e9aa3" metalness={.5} roughness={.4}/></mesh>
    <group position={[0, 16.2, 0]} rotation={[0, facing, 0]}>
      <mesh rotation={[-.35, 0, 0]}><boxGeometry args={[2.6, 1.4, .3]}/><meshStandardMaterial color="#5b646b"/></mesh>
      <mesh position={[0, 0, .16]} rotation={[-.35, 0, 0]}><planeGeometry args={[2.3, 1.1]}/><meshBasicMaterial color="#fffbe6"/></mesh>
    </group>
  </group>;
}

/** Low advertising boards behind each goal, which also stop the ball. */
function Boards() {
  const v = PL + STADIUM.runoff + .6, colors = ['#b8412f', '#285943', '#1f5fa8', '#e8912d'];
  return <RigidBody type="fixed" colliders={false}>
    {[-1, 1].map(side => <group key={side}>
      {colors.map((color, i) => <mesh key={i} position={[-PW + PW / 2 * (i + .5) * 1, .5, side * v]} castShadow><boxGeometry args={[PW / 2 - .1, 1, .12]}/><meshStandardMaterial color={color}/></mesh>)}
      <CuboidCollider args={[PW, .5, .06]} position={[0, .5, side * v]}/>
    </group>)}
  </RigidBody>;
}

/** Walk-in circle beside the halfway line: no collider. */
function JoinCircle({ animated }: { animated: boolean }) {
  const ring = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.opacity = animated ? .55 + Math.sin(clock.elapsedTime * 2.4) * .25 : .7; });
  const { u, v, radius } = STADIUM.join;
  return <group position={[u, SURFACE_LIFT + .03, v]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius - .35, radius, 48]}/><meshBasicMaterial ref={ring} color={SAFFRON} transparent opacity={.7} side={DoubleSide} depthWrite={false}/></mesh>
    {/* A ball icon in the middle of the circle. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.7, 24]}/><meshBasicMaterial color="#f7f7f2" transparent opacity={.75} depthWrite={false}/></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]}><circleGeometry args={[.28, 5]}/><meshBasicMaterial color="#2a2a2a" transparent opacity={.75} depthWrite={false}/></mesh>
  </group>;
}

/** A long painted banner in Argentina sky blue and white. */
function useBannerTexture(text: string) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const stripes = ['#75aadb', '#ffffff', '#75aadb'];
    stripes.forEach((color, i) => { context.fillStyle = color; context.fillRect(0, i * 256 / 3, 2048, 256 / 3 + 1); });
    context.strokeStyle = '#1d3f6e';
    context.lineWidth = 14;
    context.strokeRect(7, 7, 2034, 242);
    // A sun of May on each side of the name.
    for (const x of [150, 1898]) {
      context.fillStyle = '#f6b40e';
      context.beginPath(); context.arc(x, 128, 44, 0, Math.PI * 2); context.fill();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        context.beginPath(); context.moveTo(x + Math.cos(a) * 50, 128 + Math.sin(a) * 50); context.lineTo(x + Math.cos(a + .1) * 72, 128 + Math.sin(a + .1) * 72); context.lineTo(x + Math.cos(a - .1) * 72, 128 + Math.sin(a - .1) * 72); context.fill();
      }
    }
    context.font = 'bold 150px "Noto Serif", Georgia, serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 16;
    context.strokeStyle = '#ffffff';
    context.strokeText(text, 1024, 136, 1560);
    context.fillStyle = '#1d3f6e';
    context.fillText(text, 1024, 136, 1560);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Entrance arch over the west gate, facing visitors walking in, with the banner on both faces. */
function EntranceArch({ banner }: { banner: CanvasTexture }) {
  const u = -STADIUM.pad.halfWidth - .5, half = ENTRANCE_HALF + .6, height = 5.2;
  return <group position={[u, 0, 0]}>
    <RigidBody type="fixed" colliders={false}>
      {[-1, 1].map(s => <group key={s}>
        <mesh position={[0, height / 2, s * half]} castShadow><boxGeometry args={[.5, height, .5]}/><meshStandardMaterial color="#e9e4d4"/></mesh>
        <CuboidCollider args={[.25, height / 2, .25]} position={[0, height / 2, s * half]}/>
      </group>)}
    </RigidBody>
    <mesh position={[0, height - .6, 0]} castShadow><boxGeometry args={[.3, 1.5, half * 2 + .5]}/><meshStandardMaterial color="#1d3f6e"/></mesh>
    {[-1, 1].map(s => <mesh key={s} position={[s * .16, height - .6, 0]} rotation={[0, s * Math.PI / 2, 0]}><planeGeometry args={[half * 2 + .3, 1.35]}/><meshStandardMaterial map={banner} roughness={.8}/></mesh>)}
  </group>;
}

/** Banner along the front edge of the east stand roof, facing the pitch. */
function RoofBanner({ banner }: { banner: CanvasTexture }) {
  return <mesh position={[STADIUM_ROOF_FRONT, 5.35, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[STAND_HALF_LENGTH * 1.4, 2.1]}/><meshStandardMaterial map={banner} roughness={.8}/></mesh>;
}

/** Leo Messi Stadium: pitch, goals, stands, floodlights, banners and the join circle. */
export const Stadium = memo(function Stadium({ animated }: { animated: boolean }) {
  const net = useNetTexture();
  const banner = useBannerTexture(STADIUM.banner);
  return <group name={STADIUM.id} position={[STADIUM.center.x, STADIUM.groundY, STADIUM.center.z]} rotation={[0, STADIUM.yaw, 0]}>
    <FieldFallback><Suspense fallback={null}><FieldModel/></Suspense></FieldFallback>
    <Goal side={-1} color="#e0e6f0" net={net}/>
    <Goal side={1} color="#f4e2c8" net={net}/>
    <Stand side={-1}/><Stand side={1}/><Roof/><RoofBanner banner={banner}/><EntranceArch banner={banner}/><Boards/>
    {[[-29, -40], [29, -40], [-29, 40], [29, 40]].map(([u, v]) => <Floodlight key={`${u},${v}`} u={u} v={v}/>)}
    <JoinCircle animated={animated}/>
    <StadiumGoat animated={animated}/>
    <group position={[-STADIUM.pad.halfWidth - 2, 0, -ENTRANCE_HALF - 3]} rotation={[0, -Math.PI / 2, 0]}>
      <ExpansionSign position={[0, 0, 0]} label={STADIUM.label} width={5}/>
    </group>
  </group>;
});
