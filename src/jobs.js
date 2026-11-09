// Prace leśne: wyznaczanie drzew, ekipa pilarzy (ścinka, wyrzynka, sadzenie), ciągnik zrywkowy (wyciągarka → składnica),
// ciężarówka (wywóz i sprzedaż). Wszystko jeździ samo po drogach — gracz tylko wydaje polecenia.
import {state,toast,particle,clamp,zl,displayNumber,ctx,cal} from './core.js';
import {STACK,SKLAD,roadClearance,oddzial,inRect,YARD,UPRAWA,pointBlocked} from './map.js';
import {nearestRoad,goalNode,edgeOf} from './roads.js';
import {paintRut} from './paint.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,rand,cartRear,cartFront} from './life/agents.js';
import {trees,STAND,STUMP,CUT_AGE,SP,startFall,finishTree,plantTree,volume,crownR,speciesFor,treesIn,SAPLING_AGE} from './forest.js';
import {pay,earn,planProgress,stat} from './economy.js';
import {sfx} from './sound.js';
import {pileTop} from './life/sprites.js';

export const COST={fell:85,plant:7,skid:28};
export const J={plants:[],trails:[],crew:{van:null,phase:'idle',tasks:[],cluster:[],workers:[]},skid:{trac:null,phase:'idle',mach:'tractor',list:[],cur:null,wait:0,watch:0,owned:false},
 truck:{v:null,phase:'idle'},stack:0,stackValue:0,sold:0,auto:true};

// ── polecenia gracza ──
export function toggleMark(t){
 if(!t||t.st!==STAND||t.falling||t.lying){return false}
 if(t.assigned){toast('To drzewo jest już w pracy ekipy.');return false}
 if(t.age<CUT_AGE){toast('Za młode do wycinki ('+Math.round(t.age)+' lat) — zostaw je, niech rośnie.');return false}
 t.marked=!t.marked;sfx(t.marked?'mark':'unmark');return true;
}
export function canPlant(x,y){
 if(roadClearance(x,y)<8)return 'Nie sadzimy na drodze.';
 if(inRect(x,y,YARD,8)||inRect(x,y,SKLAD,8)||pointBlocked(x,y,6))return 'Tu nie da się sadzić.';
 if(treesIn(x-12,y-12,x+12,y+12).some(t=>t.st===STAND&&Math.hypot(t.x-x,t.y-y)<(t.age<SAPLING_AGE?9:Math.max(9,crownR(t)*.4))))return 'Za blisko innego drzewa.';
 if(J.plants.some(p=>Math.hypot(p.x-x,p.y-y)<10))return 'Tu już jest zaplanowana sadzonka.';
 return null;
}
export function togglePlant(x,y){
 const ex=J.plants.find(p=>Math.hypot(p.x-x,p.y-y)<8&&!p.assigned);
 if(ex){J.plants=J.plants.filter(p=>p!==ex);sfx('unmark');return}
 const why=canPlant(x,y);if(why){toast(why);return}
 J.plants.push({x,y,sp:speciesFor(x,y),assigned:false});sfx('mark');
}
export const pendingCount=()=>trees.filter(t=>t.marked&&!t.assigned).length+J.plants.filter(p=>!p.assigned).length;
export function dispatchCrew(){
 const C=J.crew,fell=trees.filter(t=>t.marked&&!t.assigned),pl=J.plants.filter(p=>!p.assigned);
 if(!fell.length&&!pl.length){toast('Brak zadań: wyznacz drzewa (klawisz 2) albo miejsca sadzenia (3).');return}
 for(const t of fell){t.assigned=true;C.tasks.push({type:'fell',t})}
 for(const p of pl){p.assigned=true;C.tasks.push({type:'plant',p})}
 if(C.phase==='idle'){
  if(cal.work(7,14.5)){startCrew();toast('Ekipa wyjeżdża: '+fell.length+' do wycinki, '+pl.length+' do posadzenia.')}
  else toast('Zlecenie przyjęte ('+(fell.length+pl.length)+'). Ekipa przyjedzie '+cal.nextStart(7,15)+'.');
 }else toast('Ekipa dostała dodatkowe zadania ('+(fell.length+pl.length)+').');
}
// Zadania z powierzchni odnowieniowej (sadzenie w rzędach) trafiają do tej samej ekipy.
export function addCrewTasks(tasks,msg){
 const C=J.crew;C.tasks.push(...tasks);
 if(C.phase==='idle'){if(cal.work(7,14.5)){startCrew();toast(msg+' Ekipa wyjeżdża.')}else toast(msg+' Ekipa przyjedzie '+cal.nextStart(7,15)+'.')}
 else toast(msg+' Ekipa ma je na liście.');
}
// Ekipa pracuje pon.–sob. 7:00–15:00. Zlecenie poza godzinami czeka do rana.
function startCrew(){const C=J.crew;C.van=new Vehicle('van',{from:'mE',to:'j2',s:0});C.van.label='ekipa leśna';nextCluster()}
const shiftOn=()=>cal.work(7,15);
const tpos=k=>k.type==='fell'?[k.t.x,k.t.y]:[k.p.x,k.p.y];
function nextCluster(){
 const C=J.crew,v=C.van;
 if(!C.tasks.length||!shiftOn()){
  const left=C.tasks.length;C.phase='leaving';v.label=left?'koniec dniówki — ekipa wraca jutro':'ekipa wraca do bazy';
  if(left)toast('Koniec dniówki. Ekipa wróci '+cal.nextStart(7,15)+' (zostało zadań: '+left+').');
  v.goTo(goalNode('mE'),{leave:true,onArrive:()=>{C.phase='idle';C.van=null}});return}
 const [vx,vy]=v.pos;C.tasks.sort((a,b)=>{const A=tpos(a),B=tpos(b);return Math.hypot(A[0]-vx,A[1]-vy)-Math.hypot(B[0]-vx,B[1]-vy)});
 const [fx,fy]=tpos(C.tasks[0]),rp=nearestRoad(fx,fy,['main','forest'],{margin:50});
 // skupisko wokół pierwszego zadania (nie wokół drogi) — zadania głęboko w lesie też trafią do ekipy
 C.cluster=C.tasks.filter(k=>{const [x,y]=tpos(k);return Math.hypot(x-fx,y-fy)<260});
 C.tasks=C.tasks.filter(k=>!C.cluster.includes(k));
 C.phase='driving';C.odd=oddzial(fx,fy);v.label='ekipa jedzie do oddz. '+C.odd;
 v.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:startWork});
}
function startWork(v){
 const C=J.crew;C.phase='working';v.label='ekipa pracuje w oddz. '+C.odd;
 const h=v.heading,[cx,cy]=C.cluster.length?tpos(C.cluster[0]):v.pos,side=Math.sign(Math.cos(h)*(cx-v.pos[0])+Math.sin(h)*(cy-v.pos[1]))||1;
 const plants=C.cluster.filter(k=>k.type==='plant').length,n=Math.min(plants>=10?4:C.cluster.length>=6?3:2,Math.max(1,C.cluster.length));
 for(let i=0;i<n;i++){
  const w=new Ped({kind:'worker',x:v.pos[0]+Math.cos(h)*16*side+Math.sin(h)*(i*10-5),y:v.pos[1]+Math.sin(h)*16*side-Math.cos(h)*(i*10-5),speed:15});
  w.label='pilarz';w.onIdle=assignNext;C.workers.push(w);
 }
}
const vanDoor=()=>{const v=J.crew.van,h=v.heading;return[v.pos[0]+Math.cos(h)*16,v.pos[1]+Math.sin(h)*16]};
function assignNext(w){
 const C=J.crew;let task=C.cluster.shift();
 if(task&&!shiftOn()){C.tasks.push(task,...C.cluster);C.cluster=[];task=null}   // 15:00 — koniec pracy, reszta jutro
 if(!task){w.onIdle=null;w.run([{go:vanDoor()},{call:q=>{q.hidden=true;q.dead=true;C.workers=C.workers.filter(x=>x!==q);if(!C.workers.length)nextCluster()}}]);return}
 if(task.type==='fell'){
  const t=task.t;if(t.st!==STAND){assignNext(w);return}
  const rp=nearestRoad(t.x,t.y,['main','forest']);
  // kierunek obalenia: od drogi, z odchyleniem — pień nie ląduje na jezdni
  let dir=Math.atan2(t.y-rp.y,t.x-rp.x)+(rand()-.5)*1.2;
  const stand=[t.x-Math.cos(dir)*9+Math.cos(dir+1.57)*5,t.y-Math.sin(dir)*9+Math.sin(dir+1.57)*5];
  w.label='pilarz — ścina '+SP[t.sp].name.split(' ')[0];
  w.run([{go:stand,face:[t.x,t.y]},
   {wait:3.4,pose:'saw',face:[t.x,t.y],tick:(q,dt)=>{if(rand()<dt*18)particle('dust',t.x+(rand()-.5)*6,t.y+(rand()-.5)*6,{col:'#e3c08a',size:1+rand()*2})}},
   {call:()=>{w.label='„Uwaga, drzewo!”';t.onLand=()=>{sfx('crash');for(let k=0;k<14;k++)particle('dust',t.x+Math.cos(dir)*t.lying.L*rand(),t.y+Math.sin(dir)*t.lying.L*rand(),{col:'#c8b48a',size:2+rand()*3})};startFall(t,dir);sfx('creak')}},
   {wait:2.1,pose:'stand',face:[t.x,t.y]},
   {go:[t.x+Math.cos(dir)*fallMid(t)+Math.cos(dir+1.57)*8,t.y+Math.sin(dir)*fallMid(t)+Math.sin(dir+1.57)*8]},
   {wait:2.6,pose:'saw',face:[t.x+Math.cos(dir)*fallMid(t),t.y+Math.sin(dir)*fallMid(t)],tick:(q,dt)=>{if(rand()<dt*14)particle('dust',q.x+Math.cos(q.heading)*10,q.y+Math.sin(q.heading)*10,{col:'#e3c08a'})}},
   {call:()=>{makePile(t,dir);finishTree(t);t.assigned=false;pay(COST.fell,'ścinka i wyrzynka');stat('felled');w.label='pilarz'}}]);
 }else{
  const p=task.p;w.label='pilarz — sadzi '+SP[p.sp].name.split(' ')[0];
  w.prop='sapling';
  w.run([{go:[p.x-7,p.y],face:[p.x,p.y]},{wait:p.plot?1:1.8,pose:'kneel',face:[p.x,p.y]},
   {call:()=>{plantTree(p.x,p.y,p.sp,!!p.prep);J.plants=J.plants.filter(q=>q!==p);pay(COST.plant,'sadzonka i sadzenie');planProgress('plant',1);w.label='pilarz';w.prop=null;p.onDone&&p.onDone()}}]);
 }
}
const fallMid=t=>(t.falling?t.falling.L:t.lying?t.lying.L:60)*.45;
function makePile(t,dir){
 const L=t.lying?t.lying.L:60,vol=Math.max(.08,volume(t));
 E.piles.push({x:t.x+Math.cos(dir)*L*.45,y:t.y+Math.sin(dir)*L*.45,a:dir,vol,sp:t.sp,logs:clamp(Math.round(vol*3)+1,1,6),bark:SP[t.sp].bark[1]==='#2e2c28'?'#e6e2d6':SP[t.sp].bark[1],state:'ground',dead:false});
}

// ── zrywka (0.3) ──
// Maszyna jedzie drogą do punktu najbliżej kłód. Gdy kłody leżą dalej niż zasięg wyciągarki/żurawia, zjeżdża w las
// szlakiem zrywkowym (ścieżka A*, zostają koleiny), ładuje wszystko w zasięgu, jedzie do kolejnych kłód i wraca na drogę.
export const MACH={
 tractor:{name:'ciągnik z wyciągarką',veh:'tractor',cap:6,reach:150,pull:36,rope:true},
 forwarder:{name:'forwarder z żurawiem',veh:'forwarder',cap:12,reach:95,pull:80,crane:true,price:12000}
};
const HOME={edge:edgeOf('sk','b1'),s:180},TRUCK_AT={edge:edgeOf('sk','b1'),s:30};
const homeLabel=()=>MACH[J.skid.mach].name+' (czeka na składnicy)';
function spawnMachine(kind,atHome=true){
 const S=J.skid,M=MACH[kind];S.mach=kind;
 S.trac=atHome?new Vehicle(M.veh,{from:'sk',to:'b1',s:HOME.s}).parkHere():new Vehicle(M.veh,{from:'mE',to:'j2',s:0});
 S.trac.cap=M.cap;S.trac.label=homeLabel();S.phase='idle';S.list=[];S.cur=null;S.watch=0;
 if(!atHome){S.phase='arriving';S.trac.label=M.name+' jedzie na składnicę';S.trac.goTo(HOME,{park:true,onArrive:()=>{S.phase='idle';S.trac.label=homeLabel()}})}
}
export function initJobs(){spawnMachine('tractor');J.stack=4.2;J.stackValue=4.2*260}
export function buyForwarder(){
 const S=J.skid,M=MACH.forwarder;
 if(S.owned){toast('Forwarder już pracuje w leśnictwie.');return}
 if(state.money<M.price){toast('Za mało pieniędzy na forwarder ('+zl(M.price)+').');return}
 if(S.phase!=='idle'){toast('Poczekaj, aż ciągnik skończy kurs i wróci na składnicę.');return}
 pay(M.price,'zakup forwardera');S.owned=true;
 const old=S.trac;old.label='ciągnik odjeżdża (zastąpiony forwarderem)';old.goTo(goalNode('mE'),{leave:true});
 spawnMachine('forwarder',false);toast('Kupiono forwarder: 12 m³ ładunku, żuraw, szybciej w terenie.');
}
// punkt, z którego maszyna ładuje: tył przyczepy (wyciągarka) albo podstawa żurawia
const anchor=v=>J.skid.mach==='forwarder'?cartFront(v.cart):cartRear(v.cart);
function rutWork(v,step){v.rutAcc=(v.rutAcc||0)+step;if(v.rutAcc>2){v.rutAcc=0;paintRut(v.pos[0],v.pos[1],v.heading,v.spec.hw*.65);if(v.cart){const c=v.cart;paintRut(c.x,c.y,c.angle,12)}}}
// Ścieżka w teren do miejsca, skąd kłoda jest w zasięgu (A* po siatce pieszych — omija budynki, płoty i grodzenia).
function pathTo(v,tx,ty,stop){
 let p=NAV.foot.findPath(v.pos[0],v.pos[1],tx,ty);if(!p||!p.length)p=[[tx,ty]];
 const out=[];let px=v.pos[0],py=v.pos[1];
 for(const q of p){
  if(Math.hypot(q[0]-tx,q[1]-ty)<=stop){const L=Math.hypot(q[0]-px,q[1]-py)||1;let lo=0,hi=1;
   for(let k=0;k<12;k++){const m=(lo+hi)/2,x=px+(q[0]-px)*m,y=py+(q[1]-py)*m;if(Math.hypot(x-tx,y-ty)<=stop)hi=m;else lo=m}
   out.push([px+(q[0]-px)*hi,py+(q[1]-py)*hi]);break}
  out.push(q);px=q[0];py=q[1];
 }
 return out;
}
const freePiles=()=>E.piles.filter(p=>p.state==='ground'&&!p.dead&&!(p.skipT>state.elapsed));
function skidUpdate(dt){
 const S=J.skid,v=S.trac,M=MACH[S.mach];if(!v)return;
 if(S.phase!=='idle'&&S.phase!=='arriving')S.watch+=dt;
 // zabezpieczenie: maszyna bez postępu przez 4 godziny gry — odholowanie na składnicę
 if(S.watch>240){
  for(const p of E.piles)if(p.state==='reserved'||p.state==='winch')p.state='ground';
  if(S.target)S.target.skipT=state.elapsed+600;
  const load=v.load;v.dead=true;spawnMachine(S.mach);S.trac.load=load;if(load>0){S.phase='unload'}
  toast(M.name[0].toUpperCase()+M.name.slice(1)+' utknął — odholowano go na składnicę.');return;
 }
 if(S.phase==='idle'){
  if(!cal.work(7,17))return;
  const free=freePiles();if(!free.length)return;
  const [vx,vy]=v.pos;free.sort((a,b)=>Math.hypot(a.x-vx,a.y-vy)-Math.hypot(b.x-vx,b.y-vy));
  const p=free[0],rp=nearestRoad(p.x,p.y,['main','forest'],{margin:60});
  S.target=p;S.rp=rp;S.went=false;S.phase='driving';S.watch=0;
  v.label=M.name+' jedzie po drewno do oddz. '+oddzial(p.x,p.y);
  const near=Math.hypot(p.x-rp.x,p.y-rp.y)<=M.reach-12;
  v.goTo({edge:rp.edge,s:rp.s},{park:near,onArrive:()=>{S.watch=0;if(near)startLoad();else goIn(p)}});
 }else if(S.phase==='load'){
  if(S.wait>0){S.wait-=dt;return}
  if(!S.cur){
   while(S.list.length&&(S.list[0].dead))S.list.shift();
   S.cur=v.load<v.cap-.3?S.list.shift()||null:null;
   if(S.cur){S.cur.state='winch';sfx('winch')}
  }
  if(!S.cur){
   for(const p of S.list)if(p.state==='reserved')p.state='ground';S.list=[];
   // kolejne kłody w pobliżu — jedziemy dalej w terenie
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
  const q=Math.min(v.load,dt*1.5),frac=v.load>0?q/v.load:1,vv=(S.val||0)*frac;
  v.load-=q;S.val=(S.val||0)-vv;J.stack+=q;J.stackValue+=vv;S.delivered=(S.delivered||0)+q;
  if(v.load<=.001){
   const d=S.delivered||0;v.load=0;S.val=0;S.delivered=0;S.phase='idle';S.watch=0;v.label=homeLabel();
   if(d>0){pay(Math.round(d*COST.skid),'zrywka');planProgress('cut',d);toast('Na składnicę trafiło '+displayNumber(d,1)+' m³ drewna.')}
  }
 }
}
const reachD=(v,p)=>{const [ax,ay]=anchor(v);return Math.min(Math.hypot(p.x-ax,p.y-ay),Math.hypot(p.x-v.pos[0],p.y-v.pos[1]))};
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
 if(L>30)J.trails.push([[Math.round(v.pos[0]),Math.round(v.pos[1])],...pts.map(q=>[Math.round(q[0]),Math.round(q[1])])]);
 v.label=M.name+' jedzie szlakiem zrywkowym';
 v.driveOff(pts,{work:rutWork,onArrive:()=>{S.watch=0;startLoad()}});
}
function comeBack(){
 const S=J.skid,v=S.trac,M=MACH[S.mach];
 const goHome=()=>{S.phase='home';S.watch=0;v.label=M.name+' wiezie '+displayNumber(v.load,1)+' m³ na składnicę';v.goTo(HOME,{park:true,onArrive:()=>{S.phase='unload';S.watch=0;v.label='rozładunek na składnicy'}})};
 if(v.load<=.001&&!S.went){S.phase='idle';v.label=homeLabel();v.goTo(HOME,{park:true});return}
 if(!S.went){goHome();return}
 // z powrotem na drogę najkrótszą ścieżką
 const rp=nearestRoad(v.pos[0],v.pos[1],['main','forest'],{margin:40});
 const pts=pathTo(v,rp.x,rp.y,0);S.phase='out';S.went=false;v.label=M.name+' wraca szlakiem na drogę';
 v.driveOff(pts,{work:rutWork,onArrive:()=>{v.rejoin();goHome()}});
}
// ── wywóz: ciężarówka ładuje stos i płaci ──
export function orderTruck(manual=true){
 const T=J.truck;
 if(T.v){if(manual)toast('Ciężarówka już jest w drodze.');return}
 if(J.stack<1){if(manual)toast('Na składnicy prawie nie ma drewna ('+displayNumber(J.stack,1)+' m³).');return}
 if(!cal.work(8,15)){T.pending=true;if(manual)toast('Wywóz zamówiony — ciężarówka przyjedzie '+cal.nextStart(8,16)+'.');return}
 T.pending=false;T.v=new Vehicle('truck',{from:'mE',to:'j2',s:0});T.v.cap=30;T.v.label='ciężarówka po drewno';T.phase='coming';
 toast(manual?'Ciężarówka jedzie po drewno ze składnicy.':'Nadleśnictwo wysłało ciężarówkę po drewno ze składnicy.');
 T.v.goTo(TRUCK_AT,{park:true,onArrive:()=>{T.phase='load';T.v.label='załadunek drewna'}});
}
function truckUpdate(dt){
 const T=J.truck,v=T.v;
 if(!v){if((T.pending||(J.auto&&J.stack>=16))&&cal.work(8,15))orderTruck(T.pending);return}
 if(v.dead){T.v=null;T.phase='idle';return}
 if(T.phase==='load'){
  const q=Math.min(J.stack,dt*1.6,v.cap-v.load);
  const val=J.stack>0?J.stackValue*(q/J.stack):0;J.stack-=q;J.stackValue-=val;v.load+=q;T.val=(T.val||0)+val;
  if(rand()<dt*6)sfx('log');
  if(J.stack<=.01||v.load>=v.cap-.01){
   const pay_=Math.round(T.val||0);T.val=0;earn(pay_,'sprzedaż drewna');J.sold+=v.load;stat('sold',v.load);
   toast('Sprzedano '+displayNumber(v.load,1)+' m³ drewna za '+zl(pay_)+'.');
   T.phase='leaving';v.label='ciężarówka odjeżdża z drewnem';v.goTo(goalNode('mW'),{leave:true});
  }
 }
}
export function updateJobs(dt){
 const C=J.crew;if(C.phase==='idle'&&C.tasks.length&&cal.work(7,14.5))startCrew();
 skidUpdate(dt);truckUpdate(dt)}

// ── rysowanie: stos na składnicy, kłody, liny wyciągarki ──
export function drawStack(g){
 const S=STACK,n=Math.min(150,Math.round(J.stack*3));
 const colW=34,rows=14;
 for(let i=0;i<n;i++){
  const col=Math.floor(i/rows),row=i%rows;if(col>=6)break;
  const x=S.x+4+col*colW,y=S.y+S.h-8-row*6;
  rect2(g,x,y,30,6,'#4a3624');rect2(g,x,y+1,30,4,i%3?'#a8743f':'#9a6a40');rect2(g,x,y,2,6,'#e3c08a');rect2(g,x+28,y,2,6,'#d8b47c');
 }
}
const rect2=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h)};
export function drawGroundItems(g){
 for(const p of E.piles)if(!p.dead)pileTop(g,p);
 for(const p of J.plants){g.strokeStyle=p.assigned?'#a6e07a':'#7ae07a';g.lineWidth=1;g.strokeRect(Math.round(p.x)-3.5,Math.round(p.y)-3.5,7,7);rect2(g,p.x-1,p.y-1,2,2,'#3f744c')}
}
export function drawRopes(g){
 const S=J.skid,v=S.trac;if(S.phase!=='load'||!S.cur||!v)return;
 const [wx,wy]=anchor(v),p=S.cur;
 if(MACH[S.mach].crane){
  // żuraw: dwa ramiona ze stawem uniesionym nad linią, chwytak nad kłodą
  const mx=(wx+p.x)/2,my=(wy+p.y)/2-18;
  for(const [w,c] of [[5,'#2a2a26'],[3,'#d8b23a']]){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(wx,wy);g.lineTo(mx,my);g.lineTo(p.x,p.y-4);g.stroke()}
  g.lineCap='butt';rect2(g,p.x-4,p.y-7,8,5,'#3a3a36');rect2(g,p.x-3,p.y-6,6,3,'#8a8a80');
 }else{g.strokeStyle='#2a2a26';g.lineWidth=1;g.beginPath();g.moveTo(Math.round(wx)+.5,Math.round(wy)+.5);g.lineTo(Math.round(p.x)+.5,Math.round(p.y)+.5);g.stroke()}
}
