import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { townPoint, type TownStreet } from '../../content/world/townLayout';

/** Merge the modest street kit into one vertex-colored draw call; imported coffee stays separate. */
export function createTownGeometry(street: TownStreet, heightAt: (x: number, z: number) => number) {
  const pieces: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, color: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
    const transform = new Object3D(); transform.position.set(...position); transform.rotation.set(...rotation); transform.updateMatrix(); g.applyMatrix4(transform.matrix);
    g.deleteAttribute('uv');
    const c = new Color(color), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3)); pieces.push(g);
  };
  for (const box of street.boxes) {
    if (box.id === 'chalakkudy-coffee-shell' || box.id === 'chalakkudy-coffee-floor') continue;
    add(new BoxGeometry(...box.size), box.color, box.position, box.rotation);
  }
  for (const b of street.buildings.filter(b => b.kind !== 'coffee')) {
    const localBox = (p: [number, number, number], size: [number, number, number], color: string) => add(new BoxGeometry(...size), color, townPoint(b.origin, b.yaw, ...p), [0, b.yaw, 0]);
    const y = b.floorY + b.height, w = b.width / 2 + .5, d = b.depth / 2 + .5;
    const roof = new BufferGeometry();
    roof.setAttribute('position', new Float32BufferAttribute([-w, y, -d, w, y, -d, w, y, d, -w, y, d, 0, y + 1.5, -d + 1.4, 0, y + 1.5, d - 1.4], 3));
    roof.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0]); roof.computeVertexNormals();
    add(roof, '#b96545', b.origin, [0, b.yaw, 0]);
    localBox([0, y - .04, 0], [b.width + 1.1, .14, b.depth + 1.1], '#72563d');
    const front = (b.depth - 3) / 2 - 1 + .055;
    localBox([0, b.floorY + 1.2, front], [1.2, 2.4, .1], '#72563d');
    for (const side of [-1, 1]) {
      localBox([side * b.width * .28, b.floorY + 1.8, front], [1.7, 1.3, .12], '#435d52');
      localBox([side * (b.width / 2 - .5), b.floorY + b.height / 2, b.depth / 2 - .35], [.16, b.height, .16], '#72563d');
      localBox([side * b.width * .28, b.floorY + 1.8, front + .08], [.08, 1.35, .08], '#e5d7b3');
    }
  }
  for (let i = 1; i < street.lane.length; i++) {
    const a = street.lane[i - 1], b = street.lane[i], length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const nx = -(b[2] - a[2]) / length * 1.3, nz = (b[0] - a[0]) / length * 1.3;
    const vertices: number[] = [], indices: number[] = [], count = Math.ceil(length);
    for (let j = 0; j <= count; j++) {
      const x = a[0] + (b[0] - a[0]) * j / count, z = a[2] + (b[2] - a[2]) * j / count;
      for (const side of [-1, 1]) vertices.push(x + nx * side, heightAt(x + nx * side, z + nz * side) + .035, z + nz * side);
      if (j) { const p = (j - 1) * 2; indices.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); add(geometry, '#bfad79', [0, 0, 0]);
  }
  const merged = mergeGeometries(pieces, false)!; pieces.forEach(p => p.dispose()); return merged;
}
