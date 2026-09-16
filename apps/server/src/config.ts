export interface ServerConfig { port: number; host: string; origins: readonly string[]; maxPayload: number; production: boolean; metricsToken: string | null }
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  const origins = (env.ALLOWED_ORIGINS ?? (production ? '' : 'http://127.0.0.1:5000,http://localhost:5000')).split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('ALLOWED_ORIGINS is required');
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins in production');
  }
  if (production && !env.PUBLIC_WS_URL?.startsWith('wss://')) throw new Error('PUBLIC_WS_URL must use WSS in production');
  const port = Number(env.PORT ?? 2567);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  return { port, host: env.HOST ?? '127.0.0.1', origins, maxPayload: 4096, production, metricsToken: env.METRICS_TOKEN?.trim() || null };
}
export function originAllowed(config: ServerConfig, origin: string | undefined) {
  return origin ? config.origins.includes(origin) : !config.production;
}

/** Fixed-window limiter with bounded memory; untrusted forwarded IP headers are never used. */
export class IpLimiter {
  private entries = new Map<string, { start: number; count: number }>();
  constructor(private limit = 30, private windowMs = 60_000) {}
  accept(ip: string, now: number) {
    for (const [key, value] of this.entries) if (now - value.start >= this.windowMs) this.entries.delete(key);
    const entry = this.entries.get(ip);
    if (entry) { entry.count++; return entry.count <= this.limit; }
    if (this.entries.size >= 10_000) return false;
    this.entries.set(ip, { start: now, count: 1 });
    return true;
  }
}
