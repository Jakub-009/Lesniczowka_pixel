// Zwierzyna (0.5): liczebność w obwodzie (widać tylko jej część), rozród wiosną, wilki, plan łowiecki koła,
// paśniki i dokarmianie zimą, zgryzanie niegrodzonych sadzonek, rykowisko jesienią.
import {state,cal,toast,clamp,zl,SEASONS,displayNumber} from '../core.js';
import {POLANA,FEEDERS,inRect,roadClearance} from '../map.js';
import {trees,STAND,removeTree,dirtyTree,SAPLING_AGE} from '../forest.js';
import {E} from '../ents.js';
import {rand,WX} from './agents.js';
import {mail} from '../mail.js';
import {ECO,bumpDamage,canAfford,pay} from '../economy.js';
import {sfx} from '../sound.js';
import {feedTask} from '../incidents.js';
import {R,seasonKey,inShape} from '../renew.js';

export const NAMES={roe:'sarny',deer:'jelenie',boar:'dziki',wolf:'wilki',fox:'lisy',hare:'zające'};
const ONE={roe:'sarnę',deer:'jelenia',boar:'dzika'};
// docelowe zagęszczenie (przy nim zgryzanie jest „normalne”)
const TARGET={roe:48,deer:16,boar:22};   // las 0.6 jest ok. 2,25× większy
// 0.8.3: wilki nie mieszkają w lesie na stałe — wędrowna wataha przychodzi na kilka dni gry i idzie dalej (FA.wolf)
export const FH={wolves:null};   // ustawiane przez populate.js (bez cyklu importów)
export const FA={wolf:{present:false,size:0,until:0,cool:5,days:0,total:0},pop:{roe:58,deer:20,boar:30,fox:9,hare:28},plan:{roe:8,deer:3,boar:8},culled:{roe:0,deer:0,boar:0},seasonCull:0,
 feeders:[],winterT:0,emptyT:0,reduction:false,roarT:0,roarSeason:-1,browsed:0,carcasses:[]};
// 0.9: paśniki buduje gracz w trybie Budowa (stałe miejsca FEEDERS, max 4); nowa gra zaczyna z jednym
export const FEED_COST=700,FEED_MAX=FEEDERS.length;
export const mkFeeder=(slot,level=.3)=>({name:FEEDERS[slot].name,slot,x:FEEDERS[slot].x,y:FEEDERS[slot].y,level,task:null});
export function initFauna(){
 FA.feeders=[mkFeeder(0)];
 newPlan(false);
 if(!ECO.seasonHooks.includes(seasonEnd))ECO.seasonHooks.push(seasonEnd);
}
export const feederSlotAt=(x,y,r=60)=>{let b=null,bd=r;FEEDERS.forEach((f,i)=>{if(FA.feeders.some(q=>q.slot===i))return;const d=Math.hypot(f.x-x,f.y-y);if(d<bd){bd=d;b=i}});return b};
export function buildFeeder(slot){
 if(slot==null||FA.feeders.some(q=>q.slot===slot))return false;
 if(FA.feeders.length>=FEED_MAX){toast('Są już wszystkie '+FEED_MAX+' paśniki.');return false}
 if(!canAfford(FEED_COST))return false;
 pay(FEED_COST,'budowa paśnika');FA.feeders.push(mkFeeder(slot,.5));FA.feeders.sort((a,b)=>a.slot-b.slot);
 toast('Paśnik gotowy: '+FEEDERS[slot].name+'. Zimą zwierzyna rozłoży się po większej liczbie paśników, a ubytki karmy uzupełnia patrol.');return true;
}
// zasięg paśników: jeden obejmuje tylko część lasu (reszta zwierzyny głodna zimą)
const feedCover=()=>[.4,.7,.85,.95,1][Math.min(4,FA.feeders.length)];
export const pressure=()=>(FA.pop.roe+2.5*FA.pop.deer)/(TARGET.roe+2.5*TARGET.deer);
// Plan łowiecki na rok (od wiosny): odstrzał nadwyżki ponad zagęszczenie docelowe, minimum symboliczne.
function newPlan(reset=true){
 for(const k of ['roe','deer','boar']){const over=FA.pop[k]-TARGET[k]*.8;FA.plan[k]=Math.min(Math.round(FA.pop[k]*.5),Math.max(k==='deer'?1:2,Math.round(over*.9)));if(reset)FA.culled[k]=0}
 FA.reduction=false;
}
export const planLeft=()=>['roe','deer','boar'].reduce((a,k)=>a+Math.max(0,FA.plan[k]-FA.culled[k]),0);
export function cull(kind,visible,quiet=false){
 if(!FA.plan[kind])return false;FA.pop[kind]=Math.max(0,FA.pop[kind]-1);FA.culled[kind]++;FA.seasonCull++;
 if(quiet)return true;
 toast((visible?'Myśliwy z koła łowieckiego pozyskał ':'Koło łowieckie: pozyskano ')+ONE[kind]+' (plan '+FA.culled[kind]+'/'+FA.plan[kind]+').');return true;
}
// 0.9: partia pozyskania z wyjścia na ambonę (poza widocznymi strzałami): n sztuk rozdzielonych wg tego, co zostało w planie
export function cullBatch(n,label=''){
 const got={};
 for(let i=0;i<n;i++){
  const w=GAMEK.map(k=>Math.max(0,FA.plan[k]-FA.culled[k])*(FA.pop[k]>3?1:0)),tot=w.reduce((a,b)=>a+b,0);if(tot<=0)break;
  let r=rand()*tot,k=GAMEK[0];for(let j=0;j<w.length;j++){r-=w[j];if(r<=0){k=GAMEK[j];break}}
  if(cull(k,false,true))got[k]=(got[k]||0)+1;
 }
 const m=Object.values(got).reduce((a,b)=>a+b,0);
 if(m)toast((label||'Koło łowieckie')+': pozyskano '+m+' szt. ('+Object.entries(got).map(([k,v])=>NAMES[k]+' '+v).join(', ')+'). Plan: '+(GAMEK.reduce((a,k)=>a+FA.culled[k],0))+'/'+(GAMEK.reduce((a,k)=>a+FA.plan[k],0))+'.');
 return m;
}
const GAMEK=['roe','deer','boar'];
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
const SD=3;   // dni w porze roku
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
  FA.emptyT+=dt*empty/Math.max(1,FA.feeders.length);
 }
 // rykowisko: jesienią o zmierzchu i świcie byki ryczą
 if(cal.season()===2&&((h>17.5&&h<22)||(h>4.5&&h<7.5))&&FA.pop.deer>2){
  FA.roarT-=dt;if(FA.roarT<=0){FA.roarT=25+rand()*70;sfx('roar');
   if(FA.roarSeason!==cal.year()){FA.roarSeason=cal.year();toast('Rykowisko! O zmierzchu w lesie ryczą byki jeleni.')}}
 }
  fT+=dt;if(fT>1){fT=0;FA.carcasses=FA.carcasses.filter(c=>!c.dead)}
 wolfDaily();
}
// ── wilki wędrowne ──
const OS=n=>n+(n>=5?' osobników':' osobniki');
let wDay=-1;
function wolfDaily(){
 const d=Math.floor(state.days);if(d===wDay)return;
 const first=wDay<0;wDay=d;const W=FA.wolf;
 if(W.present){
  W.days++;W.total++;
  if(state.days>=W.until){
   W.present=false;W.cool=state.days+12+rand()*12;WX.flee=1;FH.wolves&&FH.wolves();
   mail('wolf','Wataha wilków przeszła dalej, na tereny sąsiedniego nadleśnictwa.',{quiet:false});
  }
  return;
 }
 if(first||state.days<W.cool)return;
 // ok. 25% szans na rok gry (rok = 12 dni): wilk wybiera spokojne, zasobne lasy
 if(rand()<.25/12*(FA.pop.roe+FA.pop.deer>30?1.25:.7)){
  const r=rand(),n=r<.25?2:r<.65?3:r<.9?4:5;
  W.present=true;W.size=n;W.until=state.days+3+rand()*5;W.days=0;WX.flee=1.4;FH.wolves&&FH.wolves();
  mail('wolf','W Twoim lesie pojawiła się wataha wilków ('+OS(n)+'). Wilki wybierają spokojne lasy z dużą ilością zwierzyny, a polując na sarny i jelenie mogą zmniejszać zgryzanie upraw. Zwierzyna będzie bardziej płochliwa. Wilk jest pod ścisłą ochroną — nie wolno go płoszyć ani na niego polować.');
  if(ECO.ord&&ECO.ord.cams)mail('wolf','Fotopułapka przy wjeździe nagrała wilka — to potwierdzenie obecności watahy.',{quiet:true});
 }
}
// ── koniec pory roku (wywoływane z raportu) ──
function fenced(t){return R.plots.some(p=>p.fence==='done'&&inShape(p,t.x,t.y,-1))}
// repelent naniesiony w kończącej się porze roku
const repelled=t=>R.plots.some(p=>p.repel===seasonKey()-1&&inShape(p,t.x,t.y,-1));
function seasonEnd(){
 const se=(cal.season()+3)%4,P=FA.pop,out={};const before={...P};
 // drapieżnictwo wilków (gatunek chroniony — nie poluje się na nie)
 const wd=FA.wolf.days||0,eaten=FA.wolf.size*.25*Math.min(wd,SD)*(.7+rand()*.6)*(wd?1:0);out.wolfDays=wd;P.roe=Math.max(4,P.roe-Math.round(eaten*.75));P.deer=Math.max(3,P.deer-Math.round(eaten*.15));P.boar=Math.max(3,P.boar-Math.round(eaten*.1));
 // zima: straty zależne od dokarmiania
 let fed=1;if(se===3){fed=FA.winterT>0?1-FA.emptyT/FA.winterT:1;fed*=feedCover();const loss=(1-fed)*.18+.02;P.roe=Math.round(P.roe*(1-loss));P.deer=Math.round(P.deer*(1-loss*.7));P.boar=Math.round(P.boar*(1-loss*.6));P.hare=Math.round(P.hare*(1-loss));out.fed=fed}
 // wiosna: rozród
 if(se===0){const g=(b,k,m,lo)=>clamp(b-k*P[m]/TARGET[m],lo,b);   // 0.9: rozród zależny od zagęszczenia (bez polowań zwierzyny nie przybywa w nieskończoność)
  P.roe=Math.round(P.roe*g(1.40,.16,'roe',.85));P.deer=Math.round(P.deer*g(1.30,.12,'deer',.9));P.boar=Math.round(P.boar*g(1.75,.35,'boar',.6));P.hare=Math.round(P.hare*1.5);P.fox+=rand()<.6?1:0;}
 else{P.boar=Math.round(P.boar*.97);P.hare=Math.round(P.hare*.93)}
 // zgryzanie: niegrodzone, młode sadzonki z nasadzeń
 const pr=pressure()*(se===3?1.6:se===0?1.2:.8)*(se===3&&fed<.6?1.4:1)*(1-.25*clamp(wd/SD,0,1));let browsed=0,killed=0;
 if(pr>.35)for(const t of trees){if(t.st!==STAND||!t.planted||t.age>=SAPLING_AGE+3||fenced(t))continue;
  if(rand()<clamp(.07*pr*pr,0,.55)*(repelled(t)?.25:1)){browsed++;if(rand()<.35){removeTree(t);killed++}else{t.age=Math.max(1,t.age-2);t.browsed=true;dirtyTree(t)}}}
 FA.browsed=browsed;if(browsed>30)bumpDamage(Math.min(6,browsed/25));
 out.browsed=browsed;out.browsedKilled=killed;out.pressure=pressure();out.cull=FA.seasonCull;out.popBefore=before;out.pop={...P};
 FA.seasonCull=0;FA.winterT=0;FA.emptyT=0;FA.wolf.days=0;
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
export function faunaSummary(){return ['roe','deer','boar','fox','hare'].map(k=>NAMES[k]+' '+FA.pop[k]).join(' · ')+(FA.wolf.present?' · wilki (wataha '+FA.wolf.size+')':'')}
