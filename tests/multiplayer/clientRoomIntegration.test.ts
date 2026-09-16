import { afterEach, expect, it } from 'vitest';
import { startGameServer } from '../../apps/server/src/index';
import { createSessionTokenRepository } from '../../src/features/multiplayer/sessionToken';
import { MultiplayerRoomClient } from '../../src/network/roomClient';
import { WORLD_VERSION } from '../../src/content/world/definition';

let cleanup: (() => Promise<unknown>) | undefined;
afterEach(async () => { await cleanup?.(); cleanup = undefined; });

it('receives welcome and schema patches through the real SDK lifecycle', async () => {
  const { server, transport } = await startGameServer({ port: 0, host: '127.0.0.1', allowedOrigins: [], maxPayload: 8192 });
  const address = transport.server!.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  let welcome = '';
  let resolvePlaying!: () => void;
  const playing = new Promise<void>(resolve => { resolvePlaying = resolve; });
  const client = new MultiplayerRoomClient(`http://127.0.0.1:${address.port}`, createSessionTokenRepository(), {
    onPhase: () => {},
    onEvent: event => {
      if (event.type === 'roomWelcome') welcome = event.payload.roomCode;
      if (event.type === 'roomSnapshot' && event.payload.phase === 'playing') resolvePlaying();
    },
  });
  cleanup = async () => { await client.leave(); await server.gracefullyShutdown(false); };
  await client.connect({ worldVersion: WORLD_VERSION, displayName: 'Explorer', appearance: { avatarPresetId: 'canopy', colors: { skin: '#ba805b', hair: '#292a25', clothing: '#285943' } } });
  client.send('ready', { worldVersion: WORLD_VERSION });
  await playing;
  expect(welcome).toMatch(/^[A-Z2-9]{8}$/);
}, 15000);
