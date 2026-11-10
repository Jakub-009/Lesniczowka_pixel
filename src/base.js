// Leśniczówka jako baza (0.5): kancelaria z petentami (drewno opałowe, zezwolenia, sadzonki, zgłoszenia),
// szkółka leśna, garaż z magazynem, kadry (podleśniczy, druga ekipa) i sprzęt. Panel otwiera klawisz L albo klik w dom.
import {state,cal,toast,zl,displayNumber,clamp,SEASONS} from './core.js';
import {DOOR,EDGES,NURSERY,CARPORT,YARD,inRect,oddzial} from './map.js';
import {goalNode,ENTRY,exitNode} from './roads.js';
import {E} from './ents.js';
import {Vehicle,Ped,rand} from './life/agents.js';
import {pileTop} from './life/sprites.js';
import {outlinedDraw,text3} from './sprite.js';
import {trees,treesIn,removeTree} from './forest.js';
import {ECO,pay,earn,canAfford,bumpProtect} from './economy.js';
import {J,COST,PRICE,opalStack,takeFromStack,hireCrewB,fireCrewB,buyForwarder,MACH} from './jobs.js';
import {U,hirePod,firePod,report} from './incidents.js';
import {sfx} from './sound.js';

export const BASE={nursery:false,garage:false,queue:[],next:0,opalPiles:[],stats:{visits:0,opal:0,opalVol:0,permits:0,seedlings:0,missed:0},log:[]};
export const BUILD={nursery:5000,garage:4500};
const VIS_EDGE=EDGES.find(e=>e.a==='a3'&&e.b==='l1');
const pickA=a=>a[Math.floor(rand()*a.length)];
const CAR_COLS=['#8c9b95','#a4684f','#6f86a0','#b9a56a','#7a8f6f','#a8a6a0','#5a5f6a'];
const note=t=>{BASE.log.unshift(t);BASE.log.length=Math.min(BASE.log.length,6)};
export function initBase(){
 ECO.feedCost=120;ECO.fireStaff=()=>{if(firePod())ECO.staff.pod=false};
 if(!ECO.seasonHooks.includes(nurseryHook))ECO.seasonHooks.push(nurseryHook);
}
// plan produkcji szkółki (0.6.2): z jakich gatunków powstają sadzonki
export const NPLANS=[{name:'sosna (bór)',w:{sosna:1}},{name:'sosna z brzozą',w:{sosna:.75,brzoza:.25}},{name:'liściaste: dąb i buk',w:{dab:.5,buk:.5}},{name:'świerk i buk',w:{swierk:.6,buk:.4}},{name:'mieszane',w:{sosna:.4,swierk:.15,dab:.15,buk:.15,brzoza:.15}}];
export function nurseryFix(){const N=ECO.nursery;if(N&&!N.sp)N.sp={sosna:N.stock||0}}
export function cycleNursery(){BASE.nplan=((BASE.nplan||0)+1)%NPLANS.length;toast('Szkółka będzie produkować: '+NPLANS[BASE.nplan].name+' (od następnej pory roku).')}
export const nurseryText=()=>{nurseryFix();const N=ECO.nursery;if(!N)return'—';const SPN={sosna:'so',swierk:'św',dab:'db',buk:'bk',brzoza:'brz'};return Object.entries(N.sp).filter(([,v])=>v>0).map(([k,v])=>SPN[k]+' '+v).join(' · ')||'pusto'};
function nurseryHook(){
 if(!BASE.nursery||!ECO.nursery)return null;
 if(cal.season()===3)return{nursery:0};
 const add=Math.min(400,1200-ECO.nursery.stock),W=NPLANS[BASE.nplan||0].w;nurseryFix();
 for(const k in W){const n=Math.round(add*W[k]);ECO.nursery.sp[k]=(ECO.nursery.sp[k]||0)+n}
 ECO.nursery.stock=Object.values(ECO.nursery.sp).reduce((a,b)=>a+b,0);return{nursery:add};
}
// ── budowy i kadry ──
export function buildNursery(){
 if(BASE.nursery)return;if(!canAfford(BUILD.nursery))return;
 pay(BUILD.nursery,'budowa szkółki leśnej');BASE.nursery=true;ECO.nursery={stock:200,sp:{sosna:200}};
 for(const t of treesIn(NURSERY.x-12,NURSERY.y-12,NURSERY.x+NURSERY.w+12,NURSERY.y+NURSERY.h+12).slice())if(inRect(t.x,t.y,NURSERY,10))removeTree(t);
 toast('Szkółka leśna gotowa: 200 sadzonek, potem ok. 400 na sezon (bez zimy). Sadzonki ze szkółki kosztują 1 zł i lepiej się przyjmują.');
}
export function buildGarage(){
 if(BASE.garage)return;if(!canAfford(BUILD.garage))return;
 pay(BUILD.garage,'budowa garażu z magazynem');BASE.garage=true;ECO.feedCost=70;
 toast('Garaż z magazynem gotowy: miejsce na drugi samochód (podleśniczy) i tańsza karma w paśnikach ('+zl(70)+').');
}
export function hireDeputy(){
 if(ECO.staff.pod){toast('Podleśniczy już pracuje.');return}
 if(!BASE.garage){toast('Najpierw zbuduj garaż z magazynem — podleśniczy potrzebuje miejsca na terenówkę.');return}
 if(!canAfford(COST.pod*5))return;
 ECO.staff.pod=true;hirePod();toast('Zatrudniono podleśniczego ('+zl(COST.pod)+' dziennie): drugi patrol i obsługa kancelarii.');
}
export function fireDeputy(){if(!ECO.staff.pod)return;if(firePod()){ECO.staff.pod=false;toast('Podleśniczy odszedł z leśnictwa.')}}

// ── kancelaria: petenci w dni powszednie 8–15 ──
function spawnVisitor(){
 const busy=BASE.queue.length+E.people.filter(p=>p.petent&&!p.dead).length;if(busy>=2)return;
 const se=cal.season(),r=rand(),nur=BASE.nursery&&ECO.nursery.stock>=120;
 const kind=r<[.3,.15,.5,.55][se]?'opal':r<.62?'permit':nur&&r<.82?'seed':'report';
 const w=rand()<.5,v=new Vehicle('car',{...ENTRY(w),color:pickA(CAR_COLS)});v.label='petent jedzie do kancelarii';
 const s=VIS_EDGE.len-36-(E.vehicles.filter(q=>q.petentCar&&!q.dead).length%3)*44;v.petentCar=true;
 v.goTo({edge:VIS_EDGE,s},{park:true,onArrive:car=>{
  const h=car.heading,cx=car.pos[0]+Math.sin(h)*16,cy=car.pos[1]-Math.cos(h)*16;
  const p=new Ped({kind:'walker',x:cx,y:cy,speed:12,coat:pickA(['#6a5a8a','#8a6a4a','#4a6a8a','#7a4a4a','#5a7a5a']),cap:pickA(['#e8e4dc','#3a3a3a','#6b4a2e'])});
  p.label={opal:'petent — po drewno opałowe',permit:'petent — po zezwolenie',seed:'petent — po sadzonki',report:'petent — ze zgłoszeniem'}[kind];p.petent=kind;p.car=car;p.waitT=0;
  car.label='samochód petenta';
  p.run([{go:[566,300]},{go:[DOOR[0]+16+BASE.queue.length*10,DOOR[1]+18]},{call:q=>{BASE.queue.push(q);sfx('door')}},{wait:9999,pose:'stand',face:[DOOR[0],DOOR[1]],until:q=>q.done}]);
 }});
}
function leave(p,msg){
 p.done=true;BASE.queue=BASE.queue.filter(q=>q!==p);if(msg)note(msg);
 p.run([{go:[566,300]},{go:p.car.dead?[600,300]:[p.car.pos[0]+Math.sin(p.car.heading)*16,p.car.pos[1]-Math.cos(p.car.heading)*16]},{call:q=>{q.dead=true;if(!p.car.dead){p.car.label='petent odjeżdża';p.car.goTo(goalNode(exitNode(rand()*3600)),{leave:true})}}}]);
}
function serve(u,p){
 const r=u.person;p.serving=u;r.busyOffice=true;r.hidden=false;
 r.run([{go:[DOOR[0],DOOR[1]+8]},{wait:7,pose:'talk',face:[p.x,p.y]},{call:()=>{r.busyOffice=false;deal(u,p)}}]);
}
function deal(u,p){
 BASE.stats.visits++;
 const k=p.petent;
 if(k==='opal'){
  // chce 2–5 m³; jeśli przy drogach jest mniej, bierze co jest (min. 1 m³)
  const want=2+Math.floor(rand()*4),best=J.stacks.filter(q=>q.sort==='opal'&&q!==J.truck.cur&&!J.truck.route.includes(q)).sort((a,b)=>b.vol-a.vol)[0],st=opalStack(want)||(best&&best.vol>=1.2?best:null),vol=st?Math.min(want,st.vol-.2):want;
  if(!st){note('Brak drewna opałowego przy drogach — petent odszedł z niczym.');toast('Petent chciał '+want+' m³ drewna opałowego, ale przy drogach nie ma stosów opału (powstają z krzywych drzew, wierzchołków i trzebieży).');leave(p);return}
  const {q,val}=takeFromStack(st,vol),price=Math.round(q*PRICE.opal);earn(price,'sprzedaż drewna opałowego');
  BASE.stats.opal++;BASE.stats.opalVol+=q;
  BASE.opalPiles.push({x:st.x+st.ax*26,y:st.y+st.ay*26,a:Math.atan2(st.ay,st.ax),vol:q,logs:clamp(Math.round(q*1.5),2,6),bark:'#7a5a3e',sp:'sosna',edge:st.edge,s:clamp(st.s+26,30,st.edge.len-30),day:state.days,odd:st.odd});
  toast('Kancelaria: sprzedano '+displayNumber(q,1)+' m³ drewna opałowego za '+zl(price)+'. Nabywca odbierze je spod stosu w oddz. '+st.odd+'.');
  note('Sprzedaż opału: '+displayNumber(q,1)+' m³ ('+zl(price)+')');
 }else if(k==='permit'){earn(40,'zezwolenie (wjazd / zbiór chrustu)');BASE.stats.permits++;note('Wydano zezwolenie (40 zł)');toast('Kancelaria: wydano zezwolenie na zbiór chrustu — 40 zł.')}
 else if(k==='seed'){nurseryFix();const n=Math.min(100,ECO.nursery.stock-20);let left=n;for(const k2 of Object.keys(ECO.nursery.sp).sort((a,b)=>ECO.nursery.sp[b]-ECO.nursery.sp[a])){const d=Math.min(left,ECO.nursery.sp[k2]);ECO.nursery.sp[k2]-=d;left-=d}ECO.nursery.stock-=n;earn(Math.round(n*1.8),'sprzedaż sadzonek ze szkółki');BASE.stats.seedlings+=n;note('Sprzedano '+n+' sadzonek');toast('Kancelaria: sprzedano '+n+' sadzonek ze szkółki ('+zl(Math.round(n*1.8))+').')}
 else{
  const t=E.trash.find(q=>!q.dead&&!q.fire&&!q.inc);
  if(t){t.inc=report('trash',t.x,t.y,(t.kind==='snare'?'Petent zgłasza wnyki':'Petent zgłasza śmieci')+' w oddz. '+oddzial(t.x,t.y)+'.',t);note('Zgłoszenie od petenta')}
  else{bumpProtect(.5);note('Petent pytał o grzyby i szlaki');toast('Kancelaria: petent pytał o szlaki i grzyby — dobra rozmowa o lesie.')}
 }
 leave(p);
}
// Odbiór opału: ciągnik z przyczepą przyjeżdża pod stos i ładuje drewno.
function pickup(o){
 o.coming=true;const w=rand()<.5,v=new Vehicle('tractor',ENTRY(w));v.cap=6;v.load=0;v.label='odbiór drewna opałowego';
 v.goTo({edge:o.edge,s:o.s},{park:true,onArrive:car=>{
  const h=car.heading,p=new Ped({kind:'walker',x:car.pos[0]-Math.sin(h)*30,y:car.pos[1]+Math.cos(h)*30,speed:12,coat:'#5a6a4a',cap:'#3a3a3a'});p.label='rolnik ładuje opał';
  car.label='ładowanie drewna opałowego';const v0=o.vol;
  p.run([{go:[o.x-8,o.y]},{wait:28,pose:'kneel',face:[o.x,o.y],tick:(q,dt)=>{const d=Math.min(o.vol,dt*v0/28);o.vol-=d;car.load=Math.min(car.cap,car.load+d*1.4);o.logs=clamp(Math.ceil(o.vol*1.5),0,6)}},
   {go:[car.pos[0]-Math.sin(h)*30,car.pos[1]+Math.cos(h)*30]},{call:q=>{q.dead=true;o.dead=true;car.label='rolnik odjeżdża z opałem';car.goTo(goalNode(exitNode(rand()*3600)),{leave:true})}}]);
 }});
}
const atHome=u=>u.phase==='home'&&!u.person.sleeping&&!u.person.busyOffice&&!u.person.dead;
export function updateBase(dt){
 const h=cal.hour(),weekday=cal.dow()<5,open=weekday&&h>=8&&h<15;
 if(open){BASE.next-=dt;if(BASE.next<=0){BASE.next=70+rand()*110;spawnVisitor()}}
 else if(BASE.next<5)BASE.next=5+rand()*40;
 // obsługa kolejki
 for(const p of BASE.queue){
  if(p.dead||p.done)continue;p.waitT+=dt;
  if(p.serving&&!p.serving.person.busyOffice&&!p.done){p.serving=null}
  if(!p.serving){const u=U.find(atHome);if(u&&!cal.night())serve(u,p)}
  if(!p.serving&&p.waitT>50){BASE.stats.missed++;toast('Petent odszedł spod kancelarii — nikogo nie było (leśniczy w terenie).');leave(p,'Petent nie zastał nikogo')}
 }
 BASE.queue=BASE.queue.filter(p=>!p.dead&&!p.done);
 // odbiory opału w godzinach 9–17 (pon.–sob.)
 for(const o of BASE.opalPiles)if(!o.coming&&cal.work(9,16)&&state.days-o.day>.08)pickup(o);
 BASE.opalPiles=BASE.opalPiles.filter(o=>!o.dead);
}
// ── rysowanie: szkółka, garaż z magazynem, opał do odbioru ──
const R_=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
export function drawBase(g){
 if(BASE.nursery){
  const N=NURSERY,f=ECO.nursery?clamp(ECO.nursery.stock/1200,0,1):0,snow=cal.season()===3;
  R_(g,N.x-3,N.y-3,N.w+6,N.h+6,'#6e5a42');R_(g,N.x,N.y,N.w,N.h,snow?'#dfe6e8':'#7a6248');
  for(let r=0;r<6;r++){const y=N.y+6+r*12;R_(g,N.x+6,y,N.w-12,8,snow?'#cfd8da':'#5e4a36');
   const n=Math.round((N.w-16)/5*clamp(f*3-r*.1,0,1));for(let k=0;k<n;k++){R_(g,N.x+8+k*5,y+2,3,4,snow?'#7a9a7a':'#3f744c');R_(g,N.x+9+k*5,y+2,1,2,'#7fb06a')}}
  g.strokeStyle='#c4ccc8';g.lineWidth=1;g.strokeRect(N.x-3.5,N.y-3.5,N.w+7,N.h+7);
  outlinedDraw(g,N.x+N.w-28,N.y-6,G=>{R_(G,-1,-2,2,8,'#6b563d');R_(G,-16,-10,32,9,'#2f5a3a');text3(G,'SZKÓŁKA',-14,-8,'#f1e6c2')},'#1d2b24');
 }
 if(BASE.garage){
  const C=CARPORT;R_(g,C.x+6,C.y+6,C.w,C.h,'#2b3b2a50');
  R_(g,C.x,C.y,C.w,C.h,'#4a3a2c');R_(g,C.x+2,C.y+2,C.w-4,C.h-4,'#8a7660');
  for(let x=C.x+4;x<C.x+C.w-4;x+=8)R_(g,x,C.y+4,1,C.h-14,'#7a6650');
  R_(g,C.x,C.y+C.h-8,C.w,8,'#5e4a36');
  for(const dx of [10,58])R_(g,C.x+dx,C.y+C.h-7,40,7,'#9aa29d'),R_(g,C.x+dx,C.y+C.h-5,40,1,'#6d7470'),R_(g,C.x+dx,C.y+C.h-3,40,1,'#6d7470');
  R_(g,C.x+C.w/2-17,C.y+18,34,9,'#2f5a3a');text3(g,'MAGAZYN',C.x+C.w/2-14,C.y+20,'#f1e6c2');
 }
 for(const o of BASE.opalPiles)if(o.vol>.05)pileTop(g,o);
}
export const opalPileAt=(x,y)=>BASE.opalPiles.find(o=>Math.hypot(o.x-x,o.y-y)<16);
export {BUILD as BUILD_COST};
