import { useEffect, useRef, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { InputMode, InputCommands } from '../../contracts';
import { clearInput, createInputState, GAME_KEYS, pressKey, createInputCommands, keyboardAxes } from './inputState';

export function useExplorerInput(mode: InputMode, onPause: () => void, onMap: () => void, onCommands?: (commands:InputCommands|null)=>void) {
  const canvas = useThree(state => state.gl.domElement);
  const input = useRef(createInputState());
  const latest = useRef({ mode, onPause, onMap });
  latest.current = { mode, onPause, onMap };

  const commands=useMemo(()=>createInputCommands(input.current,()=>latest.current.mode==='playing'),[]);
  useEffect(()=>{onCommands?.(commands);return()=>onCommands?.(null);},[commands,onCommands]);

  useEffect(() => {
    clearInput(input.current);
    if (mode !== 'playing' && document.pointerLockElement === canvas) document.exitPointerLock();
    if (mode === 'playing') {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    }
  }, [mode, canvas]);

  useEffect(() => {
    const active = () => latest.current.mode === 'playing';
    const pause = () => { clearInput(input.current); if (active()) latest.current.onPause(); };
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const keydown = (event: KeyboardEvent) => {
      if (!active() || editable(event.target)) return;
      if(event.target instanceof HTMLButtonElement && (event.code==='Space'||event.code==='Enter'))return;
      if (event.code === 'Escape' || event.code === 'KeyM') {
        event.preventDefault();
        if (!event.repeat) {
          clearInput(input.current);
          if (event.code === 'KeyM') latest.current.onMap(); else latest.current.onPause();
        }
      } else if (GAME_KEYS.has(event.code)) {
        event.preventDefault();
        pressKey(input.current, event.code, event.repeat);
        if (/^(Key[WASD]|Arrow)/.test(event.code)) {const a=keyboardAxes(input.current.keys);commands.setMove('keyboard',a.x,a.forward);}
      }
    };
    const keyup = (event: KeyboardEvent) => { input.current.keys.delete(event.code); if (/^(Key[WASD]|Arrow)/.test(event.code)) {const a=keyboardAxes(input.current.keys);commands.setMove('keyboard',a.x,a.forward);} };
    const visibility = () => { if (document.hidden) pause(); };
    const cancel = () => pause();
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', pause);
    window.addEventListener('orientationchange',pause);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('pointercancel', cancel);
    return () => {
      clearInput(input.current);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', pause);
      window.removeEventListener('orientationchange',pause);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointercancel', cancel);
    };
  }, [canvas,commands]);
  return input;
}
