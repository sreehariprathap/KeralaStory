import { pathToFileURL } from 'node:url';
import { Server, createEndpoint, createRouter } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KeralaRoom } from './KeralaRoom.ts';
import { IpLimiter, originAllowed, readConfig, type ServerConfig } from './config.ts';
import { roomRegistry } from './roomRegistry.ts';

export function createGameServer(config: ServerConfig = readConfig()) {
  const transport = new WebSocketTransport({ maxPayload: config.maxPayload, verifyClient: (info: { origin: string }) => originAllowed(config, info.origin || undefined) });
  const server = new Server({ transport, greet: false, gracefullyShutdown: false });
  server.define('kerala', KeralaRoom);
  server.router = createRouter({
    resolveRoom: createEndpoint('/rooms/:code', { method: 'GET' }, async context => {
      const roomId = roomRegistry.resolve(context.params.code);
      return new Response(JSON.stringify(roomId ? { roomId } : { code: 'ROOM_NOT_FOUND' }), { status: roomId ? 200 : 404, headers: { 'content-type': 'application/json' } });
    }),
  }, { onRequest: (request: Request) => {
    if (!originAllowed(config, request.headers.get('origin') ?? undefined)) return new Response('Origin denied', { status: 403 });
    if (Number(request.headers.get('content-length') ?? 0) > config.maxPayload) return new Response('Payload too large', { status: 413 });
  } });
  return { server, transport, config };
}

/** Apply peer-IP limits before Colyseus parses requests. */
export async function startGameServer(config: ServerConfig = readConfig()) {
  const instance = createGameServer(config);
  await instance.server.listen(config.port, config.host);
  const http = instance.transport.server!;
  const handlers = http.listeners('request');
  http.removeAllListeners('request');
  const joins = new IpLimiter();
  http.on('request', (request, response) => {
    if (!originAllowed(config, request.headers.origin)) { response.writeHead(403).end(); return; }
    if (request.method === 'POST' && !joins.accept(request.socket.remoteAddress ?? 'unknown', Date.now())) { response.writeHead(429).end(); return; }
    if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) > config.maxPayload) { response.writeHead(413).end(); return; }
    for (const handler of handlers) handler.call(http, request, response);
  });
  return instance;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, config } = await startGameServer();
  console.info(JSON.stringify({ event: 'server-started', host: config.host, port: config.port }));
  const shutdown = () => { void server.gracefullyShutdown(false); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
