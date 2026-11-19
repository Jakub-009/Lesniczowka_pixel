// Leśniczówka jako baza (0.5): kancelaria z petentami (drewno opałowe, zezwolenia, sadzonki, zgłoszenia),
// szkółka leśna, garaż z magazynem, kadry (podleśniczy, druga ekipa) i sprzęt. Panel otwiera klawisz L albo klik w dom.
import {state,cal,toast,zl,displayNumber,clamp,SEASONS,pf} from './core.js';
import {DOOR,EDGES,NURSERY,CARPORT,GARAGE,YARD,inRect,oddzial} from './map.js';
import {drawGarage} from './lodge.js';
import {goalNode,ENTRY,exitNode} from './roads.js';
import {E} from './ents.js';
import {Vehicle,Ped,rand} from './life/agents.js';
import {pileTop} from './life/sprites.js';
import {outlinedDraw,text3} from './sprite.js';
import {trees,treesIn,removeTree} from './forest.js';
import {ECO,pay,earn,canAfford,bumpProtect,ledCount} from './economy.js';
import {J,COST,PRICE,opalStack,takeFromStack,buyForwarder,MACH,truckBusy} from './jobs.js';
import {U,hirePod,firePod,report} from './incidents.js';
import {HK2,chrustNear} from './life/populate.js';
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
// 1.3.0: szkółka bez planu produkcji — jeden wspólny zapas sadzonek wszystkich gatunków (ze szkółki taniej, bez niej drożej).
// Zapis sprzed 1.3.0 miał zapas osobno dla gatunków (N.sp) — sumujemy go.
export function nurseryFix(){const N=ECO.nursery;if(!N)return;if(N.sp){N.stock=Object.values(N.sp).reduce((a,b)=>a+(b||0),0);delete N.sp}N.stock=Math.max(0,Math.round(N.stock||0))}
export const nurseryText=()=>{nurseryFix();const N=ECO.nursery;return N?N.stock+' sadzonek':'—'};
function nurseryHook(){
 if(!BASE.nursery||!ECO.nursery)return null;
 if(cal.season()===3)return{nursery:0};
 nurseryFix();const add=Math.max(0,Math.min(400,1200-ECO.nursery.stock));ECO.nursery.stock+=add;return{nursery:add};
}
// ── budowy i kadry ──
export function buildNursery(){
 if(BASE.nursery)return;if(!canAfford(BUILD.nursery))return;
 pay(BUILD.nursery,'budowa szkółki leśnej');BASE.nursery=true;ECO.nursery={stock:200};
 for(const t of treesIn(NURSERY.x-12,NURSERY.y-12,NURSERY.x+NURSERY.w+12,NURSERY.y+NURSERY.h+12).slice())if(inRect(t.x,t.y,NURSERY,10))removeTree(t);
 toast('Szkółka jest gotowa. Na start daje 200 sadzonek, a potem około 400 na każdą porę roku (z wyjątkiem zimy).');
}
export function buildGarage(){
 if(BASE.garage)return;if(!canAfford(BUILD.garage))return;
 pay(BUILD.garage,'budowa garażu z magazynem');BASE.garage=true;ECO.feedCost=70;
 toast('Garaż z magazynem jest gotowy. Karma do paśników kosztuje teraz '+zl(70)+'.');
}
export function hireDeputy(){
 if(ECO.staff.pod){toast('Podleśniczy już pracuje w leśnictwie.');return}
 if(!BASE.garage){toast('Najpierw zbuduj garaż — podleśniczy potrzebuje drugiej terenówki.');return}
 if(!canAfford(COST.pod*5))return;
 ECO.staff.pod=true;hirePod();toast('Zatrudniono podleśniczego. Jego pensja wynosi '+zl(COST.pod)+' dziennie.');
}
export function fireDeputy(){if(!ECO.staff.pod)return;if(firePod()){ECO.staff.pod=false;toast('Podleśniczy odszedł z leśnictwa.')}}

// ── kancelaria: petenci w dni powszednie 8–15 ──
function spawnVisitor(){
 const busy=BASE.queue.length+E.people.filter(p=>p.petent&&!p.dead).length;if(busy>=2)return;
 const se=cal.season(),r=rand(),nur=BASE.nursery&&ECO.nursery.stock>=120;
 const kind=r<[.3,.15,.5,.55][se]?'opal':r<.62?'permit':nur&&r<.82?'seed':'report';
 // 1.4.0: po zezwolenie na chrust przyjeżdża się osobówką z przyczepką, gdy przy drogach leży chrust (zbierze go od razu)
 const chr=kind==='permit'&&!ECO.ord.bar&&chrustNear().length>0;
 const w=rand()<.5,v=new Vehicle(chr?'carT':'car',{...ENTRY(w),color:pickA(CAR_COLS)});v.label='petent jedzie do kancelarii';v.pub=true;
 const s=VIS_EDGE.len-36-(E.vehicles.filter(q=>q.petentCar&&!q.dead).length%2)*52;v.petentCar=true;
 v.goTo({edge:VIS_EDGE,s},{park:true,onArrive:car=>{
  const h=car.heading,cx=car.pos[0]+Math.sin(h)*16,cy=car.pos[1]-Math.cos(h)*16;
  const p=new Ped({kind:'walker',x:cx,y:cy,speed:12,coat:pickA(['#6a5a8a','#8a6a4a','#4a6a8a','#7a4a4a','#5a7a5a']),cap:pickA(['#e8e4dc','#3a3a3a','#6b4a2e'])});
  p.label={opal:'petent — po drewno opałowe',permit:'petent — po zezwolenie',seed:'petent — po sadzonki',report:'petent — ze zgłoszeniem'}[kind];p.petent=kind;p.car=car;p.waitT=0;
  car.label='samochód petenta';
  p.run([{go:[YARD.x+YARD.w+6,(YARD.gate[0]+YARD.gate[1])/2]},{go:[DOOR[0]+16+BASE.queue.length*10,DOOR[1]+18]},{call:q=>{BASE.queue.push(q);sfx('door')}},{wait:9999,pose:'stand',face:[DOOR[0],DOOR[1]],until:q=>q.done}]);
 }});
}
function leave(p,msg){
 p.done=true;BASE.queue=BASE.queue.filter(q=>q!==p);if(msg)note(msg);
 p.run([{go:[YARD.x+YARD.w+6,(YARD.gate[0]+YARD.gate[1])/2]},{go:p.car.dead?[YARD.x+YARD.w+40,(YARD.gate[0]+YARD.gate[1])/2]:[p.car.pos[0]+Math.sin(p.car.heading)*16,p.car.pos[1]-Math.cos(p.car.heading)*16]},{call:q=>{q.dead=true;if(!p.car.dead&&p.permit&&p.car.kind==='carT'&&HK2.chrust&&HK2.chrust(p.car))return;if(!p.car.dead){p.car.label='petent odjeżdża';HK2.leave?HK2.leave(p.car,rand()*3600):p.car.goTo(goalNode(exitNode(rand()*3600)),{leave:true})}}}]);
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
  const want=2+Math.floor(rand()*4),best=J.stacks.filter(q=>q.sort==='opal'&&!truckBusy(q)).sort((a,b)=>b.vol-a.vol)[0],st=opalStack(want)||(best&&best.vol>=1.2?best:null),vol=st?Math.min(want,st.vol-.2):want;
  if(!st){note('Przy drogach zabrakło opału — petent odszedł z niczym');toast('Petent chciał kupić '+want+' m³ opału, ale przy drogach nie ma stosów drewna opałowego.');leave(p);return}
  const {q,val}=takeFromStack(st,vol),price=Math.round(q*PRICE.opal);earn(price,'sprzedaż drewna opałowego');ledCount('opal',q);
  BASE.stats.opal++;BASE.stats.opalVol+=q;if(ECO.st)ECO.st.opal=(ECO.st.opal||0)+q;   // 1.1.2 (U04): osobno w raporcie sezonu
  BASE.opalPiles.push({x:st.x+st.ax*26,y:st.y+st.ay*26,a:Math.atan2(st.ay,st.ax),vol:q,logs:clamp(Math.round(q*1.5),2,6),bark:'#7a5a3e',sp:'sosna',edge:st.edge,s:clamp(st.s+26,30,st.edge.len-30),day:state.days,odd:st.odd});
  toast('Kancelaria: sprzedano '+displayNumber(q,1)+' m³ opału za '+zl(price)+'. Nabywca odbierze drewno w oddz. '+st.odd+'.');
  note('Sprzedaż opału: '+displayNumber(q,1)+' m³ ('+zl(price)+')');
 }else if(k==='permit'){p.permit=true;earn(40,'zezwolenie (wjazd / zbiór chrustu)');BASE.stats.permits++;note('Wydano zezwolenie (40 zł)');toast('Kancelaria: wydano zezwolenie na zbiór chrustu (40 zł).'+(chrustNear().length&&!ECO.ord.bar?' Petent pojedzie po chrust leżący przy drodze.':''))}
 else if(k==='seed'){nurseryFix();const n=Math.min(100,ECO.nursery.stock-20);ECO.nursery.stock-=n;earn(Math.round(n*1.8),'sprzedaż sadzonek ze szkółki');BASE.stats.seedlings+=n;note('Sprzedano '+pf(n,'sadzonkę','sadzonki','sadzonek'));toast('Kancelaria: sprzedano '+pf(n,'sadzonkę','sadzonki','sadzonek')+' ze szkółki za '+zl(Math.round(n*1.8))+'.')}
 else{
  const t=E.trash.find(q=>!q.dead&&!q.fire&&!q.inc);
  if(t){t.inc=report('trash',t.x,t.y,(t.kind==='snare'?'Petent zgłasza wnyki':'Petent zgłasza śmieci')+' w oddz. '+oddzial(t.x,t.y)+'.',t);note('Zgłoszenie od petenta')}
  else{bumpProtect(.5,'rozmowa w kancelarii');note('Petent pytał o grzyby i szlaki');toast('Kancelaria: petent pytał o szlaki i miejsca na grzyby.')}
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
  if(!p.serving&&p.waitT>50){BASE.stats.missed++;toast('Petent odszedł, bo nikogo nie było w kancelarii.');leave(p,'Petent nie zastał nikogo w kancelarii')}
 }
 BASE.queue=BASE.queue.filter(p=>!p.dead&&!p.done);
 // odbiory opału w godzinach 9–17 (pon.–sob.)
 for(const o of BASE.opalPiles){if(!o.coming&&cal.work(9,16)&&state.days-o.day>.08)pickup(o);
  // 0.9: kupka nie zalega w nieskończoność — po ok. 2,5 dnia nabywca odbiera ją na własną rękę (koniec zawieszonych kupek przy drogach)
  if(state.days-o.day>2.5)o.dead=true}
 BASE.opalPiles=BASE.opalPiles.filter(o=>!o.dead);
}
// ── rysowanie: szkółka, garaż z magazynem, opał do odbioru ──
const R_=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
export function drawBase(g){
 {   // szkółka na podwórzu (0.7.2): grządki z sadzonkami i tunel foliowy; przed zakupem tylko wygrodzona, przekopana ziemia
  const N=NURSERY,own=BASE.nursery,f=own&&ECO.nursery?clamp(ECO.nursery.stock/1200,0,1):0,snow=cal.season()===3;
  R_(g,N.x-3,N.y-3,N.w+6,N.h+6,'#5d4a36');R_(g,N.x,N.y,N.w,N.h,snow?'#e3eaed':'#6f5740');
  if(own){
   const bw=N.w-52;
   for(let r=0;r<6;r++){const y=N.y+5+r*16;R_(g,N.x+5,y,bw,10,snow?'#d2dce0':'#5a4531');
    const n=Math.round((bw-6)/5*clamp(f*3-r*.1,0,1));for(let k=0;k<n;k++){R_(g,N.x+7+k*5,y+2,3,6,snow?'#7a9a7a':'#3f744c');R_(g,N.x+8+k*5,y+2,1,3,'#7fb06a')}}
   // tunel foliowy z łukowymi żebrami
   const tx=N.x+N.w-44,ty=N.y+5,th=N.h-10;R_(g,tx-2,ty-2,40,th+4,'#00000030');R_(g,tx,ty,36,th,snow?'#f1f6f9':'#d8e6e2');
   g.globalAlpha=.55;R_(g,tx+3,ty+2,30,th-4,snow?'#ffffff':'#e8f2ee');g.globalAlpha=1;
   for(let y=ty;y<ty+th;y+=9)R_(g,tx,y,36,1,snow?'#c3d0d8':'#a9bdb6');R_(g,tx+17,ty,2,th,snow?'#ffffff':'#f4faf7');
   if(!snow)for(let k=0;k<4;k++)R_(g,tx+6+k*7,ty+th-6,4,5,'#4a8a50');
   R_(g,tx,ty,2,th,'#8a9a96');R_(g,tx+34,ty,2,th,'#8a9a96');
  }
  g.strokeStyle='#8a6a48';g.lineWidth=1;g.strokeRect(N.x-3.5,N.y-3.5,N.w+7,N.h+7);
  outlinedDraw(g,N.x+34,N.y-4,G=>{R_(G,-1,-2,2,8,'#6b563d');R_(G,-16,-10,32,9,'#2f5a3a');text3(G,'SZKÓŁKA',-14,-8,'#f1e6c2')},'#1d2b24');
 }
 if(BASE.garage)drawGarage(g,cal.season()===3);
 else{const G=GARAGE;for(const [x,y] of [[G.x,G.y],[G.x+G.w,G.y],[G.x,G.y+G.h],[G.x+G.w,G.y+G.h]]){R_(g,x-1,y-6,2,8,'#c9a574');R_(g,x-1,y-6,2,2,'#d8452c')}
  g.strokeStyle='#e8e0c8';g.setLineDash([3,3]);g.lineWidth=1;g.strokeRect(G.x+.5,G.y+.5,G.w,G.h);g.setLineDash([])}
 for(const o of BASE.opalPiles)if(o.vol>.05)pileTop(g,o);
}
export const opalPileAt=(x,y)=>BASE.opalPiles.find(o=>Math.hypot(o.x-x,o.y-y)<16);
export {BUILD as BUILD_COST};
