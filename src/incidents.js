// Interwencje: nielegalny wjazd (quad, cross), śmieci, dym. Leśniczy jedzie terenówką automatycznie po drogach,
// gracz tylko decyduje, które zgłoszenie obsłużyć. Bez ręcznej jazdy.
import {state,toast,cal,hash,particle,clamp,zl,DOW} from './core.js';
import {oddzial,PARK_YARD,DOOR,YARD,roadClearance,EDGES,POLANA} from './map.js';
import {nearestRoad,goalNode,offMap} from './roads.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,Wild,Group,rand} from './life/agents.js';
import {pay,bumpProtect,bumpDamage,planProgress,stat} from './economy.js';
import {treesIn,STAND,STUMP,dirtyTree,crownR} from './forest.js';
import {sfx} from './sound.js';

let nextId=1;
const odd=(x,y)=>'oddz. '+oddzial(x,y);
function report(type,x,y,text,ref){
 const inc={id:nextId++,type,x,y,text,ref,status:'new',t:0,seen:0};E.incidents.push(inc);
 toast('Zgłoszenie: '+text);sfx('ping');return inc;
}
// ───────── śmieci ─────────
const JUNK=['bag','bottles','tire','bag'];
export function addTrash(x,y,kind){
 if(roadClearance(x,y)<4)x+=24;
 const t={x,y,kind:kind||JUNK[Math.floor(rand()*JUNK.length)],dead:false,seed:Math.floor(rand()*1e4),t:0,report:kind==='snare'?300+rand()*500:20+rand()*40};
 E.trash.push(t);return t;
}
// ───────── quad / cross ─────────
export function spawnRider(){
 const w=rand()<.5,kind=rand()<.6?'quad':'cross';
 const v=new Vehicle(kind,{from:w?'mW':'mE',to:w?'j1':'j2',s:0,color:['#c23a2b','#2f6a3a','#2a4a8a'][Math.floor(rand()*3)]});
 v.illegal=true;v.life=95+rand()*50;v.report=5+rand()*5;v.label=kind==='quad'?'quad (nielegalny wjazd)':'motocykl crossowy (nielegalny wjazd)';
 // najpierw w głąb lasu, potem krąży po drogach leśnych z postojami
 const E2=EDGES.filter(e=>e.kind==='forest'&&e.a!=='a3'&&e.b!=='l1'),e=E2[Math.floor(rand()*E2.length)];
 v.goTo({edge:e,s:40+rand()*(e.len-80)},{onArrive:q=>{q.arrived=false;q.final=false;q.stopS=null;q.route=null;q.roam=['forest']}});
 return v;
}
// ───────── dym ─────────
export function spawnSmoke(){
 for(let k=0;k<30;k++){const x=300+rand()*1900,y=200+rand()*1350;if(roadClearance(x,y)<90||Math.hypot(x-POLANA.x,y-POLANA.y)<POLANA.r)continue;
  const f={x,y,t:0,grow:0,dead:false,fire:true};E.trash.push(f);
  f.inc=report('fire',x,y,'Dym nad lasem w '+odd(x,y)+'!',f);return}
}
// ───────── kłusownik (noc) ─────────
const leave=v=>v.goTo(goalNode(v.pos[0]<1200?'mW':'mE'),{leave:true});
export function spawnPoacher(){
 const E2=EDGES.filter(e=>e.kind==='forest'&&e.a!=='a3'&&e.b!=='l1'),e=E2[Math.floor(rand()*E2.length)],s=50+rand()*(e.len-100),w=rand()<.5;
 const car=new Vehicle('car',{from:w?'mW':'mE',to:w?'j1':'j2',s:0,color:'#3a3d3a'});car.dark=true;car.poacher=true;car.label='samochód bez świateł';
 car.goTo({edge:e,s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*18,cy=v.pos[1]+Math.sin(h)*18;v.door=[cx,cy];
  const p=new Ped({kind:'driver',x:cx,y:cy,speed:13});p.label='kłusownik';p.snares=[];v.man=p;
  const spot=()=>{for(let k=0;k<12;k++){const a=rand()*6.283,d=80+rand()*160,x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;if(roadClearance(x,y)>40&&NAV.foot.walkable(x,y))return[x,y]}return[cx+60,cy]};
  const A=spot(),B=spot();
  p.run([{go:A},{wait:16,pose:'kneel'},{call:q=>q.snares.push(addTrash(q.x+5,q.y,'snare'))},{go:B},{wait:16,pose:'kneel'},{call:q=>q.snares.push(addTrash(q.x+5,q.y,'snare'))},
   {go:[cx,cy]},{call:q=>{q.dead=true;v.man=null;v.label='odjeżdża';leave(v)}}]);
  v.report=10+rand()*25;
 }});
}
// ───────── patrol: leśniczy + terenówka ─────────
export const P={car:null,ranger:null,dog:null,queue:[],cur:null,phase:'home'};
const CAR_EDGE=EDGES.find(e=>e.a==='l1'&&e.b==='yd');
const yardIdle=[
 r=>[{go:[DOOR[0],DOOR[1]+10]},{wait:5+rand()*6,pose:'stand',face:[DOOR[0],DOOR[1]-10]}],
 r=>[{go:[226,402]},{wait:5+rand()*4,pose:'kneel'}],
 r=>[{go:[330,436]},{wait:6+rand()*5,pose:'kneel',face:[330,400]}],
 r=>[{go:[490,384]},{wait:3+rand()*3,pose:'stand',face:[500,404]}],
 r=>[{go:[540,300]},{wait:4+rand()*6,pose:'stand',face:[640,300]}]
];
export function initPatrol(){
 P.car=new Vehicle('patrol',{from:'l1',to:'yd',s:CAR_EDGE.len-2});P.car.final=true;P.car.stopS=P.car.s;P.car.arrived=true;P.car.parked=true;P.car.laneX=0;P.car.label='terenówka (w leśniczówce)';
 P.ranger=new Ped({kind:'lesniczy',x:DOOR[0],y:DOOR[1]+12,speed:16,nav:'foot'});P.ranger.label='leśniczy (Ty)';P.ranger.onIdle=rangerIdle;
 P.dog=new Wild({kind:'dog',x:340,y:330,seed:4242,nav:'yard',group:new Group(340,330,3,{fixed:true}),follow:P.ranger,leash:70,col:'#3a2e26',col2:'#9a6a3a',flee:0,idleMin:1,idleVar:3});
 P.dog.name='Brzoza (jamnik leśniczego)';
}
function rangerIdle(r){
 if(P.phase!=='home')return;
 if(cal.night())r.run([{go:[DOOR[0],DOOR[1]+8]},{call:q=>{q.hidden=true;q.sleeping=true}}]);   // noc: leśniczy w domu
 else r.run(yardIdle[Math.floor(rand()*yardIdle.length)](r));
}
const carDoor=()=>{const v=P.car,h=v.heading;return[v.pos[0]-Math.cos(h)*14,v.pos[1]-Math.sin(h)*14]};
export function dispatch(inc){
 if(!inc||inc.status!=='new')return;
 inc.status='queued';P.queue.push(inc);
 if(P.phase==='home'||P.phase==='return')startNext();
 else toast('Patrol jest zajęty — zgłoszenie czeka w kolejce.');
}
function startNext(){
 const inc=P.queue.shift();
 if(!inc){goHome();return}
 P.cur=inc;inc.status='assigned';pay(35,'paliwo — wyjazd patrolu');
 if(P.ranger.hidden&&!P.ranger.sleeping){drive(inc);return}
 if(P.ranger.sleeping){const r=P.ranger;r.sleeping=false;r.hidden=false;r.x=DOOR[0];r.y=DOOR[1]+8;toast('Leśniczy wstaje i jedzie na interwencję.')}
 P.phase='boarding';P.ranger.onIdle=null;
 P.ranger.run([{go:carDoor()},{call:r=>{r.hidden=true;drive(inc)}}]);
}
function drive(inc){
 P.phase='driving';P.car.beacon=true;P.car.label='patrol jedzie: '+inc.text;
 if(inc.type==='quad'){chase(inc);return}
 const rp=nearestRoad(inc.x,inc.y,['main','forest']);
 P.car.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:()=>onSite(inc)});
}
let chaseT=0;
function chase(inc){const q=inc.ref,rp=nearestRoad(q.pos[0],q.pos[1],['main','forest']);P.car.goTo({edge:rp.edge,s:rp.s},{park:false,onArrive:()=>{chaseT=0}})}
function rangerOut(){const r=P.ranger,[x,y]=carDoor();r.x=x;r.y=y;r.hidden=false;r.heading=0;return r}
function onSite(inc){
 P.phase='onsite';P.car.beacon=false;
 if(inc.status==='gone'||(inc.ref&&inc.ref.dead&&inc.type!=='fire')){finish(inc,false);return}
 const r=rangerOut(),tx=inc.type==='quad'?inc.ref.pos[0]:inc.x,ty=inc.type==='quad'?inc.ref.pos[1]:inc.y;
 if(inc.type==='trash'){
  r.run([{go:[tx-6,ty]},{wait:2.2,pose:'kneel',face:[tx,ty]},{call:()=>{inc.ref.dead=true;r.prop='bag'}},{go:carDoor()},{call:q=>{q.hidden=true;q.prop=null;finish(inc,true)}}]);
 }else if(inc.type==='fire'){
  r.run([{go:[tx-10,ty+6]},{wait:5,pose:'saw',face:[tx,ty],tick:(q,dt)=>{inc.ref.grow=Math.max(0,inc.ref.grow-dt*.3)}},{call:()=>{inc.ref.dead=true}},{go:carDoor()},{call:q=>{q.hidden=true;finish(inc,true)}}]);
 }else if(inc.type==='poacher'){
  const v=inc.ref,m=v.man,door=v.door||v.pos;
  if(m&&!m.dead){m.run([{go:door},{wait:999,pose:'stand',until:()=>false}]);m.label='kłusownik — zatrzymany'}
  const steps=[{go:[door[0]-8,door[1]]},{wait:40,pose:'stand',face:door,until:()=>!m||m.dead||Math.hypot(m.x-door[0],m.y-door[1])<14},{wait:4,pose:'talk',face:door}];
  for(const sn of (m&&m.snares)||[])if(!sn.dead)steps.push({go:[sn.x-6,sn.y]},{wait:2,pose:'kneel',face:[sn.x,sn.y]},{call:()=>{sn.dead=true}});
  steps.push({call:()=>{inc.status='done';if(m){m.dead=true;v.man=null}v.label='odjeżdża — sprawa trafi na policję';leave(v)}},{go:carDoor()},{call:z=>{z.hidden=true;finish(inc,true)}});
  r.run(steps);
 }else{
  const q=inc.ref;
  r.run([{go:[tx-10,ty]},{wait:3.5,pose:'talk',face:[tx,ty]},{call:()=>{inc.status='done';q.stopped=false;q.speedMul=.6;q.label='odjeżdża po kontroli';q.goTo(goalNode(q.pos[0]<1200?'mW':'mE'),{leave:true})}},{go:carDoor()},{call:z=>{z.hidden=true;finish(inc,true)}}]);
 }
}
function finish(inc,ok){
 inc.status='done';P.cur=null;
 if(ok){
  const snare=inc.type==='trash'&&inc.ref.kind==='snare',gain=inc.type==='quad'?6:inc.type==='poacher'?9:inc.type==='fire'?5:snare?3:2;bumpProtect(gain);planProgress('handle',1);
  toast(inc.type==='quad'?'Kontrola zakończona: kierujący ukarany mandatem. Ochrona +'+gain+'%.':inc.type==='poacher'?'Kłusownik zatrzymany, wnyki zebrane. Ochrona +'+gain+'%.':inc.type==='fire'?'Zarzewie ugaszone. Ochrona +'+gain+'%.':snare?'Wnyki usunięte. Ochrona +'+gain+'%.':'Śmieci zebrane. Ochrona +'+gain+'%.');
 }
 startNext();
}
function goHome(){
 P.phase='return';P.car.beacon=false;P.car.label='patrol wraca do leśniczówki';
 P.car.goTo({edge:CAR_EDGE,s:CAR_EDGE.len-2},{park:true,onArrive:()=>{
  P.phase='home';P.car.label='terenówka (w leśniczówce)';
  const r=rangerOut();r.onIdle=rangerIdle;r.run([{go:[DOOR[0]+30,DOOR[1]+20]}]);
 }});
}
// ───────── aktualizacja ─────────
// Zdarzenia planowane na dzień (0.2): quad głównie w weekend po południu, dym w suche letnie dni, kłusownik nocą.
const TM={day:-1,rider:null,smoke:null,poach:null,first:true};
export function updateIncidents(dt){
 const d=Math.floor(state.days),se=cal.season();
 if(d!==TM.day){TM.day=d;const we=cal.dow()>=5;
  TM.rider=TM.first||rand()<(we?.75:.3)?d+(TM.first?13.5:10+rand()*8)/24:null;TM.first=false;
  TM.smoke=se===1&&rand()<.3?d+(11+rand()*7)/24:null;
  TM.poach=se!==3&&rand()<.3?d+(23+rand()*3)/24:null;
 }
 if(TM.rider&&state.days>=TM.rider){TM.rider=null;const h=cal.hour();if(h>9&&h<20.5)spawnRider()}
 if(TM.smoke&&state.days>=TM.smoke){TM.smoke=null;if(!E.incidents.some(q=>q.type==='fire'&&q.status!=='done'&&q.status!=='gone'))spawnSmoke()}
 if(TM.poach&&state.days>=TM.poach){TM.poach=null;spawnPoacher()}
 const r=P.ranger;if(r.sleeping&&!cal.night()&&P.phase==='home'){r.sleeping=false;r.hidden=false;r.x=DOOR[0];r.y=DOOR[1]+8;r.onIdle=rangerIdle}
 for(const v of E.vehicles){if(!v.poacher)continue;
  if(v.report!=null){v.report-=dt;if(v.report<=0){v.report=null;if(!v.dead)v.inc=report('poacher',v.pos[0],v.pos[1],'Nocą w '+odd(v.pos[0],v.pos[1])+' stoi samochód bez świateł — możliwe kłusownictwo.',v)}}
 }
 // jeźdźcy: zgłoszenie po kilku sekundach, potem „ostatnio widziany”; po czasie sami odjeżdżają
 for(const v of E.vehicles){if(!v.illegal)continue;
  v.life-=dt;
  if(v.roam&&!v.stopped&&v.dwell<=0&&rand()<dt*.05){v.dwell=4+rand()*5;v.label=(v.kind==='quad'?'quad':'crossowiec')+' kręci kółka na poboczu'}
  if(v.dwell>0&&rand()<dt*8)particle('dust',v.pos[0]+(rand()-.5)*20,v.pos[1]+(rand()-.5)*20,{col:'#b8a27a',size:2+rand()*3});
  if(v.report!=null){v.report-=dt;if(v.report<=0){v.report=null;if(!v.dead)v.inc=report('quad',v.pos[0],v.pos[1],(v.kind==='quad'?'Quad':'Motocykl crossowy')+' na drodze leśnej, '+odd(v.pos[0],v.pos[1])+'.',v)}}
  if(v.life<=0&&!v.stopped&&!v.leaving&&v.roam){v.leaving=true;v.goTo(goalNode(v.pos[0]<1200?'mW':'mE'),{leave:true})}
 }
 for(const t of E.trash){
  if(t.fire){t.t+=dt;if(!t.dead){t.grow=Math.min(1,t.grow+dt*.0065);if(rand()<dt*14)particle('smoke',t.x+(rand()-.5)*14*(1+t.grow),t.y,{vx:6+rand()*6,vy:-14-rand()*10,life:2.5+rand()*1.5,size:3+rand()*4*(1+t.grow)})}
   if(!t.dead&&t.grow>=1){t.dead=true;burn(t);t.inc.status='gone';stat('ignored');if(P.cur===t.inc&&P.phase==='driving'){P.cur=null;startNext()}bumpProtect(-7);bumpDamage(6);toast('Pożar w '+odd(t.x,t.y)+' ugasiła straż pożarna. Spłonął fragment drzewostanu.')}continue}
  if(t.dead)continue;t.t+=dt;
  if(!t.inc&&t.t>t.report)t.inc=report('trash',t.x,t.y,t.kind==='snare'?'Spacerowicz znalazł wnyki w '+odd(t.x,t.y)+'.':'Śmieci w lesie, '+odd(t.x,t.y)+'.',t);
 }
 for(const inc of E.incidents){
  inc.t+=dt;
  if(inc.type==='quad'&&inc.status!=='done'&&inc.status!=='gone'){
   const q=inc.ref;
   if(q.dead){inc.status='gone';stat('ignored');bumpProtect(-5);bumpDamage(1);toast((q.kind==='quad'?'Quad':'Crossowiec')+' odjechał bezkarnie. Ochrona −5%.');if(P.cur===inc){P.cur=null;startNext()}continue}
   inc.seen+=dt;if(inc.seen>4){inc.seen=0;inc.x=q.pos[0];inc.y=q.pos[1]}
   if(P.cur===inc&&P.phase==='driving'){
    const d=Math.hypot(P.car.pos[0]-q.pos[0],P.car.pos[1]-q.pos[1]);
    if(d<95){q.stopped=true;q.label='zatrzymany do kontroli';P.car.stopped=true;P.car.v=0;P.phase='onsite';P.car.final=true;P.car.stopS=P.car.s;P.car.arrived=true;onSite(inc)}
    else{chaseT-=dt;if(chaseT<=0||P.car.arrived){chaseT=2.5;chase(inc)}}
   }
  }
  if(inc.type==='trash'&&inc.ref.dead&&inc.status==='new')inc.status='done';
  if(inc.type==='poacher'&&inc.ref.dead&&inc.status!=='done'&&inc.status!=='gone'){inc.status='gone';stat('ignored');bumpProtect(-3);toast('Samochód bez świateł odjechał. W lesie mogły zostać wnyki.');if(P.cur===inc&&P.phase==='driving'){P.cur=null;startNext()}}
 }
 E.incidents=E.incidents.filter(q=>!((q.status==='done'||q.status==='gone')&&q.t>2&&(q.doneT=(q.doneT||0)+dt)>6));
}
// Pożar, którego nikt nie ugasił: drzewa w promieniu stają się spalonymi pniami.
function burn(f){
 for(const t of treesIn(f.x-70,f.y-70,f.x+70,f.y+70)){if(t.st!==STAND||Math.hypot(t.x-f.x,t.y-f.y)>70)continue;t.stumpR=clamp(crownR(t)*.2,3,8);t.st=STUMP;t.stumpAge=20;t.burnt=true;t.marked=false;dirtyTree(t)}
 E.burns=E.burns||[];E.burns.push({x:f.x,y:f.y,r:80});
}
export const openIncidents=()=>E.incidents.filter(q=>q.status!=='done'&&q.status!=='gone');
