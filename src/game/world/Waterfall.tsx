import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Color, DoubleSide, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import { terrainHeight } from '../../content/world/kodassery';
import { FALLS, waterfallGeometry } from './waterfallGeometry';

const baseY = terrainHeight(FALLS.x, FALLS.z);
const rockColors = ['#717c6b', '#838977', '#626f63', '#939783'];
const rockData = [
  // Embedded backing mass: its west face supports the falling sheets.
  [53, 7.4, -384, 5.3, 10.3, 6.6],
  [51.5, 14.7, -384.9, 3.5, 4.7, 4.7],
  [51.4, 9.2, -385, 4.2, 3.7, 4.8],
  [49.3, 3.2, -385, 3, 4.8, 4.5],
  // Irregular side buttresses frame the water without covering its face.
  [50.3, 7.6, -390.1, 2.8, 10.1, 2.3],
  [50.5, 6.5, -379.9, 3.4, 9.1, 2.6],
  [47.8, .4, -391, 3.4, 1.8, 2.5],
  [46.6, .3, -378.6, 2.6, 1.5, 2.1],
  [42.4, .2, -389.6, 2, 1.3, 1.5],
  [39.8, .1, -387.7, 1.9, 1.1, 1.5],
  [37.7, -.1, -381, 1.6, 1, 2.6],
  [42.6, -.3, -381, 1.1, .9, 1.5],
  [39.2, -.1, -375.4, 1.5, 1.2, 1.6],
  [44.1, .1, -372.8, 1.5, 1, 1.2],
  [45.1, .1, -366.5, 1, .7, 1.4],
  [50.1, 0, -359, 1.1, .7, 1.5],
  [51.1, -.1, -352.9, 1.4, .8, 1.7],
];

/** Painted bands travel in UV flow-distance; reduced motion freezes one stable
 * pose, and low quality uses fewer vertices and no secondary streak layer. */
export function waterMaterial(low: boolean, time: { value: number }) {
  const material = new MeshStandardMaterial({ color: '#4c9e99', roughness: .62, side: DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.waterTime = time;
    shader.vertexShader = `attribute float waterFoam; varying vec2 flowUv; varying float contactFoam;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nflowUv = uv; contactFoam = waterFoam;');
    shader.fragmentShader = `uniform float waterTime; varying vec2 flowUv; varying float contactFoam;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        float downstream = flowUv.y * .72 - waterTime * 1.45;
        float lanes = sin(flowUv.x * 38.0 + sin(downstream * .8) * .6);
        float bands = smoothstep(.15, .9, sin(downstream * 3.2 + flowUv.x * 9.0));
        float edge = smoothstep(0.0, .16, flowUv.x) * smoothstep(0.0, .16, 1.0 - flowUv.x);
        float thread = smoothstep(.8, .98, lanes) * (.18 + bands * .48);
        ${low ? '' : 'thread += smoothstep(.94, .99, sin(flowUv.x * 73.0 - downstream * .3)) * bands * .14;'}
        float islands = smoothstep(-.3, .55, sin(flowUv.x * 29.0 + downstream) + cos(downstream * 2.0 - flowUv.x * 17.0));
        vec3 water = mix(vec3(.11, .32, .29), vec3(.29, .59, .56), edge);
        water = mix(water, vec3(.70, .87, .79), min(.88, thread + contactFoam * islands * .85));
        diffuseColor.rgb = water;
      `);
  };
  material.customProgramCacheKey = () => `painted-waterfall-${low ? 'low' : 'full'}`;
  return material;
}

export function Waterfall({ animated, quality }: { animated: boolean; quality: 'low' | 'medium' | 'high' }) {
  const low = quality === 'low';
  const time = useMemo(() => ({ value: 0 }), []);
  const assets = useMemo(() => ({
    fall: waterfallGeometry('fall', low), stream: waterfallGeometry('stream', low),
    material: waterMaterial(low, time),
  }), [low, time]);
  const rocks = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new Object3D(), color = new Color();
    rockData.forEach(([x, y, z, sx, sy, sz], i) => {
      object.position.set(x, (i < 8 ? baseY : terrainHeight(x, z)) + y, z);
      object.scale.set(sx, sy, sz);
      object.rotation.set(0, Math.sin(i * 2.4) * .28, Math.sin(i * 1.7) * .08);
      object.updateMatrix();
      rocks.current!.setMatrixAt(i, object.matrix);
      rocks.current!.setColorAt(i, color.set(rockColors[i % rockColors.length]));
    });
    rocks.current!.instanceMatrix.needsUpdate = true;
    rocks.current!.computeBoundingSphere();
  }, []);
  useFrame((_, delta) => { if (animated) time.value += Math.min(delta, .05); });
  useEffect(() => () => {
    assets.fall.dispose(); assets.stream.dispose(); assets.material.dispose();
  }, [assets]);
  return <group>
    <instancedMesh ref={rocks} args={[undefined, undefined, rockData.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
    <mesh geometry={assets.fall} material={assets.material} />
    <mesh geometry={assets.stream} material={assets.material} />
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[4, 11, 4]} position={[50, baseY + 6, -383]} />
    </RigidBody>
  </group>;
}
