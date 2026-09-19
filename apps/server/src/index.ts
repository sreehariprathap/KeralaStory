import { pathToFileURL } from 'node:url';
import { Server, createEndpoint, createRouter } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KeralaRoom } from './KeralaRoom.ts';
import { IpLimiter, originAllowed, readConfig, type ServerConfig } from './config.ts';
import { liveRooms } from './liveRooms.ts';
import { roomRegistry } from './roomRegistry.ts';
import { handleNpcChat, npcChatLimiter } from './npcChat.ts';

const START_TIME_MS = Date.now();

export function createGameServer(config: ServerConfig = readConfig()) {
  const transport = new WebSocketTransport({ maxPayload: config.maxPayload, verifyClient: (info: { origin: string }) => originAllowed(config, info.origin || undefined) });
  const server = new Server({ transport, greet: false, gracefullyShutdown: false });
  server.define('kerala', KeralaRoom);
  server.router = createRouter({
    resolveRoom: createEndpoint('/rooms/:code', { method: 'GET' }, async context => {
      const roomId = roomRegistry.resolve(context.params.code);
      return new Response(JSON.stringify(roomId ? { roomId } : { code: 'ROOM_NOT_FOUND' }), { status: roomId ? 200 : 404, headers: { 'content-type': 'application/json' } });
    }),
    npcChat: createEndpoint('/npc/chat', { method: 'POST' }, async context => {
      const result = await handleNpcChat(context.body, { geminiApiKey: process.env.GEMINI_API_KEY, openRouterApiKey: process.env.OPENROUTER_API_KEY, openRouterModel: process.env.OPENROUTER_MODEL });
      if ('error' in result) return new Response(JSON.stringify(result), { status: result.error === 'INVALID_MESSAGE' ? 400 : 503, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
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
    // Operator-only endpoints: infra probes and metrics scrapers rarely send an Origin header, so
    // they are handled before the browser-facing origin gate rather than exempted from it entirely.
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      const body = JSON.stringify({ status: 'ok', rooms: liveRooms.size, uptimeSec: Math.round((Date.now() - START_TIME_MS) / 1000) });
      response.writeHead(200, { 'content-type': 'application/json' }).end(body);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/metrics') {
      if (!config.metricsToken || request.headers.authorization !== `Bearer ${config.metricsToken}`) { response.writeHead(config.metricsToken ? 401 : 404).end(); return; }
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ rooms: liveRooms.snapshot() }));
      return;
    }
    if (!originAllowed(config, request.headers.origin)) { response.writeHead(403).end(); return; }
    if (request.method === 'POST' && url.pathname === '/npc/chat' && !npcChatLimiter.accept(request.socket.remoteAddress ?? 'unknown', Date.now())) {
      response.writeHead(429, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'RATE_LIMITED' }));
      return;
    }
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
