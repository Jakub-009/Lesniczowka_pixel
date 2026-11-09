// Zapis gry w localStorage (jak w farmie: wszystko w try/catch). Zapisujemy las, wskaźniki, kalendarz, składnicę,
// kłody w lesie i zaplanowane sadzonki. Zwierzęta i goście pojawiają się na nowo po wczytaniu.
import {state} from './core.js';
import {serializeTrees,loadTrees} from './forest.js';
import {J} from './jobs.js';
import {ECO} from './economy.js';
import {E} from './ents.js';
const KEY='lesniczowka-save-1';
export function hasSave(){try{return !!localStorage.getItem(KEY)}catch(e){return false}}
export function clearSave(){try{localStorage.removeItem(KEY)}catch(e){}}
export function saveGame(){
 if(!state.playing)return;
 try{
  const o={v:1,days:state.days,money:state.money,health:state.health,protect:state.protect,trees:serializeTrees(),
   stack:J.stack,stackValue:J.stackValue,sold:J.sold,plants:J.plants.map(p=>[Math.round(p.x),Math.round(p.y),p.sp]),
   piles:E.piles.filter(p=>!p.dead).map(p=>[Math.round(p.x),Math.round(p.y),+p.a.toFixed(2),+p.vol.toFixed(3),p.sp,p.logs,p.bark]),
   eco:{cover0:ECO.cover0,damage:ECO.damage,plan:ECO.plan},burns:E.burns||[]};
  localStorage.setItem(KEY,JSON.stringify(o));
 }catch(e){}
}
export function loadGame(){
 try{
  const o=JSON.parse(localStorage.getItem(KEY)||'null');if(!o||o.v!==1)return false;
  Object.assign(state,{days:o.days,money:o.money,health:o.health,protect:o.protect});
  loadTrees(o.trees);
  J.stack=o.stack;J.stackValue=o.stackValue;J.sold=o.sold||0;
  J.plants=(o.plants||[]).map(([x,y,sp])=>({x,y,sp,assigned:false}));
  E.piles=(o.piles||[]).map(([x,y,a,vol,sp,logs,bark])=>({x,y,a,vol,sp,logs,bark,state:'ground',dead:false}));
  ECO.cover0=o.eco.cover0;ECO.damage=o.eco.damage;ECO.plan=o.eco.plan;ECO.lastDay=Math.floor(o.days);ECO.lastSeason=Math.floor(o.days/10)%4;
  E.burns=o.burns||[];
  return true;
 }catch(e){return false}
}
