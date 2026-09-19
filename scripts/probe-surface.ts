// Raycasts the shared collision world along a line: npx tsx scripts/probe-surface.ts x0 z0 x1 z1 [step]
import RAPIER from '@dimforge/rapier3d-compat';
import { driveWorld } from '../tests/support/roadDrive';
import { terrainHeight, walkableDeckHeight } from '../src/content/world/definition';
await RAPIER.init();
const [x0, z0, x1, z1, step = 1] = process.argv.slice(2).map(Number);
const w = driveWorld(), n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step);
for (let i = 0; i <= n; i++) {
  const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
  const hit = w.castRay(new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 }), 800, true);
  const top = hit ? 400 - hit.timeOfImpact : NaN, col = hit ? w.getCollider(hit.collider.handle) : null;
  console.log(`${x.toFixed(1)},${z.toFixed(1)} top=${top.toFixed(2)} terrain=${terrainHeight(x, z).toFixed(2)} deck=${walkableDeckHeight(x, z)?.toFixed(2) ?? '-'} shape=${col?.shape.type}`);
}
