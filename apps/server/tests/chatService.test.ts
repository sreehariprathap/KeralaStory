import { expect, it } from 'vitest';
import { ChatService } from '../src/chatService';
const guest = { id: 'guest_aaaaaaaa', displayName: 'Maya' };
it('enforces membership, plain text, rate windows and repeated-violation mute', () => {
  const chat = new ChatService();
  expect(chat.send(undefined, 'hello', 0)).toEqual({ error: 'INVALID_MESSAGE' });
  for (const text of ['bad\u202etext', '<b>Hello</b>', 'https://example.com', 'bad\u0000text']) expect(chat.send(guest, text, 0)).toEqual({ error: 'INVALID_MESSAGE' });
  for (let i = 0; i < 4; i++) expect(chat.send(guest, 'നമസ്കാരം', i)).toHaveProperty('message.id', i + 1);
  expect(chat.send(guest, 'fifth', 4)).toEqual({ error: 'RATE_LIMITED' });
  expect(chat.send(guest, 'sixth', 5)).toEqual({ error: 'RATE_LIMITED' });
  expect(chat.send(guest, 'seventh', 6)).toEqual({ error: 'MUTED' });
  expect(chat.send(guest, 'still muted', 30_005)).toEqual({ error: 'MUTED' });
  expect(chat.send(guest, 'back', 30_006)).toHaveProperty('message.id', 5);
});
it('retains only the newest 100 immutable messages', () => {
  const chat = new ChatService();
  for (let i = 0; i < 120; i++) chat.send(guest, `message ${i}`, i * 10_000);
  const history = chat.history();
  expect(history).toHaveLength(100); expect(history[0].id).toBe(21); expect(history.at(-1)?.id).toBe(120);
  history[0].text = 'mutated'; expect(chat.history()[0].text).toBe('message 20');
});
