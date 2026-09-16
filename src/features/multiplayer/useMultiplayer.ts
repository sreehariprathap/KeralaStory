import { useEffect, useRef, useState } from 'react';
import type { ChatMessageDto, RoomSnapshotDto, RoomWelcomeDto } from '@kerala-story/protocol';
import type { ExplorerProfile } from '../../contracts';
import { WORLD_VERSION } from '../../content/world/definition';
import { MultiplayerRoomClient, type ConnectionPhase } from '../../network/roomClient';
import { RemoteSnapshots } from '../../network/remoteSnapshots';
import { LocalReconciliation } from '../../network/reconciliation';
import { InputSender } from '../../network/inputSender';
import { createSessionTokenRepository } from './sessionToken';

export function useMultiplayer() {
  const [phase, setPhase] = useState<ConnectionPhase>('idle');
  const [welcome, setWelcome] = useState<RoomWelcomeDto | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshotDto | null>(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const remote = useRef(new RemoteSnapshots());
  const reconciliation = useRef<LocalReconciliation | null>(null);
  const self = useRef<string | null>(null);
  const sender = useRef<InputSender | null>(null);
  const client = useRef<MultiplayerRoomClient | null>(null);
  const latestSnapshot = useRef<RoomSnapshotDto | null>(null);
  const connect = async (profile: ExplorerProfile, code?: string) => {
    await client.current?.leave(false);
    setError(''); setMessages([]); setWelcome(null); setSnapshot(null);
    remote.current.clear(); reconciliation.current = null; self.current = null;
    const endpoint = import.meta.env.VITE_MULTIPLAYER_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:2567`;
    const next = new MultiplayerRoomClient(endpoint, createSessionTokenRepository(), {
      onPhase: nextPhase => { setPhase(nextPhase); if (nextPhase !== 'connected') sender.current?.setFocused(false); },
      onWarning: setError,
      onEvent: event => {
        if (event.type === 'roomWelcome') { self.current = event.payload.guestId; setWelcome(event.payload); next.send('ready', { worldVersion: WORLD_VERSION }); }
        if (event.type === 'roomSnapshot') {
          latestSnapshot.current = event.payload; remote.current.push(event.payload); setSnapshot(event.payload);
          const player = event.payload.players.find(value => value.id === self.current);
          if (player) {
            sender.current?.acknowledge(player.lastProcessedInput);
            // No browser body drives multiplayer. Until collision prediction is available, smoothly follow authority.
            if (!reconciliation.current) reconciliation.current = new LocalReconciliation(player.transform, state => state);
            else {
              const previous = reconciliation.current.current.position;
              const reset = Math.hypot(...player.transform.position.map((value, index) => value - previous[index])) > 12;
              reconciliation.current.reconcile(player.transform, player.lastProcessedInput, reset);
              if (reset) setError('The server returned your explorer to a safe position.');
            }
          }
        }
        if (event.type === 'roomError') setError(`${event.payload.code}: ${event.payload.message}`);
        if (event.type === 'chatAccepted') setMessages(current => current.some(value => value.id === event.payload.id) ? current : [...current, event.payload].slice(-50));
      },
    });
    client.current = next;
    sender.current = new InputSender(input => { next.send('input', input); });
    try { await next.connect({ displayName: profile.displayName, appearance: { avatarPresetId: profile.avatarPresetId, characterModelId: profile.characterModelId, colors: profile.colors }, worldVersion: WORLD_VERSION }, code); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not connect. Please try again.'); }
  };
  const leave = () => { void client.current?.leave(); client.current = null; self.current = null; reconciliation.current = null; sender.current = null; remote.current.clear(); setWelcome(null); setSnapshot(null); setPhase('idle'); };
  useEffect(() => () => { void client.current?.leave(false); }, []);
  return { phase, welcome, snapshot, error, messages, remote, reconciliation, sender, client, latestSnapshot, connect, leave };
}
export type MultiplayerSession = ReturnType<typeof useMultiplayer>;
