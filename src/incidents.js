// Interwencje (0.5): quad/cross, śmieci, dym (latem i przy wiosennym wypalaniu traw), nocni intruzi (kłusownik, złodziej drewna ze stosu,
// złodziej choinek zimą) i zadania: dowiezienie karmy do paśnika. Patrolują jednostki: leśniczy (zawsze) i podleśniczy (po zatrudnieniu).
import {state,toast,cal,hash,particle,clamp,zl,DOW,SEASON_DAYS} from './core.js';
import {oddzial,DOOR,YARD,roadClearance,EDGES,POLANA,UPRAWA,inRect} from './map.js';
import {nearestRoad,goalNode,offMap,ENTRY,exitNode} from './roads.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,Wild,Group,rand} from './life/agents.js';
import {pay,bumpProtect,bumpDamage,planProgress,stat,ECO,canAfford} from './economy.js';
import {treesIn,STAND,STUMP,dirtyTree,crownR,trees,removeTree,SAPLING_AGE,THIN_AGE,QUAL} from './forest.js';
import {sfx} from './sound.js';
import {J,takeFromStack} from './jobs.js';
import {fireMult,fireSpeed,sanitaryMark,clearBlock} from './health.js';

let nextId=1;
const odd=(x,y)=>'oddz. '+oddzial(x,y);
const open_=q=>q.status!=='done'&&q.status!=='gone';
export function report(type,x,y,text,ref,quiet){
 const inc={id:nextId++,type,x,y,text,ref,status:'new',t:0,seen:0};E.incidents.push(inc);
 if(!quiet){toast((type==='feed'?'Zadanie: ':'Zgłoszenie: ')+text);sfx('ping')}return inc;
}
// ───────── śmieci ─────────
const JUNK=['bag','bottles','tire','bag'];
export function addTrash(x,y,kind){
 if(roadClearance(x,y)<4)x+=24;
 const t={x,y,kind:kind||JUNK[Math.floor(rand()*JUNK.length)],dead:false,seed:Math.floor(rand()*1e4),t:0,report:kind==='snare'?300+rand()*500:20+rand()*40};
 E.trash.push(t);return t;
}
// ───────── quad / cross ─────────
const forestEdges=()=>EDGES.filter(e=>e.kind==='forest'&&e.a!=='a3'&&e.b!=='l1');
export function spawnRider(){
 const w=rand()<.5,kind=rand()<.6?'quad':'cross';
 const v=new Vehicle(kind,{...ENTRY(w),color:['#c23a2b','#2f6a3a','#2a4a8a'][Math.floor(rand()*3)]});
 v.illegal=true;v.life=95+rand()*50;v.report=5+rand()*5;v.label=kind==='quad'?'quad (nielegalny wjazd)':'motocykl crossowy (nielegalny wjazd)';
 const E2=forestEdges(),e=E2[Math.floor(rand()*E2.length)];
 v.goTo({edge:e,s:40+rand()*(e.len-80)},{onArrive:q=>{q.arrived=false;q.final=false;q.stopS=null;q.route=null;q.roam=['forest']}});
 return v;
}
// ───────── dym ─────────
export function spawnSmoke(spring){
 for(let k=0;k<40;k++){
  // wiosną zaczyna się od wypalania traw — przy szosie i na skraju polany; latem w głębi suchego boru
  const x=spring?100+rand()*3400:300+rand()*3000,y=spring?(rand()<.6?1580+rand()*300:POLANA.y+(rand()-.5)*260):200+rand()*2300;
  if(roadClearance(x,y)<(spring?20:90)||Math.hypot(x-POLANA.x,y-POLANA.y)<POLANA.r-20)continue;
  const f={x,y,t:0,grow:0,dead:false,fire:true};E.trash.push(f);
  f.inc=report('fire',x,y,(spring?'Ktoś wypala trawy — dym w ':'Dym nad lasem w ')+odd(x,y)+'!',f);return}
}
// ───────── nocni intruzi ─────────
const leave=v=>v.goTo(goalNode(exitNode(v.pos[0])),{leave:true});
const INTR={
 poacher:{label:'kłusownik',car:'samochód bez świateł',text:x=>'Nocą w '+x+' stoi samochód bez świateł — możliwe kłusownictwo.'},
 thief:{label:'złodziej drewna',car:'samochód z przyczepką',text:x=>'Nocą przy stosie drewna w '+x+' ktoś ładuje przyczepkę!'},
 xmas:{label:'złodziej choinek',car:'samochód z bagażnikiem dachowym',text:x=>'O zmierzchu w '+x+' ktoś wycina choinki!'}
};
export function spawnIntruder(kind){
 const I=INTR[kind];let goal=null,stack=null,young=[];
 if(kind==='thief'){stack=J.stacks.filter(s=>s.vol>1.5).sort(()=>rand()-.5)[0];if(!stack)return;goal={edge:stack.edge,s:stack.s}}
 else if(kind==='xmas'){
  young=trees.filter(t=>t.st===STAND&&t.age>=4&&t.age<16&&(t.sp==='sosna'||t.sp==='swierk')&&!inRect(t.x,t.y,UPRAWA,-4)&&roadClearance(t.x,t.y)<240);
  if(young.length<2)return;const t0=young[Math.floor(rand()*young.length)];young=young.filter(t=>Math.hypot(t.x-t0.x,t.y-t0.y)<160).slice(0,3);
  const rp=nearestRoad(t0.x,t0.y,['forest'],{margin:60});goal={edge:rp.edge,s:rp.s};
 }else{const E2=forestEdges(),e=E2[Math.floor(rand()*E2.length)];goal={edge:e,s:50+rand()*(e.len-100)}}
 const w=rand()<.5,car=new Vehicle('car',{...ENTRY(w),color:kind==='thief'?'#5a4a3a':'#3a3d3a'});
 car.dark=kind!=='xmas';car.intruder=kind;car.label=I.car;
 car.goTo(goal,{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*18,cy=v.pos[1]+Math.sin(h)*18;v.door=[cx,cy];
  const p=new Ped({kind:'driver',x:cx,y:cy,speed:13});p.label=I.label;p.snares=[];v.man=p;
  const steps=[];
  if(kind==='poacher'){
   const spot=()=>{for(let k=0;k<12;k++){const a=rand()*6.283,d=80+rand()*160,x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;if(roadClearance(x,y)>40&&NAV.foot.walkable(x,y))return[x,y]}return[cx+60,cy]};
   for(const S of [spot(),spot()])steps.push({go:S},{wait:16,pose:'kneel'},{call:q=>q.snares.push(addTrash(q.x+5,q.y,'snare'))});
  }else if(kind==='thief'){
   for(let k=0;k<4;k++)steps.push({go:[stack.x+(rand()-.5)*12,stack.y+(rand()-.5)*8]},{wait:5,pose:'kneel',face:[stack.x,stack.y]},{call:()=>{const r=takeFromStack(stack,.45);v.stolen=(v.stolen||0)+r.q;v.stolenVal=(v.stolenVal||0)+r.val}},{go:[cx,cy]});
  }else{
   for(const t of young)steps.push({go:[t.x-6,t.y]},{wait:6,pose:'saw',face:[t.x,t.y]},{call:()=>{if(t.st===STAND){removeTree(t);v.stolen=(v.stolen||0)+1}}},{go:[cx,cy]});
  }
  steps.push({go:[cx,cy]},{call:q=>{q.dead=true;v.man=null;v.label='odjeżdża';leave(v)}});
  p.run(steps);v.report=kind==='xmas'?4+rand()*8:10+rand()*25;
 }});
}
// ───────── jednostki patrolowe ─────────
const CAR_EDGE=EDGES.find(e=>e.a==='l1'&&e.b==='yd');
const yardIdle=[
 r=>[{go:[DOOR[0],DOOR[1]+10]},{wait:5+rand()*6,pose:'stand',face:[DOOR[0],DOOR[1]-10]}],
 r=>[{go:[226,402]},{wait:5+rand()*4,pose:'kneel'}],
 r=>[{go:[330,436]},{wait:6+rand()*5,pose:'kneel',face:[330,400]}],
 r=>[{go:[490,384]},{wait:3+rand()*3,pose:'stand',face:[500,404]}],
 r=>[{go:[540,300]},{wait:4+rand()*6,pose:'stand',face:[640,300]}]
];
class Unit{
 constructor(name,kind,s,coat){
  this.name=name;this.queue=[];this.cur=null;this.phase='home';this.parkS=s;this.chaseT=0;
  this.car=new Vehicle('patrol',{from:'l1',to:'yd',s}).parkHere();this.car.label=name+' — terenówka w leśniczówce';
  this.person=new Ped({kind:'lesniczy',x:DOOR[0]+(kind?24:0),y:DOOR[1]+12,speed:16,nav:'foot',coat});this.person.label=name;this.person.unit=this;
  this.person.onIdle=()=>this.idle();
 }
 idle(){const r=this.person;if(this.phase!=='home'||r.busyOffice)return;
  if(cal.night())r.run([{go:[DOOR[0],DOOR[1]+8]},{call:q=>{q.hidden=true;q.sleeping=true}}]);
  else r.run(yardIdle[Math.floor(rand()*yardIdle.length)](r))}
 carDoor(){const v=this.car,h=v.heading;return[v.pos[0]-Math.cos(h)*14,v.pos[1]-Math.sin(h)*14]}
 out(){const r=this.person,[x,y]=this.carDoor();r.x=x;r.y=y;r.hidden=false;r.heading=0;return r}
 startNext(){
  // 0.6.2: najpierw pożar, potem zgłoszenie najbliżej terenówki (na dużej mapie kolejność „po drodze” oszczędza godziny)
  this.queue=this.queue.filter(q=>q.status!=='done'&&q.status!=='gone');
  const [cx,cy]=this.car.pos,fire=this.queue.find(q=>q.type==='fire'||q.type==='block');
  const inc=fire||this.queue.slice().sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy))[0];
  if(inc)this.queue=this.queue.filter(q=>q!==inc);
  if(!inc){this.goHome();return}
  this.cur=inc;inc.status='assigned';inc.unit=this;pay(35,'paliwo — wyjazd patrolu');
  const r=this.person;
  if(r.hidden&&!r.sleeping){this.drive(inc);return}
  if(r.sleeping){r.sleeping=false;r.hidden=false;r.x=DOOR[0];r.y=DOOR[1]+8;toast(this.name+' wstaje i jedzie na interwencję.')}
  this.phase='boarding';r.onIdle=null;r.busyOffice=false;
  r.run([{go:this.carDoor()},{call:q=>{q.hidden=true;this.drive(inc)}}]);
 }
 drive(inc){
  const c=this.car;this.phase='driving';c.beacon=inc.type!=='feed'&&inc.type!=='assess';c.label=this.name+' jedzie: '+inc.text;
  if(inc.type==='quad'){this.chase(inc);return}
  const rp=nearestRoad(inc.x,inc.y,['main','forest']);
  c.goTo({edge:rp.edge,s:rp.s},{park:true,pen:400,onArrive:()=>this.onSite(inc)});
 }
 chase(inc){const q=inc.ref,rp=nearestRoad(q.pos[0],q.pos[1],['main','forest']);this.car.goTo({edge:rp.edge,s:rp.s},{park:false,pen:250,onArrive:()=>{this.chaseT=0}})}
 onSite(inc){
  this.phase='onsite';this.car.beacon=false;
  if(inc.status==='gone'||(inc.ref&&inc.ref.dead&&inc.type!=='fire'&&inc.type!=='feed')){this.finish(inc,false);return}
  const r=this.out(),U=this,tx=inc.type==='quad'?inc.ref.pos[0]:inc.x,ty=inc.type==='quad'?inc.ref.pos[1]:inc.y,back={go:this.carDoor()};
  const done=ok=>({call:q=>{q.hidden=true;q.prop=null;U.finish(inc,ok)}});
  if(inc.type==='trash'){
   // przy okazji zbiera inne śmieci i wnyki w promieniu ok. 18 m (także te jeszcze niezgłoszone)
   const near=E.trash.filter(t=>t!==inc.ref&&!t.dead&&!t.fire&&Math.hypot(t.x-tx,t.y-ty)<220).slice(0,3),steps=[];
   for(const t of [inc.ref,...near])steps.push({go:[t.x-6,t.y]},{wait:2.2,pose:'kneel',face:[t.x,t.y]},{call:()=>{t.dead=true;r.prop='bag';if(t.inc&&t.inc!==inc&&t.inc.status!=='done'){t.inc.status='done';for(const u of U)u.queue=u.queue.filter(q=>q!==t.inc)}}});
   r.run([...steps,back,done(true)]);
  }
  else if(inc.type==='assess'){
   // obchód fragmentu oddziału zygzakiem; po drodze ocena jakości drzew i cechowanie wadliwych do usunięcia (trzebież)
   const A=inc.ref,steps=[];let row=0;
   for(let y=A.y-A.r+45;y<=A.y+A.r-45;y+=95,row++){const w=Math.sqrt(Math.max(0,A.r*A.r-(y-A.y)**2))-30;if(w<40)continue;
    const xs=[];for(let x=A.x-w;x<=A.x+w;x+=105)xs.push(x);if(row%2)xs.reverse();
    for(const x of xs)if(NAV.foot.walkable(x,y))steps.push({go:[x,y]},{call:()=>reveal(A,x,y)},{wait:.6,pose:'stand'})}
   r.label=this.name+' — ocena drzewostanu';
   r.run([...steps,{call:q=>{q.label=this.name}},back,done(true)]);
  }
  else if(inc.type==='feed')r.run([{go:[tx-14,ty+8]},{wait:4,pose:'kneel',face:[tx,ty]},{call:()=>{inc.ref.level=1;inc.ref.task=null;pay(ECO.feedCost||120,'karma dla zwierzyny')}},back,done(true)]);
  else if(inc.type==='fire')r.run([{go:[tx-10,ty+6]},{wait:5,pose:'saw',face:[tx,ty],tick:(q,dt)=>{inc.ref.grow=Math.max(0,inc.ref.grow-dt*.3)}},{call:()=>{inc.ref.dead=true}},back,done(true)]);
  else if(inc.type==='beetle')r.run([{go:[tx-12,ty+8]},{wait:5,pose:'kneel',face:[tx,ty]},{call:()=>{const n=sanitaryMark(inc.ref);inc.ref.found=n}},back,done(true)]);
  else if(inc.type==='block')r.run([{go:[tx-14,ty+8]},{wait:7,pose:'saw',face:[tx,ty]},{call:()=>{clearBlock(inc.ref)}},back,done(true)]);
  else if(inc.type==='intruder'){
   const v=inc.ref,m=v.man,door=v.door||v.pos;
   if(m&&!m.dead){m.run([{go:door},{wait:999,pose:'stand',until:()=>false}]);m.label=m.label+' — zatrzymany'}
   const steps=[{go:[door[0]-8,door[1]]},{wait:40,pose:'stand',face:door,until:()=>!m||m.dead||Math.hypot(m.x-door[0],m.y-door[1])<14},{wait:4,pose:'talk',face:door}];
   for(const sn of (m&&m.snares)||[])if(!sn.dead)steps.push({go:[sn.x-6,sn.y]},{wait:2,pose:'kneel',face:[sn.x,sn.y]},{call:()=>{sn.dead=true}});
   steps.push({call:()=>{inc.status='done';if(m){m.dead=true;v.man=null}
    if(v.intruder==='thief'&&v.stolen){const st=J.stacks.find(s=>Math.hypot(s.x-door[0],s.y-door[1])<120);if(st){st.vol+=v.stolen;st.value+=v.stolenVal||0}}
    v.label='odjeżdża — sprawa trafi na policję';leave(v)}},back,done(true));
   r.run(steps);
  }else{
   const q=inc.ref;
   r.run([{go:[tx-10,ty]},{wait:3.5,pose:'talk',face:[tx,ty]},{call:()=>{inc.status='done';q.stopped=false;q.speedMul=.6;q.label='odjeżdża po kontroli';q.goTo(goalNode(exitNode(q.pos[0])),{leave:true})}},back,done(true)]);
  }
 }
 finish(inc,ok){
  inc.status='done';this.cur=null;
  if(ok){
   const k=inc.type==='intruder'?inc.ref.intruder:inc.type,snare=inc.type==='trash'&&inc.ref.kind==='snare';
   if(k==='assess'){const A=inc.ref;selectThinning(A);toast('Ocena drzewostanu (oddz. '+oddzial(A.x,A.y)+'): dorodne '+A.n[0]+', przeciętne '+A.n[1]+', wadliwe '+A.n[2]+'. '+(A.marked?'Do trzebieży oznaczono '+A.marked+' drzew — E: wyślij ekipę.':'Bez cechowania: '+A.why+'.'));this.startNext();return}
   if(k==='beetle'){const n=inc.ref.n;toast(n?'Kornik potwierdzony ('+odd(inc.x,inc.y)+'): do cięcia sanitarnego oznaczono '+n+' drzew — E: wyślij ekipę. Im szybciej, tym mniejsza strata.':'Patrol nie znalazł zasiedlonych drzew — fałszywy alarm albo już uprzątnięte.');bumpProtect(1);planProgress('handle',1);this.startNext();return}
   const gain={block:4,quad:6,poacher:9,thief:7,xmas:5,fire:5,feed:1}[k]??(snare?3:2);bumpProtect(gain);planProgress('handle',1);
   toast({quad:'Kontrola zakończona: kierujący ukarany mandatem.',poacher:'Kłusownik zatrzymany, wnyki zebrane.',thief:'Złodziej drewna zatrzymany, drewno wróciło na stos.',xmas:'Złodziej choinek zatrzymany.',fire:'Zarzewie ugaszone.',block:'Droga udrożniona.',feed:'Paśnik uzupełniony karmą.'}[k]||(snare?'Wnyki usunięte.':'Śmieci zebrane.'));
  }
  this.startNext();
 }
 goHome(){
  const c=this.car;this.phase='return';c.beacon=false;c.label=this.name+' wraca do leśniczówki';
  c.goTo({edge:CAR_EDGE,s:this.parkS},{park:true,onArrive:()=>{
   this.phase='home';c.label=this.name+' — terenówka w leśniczówce';
   const r=this.out();r.onIdle=()=>this.idle();r.run([{go:[DOOR[0]+30,DOOR[1]+20]}]);
  }});
 }
}
export const U=[];export let P=null;
export function initPatrol(){
 P=new Unit('leśniczy (Ty)',0,CAR_EDGE.len-2);U.push(P);
 P.ranger=P.person;
 P.dog=new Wild({kind:'dog',x:340,y:330,seed:4242,nav:'yard',group:new Group(340,330,3,{fixed:true}),follow:P.person,leash:70,col:'#3a2e26',col2:'#9a6a3a',flee:0,idleMin:1,idleVar:3});
 P.dog.name='Brzoza (jamnik leśniczego)';
}
export function hirePod(){const u=new Unit('podleśniczy',1,CAR_EDGE.len-46,'#6a7a4a');U.push(u);return u}
export function firePod(){const u=U[1];if(!u)return false;if(u.phase!=='home'){toast('Podleśniczy jest w terenie — zwolnisz go po powrocie.');return false}
 u.car.dead=true;u.person.dead=true;U.pop();return true}
export function dispatch(inc){
 if(!inc||inc.status!=='new')return;
 const free=U.find(u=>u.phase==='home'||u.phase==='return'),u=free||U.slice().sort((a,b)=>a.queue.length-b.queue.length)[0];
 inc.status='queued';u.queue.push(inc);
 if(u.phase==='home'||u.phase==='return')u.startNext();
 else toast('Patrol jest zajęty — zgłoszenie czeka w kolejce ('+u.name+').');
}
// ───────── aktualizacja ─────────
const TM={day:-1,rider:null,smoke:null,night:null,nightKind:null,first:true};
export function updateIncidents(dt){
 const d=Math.floor(state.days),se=cal.season();
 if(d!==TM.day){TM.day=d;const we=cal.dow()>=5;
  TM.rider=se!==3&&(TM.first||rand()<(we?.7:.25))?d+(TM.first?13.5:10+rand()*8)/24:null;TM.first=false;
  TM.smoke=((se===1&&rand()<.3)||(se===0&&rand()<.25))&&rand()<Math.min(.9,fireMult())?d+(11+rand()*7)/24:null;TM.smokeSpring=se===0;
  // noc: kłusownik (bez zimy), złodziej drewna (gdy są stosy), zimą o zmierzchu złodziej choinek
  const r=rand();TM.night=null;
  if(se===3&&r<.45){TM.night=d+(16.5+rand()*1.5)/24;TM.nightKind='xmas'}
  else if(se!==3&&r<.25){TM.night=d+(23+rand()*3)/24;TM.nightKind='poacher'}
  else if(r>.78&&J.stacks.some(s=>s.vol>1.5)){TM.night=d+(23.5+rand()*3)/24;TM.nightKind='thief'}
 }
 if(TM.rider&&state.days>=TM.rider){TM.rider=null;const h=cal.hour();if(h>9&&h<20.5)spawnRider()}
 if(TM.smoke&&state.days>=TM.smoke){TM.smoke=null;if(!E.incidents.some(q=>q.type==='fire'&&open_(q)))spawnSmoke(TM.smokeSpring)}
 if(TM.night&&state.days>=TM.night){TM.night=null;spawnIntruder(TM.nightKind)}
 for(const u of U){const r=u.person;if(r.sleeping&&!cal.night()&&u.phase==='home'){r.sleeping=false;r.hidden=false;r.x=DOOR[0];r.y=DOOR[1]+8;r.onIdle=()=>u.idle()}}
 for(const v of E.vehicles){if(!v.intruder)continue;
  if(v.report!=null){v.report-=dt;if(v.report<=0){v.report=null;if(!v.dead)v.inc=report('intruder',v.pos[0],v.pos[1],INTR[v.intruder].text(odd(v.pos[0],v.pos[1])),v)}}
 }
 for(const v of E.vehicles){if(!v.illegal)continue;
  v.life-=dt;
  if(v.roam&&!v.stopped&&v.dwell<=0&&rand()<dt*.05){v.dwell=4+rand()*5;v.label=(v.kind==='quad'?'quad':'crossowiec')+' kręci kółka na poboczu'}
  if(v.dwell>0&&rand()<dt*8)particle('dust',v.pos[0]+(rand()-.5)*20,v.pos[1]+(rand()-.5)*20,{col:'#b8a27a',size:2+rand()*3});
  if(v.report!=null){v.report-=dt;if(v.report<=0){v.report=null;if(!v.dead)v.inc=report('quad',v.pos[0],v.pos[1],(v.kind==='quad'?'Quad':'Motocykl crossowy')+' na drodze leśnej, '+odd(v.pos[0],v.pos[1])+'.',v)}}
  if(v.life<=0&&!v.stopped&&!v.leaving&&v.roam){v.leaving=true;v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}
 }
 for(const t of E.trash){
  if(t.fire){t.t+=dt;if(!t.dead){t.grow=Math.min(1,t.grow+dt*.0042*fireSpeed());if(rand()<dt*14)particle('smoke',t.x+(rand()-.5)*14*(1+t.grow),t.y,{vx:6+rand()*6,vy:-14-rand()*10,life:2.5+rand()*1.5,size:3+rand()*4*(1+t.grow)})}
   if(!t.dead&&t.grow>=1){t.dead=true;burn(t);t.inc.status='gone';stat('ignored');const u=t.inc.unit;if(u&&u.cur===t.inc&&u.phase==='driving'){u.cur=null;u.startNext()}bumpProtect(-7);bumpDamage(6);toast('Pożar w '+odd(t.x,t.y)+' ugasiła straż pożarna. Spłonął fragment drzewostanu.')}continue}
  if(t.dead)continue;t.t+=dt;
  if(!t.inc&&t.t>t.report)t.inc=report('trash',t.x,t.y,t.kind==='snare'?'Spacerowicz znalazł wnyki w '+odd(t.x,t.y)+'.':'Śmieci w lesie, '+odd(t.x,t.y)+'.',t);
 }
 for(const inc of E.incidents){
  inc.t+=dt;const u=inc.unit;
  if(inc.type==='quad'&&open_(inc)){
   const q=inc.ref;
   if(q.dead){inc.status='gone';stat('ignored');bumpProtect(-5);bumpDamage(1);toast((q.kind==='quad'?'Quad':'Crossowiec')+' odjechał bezkarnie. Ochrona −5%.');if(u&&u.cur===inc){u.cur=null;u.startNext()}continue}
   inc.seen+=dt;if(inc.seen>4){inc.seen=0;inc.x=q.pos[0];inc.y=q.pos[1]}
   if(u&&u.cur===inc&&u.phase==='driving'){
    const c=u.car,d=Math.hypot(c.pos[0]-q.pos[0],c.pos[1]-q.pos[1]);
    if(d<95){q.stopped=true;q.label='zatrzymany do kontroli';c.stopped=true;c.v=0;u.phase='onsite';c.final=true;c.stopS=c.s;c.arrived=true;u.onSite(inc)}
    else{u.chaseT-=dt;if(u.chaseT<=0||c.arrived){u.chaseT=2.5;u.chase(inc)}}
   }
  }
  if(inc.type==='trash'&&inc.ref.dead&&inc.status==='new')inc.status='done';
  if(inc.type==='intruder'&&inc.ref.dead&&open_(inc)){
   inc.status='gone';stat('ignored');const k=inc.ref.intruder;bumpProtect(k==='thief'?-4:-3);
   toast(k==='thief'?'Złodziej odjechał z drewnem ('+(inc.ref.stolen||0).toFixed(1).replace('.',',')+' m³).':k==='xmas'?'Złodziej choinek odjechał — wycięto '+(inc.ref.stolen||0)+' młodych drzewek.':'Samochód bez świateł odjechał. W lesie mogły zostać wnyki.');
   if(u&&u.cur===inc&&u.phase==='driving'){u.cur=null;u.startNext()}}
 }
 E.incidents=E.incidents.filter(q=>!(!open_(q)&&(q.doneT=(q.doneT||0)+dt)>6));
}
function burn(f){
 for(const t of treesIn(f.x-70,f.y-70,f.x+70,f.y+70)){if(t.st!==STAND||Math.hypot(t.x-f.x,t.y-f.y)>70)continue;t.stumpR=clamp(crownR(t)*.2,3,8);t.st=STUMP;t.stumpAge=20;t.burnt=true;t.marked=false;dirtyTree(t)}
 E.burns=E.burns||[];E.burns.push({x:f.x,y:f.y,r:80});
}
export const openIncidents=()=>E.incidents.filter(open_);
// Zadanie „dowieź karmę” (paśniki zimą) — zgłasza moduł zwierzyny.
// ── ocena drzewostanu i cechowanie (0.6.2) ──
// Leśniczy obchodzi okolicę (promień ok. 23 m), poznaje jakość drzew i oznacza wadliwe (krzywe, chore) do usunięcia w trzebieży.
function reveal(A,x,y){
 for(const t of treesIn(x-95,y-95,x+95,y+95)){if(t.st!==STAND||t.qk||Math.hypot(t.x-x,t.y-y)>95||t.age<SAPLING_AGE)continue;
  t.qk=true;A.n[t.q]++}
}
// 0.6.3: cechowanie z umiarem, jak w prawdziwej trzebieży selekcyjnej:
// — to samo miejsce najwyżej raz na ok. 10 lat (wcześniej leśniczy tylko ocenia jakość),
// — najwyżej 15% drzew w obchodzonym miejscu,
// — tylko wadliwe drzewa w zwarciu, najpierw te, które przeszkadzają dorodnym sąsiadom.
export const ASSESS=[];   // {x,y,day} — miejsca, gdzie już cechowano
const THIN_EVERY=10/3*SEASON_DAYS;   // 10 lat lasu = ok. 3,3 pory roku
function selectThinning(A){
 const recent=ASSESS.find(q=>Math.hypot(q.x-A.x,q.y-A.y)<A.r&&state.days-q.day<THIN_EVERY);
 if(recent){A.why='tu cechowano niedawno — kolejna trzebież za kilka lat';return}
 const all=treesIn(A.x-A.r,A.y-A.r,A.x+A.r,A.y+A.r).filter(t=>t.st===STAND&&!t.falling&&!t.lying&&t.age>=THIN_AGE&&Math.hypot(t.x-A.x,t.y-A.y)<A.r);
 const cap=Math.floor(all.length*.15);
 const near=t=>{const r=crownR(t)*1.9;return treesIn(t.x-r,t.y-r,t.x+r,t.y+r).filter(q=>q!==t&&q.st===STAND&&q.age>=SAPLING_AGE&&Math.hypot(q.x-t.x,q.y-t.y)<r)};
 const cand=[];for(const t of all){if(!t.qk||t.q!==2||t.marked||t.assigned||t.uprawa)continue;const nb=near(t);if(nb.length<2)continue;cand.push({t,score:nb.filter(q=>q.q===0).length*3+nb.length})}
 cand.sort((a,b)=>b.score-a.score);
 for(const c of cand.slice(0,cap)){c.t.marked=true;A.marked++}
 ASSESS.push({x:A.x,y:A.y,day:state.days});
 if(!A.marked)A.why=cand.length?'':'drzewostan jest luźny — nie wymaga trzebieży';
}
export const assessing=(x,y)=>E.incidents.some(q=>q.type==='assess'&&q.status!=='done'&&q.status!=='gone'&&Math.hypot(q.x-x,q.y-y)<q.ref.r);
export function orderAssess(x,y){
 if(assessing(x,y)){toast('Ocena w tym miejscu jest już zlecona.');return}
 const inc=report('assess',x,y,'Ocena drzewostanu i cechowanie — oddz. '+oddzial(x,y)+'.',{x,y,r:250,n:[0,0,0],marked:0},true);
 toast('Zlecono ocenę drzewostanu w oddz. '+oddzial(x,y)+': leśniczy obejdzie okolicę i oznaczy wadliwe drzewa do trzebieży.');dispatch(inc);
}
export function feedTask(f,name){return report('feed',f.x,f.y,'Paśnik '+name+' pusty — trzeba dowieźć karmę.',f)}
