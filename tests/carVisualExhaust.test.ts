import { describe, expect, it } from 'vitest';
import { exhaustPosition } from '../src/game/vehicle/CarVisual';

describe('exhaust placement', () => {
  it('keeps the admin car on its hand-placed tailpipe', () => {
    expect(exhaustPosition('admin')).toEqual([.5, .32, -1.5]);
  });

  it('falls back to the shared rear position for a profile that sets none', () => {
    expect(exhaustPosition('fennec')).toEqual([.5, .32, -1.9]);
  });
});
