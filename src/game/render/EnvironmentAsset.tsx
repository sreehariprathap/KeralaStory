import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { V2AssetProfile } from '../../content/assets/v2AssetProfiles';
import { configureLegacyAssetMaterials } from './legacyAssetMaterials';
import { prepareEnvironmentAsset } from './prepareEnvironmentAsset';

function LoadedEnvironment({ profile }: { profile: V2AssetProfile }) {
  const gltf = useLoader(GLTFLoader, profile.url, configureLegacyAssetMaterials);
  const prepared = useMemo(() => prepareEnvironmentAsset(gltf.scene, profile), [gltf.scene, profile]);
  useEffect(() => () => prepared.dispose(), [prepared]);
  return <primitive object={prepared.root} dispose={null}/>;
}

class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Optional environment asset unavailable', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Placement owns collision independently, so an optional GLB failure cannot remove solid ground. */
export function EnvironmentAsset({ profile, fallback }: { profile: V2AssetProfile; fallback: ReactNode }) {
  return <AssetBoundary key={profile.id} fallback={fallback}><Suspense fallback={fallback}><LoadedEnvironment profile={profile}/></Suspense></AssetBoundary>;
}
