import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';
import type { ExplorerInput } from '../input/inputState';
import type { InputMode } from '../../contracts';
import { FEET_TO_CENTER } from '../player/controllerMath';

interface Props {
  body: RefObject<RapierRigidBody | null>;
  input: RefObject<ExplorerInput>;
  azimuth: RefObject<number>;
  mode: InputMode;
  sensitivity: number;
  reducedMotion: boolean;
  resetToken: number;
}

/** Environmental sphere sweep excludes the player and sensor-only discoveries. */
export function ThirdPersonCamera({ body, input, azimuth, mode, sensitivity, reducedMotion, resetToken }: Props) {
  const { world, rapier } = useRapier();
  const pitch = useRef(0.26);
  const distance = useRef(4.5);
  const initialized = useRef(false);
  const lastReset = useRef(resetToken);
  const vectors = useMemo(() => ({ anchor: new Vector3(), target: new Vector3(), direction: new Vector3(), goal: new Vector3() }), []);
  const sphere = useMemo(() => new rapier.Ball(0.2), [rapier]);

  useFrame(({ camera }, delta) => {
    const rigidBody = body.current;
    if (!rigidBody) return;
    const dt = Math.min(delta, 1 / 15);
    if (lastReset.current !== resetToken) { initialized.current = false; lastReset.current = resetToken; }
    if (mode === 'playing') {
      const controls = input.current;
      azimuth.current -= controls.lookX * 0.0025 * sensitivity;
      pitch.current = Math.max(-0.12, Math.min(0.9, pitch.current + controls.lookY * 0.002 * sensitivity));
      azimuth.current += (Number(controls.keys.has('KeyQ')) - Number(controls.keys.has('KeyE'))) * 1.5 * dt;
      controls.lookX = 0;
      controls.lookY = 0;
    }
    const position = rigidBody.translation();
    vectors.target.set(position.x, position.y - FEET_TO_CENTER + 1.28, position.z);
    if (!initialized.current || reducedMotion || vectors.anchor.distanceTo(vectors.target) > 12) vectors.anchor.copy(vectors.target);
    else vectors.anchor.lerp(vectors.target, 1 - Math.exp(-18 * dt));
    vectors.direction.set(Math.sin(azimuth.current) * Math.cos(pitch.current), Math.sin(pitch.current), Math.cos(azimuth.current) * Math.cos(pitch.current));
    const hit = world.castShape(vectors.anchor, { x: 0, y: 0, z: 0, w: 1 }, vectors.direction, sphere, 0.03, 4.5, true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rigidBody);
    const allowedDistance = hit ? Math.max(0.24, hit.time_of_impact - 0.08) : 4.5;
    // Retract immediately; ease back out once the wall is clear.
    if (allowedDistance < distance.current || !initialized.current || reducedMotion) distance.current = allowedDistance;
    else distance.current += (allowedDistance - distance.current) * (1 - Math.exp(-5 * dt));
    vectors.goal.copy(vectors.anchor).addScaledVector(vectors.direction, distance.current);
    camera.position.copy(vectors.goal);
    camera.lookAt(vectors.anchor);
    initialized.current = true;
  });
  return null;
}
