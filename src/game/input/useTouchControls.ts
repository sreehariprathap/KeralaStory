import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';
import type { InputCommands } from '../../contracts';
import { createTouchRouter, type TouchRole } from './touchRouter';
/** DOM pointer adapter; controls supply visuals, this owns capture and cancellation. */
export function useTouchControls(commands:InputCommands,enabled:boolean) {
  const router=useMemo(()=>createTouchRouter(commands),[commands]);
  const owners=useRef(new Map<number,HTMLElement>());
  const cancel=useCallback(()=>{router.cancel();for(const [id,node] of owners.current){node.style.setProperty('--stick-x','0px');node.style.setProperty('--stick-y','0px');if(node.isConnected&&node.hasPointerCapture(id))node.releasePointerCapture(id);}owners.current.clear();},[router]);
  useEffect(()=>{
    if(!enabled)cancel();
    window.addEventListener('blur',cancel);window.addEventListener('orientationchange',cancel);
    return()=>{cancel();window.removeEventListener('blur',cancel);window.removeEventListener('orientationchange',cancel);};
  },[cancel,enabled]);
  const bind=(role:TouchRole)=>({
    onPointerDown(e:ReactPointerEvent<HTMLElement>){
      if(!enabled)return;e.preventDefault();e.stopPropagation();
      const rect=e.currentTarget.getBoundingClientRect();
      const x=role==='move'?rect.left+rect.width/2:e.clientX,y=role==='move'?rect.top+rect.height/2:e.clientY;
      if(router.start(role,e.pointerId,x,y)){owners.current.set(e.pointerId,e.currentTarget);e.currentTarget.setPointerCapture(e.pointerId);router.move(e.pointerId,e.clientX,e.clientY);}
    },
    onPointerMove(e:ReactPointerEvent<HTMLElement>){
      if(!enabled||!owners.current.has(e.pointerId))return;e.preventDefault();router.move(e.pointerId,e.clientX,e.clientY);
      if(role==='move'){const r=e.currentTarget.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,scale=Math.max(1,Math.hypot(dx,dy)/40);e.currentTarget.style.setProperty('--stick-x',`${dx/scale}px`);e.currentTarget.style.setProperty('--stick-y',`${dy/scale}px`);}
    },
    onPointerUp(e:ReactPointerEvent<HTMLElement>){router.end(e.pointerId);owners.current.delete(e.pointerId);e.currentTarget.style.setProperty('--stick-x','0px');e.currentTarget.style.setProperty('--stick-y','0px');if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);},
    onPointerCancel(){router.cancel();owners.current.clear();},
    onLostPointerCapture(e:ReactPointerEvent<HTMLElement>){if(owners.current.has(e.pointerId)){router.cancel();owners.current.clear();}},
  });
  const directionHandlers=(x:number,forward:number)=>({
    onPointerDown(e:ReactPointerEvent<HTMLButtonElement>){
      if(!enabled)return;e.preventDefault();e.stopPropagation();
      if(router.start('move',e.pointerId,0,0)){owners.current.set(e.pointerId,e.currentTarget);e.currentTarget.setPointerCapture(e.pointerId);commands.setMove('touch',x,forward);}
    },
    onPointerUp:bind('move').onPointerUp,
    onPointerCancel:bind('move').onPointerCancel,
    onLostPointerCapture:bind('move').onLostPointerCapture,
    onKeyDown(e:KeyboardEvent<HTMLButtonElement>){if(enabled&&!e.repeat&&(e.key===' '||e.key==='Enter')){e.preventDefault();if(router.start('move',-1,0,0))commands.setMove('touch',x,forward);}},
    onKeyUp(e:KeyboardEvent<HTMLButtonElement>){if(e.key===' '||e.key==='Enter'){e.preventDefault();router.end(-1);}},
    onBlur(){router.end(-1);},
  });
  return {padHandlers:bind('move'),lookHandlers:bind('look'),directionHandlers,cancel};
}
