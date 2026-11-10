// Prace leśne (0.5): wyznaczanie drzew, ekipy pilarzy A i B (ścinka, wyrzynka, sadzenie), zrywka szlakami do stosów przy drogach,
// ciężarówka z żurawiem (HDS) objeżdżająca stosy. Wszystko jeździ samo — gracz wydaje polecenia i pilnuje budżetu.
import {state,toast,particle,clamp,zl,displayNumber,ctx,cal,rect} from './core.js';
import {SKLAD,roadClearance,oddzial,inRect,YARD,UPRAWA,pointBlocked,NODES,EDGES} from './map.js';
import {nearestRoad,goalNode,edgeOf,pointOn} from './roads.js';
import {paintRut} from './paint.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,rand,cartRear,cartFront} from './life/agents.js';
import {trees,STAND,STUMP,CUT_AGE,SP,startFall,finishTree,plantTree,volume,crownR,speciesFor,treesIn,SAPLING_AGE} from './forest.js';
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
export const stackTotal=()=>J.stacks.reduce((a,s)=>a+s.vol,0);
export const stackValue=()=>J.stacks.reduce((a,s)=>a+s.value,0);

// ── polecenia gracza ──
export function birdBan(t){return cal.season()===0&&oddzial(t.x,t.y)==='103'}
export function toggleMark(t){
 if(!t||t.st!==STAND||t.falling||t.lying){return false}
 if(t.assigned){toast('To drzewo jest już w pracy ekipy.');return false}
 if(t.age<CUT_AGE){toast('Za młode do wycinki ('+Math.round(t.age)+' lat) — zostaw je, niech rośnie.');return false}
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
function startCrew(C){C.van=new Vehicle('van',{from:'mE',to:'j2',s:0});C.van.label='ekipa '+C.id;nextCluster(C)}
const shiftOn=()=>cal.work(7,15);
function holdReason(k){if(k.type==='plant'&&cal.season()===3)return 'zima';if(k.type==='fell'&&birdBan(k.t))return 'lęgi';return null}
function nextCluster(C){
 const v=C.van;
 sortHeld(C);
 if(!C.tasks.length||!shiftOn()){
  const left=C.tasks.length;C.phase='leaving';v.label=left?'ekipa '+C.id+' — koniec dniówki':'ekipa '+C.id+' wraca do bazy';
  if(left)toast('Ekipa '+C.id+': koniec dniówki, wróci '+cal.nextStart(7,15)+' (zostało zadań: '+left+').');
  v.goTo(goalNode('mE'),{leave:true,onArrive:()=>{C.phase='idle';C.van=null}});return}
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
   {call:()=>{const nur=ECO.nursery&&ECO.nursery.stock>0;if(nur)ECO.nursery.stock--;
    plantTree(p.x,p.y,p.sp,!!p.prep||nur);J.plants=J.plants.filter(q=>q!==p);pay(nur?COST.plantNursery:COST.plant,nur?'sadzonka ze szkółki':'sadzonka i sadzenie');planProgress('plant',1);w.label='pilarz (ekipa '+C.id+')';w.prop=null;p.onDone&&p.onDone()}}]);
 }
}
const fallMid=t=>(t.falling?t.falling.L:t.lying?t.lying.L:60)*.45;
function makePile(t,dir){
 const L=t.lying?t.lying.L:60,vol=Math.max(.08,volume(t));
 E.piles.push({x:t.x+Math.cos(dir)*L*.45,y:t.y+Math.sin(dir)*L*.45,a:dir,vol,sp:t.sp,logs:clamp(Math.round(vol*3)+1,1,6),bark:SP[t.sp].bark[1]==='#2e2c28'?'#e6e2d6':SP[t.sp].bark[1],state:'ground',dead:false});
}
export function hireCrewB(){
 if(J.crews.length>1){toast('Druga ekipa już pracuje.');return}
 J.crews.push(newCrew('B'));toast('Zatrudniono drugą ekipę (ZUL): '+zl(COST.crewB)+' dziennie. Zadania dzielą się między ekipy.');
}
export function fireCrewB(){
 const B=J.crews[1];if(!B)return;if(B.phase!=='idle'){toast('Ekipa B jest w terenie — zwolnisz ją po powrocie.');return}
 J.crews[0].tasks.push(...B.tasks,...B.held);J.crews.pop();toast('Umowa z ekipą B rozwiązana.');
}

// ── stosy drewna przy drogach ──
// Drewno nie trafia na jedną składnicę: zrywka układa stosy na poboczu drogi najbliżej szlaku, a ciężarówka je objeżdża.
const STACK_CAP=40;
function stackPos(e,s){const A=NODES[e.a],B=NODES[e.b],dx=(B[0]-A[0])/e.len,dy=(B[1]-A[1])/e.len,h=Math.atan2(dx,-dy),off=e.w/2+14,[cx,cy]=pointOn(e,s);
 return{x:cx+Math.cos(h)*off,y:cy+Math.sin(h)*off,ax:dx,ay:dy,nx:Math.cos(h),ny:Math.sin(h)}}
export function stackFor(x,y){
 const rp=nearestRoad(x,y,['forest'],{margin:60});
 let best=null;for(const st of J.stacks){const d=Math.hypot(st.x-rp.x,st.y-rp.y);if(d<150&&st.vol<STACK_CAP-2&&(!best||d<best.d))best={st,d}}
 if(best)return best.st;
 // nowy stos: nie bliżej niż 80 px od innego
 let s=rp.s;for(let k=0;k<6;k++){const p=stackPos(rp.edge,s);if(!J.stacks.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<80))break;s=clamp(s+(k%2?-1:1)*(k+1)*40,50,rp.edge.len-50)}
 const P=stackPos(rp.edge,s),st={id:J.nextStack++,edge:rp.edge,s,...P,vol:0,value:0,odd:oddzial(P.x,P.y)};J.stacks.push(st);return st;
}
export function restoreStack(edgeId,s,vol,value){const e=EDGES.find(q=>q.id===edgeId);if(!e)return null;const P=stackPos(e,s),st={id:J.nextStack++,edge:e,s,...P,vol,value,odd:oddzial(P.x,P.y)};J.stacks.push(st);return st}
export function addToStack(st,vol,value){st.vol+=vol;st.value+=value}
export function takeFromStack(st,vol){const q=Math.min(vol,st.vol),val=st.vol>0?st.value*q/st.vol:0;st.vol-=q;st.value-=val;if(st.vol<.05&&!J.truck.route.includes(st)&&J.truck.cur!==st)J.stacks=J.stacks.filter(z=>z!==st);return{q,val}}

// ── zrywka ──
export const MACH={
 tractor:{name:'ciągnik z wyciągarką',veh:'tractor',cap:6,reach:150,pull:36,rope:true},
 forwarder:{name:'forwarder z żurawiem',veh:'forwarder',cap:12,reach:95,pull:80,crane:true,price:18000}
};
const HOME={edge:edgeOf('sk','b1'),s:180};
const homeLabel=()=>MACH[J.skid.mach].name+' (w bazie maszyn)';
function spawnMachine(kind,atHome=true){
 const S=J.skid,M=MACH[kind];S.mach=kind;
 S.trac=atHome?new Vehicle(M.veh,{from:'sk',to:'b1',s:HOME.s}).parkHere():new Vehicle(M.veh,{from:'mE',to:'j2',s:0});
 S.trac.cap=M.cap;S.trac.label=homeLabel();S.phase='idle';S.list=[];S.cur=null;S.watch=0;
 if(!atHome){S.phase='arriving';S.trac.label=M.name+' jedzie do bazy';S.trac.goTo(HOME,{park:true,onArrive:()=>{S.phase='idle';S.trac.label=homeLabel()}})}
}
export function initJobs(){
 spawnMachine('tractor');
 // drewno z poprzedniego sezonu: dwa stosy przy drogach
 const a=stackFor(780,1300);addToStack(a,2.6,2.6*250);const b=stackFor(1760,850);addToStack(b,1.8,1.8*300);
}
export function buyForwarder(){
 const S=J.skid,M=MACH.forwarder;
 if(S.owned){toast('Forwarder już pracuje w leśnictwie.');return}
 if(!canAfford(M.price))return;
 if(S.phase!=='idle'){toast('Poczekaj, aż ciągnik skończy kurs i wróci do bazy.');return}
 pay(M.price,'zakup forwardera');S.owned=true;
 const old=S.trac;old.label='ciągnik odjeżdża (zastąpiony forwarderem)';old.goTo(goalNode('mE'),{leave:true});
 spawnMachine('forwarder',false);toast('Kupiono forwarder: 12 m³ ładunku, żuraw, szybciej w terenie. Utrzymanie '+zl(COST.fwd)+' dziennie.');
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
 const S=J.skid,v=S.trac,M=MACH[S.mach];if(!v)return;
 if(S.phase!=='idle'&&S.phase!=='arriving')S.watch+=dt;
 if(S.watch>240){   // zabezpieczenie: brak postępu przez 4 godziny gry — odholowanie do bazy
  for(const p of E.piles)if(p.state==='reserved'||p.state==='winch')p.state='ground';
  if(S.target)S.target.skipT=state.elapsed+600;
  const load=v.load,val=S.val||0;v.dead=true;spawnMachine(S.mach);
  if(load>0){const st=stackFor(S.trac.pos[0],S.trac.pos[1]);addToStack(st,load,val)}
  toast(M.name[0].toUpperCase()+M.name.slice(1)+' utknął — odholowano go do bazy, ładunek złożono przy drodze.');return;
 }
 if(S.phase==='idle'){
  if(!cal.work(7,17))return;
  const free=freePiles();if(!free.length){if(!v.parked&&v.arrived===true&&S.atHome!==true){}return}
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
  if(d<12){v.load+=p.vol;S.val=(S.val||0)+p.vol*SP[p.sp].price;p.dead=true;S.cur=null;S.wait=M.crane?.5:.8;S.watch=0;sfx(M.crane?'log':'clunk');return}
  const st=Math.min(d,M.pull*dt);p.x+=dx/d*st;p.y+=dy/d*st;p.a+=clamp(Math.atan2(dy,dx)-p.a,-dt*2,dt*2);
  if(M.rope&&rand()<dt*10)particle('dust',p.x,p.y,{col:'#a88c62'});
 }else if(S.phase==='unload'){
  // rozładunek na stos przy drodze (kłody lecą z przyczepy na stos)
  const st=S.stack,q=Math.min(v.load,dt*1.6),frac=v.load>0?q/v.load:1,vv=(S.val||0)*frac;
  v.load-=q;S.val=(S.val||0)-vv;addToStack(st,q,vv);S.delivered=(S.delivered||0)+q;
  if(rand()<dt*8)particle('dust',st.x+(rand()-.5)*20,st.y+(rand()-.5)*20,{col:'#b8a07a'});
  if(v.load<=.001){
   const d=S.delivered||0;v.load=0;S.val=0;S.delivered=0;S.watch=0;
   if(d>0){pay(Math.round(d*COST.skid),'zrywka');planProgress('cut',d);toast('Przy drodze w oddz. '+st.odd+' złożono '+displayNumber(d,1)+' m³ (stos: '+displayNumber(st.vol,1)+' m³).')}
   if(freePiles().length&&cal.work(7,17)){S.phase='idle';}
   else{S.phase='home';v.label=M.name+' wraca do bazy';v.goTo(HOME,{park:true,onArrive:()=>{S.phase='idle';S.atHome=true;v.label=homeLabel()}})}
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
  if(v.load<=.001){S.phase='home';v.label=M.name+' wraca do bazy';v.goTo(HOME,{park:true,onArrive:()=>{S.phase='idle';S.atHome=true;v.label=homeLabel()}});return}
  const st=S.stack=stackFor(v.pos[0],v.pos[1]);S.phase='tostack';v.label=M.name+' wiezie '+displayNumber(v.load,1)+' m³ na stos przy drodze';
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
 if(stackTotal()<1){if(manual)toast('Przy drogach prawie nie ma drewna ('+displayNumber(stackTotal(),1)+' m³).');return}
 if(!cal.work(8,15)){T.pending=true;if(manual)toast('Wywóz zamówiony — ciężarówka przyjedzie '+cal.nextStart(8,16)+'.');return}
 T.pending=false;
 // trasa: stosy od największego, potem po kolei najbliższe
 const cand=J.stacks.filter(s=>s.vol>.5).sort((a,b)=>b.vol-a.vol);let cap=30,route=[],pos=[NODES.j2[0],NODES.j2[1]];
 while(cand.length&&cap>0){cand.sort((a,b)=>Math.hypot(a.x-pos[0],a.y-pos[1])-Math.hypot(b.x-pos[0],b.y-pos[1]));const s=cand.shift();route.push(s);cap-=s.vol;pos=[s.x,s.y]}
 T.route=route;T.v=new Vehicle('truck',{from:'mE',to:'j2',s:0,allow:['main','forest']});T.v.cap=30;T.v.label='ciężarówka po drewno';T.val=0;
 toast((manual?'Ciężarówka jedzie po drewno':'Nadleśnictwo wysłało ciężarówkę')+' — stosów do odbioru: '+route.length+'.');
 nextStop();
}
function nextStop(){
 const T=J.truck,v=T.v;T.cur=T.route.shift()||null;
 if(!T.cur||v.load>=v.cap-.3){
  const pay_=Math.round((T.val||0)*ECO.market);T.val=0;
  if(v.load>0){earn(pay_,'sprzedaż drewna');J.sold+=v.load;stat('sold',v.load);toast('Sprzedano '+displayNumber(v.load,1)+' m³ drewna za '+zl(pay_)+' (cena rynkowa ×'+displayNumber(ECO.market,2)+').')}
  for(const s of T.route)if(s.vol<.05)J.stacks=J.stacks.filter(z=>z!==s);T.route=[];
  T.phase='leaving';v.label='ciężarówka odjeżdża z drewnem';v.goTo(goalNode('mW'),{leave:true});return}
 T.phase='coming';v.label='ciężarówka jedzie do stosu w oddz. '+T.cur.odd;
 v.goTo({edge:T.cur.edge,s:T.cur.s},{park:true,onArrive:()=>{T.phase='load';T.wait=1;v.label='załadunek żurawiem HDS'}});
}
function truckUpdate(dt){
 const T=J.truck,v=T.v;
 if(!v){if((T.pending||(J.auto&&stackTotal()>=16))&&cal.work(8,15))orderTruck(T.pending);return}
 if(v.dead){T.v=null;T.phase='idle';T.cur=null;return}
 if(T.phase==='load'){
  if(T.wait>0){T.wait-=dt;return}
  const st=T.cur,want=Math.min(dt*1.4,v.cap-v.load);const {q,val}=takeFromStack(st,want);v.load+=q;T.val=(T.val||0)+val;
  T.craneT=(T.craneT||0)+dt;if(rand()<dt*3)sfx('log');
  if(st.vol<.05||v.load>=v.cap-.05){if(st.vol<.05)J.stacks=J.stacks.filter(z=>z!==st);T.wait=0;nextStop()}
 }
}
// Drewno opałowe dla ludności: kupujący odbiera je sam ze stosu.
export function opalStack(vol){const c=J.stacks.filter(s=>s.vol>=vol+.2&&s!==J.truck.cur&&!J.truck.route.includes(s));if(!c.length)return null;return c.sort((a,b)=>Math.hypot(a.x-560,a.y-300)-Math.hypot(b.x-560,b.y-300))[0]}
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
 for(const st of J.stacks){
  if(st.vol<.05)continue;
  const n=clamp(Math.ceil(st.vol*1.1),1,14),L=34,{x,y,ax,ay,nx,ny}=st;
  g.save();g.translate(Math.round(x),Math.round(y));g.rotate(Math.atan2(ay,ax));   // oś X wzdłuż drogi
  const side=Math.sign(nx*-ay+ny*ax)||1;   // na zewnątrz drogi
  g.fillStyle='#2b3b2a40';g.fillRect(-L/2+3,3*side,L,n*4*side);
  for(const ox of [-10,8])rect2(g,-L/2+ox+8,-2*side,3,(n*4+4)*side,'#5a4634');   // podkłady
  for(let k=0;k<n;k++){const yy=side>0?k*4:-(k+1)*4,top=k>=n-3;
   rect2(g,-L/2,yy,L,4,'#4a3624');rect2(g,-L/2,yy+1,L,2,top?'#b8844a':'#9a6a40');rect2(g,-L/2,yy,2,4,'#e3c08a');rect2(g,L/2-2,yy,2,4,'#d8b47c')}
  g.restore();
 }
}
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
