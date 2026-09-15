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
    let wasLocked = document.pointerLockElement === canvas;
    const active = () => latest.current.mode === 'playing';
    const pause = () => { lookPointer=null; clearInput(input.current); if (active()) latest.current.onPause(); };
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
    let lookPointer:number|null=null;
    let lastX=0,lastY=0;
    const down = (event: PointerEvent) => {
      if (!active() || event.button !== 0 || event.pointerType==='touch' || lookPointer!==null) return;
      lookPointer=event.pointerId;lastX=event.clientX;lastY=event.clientY;
      input.current.dragging = true;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const up = (event:PointerEvent) => { if(event.pointerId===lookPointer){input.current.dragging=false;lookPointer=null;} };
    const move = (event: PointerEvent) => {
      if (!active() || (!input.current.dragging && document.pointerLockElement !== canvas)) return;
      if(document.pointerLockElement===canvas)commands.addLook('keyboard',event.movementX,event.movementY);
      else if(event.pointerId===lookPointer){commands.addLook('keyboard',event.clientX-lastX,event.clientY-lastY);lastX=event.clientX;lastY=event.clientY;}
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
    window.addEventListener('orientationchange',pause);
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
      window.removeEventListener('orientationchange',pause);
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
  }, [canvas,commands]);
  return input;
}
