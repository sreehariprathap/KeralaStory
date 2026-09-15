import type { GameSettings, InputMode } from '../../contracts';
export const DEFAULT_BGM_PATH = '/assets/bgm.mp3';
export function audioLevel(settings:Pick<GameSettings,'muted'|'volume'>,mode:InputMode,visible:boolean){return !visible||mode!=='playing'||settings.muted?0:Math.max(0,Math.min(1,settings.volume))*.18;}
