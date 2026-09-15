import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { Box3, Mesh, Object3D, Vector3, type InstancedMesh, type Material, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type ImportedTreeInstance = {
  position: [number, number, number];
  /** Uniform scale in metres after the source tree is normalized to one metre tall. */
  scale: number;
  rotation?: [number, number, number];
};

type Part = { geometry: BufferGeometry; material: Material };

/**
 * Loads the authored tree once, converts its Z-up export to the shared Y-up
 * world, and renders every source material as one instanced draw call.
 */
export const ImportedTrees = memo(function ImportedTrees({
  url,
  data,
}: {
  url: string;
  data: ImportedTreeInstance[];
}) {
  const gltf = useLoader(GLTFLoader, url);
  const parts = useMemo<Part[]>(() => {
    const source = gltf.scene;
    source.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    source.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    if (!meshes.length) throw new Error(`Tree asset has no mesh: ${url}`);

    const transformed = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      return { geometry, sourceMaterial: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material };
    });
    const bounds = new Box3();
    transformed.forEach(({ geometry }) => bounds.expandByObject(new Mesh(geometry)));
    const size = bounds.getSize(new Vector3());
    const height = Math.max(size.y, 0.001);
    const center = bounds.getCenter(new Vector3());
    return transformed.map(({ geometry, sourceMaterial }) => {
      geometry.translate(-center.x, -bounds.min.y, -center.z);
      geometry.scale(1 / height, 1 / height, 1 / height);
      return { geometry, material: sourceMaterial };
    });
  }, [gltf.scene, url]);

  useEffect(() => () => {
    // The normalized geometry is cloned per asset; the GLTF cache owns the
    // original geometry and materials, so only release these derived buffers.
    parts.forEach((part) => part.geometry.dispose());
  }, [parts]);

  return <group>
    {parts.map((part, partIndex) => (
      <ImportedTreePart key={`${url}-${partIndex}`} part={part} data={data} />
    ))}
  </group>;
});

function ImportedTreePart({ part, data }: { part: Part; data: ImportedTreeInstance[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new Object3D();
    data.forEach((instance, index) => {
      object.position.set(...instance.position);
      object.rotation.set(...(instance.rotation ?? [0, 0, 0]));
      object.scale.setScalar(instance.scale);
      object.updateMatrix();
      ref.current?.setMatrixAt(index, object.matrix);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [data]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, data.length]} castShadow receiveShadow />;
}
