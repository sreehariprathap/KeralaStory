import { useEffect, useRef, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { CameraControl, InputMode, InputCommands } from '../../contracts';
import { clearInput, createInputState, GAME_KEYS, pressKey, createInputCommands, keyboardAxes } from './inputState';

export function useExplorerInput(mode: InputMode, onPause: () => void, onMap: () => void, onCommands?: (commands:InputCommands|null)=>void, cameraControl: CameraControl = 'auto') {
  const canvas = useThree(state => state.gl.domElement);
  const input = useRef(createInputState());
  const latest = useRef({ mode, onPause, onMap, cameraControl });
  latest.current = { mode, onPause, onMap, cameraControl };

  const commands=useMemo(()=>createInputCommands(input.current,()=>latest.current.mode==='playing'),[]);
  useEffect(()=>{onCommands?.(commands);return()=>onCommands?.(null);},[commands,onCommands]);

  useEffect(() => {
    clearInput(input.current);
    if ((mode !== 'playing' || cameraControl !== 'mouse') && document.pointerLockElement === canvas) document.exitPointerLock();
    if (mode === 'playing') {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    }
  }, [mode, cameraControl, canvas]);

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
    // Pointer lock requires a user gesture; clicking the scene while in mouse-look mode requests it.
    const click = () => { if (active() && latest.current.cameraControl === 'mouse' && document.pointerLockElement !== canvas) canvas.requestPointerLock().catch(() => {}); };
    const mousemove = (event: MouseEvent) => {
      if (!active() || latest.current.cameraControl !== 'mouse' || document.pointerLockElement !== canvas) return;
      commands.addLook('mouse', event.movementX, event.movementY);
    };
    // Browsers reserve Escape to release pointer lock and consume the keystroke before our keydown
    // handler sees it, so releasing the lock unexpectedly (not via our own mode change) also pauses.
    const pointerLockLost = () => { if (document.pointerLockElement !== canvas && latest.current.cameraControl === 'mouse') pause(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', pause);
    window.addEventListener('orientationchange',pause);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerlockchange', pointerLockLost);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('click', click);
    canvas.addEventListener('mousemove', mousemove);
    return () => {
      clearInput(input.current);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', pause);
      window.removeEventListener('orientationchange',pause);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', pointerLockLost);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('mousemove', mousemove);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [canvas,commands]);
  return input;
}
