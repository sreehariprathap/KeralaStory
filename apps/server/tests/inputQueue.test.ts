import { describe, expect, it } from 'vitest';
import { InputQueue, ServerTicker } from '../src/inputQueue.ts';
describe('server input and cadence', () => {
  it('rejects position injection, duplicate and reordered inputs; retains only newest intent', () => {
    const queue = new InputQueue();
    const input = { sequence: 1, moveX: 1, moveZ: 0, actions: [] };
    expect(queue.push('a', { ...input, position: [999, 999, 999] })).toBe(false);
    expect(queue.push('a', input)).toBe(true);
    expect(queue.push('a', input)).toBe(false);
    expect(queue.push('a', { ...input, sequence: 0 })).toBe(false);
    expect(queue.push('a', { ...input, sequence: 2, moveX: 0 })).toBe(true);
    expect(queue.drain()).toEqual([['a', { ...input, sequence: 2, moveX: 0 }]]);
    expect(queue.drain()).toEqual([]);
  });
  it('steps 60 times with 20 patch opportunities and caps stalls at five steps', () => {
    const ticker = new ServerTicker(); let steps = 0; let patches = 0;
    for (let i = 0; i < 60; i++) ticker.advance(1000 / 60, () => steps++, () => patches++);
    expect([steps, patches]).toEqual([60, 20]);
    expect(ticker.advance(10_000, () => steps++, () => patches++)).toBe(5);
    expect(ticker.advance(0, () => steps++, () => patches++)).toBe(0);
  });
});
