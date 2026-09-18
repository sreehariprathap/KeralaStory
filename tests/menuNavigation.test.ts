import { describe, expect, it } from 'vitest';
import { firstEnabled, stepIndex } from '../src/features/shell/menuNavigation';

describe('menu navigation', () => {
  it('moves down and up with wrap-around', () => {
    const none = [false, false, false];
    expect(stepIndex(none, 0, 1)).toBe(1);
    expect(stepIndex(none, 2, 1)).toBe(0);
    expect(stepIndex(none, 0, -1)).toBe(2);
  });

  it('skips disabled entries', () => {
    const disabled = [false, true, false, true];
    expect(stepIndex(disabled, 0, 1)).toBe(2);
    expect(stepIndex(disabled, 2, 1)).toBe(0);
    expect(stepIndex(disabled, 0, -1)).toBe(2);
  });

  it('stays put when everything else is disabled', () => {
    expect(stepIndex([true, true], 0, 1)).toBe(0);
  });

  it('finds the first enabled entry', () => {
    expect(firstEnabled([true, false, false])).toBe(1);
    expect(firstEnabled([true, true])).toBe(0);
  });
});
