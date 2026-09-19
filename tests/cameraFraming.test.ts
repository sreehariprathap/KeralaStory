import { describe, expect, it } from 'vitest';
import { carFramingDistance } from '../src/game/camera/ThirdPersonCamera';
import { VEHICLE_PROFILES } from '../src/content/assets/vehicleProfiles';

describe('car camera framing', () => {
  it('keeps the shared 7.6 m chase distance when a profile asks for nothing', () => {
    expect(carFramingDistance(undefined)).toBe(7.6);
    expect(VEHICLE_PROFILES.admin.cameraDistance).toBeUndefined();
  });

  it('uses a profile override when one is set', () => {
    expect(carFramingDistance(13)).toBe(13);
  });

  it('pulls the camera back for the tall buggy', () => {
    expect(VEHICLE_PROFILES['willys-buggy'].cameraDistance).toBe(8);
  });
});
