import { useEffect, useRef } from 'react';
import type { GameSettings, InputMode, PlayerSnapshot } from '../../contracts';
import { getZoneAt } from '../../content/world/definition';
import { audioLevel } from './audioPolicy';

interface Graph {context:AudioContext;master:GainNode;filter:BiquadFilterNode;source:AudioBufferSourceNode;wheel:OscillatorNode;wheelGain:GainNode}
/** Original synthesized preview ambience. Starts only following a user gesture. */
export function AudioDirector({settings,mode,player}:{settings:GameSettings;mode:InputMode;player:PlayerSnapshot}){
 const graph=useRef<Graph|null>(null),latest=useRef({settings,mode,player});latest.current={settings,mode,player};
 const update=()=>{
   const g=graph.current;if(!g)return;const {settings,mode,player}=latest.current;
   const level=audioLevel(settings,mode,!document.hidden),now=g.context.currentTime;
   if(level>0&&g.context.state==='suspended')void g.context.resume().catch(()=>{});
   g.master.gain.setTargetAtTime(level,now,.2);
   const zone=getZoneAt(player.position[2]);g.filter.frequency.setTargetAtTime(zone==='kurumali'?1400:zone==='kodaly'?700:zone==='kadambode'?330:220,now,.8);
   g.wheelGain.gain.setTargetAtTime(player.travelMode==='bicycle'?Math.min(.035,player.speed*.004):0,now,.1);
   g.wheel.frequency.setTargetAtTime(38+player.speed*6,now,.1);
 };
 useEffect(()=>{
   const unlock=()=>{
     if(graph.current){update();return;}
     if(latest.current.mode!=='playing')return;
     try{
       const context=new AudioContext(),master=context.createGain(),filter=context.createBiquadFilter();
       master.gain.value=0;filter.type='lowpass';filter.frequency.value=220;filter.Q.value=.2;
       const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),samples=buffer.getChannelData(0);
       let seed=381,previous=0;for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;previous=(previous+.025*(seed/4294967296*2-1))/1.025;samples[i]=previous*4;}
       const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(filter);filter.connect(master);master.connect(context.destination);source.start();
       const wheel=context.createOscillator(),wheelGain=context.createGain();wheel.type='triangle';wheelGain.gain.value=0;wheel.connect(wheelGain);wheelGain.connect(master);wheel.start();
       graph.current={context,master,filter,source,wheel,wheelGain};update();
     }catch{ /* Sound failure never prevents exploration. */ }
   };
   const visibility=()=>{if(document.hidden){void graph.current?.context.suspend();}else update();};
   window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',visibility);
   return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);if(graph.current){graph.current.source.stop();graph.current.wheel.stop();void graph.current.context.close();graph.current=null;}};
 },[]);
 useEffect(update,[settings,mode,player]);
 return null;
}
