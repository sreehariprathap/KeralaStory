import { useEffect, useRef, useState } from 'react';
import { firstEnabled, stepIndex } from './menuNavigation';

interface MenuNavigationOptions {
  count: number;
  disabled?: readonly boolean[];
  onActivate: (index: number) => void;
  onBack?: () => void;
  onTab?: (delta: 1 | -1) => void;
  /** False while a text field or dialog owns the keyboard. */
  enabled?: boolean;
}

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;
// Standard gamepad mapping: 0 A, 1 B, 12 up, 13 down, 14 left, 15 right.
const PAD = { a: 0, b: 1, up: 12, down: 13, left: 14, right: 15 } as const;

export function useMenuNavigation({ count, disabled, onActivate, onBack, onTab, enabled = true }: MenuNavigationOptions) {
  const flags = disabled ?? Array.from({ length: count }, () => false);
  const [index, setIndex] = useState(() => firstEnabled(flags));
  const latest = useRef({ flags, index, onActivate, onBack, onTab });
  latest.current = { flags, index, onActivate, onBack, onTab };

  useEffect(() => {
    if (!enabled) return;
    const move = (delta: 1 | -1) => setIndex(current => stepIndex(latest.current.flags, current, delta));
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (TYPING.test(target.tagName) || target.isContentEditable);
      if (event.code === 'Escape') { if (latest.current.onBack) { event.preventDefault(); latest.current.onBack(); } return; }
      if (typing) return;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') { event.preventDefault(); move(1); }
      else if (event.code === 'ArrowUp' || event.code === 'KeyW') { event.preventDefault(); move(-1); }
      else if (latest.current.onTab && (event.code === 'ArrowRight' || event.code === 'KeyD')) { event.preventDefault(); latest.current.onTab(1); }
      else if (latest.current.onTab && (event.code === 'ArrowLeft' || event.code === 'KeyA')) { event.preventDefault(); latest.current.onTab(-1); }
      else if (event.code === 'Enter' || event.code === 'Space') {
        if (latest.current.flags[latest.current.index]) return;
        event.preventDefault(); latest.current.onActivate(latest.current.index);
      }
    };
    window.addEventListener('keydown', keydown);

    // Gamepads have no events for buttons, so poll once per frame and act on press edges only.
    let frame = 0; let previous: boolean[] = [];
    const poll = () => {
      const pad = navigator.getGamepads?.().find(Boolean);
      if (pad) {
        const pressed = pad.buttons.map(button => button.pressed);
        const edge = (button: number) => pressed[button] && !previous[button];
        if (edge(PAD.down)) move(1);
        if (edge(PAD.up)) move(-1);
        if (edge(PAD.right)) latest.current.onTab?.(1);
        if (edge(PAD.left)) latest.current.onTab?.(-1);
        if (edge(PAD.a) && !latest.current.flags[latest.current.index]) latest.current.onActivate(latest.current.index);
        if (edge(PAD.b)) latest.current.onBack?.();
        previous = pressed;
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => { window.removeEventListener('keydown', keydown); cancelAnimationFrame(frame); };
  }, [enabled]);

  // Keep the selection valid when the list or its disabled flags change.
  useEffect(() => {
    setIndex(current => (current >= count || flags[current] ? firstEnabled(flags) : current));
  }, [count, flags.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { index, setIndex };
}
