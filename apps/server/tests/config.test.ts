import { expect, it } from 'vitest';
import { IpLimiter, originAllowed, readConfig } from '../src/config.ts';
it('requires exact secure origins and WSS for production', () => {
  expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('ALLOWED_ORIGINS');
  expect(() => readConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'http://example.com' })).toThrow('HTTPS');
  expect(() => readConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://example.com' })).toThrow('WSS');
  const config = readConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://example.com', PUBLIC_WS_URL: 'wss://game.example.com' });
  expect(originAllowed(config, undefined)).toBe(false);
  expect(originAllowed(config, 'https://example.com.attacker.test')).toBe(false);
  expect(originAllowed(config, 'https://example.com')).toBe(true);
});
it('bounds bursts per IP and permits a fresh window', () => {
  const limiter = new IpLimiter(2, 100);
  expect(limiter.accept('a', 0)).toBe(true);
  expect(limiter.accept('a', 1)).toBe(true);
  expect(limiter.accept('a', 2)).toBe(false);
  expect(limiter.accept('b', 2)).toBe(true);
  expect(limiter.accept('a', 100)).toBe(true);
});
