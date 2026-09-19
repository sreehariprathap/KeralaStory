import type { TraversalBox } from '../../game/world/traversalGeometry';
import type { CityMaterial, CityPaint, CityPiece, CitySign } from './chalakkudyCity';
import { EXPANSION_LAYOUT, V2_LAYOUT, V2_ROUTES, terrainHeight } from './definition';
import { ALL_LOTS, MALAKKAPPARA_BUS_BAY, MALAKKAPPARA_FILL_BLEND_M, MALAKKAPPARA_GARDEN, MALAKKAPPARA_WALL_EDGES, lotCorners, type TownLot } from './malakkapparaPlan';
import { yawPitchToXyz } from './rotation';

type V3 = [number, number, number];
const STOREY = 3.1, DARK = '#26303a', WINDOW = '#3d5a73', FRAME = '#f4f1ea', TANK = '#1d1f22', STONE = '#8f887a';
const ROOF_TILE = ['#9b4a2f', '#7c3b28', '#a9573a'] as const, SHEET = '#8f949a';
const hash = (n: number, salt: number) => { let t = Math.imul(n + 11, 0x9e3779b1) ^ Math.imul(salt + 3, 0x85ebca6b); t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d); return ((t ^ (t >>> 13)) >>> 0) / 4294967296; };
const idNumber = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** Ground under a rotated footprint: five samples along each side plus the centre. */
function footprintGround(l: Pick<TownLot, 'x' | 'z' | 'width' | 'depth' | 'yaw'>) {
  const c = Math.cos(l.yaw), s = Math.sin(l.yaw), heights: number[] = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    if (i && i < 4 && j && j < 4 && !(i === 2 && j === 2)) continue;
    const ax = (i / 4 - .5) * l.width, az = (j / 4 - .5) * l.depth;
    heights.push(terrainHeight(l.x + c * ax + s * az, l.z - s * ax + c * az));
  }
  return { min: Math.min(...heights), max: Math.max(...heights) };
}

function createTown() {
  const pieces: CityPiece[] = [], boxes: TraversalBox[] = [], signs: CitySign[] = [], paint: CityPaint[] = [];
  const piece = (material: CityMaterial, position: V3, size: V3, color: string, yaw = 0, pitch = 0) => pieces.push({ position, size, yaw, pitch, color, material });
  const collide = (id: string, position: V3, size: V3, yaw = 0) => boxes.push({ id, position, size, rotation: yawPitchToXyz(yaw, 0) });

  /** A frame local to a lot: u across its front (to the right when facing it from outside is −u), v out of its front. */
  const frame = (x: number, z: number, yaw: number) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return (u: number, y: number, v: number): V3 => [x + c * u + s * v, y, z - s * u + c * v];
  };

  for (const lot of ALL_LOTS) {
    const n = idNumber(lot.id), at = frame(lot.x, lot.z, lot.yaw), { width: w, depth: d, yaw } = lot;
    const ground = footprintGround(lot), floor = ground.max + .2;
    // Plinth down to the lowest ground: on the hillside it reads as the stone storey under the house.
    const plinthH = floor - ground.min + .4, plinth: V3 = at(0, floor - plinthH / 2, 0), plinthSize: V3 = [w + .5, plinthH, d + .5];
    piece('solid', plinth, plinthSize, plinthH > 1.6 ? STONE : '#b9b3a8', yaw); collide(`${lot.id}-plinth`, plinth, plinthSize, yaw);
    const open = lot.kind === 'bus-shelter';
    const H = open ? 3 : lot.floors * STOREY + (lot.kind === 'shop' || lot.kind === 'tea-stop' ? .4 : 0);
    if (!open) {
      const body = at(0, floor + H / 2, 0), size: V3 = [w, H, d];
      piece('solid', body, size, lot.wall, yaw); collide(`${lot.id}-shell`, body, size, yaw);
      // Floor bands and a slightly darker base course.
      piece('solid', at(0, floor + .3, d / 2 + .02), [w + .04, .6, .06], '#8d8578', yaw);
      for (let f = 1; f < lot.floors; f++) piece('solid', at(0, floor + f * STOREY + (H - lot.floors * STOREY), d / 2 + .06), [w + .1, .16, .14], FRAME, yaw);
    }
    const storeyBase = (f: number) => floor + f * STOREY + (H - lot.floors * STOREY);
    // Windows on every storey of every face (not the shop fronts), with white frames and a sill.
    const faces = [{ turn: 0, span: w, out: d / 2 }, { turn: Math.PI, span: w, out: d / 2 }, { turn: Math.PI / 2, span: d, out: w / 2 }, { turn: -Math.PI / 2, span: d, out: w / 2 }];
    for (let f = 0; f < lot.floors && !open; f++) {
      for (const [fi, face] of faces.entries()) {
        if (fi === 0 && f === 0 && (lot.kind === 'shop' || lot.kind === 'tea-stop' || lot.kind === 'hotel')) continue;
        // Terraced bazaar shops share party walls: no side windows.
        if (fi > 1 && lot.kind === 'shop') continue;
        const count = Math.max(1, Math.floor((face.span - 1) / 2.6)), faceYaw = yaw + face.turn, fAt = frame(lot.x, lot.z, faceYaw);
        for (let k = 0; k < count; k++) {
          const u = (k - (count - 1) / 2) * (face.span - 1) / count, y = storeyBase(f) + 1.55;
          if (fi === 0 && f === 0 && k === count - 1 && count > 1) continue; // the front door stands here
          piece('solid', fAt(u, y, face.out + .03), [1.35, 1.45, .06], FRAME, faceYaw);
          piece('glass', fAt(u, y, face.out + .07), [1.1, 1.2, .06], WINDOW, faceYaw);
          piece('solid', fAt(u, y - .72, face.out + .12), [1.45, .1, .2], FRAME, faceYaw);
        }
      }
      // A door on the ground floor of a house.
      if (f === 0 && lot.kind !== 'resort-reception') piece('solid', at(w / 2 - 1.2, floor + 1.05, d / 2 + .05), [1, 2.1, .08], pickDoor(n), yaw);
    }
    if (lot.kind === 'shop' || lot.kind === 'tea-stop' || lot.kind === 'hotel' || lot.kind === 'resort-reception') {
      // Ground-floor front: shutters (shops), glass (hotels), an awning and a lit signboard.
      const accent = lot.accent ?? '#1f6f4a';
      if (lot.kind === 'hotel' || lot.kind === 'resort-reception') {
        piece('glass', at(0, floor + 1.4, d / 2 + .04), [w - 2, 2.6, .08], '#9cc3d5', yaw);
        piece('solid', at(0, floor + 1.2, d / 2 + .09), [1.8, 2.4, .06], DARK, yaw);
      } else {
        const bays = w > 8 ? 2 : 1;
        for (let b = 0; b < bays; b++) {
          const u = bays === 1 ? 0 : (b - .5) * (w / 2);
          const up = hash(n, b) < .75; // most shutters rolled up and open for trade
          piece(up ? 'glass' : 'solid', at(u, floor + 1.3, d / 2 + .04), [w / bays - .8, 2.6, .06], up ? '#e9d9a8' : '#c9ccd0', yaw);
          if (up) piece('solid', at(u, floor + 2.75, d / 2 + .08), [w / bays - .8, .35, .1], '#c9ccd0', yaw);
        }
      }
      piece('solid', at(0, floor + 2.95, d / 2 + .75), [w - .3, .12, 1.5], accent, yaw, .18);
      const signY = floor + 3.55;
      piece('solid', at(0, signY, d / 2 + .06), [w - .6, .95, .1], accent, yaw);
      if (lot.label) signs.push({ id: lot.id, label: lot.label, position: at(0, signY, d / 2 + .13), yaw, width: w - 1, height: .8, background: accent, ink: '#ffffff' });
      // Footpath along the shop front.
      piece('ground', at(0, ground.max + .04, d / 2 + 1.35), [w + .4, .1, 2.6], '#b8b2a5', yaw);
    }
    if (open) {
      // Bus shelter: steel posts, a sheet roof, a long bench and the stand's board.
      for (const u of [-w / 2 + .3, 0, w / 2 - .3]) for (const v of [-d / 2 + .2, d / 2 - .2]) piece('solid', at(u, floor + 1.4, v), [.14, 2.8, .14], '#5c6166', yaw);
      piece('solid', at(0, floor + .3, -d / 2 + .1), [w, .6, .1], '#d9d4c8', yaw);
      piece('solid', at(0, floor + .45, -.5), [w - 1, .1, .6], '#7a5a3c', yaw);
      piece('solid', at(0, floor + .22, -.5), [w - 1.2, .44, .1], '#5c6166', yaw);
      if (lot.label) signs.push({ id: lot.id, label: lot.label, position: at(0, floor + 3.45, d / 2 + .08), yaw, width: w - 1, height: .75, background: lot.accent ?? '#b3261e', ink: '#ffffff' });
      piece('solid', at(0, floor + 3.45, d / 2 + .02), [w - .6, .85, .08], lot.accent ?? '#b3261e', yaw);
    }
    // Roofs.
    const top = floor + H;
    if (lot.roof === 'flat') {
      for (const [u, v, sw, sd] of [[0, d / 2, w, .25], [0, -d / 2, w, .25], [w / 2, 0, .25, d], [-w / 2, 0, .25, d]] as const) piece('solid', at(u, top + .35, v), [sw, .7, sd], lot.wall, yaw);
      piece('solid', at(0, top + .04, 0), [w - .3, .08, d - .3], '#9d9a92', yaw);
      const tanks = 1 + Math.floor(hash(n, 7) * 2);
      for (let k = 0; k < tanks; k++) piece('solid', at(-w / 4 + k * 1.6, top + .75, -d / 4), [1.1, 1.3, 1.1], TANK, yaw);
    } else if (lot.roof === 'tile') {
      const pitch = .42, run = d / 2 + .5, rise = Math.tan(pitch) * run, color = ROOF_TILE[n & 1 ? 0 : (n >> 1) % 3];
      for (const side of [1, -1]) piece('solid', at(0, top + rise / 2 + .1, side * run / 2), [w + .8, .16, run / Math.cos(pitch)], color, yaw, side * pitch);
      piece('solid', at(0, top + rise + .12, 0), [w + .8, .2, .3], '#6b3322', yaw);
      // Gable ends closed in the wall colour.
      for (const u of [-w / 2, w / 2]) piece('solid', at(u, top + rise / 2 - .1, 0), [.12, rise, d * .7], lot.wall, yaw);
    } else {
      const pitch = .12, run = d + .8, rise = Math.tan(pitch) * run;
      piece('solid', at(0, top + rise / 2 + .1, 0), [w + .6, .1, run / Math.cos(pitch)], SHEET, yaw, pitch);
      piece('solid', at(0, top + rise / 2 - .05, -d / 2 + .05), [w, rise + .2, .1], lot.wall, yaw);
    }
  }

  // The KSRTC bus in its bay, the bay's asphalt and its white outline.
  {
    const bay = MALAKKAPPARA_BUS_BAY, at = frame(bay.x, bay.z, bay.yaw), y = terrainHeight(bay.x, bay.z);
    piece('ground', at(0, y + .03, 0), [bay.width, .06, bay.length], '#505453', bay.yaw);
    for (const u of [-bay.width / 2 + .15, bay.width / 2 - .15]) paint.push({ a: [at(u, 0, -bay.length / 2)[0], at(u, 0, -bay.length / 2)[2]], b: [at(u, 0, bay.length / 2)[0], at(u, 0, bay.length / 2)[2]], width: .14, color: '#f1efe6' });
    const bus = frame(bay.x + .6, bay.z, bay.yaw), L = 11, W = 2.5, lift = y + .45;
    const busPiece = (u: number, h: number, v: number, size: V3, color: string, material: CityMaterial = 'solid') => piece(material, bus(u, lift + h, v), size, color, bay.yaw);
    busPiece(0, .7, 0, [W, 1.4, L], '#b3261e');
    busPiece(0, 1.49, 0, [W + .02, .18, L + .02], '#f2c230');
    busPiece(0, 2.1, 0, [W, 1.1, L], '#efe3c2');
    busPiece(0, 2.72, 0, [W - .1, .16, L - .2], '#d8cfb4');
    for (const u of [-W / 2 - .01, W / 2 + .01]) busPiece(u, 2.1, -.3, [.04, .8, L - 1.8], '#2b3a44', 'glass');
    busPiece(0, 2.05, L / 2 + .01, [W - .3, 1.1, .04], '#2b3a44', 'glass');
    for (const v of [-3.6, 3.4]) for (const u of [-W / 2 + .2, W / 2 - .2]) busPiece(u, 0, v, [.4, .9, .9], '#1b1b1b');
    collide('mk-ksrtc-bus', bus(0, lift + 1.4, 0), [W, 2.9, L], bay.yaw);
    signs.push({ id: 'mk-bus-route', label: 'CHALAKKUDY', position: bus(0, lift + 2.78, L / 2 + .04), yaw: bay.yaw, width: 1.9, height: .3, background: '#111111', ink: '#ffb02e' });
    for (const side of [-1, 1]) signs.push({ id: `mk-bus-ksrtc-${side}`, label: 'KSRTC · കെ.എസ്.ആർ.ടി.സി', position: bus(side * (W / 2 + .03), lift + .95, 0), yaw: bay.yaw + side * Math.PI / 2, width: 4, height: .45, background: '#b3261e', ink: '#ffffff' });
  }

  // Dry-stone walls where the pad stands above lower ground, clear of the roads that cross its edge.
  const padY = V2_LAYOUT.towns.find(t => t.id === 'malakkappara')!.center[1];
  const roads = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'));
  const nearRoad = (x: number, z: number) => roads.some(r => r.points.some((p, i) => {
    const q = r.points[i + 1]; if (!q) return false;
    const dx = q[0] - p[0], dz = q[2] - p[2], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[2]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - p[0] - dx * t, z - p[2] - dz * t) < r.widthM / 2 + 4;
  }));
  const T = MALAKKAPPARA_FILL_BLEND_M;
  for (const edge of MALAKKAPPARA_WALL_EDGES) {
    const [ax, az] = edge.a, [bx, bz] = edge.b, length = Math.hypot(bx - ax, bz - az), count = Math.round(length / 2);
    const yaw = Math.atan2(edge.out[0], edge.out[1]);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count, ex = ax + (bx - ax) * t, ez = az + (bz - az) * t;
      const cx = ex + edge.out[0] * T / 2, cz = ez + edge.out[1] * T / 2;
      const foot = Math.min(terrainHeight(ex + edge.out[0] * (T + .6), ez + edge.out[1] * (T + .6)), terrainHeight(cx, cz));
      if (padY - foot < 1.2 || nearRoad(cx, cz)) continue;
      const bottom = foot - .4, h = padY - bottom, block: V3 = [cx, bottom + h / 2, cz], size: V3 = [length / count + .02, h, T];
      const shade = .88 + hash(i, edge.id.length) * .24, c = Math.round(0x8f * shade), color = `rgb(${c},${Math.round(c * .95)},${Math.round(c * .86)})`;
      piece('solid', block, size, color, yaw); collide(`mk-wall-${edge.id}-${i}`, block, size, yaw);
      // Dry-stone coursing: a darker joint every 0.8 m up the outer face, staggered block to block.
      for (let y = bottom + .5 + (i % 2) * .4; y < padY - .3; y += .8) piece('solid', [cx + edge.out[0] * (T / 2 + .02), y, cz + edge.out[1] * (T / 2 + .02)], [size[0] + .01, .09, .06], '#6e685c', yaw);
      // Top course flush with the pad, and a low parapet along the outer face.
      piece('ground', [cx, padY - .02, cz], [size[0], .06, T], '#9a9385', yaw);
      const parapet: V3 = [ex + edge.out[0] * (T - .25), padY + .4, ez + edge.out[1] * (T - .25)];
      piece('solid', parapet, [size[0], .8, .5], '#a39c8e', yaw); collide(`mk-parapet-${edge.id}-${i}`, parapet, [size[0], .8, .5], yaw);
    }
  }

  // Malakkappara Botanical Garden: hedged beds, gravel walks, a glasshouse and a fountain.
  {
    const g = MALAKKAPPARA_GARDEN, cx = (g.xMin + g.xMax) / 2, cz = (g.zMin + g.zMax) / 2;
    const w = g.xMax - g.xMin, dz = g.zMax - g.zMin, y = terrainHeight(cx, cz);
    // Lawn, then the two gravel walks that cross it.
    piece('ground', [cx, y + .02, cz], [w, .06, dz], '#6f8f4a');
    piece('ground', [cx, y + .05, cz], [w - 2, .06, 3], '#c9bb9a');
    piece('ground', [cx, y + .05, cz], [3, .06, dz - 2], '#c9bb9a');
    // Clipped boundary hedge, open where the gate stands on the road side.
    const hedge = (x: number, z: number, sx: number, sz: number) => piece('solid', [x, y + .6, z], [sx, 1.2, sz], '#3f6b32');
    for (const side of [-1, 1]) hedge(cx + side * (w / 2 - .4), cz, .8, dz);
    hedge(cx, g.zMax - .4, w, .8);
    for (const dir of [-1, 1]) {
      const span = (w - 6) / 2;
      hedge(g.gateX + dir * (3 + span / 2), g.zMin + .4, span, .8);
    }
    // Gate: two piers, a lintel and the garden's board, facing the road.
    for (const side of [-1, 1]) {
      const pier: V3 = [g.gateX + side * 2.6, y + 1.8, g.zMin + .4];
      piece('solid', pier, [1.1, 3.6, 1.1], '#e8e1cf'); collide(`mk-garden-pier-${side}`, pier, [.9, 3.2, .9]);
    }
    piece('solid', [g.gateX, y + 3.9, g.zMin + .4], [6.6, 1, .8], '#1f6f4a');
    signs.push({ id: 'mk-garden-sign', label: g.label, position: [g.gateX, y + 3.9, g.zMin - .05], yaw: Math.PI, width: 6.2, height: .8, background: '#1f6f4a', ink: '#ffffff' });
    // Six flower beds, two to a quarter of the garden; the glasshouse takes the fourth quarter.
    const BLOOMS = ['#e4572e', '#f2c230', '#e98aa8', '#9b5de5', '#f1efe6', '#ef6f1f'] as const;
    const quarters = [[1, -1], [1, 1], [-1, -1]] as const;
    quarters.forEach(([qx, qz], q) => {
      const qcx = cx + qx * 11, qcz = cz + qz * 7.5;
      for (const half of [-1, 1]) {
        const bx = qcx, bz = qcz + half * 3.2, bed = q * 2 + (half > 0 ? 1 : 0);
        piece('ground', [bx, y + .09, bz], [7.5, .12, 2], '#5a4632');
        for (let k = 0; k < 9; k++) for (const row of [-.5, .5]) {
          const fx = bx - 3.2 + k * .8, fz = bz + row, lift = hash(bed, k) * .12;
          piece('solid', [fx, y + .35 + lift, fz], [.42, .42, .42], BLOOMS[(bed + (row > 0 ? 1 : 0)) % BLOOMS.length]);
          piece('solid', [fx, y + .2, fz], [.12, .3, .12], '#3f6b32');
        }
      }
    });
    // Glasshouse in the remaining quarter, and a round fountain where the walks cross.
    const gh: V3 = [cx - 11, y + 1.7, cz + 7.5];
    piece('glass', gh, [11, 3.4, 8], '#cfe7ef'); collide('mk-garden-glasshouse', gh, [11, 3.4, 8]);
    for (const side of [1, -1]) piece('glass', [gh[0], y + 4.1, gh[2] + side * 2], [11, .15, 4.2 / Math.cos(.5)], '#dff0f5', 0, side * .5);
    piece('solid', [gh[0], y + 4.9, gh[2]], [11.2, .2, .3], '#e8e1cf');
    for (let ring = 0; ring < 12; ring++) {
      const a = ring / 12 * Math.PI * 2;
      piece('solid', [cx + Math.cos(a) * 2.2, y + .35, cz + Math.sin(a) * 2.2], [1.25, .7, 1.25], '#c9c2b2', a);
    }
    piece('ground', [cx, y + .3, cz], [3.4, .5, 3.4], '#7fc3e8');
    piece('solid', [cx, y + 1.1, cz], [.5, 1.6, .5], '#c9c2b2');
    piece('solid', [cx, y + 2, cz], [1.6, .3, 1.6], '#c9c2b2');
    // Clipped ornamental trees along the walks.
    for (const [tx, tz] of [[cx - 6, cz + 6], [cx + 6, cz + 6], [cx - 6, cz - 6], [cx + 6, cz - 6], [cx + 13, cz], [cx - 13, cz]] as const) {
      piece('solid', [tx, y + .8, tz], [.3, 1.6, .3], '#6b4a2f');
      piece('solid', [tx, y + 2, tz], [2.2, 1.6, 2.2], '#3f6b32');
      piece('solid', [tx, y + 3, tz], [1.4, 1, 1.4], '#4d8040');
    }
    // Benches along the walks.
    for (const [bx, bz, yaw] of [[cx - 6, cz + 2.4, 0], [cx + 6, cz + 2.4, 0], [cx - 6, cz - 2.4, Math.PI], [cx + 6, cz - 2.4, Math.PI]] as const) {
      piece('solid', [bx, y + .45, bz], [2.2, .12, .55], '#7a5a3c', yaw);
      piece('solid', [bx, y + .25, bz], [2, .4, .12], '#5c6166', yaw);
      piece('solid', [bx, y + .8, bz - Math.cos(yaw) * .25], [2.2, .55, .1], '#7a5a3c', yaw);
    }
  }

  // Welcome arch over the main road at the pad's south edge.
  {
    const z = -627.5, x = -552.1, y = padY, span = 5.5 / 2 + 1.4;
    for (const side of [-1, 1]) {
      const post: V3 = [x + side * span, y + 3.1, z];
      piece('solid', post, [.8, 6.2, .8], '#e8e1cf'); collide(`mk-arch-post-${side}`, post, [.8, 6.2, .8]);
      piece('solid', [x + side * span, y + .3, z], [1.1, .6, 1.1], '#b3261e');
    }
    piece('solid', [x, y + 6.5, z], [span * 2 + 1.6, 1.3, .7], '#b3261e');
    piece('solid', [x, y + 7.35, z], [span * 2 + .6, .4, .5], '#f2c230');
    for (const [dir, yaw] of [[1, 0], [-1, Math.PI]] as const) signs.push({ id: `mk-arch-${dir}`, label: 'Welcome to Malakkappara · മലക്കപ്പാറ', position: [x, y + 6.5, z + dir * .37], yaw, width: span * 2 + .8, height: 1, background: '#b3261e', ink: '#fff6d8' });
  }

  // Street lamps along the bazaar footpaths: a pole, an arm over the kerb and a warm lamp.
  const lamp = (id: string, x: number, z: number, towardRoad: readonly [number, number]) => {
    const y = terrainHeight(x, z), pole: V3 = [x, y + 3, z];
    piece('solid', pole, [.14, 6, .14], '#4a4f55'); collide(id, pole, [.3, 6, .3]);
    piece('solid', [x + towardRoad[0] * .7, y + 5.9, z + towardRoad[1] * .7], [.1 + Math.abs(towardRoad[0]) * 1.3, .1, .1 + Math.abs(towardRoad[1]) * 1.3], '#4a4f55');
    piece('glow', [x + towardRoad[0] * 1.3, y + 5.8, z + towardRoad[1] * 1.3], [.45, .14, .45], '#fff4d6');
  };
  for (const z of [-636, -654]) { lamp(`mk-lamp-mw-${z}`, -557.9 + (z + 625) * -3 / 55, z, [1, 0]); lamp(`mk-lamp-me-${z}`, -546.6 + (z + 625) * -3 / 55, z, [-1, 0]); }
  for (const x of [-531, -513]) { lamp(`mk-lamp-dn-${x}`, x, -699.8, [0, 1]); lamp(`mk-lamp-ds-${x}`, x, -689.2, [0, -1]); }
  for (const x of [-570, -588]) { lamp(`mk-lamp-kn-${x}`, x, -672.5, [0, 1]); lamp(`mk-lamp-ks-${x}`, x, -663.5, [0, -1]); }

  return { pieces, boxes, signs, paint };
}

function pickDoor(n: number) { return ['#6b3f22', '#2f5d8a', '#3f6b3a', '#8a2f2f'][Math.abs(n) % 4]; }

/** Malakkappara's buildings, bus stand and walls as city-kit pieces, colliders, signs and paint. */
export const MALAKKAPPARA_TOWN = createTown();
/** Colliders shared with the multiplayer simulation. */
export function malakkapparaTownBoxes(): TraversalBox[] { return MALAKKAPPARA_TOWN.boxes; }
export { lotCorners };
