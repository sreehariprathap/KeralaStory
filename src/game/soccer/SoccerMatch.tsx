import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';
import { STADIUM } from '../../content/world/stadiumLayout';
import { explorerPose } from '../player/explorerPose';
import {
  BALL_MASS, BALL_RADIUS, GOAL_RESET_SECONDS, KICK_CHARGE_SECONDS, OUT_RESET_SECONDS,
  canKick, dribbleVelocity, goalScored, hasLeftGround, isOutOfPlay, kickOffSpot, kickVelocity, restartSpot, type GoalEnd,
} from './soccerRules';
import { resetSoccerMotion, soccerMotion } from './soccerMotion';

export type SoccerEvent = { kind: 'goal'; end: GoalEnd } | { kind: 'out' } | { kind: 'left' };
/** Kick input shared with the HUD button: `held` charges, releasing kicks. */
export interface KickControl { held: boolean }
interface Props { active: boolean; playing: boolean; kick: KickControl; onEvent: (event: SoccerEvent) => void; chargeBar: { current: HTMLElement | null } }

function useBallTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f7f7f2';
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = '#1e1e1e';
    // Pentagon patches, spread over an equirectangular wrap.
    for (const [x, y] of [[32, 30], [96, 70], [160, 30], [224, 70], [64, 104], [192, 104], [128, 8], [0, 70], [256, 70]]) {
      context.beginPath();
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; context.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 11); }
      context.fill();
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const pitchY = STADIUM.groundY;

/** The football for one match. Mounted only while a match is running. */
export function SoccerMatch({ active, playing, kick, onEvent, chargeBar }: Props) {
  const ball = useRef<RapierRigidBody>(null), marker = useRef<Group>(null);
  const texture = useBallTexture();
  const state = useRef({ charge: 0, wasHeld: false, resetIn: 0, resetTo: kickOffSpot(), pending: false, left: false, kickCooldown: 0, touchIn: 0 });
  const latest = useRef({ onEvent, playing });
  latest.current = { onEvent, playing };

  useEffect(() => {
    // K charges a kick; releasing it kicks.
    const down = (event: KeyboardEvent) => { if (event.code === 'KeyK') { kick.held = true; event.preventDefault(); } };
    const up = (event: KeyboardEvent) => { if (event.code === 'KeyK') kick.held = false; };
    const blur = () => { kick.held = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); kick.held = false; };
  }, [kick]);
  useEffect(() => {
    soccerMotion.active = active;
    return () => resetSoccerMotion();
  }, [active]);

  const place = (spot: { x: number; z: number }) => {
    const body = ball.current;
    if (!body) return;
    body.setTranslation({ x: spot.x, y: pitchY + BALL_RADIUS + .4, z: spot.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  useBeforePhysicsStep(world => {
    const body = ball.current, s = state.current;
    soccerMotion.dribbling = false;
    if (!body || !active || !latest.current.playing) { s.charge = 0; soccerMotion.charge = 0; return; }
    const dt = world.timestep, p = body.translation(), v = body.linvel(), pose = explorerPose;
    s.kickCooldown = Math.max(0, s.kickCooldown - dt);
    if (s.pending) {
      soccerMotion.charge = s.charge = 0;
      s.resetIn -= dt;
      if (s.resetIn <= 0) { s.pending = false; place(s.resetTo); }
      return;
    }
    if (pose.ready && !s.left && pose.travelMode === 'foot' && hasLeftGround(pose.x, pose.z)) { s.left = true; latest.current.onEvent({ kind: 'left' }); return; }
    const end = goalScored(p.x, p.y - pitchY - BALL_RADIUS, p.z);
    if (end) { soccerMotion.goals++; s.pending = true; s.resetIn = GOAL_RESET_SECONDS; s.resetTo = kickOffSpot(); latest.current.onEvent({ kind: 'goal', end }); return; }
    if (isOutOfPlay(p.x, p.z) || p.y < pitchY - 3) { s.pending = true; s.resetIn = OUT_RESET_SECONDS; s.resetTo = restartSpot(p.x, p.z); latest.current.onEvent({ kind: 'out' }); return; }
    const onFoot = pose.ready && pose.travelMode === 'foot' && !pose.swimming;
    const player = { x: pose.x, z: pose.z, headingRad: pose.headingRad, speed: pose.speed };
    // Charge while K is held; kick on release.
    if (kick.held && onFoot) s.charge = Math.min(1, s.charge + dt / KICK_CHARGE_SECONDS);
    if (!kick.held && s.wasHeld && onFoot && s.kickCooldown <= 0) {
      soccerMotion.kicks++;
      soccerMotion.kickPower = s.charge;
      if (canKick(player, p)) {
        const launch = kickVelocity(pose.headingRad, s.charge, { x: pose.vx, z: pose.vz });
        body.setLinvel(launch, true);
        body.setAngvel({ x: launch.z * 2, y: 0, z: -launch.x * 2 }, true);
        s.kickCooldown = .35;
      }
      s.charge = 0;
    }
    if (!kick.held) s.charge = 0;
    s.wasHeld = kick.held;
    if (onFoot && s.kickCooldown <= 0) {
      const dribble = dribbleVelocity(player, { x: p.x, y: p.y - pitchY - BALL_RADIUS, z: p.z }, v);
      if (dribble) body.setLinvel({ x: dribble.x, y: Math.min(v.y, 0), z: dribble.z }, true);
      // A light touch on the ball every few strides while running with it.
      soccerMotion.dribbling = !!dribble;
      s.touchIn = dribble ? s.touchIn - dt : 0;
      if (dribble && s.touchIn <= 0) { soccerMotion.touches++; s.touchIn = .55; }
    }
    soccerMotion.charge = s.charge;
  });

  useFrame(() => {
    const bar = chargeBar.current;
    if (bar) bar.style.transform = `scaleX(${state.current.charge})`;
    // A soft ring under the ball helps judge where it is.
    const body = ball.current;
    if (body && marker.current) { const p = body.translation(); marker.current.position.set(p.x, pitchY + .02, p.z); }
  });

  if (!active) return null;
  const spot = kickOffSpot();
  return <>
    <RigidBody ref={ball} type="dynamic" colliders={false} position={[spot.x, pitchY + BALL_RADIUS + .4, spot.z]} linearDamping={.35} angularDamping={.6} ccd userData={{ passThrough: true }} name="football">
      <BallCollider args={[BALL_RADIUS]} mass={BALL_MASS} restitution={.62} friction={.8}/>
      <mesh castShadow><sphereGeometry args={[BALL_RADIUS, 24, 16]}/><meshStandardMaterial map={texture} roughness={.55}/></mesh>
    </RigidBody>
    <group ref={marker}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[BALL_RADIUS + .08, BALL_RADIUS + .16, 24]}/><meshBasicMaterial color="#fff7e0" transparent opacity={.55} depthWrite={false}/></mesh></group>
  </>;
}
