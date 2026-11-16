// 0.9: ambony — stałe miejsca (map.js, AMBONY); pierwsza stoi od początku, kolejne pojawiają się po zakupie w Leśniczówce (L).
// Każda ambona ma własnego myśliwego (wyjścia wieczorem i o świcie), zasięg ok. 420 px i własną porcję pozyskania.
import {toast} from '../core.js';
import {AMBONY,colliders} from '../map.js';
import {treesIn,removeTree} from '../forest.js';
import {canAfford,pay} from '../economy.js';
import {rand} from './agents.js';

export const AMB={list:[]};
export {AMBONY};
export const AMB_COST=1100,AMB_MAX=AMBONY.length,AMB_R=420;
const mkAmb=slot=>({id:slot,slot,x:AMBONY[slot].x,y:AMBONY[slot].y,off:rand(),hDay:-1,dDay:-1,shots:0,outings:0,got:0});
export function initAmbony(){AMB.list=[mkAmb(0)]}
export const nextAmbonaSlot=()=>{for(let i=0;i<AMBONY.length;i++)if(!AMB.list.some(a=>a.slot===i))return i;return null};
export function buyAmbona(slot){
 if(slot==null){toast('Wszystkie '+AMB_MAX+' ambon już stoi.');return false}
 if(AMB.list.some(a=>a.slot===slot))return false;
 if(!canAfford(AMB_COST))return false;
 pay(AMB_COST,'budowa ambony');
 const a=mkAmb(slot);
 for(const t of treesIn(a.x-18,a.y-18,a.x+18,a.y+18).slice())if(Math.hypot(t.x-a.x,t.y-a.y)<16)removeTree(t);
 AMB.list.push(a);AMB.list.sort((p,q)=>p.slot-q.slot);colliders.push({shape:'circle',x:a.x,y:a.y,r:9,id:'ambona',br:9,amb:a.slot});
 toast('Ambona '+AMBONY[slot].name+' gotowa. Koło łowieckie wystawi tu własnego myśliwego wieczorem i o świcie.');
 return true;
}
export const ambonaAt=(x,y)=>AMB.list.find(a=>Math.hypot(a.x-x,a.y-y)<20)||null;
// po wczytaniu zapisu
export function loadAmbony(list){
 for(let i=colliders.length-1;i>=0;i--)if(colliders[i].amb!=null)colliders.splice(i,1);
 initAmbony();
 for(const q of list||[]){const slot=q&&q.slot!=null?q.slot:q&&q.id;if(slot==null||slot<0||slot>=AMBONY.length)continue;
  let a=AMB.list.find(z=>z.slot===slot);
  if(!a){a=mkAmb(slot);AMB.list.push(a);if(slot!==0)colliders.push({shape:'circle',x:a.x,y:a.y,r:9,id:'ambona',br:9,amb:slot})}
  a.shots=q.shots||0;a.outings=q.outings||0;a.got=q.got||0}
 AMB.list.sort((p,q)=>p.slot-q.slot);
}
export const saveAmbony=()=>AMB.list.map(a=>({slot:a.slot,shots:a.shots,outings:a.outings,got:a.got}));
