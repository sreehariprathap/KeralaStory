/** Scores candidate football-ground centres near Kodakara (flatness of the pad on open ground). */
import { terrainHeight, V2_LAYOUT } from '../src/content/world/definition';
import { isOpenGround } from '../src/game/world/stuntSites';
import { STADIUM } from '../src/content/world/stadiumLayout';
const yaw = STADIUM.yaw, c = Math.cos(yaw), s = Math.sin(yaw), { halfWidth: hw, halfLength: hl } = STADIUM.pad;
const town = V2_LAYOUT.towns.find(t => t.id === 'kodakara')!;
const rows: string[] = [];
for (let x = -150; x <= -144; x += 2) for (let z = -420; z <= -300; z += 4) {
  let min = Infinity, max = -Infinity, sum = 0, n = 0, ok = true;
  for (let a = -hl; a <= hl && ok; a += 6) for (let b = -hw; b <= hw; b += 6) {
    const px = x + s * a + c * b, pz = z + c * a - s * b;
    if (!isOpenGround(px, pz) || Math.hypot(px + 245.952, pz + 349.774) < 46 + 18) { ok = false; break; }
    const y = terrainHeight(px, pz); min = Math.min(min, y); max = Math.max(max, y); sum += y; n++;
  }
  if (ok) rows.push(`${(max - min).toFixed(2)} ${x} ${z} mean=${(sum / n).toFixed(2)} townDz=${(Math.min(...town.footprint.map(p => p[1])) - z).toFixed(0)}`);
}
console.log(rows.sort((a, b) => parseFloat(a) - parseFloat(b)).slice(0, 12).join('\n'));
