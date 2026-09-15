export const NITRO_DURATION_S = 1.5;
export const NITRO_COOLDOWN_S = 3;
export const NITRO_MULTIPLIER = 1.65;

export interface NitroState {
  active: boolean;
  remaining: number;
  cooldown: number;
  multiplier: number;
}

export function createNitroState(): NitroState {
  return { active: false, remaining: NITRO_DURATION_S, cooldown: 0, multiplier: 1 };
}

export function stepNitro(state: NitroState, held: boolean, dt: number): NitroState {
  const delta = Math.max(0, Math.min(dt, 10));
  const previousCooldown = state.cooldown;
  state.cooldown = Math.max(0, state.cooldown - delta);
  if (previousCooldown > 0 && state.cooldown === 0 && state.remaining === 0) state.remaining = NITRO_DURATION_S;
  if (state.active) {
    if (!held) state.active = false;
    else {
      state.remaining = Math.max(0, state.remaining - delta);
      if (state.remaining === 0) {
        state.active = false;
        state.cooldown = NITRO_COOLDOWN_S;
      }
    }
  } else if (held && state.cooldown === 0 && state.remaining > 0) {
    state.active = true;
  }
  state.multiplier = state.active ? NITRO_MULTIPLIER : 1;
  return state;
}
