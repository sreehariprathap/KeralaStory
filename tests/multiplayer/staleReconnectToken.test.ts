import { afterEach, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import { startGameServer } from '../../apps/server/src/index';
import { createSessionTokenRepository } from '../../src/features/multiplayer/sessionToken';
import { MultiplayerRoomClient } from '../../src/network/roomClient';
import { WORLD_VERSION } from '../../src/content/world/definition';

const options = { displayName: 'Maya', appearance: { avatarPresetId: 'canopy' as const, colors: { skin: '#dba77e' as const, hair: '#292a25' as const, clothing: '#285943' as const } }, worldVersion: WORLD_VERSION };

let cleanup: (() => Promise<unknown>) | undefined;
afterEach(async () => { await cleanup?.(); cleanup = undefined; });

it('clears a saved token that the server denies, so the next join is not stuck retrying it', async () => {
  const { server, transport } = await startGameServer({ port: 0, host: '127.0.0.1', origins: ['http://127.0.0.1:5000'], maxPayload: 8192, production: false, metricsToken: null });
  const address = transport.server!.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  const endpoint = `http://127.0.0.1:${address.port}`;
  cleanup = async () => server.gracefullyShutdown(false);

  const owner = new Client(endpoint);
  const first = await owner.create('kerala', options);
  const welcome = await new Promise<{ roomCode: string }>(resolve => first.onMessage('roomWelcome', resolve));
  cleanup = async () => { await first.leave(true); await server.gracefullyShutdown(false); };

  const storage = new Map<string, string>();
  const backing = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value), removeItem: (key: string) => void storage.delete(key), key: () => null, clear: () => storage.clear(), get length() { return storage.size; } } as Storage;
  const tokens = createSessionTokenRepository(backing);
  // A stale/never-issued token in the exact shape the server expects but unknown to it.
  tokens.set(welcome.roomCode, 'z'.repeat(40));

  const guest = new MultiplayerRoomClient(endpoint, tokens, { onPhase: () => {}, onEvent: () => {} });
  await expect(guest.connect({ ...options, displayName: 'Nick' }, welcome.roomCode)).rejects.toThrow('RECONNECT_DENIED');
  expect(tokens.get(welcome.roomCode).token).toBeNull();
}, 15000);
