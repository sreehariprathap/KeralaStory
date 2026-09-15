import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { InputMode } from '../../contracts';
import { clearInput, createInputState, GAME_KEYS, pressKey } from './inputState';

export function useExplorerInput(mode: InputMode, onPause: () => void, onMap: () => void) {
  const canvas = useThree(state => state.gl.domElement);
  const input = useRef(createInputState());
  const latest = useRef({ mode, onPause, onMap });
  latest.current = { mode, onPause, onMap };

  useEffect(() => {
    clearInput(input.current);
    if (mode !== 'playing' && document.pointerLockElement === canvas) document.exitPointerLock();
    if (mode === 'playing') {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    }
  }, [mode, canvas]);

  useEffect(() => {
    let wasLocked = document.pointerLockElement === canvas;
    const active = () => latest.current.mode === 'playing';
    const pause = () => { clearInput(input.current); if (active()) latest.current.onPause(); };
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName));
    const keydown = (event: KeyboardEvent) => {
      if (!active() || editable(event.target)) return;
      if (event.code === 'Escape' || event.code === 'KeyM') {
        event.preventDefault();
        if (!event.repeat) {
          clearInput(input.current);
          if (event.code === 'KeyM') latest.current.onMap(); else latest.current.onPause();
        }
      } else if (GAME_KEYS.has(event.code)) {
        event.preventDefault();
        pressKey(input.current, event.code, event.repeat);
      }
    };
    const keyup = (event: KeyboardEvent) => { input.current.keys.delete(event.code); };
    const down = (event: PointerEvent) => {
      if (!active() || event.button !== 0) return;
      input.current.dragging = true;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const up = () => { input.current.dragging = false; };
    const move = (event: PointerEvent) => {
      if (!active() || (!input.current.dragging && document.pointerLockElement !== canvas)) return;
      input.current.lookX += event.movementX;
      input.current.lookY += event.movementY;
    };
    const lockChange = () => {
      const locked = document.pointerLockElement === canvas;
      if (wasLocked && !locked) pause();
      wasLocked = locked;
    };
    const lockError = () => {
      // Drag and Q/E remain available when lock is denied or unsupported.
      canvas.dataset.pointerLock = 'unavailable';
      clearInput(input.current);
    };
    const lock = () => {
      if (!active() || !canvas.requestPointerLock) return;
      try {
        const result = canvas.requestPointerLock();
        if (result && typeof result.catch === 'function') void result.catch(lockError);
      } catch { lockError(); }
    };
    const visibility = () => { if (document.hidden) pause(); };
    const cancel = () => pause();
    const lostCapture = () => { if (input.current.dragging) pause(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('pointerlockerror', lockError);
    document.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', lostCapture);
    canvas.addEventListener('dblclick', lock);
    return () => {
      clearInput(input.current);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('pointerlockerror', lockError);
      document.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      canvas.removeEventListener('dblclick', lock);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [canvas]);
  return input;
}
