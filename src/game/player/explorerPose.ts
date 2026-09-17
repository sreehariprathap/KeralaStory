import type { TravelMode } from '../../contracts';

/**
 * The local explorer's latest physics pose, written every fixed step by ExplorerController.
 * Physics-rate readers (the football) use this instead of the throttled UI snapshot.
 */
export const explorerPose = {
  ready: false,
  x: 0, y: 0, z: 0,
  /** Feet height. */
  feetY: 0,
  headingRad: 0,
  speed: 0,
  vx: 0, vz: 0,
  grounded: false,
  swimming: false,
  travelMode: 'foot' as TravelMode,
};
