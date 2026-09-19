import type { TraversalBox } from '../../game/world/traversalGeometry';
import type { CityMaterial, CityPaint, CityPiece, CitySign } from './chalakkudyCity';
import { EXPANSION_LAYOUT, V2_LAYOUT, V2_ROUTES, terrainHeight } from './definition';
import { MALAKKAPPARA_BUS_BAY, MALAKKAPPARA_FILL_BLEND_M, MALAKKAPPARA_LOTS, MALAKKAPPARA_WALL_EDGES, lotCorners, type TownLot } from './malakkapparaPlan';
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

  for (const lot of MALAKKAPPARA_LOTS) {
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
    // Windows on every upper storey (and the ground floor of homes), with white frames and a sill.
    const windows = Math.max(1, Math.floor((w - 1) / 2.6));
    for (let f = 0; f < lot.floors && !open; f++) {
      const shopFront = f === 0 && (lot.kind === 'shop' || lot.kind === 'tea-stop' || lot.kind === 'hotel');
      if (shopFront) continue;
      for (let k = 0; k < windows; k++) {
        const u = (k - (windows - 1) / 2) * (w - 1) / windows, y = storeyBase(f) + 1.55;
        piece('solid', at(u, y, d / 2 + .03), [1.35, 1.45, .06], FRAME, yaw);
        piece('glass', at(u, y, d / 2 + .07), [1.1, 1.2, .06], WINDOW, yaw);
        piece('solid', at(u, y - .72, d / 2 + .12), [1.45, .1, .2], FRAME, yaw);
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
      // Top course flush with the pad, and a low parapet along the outer face.
      piece('ground', [cx, padY - .02, cz], [size[0], .06, T], '#9a9385', yaw);
      const parapet: V3 = [ex + edge.out[0] * (T - .25), padY + .4, ez + edge.out[1] * (T - .25)];
      piece('solid', parapet, [size[0], .8, .5], '#a39c8e', yaw); collide(`mk-parapet-${edge.id}-${i}`, parapet, [size[0], .8, .5], yaw);
    }
  }

  return { pieces, boxes, signs, paint };
}

function pickDoor(n: number) { return ['#6b3f22', '#2f5d8a', '#3f6b3a', '#8a2f2f'][Math.abs(n) % 4]; }

/** Malakkappara's buildings, bus stand and walls as city-kit pieces, colliders, signs and paint. */
export const MALAKKAPPARA_TOWN = createTown();
/** Colliders shared with the multiplayer simulation. */
export function malakkapparaTownBoxes(): TraversalBox[] { return MALAKKAPPARA_TOWN.boxes; }
export { lotCorners };
