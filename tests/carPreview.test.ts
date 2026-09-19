import { describe, expect, it } from 'vitest';
import { previewFraming } from '../src/features/vehicles/CarPreview';

describe('car preview framing', () => {
  it('keeps the hand-tuned framing for a normal-length car', () => {
    const { camera, discRadius } = previewFraming('admin');
    expect(camera).toEqual([5, 3.2, 6]);
    expect(discRadius).toBe(3.4);
  });

  it('pulls back and widens the ground disc for a long vehicle', () => {
    const car = previewFraming('admin'), buggy = previewFraming('willys-buggy');
    expect(buggy.camera[2]).toBeGreaterThan(car.camera[2]);
    expect(buggy.discRadius).toBeGreaterThan(car.discRadius);
  });
});
