import type { Vec3 } from '../../contracts';
import { LANDMARKS, terrainHeight, isWater, hasGroundAt, WORLD_BOUNDS } from '../../content/world/definition';
import type { NpcDefinition, NpcId } from './npcDefinitions';

export interface NpcRuntimeState {
  id: NpcId;
  position: Vec3;
  targetPosition: Vec3;
  nextEffectAt: number;
}

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

/** A walkable point within `radius` of an anchor, falling back to the anchor itself. */
function sampleNear(anchor: Vec3, radius: number, rng: () => number): Vec3 {
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = rng() * Math.PI * 2, dist = rng() * radius;
    const x = clamp(anchor[0] + Math.cos(angle) * dist, WORLD_BOUNDS.xMin, WORLD_BOUNDS.xMax);
    const z = clamp(anchor[2] + Math.sin(angle) * dist, WORLD_BOUNDS.zMin, WORLD_BOUNDS.zMax);
    if (isWater(x, z) || !hasGroundAt(x, z)) continue;
    return [x, terrainHeight(x, z), z];
  }
  return anchor;
}

function pickAnchor(def: NpcDefinition, rng: () => number): Vec3 {
  const candidates = LANDMARKS.filter(l => def.zoneIds.includes(l.zoneId));
  const pool = candidates.length ? candidates : LANDMARKS;
  const chosen = pool[Math.floor(rng() * pool.length) % pool.length];
  return chosen.position;
}

export function createNpcState(def: NpcDefinition, now: number, rngSeed: number): NpcRuntimeState {
  const rng = seededRng(rngSeed);
  const start = sampleNear(pickAnchor(def, rng), 20, rng);
  return { id: def.id, position: start, targetPosition: sampleNear(pickAnchor(def, rng), 30, rng), nextEffectAt: now + def.effectIntervalMs };
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const WALK_SPEED_MPS = 1.2;
const ARRIVE_M = 1.5;

export function tickNpcWander(state: NpcRuntimeState, def: NpcDefinition, dtMs: number, rng: () => number): NpcRuntimeState {
  const [px, , pz] = state.position, [tx, , tz] = state.targetPosition;
  const dx = tx - px, dz = tz - pz, dist = Math.hypot(dx, dz);
  if (dist <= ARRIVE_M) {
    return { ...state, targetPosition: sampleNear(pickAnchor(def, rng), 30, rng) };
  }
  const step = Math.min(dist, WALK_SPEED_MPS * (dtMs / 1000));
  const nx = px + (dx / dist) * step, nz = pz + (dz / dist) * step;
  return { ...state, position: [nx, terrainHeight(nx, nz), nz] };
}

export function isPlayerInRange(state: NpcRuntimeState, def: NpcDefinition, playerPos: Vec3): boolean {
  const distance = Math.hypot(state.position[0] - playerPos[0], state.position[2] - playerPos[2]);
  return distance <= def.proximityRadiusM;
}

export function rollCoinEffect(state: NpcRuntimeState, def: NpcDefinition, now: number, rng: () => number): { state: NpcRuntimeState; coinsDelta: number } | null {
  if (now < state.nextEffectAt) return null;
  const next = { ...state, nextEffectAt: now + def.effectIntervalMs };
  if (rng() > def.effectChance) return { state: next, coinsDelta: 0 };
  const span = def.maxCoinDelta - def.minCoinDelta;
  const magnitude = def.minCoinDelta + Math.round(rng() * span);
  return { state: next, coinsDelta: magnitude };
}

export function scareAway(state: NpcRuntimeState, def: NpcDefinition, mayaviPos: Vec3, rng: () => number): NpcRuntimeState {
  const dx = state.position[0] - mayaviPos[0], dz = state.position[2] - mayaviPos[2];
  const away = Math.hypot(dx, dz) > 0 ? [dx, dz] : [1, 0];
  const len = Math.hypot(away[0], away[1]);
  const fleeDistance = def.scareRadiusM * 2;
  const anchor: Vec3 = [state.position[0] + (away[0] / len) * fleeDistance, state.position[1], state.position[2] + (away[1] / len) * fleeDistance];
  return { ...state, targetPosition: sampleNear(anchor, def.scareRadiusM, rng) };
}
