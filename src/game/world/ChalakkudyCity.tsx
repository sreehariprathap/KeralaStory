import { memo, useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { CHALAKKUDY_CITY, type CitySign } from '../../content/world/chalakkudyCity';
import { EXPANSION_GROUND, terrainHeight } from '../../content/world/definition';
import { CarVisual } from '../vehicle/CarVisual';
import { createCityGeometry, createPaintGeometry } from './chalakkudyCityGeometry';

/** Flat, lit signboard: one small canvas per sign, sized to the board's aspect. */
function Signboard({ sign }: { sign: CitySign }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = sign.width > 10 ? 1024 : sign.height > sign.width ? 128 : 512;
    canvas.height = Math.max(64, Math.round(canvas.width * sign.height / sign.width / 32) * 32);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create city sign canvas');
    context.fillStyle = sign.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = sign.ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const vertical = canvas.height > canvas.width;
    const text = vertical ? sign.label.split('').join('\n') : sign.label;
    let size = Math.round(canvas.height * .56);
    const font = () => `700 ${size}px "Noto Sans", "Noto Sans Malayalam", sans-serif`;
    context.font = font();
    if (vertical) {
      const lines = text.split('\n');
      size = Math.min(Math.round(canvas.width * .8), Math.floor(canvas.height * .9 / lines.length));
      context.font = font();
      lines.forEach((line, i) => context.fillText(line, canvas.width / 2, canvas.height * .05 + size * (i + .5)));
    } else {
      while (size > 12 && context.measureText(text).width > canvas.width * .9) { size -= 2; context.font = font(); }
      context.fillText(text, canvas.width / 2, canvas.height / 2 + size * .04);
    }
    const painted = new CanvasTexture(canvas);
    painted.colorSpace = SRGBColorSpace;
    painted.anisotropy = 4;
    return painted;
  }, [sign]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={sign.position} rotation={[0, sign.yaw, 0]}>
    <planeGeometry args={[sign.width, sign.height]}/>
    <meshStandardMaterial map={texture} roughness={.6} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={.18}/>
  </mesh>;
}

/** Tier A Chalakkudy on both banks: four-lane roads and bridges, the Central Mall, shops, towers and a car showroom. */
export const ChalakkudyCity = memo(function ChalakkudyCity() {
  const geometry = useMemo(() => createCityGeometry(CHALAKKUDY_CITY.pieces), []);
  const paint = useMemo(() => createPaintGeometry(CHALAKKUDY_CITY.paint, (x, z) => EXPANSION_GROUND.deckHeightAt(x, z) ?? terrainHeight(x, z)), []);
  useEffect(() => () => { Object.values(geometry).forEach(g => g.dispose()); paint.dispose(); }, [geometry, paint]);
  return <group name="chalakkudy-city">
    <RigidBody type="fixed" colliders={false}>
      {CHALAKKUDY_CITY.boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
    <mesh geometry={geometry.solid} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.82}/></mesh>
    <mesh geometry={geometry.ground} receiveShadow><meshStandardMaterial vertexColors roughness={.9}/></mesh>
    <mesh geometry={geometry.glass}><meshStandardMaterial vertexColors metalness={.55} roughness={.08} transparent opacity={.58} depthWrite={false}/></mesh>
    <mesh geometry={geometry.glow}><meshStandardMaterial vertexColors emissive="#fff0c8" emissiveIntensity={.9} roughness={.4}/></mesh>
    <mesh geometry={paint} receiveShadow><meshStandardMaterial vertexColors roughness={.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/></mesh>
    {CHALAKKUDY_CITY.signs.map(sign => <Signboard key={sign.id} sign={sign}/>)}
    {CHALAKKUDY_CITY.cars.map(car => <group key={car.id} position={car.position} rotation={[0, car.yaw, 0]}>
      <CarVisual modelId={car.modelId} color={car.color}/>
    </group>)}
  </group>;
});
