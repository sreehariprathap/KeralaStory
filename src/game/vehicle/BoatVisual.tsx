import { ModelAsset } from '../render/ModelAsset';

export const BOAT_MODEL_URL = '/assets/boats/toy_boat.glb';
/** Overall model height (keel to funnel top); the hull comes out about 4.2 m long. */
const MODEL_HEIGHT = 2.8;
/** How far the keel sits below the waterline. */
export const BOAT_DRAFT = .35;

/** The toy steamboat, origin at the waterline, bow toward +z (the rider's forward). Like a car, the crew rides unseen. */
export function BoatVisual() {
  return <group position={[0, -BOAT_DRAFT, 0]}>
    <ModelAsset url={BOAT_MODEL_URL} height={MODEL_HEIGHT} rotationY={0} name="boat"/>
  </group>;
}
