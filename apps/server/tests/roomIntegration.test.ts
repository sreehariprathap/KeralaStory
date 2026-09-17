import { expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { WORLD_VERSION } from '../../../src/content/world/definition.ts';
import { startGameServer } from '../src/index.ts';
import { readConfig } from '../src/config.ts';
import { RoomState } from '../src/roomState.ts';
import { type RoomSnapshotDto, type RoomWelcomeDto } from '@kerala-story/protocol';

const options = { displayName: 'Maya', appearance: { avatarPresetId: 'canopy', colors: { skin: '#dba77e', hair: '#292a25', clothing: '#285943' } }, worldVersion: WORLD_VERSION };
function snapshot(room: Room<RoomState>, predicate: (value: RoomSnapshotDto) => boolean) {
  return new Promise<RoomSnapshotDto>((resolve, reject) => {
    const timer = setTimeout(() => { remove(); reject(new Error(`Snapshot timeout: ${predicate.toString().slice(0, 120)}`)); }, 25_000);
    const receive = (state: RoomState) => {
      const players = [...state.players.values()].map(json => JSON.parse(json));
      const value: RoomSnapshotDto = { phase: state.phase as RoomSnapshotDto['phase'], worldVersion: state.worldVersion, players, vehicles: [], roster: players.map(({ id, displayName, connected }) => ({ id, displayName, connected })), serverTimeMs: state.serverTimeMs };
      if (predicate(value)) { clearTimeout(timer); remove(); resolve(value); }
    };
    const remove = () => room.onStateChange.remove(receive);
    room.onStateChange(receive);
  });
}
it('creates, moves, rejects eleven and reclaims one guest through real Colyseus connections', async () => {
  const { server, transport } = await startGameServer(readConfig({ PORT: '0' }));
  const rooms: Room<RoomState>[] = [];
  try {
    const address = transport.server!.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    const endpoint = `ws://127.0.0.1:${address.port}`;
    const client = new Client(endpoint);
    const first = await client.create('kerala', options, RoomState);
    rooms.push(first);
    const welcome = await new Promise<RoomWelcomeDto>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Welcome timeout')), 25_000);
      first.onMessage('roomWelcome', value => { clearTimeout(timer); resolve(value); });
      first.onMessage('roomSnapshot', () => {});
    });
    const resolved = await fetch(`http://127.0.0.1:${address.port}/rooms/${welcome.roomCode.toLowerCase()}`).then(response => response.json());
    expect(resolved.roomId).toBe(first.roomId);
    const initialPromise = snapshot(first, value => value.phase === 'playing');
    first.send('ready', { worldVersion: WORLD_VERSION });
    const initial = await initialPromise;
    const start = initial.players[0].transform.position;
    const moved = snapshot(first, value => value.players.some(player => player.id === welcome.guestId && player.lastProcessedInput === 1 && Math.abs(player.transform.position[2] - start[2]) > .03));
    first.send('input', { sequence: 1, moveX: 0, moveZ: 1, actions: [] });
    await moved;
    for (let i = 1; i < 10; i++) {
      const room = await client.joinById(first.roomId, { ...options, displayName: `Guest ${i}` }, RoomState);
      room.onMessage('roomWelcome', () => {}); room.onMessage('roomSnapshot', () => {});
      rooms.push(room);
    }
    await expect(client.joinById(first.roomId, options, RoomState)).rejects.toThrow('ROOM_FULL');
    await expect(client.joinById(first.roomId, { ...options, worldVersion: 'old-world' }, RoomState)).rejects.toThrow('WORLD_VERSION_MISMATCH');
    // Unexpected socket loss retains the application token and player ID.
    first.reconnection.enabled = false;
    const disconnected = snapshot(rooms[1], value => value.players.some(player => player.id === welcome.guestId && !player.connected));
    first.connection.close(4010);
    await disconnected;
    const rejoined = await client.joinById(first.roomId, { ...options, reconnectToken: welcome.reconnectToken }, RoomState);
    rooms.push(rejoined);
    const reclaimed = await new Promise<RoomWelcomeDto>(resolve => { rejoined.onMessage('roomWelcome', resolve); rejoined.onMessage('roomSnapshot', () => {}); });
    expect(reclaimed.guestId).toBe(welcome.guestId);
    const matching = await snapshot(rooms[1], value => value.players.length === 10 && value.players.every(player => player.connected));
    expect(new Set(matching.players.map(player => player.id)).size).toBe(10);
  } finally {
    await Promise.allSettled(rooms.filter(room => room.connection.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
}, 60_000);
