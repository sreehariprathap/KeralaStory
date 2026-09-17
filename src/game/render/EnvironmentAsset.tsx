import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { V2AssetProfile } from '../../content/assets/v2AssetProfiles';
import { configureLegacyAssetMaterials } from './legacyAssetMaterials';
import { prepareEnvironmentAsset } from './prepareEnvironmentAsset';

function LoadedEnvironment({ profile, collide }: { profile: V2AssetProfile; collide?: 'trimesh' | 'hull' }) {
  const gltf = useLoader(GLTFLoader, profile.url, configureLegacyAssetMaterials);
  const prepared = useMemo(() => prepareEnvironmentAsset(gltf.scene, profile), [gltf.scene, profile]);
  useEffect(() => () => prepared.dispose(), [prepared]);
  const primitive = <primitive object={prepared.root} dispose={null}/>;
  if (!collide) return primitive;
  return <RigidBody type="fixed" colliders={collide}>{primitive}</RigidBody>;
}

class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Optional environment asset unavailable', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Placement owns collision independently, so an optional GLB failure cannot remove solid ground.
 * `collide` opts a loaded model into an auto-generated collider from its own mesh geometry (on top
 * of, not instead of, any hand-authored boxes) — the fallback stays collision-free either way.
 */
export function EnvironmentAsset({ profile, fallback, collide }: { profile: V2AssetProfile; fallback: ReactNode; collide?: 'trimesh' | 'hull' }) {
  return <AssetBoundary key={profile.id} fallback={fallback}><Suspense fallback={fallback}><LoadedEnvironment profile={profile} collide={collide}/></Suspense></AssetBoundary>;
}
