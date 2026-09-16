import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { Vector3 } from 'three';
import type { ReplicatedPlayerDto } from '@kerala-story/protocol';
import type { ExplorerControllerProps } from '../../contracts';
import type { MultiplayerSession } from '../../features/multiplayer/useMultiplayer';
import { useExplorerInput } from '../input/useExplorerInput';
import { readFollowMovement } from '../input/inputState';
import { RemoteExplorer } from './RemoteExplorer';

interface Props { player: ReplicatedPlayerDto; session: MultiplayerSession; controller: ExplorerControllerProps; focused: boolean }
/** Authority is the only source of player positions. No browser movement body is mounted. */
export function MultiplayerLocalController({ player, session, controller, focused }: Props) {
  const enabled = controller.mode === 'playing' && session.phase === 'connected' && focused;
  const input = useExplorerInput(enabled ? 'playing' : 'paused', controller.onPause, controller.onMap, controller.inputCommands);
  const azimuth = useRef(-player.transform.headingRad), pitch = useRef(.26), elapsed = useRef(0);
  const { world, rapier } = useRapier();
  const sphere = useMemo(() => new rapier.Ball(.2), [rapier]);
  const vectors = useMemo(() => ({ anchor: new Vector3(), direction: new Vector3() }), []);
  useEffect(() => { session.sender.current?.setFocused(enabled); }, [enabled, session.sender]);
  useEffect(() => { controller.onReady?.(); }, [controller.onReady]);
  useFrame(({ camera }, delta) => {
    const sender = session.sender.current, reconciliation = session.reconciliation.current;
    if (!sender || !reconciliation) return;
    const controls = input.current;
    const movement = readFollowMovement(controls, azimuth.current);
    const actions: ('jump' | 'brake' | 'nitro')[] = [];
    if (enabled) {
      if (controls.jumpQueued) actions.push('jump');
      if (controls.brake || controls.move.forward < 0) actions.push('brake');
      if (controls.keys.has('ShiftLeft') || controls.keys.has('ShiftRight')) actions.push('nitro');
    }
    sender.setIntent({ moveX: enabled ? player.travel.kind === 'vehicle' ? controls.move.x : movement.x : 0, moveZ: enabled ? player.travel.kind === 'vehicle' ? -controls.move.forward : movement.z : 0, actions });
    if (sender.tick(performance.now())) controls.jumpQueued = false;
    if (enabled && controls.interactQueued) {
      if (player.travel.kind === 'vehicle') session.client.current?.send('exitVehicle', {});
      else {
        const vehicles = session.latestSnapshot.current?.vehicles ?? [];
        const nearby = vehicles.map(vehicle => ({ vehicle, distance: Math.hypot(...vehicle.transform.position.map((value, index) => value - reconciliation.current.position[index])) })).sort((a,b) => a.distance - b.distance)[0];
        if (nearby && nearby.distance < 6) session.client.current?.send('enterVehicle', { vehicleId: nearby.vehicle.id });
      }
      controls.interactQueued = false;
    }
    const transform = reconciliation.advance(Math.min(delta, .1));
    if (enabled) { azimuth.current -= controls.lookX * .0025 * controller.sensitivity; azimuth.current += (Number(controls.keys.has('KeyQ')) - Number(controls.keys.has('KeyE'))) * delta * 1.5; pitch.current = Math.max(-.12, Math.min(.9, pitch.current + controls.lookY * .002 * controller.sensitivity)); }
    controls.lookX = 0; controls.lookY = 0;
    vectors.anchor.set(transform.position[0], transform.position[1] + 1.28, transform.position[2]);
    vectors.direction.set(Math.sin(azimuth.current) * Math.cos(pitch.current), Math.sin(pitch.current), Math.cos(azimuth.current) * Math.cos(pitch.current));
    const hit = world.castShape(vectors.anchor, { x: 0, y: 0, z: 0, w: 1 }, vectors.direction, sphere, .03, 4.5, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    camera.position.copy(vectors.anchor).addScaledVector(vectors.direction, hit ? Math.max(.24, hit.time_of_impact - .08) : 4.5); camera.lookAt(vectors.anchor);
    elapsed.current += delta;
    if (elapsed.current >= .1) { elapsed.current = 0; const vehicle = player.travel.kind === 'vehicle' ? session.latestSnapshot.current?.vehicles.find(value => value.id === (player.travel.kind === 'vehicle' ? player.travel.vehicleId : '')) : undefined; controller.onSnapshot({ position: [...transform.position], headingRad: transform.headingRad, speed: Math.hypot(transform.velocity[0], transform.velocity[2]), grounded: Math.abs(transform.velocity[1]) < .2, travelMode: vehicle?.kind ?? 'foot' }); }
  });
  return <RemoteExplorer player={player} sample={() => session.reconciliation.current?.current ?? null} reducedMotion={controller.reducedMotion}/>;
}
