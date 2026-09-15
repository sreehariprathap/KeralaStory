import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat';
import type { Group } from 'three';
import type { ExplorerControllerProps, Vec3 } from '../../contracts';
import { SLICE_BOUNDS } from '../../content/world/kodassery';
import { useExplorerInput } from '../input/useExplorerInput';
import { clearInput, headingFromMotion, movementIntent } from '../input/inputState';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { ExplorerAvatar } from './ExplorerAvatar';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, RUN_SPEED, WALK_SPEED, dampAngle, needsSafeReset } from './controllerMath';
import { computeExplorerMovement, createExplorerMotor } from './characterMotor';

export function ExplorerController(props: ExplorerControllerProps) {
  const { mode, profile, spawn, initialHeading = Math.PI, resetToken, sensitivity, reducedMotion } = props;
  const { world } = useRapier();
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<Group>(null);
  const controller = useRef<KinematicCharacterController | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const input = useExplorerInput(mode, props.onPause, props.onMap);
  const azimuth = useRef(-initialHeading);
  const heading = useRef(initialHeading);
  const verticalSpeed = useRef(0);
  const motion = useRef({ speed: 0, grounded: false });
  const safePosition = useRef<Vec3>([...spawn]);
  const tick = useRef(0);
  const ready = useRef(false);
  const previous = useRef({ x: spawn[0], y: spawn[1] + FEET_TO_CENTER, z: spawn[2] });

  useEffect(() => {
    const character = createExplorerMotor(world);
    controller.current = character;
    return () => { controller.current = null; world.removeCharacterController(character); };
  }, [world]);

  useEffect(() => {
    const rigidBody = body.current;
    if (!rigidBody) return;
    const start = latest.current.spawn;
    const target = { x: start[0], y: start[1] + FEET_TO_CENTER, z: start[2] };
    rigidBody.setTranslation(target, true);
    rigidBody.setNextKinematicTranslation(target);
    previous.current = target;
    safePosition.current = [...start];
    verticalSpeed.current = 0;
    motion.current = { speed: 0, grounded: false };
    clearInput(input.current);
    heading.current = latest.current.initialHeading ?? Math.PI;
    azimuth.current = -heading.current;
  }, [resetToken, input]);

  useEffect(() => {
    if (mode !== 'playing' && mode !== 'loading') {
      verticalSpeed.current = 0;
      motion.current.speed = 0;
    }
  }, [mode]);

  useBeforePhysicsStep(() => {
    const rigidBody = body.current;
    const shape = collider.current;
    const character = controller.current;
    if (!rigidBody || !shape || !character) return;
    const position = rigidBody.translation();
    previous.current = { ...position };
    if (latest.current.mode !== 'playing' && latest.current.mode !== 'loading') {
      rigidBody.setNextKinematicTranslation(position);
      motion.current.speed = 0;
      return;
    }
    if (needsSafeReset(position)) {
      const safe = safePosition.current;
      const target = { x: safe[0], y: safe[1] + FEET_TO_CENTER + 0.05, z: safe[2] };
      rigidBody.setTranslation(target, true);
      rigidBody.setNextKinematicTranslation(target);
      previous.current = target;
      verticalSpeed.current = 0;
      motion.current.speed = 0;
      clearInput(input.current);
      return;
    }
    const dt = Math.min(world.timestep, 1 / 30);
    const intent = movementIntent(input.current.keys, azimuth.current);
    const playing = latest.current.mode === 'playing';
    const desiredSpeed = playing ? (intent.running ? RUN_SPEED : WALK_SPEED) : 0;
    const motorState = { grounded: motion.current.grounded, verticalSpeed: verticalSpeed.current };
    const corrected = computeExplorerMovement(character, shape, motorState, {
      xVelocity: intent.x * desiredSpeed,
      zVelocity: intent.z * desiredSpeed,
      jump: playing && input.current.jumpQueued,
    }, dt);
    input.current.jumpQueued = false;
    verticalSpeed.current = motorState.verticalSpeed;
    motion.current.grounded = motorState.grounded;
    rigidBody.setNextKinematicTranslation({ x: position.x + corrected.x, y: position.y + corrected.y, z: position.z + corrected.z });
  });

  useAfterPhysicsStep(() => {
    const rigidBody = body.current;
    if (!rigidBody) return;
    const position = rigidBody.translation();
    const dt = Math.min(world.timestep, 1 / 30);
    const dx = position.x - previous.current.x;
    const dz = position.z - previous.current.z;
    motion.current.speed = Math.hypot(dx, dz) / dt;
    if (motion.current.speed > 0.06) heading.current = headingFromMotion(dx, dz);
    const feet: Vec3 = [position.x, position.y - FEET_TO_CENTER, position.z];
    const bounds = SLICE_BOUNDS;
    if (motion.current.grounded && !needsSafeReset(position) && position.x > bounds.xMin + 2 && position.x < bounds.xMax - 2 && position.z > bounds.zMin + 2 && position.z < bounds.zMax - 2) safePosition.current = feet;
    tick.current++;
    if (!ready.current && motion.current.grounded && tick.current >= 2) {
      ready.current = true;
      latest.current.onReady?.();
    }
    if (tick.current % 6 === 0 || tick.current === 1) latest.current.onSnapshot({ position: feet, headingRad: heading.current, speed: motion.current.speed, grounded: motion.current.grounded });
  });

  useFrame((_, delta) => {
    if (visual.current) visual.current.rotation.y = dampAngle(visual.current.rotation.y, Math.PI - heading.current, 1 - Math.exp(-15 * Math.min(delta, 0.06)));
  });

  return <>
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + FEET_TO_CENTER, spawn[2]]} enabledRotations={[false, false, false]} name="explorer-body">
      <CapsuleCollider ref={collider} args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} friction={0} />
      <group ref={visual} position={[0, -FEET_TO_CENTER, 0]} rotation={[0, Math.PI - initialHeading, 0]}>
        <ExplorerAvatar profile={profile} reducedMotion={reducedMotion} motion={motion} />
      </group>
    </RigidBody>
    <ThirdPersonCamera body={body} input={input} azimuth={azimuth} mode={mode} sensitivity={sensitivity} reducedMotion={reducedMotion} resetToken={resetToken} />
  </>;
}
