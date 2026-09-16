import { expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import { WORLD_VERSION } from '../../../src/content/world/definition.ts';
import { readConfig } from '../src/config.ts';
import { startGameServer } from '../src/index.ts';

async function withServer<T>(config: Parameters<typeof readConfig>[0], run: (port: number) => Promise<T>) {
  const { server, transport } = await startGameServer(readConfig(config));
  try {
    const address = transport.server!.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    return await run(address.port);
  } finally {
    await server.gracefullyShutdown(false);
  }
}

it('serves an unauthenticated health probe with no Origin header, even in production', async () => {
  await withServer({ PORT: '0', NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://example.com', PUBLIC_WS_URL: 'wss://example.com' }, async port => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'ok', rooms: 0 });
  });
});

it('disables /metrics with 404 until METRICS_TOKEN is configured, then requires the bearer token', async () => {
  await withServer({ PORT: '0' }, async port => {
    expect((await fetch(`http://127.0.0.1:${port}/metrics`)).status).toBe(404);
  });
  await withServer({ PORT: '0', METRICS_TOKEN: 'secret-token' }, async port => {
    expect((await fetch(`http://127.0.0.1:${port}/metrics`)).status).toBe(401);
    expect((await fetch(`http://127.0.0.1:${port}/metrics`, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    const response = await fetch(`http://127.0.0.1:${port}/metrics`, { headers: { authorization: 'Bearer secret-token' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rooms: [] });
  });
});

it('reports a live room in /metrics once a guest joins', async () => {
  await withServer({ PORT: '0', METRICS_TOKEN: 'secret-token' }, async port => {
    const client = new Client(`ws://127.0.0.1:${port}`);
    const room = await client.create('kerala', { displayName: 'Maya', appearance: { avatarPresetId: 'canopy', colors: { skin: '#dba77e', hair: '#292a25', clothing: '#285943' } }, worldVersion: WORLD_VERSION });
    try {
      await new Promise<void>(resolve => room.onMessage('roomWelcome', () => resolve()));
      const response = await fetch(`http://127.0.0.1:${port}/metrics`, { headers: { authorization: 'Bearer secret-token' } });
      const body = await response.json();
      expect(body.rooms).toHaveLength(1);
      expect(body.rooms[0]).toMatchObject({ joins: 1, activeGuests: 1, occupancy: 1 });
    } finally {
      await room.leave();
    }
  });
});
