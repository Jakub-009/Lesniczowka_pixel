// Kto mieszka w lesie i kto do niego przyjeżdża: zwierzyna w grupach, ruch na drodze, grzybiarze, spacerowicze, rowerzyści, myśliwy.
import {cal,hash,state,clamp,SEASON_DAYS,toast} from '../core.js';
import {banned} from '../health.js';
import {EDGES,NODES,POLANA,roadClearance,oddzial,offLimits} from '../map.js';
import {AMB,AMB_R} from './ambony.js';
import {goalNode,pointOn,nearestRoad,ENTRY,exitNode} from '../roads.js';
import {E,NAV} from '../ents.js';
import {Vehicle,Ped,Wild,Group,rand} from './agents.js';
import {addTrash,U} from '../incidents.js';
import {bumpProtect,ECO} from '../economy.js';
import {sfx} from '../sound.js';
import {FA,FH,cull,cullBatch,planLeft,likesNow,pressure} from './fauna.js';
import * as forest from '../forest.js';

const CAR_COLS=['#8c9b95','#a4684f','#6f86a0','#b9a56a','#7a8f6f','#a8a6a0','#5a5f6a','#9a4a3a'];
const pick=a=>a[Math.floor(rand()*a.length)];
const LIKES=[[POLANA.x,POLANA.y],[POLANA.x-60,POLANA.y+70],[1420,780],[1110,630],[1200,1400],[2950,1420],[2450,1330],[3100,760]];
export const groups=[];
// Widoczna zwierzyna to reprezentacja populacji w obwodzie (FA.pop): mniej zwierząt na ekranie, ale ich liczba
// rośnie i maleje razem z populacją — po rozrodzie, odstrzałach koła łowieckiego, wilkach i zimie.
export function spawnWildlife(){
 for(const a of E.animals)if(a.kind!=='dog')a.dead=true;groups.length=0;
 let seed=10+Math.floor(state.days)*7;const g=(x,y,o)=>{const G=new Group(x,y,seed+=13,o);groups.push(G);return G};
 const add=(kind,x,y,G,o={})=>new Wild({kind,x:x+(rand()-.5)*40,y:y+(rand()-.5)*40,seed:seed++,group:G,...o});
 const P=FA.pop,se=cal.season();
 // 0.6: las jest ok. 2,25× większy — więcej ostoi, ale na ekranie nadal tylko część populacji
 const roeN=clamp(Math.round(P.roe/22),0,3);
 for(const [x,y] of [[420,900],[3000,1450],[1450,1620],[2150,800]].slice(0,P.roe>50?4:3)){if(!roeN)break;const G=g(x,y,{likes:LIKES,kind:'roe'});for(let i=0;i<roeN;i++)add('roe',x,y,G,{male:i===0&&rand()<.5})}
 const deerN=clamp(Math.round(P.deer/6),0,4);
 for(const [x,y] of [[2050,1350],[3100,700]].slice(0,P.deer>14?2:1)){if(!deerN)break;const G=g(x,y,{likes:LIKES,range:[300,700],kind:'deer'});add('deer',x,y,G,{male:true});for(let i=1;i<deerN;i++)add('deer',x,y,G)}
 for(const [x,y] of [[1250,1500],[2600,1400]].slice(0,P.boar>18?2:1)){if(P.boar<4)break;const G=g(x,y,{range:[200,500],kind:'boar',likes:LIKES});const sow=add('boar',x,y,G);sow.sow=se<=1&&P.boar>8;
  if(P.boar>=11)add('boar',x+30,y+10,G,{male:true});
  if(sow.sow)for(let i=0;i<clamp(Math.round(P.boar/10),2,4);i++)add('piglet',x,y,G,{follow:sow,flee:110})}
 for(const [x,y] of [[300,800],[2900,1500]].slice(0,P.fox>=6?2:1)){if(P.fox<3)break;const G=g(x,y,{range:[300,700],kind:'fox'});add('fox',x,y,G)}
 if(FA.wolf.present)addPack(g,add);
 for(const [x,y] of [[2000,1150],[600,700],[1400,1600]].slice(0,P.hare>=20?3:P.hare>=10?2:1)){const G=g(x,y,{range:[100,260],kind:'hare'});add('hare',x,y,G)}
}

// Wataha wędrowna (0.8.3): pojawia się i znika razem ze stanem FA.wolf
function addPack(g,add){const n=FA.wolf.size,x=3250,y=520+rand()*600,G=g(x,y,{range:[700,1300],kind:'wolf'});const lead=add('wolf',x,y,G);for(let i=1;i<n;i++)add('wolf',x,y,G,{follow:lead,leash:90})}
FH.wolves=()=>{
 for(const a of E.animals)if(a.kind==='wolf')a.dead=true;
 if(!FA.wolf.present)return;
 let seed=900+Math.floor(state.days)*5;const g=(x,y,o)=>{const G=new Group(x,y,seed+=13,o);groups.push(G);return G};
 addPack(g,(kind,x,y,G,o={})=>new Wild({kind,x:x+(rand()-.5)*40,y:y+(rand()-.5)*40,seed:seed++,group:G,...o}));
};
// ───────── goście w lesie ─────────
export const HK2={free:()=>-1,edge:null,approach:()=>0,park:null,reserve:null,verge:()=>null,leave:null,chrust:null};
// 1.4.0: chrust (gałęzie po ścince) przy drogach leśnych i duktach zbierają petenci z zezwoleniem — przyjeżdżają osobówką z przyczepką
export const chrustNear=()=>forest.trees.filter(t=>t.st===forest.STUMP&&t.slash&&!offLimits(t.slash.x,t.slash.y)&&roadClearance(t.slash.x,t.slash.y,['forest','dukt'])<120);
HK2.chrust=car=>{
 const all=chrustNear();if(!all.length||ECO.ord.bar)return false;
 const t0=all[Math.floor(rand()*all.length)],grp=all.filter(t=>Math.hypot(t.slash.x-t0.slash.x,t.slash.y-t0.slash.y)<150).slice(0,4);
 const rp=nearestRoad(t0.slash.x,t0.slash.y,['forest','dukt'],{margin:40});if(!rp)return false;
 car.allow=['main','forest','dukt'];car.label='zbieracz chrustu jedzie do oddz. '+oddzial(t0.x,t0.y);car.cap=4;car.load=0;
 car.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:v=>{
  const [cx,cy]=sideSpot(v,16),p=new Ped({kind:'walker',x:cx,y:cy,speed:12,coat:'#6a5a4a',cap:'#c8a24a'});p.label='zbiera chrust (zezwolenie)';v.label='zbieracz chrustu (zaparkowany)';
  const steps=[];for(const t of grp)steps.push({go:[t.slash.x-8,t.slash.y]},{wait:4,pose:'kneel',face:[t.slash.x,t.slash.y]},{call:q=>{if(t.slash){t.slash=null;forest.dirtyTree(t);v.load=Math.min(4,(v.load||0)+1);q.prop='bag'}}},{go:[cx,cy]},{call:q=>{q.prop=null}});
  p.run([...steps,{call:q=>{q.dead=true;v.label='zbieracz chrustu odjeżdża';leaveMap(v)}}]);
 }});
 return true;
};   // ustawiane przez order.js (bez cyklu importów)
const T={car:3,pick:6,walk:14,bike:20,hunt:0,huntDay:-1};
const forestEdges=()=>EDGES.filter(e=>e.kind==='forest'&&e.b!=='l1'&&e.a!=='l1');
function sideSpot(v,dist){const h=v.heading,sgn=rand()<.5?1:1;return[v.pos[0]+Math.cos(h)*dist*sgn,v.pos[1]+Math.sin(h)*dist*sgn]}
function spawnFrom(kind,o={}){const w=rand()<.5;return new Vehicle(kind,{...ENTRY(w),...o})}
function leaveMap(v){if(v.pub&&HK2.leave){HK2.leave(v,v.pos[0]+(rand()-.5)*1200);return}v.goTo(goalNode(exitNode(v.pos[0]+(rand()-.5)*1200)),{leave:true})}
// Grzybiarze: przyjeżdżają autem, parkują na poboczu, chodzą z koszykiem po lesie i wracają (czasem zostawiają śmieci).
export function spawnPickers(berry){
 // jagody: bory sosnowe (101, 104, 107, 108); grzyby: wszędzie
 const E2=berry?EDGES.filter(e=>['a3-a1','a1-b1','j2-b1'].includes(e.id)):forestEdges(),who=berry?'zbieracze jagód':'grzybiarze';
 // 1.1.7: przy zamkniętych szlabanach nikt z odwiedzających nie wjeżdża za szlaban: parking, a gdy pełny — pobocze przed szlabanem; bez miejsca rezygnują
 const shut=!!ECO.ord.bar,bay=shut||rand()<.6?HK2.free():-1,vg=shut&&bay<0&&!ECO.ord.parking?HK2.verge():null;   // 1.1.8: z parkingiem tylko parking (pełny — rezygnują); bez parkingu pobocze przed szlabanem   // 0.8.3: część odwiedzających parkuje w zatoce przy drodze (gdy jest zbudowana)
 if(shut&&bay<0&&!vg)return;
 // 1.3.0: przy otwartych szlabanach ok. 30% odwiedzających jedzie na dukty (70% zostaje przy drogach leśnych) — mniej tłoku na głównej pętli
 const dk=!shut&&bay<0&&!vg&&rand()<.3?EDGES.filter(q=>q.kind==='dukt'):null;
 const e=bay>=0?HK2.edge(bay):vg?vg.e:dk?pick(dk):pick(E2),s=bay>=0?HK2.approach(bay):vg?vg.s:60+rand()*Math.min(e.len-120,dk?700:1e9);
 const car=spawnFrom('car',{color:pick(CAR_COLS),...(dk?{allow:['main','forest','dukt']}:{})});car.label=who;car.pub=true;if(bay>=0)HK2.reserve(bay,car);if(vg)vg.car=car;
 const walk=(v,cx,cy)=>{
  const n=1+(rand()<.55?1:0);let back=0;
  for(let i=0;i<n;i++){
   const p=new Ped({kind:'picker',x:cx+i*6,y:cy,prop:berry?'bucket':'basket',berry,speed:13+rand()*3,coat:pick(['#8a6a4a','#5a6a8a','#7a3a3a','#4a6a4a','#9a8a5a']),cap:pick(['#c84a3a','#d8b23a','#3a4a6a','#e8e4dc'])});
   p.label=berry?'zbieracz jagód':'grzybiarz';
   p.run([{wander:{x:cx,y:cy,r:240,t:110+rand()*110,pickP:.7,until:()=>cal.hour()>15,ok:(x,y)=>roadClearance(x,y)>24}},{go:[cx,cy]},{call:q=>{
    if(rand()<.14*(ECO.ord.parking?.35:1))addTrash(q.x+(rand()-.5)*30,q.y+(rand()-.5)*30);
    q.hidden=true;q.dead=true;if(++back>=n){v.label=who+' — odjeżdżają';leaveMap(v)}}}]);
  }
  v.label=who+' (zaparkowani)';
 };
 car.goTo({edge:e,s},{park:bay<0,onArrive:v=>{
  if(bay>=0)HK2.park(v,bay,([cx,cy])=>walk(v,cx,cy));
  else{const [cx,cy]=sideSpot(v,18);walk(v,cx,cy)}
 }});
}
// Spacerowicze: idą poboczem drogi leśnej od szosy i wracają; czasem z psem.
function spawnWalker(){
 const A=rand()<.5,x=A?852:1732,y0=1660,y1=A?1150+rand()*300:1200+rand()*200;
 const p=new Ped({kind:'walker',x,y:y0,speed:11+rand()*3,coat:pick(['#5a7aa0','#a05a5a','#6a8a5a','#c0a050','#7a5a8a']),cap:pick(['#6b4a2e','#e8e4dc','#3a3a3a'])});
 p.label='spacerowicz';
 let dog=null;if(rand()<.5){dog=new Wild({kind:'dog',x:x+8,y:y0,seed:Math.floor(rand()*1e5),nav:'foot',group:new Group(x,y0,1,{fixed:true}),follow:p,leash:60,idleMin:.4,idleVar:1.2,col:pick(['#c8a060','#3a3430','#e8e0d0']),col2:'#5a4636',flee:0})}
 p.run([{go:[x,y1]},{wait:4+rand()*4,pose:'stand'},{go:[x+(rand()-.5)*10,y0+10]},{call:q=>{q.dead=true;if(dog)dog.dead=true;if(rand()<.06*(ECO.ord.parking?.35:1))addTrash(q.x+12,q.y-30)}}]);
}
// Myśliwy z koła łowieckiego (0.6: szybszy): przyjeżdża wieczorem albo o świcie, idzie z psem na ambonę i — jeśli plan
// łowiecki nie jest wykonany — po krótkim mierzeniu strzela do sarny, jelenia albo dzika (nigdy do lochy z warchlakami).
const GAME=['roe','deer','boar'];
const canTake=a=>!a.dead&&GAME.includes(a.kind)&&!a.sow&&FA.culled[a.kind]<FA.plan[a.kind]+(FA.reduction?2:0);
function target(q,R){
 if(planLeft()<=0&&!FA.reduction)return null;let best=null,bd=R;
 for(const a of E.animals){if(!canTake(a)||a.state==='run')continue;const d=Math.hypot(a.x-q.x,a.y-q.y);if(d<bd){bd=d;best=a}}
 return best;
}
function kill(q,a){shot(q);a.dead=true;const c={x:a.x,y:a.y,a:a.heading,kind:a.kind};FA.carcasses.push(c);cull(a.kind,true);return c}
// 0.9: każda ambona ma własnego myśliwego; ten parkuje przy najbliższej drodze leśnej, idzie na ambonę (zasięg 420 px) i po powrocie
// zgłasza pozyskanie: widoczny strzał + porcja „z obwodu” zależna od presji zwierzyny (więcej ambon → plan do wykonania).
const huntersOut=()=>E.people.filter(p=>p.kind==='hunter'&&!p.dead&&p.amb!=null).length;
const outingYield=()=>{const x=1.7*clamp(pressure(),.7,2.2)*(FA.wolf.present?.8:1);return Math.floor(x)+(rand()<x%1?1:0)};
function spawnHunter(A,dawn){
 A.outings++;
 const rp=nearestRoad(A.x,A.y,['forest'],{margin:60})||nearestRoad(A.x,A.y,['main'],{margin:60}),car=spawnFrom('car',{color:'#4a5a3a'});car.label='myśliwy (koło łowieckie)';
 const stand=[A.x-14,A.y+18];
 car.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:v=>{
  const [cx,cy]=sideSpot(v,18);
  const h=new Ped({kind:'hunter',x:cx,y:cy,prop:'rifle',speed:13});h.label='myśliwy';h.amb=A.id;
  const dog=new Wild({kind:'dog',x:cx,y:cy+6,seed:Math.floor(rand()*1e5),nav:'foot',group:new Group(cx,cy,2,{fixed:true}),follow:h,leash:40,idleMin:.4,idleVar:1.5,col:'#8a5a32',col2:'#e8e0d0',flee:0});
  const leave=[{go:[cx,cy]},{call:q=>{q.dead=true;dog.dead=true;leaveMap(v)}}];
  h.run([{go:stand},{call:q=>{q.onStand=true;q.x=A.x;q.y=A.y-2;q.label='myśliwy na ambonie'}},
   {wait:420,until:q=>{const t=cal.hour();return q.kill||(dawn?t>8.6:(t>22.3||t<5))},pose:'stand',face:[POLANA.x,POLANA.y],tick:(q,dt)=>{
    q.aimT=(q.aimT||0)+dt;
    if(q.aim&&(q.aim.dead||q.aim.state==='run'||Math.hypot(q.aim.x-q.x,q.aim.y-q.y)>AMB_R+20)){q.aim=null;q.aimT=0}
    if(!q.aim){if(q.aimT<1)return;q.aimT=0;q.aim=target(q,AMB_R);if(q.aim)q.need=3+rand()*6;return}
    q.heading=Math.atan2(q.aim.y-q.y,q.aim.x-q.x);
    if(q.aimT>=q.need){const a=q.aim;q.aim=null;q.aimT=0;if(rand()<.85)q.kill=kill(q,a);else shot(q)}}},
   {call:q=>{q.onStand=false;q.x=stand[0];q.y=stand[1];
    // porcja z obwodu: tyle, ile wynika z presji zwierzyny, pomniejszona o widoczny strzał
    const bag=Math.max(0,outingYield()-(q.kill?1:0)),got=bag?cullBatch(bag,'Ambona '+(A.id+1)):0;A.got+=got+(q.kill?1:0);if(got||q.kill)q.prop='bag';
    if(q.kill){const c=q.kill;q.label='myśliwy zabiera pozyskaną zwierzynę';
     q.run([{go:[c.x-8,c.y]},{wait:6,pose:'kneel',face:[c.x,c.y]},{call:()=>{c.dead=true;q.prop='bag'}},...leave]);return}
    q.run(leave)}}]);
 }});
}
// harmonogram: wieczorem i o świcie każda ambona wystawia myśliwego (przesunięci w czasie); gdy jest ich już 3 w lesie, reszta „wychodzi” bez widocznej sceny
function scheduleHunters(h,se,we,dayN){
 if(se===0)return;
 const want=FA.reduction?1:planLeft()<=0?.15:we?.85:.55;
 for(const A of AMB.list){
  if(h>18+A.off*.9&&h<19.6&&A.hDay!==dayN){A.hDay=dayN;if(rand()<want){if(huntersOut()<3)spawnHunter(A,false);else{A.outings++;const g=cullBatch(Math.max(1,Math.round(outingYield()*.7)),'Ambona '+(A.id+1));A.got+=g}}}
  if(h>4.3+A.off*.5&&h<5.3&&A.dDay!==dayN){A.dDay=dayN;if(rand()<want*.6){if(huntersOut()<3)spawnHunter(A,true);else{A.outings++;const g=cullBatch(Math.max(1,Math.round(outingYield()*.7)),'Ambona '+(A.id+1));A.got+=g}}}
 }
}
// Polowanie zbiorowe (0.6): jesienią i zimą w sobotę. Linia myśliwych przy drodze, naganka przechodzi oddział i wypędza
// zwierzynę na linię. Na koniec pokot — podsumowanie pozyskania.
const DRIVES=[
 // 1.3.2: po przebudowie mapy (0.9) linia w 106 leżała na samej drodze j2-b1, przy autach — teraz stanowiska stoją ok. 50 px w lesie
 // na wschód od drogi, a naganka rusza spod polany (x 2080) i podchodzi na ok. 50 px przed linię
 {odd:'106',road:'j2-b1',line:[[1792,1240],[1792,1610]],beat:[[2080,1240],[2080,1610]]},
 {odd:'102',road:'a1-b1',line:[[1300,930],[1700,930]],beat:[[1300,650],[1700,650]]}
];
const lerp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
function spawnDrive(){
 const D=DRIVES[Math.floor(rand()*DRIVES.length)],e=EDGES.find(q=>q.id===D.road),H=5,B=4;
 const st={odd:D.odd,kills:[],people:[],temp:[],beatersDone:0,end:false};T.drive=st;
 toast('Polowanie zbiorowe w oddz. '+D.odd+'.');
 // zwierzyna w miedzy: kilka sztuk z obwodu wchodzi do pędzonego oddziału
 const mid=lerp(lerp(D.line[0],D.beat[0],.55),lerp(D.line[1],D.beat[1],.55),.5);
 const G=new Group(mid[0],mid[1],Math.floor(rand()*1e4),{range:[60,160],kind:'drive'});
 for(let i=0;i<3+Math.floor(rand()*3);i++){const left=GAME.filter(k=>FA.culled[k]<FA.plan[k]+1),k=left.length?left[Math.floor(rand()*left.length)]:'roe';
  st.temp.push(new Wild({kind:k,x:mid[0]+(rand()-.5)*200,y:mid[1]+(rand()-.5)*200,seed:Math.floor(rand()*1e5),group:G,male:rand()<.4}))}
 for(let c=0;c<2;c++){
  const car=spawnFrom('car',{color:pick(['#4a5a3a','#5a5f6a','#6a4a3a'])});car.label=c?'naganka':'myśliwi (polowanie zbiorowe)';st.people.push({car});
  car.goTo({edge:e,s:clamp(e.len/2+(c?60:-60),40,e.len-40)},{park:true,onArrive:v=>{
   const [cx,cy]=sideSpot(v,18),n=c?B:H;
   for(let i=0;i<n;i++){
    if(!c){const pos=lerp(D.line[0],D.line[1],(i+.5)/n),p=new Ped({kind:'hunter',x:cx+i*5,y:cy,prop:'rifle',speed:14});p.label='myśliwy (linia)';st.people.push({p});
     p.run([{go:pos},{call:q=>{q.onStand=true;q.label='myśliwy na stanowisku'}},
      {wait:600,pose:'stand',until:()=>st.end,tick:(q,dt)=>{q.aimT=(q.aimT||0)+dt;if(q.aimT<.5)return;q.aimT=0;
        const a=target(q,150);if(!a)return;q.heading=Math.atan2(a.y-q.y,a.x-q.x);if(rand()<.35){if(rand()<.75)st.kills.push(kill(q,a));else shot(q)}}},
      {call:q=>{q.onStand=false}},{go:[cx,cy]},{call:q=>{q.dead=true}}]);}
    else{const s0=lerp(D.beat[0],D.beat[1],(i+.5)/n),s1=lerp(lerp(D.beat[0],D.line[0],.85),lerp(D.beat[1],D.line[1],.85),(i+.5)/n);
     const p=new Ped({kind:'walker',x:cx+i*5,y:cy,speed:14,coat:'#e07020',cap:'#e07020'});p.label='naganiacz';st.people.push({p});
     p.run([{go:s0},{wait:8,pose:'stand',until:()=>st.people.filter(z=>z.p&&z.p.onStand).length>=H},{go:s1,speed:7},{call:()=>{st.beatersDone++}},
      {wait:600,pose:'stand',until:()=>st.end},{go:[cx,cy]},{call:q=>{q.dead=true}}]);}
   }
  }});
 }
}
function updateDrive(){
 const st=T.drive;if(!st)return;
 if(!st.end&&(st.beatersDone>=4||cal.hour()>14.5)){
  st.end=true;
  // pokot: zabrane zwierzęta, reszta „przeszła bokiem”, czasem dodatkowe pozyskanie na skraju oddziału
  for(const c of st.kills)c.dead=true;for(const a of st.temp)if(!a.dead)a.dead=true;
  const left=GAME.filter(k=>FA.culled[k]<FA.plan[k]);let extra=0;if(left.length&&rand()<.6*(FA.wolf.present?.7:1)){cull(left[Math.floor(rand()*left.length)],false);extra=1}
  const n=st.kills.length+extra,names={roe:'sarny',deer:'jelenie',boar:'dziki'},by={};for(const c of st.kills)by[c.kind]=(by[c.kind]||0)+1;
  toast('Pokot w oddz. '+st.odd+': '+(n?n+' szt.'+(st.kills.length?' ('+Object.entries(by).map(([k,v])=>names[k]+' '+v).join(', ')+')':''):'bez pozyskania')+'.');
 }
 if(st.end&&st.people.every(z=>z.car?(z.car.leaving||z.car.dead):z.p.dead)){T.drive=null;return}
 if(st.end)for(const z of st.people)if(z.car&&!z.car.leaving&&!z.car.dead&&st.people.every(q=>!q.p||q.p.dead)){z.car.leaving=true;leaveMap(z.car)}
}
// Strzał myśliwego: płoszy zwierzynę w okolicy polany.
function shot(q){sfx('shot');for(const a of E.animals)if(a.kind!=='dog'&&!a.dead&&Math.hypot(a.x-q.x,a.y-q.y)<420)a.escape&&a.escape(q.x,q.y)}
// Rozkład dnia (0.2): goście przyjeżdżają w swoich godzinach, w weekend więcej, w nocy las jest pusty.
export function updateVisitors(dt){
 const closed=ECO.ord.bar&&!ECO.ord.parking,ban=banned()||(closed&&rand()<.4);   // 1.1.7: bez parkingu część rezygnuje; reszta staje na poboczu przed szlabanem
 const h=cal.hour(),se=cal.season(),we=cal.weekend(),night=cal.night(),winter=se===3;
 for(const k of ['car','pick','walk','bike'])T[k]-=dt;
 const cars=E.vehicles.filter(v=>v.kind==='car'&&v.roam).length,rush=(h>6&&h<9)||(h>15&&h<18);
 if(T.car<=0){T.car=(night?240:rush?30:70)+rand()*60;if(cars<(rush?2:1))new Vehicle('car',{...ENTRY(rand()<.5),roam:['main'],color:pick(CAR_COLS)})}
 // grzyby jesienią (i ostatniego dnia lata), jagody latem
 const mushrooms=(se===1&&cal.dayOf()>=SEASON_DAYS)||se===2,berries=se===1&&!mushrooms;
 if(T.pick<=0){T.pick=(we?70:140)+rand()*90;if(!ban&&h>5.5&&h<12.5&&(mushrooms||berries)&&E.people.filter(p=>p.kind==='picker').length<4)spawnPickers(berries)}
 if(T.walk<=0){T.walk=((we?80:170)+rand()*100)*(winter?1.8:1);if(!ban&&h>9&&h<18)spawnWalker()}
 if(T.bike<=0){T.bike=(we?110:240)+rand()*140;if(!ban&&h>9&&h<19&&!winter){const b=spawnFrom('bike',{roam:['main','forest'],color:pick(['#4f6a8a','#c0473a','#3a7a5a','#d8b23a'])});b.label='rowerzysta';b.life=80+rand()*100}}
 // 0.6.3: rowerzyści jeżdżą za dnia — po przejażdżce albo o zmierzchu zjeżdżają z lasu
 for(const v of E.vehicles){if(v.kind!=='bike'||v.leaving||v.dead)continue;v.life=(v.life??120)-dt;if(v.life<=0||h>20||h<6){v.leaving=true;v.roam=null;v.label='rowerzysta wraca do domu';leaveMap(v)}}
 // 0.6.3: niektórzy odwiedzający sami zbierają śmieci po drodze
 T.clean=(T.clean||0)-dt;if(T.clean<=0){T.clean=20;for(const p of E.people){if(p.dead||p.hidden||!(p.kind==='walker'||p.kind==='picker')||p.petent)continue;
  const t=E.trash.find(q=>!q.dead&&!q.fire&&q.kind!=='snare'&&Math.hypot(q.x-p.x,q.y-p.y)<110);if(!t||rand()>.18)continue;
  t.dead=true;if(t.inc&&t.inc.status!=='done'){t.inc.status='done';for(const u of U)u.queue=u.queue.filter(q=>q!==t.inc)}bumpProtect(.5,'turysta posprzątał');
  toast((p.kind==='picker'?(p.berry?'Zbieracz jagód':'Grzybiarz'):'Spacerowicz')+' pozbierał śmieci w oddz. '+oddzial(t.x,t.y)+'.')}}
 const dayN=Math.floor(state.days);
 scheduleHunters(h,se,we,dayN);
 // polowanie zbiorowe: jesień i zima, sobota rano, raz na porę roku
 const sk=Math.floor(state.days/SEASON_DAYS);
 if((se===2||se===3)&&cal.dow()===5&&h>7.5&&h<8.5&&T.driveSeason!==sk&&!T.drive&&(planLeft()>=2||FA.reduction)){T.driveSeason=sk;spawnDrive()}
 updateDrive();
 // zimą zwierzyna ciągnie do paśników z karmą
 T.like=(T.like||0)-dt;if(T.like<=0){T.like=20;const L=likesNow(LIKES);for(const G of groups)if(G.kind==='roe'||G.kind==='deer'||G.kind==='boar')G.likes=L}
}
