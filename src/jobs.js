// Prace leśne (0.5): wyznaczanie drzew, ekipy pilarzy A i B (ścinka, wyrzynka, sadzenie), zrywka szlakami do stosów przy drogach,
// ciężarówka z żurawiem (HDS) objeżdżająca stosy. Wszystko jeździ samo — gracz wydaje polecenia i pilnuje budżetu.
import {state,toast,particle,clamp,zl,displayNumber,ctx,cal,rect} from './core.js';
import {PLAC,PLAC_SPOTS,roadClearance,oddzial,inRect,YARD,pointBlocked,NODES,EDGES,ptAt} from './map.js';
import {nearestRoad,goalNode,edgeOf,pointOn,ENTRY,exitNode} from './roads.js';
import {paintRut} from './paint.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,rand,cartRear,cartFront} from './life/agents.js';
import {trees,STAND,STUMP,CUT_AGE,THIN_AGE,SP,startFall,finishTree,plantTree,volume,crownR,speciesFor,treesIn,SAPLING_AGE,sortSplit,SORTS} from './forest.js';
import {pay,earn,planProgress,stat,canAfford,ECO} from './economy.js';
import {sfx} from './sound.js';
import {pileTop} from './life/sprites.js';

// Koszty (0.5 — wyższe, żeby budżet był wyzwaniem): ścinka za drzewo, sadzonka, zrywka za m³, pensje i utrzymanie dziennie.
export const COST={fell:110,plant:4,plantNursery:1,skid:40,crewB:260,pod:220,fwd:140};
export const PRICE={opal:180};
const newCrew=id=>({id,van:null,phase:'idle',tasks:[],cluster:[],workers:[],held:[],odd:''});
export const J={plants:[],trails:[],crews:[newCrew('A')],
 skid:{trac:null,phase:'idle',mach:'tractor',list:[],cur:null,wait:0,watch:0,owned:false},
 truck:{v:null,phase:'idle',pending:false,route:[],cur:null},stacks:[],nextStack:1,sold:0,auto:true};
export const stackTotal=(f)=>J.stacks.reduce((a,s)=>a+(!f||f(s)?s.vol:0),0);
export const stackValue=(f)=>J.stacks.reduce((a,s)=>a+(!f||f(s)?s.value:0),0);
// ciężarówka bierze tartaczne i papierówkę; opał zostaje dla ludności, chyba że gracz pozwoli
export const forTruck=s=>s.truck!==false;
export const truckTotal=()=>stackTotal(forTruck);

// ── polecenia gracza ──
export function birdBan(t){return cal.season()===0&&oddzial(t.x,t.y)==='103'}
export function toggleMark(t){
 if(!t||t.st!==STAND||t.falling||t.lying){return false}
 if(t.assigned){toast('To drzewo jest już w pracy ekipy.');return false}
 if(t.age<THIN_AGE){toast('Za młode nawet na trzebież ('+Math.round(t.age)+' lat) — zostaw je, niech rośnie.');return false}
 t.marked=!t.marked;sfx(t.marked?'mark':'unmark');
 if(t.marked&&birdBan(t))toast('Okres lęgowy ptaków: w oddz. 103 ekipa zetnie to drzewo dopiero latem.');
 return true;
}
export function canPlant(x,y){
 if(roadClearance(x,y)<8)return 'Nie sadzimy na drodze.';
 if(inRect(x,y,YARD,8)||pointBlocked(x,y,6))return 'Tu nie da się sadzić.';
 if(treesIn(x-12,y-12,x+12,y+12).some(t=>t.st===STAND&&Math.hypot(t.x-x,t.y-y)<(t.age<SAPLING_AGE?11:Math.max(10,crownR(t)*.4))))return 'Za blisko innego drzewa.';
 if(J.plants.some(p=>Math.hypot(p.x-x,p.y-y)<12))return 'Tu już jest zaplanowana sadzonka.';
 return null;
}
export function togglePlant(x,y){
 const ex=J.plants.find(p=>Math.hypot(p.x-x,p.y-y)<8&&!p.assigned);
 if(ex){J.plants=J.plants.filter(p=>p!==ex);sfx('unmark');return}
 const why=canPlant(x,y);if(why){toast(why);return}
 J.plants.push({x,y,sp:speciesFor(x,y),assigned:false});sfx('mark');
}
export const pendingCount=()=>trees.filter(t=>t.marked&&!t.assigned).length+J.plants.filter(p=>!p.assigned).length;
const tpos=k=>k.type==='fell'?[k.t.x,k.t.y]:[k.p.x,k.p.y];
const load_=C=>C.tasks.length+C.cluster.length+C.held.length;
// Podział zadań między ekipy: skupiska (do 260 px) trafiają do ekipy z mniejszą liczbą zadań.
function distribute(tasks){
 const rest=tasks.slice(),out=new Map(J.crews.map(c=>[c,0]));
 while(rest.length){
  // skupisko: do 260 px od pierwszego zadania, najwyżej 10 zadań (duże zlecenie dzieli się między ekipy)
  const [fx,fy]=tpos(rest[0]),d=k=>{const [x,y]=tpos(k);return Math.hypot(x-fx,y-fy)},cl=rest.filter(k=>d(k)<260).sort((a,b)=>d(a)-d(b)).slice(0,J.crews.length>1?10:1e9);
  for(const k of cl)rest.splice(rest.indexOf(k),1);
  const C=J.crews.slice().sort((a,b)=>load_(a)-load_(b))[0];C.tasks.push(...cl);out.set(C,out.get(C)+cl.length);
 }
 return out;
}
// Zadania, których teraz nie wolno wykonać (zima: sadzenie, wiosna: wycinka w 103), czekają osobno.
function sortHeld(C,quiet){const held=C.tasks.filter(holdReason);if(!held.length)return 0;C.held.push(...held);C.tasks=C.tasks.filter(k=>!held.includes(k));
 if(!quiet)toast('Ekipa '+C.id+': '+held.length+' zadań czeka '+(held.some(k=>k.type==='plant')&&cal.season()===3?'na wiosnę (zamarznięta ziemia)':'do lata (okres lęgowy w oddz. 103)')+'.');return held.length}
function launch(out,msg){
 const parts=[];
 for(const [C,n0] of out){if(!n0)continue;const h=sortHeld(C,true),n=n0-h;
  if(h)parts.push('ekipa '+C.id+': '+h+' czeka ('+(cal.season()===3?'zima — ziemia zamarznięta':'okres lęgowy w 103')+')');if(!n)continue;
  if(C.phase==='idle'){if(cal.work(7,14.5)){startCrew(C);parts.push('ekipa '+C.id+' wyjeżdża ('+n+')')}else parts.push('ekipa '+C.id+' przyjedzie '+cal.nextStart(7,15)+' ('+n+')')}
  else parts.push('ekipa '+C.id+' ma '+n+' nowych');
 }
 toast(msg+' '+parts.join(', ')+'.');
}
export function dispatchCrew(){
 const fell=trees.filter(t=>t.marked&&!t.assigned),pl=J.plants.filter(p=>!p.assigned);
 if(!fell.length&&!pl.length){toast('Brak zadań: wyznacz drzewa (klawisz 2) albo miejsca sadzenia (3).');return}
 if(!canAfford(fell.length?COST.fell:COST.plant*5))return;
 const tasks=[];
 for(const t of fell){t.assigned=true;tasks.push({type:'fell',t})}
 for(const p of pl){p.assigned=true;tasks.push({type:'plant',p})}
 launch(distribute(tasks),'Zlecenie: '+fell.length+' do wycinki, '+pl.length+' do posadzenia —');
}
// Zadania z powierzchni odnowieniowej (sadzenie w rzędach) — przez ten sam podział na ekipy.
export function addCrewTasks(tasks,msg){launch(distribute(tasks),msg)}
// Ekipy pracują pon.–sob. 7:00–15:00. Zimą nie sadzą (zamarznięta ziemia), wiosną nie tną w oddz. 103 (okres lęgowy).
function startCrew(C){C.van=new Vehicle('van',ENTRY(rand()<.5));C.van.label='ekipa '+C.id;nextCluster(C)}
const shiftOn=()=>cal.work(7,15);
function holdReason(k){if(k.type==='plant'&&cal.season()===3)return 'zima';if(k.type==='fell'&&birdBan(k.t))return 'lęgi';return null}
function nextCluster(C){
 const v=C.van;
 sortHeld(C);
 if(!C.tasks.length||!shiftOn()){
  const left=C.tasks.length;C.phase='leaving';v.label=left?'ekipa '+C.id+' — koniec dniówki':'ekipa '+C.id+' wraca do bazy';
  if(left)toast('Ekipa '+C.id+': koniec dniówki, wróci '+cal.nextStart(7,15)+' (zostało zadań: '+left+').');
  v.goTo(goalNode(exitNode(v.pos[0])),{leave:true,onArrive:()=>{C.phase='idle';C.van=null}});return}
 const [vx,vy]=v.pos;C.tasks.sort((a,b)=>{const A=tpos(a),B=tpos(b);return Math.hypot(A[0]-vx,A[1]-vy)-Math.hypot(B[0]-vx,B[1]-vy)});
 const [fx,fy]=tpos(C.tasks[0]),rp=nearestRoad(fx,fy,['main','forest'],{margin:50});
 C.cluster=C.tasks.filter(k=>{const [x,y]=tpos(k);return Math.hypot(x-fx,y-fy)<260});
 C.tasks=C.tasks.filter(k=>!C.cluster.includes(k));
 C.phase='driving';C.odd=oddzial(fx,fy);v.label='ekipa '+C.id+' jedzie do oddz. '+C.odd;
 v.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:()=>startWork(C)});
}
function startWork(C){
 const v=C.van;C.phase='working';v.label='ekipa '+C.id+' pracuje w oddz. '+C.odd;
 const h=v.heading,[cx,cy]=C.cluster.length?tpos(C.cluster[0]):v.pos,side=Math.sign(Math.cos(h)*(cx-v.pos[0])+Math.sin(h)*(cy-v.pos[1]))||1;
 const plants=C.cluster.filter(k=>k.type==='plant').length,n=Math.min(plants>=10?4:C.cluster.length>=6?3:2,Math.max(1,C.cluster.length));
 for(let i=0;i<n;i++){
  const w=new Ped({kind:'worker',x:v.pos[0]+Math.cos(h)*16*side+Math.sin(h)*(i*10-5),y:v.pos[1]+Math.sin(h)*16*side-Math.cos(h)*(i*10-5),speed:15});
  w.label='pilarz (ekipa '+C.id+')';w.crew=C;w.onIdle=assignNext;C.workers.push(w);
 }
}
const vanDoor=C=>{const v=C.van,h=v.heading;return[v.pos[0]+Math.cos(h)*16,v.pos[1]+Math.sin(h)*16]};
function assignNext(w){
 const C=w.crew;let task=C.cluster.shift();
 if(task&&!shiftOn()){C.tasks.push(task,...C.cluster);C.cluster=[];task=null}
 if(!task){w.onIdle=null;w.run([{go:vanDoor(C)},{call:q=>{q.hidden=true;q.dead=true;C.workers=C.workers.filter(x=>x!==q);if(!C.workers.length)nextCluster(C)}}]);return}
 if(task.type==='fell'){
  const t=task.t;if(t.st!==STAND){assignNext(w);return}
  const rp=nearestRoad(t.x,t.y,['main','forest']);
  let dir=Math.atan2(t.y-rp.y,t.x-rp.x)+(rand()-.5)*1.2;   // obalanie od drogi
  const stand=[t.x-Math.cos(dir)*9+Math.cos(dir+1.57)*5,t.y-Math.sin(dir)*9+Math.sin(dir+1.57)*5];
  w.label='pilarz '+C.id+' — ścina '+SP[t.sp].name.split(' ')[0];
  w.run([{go:stand,face:[t.x,t.y]},
   {wait:3.4,pose:'saw',face:[t.x,t.y],tick:(q,dt)=>{if(rand()<dt*18)particle('dust',t.x+(rand()-.5)*6,t.y+(rand()-.5)*6,{col:'#e3c08a',size:1+rand()*2})}},
   {call:()=>{w.label='„Uwaga, drzewo!”';t.onLand=()=>{sfx('crash');for(let k=0;k<14;k++)particle('dust',t.x+Math.cos(dir)*t.lying.L*rand(),t.y+Math.sin(dir)*t.lying.L*rand(),{col:'#c8b48a',size:2+rand()*3})};startFall(t,dir);sfx('creak')}},
   {wait:2.1,pose:'stand',face:[t.x,t.y]},
   {go:[t.x+Math.cos(dir)*fallMid(t)+Math.cos(dir+1.57)*8,t.y+Math.sin(dir)*fallMid(t)+Math.sin(dir+1.57)*8]},
   {wait:2.6,pose:'saw',face:[t.x+Math.cos(dir)*fallMid(t),t.y+Math.sin(dir)*fallMid(t)],tick:(q,dt)=>{if(rand()<dt*14)particle('dust',q.x+Math.cos(q.heading)*10,q.y+Math.sin(q.heading)*10,{col:'#e3c08a'})}},
   {call:()=>{makePile(t,dir);finishTree(t);t.assigned=false;pay(COST.fell,'ścinka i wyrzynka');stat('felled');w.label='pilarz (ekipa '+C.id+')'}}]);
 }else{
  const p=task.p;w.label='pilarz '+C.id+' — sadzi '+SP[p.sp].name.split(' ')[0];w.prop='sapling';
  w.run([{go:[p.x-7,p.y],face:[p.x,p.y]},{wait:p.plot?1:1.8,pose:'kneel',face:[p.x,p.y]},
   {call:()=>{const nur=takeNursery(p.sp);
    plantTree(p.x,p.y,p.sp,!!p.prep||nur);J.plants=J.plants.filter(q=>q!==p);pay(nur?COST.plantNursery:COST.plant,nur?'sadzonka ze szkółki':'sadzonka i sadzenie');planProgress('plant',1);w.label='pilarz (ekipa '+C.id+')';w.prop=null;p.onDone&&p.onDone()}}]);
 }
}
// sadzonka danego gatunku ze szkółki (0.6.2: zapas osobno dla każdego gatunku)
export function takeNursery(sp){const N=ECO.nursery;if(!N)return false;if(!N.sp)N.sp={sosna:N.stock||0};if((N.sp[sp]||0)<=0)return false;N.sp[sp]--;N.stock=Math.max(0,(N.stock||0)-1);return true}
const fallMid=t=>(t.falling?t.falling.L:t.lying?t.lying.L:60)*.45;
// Kłody z drzewa od razu dzielone na sortymenty (tartaczne / papierówka / opał) według grubości i jakości.
function makePile(t,dir){
 const L=t.lying?t.lying.L:60,vol=Math.max(.08,volume(t)),f=sortSplit(t),sorts={},vals={};
 for(const k in f){sorts[k]=vol*f[k];vals[k]=vol*f[k]*SP[t.sp].price*SORTS[k].k}
 E.piles.push({x:t.x+Math.cos(dir)*L*.45,y:t.y+Math.sin(dir)*L*.45,a:dir,vol,sp:t.sp,sorts,vals,logs:clamp(Math.round(vol*3)+1,1,6),bark:SP[t.sp].bark[1]==='#2e2c28'?'#e6e2d6':SP[t.sp].bark[1],state:'ground',dead:false});
}
// kłody bez podziału (zapis z 0.6.1): całość jako papierówka i opał po połowie
export const pileSorts=p=>p.sorts||{tart:0,pap:p.vol*.5,opal:p.vol*.5};
const pileVals=p=>p.vals||{tart:0,pap:p.vol*.5*SP[p.sp].price*SORTS.pap.k,opal:p.vol*.5*SP[p.sp].price*SORTS.opal.k};
export function hireCrewB(){
 if(J.crews.length>1){toast('Druga ekipa już pracuje.');return}
 J.crews.push(newCrew('B'));toast('Zatrudniono drugą ekipę (ZUL): '+zl(COST.crewB)+' dziennie. Zadania dzielą się między ekipy.');
}
export function fireCrewB(){
 const B=J.crews[1];if(!B)return;if(B.phase!=='idle'){toast('Ekipa B jest w terenie — zwolnisz ją po powrocie.');return}
 J.crews[0].tasks.push(...B.tasks,...B.held);J.crews.pop();toast('Umowa z ekipą B rozwiązana.');
}

// ── składnice drewna przy drogach (0.7.2) ──
// Jedno miejsce = jedna składnica: wszystkie sortymenty leżą w jednym stosie (rozróżnione grubością kłód i kolorem etykiet), opał obok jako luźna pryzma.
// Miejsce jest zawsze poza jezdnią i z dala od skrzyżowań (geometria wg krzywej drogi, nie cięciwy).
const STACK_CAP=40;
function placeAt(e,s,side){
 const [cx,cy,tx,ty]=ptAt(e,s),nx=-ty*side,ny=tx*side,off=e.w/2+13;
 return{x:cx+nx*off,y:cy+ny*off,ax:tx,ay:ty,nx,ny};
}
function pileOk(P){   // narożniki stosu (długość 40, głębokość 30 w stronę lasu) poza drogami, podwórzem i placem
 for(const [al,d] of [[-22,-2],[22,-2],[-22,32],[22,32],[0,32],[0,-2]]){
  const x=P.x+P.ax*al+P.nx*d,y=P.y+P.ay*al+P.ny*d;
  if(roadClearance(x,y)<7||inRect(x,y,YARD,6)||inRect(x,y,PLAC,10)||pointBlocked(x,y,3))return false}
 return true;
}
function spotAt(e,s0){
 // istniejąca składnica na tej drodze w pobliżu — dołączamy do niej
 for(const q of J.stacks)if(q.edge===e&&Math.abs(q.s-s0)<110)return{s:q.s,P:{x:q.x,y:q.y,ax:q.ax,ay:q.ay,nx:q.nx,ny:q.ny}};
 for(let k=0;k<14;k++){const s=clamp(s0+(k%2?-1:1)*Math.ceil(k/2)*18,70,e.len-70);
  for(const side of k%2?[1,-1]:[-1,1]){const P=placeAt(e,s,side);if(pileOk(P)&&!J.stacks.some(q=>Math.hypot(q.x-P.x,q.y-P.y)<60))return{s,P}}}
 const s=clamp(s0,70,e.len-70);return{s,P:placeAt(e,s,1)};
}
export function stackFor(x,y,sort='tart'){
 const rp=nearestRoad(x,y,['forest'],{margin:60});
 let best=null;for(const st of J.stacks){if((st.sort||'tart')!==sort)continue;const d=Math.hypot(st.x-rp.x,st.y-rp.y);if(d<170&&st.vol<STACK_CAP-2&&(!best||d<best.d))best={st,d}}
 if(best)return best.st;
 const {s,P}=spotAt(rp.edge,rp.s),st={id:J.nextStack++,edge:rp.edge,s,...P,vol:0,value:0,sort,truck:sort!=='opal',odd:oddzial(P.x,P.y)};J.stacks.push(st);return st;
}
// wczytanie zapisu: stare stosy (po jednym na sortyment, mogły leżeć na jezdni) trafiają na nowe składnice
export function restoreStack(edgeId,s0,vol,value,sort='tart',truck){const e=EDGES.find(q=>q.id===edgeId);if(!e)return null;const {s,P}=spotAt(e,s0),st={id:J.nextStack++,edge:e,s,...P,vol,value,sort,truck:truck??sort!=='opal',odd:oddzial(P.x,P.y)};J.stacks.push(st);return st}
export const spotOf=st=>J.stacks.filter(q=>q.vol>.05&&Math.hypot(q.x-st.x,q.y-st.y)<8);
export function addToStack(st,vol,value){st.vol+=vol;st.value+=value}
export function takeFromStack(st,vol){const q=Math.min(vol,st.vol),val=st.vol>0?st.value*q/st.vol:0;st.vol-=q;st.value-=val;if(st.vol<.05&&!J.truck.route.includes(st)&&J.truck.cur!==st)J.stacks=J.stacks.filter(z=>z!==st);return{q,val}}

// ── zrywka ──
export const MACH={
 tractor:{name:'ciągnik z wyciągarką',veh:'tractor',cap:6,reach:150,pull:36,rope:true},
 forwarder:{name:'forwarder z żurawiem',veh:'forwarder',cap:12,reach:95,pull:80,crane:true,price:18000}
};
// 0.6: nie ma bazy maszyn. Ciągnik usługowy przyjeżdża z zewnątrz, gdy są kłody do zwiezienia; jeśli praca trwa dłużej,
// nocuje na placu przy leśniczówce, a po skończonej robocie zjeżdża z lasu. Kupiony forwarder stoi na placu na stałe.
const PLAC_EDGE=edgeOf('a3','l1');
const homeLabel=()=>MACH[J.skid.mach].name+' (na placu przy leśniczówce)';
function parkAtPlac(v,cb){
 const sp=PLAC_SPOTS[0],sRoad=clamp(NODES.a3[0]-(sp.x+70),20,PLAC_EDGE.len-20);
 v.goTo({edge:PLAC_EDGE,s:sRoad},{park:false,onArrive:()=>v.driveOff([[sp.x+22,sp.y-28],[sp.x-14,sp.y+2]],{onArrive:()=>{v.v=0;v.parked=true;cb&&cb()}})});
}
function spawnMachine(kind,toPlac){
 const S=J.skid,M=MACH[kind];S.mach=kind;
 S.trac=new Vehicle(M.veh,ENTRY(rand()<.5));S.trac.cap=M.cap;S.list=[];S.cur=null;S.watch=0;S.atHome=false;
 if(toPlac){S.phase='arriving';S.trac.label=M.name+' jedzie na plac przy leśniczówce';parkAtPlac(S.trac,()=>{S.phase='idle';S.atHome=true;S.trac.label=homeLabel()})}
 else{S.phase='idle';S.trac.label=M.name+' (usługa zrywki) dojeżdża do lasu'}
}
export const placeForwarder=()=>spawnMachine('forwarder',true);
const crewsFelling=()=>J.crews.some(C=>C.tasks.some(k=>k.type==='fell')||C.cluster.some(k=>k.type==='fell'));
// Koniec pracy albo brak kłód: na plac (forwarder, albo usługa, gdy robota jeszcze trwa) albo zjazd z lasu.
function goHome(){
 const S=J.skid,v=S.trac,M=MACH[S.mach];if(!v)return;
 if(!S.owned&&!crewsFelling()&&!freePiles().length){
  v.label=M.name+' zjeżdża z lasu — zrywka skończona';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true});
  S.trac=null;S.phase='idle';S.atHome=false;return}
 if(S.atHome)return;
 S.phase='home';v.label=M.name+' jedzie na nocleg na plac przy leśniczówce';
 parkAtPlac(v,()=>{S.phase='idle';S.atHome=true;v.label=homeLabel()});
}
export function initJobs(){
 J.skid.trac=null;J.skid.phase='idle';
 // drewno z poprzedniego sezonu: stosy przy drogach (tartaczne, papierówka, opał dla ludności)
 addToStack(stackFor(780,1300,'tart'),2.6,2.6*340);addToStack(stackFor(780,1300,'opal'),3.2,3.2*125);addToStack(stackFor(1760,850,'pap'),1.8,1.8*190);addToStack(stackFor(1760,850,'opal'),2.4,2.4*120);
}
export function buyForwarder(){
 const S=J.skid,M=MACH.forwarder;
 if(S.owned){toast('Forwarder już pracuje w leśnictwie.');return}
 if(!canAfford(M.price))return;
 if(S.trac&&S.phase!=='idle'){toast('Poczekaj, aż ciągnik usługowy skończy kurs.');return}
 pay(M.price,'zakup forwardera');S.owned=true;
 const old=S.trac;if(old){old.label='ciągnik usługowy odjeżdża (zastąpiony forwarderem)';old.goTo(goalNode(exitNode(old.pos[0])),{leave:true})}
 spawnMachine('forwarder',true);toast('Kupiono forwarder: 12 m³ ładunku, żuraw, szybciej w terenie. Utrzymanie '+zl(COST.fwd)+' dziennie.');
}
const anchor=v=>J.skid.mach==='forwarder'?cartFront(v.cart):cartRear(v.cart);
export function rutWork(v,step){v.rutAcc=(v.rutAcc||0)+step;if(v.rutAcc>2){v.rutAcc=0;paintRut(v.pos[0],v.pos[1],v.heading,v.spec.hw*.65);if(v.cart){const c=v.cart;paintRut(c.x,c.y,c.angle,12)}}}
function pathTo(v,tx,ty,stop){
 let p=NAV.foot.findPath(v.pos[0],v.pos[1],tx,ty);if(!p||!p.length)p=[[tx,ty]];
 const out=[];let px=v.pos[0],py=v.pos[1];
 for(const q of p){
  if(Math.hypot(q[0]-tx,q[1]-ty)<=stop){let lo=0,hi=1;
   for(let k=0;k<12;k++){const m=(lo+hi)/2,x=px+(q[0]-px)*m,y=py+(q[1]-py)*m;if(Math.hypot(x-tx,y-ty)<=stop)hi=m;else lo=m}
   out.push([px+(q[0]-px)*hi,py+(q[1]-py)*hi]);break}
  out.push(q);px=q[0];py=q[1];
 }
 return out;
}
const freePiles=()=>E.piles.filter(p=>p.state==='ground'&&!p.dead&&!(p.skipT>state.elapsed));
const reachD=(v,p)=>{const [ax,ay]=anchor(v);return Math.min(Math.hypot(p.x-ax,p.y-ay),Math.hypot(p.x-v.pos[0],p.y-v.pos[1]))};
function skidUpdate(dt){
 const S=J.skid,M=MACH[S.mach];
 if(!S.trac){if(!S.owned&&cal.work(7,15)&&freePiles().length)spawnMachine('tractor',false);else if(S.owned)spawnMachine('forwarder',true);return}
 const v=S.trac;
 if(S.phase!=='idle'&&S.phase!=='arriving'&&S.phase!=='home')S.watch+=dt;
 if(S.watch>240){   // zabezpieczenie: brak postępu przez 4 godziny gry — odholowanie do bazy
  for(const p of E.piles)if(p.state==='reserved'||p.state==='winch')p.state='ground';
  if(S.target)S.target.skipT=state.elapsed+600;
  const load=v.load,val=S.val||0,[px,py]=v.pos;v.dead=true;S.trac=null;S.phase='idle';S.watch=0;
  if(load>0){for(const k of ['tart','pap','opal'])if(S.ls&&S.ls[k]>.01)addToStack(stackFor(px,py,k),S.ls[k],S.lv[k]);S.ls=S.lv=null}
  if(S.owned)spawnMachine('forwarder',true);
  toast(M.name[0].toUpperCase()+M.name.slice(1)+' utknął — odholowano go, ładunek złożono przy drodze.'+(S.owned?'':' Przyjedzie inny ciągnik.'));return;
 }
 if(S.phase==='idle'){
  if(!cal.work(7,17)){goHome();return}
  const free=freePiles();if(!free.length){goHome();return}
  const [vx,vy]=v.pos;free.sort((a,b)=>Math.hypot(a.x-vx,a.y-vy)-Math.hypot(b.x-vx,b.y-vy));
  const p=free[0],rp=nearestRoad(p.x,p.y,['main','forest'],{margin:60});
  S.target=p;S.went=false;S.phase='driving';S.watch=0;S.atHome=false;
  v.label=M.name+' jedzie po drewno do oddz. '+oddzial(p.x,p.y);
  const near=Math.hypot(p.x-rp.x,p.y-rp.y)<=M.reach-12;
  v.goTo({edge:rp.edge,s:rp.s},{park:near,onArrive:()=>{S.watch=0;if(near)startLoad();else goIn(p)}});
 }else if(S.phase==='load'){
  if(S.wait>0){S.wait-=dt;return}
  if(!S.cur){
   while(S.list.length&&S.list[0].dead)S.list.shift();
   S.cur=v.load<v.cap-.3?S.list.shift()||null:null;
   if(S.cur){S.cur.state='winch';sfx('winch')}
  }
  if(!S.cur){
   for(const p of S.list)if(p.state==='reserved')p.state='ground';S.list=[];
   if(v.load<v.cap-.3){const [ax,ay]=v.pos,next=freePiles().filter(p=>Math.hypot(p.x-ax,p.y-ay)<420).sort((a,b)=>Math.hypot(a.x-ax,a.y-ay)-Math.hypot(b.x-ax,b.y-ay))[0];
    if(next){S.target=next;
     if(reachD(v,next)<=M.reach){startLoad();if(S.list.length)return}
     else if((S.loops=(S.loops||0)+1)<=4){goIn(next);return}
     next.skipT=state.elapsed+300}}
   comeBack();return;
  }
  const p=S.cur,[wx,wy]=anchor(v),dx=wx-p.x,dy=wy-p.y,d=Math.hypot(dx,dy);
  if(d<12){v.load+=p.vol;const ps=pileSorts(p),pv=pileVals(p);S.ls=S.ls||{tart:0,pap:0,opal:0};S.lv=S.lv||{tart:0,pap:0,opal:0};for(const k in ps){S.ls[k]+=ps[k];S.lv[k]+=pv[k]}p.dead=true;S.cur=null;S.wait=M.crane?.5:.8;S.watch=0;sfx(M.crane?'log':'clunk');return}
  const st=Math.min(d,M.pull*dt);p.x+=dx/d*st;p.y+=dy/d*st;p.a+=clamp(Math.atan2(dy,dx)-p.a,-dt*2,dt*2);
  if(M.rope&&rand()<dt*10)particle('dust',p.x,p.y,{col:'#a88c62'});
 }else if(S.phase==='unload'){
  // rozładunek na stos przy drodze (kłody lecą z przyczepy na stos)
  // rozładunek po kolei: tartaczne, papierówka, opał — każdy sortyment na swój stos
  const ls=S.ls||(S.ls={tart:0,pap:0,opal:v.load}),lv=S.lv||(S.lv={tart:0,pap:0,opal:0});
  const k=['tart','pap','opal'].find(q=>ls[q]>.001)||'opal',st=S.stacks&&S.stacks[k]||(S.stacks=S.stacks||{},S.stacks[k]=stackFor(S.stack.x,S.stack.y,k));
  const q=Math.min(ls[k],dt*1.6),vv=ls[k]>0?lv[k]*q/ls[k]:0;
  ls[k]-=q;lv[k]-=vv;v.load=Math.max(0,v.load-q);addToStack(st,q,vv);S.delivered=(S.delivered||0)+q;S.dsort=S.dsort||{};S.dsort[k]=(S.dsort[k]||0)+q;
  if(ls.tart+ls.pap+ls.opal<=.001)v.load=0;
  if(rand()<dt*8)particle('dust',st.x+(rand()-.5)*20,st.y+(rand()-.5)*20,{col:'#b8a07a'});
  if(v.load<=.001){
   J.stacks=J.stacks.filter(z=>z.vol>.05||z===J.truck.cur||J.truck.route.includes(z));
   const d=S.delivered||0,ds=S.dsort||{};v.load=0;S.val=0;S.ls=null;S.lv=null;S.stacks=null;S.delivered=0;S.dsort=null;S.watch=0;
   if(d>0){pay(Math.round(d*COST.skid),'zrywka');planProgress('cut',d);toast('Przy drodze w oddz. '+st.odd+' złożono '+displayNumber(d,1)+' m³: '+['tart','pap','opal'].filter(k=>ds[k]>.05).map(k=>SORTS[k].short+' '+displayNumber(ds[k],1)).join(', ')+'.')}
   if(freePiles().length&&cal.work(7,17)){S.phase='idle';}
   else{S.phase='idle';goHome()}
  }
 }
}
function startLoad(){
 const S=J.skid,v=S.trac,M=MACH[S.mach];
 S.list=freePiles().filter(p=>reachD(v,p)<=M.reach).sort((a,b)=>reachD(v,a)-reachD(v,b));
 if(S.list.length)S.loops=0;
 for(const p of S.list)p.state='reserved';
 S.phase='load';S.cur=null;S.wait=.8;v.label=M.crane?'forwarder ładuje kłody żurawiem':'zrywka: wyciągarka ciągnie kłody';
}
function goIn(p){
 const S=J.skid,v=S.trac,M=MACH[S.mach];
 const pts=pathTo(v,p.x,p.y,M.reach-40);S.went=true;S.phase='in';S.watch=0;
 let L=0,px=v.pos[0],py=v.pos[1];for(const q of pts){L+=Math.hypot(q[0]-px,q[1]-py);px=q[0];py=q[1]}
 if(L>30)J.trails.push({d:state.days,p:[[Math.round(v.pos[0]),Math.round(v.pos[1])],...pts.map(q=>[Math.round(q[0]),Math.round(q[1])])]});
 v.label=M.name+' jedzie szlakiem zrywkowym';
 v.driveOff(pts,{work:rutWork,onArrive:()=>{S.watch=0;startLoad()}});
}
// Powrót na drogę i złożenie drewna na stosie przy najbliższym poboczu.
function comeBack(){
 const S=J.skid,v=S.trac,M=MACH[S.mach];
 const toStack=()=>{
  if(v.load<=.001){S.phase='idle';goHome();return}
  const k0=['tart','pap','opal'].find(q=>S.ls&&S.ls[q]>.001)||'opal',st=S.stack=stackFor(v.pos[0],v.pos[1],k0);S.stacks={[k0]:st};S.phase='tostack';v.label=M.name+' wiezie '+displayNumber(v.load,1)+' m³ na stos przy drodze';
  v.goTo({edge:st.edge,s:st.s},{park:true,onArrive:()=>{S.phase='unload';S.watch=0;v.label='układanie stosu przy drodze'}});
 };
 if(!S.went){toStack();return}
 const rp=nearestRoad(v.pos[0],v.pos[1],['main','forest'],{margin:40});
 const pts=pathTo(v,rp.x,rp.y,0);S.phase='out';S.went=false;v.label=M.name+' wraca szlakiem na drogę';
 v.driveOff(pts,{work:rutWork,onArrive:()=>{v.rejoin();toStack()}});
}

// ── wywóz: ciągnik siodłowy z naczepą do dłużycy i żurawiem HDS objeżdża stosy ──
export function orderTruck(manual=true){
 const T=J.truck;
 if(T.v){if(manual)toast('Ciężarówka już jest w drodze.');return}
 if(truckTotal()<1){if(manual)toast('Przy drogach prawie nie ma drewna do wywozu ('+displayNumber(truckTotal(),1)+' m³; opał czeka na ludność).');return}
 if(!cal.work(8,15)){T.pending=true;if(manual)toast('Wywóz zamówiony — ciężarówka przyjedzie '+cal.nextStart(8,16)+'.');return}
 T.pending=false;
 // trasa: stosy od największego, potem po kolei najbliższe
 const cand=J.stacks.filter(s=>s.vol>.5&&forTruck(s)).sort((a,b)=>b.vol-a.vol);let cap=30,route=[],pos=[NODES.j3[0],NODES.j3[1]];
 while(cand.length&&cap>0){cand.sort((a,b)=>Math.hypot(a.x-pos[0],a.y-pos[1])-Math.hypot(b.x-pos[0],b.y-pos[1]));const s=cand.shift();route.push(s);cap-=s.vol;pos=[s.x,s.y]}
 T.route=route;T.v=new Vehicle('truck',{...ENTRY(false),allow:['main','forest']});T.v.cap=30;T.v.label='ciężarówka po drewno';T.val=0;
 toast((manual?'Ciężarówka jedzie po drewno':'Nadleśnictwo wysłało ciężarówkę')+' — stosów do odbioru: '+route.length+'.');
 nextStop();
}
function nextStop(){
 const T=J.truck,v=T.v;T.cur=T.route.shift()||null;
 if(!T.cur||v.load>=v.cap-.3){
  const pay_=Math.round((T.val||0)*ECO.market);T.val=0;
  if(v.load>0){earn(pay_,'sprzedaż drewna');J.sold+=v.load;stat('sold',v.load);toast('Sprzedano '+displayNumber(v.load,1)+' m³ drewna za '+zl(pay_)+' (cena rynkowa ×'+displayNumber(ECO.market,2)+').')}
  for(const s of T.route)if(s.vol<.05)J.stacks=J.stacks.filter(z=>z!==s);T.route=[];
  T.phase='leaving';v.label='ciężarówka odjeżdża z drewnem';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true});return}
 T.phase='coming';v.label='ciężarówka jedzie do stosu w oddz. '+T.cur.odd;
 v.goTo({edge:T.cur.edge,s:T.cur.s},{park:true,onArrive:()=>{T.phase='load';T.wait=1;v.label='załadunek żurawiem HDS'}});
}
function truckUpdate(dt){
 const T=J.truck,v=T.v;
 if(!v){if((T.pending||(J.auto&&truckTotal()>=16))&&cal.work(8,15))orderTruck(T.pending);return}
 if(v.dead){T.v=null;T.phase='idle';T.cur=null;return}
 if(T.phase==='load'){
  if(T.wait>0){T.wait-=dt;return}
  const st=T.cur,want=Math.min(dt*1.4,v.cap-v.load);const {q,val}=takeFromStack(st,want);v.load+=q;T.val=(T.val||0)+val;
  T.craneT=(T.craneT||0)+dt;if(rand()<dt*3)sfx('log');
  if(st.vol<.05||v.load>=v.cap-.05){if(st.vol<.05)J.stacks=J.stacks.filter(z=>z!==st);T.wait=0;nextStop()}
 }
}
// Drewno opałowe dla ludności: kupujący odbiera je sam ze stosu.
export function opalStack(vol){const c=J.stacks.filter(s=>s.sort==='opal'&&s.vol>=vol+.2&&s!==J.truck.cur&&!J.truck.route.includes(s));if(!c.length)return null;return c.sort((a,b)=>Math.hypot(a.x-560,a.y-300)-Math.hypot(b.x-560,b.y-300))[0]}
export function updateJobs(dt){
 for(const C of J.crews){
  if(C.held.length&&!(cal.season()===3&&C.held.some(k=>k.type==='plant'))){const back=C.held.filter(k=>!holdReason(k));C.held=C.held.filter(k=>holdReason(k));C.tasks.push(...back)}
  if(C.phase==='idle'&&C.tasks.length&&cal.work(7,14.5)&&(sortHeld(C,true),C.tasks.length))startCrew(C);
 }
 skidUpdate(dt);truckUpdate(dt);
}

// ── rysowanie: stosy przy drogach, kłody w lesie, liny i żurawie ──
const rect2=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h)};
export function drawStacks(g){
 const spots=new Map();
 for(const st of J.stacks){if(st.vol<.05)continue;const k=Math.round(st.x)+','+Math.round(st.y);let o=spots.get(k);if(!o)spots.set(k,o={st,tart:0,pap:0,opal:0,own:false});o[st.sort||'tart']+=st.vol;if((st.sort||'tart')==='opal'&&st.truck===false)o.own=true}
 for(const o of spots.values()){
  const {x,y,ax,ay,nx,ny}=o.st,side=Math.sign(nx*-ay+ny*ax)||1;
  g.save();g.translate(Math.round(x),Math.round(y));g.rotate(Math.atan2(ay,ax));   // oś X wzdłuż drogi, +Y/−Y = od drogi do lasu wg side
  const rt=o.tart>.05?clamp(Math.ceil(o.tart/4.5),1,5):0,rp=o.pap>.05?clamp(Math.ceil(o.pap/4.5),1,4):0,depth=rt*4+rp*3+(rt&&rp?1:0),L=36;
  // utwardzone mijsce pod stosem
  if(rt||rp){g.fillStyle='#a8996f';g.fillRect(-L/2-5,side>0?-3:-depth-5,L+10,depth+8);g.fillStyle='#8a7c58';g.fillRect(-L/2-5,side>0?depth+4:-depth-5,L+10,1)}
  let off=0;
  const row=(th,len,bark,top,tag)=>{const yy=side>0?off:-off-th;
   g.fillStyle='#2b3b2a40';if(off===0)g.fillRect(-len/2+3,side>0?-1:-th-1,len,th+3);
   rect2(g,-len/2,yy,len,th,'#4a3624');rect2(g,-len/2,yy+1,len,th-2,bark);if(top)rect2(g,-len/2+2,yy+1,len-4,1,top);
   rect2(g,-len/2,yy,2,th,'#e3c08a');rect2(g,len/2-2,yy,2,th,'#d8b47c');rect2(g,len/2+1,yy,2,th>3?th-1:th,tag);off+=th};
  for(let k=0;k<rt;k++)row(4,L,k%2?'#9a6a40':'#a8764a',k===rt-1?'#c28f55':null,'#e08a2a');       // tartak: grube kłody, etykieta pomarańczowa
  if(rt&&rp)off+=1;
  for(let k=0;k<rp;k++)row(3,L-8,k%2?'#7a6048':'#6e5640',k===rp-1?'#92765a':null,'#3a74c0');     // papierówka: cienkie, krótsze, etykieta niebieska
  if(rt||rp){for(const px of [-12,10])rect2(g,px,side>0?-1:-depth-3,3,depth+4,'#5a4634')}
  // opał: luźna pryzma polan obok stosu
  if(o.opal>.05){const n=clamp(Math.round(o.opal*16),14,130),cx=L/2+17,cy=side*8;g.fillStyle='#2b3b2a45';g.beginPath();g.ellipse(cx+1,cy+side*2,8+Math.min(o.opal,8)*1.3,6+Math.min(o.opal,8)*.9,0,0,6.28);g.fill();
   for(let i=0;i<n;i++){const a=hash2(i,1)*6.283,r=Math.sqrt(hash2(i,2))*(4+Math.min(o.opal,8)*1.1),px=cx+Math.cos(a)*r*1.3,py=cy+Math.sin(a)*r*.8-(r<4?1:0);
    rect2(g,px-1.5,py,3,2,i%3?'#b8844a':'#8a6a48');if(i%5===0)rect2(g,px-1.5,py,1,2,'#e3c08a')}
   if(o.own){rect2(g,cx-1,side*-6-2,2,9,'#6b563d');rect2(g,cx-1,side*-6-4,9,5,'#e8e0c8');rect2(g,cx+1,side*-6-3,5,1,'#3a6ab0')}}
  g.restore();
 }
}
const hash2=(i,k)=>{const v=Math.sin(i*127.1+k*311.7)*43758.5453;return v-Math.floor(v)};
export function drawGroundItems(g){
 drawStacks(g);
 for(const p of E.piles)if(!p.dead)pileTop(g,p);
 for(const p of J.plants){g.strokeStyle=p.assigned?'#a6e07a':'#7ae07a';g.lineWidth=1;g.strokeRect(Math.round(p.x)-3.5,Math.round(p.y)-3.5,7,7);rect2(g,p.x-1,p.y-1,2,2,'#3f744c')}
}
function craneArm(g,bx,by,tx,ty,lift=18){
 const mx=(bx+tx)/2,my=(by+ty)/2-lift;
 for(const [w,c] of [[5,'#2a2a26'],[3,'#d8b23a']]){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(bx,by);g.lineTo(mx,my);g.lineTo(tx,ty-4);g.stroke()}
 g.lineCap='butt';rect2(g,tx-4,ty-7,8,5,'#3a3a36');rect2(g,tx-3,ty-6,6,3,'#8a8a80');
}
export function drawRopes(g){
 const S=J.skid,v=S.trac;
 if(v&&S.phase==='load'&&S.cur){const [wx,wy]=anchor(v),p=S.cur;
  if(MACH[S.mach].crane)craneArm(g,wx,wy,p.x,p.y);
  else{g.strokeStyle='#2a2a26';g.lineWidth=1;g.beginPath();g.moveTo(Math.round(wx)+.5,Math.round(wy)+.5);g.lineTo(Math.round(p.x)+.5,Math.round(p.y)+.5);g.stroke()}}
 if(v&&S.phase==='unload'&&S.stack&&MACH[S.mach].crane){const [wx,wy]=anchor(v),t=state.elapsed*2;craneArm(g,wx,wy,S.stack.x+Math.sin(t)*10,S.stack.y+Math.cos(t*.7)*6)}
 // żuraw HDS ciężarówki: chwytak kursuje między stosem a naczepą
 const T=J.truck;
 if(T.v&&T.phase==='load'&&T.cur){const v2=T.v,h=v2.heading,bx=v2.pos[0]-Math.sin(h)*-14,by=v2.pos[1]+Math.cos(h)*-14,k=(Math.sin(state.elapsed*1.6)+1)/2,
  [cx,cy]=cartFront(v2.cart),tx=T.cur.x+(cx-T.cur.x)*k*.8,ty=T.cur.y+(cy-T.cur.y)*k*.8;craneArm(g,bx,by,tx,ty,22)}
}
