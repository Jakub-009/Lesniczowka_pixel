// Porządek w lesie (0.8.2): dzikie wysypiska i firma wywozowa, Policja, fotopułapki przy wjazdach, szlabany i parking z koszem.
import {state,toast,cal,clamp,rect,line,DAY_S,zl} from './core.js';
import {EDGES,BARRIERS,RESERVED,oddzial,roadClearance} from './map.js';
import {ENTRY,exitNode,goalNode,nearestRoad,pointOn} from './roads.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,rand} from './life/agents.js';
import {ECO,pay,earn,canAfford,bumpProtect,planProgress} from './economy.js';
import {report,U,HK} from './incidents.js';
import {mail} from './mail.js';
import {removeTree,treesIn} from './forest.js';
import {J} from './jobs.js';

export const COSTS={waste:700,cams:2400,camsDay:25,parking:3500,parkingDay:15};
const open_=q=>q.status!=='done'&&q.status!=='gone';
const odd=(x,y)=>'oddz. '+oddzial(x,y);
export const ord=()=>ECO.ord;
export const camsOn=()=>!!ECO.ord.cams;
export const barClosed=()=>!!ECO.ord.bar;
export const parkingOn=()=>!!ECO.ord.parking;
// ogólny mnożnik nielegalnych wjazdów: zamknięte szlabany odstraszają co najmniej połowę
export const illegalFactor=()=>ECO.ord.bar?.5:1;
export const PARKING=RESERVED.find(r=>r.id==='parking');
// fotopułapki wiszą na słupkach szlabanów przy czterech wjazdach
export const CAM_SPOTS=[0,2,4,5].map(i=>BARRIERS[i]).filter(Boolean);

// ───────── dzikie wysypiska ─────────
const forestEdges=()=>EDGES.filter(e=>e.kind==='forest'&&e.a!=='l1'&&e.b!=='l1'&&e.a!=='a3'&&e.b!=='a3');
export function spawnDump(){
 const E2=forestEdges(),e=E2[Math.floor(rand()*E2.length)],s=60+rand()*(e.len-120);
 const car=new Vehicle('car',{...ENTRY(rand()<.5),color:'#6a6a64'});car.dark=true;car.label='samochód z przyczepą';
 car.goTo({edge:e,s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*18,cy=v.pos[1]+Math.sin(h)*18;
  const side=rand()<.5?1:-1;let sx=cx+Math.cos(h+1.57*side)*30,sy=cy+Math.sin(h+1.57*side)*30;
  if(!NAV.foot.walkable(sx,sy)){sx=cx+Math.cos(h-1.57*side)*30;sy=cy+Math.sin(h-1.57*side)*30}
  const p=new Ped({kind:'driver',x:cx,y:cy,speed:13});p.label='kierowca wyrzuca odpady';
  p.run([{go:[sx,sy]},{wait:9,pose:'kneel'},{call:()=>{
    const d={x:sx,y:sy,kind:'dump',dead:false,seed:Math.floor(rand()*1e4),t:0,report:camsOn()?2:25+rand()*30};E.trash.push(d);
    if(camsOn()){earn(450,'mandat — nagranie z fotopułapki');bumpProtect(2);mail('dump','Fotopułapka przy wjeździe zarejestrowała samochód sprawcy dzikiego wysypiska w '+odd(sx,sy)+' — mandat 450 zł.',{x:sx,y:sy,quiet:true})}}},
   {go:[cx,cy]},{call:q=>{q.dead=true;v.label='odjeżdża';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}}]);
  v.label='samochód z przyczepą (rozładunek)';
 }});
}
// Zlecenie firmie wywozowej: śmieciarka przyjeżdża w godzinach pracy, ładowacze zbierają odpady.
const W={q:[],cur:null};
export function orderWaste(inc){
 if(!inc||inc.status!=='new')return;
 if(!canAfford(COSTS.waste))return;
 pay(COSTS.waste,'firma wywozowa — dzikie wysypisko');inc.status='queued';W.q.push(inc);
 toast('Zlecono wywóz odpadów ('+zl(COSTS.waste)+'). Śmieciarka przyjedzie w godzinach pracy firmy (7–16).');
}
function startWaste(inc){
 const d=inc.ref,rp=nearestRoad(d.x,d.y,['main','forest']),truck=new Vehicle('waste',{...ENTRY(rand()<.5)});
 truck.label='śmieciarka jedzie po dzikie wysypisko';W.cur={inc,truck};inc.status='assigned';
 truck.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*20,cy=v.pos[1]+Math.sin(h)*20;v.label='załadunek odpadów';
  let back=0;
  for(let i=0;i<2;i++){
   const p=new Ped({kind:'worker',x:cx+i*7,y:cy,speed:14});p.label='pracownik firmy wywozowej';
   p.run([{go:[d.x+(i?9:-9),d.y+4]},{wait:8,pose:'kneel',face:[d.x,d.y]},{call:q=>{q.prop='bag'}},{go:[cx,cy]},{call:q=>{q.dead=true;
     if(++back>=2){d.dead=true;inc.status='done';bumpProtect(4);planProgress('handle',1);W.cur=null;
      mail('dump','Firma wywozowa uprzątnęła dzikie wysypisko w '+odd(d.x,d.y)+'.',{x:d.x,y:d.y});
      v.label='śmieciarka odjeżdża';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}}}]);
  }
 }});
}

// ───────── Policja ─────────
const POL=[];
export function canPolice(inc){return(inc.type==='quad'||inc.type==='intruder')&&open_(inc)&&!inc.police&&inc.ref&&!inc.ref.dead}
export function callPolice(inc){
 if(!canPolice(inc))return;
 inc.police=1;POL.push({inc,wait:20+rand()*20,car:null,t:0,done:false});
 toast('Wezwano Policję — radiowóz dojedzie za kilkadziesiąt minut.');
}
function policeLeave(p,why){
 p.done=true;if(why)toast(why);
 if(p.car&&!p.car.dead){p.car.beacon=false;p.car.stopped=false;p.car.label='radiowóz odjeżdża';p.car.goTo(goalNode(exitNode(p.car.pos[0])),{leave:true})}
}
function policeResolve(p){
 const inc=p.inc,v=inc.ref;
 if(!open_(inc)||v.dead)return policeLeave(p,'Policja odjechała: sprawca już się oddalił albo sprawę zakończył patrol.');
 const u=inc.unit;
 if(u&&u.cur===inc&&u.phase==='onsite')return policeLeave(p,'Policja odjechała: patrol zajął się już sprawcą.');
 inc.status='done';
 if(u&&u.cur===inc){u.cur=null;u.startNext()}
 for(const x of U)x.queue=x.queue.filter(q=>q!==inc);
 v.stopped=true;v.label='zatrzymany przez Policję';
 const quad=inc.type==='quad';
if(!quad){const m=v.man;if(m&&!m.dead)m.label=m.label+' — zatrzymany';
  if(v.intruder==='thief'&&v.stolen){const d=v.door||v.pos,st=J.stacks.find(s=>Math.hypot(s.x-d[0],s.y-d[1])<120);if(st){st.vol+=v.stolen;st.value+=v.stolenVal||0}}}
 bumpProtect(quad?7:10);planProgress('handle',1);earn(250,'mandat i grzywna');
 mail(quad?'quad':'intruder',(quad?'Policja zatrzymała kierującego pojazdem w lesie':'Policja zatrzymała sprawcę (nocny intruz)')+' w '+odd(v.pos[0],v.pos[1])+'. Mandat i sprawa w sądzie, wpływ 250 zł.',{x:v.pos[0],y:v.pos[1]});
 p.rel=8;p.car.stopped=true;p.car.label='Policja — interwencja';
}
function updatePolice(dt){
 for(const p of POL){
  if(p.done)continue;
  const inc=p.inc;
  if(!p.car){
   p.wait-=dt;if(p.wait>0)continue;
   if(!open_(inc)||inc.ref.dead){p.done=true;continue}
   p.car=new Vehicle('police',{...ENTRY(rand()<.5)});p.car.beacon=true;p.car.label='radiowóz jedzie na interwencję';p.t=0;continue;
  }
  if(p.rel!=null){p.rel-=dt;if(p.rel<=0){const v=inc.ref;if(!v.dead){v.stopped=false;v.label='odjeżdża po interwencji';v.speedMul=.7;if(inc.type==='quad')v.goTo(goalNode(exitNode(v.pos[0])),{leave:true});else{const m=v.man;if(m){m.dead=true;v.man=null}v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}}policeLeave(p);p.rel=null}continue}
  const v=inc.ref,[cx,cy]=p.car.pos;
  if(!open_(inc)||v.dead){policeLeave(p,'Policja odjechała: sprawca już się oddalił albo sprawę zakończył patrol.');continue}
  const d=Math.hypot(cx-v.pos[0],cy-v.pos[1]);
  if(d<105){policeResolve(p);continue}
  p.t-=dt;if(p.t<=0||p.car.arrived){p.t=2.5;const rp=nearestRoad(v.pos[0],v.pos[1],['main','forest']);p.car.goTo({edge:rp.edge,s:rp.s},{park:false,pen:250})}
 }
 for(let i=POL.length-1;i>=0;i--)if(POL[i].done&&(!POL[i].car||POL[i].car.dead||POL[i].rel==null&&POL[i].car.leaving||true))POL.splice(i,1);
}

// ───────── fotopułapki, szlabany, parking ─────────
export function buyCams(){
 if(camsOn()){toast('Fotopułapki już działają.');return}
 if(!canAfford(COSTS.cams))return;pay(COSTS.cams,'fotopułapki przy wjazdach');ECO.ord.cams=true;
 toast('Fotopułapki zamontowane przy wjazdach: nielegalne wjazdy i wysypiska są zgłaszane od razu, a sprawców karze mandat z nagrania ('+zl(COSTS.camsDay)+' dziennie).');
}
export function toggleBarriers(){
 ECO.ord.bar=!ECO.ord.bar;
 toast(ECO.ord.bar?'Szlabany zamknięte: o połowę mniej nielegalnych wjazdów'+(parkingOn()?'.':', ale grzybiarzy i spacerowiczów też będzie mniej. Parking leśny przy szosie to zmniejsza.'):'Szlabany otwarte.');
}
export function buyParking(){
 if(parkingOn()){toast('Parking leśny już stoi.');return}
 if(!canAfford(COSTS.parking))return;pay(COSTS.parking,'parking leśny z koszem');ECO.ord.parking=true;
 const P=PARKING;for(const t of treesIn(P.x-14,P.y-14,P.x+P.w+14,P.y+P.h+14).slice())if(t.x>P.x-8&&t.x<P.x+P.w+8&&t.y>P.y-8&&t.y<P.y+P.h+8)removeTree(t);
 toast('Parking leśny z koszem gotowy przy szosie: odwiedzający zostawiają mniej śmieci, a przy zamkniętych szlabanach nadal mają gdzie zaparkować ('+zl(COSTS.parkingDay)+' dziennie za wywóz kosza).');
}
export const ordDaily=()=>(ECO.ord.cams?COSTS.camsDay:0)+(ECO.ord.parking?COSTS.parkingDay:0);

// ───────── pętla ─────────
const O={day:-1,dumpAt:null};
export function updateOrder(dt){
 const day=Math.floor(state.days),se=cal.season();
 if(day!==O.day){O.day=day;O.dumpAt=state.days>7&&rand()<(se===3?.08:.2)*illegalFactor()?day+(19.5+rand()*4)/24:null}
 if(O.dumpAt&&state.days>=O.dumpAt){O.dumpAt=null;spawnDump()}
 for(const t of E.trash){
  if(t.kind!=='dump'||t.dead||t.inc)continue;
  t.t+=dt;if(t.t>t.report)t.inc=report('dump',t.x,t.y,'Dzikie wysypisko w '+odd(t.x,t.y)+' — ktoś wywiózł do lasu odpady. Potrzebny wywóz ('+zl(COSTS.waste)+').',t);
 }
 if(!W.cur&&W.q.length&&cal.work(7,16)){const inc=W.q.shift();if(inc.status==='queued'&&!inc.ref.dead)startWaste(inc)}
 if(W.cur&&(W.cur.truck.dead)){W.cur.inc.status='new';W.cur=null}
 updatePolice(dt);
}
HK.waste=orderWaste;

// ───────── rysowanie ─────────
const armCache=new Map();
function closedArm(b){
 let a=armCache.get(b);
 if(!a){const rp=nearestRoad(b.x,b.y,['forest']),c=pointOn(rp.edge,rp.s),dx=c[0]-b.x,dy=c[1]-b.y,d=Math.hypot(dx,dy)||1;a={x2:b.x+dx/d*(d+22),y2:b.y+dy/d*(d+22)};armCache.set(b,a)}
 return a;
}
export function drawOrder(c,winter){
 if(ECO.ord.bar)for(const b of BARRIERS){
  const a=closedArm(b);line(c,b.x,b.y-3,a.x2,a.y2-3,'#e9e7de',4);
  const L=Math.hypot(a.x2-b.x,a.y2-b.y),n=Math.max(1,Math.floor(L/6));
  for(let k=0;k<n;k+=2){const t0=k/n,t1=Math.min(1,(k+1)/n);line(c,b.x+(a.x2-b.x)*t0,b.y-3+(a.y2-b.y)*t0,b.x+(a.x2-b.x)*t1,b.y-3+(a.y2-b.y)*t1,'#c2362b',4)}
 }
 if(ECO.ord.cams)for(const b of CAM_SPOTS){
  const x=Math.round(b.x),y=Math.round(b.y)-4;rect(c,x-1,y-10,3,12,'#2c3a32');rect(c,x-5,y-18,11,8,'#14201a');rect(c,x-4,y-17,9,6,'#7d8a82');rect(c,x-4,y-17,9,1,'#a9b5ad');rect(c,x-1,y-15,4,3,'#14201a');rect(c,x,y-14,2,1,'#5d8790');
  if(Math.floor(performance.now()/700)%2)rect(c,x+3,y-17,2,2,'#ff4a3a');
 }
 if(ECO.ord.parking){
  const P=PARKING;rect(c,P.x,P.y,P.w,P.h,'#8b826c');rect(c,P.x+2,P.y+2,P.w-4,P.h-4,'#a39a82');
  for(let x=P.x+10;x<P.x+P.w-34;x+=26){rect(c,x,P.y+8,1,28,'#e9e7de')}rect(c,P.x+P.w-34,P.y+8,1,28,'#e9e7de');
  rect(c,P.x+P.w-22,P.y+P.h-20,14,12,'#14201a');rect(c,P.x+P.w-21,P.y+P.h-19,12,10,'#3f8a52');rect(c,P.x+P.w-21,P.y+P.h-19,12,2,'#5fae72');   // kosz
  rect(c,P.x+4,P.y-14,12,12,'#14201a');rect(c,P.x+5,P.y-13,10,10,'#2f5ea8');rect(c,P.x+9,P.y-11,2,6,'#f1e6c2');rect(c,P.x+9,P.y-11,4,2,'#f1e6c2');rect(c,P.x+9,P.y-8,4,2,'#f1e6c2');rect(c,P.x+10,P.y-2,1,4,'#14201a');
  if(winter){rect(c,P.x,P.y,P.w,P.h,'#eaf0f655')}
 }
}
export const CAM_COUNT=CAM_SPOTS.length;
