import { COASTLINE, EXPANSION_LAYOUT, LANDMARKS, MAIN_PATH, V2_LAYOUT } from '../content/world/definition';
import type { PolygonXZ } from '../contracts/worldExpansion';
import type { Vec3 } from '../contracts';
import './v2-layout.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('V2 layout preview requires #app');

const { bounds } = V2_LAYOUT;
const width = bounds.xMax - bounds.xMin;
const height = bounds.zMax - bounds.zMin;
const viewBox = `${bounds.xMin} ${bounds.zMin} ${width} ${height}`;
const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
const point = (x: number, z: number) => `${x},${z}`;
const points = (items: readonly (readonly [number, number])[]) => items.map(([x, z]) => point(x, z)).join(' ');
const polygon = (shape: PolygonXZ, className: string, label: string) => `<polygon class="${className}" points="${points(shape)}" aria-label="${esc(label)}" />`;
const path = (items: readonly Vec3[], className: string) => `<polyline class="${className}" points="${items.map(item => point(item[0], item[2])).join(' ')}" />`;
const marker = (x: number, z: number, markerLabel: string, className = '') => `<g class="map-marker ${className}" transform="translate(${x} ${z})"><circle r="4"/>${markerLabel ? `<text x="-9" y="4" text-anchor="end">${esc(markerLabel)}</text>` : ''}</g>`;
const label = (x: number, z: number, text: string, className = '') => `<text class="map-label ${className}" x="${x}" y="${z}">${esc(text)}</text>`;

const existingRoute = path(MAIN_PATH.map(([x, z]) => [x, 0, z] as Vec3), 'existing-route');
const coastline = `<polyline class="coastline" points="${points(COASTLINE)}" />`;
const existingLandmarks = LANDMARKS.map(landmark => {
  const [x, , z] = landmark.position;
  const isHarbor = landmark.id === 'harbor' || landmark.id === 'lighthouse';
  return marker(x, z, isHarbor ? landmark.label : '', isHarbor ? 'harbor-marker' : 'existing-landmark');
}).join('');
const expansionRoutes = EXPANSION_LAYOUT.routes.map(route => path(route.points, 'existing-route expansion-route')).join('');
const proposedRoads = V2_LAYOUT.roads.map(road => path(road.points, 'proposed-road')).join('');
const proposedTowns = V2_LAYOUT.towns.map(town => {
  const [x, , z] = town.center;
  return `${polygon(town.footprint, `town-footprint tier-${town.tier.toLowerCase()} ${town.existing ? 'existing-town' : 'proposed-town'}`, `${town.label}, tier ${town.tier}`)}${label(x, z, town.label, 'town-label')}<text class="tier-label" x="${x}" y="${z + 18}">TIER ${town.tier}</text>`;
}).join('');
const rivers = V2_LAYOUT.riverReaches.map(reach => {
  return reach.points.slice(0, -1).map((p, i) => {
    const next = reach.points[i + 1];
    const d = `M ${p[0]} ${p[2]} L ${next[0]} ${next[2]}`;
    const widthM = (reach.widthsM[i] + reach.widthsM[i + 1]) / 2;
    return `<path class="river-reach river-${reach.kind}" d="${d}" stroke-width="${widthM}" data-reach="${esc(reach.label)}" />`;
  }).join('');
}).join('');
const arrows = V2_LAYOUT.riverReaches.flatMap(reach => {
  const samples = reach.points.slice(0, -1).map((p, i) => {
    const next = reach.points[i + 1];
    const angle = Math.atan2(next[2] - p[2], next[0] - p[0]) * 180 / Math.PI;
    return `<path class="flow-arrow" d="M -7 -4 L 0 0 L -7 4" transform="translate(${p[0] + (next[0] - p[0]) * .55} ${p[2] + (next[2] - p[2]) * .55}) rotate(${angle})" />`;
  });
  return samples;
}).join('');
const [summitX, , summitZ] = EXPANSION_LAYOUT.summitPosition;
const [harborX, , harborZ] = LANDMARKS.find(landmark => landmark.id === 'harbor')?.position ?? [48, 0, 77];
const [fallsX, , fallsZ] = V2_LAYOUT.riverNodes.find(node => node.id === 'falls-lip')?.position ?? [-627, 0, -400];
const poolX = V2_LAYOUT.park.poolFootprint.reduce((sum, p) => sum + p[0], 0) / V2_LAYOUT.park.poolFootprint.length;
const poolZ = Math.min(...V2_LAYOUT.park.poolFootprint.map(p => p[1])) - 6;
const riverLabels = V2_LAYOUT.riverReaches.filter((reach, index, all) => all.findIndex(candidate => candidate.label === reach.label) === index).map(reach => {
  const middle = reach.points[Math.floor(reach.points.length / 2)];
  return label(middle[0] + 14, middle[2], reach.label, 'river-label');
}).join('');

app.innerHTML = `
  <div class="review-shell">
    <header class="review-header">
      <div>
        <p class="eyebrow">WORLD BLUEPRINT · V2-01</p>
        <h1>Kodassery Diaries <span>— Layout review</span></h1>
        <p class="lede">A north-up terrain blockout for the connected Kerala 2000s world.</p>
      </div>
      <div class="status-stamp"><span></span> Layout approved · terrain blockout live</div>
    </header>
    <div class="review-grid">
      <section class="map-frame" aria-label="Live V2 terrain blockout map">
        <div class="map-toolbar"><span>North ↑</span><span>${Math.round(width)}m × ${Math.round(height)}m live bounds</span></div>
        <svg class="review-map" viewBox="${viewBox}" role="img" aria-labelledby="map-title map-desc" preserveAspectRatio="xMidYMid meet">
          <title id="map-title">Kodassery Diaries V2 live terrain blockout</title>
          <desc id="map-desc">Existing routes and landmarks are muted. Terrain, roads, rivers and four town or park inspection sites are enabled; town and park assets are pending.</desc>
          <rect class="map-ground" x="${bounds.xMin}" y="${bounds.zMin}" width="${width}" height="${height}" />
          <g class="layer-existing">${coastline}${existingRoute}${expansionRoutes}${existingLandmarks}</g>
          <g class="layer-river">${rivers}${arrows}${riverLabels}</g>
          <g class="layer-proposed">${proposedRoads}${proposedTowns}${polygon(V2_LAYOUT.park.footprint, 'park-footprint', 'Silver Storm park')}${polygon(V2_LAYOUT.park.poolFootprint, 'pool-footprint', 'Silver Storm pool')}${label(V2_LAYOUT.park.center[0], V2_LAYOUT.park.center[2], 'Silver Storm', 'park-label')}${label(poolX, poolZ, 'pool', 'pool-label')}</g>
          <g class="summit-marker" transform="translate(${summitX} ${summitZ})"><path d="M0 -12 L3 -3 L12 -3 L5 2 L8 11 L0 6 L-8 11 L-5 2 L-12 -3 L-3 -3 Z"/><text x="-15" y="4" text-anchor="end">Kodassery summit</text></g>
          ${label(fallsX - 14, fallsZ - 16, 'ATHIRAPPILLY', 'region-label')}
          ${label(harborX - 12, harborZ + 22, 'harbor · lighthouse', 'harbor-label')}
        </svg>
        <div class="map-keyline"><span>Terrain and roads live · town/park assets pending</span><span>Coordinates in metres · north-up</span></div>
      </section>
      <aside class="review-sidebar">
        <section class="legend-section"><h2>Reading the plan</h2><div class="legend-list">
          <span><i class="swatch town"></i>Town footprint</span><span><i class="swatch road"></i>Live road route</span><span><i class="swatch river"></i>River reach + flow</span><span><i class="swatch park"></i>Park / pool site</span><span><i class="swatch existing"></i>Existing world</span>
        </div></section>
        <section class="notes-section"><h2>Review notes</h2><ul>${V2_LAYOUT.reviewNotes.map(note => `<li>${esc(note)}</li>`).join('')}</ul></section>
        <section class="prompts-section"><h2>Three things to review</h2><ol><li>Do the Chalakkudy → Kodakara town spacing and tiers feel legible?</li><li>Does Malakkappara read as the upstream settlement, above the falls?</li><li>Is Silver Storm clearly east / right of the summit, with its pool to the north-east?</li></ol></section>
        <section class="toggle-section"><h2>Layers</h2><label><input type="checkbox" data-layer="existing" checked /> Existing context</label><label><input type="checkbox" data-layer="river" checked /> River + flow</label><label><input type="checkbox" data-layer="proposed" checked /> Terrain + sites</label></section>
      </aside>
    </div>
  </div>`;

document.querySelectorAll<HTMLInputElement>('[data-layer]').forEach(input => {
  input.addEventListener('change', () => {
    const layer = document.querySelector<SVGGElement>(`.layer-${input.dataset.layer}`);
    if (layer) layer.style.display = input.checked ? '' : 'none';
  });
});
