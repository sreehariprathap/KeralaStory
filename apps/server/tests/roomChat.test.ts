import { expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { WORLD_VERSION } from '../../../src/content/world/definition.ts';
import { startGameServer } from '../src/index.ts';
import { readConfig } from '../src/config.ts';
import { RoomState } from '../src/roomState.ts';
import type { ChatMessageDto, RoomErrorDto, RoomWelcomeDto } from '@kerala-story/protocol';

const options = { displayName: 'Maya', appearance: { avatarPresetId: 'canopy', colors: { skin: '#dba77e', hair: '#292a25', clothing: '#285943' } }, worldVersion: WORLD_VERSION };

function once<T>(room: Room<RoomState>, type: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${type} timeout`)), 15_000);
    room.onMessage(type, (value: T) => { clearTimeout(timer); resolve(value); });
  });
}

it('accepts, broadcasts and replays chat through the real room lifecycle', async () => {
  const { server, transport } = await startGameServer(readConfig({ PORT: '0' }));
  const rooms: Room<RoomState>[] = [];
  try {
    const address = transport.server!.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    const client = new Client(`ws://127.0.0.1:${address.port}`);
    const first = await client.create('kerala', options, RoomState);
    rooms.push(first);
    await once<RoomWelcomeDto>(first, 'roomWelcome');
    const second = await client.joinById(first.roomId, { ...options, displayName: 'Nick' }, RoomState);
    rooms.push(second);
    await once<RoomWelcomeDto>(second, 'roomWelcome');

    const receivedBySecond = once<ChatMessageDto>(second, 'chatAccepted');
    first.send('chatSend', { text: 'Hello there' });
    const received = await receivedBySecond;
    expect(received.senderName).toBe('Maya');
    expect(received.text).toBe('Hello there');

    // A third guest joining afterwards replays existing room history.
    const third = await client.joinById(first.roomId, { ...options, displayName: 'Guest 3' }, RoomState);
    rooms.push(third);
    const replayed = await once<ChatMessageDto>(third, 'chatAccepted');
    expect(replayed.id).toBe(received.id);

    const rejected = once<RoomErrorDto>(first, 'roomError');
    first.send('chatSend', { text: '<script>bad</script>' });
    expect((await rejected).code).toBe('INVALID_MESSAGE');
  } finally {
    await Promise.allSettled(rooms.filter(room => room.connection.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
}, 30_000);
