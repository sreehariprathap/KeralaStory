import type { InputCommands } from '../../contracts/input';
export type TouchRole = 'move' | 'look';
export function createTouchRouter(commands: InputCommands) {
  const contacts=new Map<number,{role:TouchRole;x:number;y:number}>();
  return {
    start(role:TouchRole,id:number,x:number,y:number) {
      if([...contacts.values()].some(p=>p.role===role)) return false;
      contacts.set(id,{role,x,y});return true;
    },
    move(id:number,x:number,y:number) {
      const p=contacts.get(id);if(!p)return;
      if(p.role==='look') {commands.addLook('touch',x-p.x,y-p.y);p.x=x;p.y=y;}
      else {const dx=(x-p.x)/40,dy=(p.y-y)/40,length=Math.hypot(dx,dy);
        if(length<.15)commands.setMove('touch',0,0);
        else commands.setMove('touch',dx/Math.max(1,length),dy/Math.max(1,length));}
    },
    end(id:number) {const p=contacts.get(id);if(!p)return;contacts.delete(id);if(p.role==='move')commands.setMove('touch',0,0);},
    cancel() {contacts.clear();commands.clear('touch');},
  };
}
