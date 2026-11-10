// Zapis gry w localStorage (jak w farmie: wszystko w try/catch). Zapisujemy las, wskaźniki, kalendarz, stosy przy drogach,
// kłody w lesie, plany, powierzchnie z grodzeniem, szlaki (blakną z czasem), kadry, budynki, populacje zwierzyny i paśniki.
// Pojedyncze zwierzęta, goście i pojazdy pojawiają się na nowo po wczytaniu.
import {state,SEASON_DAYS} from './core.js';
import {serializeTrees,loadTrees,trees} from './forest.js';
import {J,MACH,restoreStack,hireCrewB} from './jobs.js';
import {R,rowsOf} from './renew.js';
import {paintTrail,paintFurrowRow,markAlpha} from './paint.js';
import {Vehicle} from './life/agents.js';
import {EDGES} from './map.js';
import {ECO} from './economy.js';
import {E} from './ents.js';
import {FA} from './life/fauna.js';
import {spawnWildlife} from './life/populate.js';
import {BASE} from './base.js';
import {hirePod} from './incidents.js';
const KEY='lesniczowka-save-1';
const FADE=.88;   // koleiny i bruzdy blakną o 12% dziennie
export function hasSave(){try{return !!localStorage.getItem(KEY)}catch(e){return false}}
export function clearSave(){try{localStorage.removeItem(KEY)}catch(e){}}
export function saveGame(){
 if(!state.playing)return;
 try{
  const o={v:2,days:state.days,money:state.money,health:state.health,protect:state.protect,trees:serializeTrees(),
   stacks:J.stacks.filter(s=>s.vol>.05).map(s=>[s.edge.id,Math.round(s.s),+s.vol.toFixed(2),Math.round(s.value)]),sold:J.sold,
   plants:J.plants.map(p=>[Math.round(p.x),Math.round(p.y),p.sp]),
   piles:E.piles.filter(p=>!p.dead).map(p=>[Math.round(p.x),Math.round(p.y),+p.a.toFixed(2),+p.vol.toFixed(3),p.sp,p.logs,p.bark]),
   eco:{cover0:ECO.cover0,damage:ECO.damage,plan:ECO.plan,market:ECO.market,pod:ECO.staff.pod,nursery:ECO.nursery,feedCost:ECO.feedCost},burns:E.burns||[],
   plots:R.plots.map(p=>({...p})),nextPlot:R.nextId,trails:J.trails.slice(-160),forwarder:J.skid.owned,crewB:J.crews.length>1,
   base:{nursery:BASE.nursery,garage:BASE.garage,stats:BASE.stats,opal:BASE.opalPiles.filter(o=>!o.dead).map(o=>[Math.round(o.x),Math.round(o.y),+o.a.toFixed(2),+o.vol.toFixed(2),o.edge.id,Math.round(o.s),+o.day.toFixed(2),o.odd])},
   fauna:{pop:FA.pop,plan:FA.plan,culled:FA.culled,reduction:FA.reduction,feeders:FA.feeders.map(f=>+f.level.toFixed(3)),winterT:FA.winterT,emptyT:FA.emptyT}};
  localStorage.setItem(KEY,JSON.stringify(o));
 }catch(e){console.warn('Zapis gry nie powiódł się:',e)}
}
export function loadGame(){
 try{
  const o=JSON.parse(localStorage.getItem(KEY)||'null');if(!o||(o.v!==1&&o.v!==2))return false;
  Object.assign(state,{days:o.days,money:o.money,health:o.health,protect:o.protect});
  loadTrees(o.trees);
  // stosy przy drogach (zapis z 0.3: jedna składnica → jeden stos przy drodze B)
  J.stacks.length=0;J.sold=o.sold||0;
  if(o.v===1){if(o.stack>.05)restoreStack('sk-b1',120,o.stack,o.stackValue||o.stack*250)}
  else for(const [id,s,vol,val] of o.stacks||[])restoreStack(id,s,vol,val);
  J.plants=(o.plants||[]).map(([x,y,sp])=>({x,y,sp,assigned:false}));
  // powierzchnie odnowieniowe i szlaki: dane + ponowne malowanie bruzd i kolein (z wyblaknięciem według wieku)
  R.plots=(o.plots||[]).map(p=>({...p,state:p.state==='planting'||p.state==='queued'||p.state==='prepping'?(p.prepared?'prepared':'new'):p.state}));R.nextId=o.nextPlot||R.plots.length+1;
  for(const p of R.plots)if(p.prepared){const age=state.days-(p.prepDay??state.days);if(age>25)continue;markAlpha(FADE**age);for(const y of rowsOf(p))paintFurrowRow(y,p.x+6,p.x+p.w-6)}
  J.trails=(o.trails||[]).map(t=>Array.isArray(t)?{d:o.days,p:t}:t).filter(t=>state.days-t.d<25);
  for(const t of J.trails){markAlpha(FADE**(state.days-t.d));paintTrail(t.p)}
  markAlpha(1);
  if(o.forwarder&&!J.skid.owned){const S=J.skid;S.owned=true;S.trac.dead=true;S.mach='forwarder';S.trac=new Vehicle('forwarder',{from:'sk',to:'b1',s:180}).parkHere();S.trac.cap=MACH.forwarder.cap;S.trac.label=MACH.forwarder.name+' (w bazie maszyn)'}
  E.piles=(o.piles||[]).map(([x,y,a,vol,sp,logs,bark])=>({x,y,a,vol,sp,logs,bark,state:'ground',dead:false}));
  const ec=o.eco||{};ECO.cover0=ec.cover0;ECO.damage=ec.damage;ECO.plan=ec.plan;ECO.lastDay=Math.floor(o.days);ECO.lastSeason=Math.floor(o.days/SEASON_DAYS)%4;
  if(ec.market)ECO.market=ec.market;if(ec.nursery)ECO.nursery=ec.nursery;if(ec.feedCost)ECO.feedCost=ec.feedCost;
  E.burns=o.burns||[];
  if(o.crewB&&J.crews.length<2)hireCrewB();
  if(o.base){BASE.nursery=!!o.base.nursery;BASE.garage=!!o.base.garage;Object.assign(BASE.stats,o.base.stats||{});
   BASE.opalPiles=(o.base.opal||[]).map(([x,y,a,vol,eid,s,day,odd])=>({x,y,a,vol,edge:EDGES.find(e=>e.id===eid)||EDGES[4],s,day,odd,logs:Math.max(2,Math.min(6,Math.round(vol*1.5))),bark:'#7a5a3e',sp:'sosna'}))}
  if(ec.pod&&!ECO.staff.pod){ECO.staff.pod=true;hirePod()}
  if(o.fauna){const F=o.fauna;Object.assign(FA.pop,F.pop);Object.assign(FA.plan,F.plan);Object.assign(FA.culled,F.culled);FA.reduction=!!F.reduction;FA.winterT=F.winterT||0;FA.emptyT=F.emptyT||0;
   (F.feeders||[]).forEach((l,i)=>{if(FA.feeders[i])FA.feeders[i].level=l})}
  spawnWildlife();
  return true;
 }catch(e){console.warn('Wczytanie zapisu nie powiodło się:',e);return false}
}
