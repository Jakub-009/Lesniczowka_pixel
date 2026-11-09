// Prace leśne: wyznaczanie drzew, ekipa pilarzy (ścinka, wyrzynka, sadzenie), ciągnik zrywkowy (wyciągarka → składnica),
// ciężarówka (wywóz i sprzedaż). Wszystko jeździ samo po drogach — gracz tylko wydaje polecenia.
import {state,toast,particle,clamp,zl,displayNumber,ctx,cal} from './core.js';
import {STACK,SKLAD,roadClearance,oddzial,inRect,YARD,UPRAWA,pointBlocked} from './map.js';
import {nearestRoad,goalNode,edgeOf} from './roads.js';
import {E} from './ents.js';
import {Vehicle,Ped,rand} from './life/agents.js';
import {trees,STAND,STUMP,CUT_AGE,SP,startFall,finishTree,plantTree,volume,crownR,speciesFor,treesIn,SAPLING_AGE} from './forest.js';
import {pay,earn,planProgress,stat} from './economy.js';
import {sfx} from './sound.js';
import {pileTop} from './life/sprites.js';

export const COST={fell:85,plant:7,skid:28};
export const J={plants:[],crew:{van:null,phase:'idle',tasks:[],cluster:[],workers:[]},skid:{trac:null,phase:'idle',cluster:[],cur:null,wait:0},
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
 C.cluster=C.tasks.filter(k=>{const [x,y]=tpos(k);return Math.hypot(x-rp.x,y-rp.y)<330});
 C.tasks=C.tasks.filter(k=>!C.cluster.includes(k));
 C.phase='driving';C.odd=oddzial(fx,fy);v.label='ekipa jedzie do oddz. '+C.odd;
 v.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:startWork});
}
function startWork(v){
 const C=J.crew;C.phase='working';v.label='ekipa pracuje w oddz. '+C.odd;
 const h=v.heading,[cx,cy]=C.cluster.length?tpos(C.cluster[0]):v.pos,side=Math.sign(Math.cos(h)*(cx-v.pos[0])+Math.sin(h)*(cy-v.pos[1]))||1;
 const n=Math.min(C.cluster.length>=6?3:2,Math.max(1,C.cluster.length));
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
  w.run([{go:[p.x-7,p.y],face:[p.x,p.y]},{wait:1.8,pose:'kneel',face:[p.x,p.y]},
   {call:()=>{plantTree(p.x,p.y,p.sp);J.plants=J.plants.filter(q=>q!==p);pay(COST.plant,'sadzonka i sadzenie');planProgress('plant',1);w.label='pilarz'}}]);
 }
}
const fallMid=t=>(t.falling?t.falling.L:t.lying?t.lying.L:60)*.45;
function makePile(t,dir){
 const L=t.lying?t.lying.L:60,vol=Math.max(.08,volume(t));
 E.piles.push({x:t.x+Math.cos(dir)*L*.45,y:t.y+Math.sin(dir)*L*.45,a:dir,vol,sp:t.sp,logs:clamp(Math.round(vol*3)+1,1,6),bark:SP[t.sp].bark[1]==='#2e2c28'?'#e6e2d6':SP[t.sp].bark[1],state:'ground',dead:false});
}

// ── zrywka: ciągnik z przyczepą i wyciągarką ──
const HOME={edge:edgeOf('sk','b1'),s:180},TRUCK_AT={edge:edgeOf('sk','b1'),s:30};
export function initJobs(){
 const S=J.skid;S.trac=new Vehicle('tractor',{from:'sk',to:'b1',s:HOME.s});S.trac.label='ciągnik zrywkowy (czeka na składnicy)';S.trac.final=true;S.trac.stopS=HOME.s;S.trac.arrived=true;S.trac.parked=true;
 J.stack=4.2;J.stackValue=4.2*260;   // trochę drewna z poprzedniego sezonu
}
function winchPoint(v){const c=v.cart;return[c.x-Math.sin(c.angle)*33,c.y+Math.cos(c.angle)*33]}
function skidUpdate(dt){
 const S=J.skid,v=S.trac;if(!v)return;
 if(S.phase==='idle'){
  if(!cal.work(7,17))return;   // zrywka w dzień, pon.–sob.
  const free=E.piles.filter(p=>p.state==='ground'&&!p.dead);if(!free.length)return;
  const [vx,vy]=v.pos;free.sort((a,b)=>Math.hypot(a.x-vx,a.y-vy)-Math.hypot(b.x-vx,b.y-vy));
  const rp=nearestRoad(free[0].x,free[0].y,['main','forest'],{margin:60});
  S.cluster=free.filter(p=>Math.hypot(p.x-rp.x,p.y-rp.y)<320);for(const p of S.cluster)p.state='reserved';
  S.phase='driving';v.label='ciągnik jedzie po drewno do oddz. '+oddzial(rp.x,rp.y);
  v.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:()=>{S.phase='winch';S.cur=null;S.wait=1;v.label='zrywka: wyciągarka ciągnie kłody'}});
 }else if(S.phase==='winch'){
  if(S.wait>0){S.wait-=dt;return}
  if(!S.cur){S.cur=S.cluster.shift()||null;if(S.cur)S.cur.state='winch';sfx('winch')}
  if(!S.cur){
   const more=E.piles.some(p=>p.state==='ground'&&!p.dead);
   if(more&&v.load<v.cap-1){S.phase='idle';return}
   S.phase='home';v.label='ciągnik wiezie '+displayNumber(v.load,1)+' m³ na składnicę';
   v.goTo(HOME,{park:true,onArrive:()=>{S.phase='unload';v.label='rozładunek na składnicy'}});return;
  }
  const p=S.cur,[wx,wy]=winchPoint(v),dx=wx-p.x,dy=wy-p.y,d=Math.hypot(dx,dy);
  if(d<14){v.load+=p.vol;S.val=(S.val||0)+p.vol*SP[p.sp].price;p.dead=true;S.cur=null;S.wait=.8;sfx('clunk');return}
  const st=Math.min(d,38*dt);p.x+=dx/d*st;p.y+=dy/d*st;p.a+=clamp(Math.atan2(dy,dx)-p.a,-dt,dt);
  if(rand()<dt*10)particle('dust',p.x,p.y,{col:'#a88c62'});
 }else if(S.phase==='unload'){
  const q=Math.min(v.load,dt*1.5),frac=v.load>0?q/v.load:1,vv=(S.val||0)*frac;
  v.load-=q;S.val=(S.val||0)-vv;J.stack+=q;J.stackValue+=vv;S.delivered=(S.delivered||0)+q;
  if(v.load<=.001){
   const d=S.delivered;v.load=0;S.val=0;S.delivered=0;S.phase='idle';v.label='ciągnik zrywkowy (czeka na składnicy)';
   pay(Math.round(d*COST.skid),'zrywka');planProgress('cut',d);toast('Na składnicę trafiło '+displayNumber(d,1)+' m³ drewna.');
  }
 }
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
 const S=J.skid;if(S.phase!=='winch'||!S.cur||!S.trac)return;
 const [wx,wy]=winchPoint(S.trac);g.strokeStyle='#2a2a26';g.lineWidth=1;g.beginPath();g.moveTo(Math.round(wx)+.5,Math.round(wy)+.5);g.lineTo(Math.round(S.cur.x)+.5,Math.round(S.cur.y)+.5);g.stroke();
}
