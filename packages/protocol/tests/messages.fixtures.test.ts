import { describe, expect, it } from 'vitest';
import { ClientMessageSchema, ServerEventSchema } from '../src/index.ts';
import {
  invalidClientMessages,
  invalidServerEvents,
  validClientMessages,
  validServerEvents,
} from './fixtures.ts';

describe('protocol fixture catalogue', () => {
  it.each(validClientMessages)('accepts valid C2S %s fixture', (_name, message) => {
    expect(ClientMessageSchema.safeParse(message)).toMatchObject({ success: true });
  });

  it.each(validServerEvents)('accepts valid S2C %s fixture', (_name, event) => {
    expect(ServerEventSchema.safeParse(event)).toMatchObject({ success: true });
  });

  it.each(invalidClientMessages)('rejects C2S %s fixture at %s', (_name, field, message, expected) => {
    const result = ClientMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.join('.') === field && issue.message.includes(expected))).toBe(true);
    }
  });

  it.each(invalidServerEvents)('rejects S2C %s fixture at %s', (_name, field, event, expected) => {
    const result = ServerEventSchema.safeParse(event);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.join('.') === field && issue.message.includes(expected))).toBe(true);
    }
  });
});
