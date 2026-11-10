// Kto mieszka w lesie i kto do niego przyjeżdża: zwierzyna w grupach, ruch na drodze, grzybiarze, spacerowicze, rowerzyści, myśliwy.
import {cal,hash,state,clamp,SEASON_DAYS} from '../core.js';
import {EDGES,NODES,POLANA,UPRAWA,AMBONA,roadClearance} from '../map.js';
import {goalNode,pointOn,nearestRoad} from '../roads.js';
import {E,NAV} from '../ents.js';
import {Vehicle,Ped,Wild,Group,rand} from './agents.js';
import {addTrash} from '../incidents.js';
import {sfx} from '../sound.js';
import {FA,cull,planLeft,likesNow} from './fauna.js';

const CAR_COLS=['#8c9b95','#a4684f','#6f86a0','#b9a56a','#7a8f6f','#a8a6a0','#5a5f6a','#9a4a3a'];
const pick=a=>a[Math.floor(rand()*a.length)];
const LIKES=[[POLANA.x,POLANA.y],[POLANA.x-60,POLANA.y+70],[UPRAWA.x+UPRAWA.w+60,UPRAWA.y+100],[UPRAWA.x+150,UPRAWA.y-50],[1200,1400]];
export const groups=[];
// Widoczna zwierzyna to reprezentacja populacji w obwodzie (FA.pop): mniej zwierząt na ekranie, ale ich liczba
// rośnie i maleje razem z populacją — po rozrodzie, odstrzałach koła łowieckiego, wilkach i zimie.
export function spawnWildlife(){
 for(const a of E.animals)if(a.kind!=='dog')a.dead=true;groups.length=0;
 let seed=10+Math.floor(state.days)*7;const g=(x,y,o)=>{const G=new Group(x,y,seed+=13,o);groups.push(G);return G};
 const add=(kind,x,y,G,o={})=>new Wild({kind,x:x+(rand()-.5)*40,y:y+(rand()-.5)*40,seed:seed++,group:G,...o});
 const P=FA.pop,se=cal.season();
 const roeN=clamp(Math.round(P.roe/18),0,3);
 for(const [x,y] of [[420,900],[2150,800]]){if(!roeN)break;const G=g(x,y,{likes:LIKES,kind:'roe'});for(let i=0;i<roeN;i++)add('roe',x,y,G,{male:i===0&&rand()<.5})}
 const deerN=clamp(Math.round(P.deer/4),0,4);
 if(deerN){const G=g(2050,1350,{likes:LIKES,range:[300,700],kind:'deer'});add('deer',2050,1350,G,{male:true});for(let i=1;i<deerN;i++)add('deer',2050,1350,G)}
 if(P.boar>=4){const G=g(1250,1500,{range:[200,500],kind:'boar',likes:LIKES});const sow=add('boar',1250,1500,G);sow.sow=se<=1&&P.boar>8;
  if(P.boar>=11)add('boar',1280,1510,G,{male:true});
  if(sow.sow)for(let i=0;i<clamp(Math.round(P.boar/6),2,4);i++)add('piglet',1250,1500,G,{follow:sow,flee:110})}
 if(P.fox>=3){const G=g(300,1300,{range:[300,700],kind:'fox'});add('fox',300,1300,G)}
 const wolfN=clamp(Math.round(P.wolf/2.5),0,3);
 if(wolfN){const G=g(2250,300,{range:[600,1100],kind:'wolf'});const lead=add('wolf',2250,300,G);for(let i=1;i<wolfN;i++)add('wolf',2250,300,G,{follow:lead,leash:90})}
 for(const [x,y] of [[2000,1150],[600,700]].slice(0,P.hare>=10?2:1)){const G=g(x,y,{range:[100,260],kind:'hare'});add('hare',x,y,G)}
}

// ───────── goście w lesie ─────────
const T={car:3,pick:6,walk:14,bike:20,hunt:0,huntDay:-1};
const forestEdges=()=>EDGES.filter(e=>e.kind==='forest'&&e.b!=='l1'&&e.a!=='l1');
function sideSpot(v,dist){const h=v.heading,sgn=rand()<.5?1:1;return[v.pos[0]+Math.cos(h)*dist*sgn,v.pos[1]+Math.sin(h)*dist*sgn]}
function spawnFrom(kind,o={}){const w=rand()<.5;return new Vehicle(kind,{from:w?'mW':'mE',to:w?'j1':'j2',s:0,...o})}
function leaveMap(v){v.goTo(goalNode(rand()<.5?'mW':'mE'),{leave:true})}
// Grzybiarze: przyjeżdżają autem, parkują na poboczu, chodzą z koszykiem po lesie i wracają (czasem zostawiają śmieci).
function spawnPickers(berry){
 // jagody: bór sosnowy 101 i młodszy bór 104 (drogi A i B); grzyby: wszędzie
 const E2=berry?EDGES.filter(e=>e.id==='j1-a1'||e.id==='a1-b1'):forestEdges(),e=pick(E2),s=60+rand()*(e.len-120),who=berry?'zbieracze jagód':'grzybiarze';
 const car=spawnFrom('car',{color:pick(CAR_COLS)});car.label=who;
 car.goTo({edge:e,s},{park:true,onArrive:v=>{
  const n=1+(rand()<.55?1:0),[cx,cy]=sideSpot(v,18);let back=0;
  for(let i=0;i<n;i++){
   const p=new Ped({kind:'picker',x:cx+i*6,y:cy,prop:berry?'bucket':'basket',berry,speed:13+rand()*3,coat:pick(['#8a6a4a','#5a6a8a','#7a3a3a','#4a6a4a','#9a8a5a']),cap:pick(['#c84a3a','#d8b23a','#3a4a6a','#e8e4dc'])});
   p.label=berry?'zbieracz jagód':'grzybiarz';
   p.run([{wander:{x:cx,y:cy,r:240,t:110+rand()*110,pickP:.7,until:()=>cal.hour()>15,ok:(x,y)=>roadClearance(x,y)>24}},{go:[cx,cy]},{call:q=>{
    if(rand()<.28)addTrash(q.x+(rand()-.5)*30,q.y+(rand()-.5)*30);
    q.hidden=true;q.dead=true;if(++back>=n){v.label=who+' — odjeżdżają';leaveMap(v)}}}]);
  }
  v.label=who+' (zaparkowani)';
 }});
}
// Spacerowicze: idą poboczem drogi leśnej od szosy i wracają; czasem z psem.
function spawnWalker(){
 const A=rand()<.5,x=A?852:1732,y0=1660,y1=A?1150+rand()*300:1200+rand()*200;
 const p=new Ped({kind:'walker',x,y:y0,speed:11+rand()*3,coat:pick(['#5a7aa0','#a05a5a','#6a8a5a','#c0a050','#7a5a8a']),cap:pick(['#6b4a2e','#e8e4dc','#3a3a3a'])});
 p.label='spacerowicz';
 let dog=null;if(rand()<.5){dog=new Wild({kind:'dog',x:x+8,y:y0,seed:Math.floor(rand()*1e5),nav:'foot',group:new Group(x,y0,1,{fixed:true}),follow:p,leash:60,idleMin:.4,idleVar:1.2,col:pick(['#c8a060','#3a3430','#e8e0d0']),col2:'#5a4636',flee:0})}
 p.run([{go:[x,y1]},{wait:4+rand()*4,pose:'stand'},{go:[x+(rand()-.5)*10,y0+10]},{call:q=>{q.dead=true;if(dog)dog.dead=true;if(rand()<.12)addTrash(q.x+12,q.y-30)}}]);
}
// Myśliwy z koła łowieckiego: wieczorem przyjeżdża, idzie z psem na ambonę i — jeśli plan łowiecki nie jest wykonany —
// strzela do sarny, jelenia albo dzika na polanie (nigdy do lochy prowadzącej warchlaki). Pozyskaną zwierzynę zabiera.
const GAME=['roe','deer','boar'];
function target(q){
 if(planLeft()<=0)return null;let best=null,bd=340;
 for(const a of E.animals){if(a.dead||!GAME.includes(a.kind)||a.state==='run'||a.sow||FA.culled[a.kind]>=FA.plan[a.kind])continue;
  const d=Math.hypot(a.x-AMBONA.x,a.y-AMBONA.y);if(d<bd){bd=d;best=a}}
 return best;
}
function spawnHunter(){
 const e=EDGES.find(q=>q.a==='b1'&&q.b==='b2'),car=spawnFrom('car',{color:'#4a5a3a'});car.label='myśliwy (koło łowieckie)';
 car.goTo({edge:e,s:60},{park:true,onArrive:v=>{
  const [cx,cy]=sideSpot(v,18);
  const h=new Ped({kind:'hunter',x:cx,y:cy,prop:'rifle',speed:12});h.label='myśliwy';
  const dog=new Wild({kind:'dog',x:cx,y:cy+6,seed:Math.floor(rand()*1e5),nav:'foot',group:new Group(cx,cy,2,{fixed:true}),follow:h,leash:40,idleMin:.4,idleVar:1.5,col:'#8a5a32',col2:'#e8e0d0',flee:0});
  const leave=[{go:[cx,cy]},{call:q=>{q.dead=true;dog.dead=true;leaveMap(v)}}];
  h.run([{go:[AMBONA.x-14,AMBONA.y+18]},{call:q=>{q.onStand=true;q.x=AMBONA.x;q.y=AMBONA.y-2;q.label='myśliwy na ambonie'}},
   {wait:420,until:q=>{const t=cal.hour();return q.kill||t>22.3||t<5},pose:'stand',face:[POLANA.x,POLANA.y],tick:(q,dt)=>{
    q.aimT=(q.aimT||0)+dt;if(q.aimT<1)return;q.aimT=0;
    const a=target(q);if(!a){if(rand()<.0015)shot(q);return}
    q.heading=Math.atan2(a.y-q.y,a.x-q.x);
    if(rand()<(FA.reduction?.05:.03)){shot(q);a.dead=true;const c={x:a.x,y:a.y,a:a.heading,kind:a.kind};FA.carcasses.push(c);q.kill=c;cull(a.kind,true)}}},
   {call:q=>{q.onStand=false;q.x=AMBONA.x-14;q.y=AMBONA.y+18;
    if(q.kill){const c=q.kill;q.label='myśliwy zabiera pozyskaną zwierzynę';
     q.run([{go:[c.x-8,c.y]},{wait:6,pose:'kneel',face:[c.x,c.y]},{call:()=>{c.dead=true;q.prop='bag'}},...leave]);return}
    // bez strzału na polanie — czasem pozyskanie gdzie indziej w obwodzie
    const left=GAME.filter(k=>FA.culled[k]<FA.plan[k]);if(left.length&&rand()<.3)cull(left[Math.floor(rand()*left.length)],false);
    q.run(leave)}}]);
 }});
}
// Strzał myśliwego: płoszy zwierzynę w okolicy polany.
function shot(q){sfx('shot');for(const a of E.animals)if(a.kind!=='dog'&&!a.dead&&Math.hypot(a.x-q.x,a.y-q.y)<420)a.escape&&a.escape(q.x,q.y)}
// Rozkład dnia (0.2): goście przyjeżdżają w swoich godzinach, w weekend więcej, w nocy las jest pusty.
export function updateVisitors(dt){
 const h=cal.hour(),se=cal.season(),we=cal.weekend(),night=cal.night(),winter=se===3;
 for(const k of ['car','pick','walk','bike'])T[k]-=dt;
 const cars=E.vehicles.filter(v=>v.kind==='car'&&v.roam).length,rush=(h>6&&h<9)||(h>15&&h<18);
 if(T.car<=0){T.car=(night?240:rush?30:70)+rand()*60;if(cars<(rush?2:1))new Vehicle('car',{...(rand()<.5?{from:'mW',to:'j1'}:{from:'mE',to:'j2'}),s:0,roam:['main'],color:pick(CAR_COLS)})}
 // grzyby jesienią (i ostatniego dnia lata), jagody latem
 const mushrooms=(se===1&&cal.dayOf()>=SEASON_DAYS)||se===2,berries=se===1&&!mushrooms;
 if(T.pick<=0){T.pick=(we?70:140)+rand()*90;if(h>5.5&&h<12.5&&(mushrooms||berries)&&E.people.filter(p=>p.kind==='picker').length<4)spawnPickers(berries)}
 if(T.walk<=0){T.walk=((we?80:170)+rand()*100)*(winter?1.8:1);if(h>9&&h<18)spawnWalker()}
 if(T.bike<=0){T.bike=(we?110:240)+rand()*140;if(h>9&&h<19&&!winter){const b=spawnFrom('bike',{roam:['main','forest'],color:pick(['#4f6a8a','#c0473a','#3a7a5a','#d8b23a'])});b.label='rowerzysta'}}
 const dayN=Math.floor(state.days);
 if(h>18&&h<19.5&&se!==0&&T.huntDay!==dayN){T.huntDay=dayN;if(rand()<(FA.reduction?1:planLeft()<=0?.15:we?.85:.5))spawnHunter()}
 // zimą zwierzyna ciągnie do paśników z karmą
 T.like=(T.like||0)-dt;if(T.like<=0){T.like=20;const L=likesNow(LIKES);for(const G of groups)if(G.kind==='roe'||G.kind==='deer'||G.kind==='boar')G.likes=L}
}
