import { describe, expect, it } from 'vitest';
import { Room, Server } from '@colyseus/core';
import { Client } from '@colyseus/sdk';
import RAPIER from '@dimforge/rapier3d-compat';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';

const PatchProbeState = schema({ revision: t.number() }, 'PatchProbeState');
type PatchProbeState = SchemaType<typeof PatchProbeState>;

class PatchProbeRoom extends Room<{ state: PatchProbeState }> {
  public state = new PatchProbeState({ revision: 0 });

  onCreate() {
    this.onMessage('advance', () => {
      this.state.revision = 1;
    });
  }
}

describe('authoritative multiplayer compatibility', () => {
  it('constructs the server-only physics world with the pinned dependencies', async () => {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.step();

    expect(world.timestep).toBeGreaterThan(0);
    expect(Room).toBeTypeOf('function');
    expect(Client).toBeTypeOf('function');

    world.free();
  });

  it('delivers a state patch from an in-process Colyseus room to its SDK client', async () => {
    const transport = new WebSocketTransport();
    const server = new Server({ transport, greet: false });
    server.define('compatibility-probe', PatchProbeRoom);
    try {
      await server.listen(0, '127.0.0.1');
      const address = transport.server?.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP address');

      const client = new Client(`ws://127.0.0.1:${address.port}`);
      const room = await client.joinOrCreate('compatibility-probe', {}, PatchProbeState);
      const receivedRevision = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for a Colyseus patch')), 1_000);
        room.onStateChange((state) => {
          if (state.revision === 1) {
            clearTimeout(timeout);
            resolve(state.revision);
          }
        });
        room.send('advance');
      });

      expect(receivedRevision).toBe(1);
      await room.leave();
    } finally {
      await server.gracefullyShutdown(false);
    }
  });
});
