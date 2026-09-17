/** Greedy map-label placement: higher priority labels claim space first; labels that fit nowhere are hidden. */
export interface LabelRequest {
  id: string;
  text: string;
  /** Anchor (the pin centre) in map units. */
  x: number; y: number;
  fontSize: number;
  /** Clearance around the anchor (pin radius). */
  offset: number;
  priority: number;
  /** Only try centred-on-anchor placement (area and city names). */
  centered?: boolean;
}
export interface PlacedLabel { id: string; text: string; x: number; y: number; fontSize: number; anchor: 'start' | 'middle' | 'end' }
export interface Box { x0: number; y0: number; x1: number; y1: number; /** The label this box belongs to (its own pin never blocks it). */ owner?: string; /** Pins only block pin labels; centred place names may sit over them. */ pin?: boolean }

/** Rough text width for the map's sans-serif at a given size. */
export const textWidth = (text: string, fontSize: number) => text.length * fontSize * .56;

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** `obstacles` are boxes labels must avoid (pins, tagged with their label id). Returns the labels that fit, in placement order. */
export function layoutLabels(requests: readonly LabelRequest[], obstacles: readonly Box[] = []): PlacedLabel[] {
  const taken: Box[] = [...obstacles], placed: PlacedLabel[] = [];
  for (const r of [...requests].sort((a, b) => b.priority - a.priority)) {
    const w = textWidth(r.text, r.fontSize), h = r.fontSize * 1.15, gap = r.offset + r.fontSize * .35;
    const options: { box: Box; x: number; y: number; anchor: PlacedLabel['anchor'] }[] = r.centered
      ? [{ box: { x0: r.x - w / 2, y0: r.y - h / 2, x1: r.x + w / 2, y1: r.y + h / 2 }, x: r.x, y: r.y + r.fontSize * .35, anchor: 'middle' }]
      : [
        { box: { x0: r.x + gap, y0: r.y - h / 2, x1: r.x + gap + w, y1: r.y + h / 2 }, x: r.x + gap, y: r.y + r.fontSize * .35, anchor: 'start' },
        { box: { x0: r.x - gap - w, y0: r.y - h / 2, x1: r.x - gap, y1: r.y + h / 2 }, x: r.x - gap, y: r.y + r.fontSize * .35, anchor: 'end' },
        { box: { x0: r.x - w / 2, y0: r.y - gap - h, x1: r.x + w / 2, y1: r.y - gap }, x: r.x, y: r.y - gap - h * .2, anchor: 'middle' },
        { box: { x0: r.x - w / 2, y0: r.y + gap, x1: r.x + w / 2, y1: r.y + gap + h }, x: r.x, y: r.y + gap + h * .8, anchor: 'middle' },
      ];
    const choice = options.find(o => !taken.some(t => overlaps(o.box, t) && t.owner !== r.id && !(r.centered && t.pin)));
    if (!choice) continue;
    taken.push(choice.box);
    placed.push({ id: r.id, text: r.text, x: choice.x, y: choice.y, fontSize: r.fontSize, anchor: choice.anchor });
  }
  return placed;
}
