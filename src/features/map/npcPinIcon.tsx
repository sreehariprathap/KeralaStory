import type { NpcId } from '../../game/npc/npcDefinitions';

function makeFaceIcon(hornColor: string) {
  return function FaceIcon({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string; weight?: string }) {
    const cx = x + width / 2, cy = y + height / 2, r = width / 2;
    return (
      <g>
        <path d={`M ${cx - r * 0.7} ${cy - r * 0.55} L ${cx - r * 0.25} ${cy - r} L ${cx - r * 0.1} ${cy - r * 0.4} Z`} fill={hornColor}/>
        <path d={`M ${cx + r * 0.7} ${cy - r * 0.55} L ${cx + r * 0.25} ${cy - r} L ${cx + r * 0.1} ${cy - r * 0.4} Z`} fill={hornColor}/>
        <circle cx={cx} cy={cy} r={r * 0.55} fill={color}/>
      </g>
    );
  };
}

const ICONS = { luttappi: makeFaceIcon('#2b2117'), mayavi: makeFaceIcon('#1c1a17') };

export function npcPinIcon(id: NpcId) { return ICONS[id]; }
