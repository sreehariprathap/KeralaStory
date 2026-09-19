import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityMaterial, CityPaint, CityPiece } from '../../content/world/chalakkudyCity';

function colored(geometry: BufferGeometry, color: string) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
  g.deleteAttribute('uv');
  const c = new Color(color), colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

function merge(pieces: BufferGeometry[]) {
  const merged = pieces.length ? mergeGeometries(pieces, false)! : new BufferGeometry();
  pieces.forEach(p => p.dispose());
  return merged;
}

/** One vertex-coloured geometry per material: the whole city costs four draw calls plus paint. */
export function createCityGeometry(pieces: readonly CityPiece[]): Record<CityMaterial, BufferGeometry> {
  const groups: Record<CityMaterial, BufferGeometry[]> = { solid: [], ground: [], glass: [], glow: [] };
  const transform = new Object3D();
  for (const p of pieces) {
    const g = colored(new BoxGeometry(...p.size), p.color);
    transform.position.set(...p.position); transform.rotation.set(p.pitch ?? 0, p.yaw, 0, 'YXZ'); transform.updateMatrix();
    g.applyMatrix4(transform.matrix);
    groups[p.material].push(g);
  }
  return { solid: merge(groups.solid), ground: merge(groups.ground), glass: merge(groups.glass), glow: merge(groups.glow) };
}

/** Road paint strips laid on the terrain surface, a few millimetres above the road ribbon. */
export function createPaintGeometry(paint: readonly CityPaint[], heightAt: (x: number, z: number) => number) {
  const vertices: number[] = [], colors: number[] = [], color = new Color();
  for (const strip of paint) {
    const [ax, az] = strip.a, [bx, bz] = strip.b, length = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / length * strip.width / 2, nz = (bx - ax) / length * strip.width / 2;
    const corners = [[ax - nx, az - nz], [ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz]].map(([x, z]) => [x, heightAt(x, z) + .07, z]);
    color.set(strip.color);
    for (const i of [0, 1, 2, 0, 2, 3]) { vertices.push(...corners[i]); colors.push(color.r, color.g, color.b); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
