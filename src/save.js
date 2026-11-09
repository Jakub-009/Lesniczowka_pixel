// Zapis gry w localStorage (jak w farmie: wszystko w try/catch). Zapisujemy las, wskaźniki, kalendarz, składnicę,
// kłody w lesie i zaplanowane sadzonki. Zwierzęta i goście pojawiają się na nowo po wczytaniu.
import {state,SEASON_DAYS} from './core.js';
import {serializeTrees,loadTrees} from './forest.js';
import {J,MACH} from './jobs.js';
import {R,rowsOf} from './renew.js';
import {paintTrail,paintFurrowRow} from './paint.js';
import {Vehicle} from './life/agents.js';
import {edgeOf} from './roads.js';
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
   eco:{cover0:ECO.cover0,damage:ECO.damage,plan:ECO.plan},burns:E.burns||[],
   plots:R.plots.map(p=>({...p})),nextPlot:R.nextId,trails:J.trails.slice(-120),forwarder:J.skid.owned};
  localStorage.setItem(KEY,JSON.stringify(o));
 }catch(e){console.warn('Zapis gry nie powiódł się:',e)}
}
export function loadGame(){
 try{
  const o=JSON.parse(localStorage.getItem(KEY)||'null');if(!o||o.v!==1)return false;
  Object.assign(state,{days:o.days,money:o.money,health:o.health,protect:o.protect});
  loadTrees(o.trees);
  J.stack=o.stack;J.stackValue=o.stackValue;J.sold=o.sold||0;
  J.plants=(o.plants||[]).map(([x,y,sp])=>({x,y,sp,assigned:false}));
  // powierzchnie odnowieniowe i szlaki: dane + ponowne malowanie bruzd i kolein
  R.plots=(o.plots||[]).map(p=>({...p,state:p.state==='planting'||p.state==='queued'||p.state==='prepping'?(p.prepared?'prepared':'new'):p.state}));R.nextId=o.nextPlot||R.plots.length+1;
  for(const p of R.plots)if(p.prepared)for(const y of rowsOf(p))paintFurrowRow(y,p.x+6,p.x+p.w-6);
  J.trails=o.trails||[];for(const t of J.trails)paintTrail(t);
  if(o.forwarder&&!J.skid.owned){const S=J.skid;S.owned=true;S.trac.dead=true;S.mach='forwarder';S.trac=new Vehicle('forwarder',{from:'sk',to:'b1',s:180}).parkHere();S.trac.cap=MACH.forwarder.cap;S.trac.label=MACH.forwarder.name+' (czeka na składnicy)'}
  E.piles=(o.piles||[]).map(([x,y,a,vol,sp,logs,bark])=>({x,y,a,vol,sp,logs,bark,state:'ground',dead:false}));
  ECO.cover0=o.eco.cover0;ECO.damage=o.eco.damage;ECO.plan=o.eco.plan;ECO.lastDay=Math.floor(o.days);ECO.lastSeason=Math.floor(o.days/SEASON_DAYS)%4;
  E.burns=o.burns||[];
  return true;
 }catch(e){return false}
}
