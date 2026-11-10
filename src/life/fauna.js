// Zwierzyna (0.5): liczebność w obwodzie (widać tylko jej część), rozród wiosną, wilki, plan łowiecki koła,
// paśniki i dokarmianie zimą, zgryzanie niegrodzonych sadzonek, rykowisko jesienią.
import {state,cal,toast,clamp,zl,SEASONS,displayNumber} from '../core.js';
import {POLANA,UPRAWA,inRect,roadClearance} from '../map.js';
import {trees,STAND,removeTree,dirtyTree,SAPLING_AGE} from '../forest.js';
import {E} from '../ents.js';
import {rand} from './agents.js';
import {ECO,bumpDamage} from '../economy.js';
import {sfx} from '../sound.js';
import {feedTask} from '../incidents.js';
import {R} from '../renew.js';

export const NAMES={roe:'sarny',deer:'jelenie',boar:'dziki',wolf:'wilki',fox:'lisy',hare:'zające'};
const ONE={roe:'sarnę',deer:'jelenia',boar:'dzika'};
// docelowe zagęszczenie (przy nim zgryzanie jest „normalne”)
const TARGET={roe:30,deer:10,boar:14};
export const FA={pop:{roe:36,deer:13,boar:19,wolf:5,fox:6,hare:18},plan:{roe:6,deer:2,boar:6},culled:{roe:0,deer:0,boar:0},seasonCull:0,
 feeders:[],winterT:0,emptyT:0,reduction:false,roarT:0,roarSeason:-1,browsed:0,carcasses:[]};
export function initFauna(){
 FA.feeders=[{name:'P1 (polana)',x:POLANA.x+40,y:POLANA.y-60,level:.3,task:null},{name:'P2 (oddz. 101)',x:560,y:1060,level:.3,task:null},{name:'P3 (oddz. 105)',x:2050,y:470,level:.3,task:null}];
 newPlan(false);
 if(!ECO.seasonHooks.includes(seasonEnd))ECO.seasonHooks.push(seasonEnd);
}
export const pressure=()=>(FA.pop.roe+2.5*FA.pop.deer)/(TARGET.roe+2.5*TARGET.deer);
// Plan łowiecki na rok (od wiosny): odstrzał nadwyżki ponad zagęszczenie docelowe, minimum symboliczne.
function newPlan(reset=true){
 for(const k of ['roe','deer','boar']){const over=FA.pop[k]-TARGET[k]*.85;FA.plan[k]=Math.max(k==='deer'?1:2,Math.round(over*.7));if(reset)FA.culled[k]=0}
 FA.reduction=false;
}
export const planLeft=()=>['roe','deer','boar'].reduce((a,k)=>a+Math.max(0,FA.plan[k]-FA.culled[k]),0);
export function cull(kind,visible){
 if(!FA.plan[kind])return false;FA.pop[kind]=Math.max(0,FA.pop[kind]-1);FA.culled[kind]++;FA.seasonCull++;
 toast((visible?'Myśliwy z koła łowieckiego pozyskał ':'Koło łowieckie: pozyskano ')+ONE[kind]+' (plan '+FA.culled[kind]+'/'+FA.plan[kind]+').');return true;
}
// Wniosek o odstrzał redukcyjny: większy plan, myśliwi przychodzą co wieczór.
export function requestReduction(){
 if(FA.reduction){toast('Wniosek o odstrzał redukcyjny już złożony.');return}
 if(pressure()<1.05){toast('Nadleśnictwo odrzuciło wniosek: zagęszczenie zwierzyny nie jest nadmierne.');return}
 FA.reduction=true;for(const k of ['roe','deer'])FA.plan[k]+=Math.max(1,Math.round(FA.plan[k]*.5));
 toast('Wniosek przyjęty: koło łowieckie zwiększy odstrzał saren i jeleni. Myśliwi będą na ambonie co wieczór.');
}
// Ile widocznych zwierząt danego gatunku (reprezentacja populacji w obwodzie).
export function visibleCount(kind){
 const p=FA.pop[kind];
 return {roe:clamp(Math.round(p/12),0,3),deer:clamp(Math.round(p/4),0,4),boar:clamp(Math.round(p/9),0,3),wolf:clamp(Math.round(p/2),0,3),fox:clamp(Math.round(p/4),0,2),hare:clamp(Math.round(p/8),0,2)}[kind];
}
const winter=()=>cal.season()===3;
// Paśniki: kiedy groupy wolą odwiedzać (zimą ciągną do paśników z karmą)
export function likesNow(base){if(!winter())return base;const f=FA.feeders.filter(q=>q.level>.08).map(q=>[q.x,q.y-24]);return f.length?f:base}
// ── co klatkę ──
let fT=0;
export function updateFauna(dt){
 const w=winter(),h=cal.hour();
 // zimą zwierzyna wyjada karmę; jesienią paśniki stoją (lizawka)
 if(w){FA.winterT+=dt;let empty=0;
  for(const f of FA.feeders){f.level=Math.max(0,f.level-dt*.42/1440*(1+FA.pop.deer/30));if(f.level<.02)empty++;
   if(f.level<.22&&!(f.task&&f.task.status!=='done'&&f.task.status!=='gone')){f.task=feedTask(f,f.name)}}
  FA.emptyT+=dt*empty/FA.feeders.length;
 }
 // rykowisko: jesienią o zmierzchu i świcie byki ryczą
 if(cal.season()===2&&((h>17.5&&h<22)||(h>4.5&&h<7.5))&&FA.pop.deer>2){
  FA.roarT-=dt;if(FA.roarT<=0){FA.roarT=25+rand()*70;sfx('roar');
   if(FA.roarSeason!==cal.year()){FA.roarSeason=cal.year();toast('Rykowisko! O zmierzchu w lesie ryczą byki jeleni.')}}
 }
 fT+=dt;if(fT>1){fT=0;FA.carcasses=FA.carcasses.filter(c=>!c.dead)}
}
// ── koniec pory roku (wywoływane z raportu) ──
function fenced(t){if(inRect(t.x,t.y,UPRAWA,-2))return true;return R.plots.some(p=>p.fence==='done'&&inRect(t.x,t.y,p,-1))}
function seasonEnd(){
 const se=(cal.season()+3)%4,P=FA.pop,out={};const before={...P};
 // drapieżnictwo wilków (gatunek chroniony — nie poluje się na nie)
 const eaten=P.wolf*.6*(.7+rand()*.6);P.roe=Math.max(4,P.roe-Math.round(eaten*.75));P.deer=Math.max(3,P.deer-Math.round(eaten*.15));P.boar=Math.max(3,P.boar-Math.round(eaten*.1));
 // zima: straty zależne od dokarmiania
 let fed=1;if(se===3){fed=FA.winterT>0?1-FA.emptyT/FA.winterT:1;const loss=(1-fed)*.18+.02;P.roe=Math.round(P.roe*(1-loss));P.deer=Math.round(P.deer*(1-loss*.7));P.boar=Math.round(P.boar*(1-loss*.6));P.hare=Math.round(P.hare*(1-loss));out.fed=fed}
 // wiosna: rozród
 if(se===0){P.roe=Math.round(P.roe*1.38);P.deer=Math.round(P.deer*1.28);P.boar=Math.round(P.boar*1.65);P.hare=Math.round(P.hare*1.5);P.fox+=rand()<.6?1:0;if(P.wolf>=2)P.wolf+=1+(rand()<.4?1:0)}
 else{P.boar=Math.round(P.boar*.97);P.hare=Math.round(P.hare*.93)}
 // wilki: watahy migrują, liczebność się wyrównuje
 if(P.wolf>7)P.wolf-=2;if(P.wolf<3&&rand()<.4)P.wolf++;
 // zgryzanie: niegrodzone, młode sadzonki z nasadzeń
 const pr=pressure()*(se===3?1.6:se===0?1.2:.8)*(se===3&&fed<.6?1.4:1);let browsed=0,killed=0;
 if(pr>.35)for(const t of trees){if(t.st!==STAND||!t.planted||t.age>=SAPLING_AGE+3||fenced(t))continue;
  if(rand()<clamp(.07*pr*pr,0,.55)){browsed++;if(rand()<.35){removeTree(t);killed++}else{t.age=Math.max(1,t.age-2);t.browsed=true;dirtyTree(t)}}}
 FA.browsed=browsed;if(browsed>30)bumpDamage(Math.min(6,browsed/25));
 out.browsed=browsed;out.browsedKilled=killed;out.pressure=pressure();out.cull=FA.seasonCull;out.popBefore=before;out.pop={...P};
 FA.seasonCull=0;FA.winterT=0;FA.emptyT=0;
 // nowy rok łowiecki od wiosny
 if(cal.season()===0)newPlan();
 // jesień → zima: koło łowieckie napełnia paśniki „na start”
 if(cal.season()===3)for(const f of FA.feeders)f.level=Math.max(f.level,.55);
 return{fauna:out};
}

// ── rysowanie: paśniki (z poziomem siana) i upolowana zwierzyna ──
const rect=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h)};
export function drawFeeders(g){
 const snow=winter();
 for(const f of FA.feeders){const px=f.x,py=f.y;
  rect(g,px-13,py-6,30,16,'#2b3b2a50');
  rect(g,px-15,py-9,30,18,'#4e3c2c');rect(g,px-13,py-7,26,14,'#6e5536');
  const n=Math.round(f.level*6);for(let k=0;k<6;k++)rect(g,px-12+k*4+(k>2?2:0),py-6,3,12,k<n?'#c6aa64':'#5a4632');
  rect(g,px-15,py-1,30,2,snow?'#e8eef0':'#8a6a44');rect(g,px-16,py-10,32,2,snow?'#f4f8fa':'#5e4a34');
  rect(g,px+20,py+5,5,5,'#ded8cc');rect(g,px+21,py+6,3,3,'#f4efe6');   // lizawka
  if(snow&&f.level<.22){rect(g,px-2,py-18,4,6,'#e0704f');rect(g,px-2,py-10,4,2,'#e0704f')}
 }
 for(const c of FA.carcasses){if(c.dead)continue;const s=c.kind==='deer'?1.4:c.kind==='boar'?1.1:1;
  g.save();g.translate(Math.round(c.x),Math.round(c.y));g.rotate(c.a);
  rect(g,-8*s,-3*s,16*s,6*s,'#2a2420');rect(g,-7*s,-2*s,14*s,4*s,c.kind==='boar'?'#4a3e34':c.kind==='deer'?'#6b4630':'#8d5f3e');rect(g,6*s,-1,3*s,2,'#3a2e24');
  g.restore();}
}
export const feederAt=(x,y)=>FA.feeders.find(f=>Math.abs(f.x-x)<18&&Math.abs(f.y-y)<14);
export function faunaSummary(){return ['roe','deer','boar','wolf','fox','hare'].map(k=>NAMES[k]+' '+FA.pop[k]).join(' · ')}
