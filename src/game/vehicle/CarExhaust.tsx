import { createPortal, useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Group, InstancedMesh, Object3D, SphereGeometry, Vector3, MeshBasicMaterial } from 'three';

const PARTICLE_COUNT = 20;
const DEFAULT_POSITION = [0.5, 0.32, -1.9] as const;
const PARTICLE_LIFE = 1.25;
const EMIT_INTERVAL = 0.085;

type CarMotion = {
  signedSpeed?: number;
  speed?: number;
  throttle?: number;
};

type Particle = {
  age: number;
  life: number;
  size: number;
  drift: Vector3;
  position: Vector3;
};

export type CarExhaustProps = {
  motion: RefObject<CarMotion>;
  active: boolean;
  reducedMotion: boolean;
  position?: readonly [number, number, number];
};

const exhausted = (particle: Particle) => {
  particle.age = particle.life;
  particle.position.set(0, -1000, 0);
};

export function CarExhaust({ motion, active, reducedMotion, position = DEFAULT_POSITION }: CarExhaustProps) {
  const { scene } = useThree();
  const anchor = useRef<Group>(null);
  const smoke = useRef<InstancedMesh>(null);
  const emitter = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const worldOrigin = useMemo(() => new Vector3(), []);
  const worldBackward = useMemo(() => new Vector3(), []);
  const worldUp = useMemo(() => new Vector3(0, 1, 0), []);
  const particles = useMemo<Particle[]>(() => Array.from({ length: PARTICLE_COUNT }, () => {
    const particle: Particle = {
      age: PARTICLE_LIFE,
      life: PARTICLE_LIFE,
      size: 0.07,
      drift: new Vector3(),
      position: new Vector3(0, -1000, 0),
    };
    return particle;
  }), []);

  useFrame((_, delta) => {
    const instance = smoke.current;
    const exhaustAnchor = anchor.current;
    if (!instance || !exhaustAnchor) return;

    const dt = Math.min(delta, 0.05);
    const state = motion.current ?? {};
    const signedSpeed = state.signedSpeed ?? state.speed ?? 0;
    const speed = Math.abs(signedSpeed);
    const throttle = Math.max(0, Math.min(1, state.throttle ?? 0));
    const emitting = active && !reducedMotion && (speed > 0.18 || throttle > 0.08);

    if (!emitting) {
      emitter.current = 0;
      particles.forEach(exhausted);
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        instance.setMatrixAt(i, dummy.matrix);
      }
      instance.instanceMatrix.needsUpdate = true;
      return;
    }

    emitter.current += dt;
    exhaustAnchor.getWorldPosition(worldOrigin);
    exhaustAnchor.getWorldQuaternion(dummy.quaternion);
    worldBackward.set(0, 0, -1).applyQuaternion(dummy.quaternion).normalize();

    while (emitter.current >= EMIT_INTERVAL) {
      emitter.current -= EMIT_INTERVAL;
      const particle = particles.find(candidate => candidate.age >= candidate.life) ?? particles[0];
      particle.age = 0;
      particle.life = PARTICLE_LIFE * (0.8 + Math.random() * 0.35);
      particle.size = 0.055 + Math.random() * 0.04;
      particle.position.copy(worldOrigin);
      particle.drift.copy(worldBackward).multiplyScalar(0.3 + speed * 0.018);
      particle.drift.y = 0.13 + Math.random() * 0.09;
      particle.drift.x += (Math.random() - 0.5) * 0.12;
      particle.drift.z += (Math.random() - 0.5) * 0.12;
      if (throttle > 0.5) particle.drift.addScaledVector(worldUp, throttle * 0.035);
    }

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const particle = particles[i];
      particle.age += dt;
      if (particle.age >= particle.life) {
        exhausted(particle);
      } else {
        particle.position.addScaledVector(particle.drift, dt);
        particle.drift.multiplyScalar(Math.pow(0.985, dt * 60));
      }

      const lifeRatio = particle.age / particle.life;
      const visible = particle.age < particle.life;
      const scale = visible ? particle.size * (0.8 + lifeRatio * 2.2) : 0;
      dummy.position.copy(particle.position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      instance.setMatrixAt(i, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
  });

  const material = useMemo(() => new MeshBasicMaterial({
    color: new Color('#8b8173'),
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    depthTest: true,
  }), []);
  const geometry = useMemo(() => new SphereGeometry(1, 8, 6), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  const portal = createPortal(
    <group>
      <instancedMesh ref={smoke} args={[geometry, material, PARTICLE_COUNT]} frustumCulled={false} />
    </group>,
    scene,
  );

  return <group ref={anchor} position={position}>{portal}</group>;
}
