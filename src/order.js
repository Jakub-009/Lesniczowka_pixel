// Porządek w lesie (0.8.2, przerobiony w 0.8.3): dzikie wysypiska i firma wywozowa, Policja wzywana na miejscu zdarzenia, fotopułapki, szlabany z rury i zatoka parkingowa.
import {state,toast,cal,clamp,rect,line,DAY_S,zl,hash,camera,VIEW} from './core.js';
import {EDGES,BARRIERS,oddzial,roadClearance,ptAt,hy} from './map.js';
import {ENTRY,exitNode,goalNode,nearestRoad,pointOn} from './roads.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,rand} from './life/agents.js';
import {ECO,pay,earn,canAfford,bumpProtect,planProgress} from './economy.js';
import {report,U,HK} from './incidents.js';
import {mail} from './mail.js';
import {removeTree,treesIn} from './forest.js';
import {J} from './jobs.js';
import {HK2} from './life/populate.js';

export const COSTS={waste:700,cams:2400,camsDay:25,parking:3500,parkingDay:15};
const open_=q=>q.status!=='done'&&q.status!=='gone';
const odd=(x,y)=>'oddz. '+oddzial(x,y);
export const ord=()=>ECO.ord;
export const camsOn=()=>!!ECO.ord.cams;
export const barClosed=()=>!!ECO.ord.bar;
export const parkingOn=()=>!!ECO.ord.parking;
// ogólny mnożnik nielegalnych wjazdów: zamknięte szlabany odstraszają co najmniej połowę
export const illegalFactor=()=>ECO.ord.bar?.5:1;
// Zatoka parkingowa (0.8.3): przy drodze leśnej j2–b1, tuż za szosą i przed szlabanem. Współrzędne lokalne (v — w bok od osi drogi na wschód, s — wzdłuż drogi od szosy).
const LBE=EDGES.find(e=>e.id==='j2-b1');
const lb=(v,s)=>{const p=ptAt(LBE,s);return[p[0]-p[3]*v,p[1]+p[2]*v]};
export const LAYBY={e:LBE,slots:[{v:42,s:126,car:null},{v:42,s:178,car:null}],approach:62,poly:[[20,58],[74,84],[74,196],[20,222]]};
// wolne miejsce dla odwiedzającego (albo -1)
export const freeSlot=()=>{if(!ECO.ord.parking)return -1;const f=LAYBY.slots.map((q,i)=>(!q.car||q.car.dead||q.car.leave)?i:-1).filter(i=>i>=0);return f.length?f[Math.floor(rand()*f.length)]:-1};
export function parkInBay(v,i,cb){
 const q=LAYBY.slots[i];q.car=v;const [x0,y0]=lb(16,LAYBY.approach+10),[x1,y1]=lb(q.v,Math.min(q.s-32,96)),[x2,y2]=lb(q.v,q.s);
 v.driveOff([[x0,y0],[x1,y1],[x2,y2]],{onArrive:()=>{v.v=0;v.parked=true;cb&&cb(lb(q.v+26,q.s))}});
}
// fotopułapki wiszą na słupkach szlabanów przy czterech wjazdach
export const CAM_SPOTS=[0,2,4,5].map(i=>BARRIERS[i]).filter(Boolean);

// ───────── dzikie wysypiska ─────────
const forestEdges=()=>EDGES.filter(e=>e.kind==='forest'&&e.a!=='l1'&&e.b!=='l1'&&e.a!=='a3'&&e.b!=='a3');
export function spawnDump(){
 const E2=forestEdges(),e=E2[Math.floor(rand()*E2.length)],s=60+rand()*(e.len-120);
 const car=new Vehicle('car',{...ENTRY(rand()<.5),color:'#6a6a64'});car.dark=true;car.label='samochód z przyczepą';
 car.goTo({edge:e,s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*18,cy=v.pos[1]+Math.sin(h)*18;
  const side=rand()<.5?1:-1;let sx=cx+Math.cos(h+1.57*side)*30,sy=cy+Math.sin(h+1.57*side)*30;
  if(!NAV.foot.walkable(sx,sy)){sx=cx+Math.cos(h-1.57*side)*30;sy=cy+Math.sin(h-1.57*side)*30}
  const p=new Ped({kind:'driver',x:cx,y:cy,speed:13});p.label='kierowca wyrzuca odpady';
  p.run([{go:[sx,sy]},{wait:9,pose:'kneel'},{call:()=>{
    const d={x:sx,y:sy,kind:'dump',dead:false,seed:Math.floor(rand()*1e4),t:0,report:camsOn()?2:25+rand()*30};E.trash.push(d);
    if(camsOn()){earn(450,'mandat — nagranie z fotopułapki');bumpProtect(2);mail('dump','Fotopułapka przy wjeździe zarejestrowała samochód sprawcy dzikiego wysypiska w '+odd(sx,sy)+' — mandat 450 zł.',{x:sx,y:sy,quiet:true})}}},
   {go:[cx,cy]},{call:q=>{q.dead=true;v.label='odjeżdża';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}}]);
  v.label='samochód z przyczepą (rozładunek)';
 }});
}
// Zlecenie firmie wywozowej: śmieciarka przyjeżdża w godzinach pracy, ładowacze zbierają odpady.
const W={q:[],cur:null};
export function orderWaste(inc){
 if(!inc||inc.status!=='new')return;
 if(!canAfford(COSTS.waste))return;
 pay(COSTS.waste,'firma wywozowa — dzikie wysypisko');inc.status='queued';W.q.push(inc);
 toast('Zlecono wywóz odpadów ('+zl(COSTS.waste)+'). Śmieciarka przyjedzie w godzinach pracy firmy (7–16).');
}
function startWaste(inc){
 const d=inc.ref,rp=nearestRoad(d.x,d.y,['main','forest']),truck=new Vehicle('waste',{...ENTRY(rand()<.5)});
 truck.label='śmieciarka jedzie po dzikie wysypisko';W.cur={inc,truck};inc.status='assigned';
 truck.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*20,cy=v.pos[1]+Math.sin(h)*20;v.label='załadunek odpadów';
  let back=0;
  for(let i=0;i<2;i++){
   const p=new Ped({kind:'worker',x:cx+i*7,y:cy,speed:14});p.label='pracownik firmy wywozowej';
   p.run([{go:[d.x+(i?9:-9),d.y+4]},{wait:8,pose:'kneel',face:[d.x,d.y]},{call:q=>{q.prop='bag'}},{go:[cx,cy]},{call:q=>{q.dead=true;
     if(++back>=2){d.dead=true;inc.status='done';bumpProtect(4);planProgress('handle',1);W.cur=null;
      mail('dump','Firma wywozowa uprzątnęła dzikie wysypisko w '+odd(d.x,d.y)+'.',{x:d.x,y:d.y});
      v.label='śmieciarka odjeżdża';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}}}]);
  }
 }});
}

// ───────── Policja ─────────
// 0.8.3: Policję wzywa się na miejscu zdarzenia (karta decyzji po złapaniu sprawcy). Radiowóz dojeżdża, wszyscy czekają,
// funkcjonariusze załatwiają sprawę (mandat, wpływ i ochrona liczone w incidents.js → finish), po czym Policja odjeżdża,
// a patrol i sprawca jadą dalej.
const POL=[];
export function dispatchPolice(inc,cb){
 POL.push({inc,wait:10+rand()*10,car:null,t:0,done:false,cb,at:null});
 toast('Wezwano Policję — wszyscy czekają na miejscu, radiowóz jest w drodze.');
}
function policeDone(p,why){
 if(p.done)return;p.done=true;if(why)toast(why);
 if(p.car&&!p.car.dead){p.car.beacon=false;p.car.stopped=false;p.car.label='radiowóz odjeżdża';p.car.goTo(goalNode(exitNode(p.car.pos[0])),{leave:true})}
 p.cb&&p.cb();p.cb=null;
}
function updatePolice(dt){
 for(const p of POL){
  if(p.done)continue;
  const inc=p.inc,v=inc.ref;
  if(!open_(inc)||!v||v.dead){policeDone(p);continue}
  if(!p.car){
   p.wait-=dt;if(p.wait>0)continue;
   p.car=new Vehicle('police',{...ENTRY(rand()<.5)});p.car.beacon=true;p.car.label='radiowóz jedzie na interwencję';p.t=0;continue;
  }
  if(p.at!=null){
   p.at-=dt;
   if(p.at<=0){p.car.label='Policja — sprawa załatwiona';policeDone(p)}
   continue;
  }
  const [cx,cy]=p.car.pos,d=Math.hypot(cx-v.pos[0],cy-v.pos[1]);
  if(d<105){p.at=8;p.car.stopped=true;p.car.v=0;p.car.label='Policja — interwencja';v.label='zatrzymany przez Policję';const m=v.man;if(m&&!m.dead)m.label=m.label+' — zatrzymany';continue}
  p.t-=dt;if(p.t<=0||p.car.arrived){p.t=2.5;const rp=nearestRoad(v.pos[0],v.pos[1],['main','forest']);p.car.goTo({edge:rp.edge,s:rp.s},{park:false,pen:250})}
 }
 for(let i=POL.length-1;i>=0;i--)if(POL[i].done)POL.splice(i,1);
}

// ───────── fotopułapki, szlabany, parking ─────────
export function buyCams(){
 if(camsOn()){toast('Fotopułapki już działają.');return}
 if(!canAfford(COSTS.cams))return;pay(COSTS.cams,'fotopułapki przy wjazdach');ECO.ord.cams=true;
 toast('Fotopułapki zamontowane przy wjazdach: nielegalne wjazdy i wysypiska są zgłaszane od razu, a sprawców karze mandat z nagrania ('+zl(COSTS.camsDay)+' dziennie).');
}
export function toggleBarriers(){
 ECO.ord.bar=!ECO.ord.bar;
 toast(ECO.ord.bar?'Szlabany zamknięte: o połowę mniej nielegalnych wjazdów'+(parkingOn()?'.':', ale grzybiarzy i spacerowiczów też będzie mniej. Parking leśny przy szosie to zmniejsza.'):'Szlabany otwarte.');
}
export function buyParking(){
 if(parkingOn()){toast('Parking leśny już stoi.');return}
 if(!canAfford(COSTS.parking))return;pay(COSTS.parking,'parking leśny z koszem');ECO.ord.parking=true;
 {const pts=LAYBY.poly.flatMap(([v,t])=>[lb(v,t),lb(v+34,t)]),x0=Math.min(...pts.map(q=>q[0]))-16,x1=Math.max(...pts.map(q=>q[0]))+16,y0=Math.min(...pts.map(q=>q[1]))-16,y1=Math.max(...pts.map(q=>q[1]))+16;
  for(const t of treesIn(x0,y0,x1,y1).slice())if(t.x>x0&&t.x<x1&&t.y>y0&&t.y<y1)removeTree(t)}
 toast('Zatoka parkingowa z koszem i stołem gotowa przy drodze leśnej tuż za szosą: odwiedzający zostawiają mniej śmieci, a przy zamkniętych szlabanach nadal mają gdzie zaparkować ('+zl(COSTS.parkingDay)+' dziennie za wywóz kosza).');
}
export const ordDaily=()=>(ECO.ord.cams?COSTS.camsDay:0)+(ECO.ord.parking?COSTS.parkingDay:0);

// ───────── pętla ─────────
const O={day:-1,dumpAt:null};
export function updateOrder(dt){
 const day=Math.floor(state.days),se=cal.season();
 if(day!==O.day){O.day=day;O.dumpAt=state.days>7&&rand()<(se===3?.08:.2)*illegalFactor()?day+(19.5+rand()*4)/24:null}
 if(O.dumpAt&&state.days>=O.dumpAt){O.dumpAt=null;spawnDump()}
 for(const t of E.trash){
  if(t.kind!=='dump'||t.dead||t.inc)continue;
  t.t+=dt;if(t.t>t.report)t.inc=report('dump',t.x,t.y,'Dzikie wysypisko w '+odd(t.x,t.y)+' — ktoś wywiózł do lasu odpady. Potrzebny wywóz ('+zl(COSTS.waste)+').',t);
 }
 if(!W.cur&&W.q.length&&cal.work(7,16)){const inc=W.q.shift();if(inc.status==='queued'&&!inc.ref.dead)startWaste(inc)}
 if(W.cur&&(W.cur.truck.dead)){W.cur.inc.status='new';W.cur=null}
 updatePolice(dt);
 const tg=ECO.ord.bar?1:0;swing=swing==null?tg:swing+clamp(tg-swing,-dt*.45,dt*.45);
}
HK.waste=orderWaste;HK.police=dispatchPolice;HK2.free=freeSlot;HK2.edge=()=>LAYBY.e;HK2.approach=()=>LAYBY.approach;HK2.park=parkInBay;HK2.reserve=(i,v)=>{LAYBY.slots[i].car=v};

// ───────── rysowanie ─────────
// ── szlabany: dwa słupki przy dukcie i czerwono-biała rura na zawiasie (otwarty: wzdłuż drogi, zamknięty: w poprzek, na kłódkę) ──
const geoC=new Map();
function barGeo(b){
 let g=geoC.get(b);
 if(!g){
  const rp=nearestRoad(b.x,b.y,['forest']),c=pointOn(rp.edge,rp.s),tg=ptAt(rp.edge,rp.s);
  let dx=b.x-c[0],dy=b.y-c[1];const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
  let tx=tg[2],ty=tg[3];if(tx*(c[0]-c[0])+ty*(c[1]-hy(c[0]))<0){tx=-tx;ty=-ty}   // otwarty szlaban leży w stronę od szosy
  g={A:[b.x,b.y],B:[c[0]-dx*d,c[1]-dy*d],a0:Math.atan2(ty,tx),a1:Math.atan2(-dy,-dx),L:2*d+8};
  let df=g.a1-g.a0;while(df>Math.PI)df-=2*Math.PI;while(df<-Math.PI)df+=2*Math.PI;g.df=df;geoC.set(b,g);
 }
 return g;
}
let swing=null;
const vis_=(x,y,m=90)=>x>camera.x-m&&y>camera.y-m&&x<camera.x+VIEW.w+m&&y<camera.y+VIEW.h+m;
function post(c,x,y,cap){x=Math.round(x);y=Math.round(y);c.fillStyle='#00000030';c.fillRect(x-2,y-1,9,9);rect(c,x-3,y-3,7,7,'#3e3b35');rect(c,x-2,y-2,5,5,'#8a867b');rect(c,x-2,y-2,5,1,'#b7b3a6');if(cap)rect(c,x-1,y-1,3,3,cap)}
function drawBarrier(c,b){
 const g=barGeo(b),k=swing??(ECO.ord.bar?1:0),th=g.a0+g.df*k,[ax,ay]=g.A,[bx,by]=g.B,ex=ax+Math.cos(th)*g.L,ey=ay+Math.sin(th)*g.L;
 post(c,bx,by,'#5a4a30');post(c,ax,ay,'#c8a24a');
 // cień rury, potem rura w czerwono-białe pasy
 line(c,ax+3,ay+4,ex+3,ey+4,'#0000002e',5);
 const n=Math.max(2,Math.round(g.L/7));
 for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,col=i%2?'#c8342b':'#f2efe6';line(c,ax+(ex-ax)*t0,ay+(ey-ay)*t0-2,ax+(ex-ax)*t1,ay+(ey-ay)*t1-2,col,5)}
 line(c,ax,ay-4,ex,ey-4,'#ffffff40',1);
 rect(c,ex-1,ey-4,3,5,'#7a1d17');
 if(k>.97){rect(c,ex-2,ey-1,5,5,'#2c2a26');rect(c,ex-1,ey,3,3,'#d4b24a')}   // kłódka
}
export function drawOrder(c,winter){
 for(const b of BARRIERS)if(vis_(b.x,b.y))drawBarrier(c,b);
 if(ECO.ord.cams)for(const b of CAM_SPOTS){
  const x=Math.round(b.x),y=Math.round(b.y)-4;rect(c,x-1,y-10,3,12,'#2c3a32');rect(c,x-5,y-18,11,8,'#14201a');rect(c,x-4,y-17,9,6,'#7d8a82');rect(c,x-4,y-17,9,1,'#a9b5ad');rect(c,x-1,y-15,4,3,'#14201a');rect(c,x,y-14,2,1,'#5d8790');
  if(Math.floor(performance.now()/700)%2)rect(c,x+3,y-17,2,2,'#ff4a3a');
 }
 if(ECO.ord.parking){
  const [mx,my]=lb(40,140);if(!vis_(mx,my,150))return;
  // żwir
  const poly=(pts,col)=>{c.fillStyle=col;c.beginPath();pts.forEach(([v,s],i)=>{const [x,y]=lb(v,s);i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y))});c.closePath();c.fill()};
  const P=LAYBY.poly;poly(P.map(([v,s])=>[v-2,s]),'#7d7461');poly([[22,61],[72,86],[72,194],[22,219]],'#a39a82');poly([[26,68],[68,90],[68,190],[26,213]],'#aea58c');
  for(let i=0;i<70;i++){const v=24+hash(i,3,9)*46,s=70+hash(i,7,2)*140,[x,y]=lb(v,s);rect(c,x,y,1+(i%3===0),1,i%2?'#c2b99f':'#8f866f')}
  for(const q of LAYBY.slots){const [x,y]=lb(q.v+1,q.s);c.globalAlpha=.16;rect(c,x-12,y-26,3,52,'#4a4332');rect(c,x+9,y-26,3,52,'#4a4332');c.globalAlpha=1}   // koleiny
  // bale: rząd kłód wzdłuż skraju i na końcach
  const log=(v,s,len,ang)=>{const [x,y]=lb(v,s),dx=Math.cos(ang)*len/2,dy=Math.sin(ang)*len/2;line(c,x-dx+2,y-dy+3,x+dx+2,y+dy+3,'#0000002e',6);line(c,x-dx,y-dy,x+dx,y+dy,'#5c4630',6);line(c,x-dx,y-dy-1,x+dx,y+dy-1,'#7a5e40',3);rect(c,x+dx-1,y+dy-2,3,5,'#c9a878')};
  const ang=Math.atan2(ptAt(LBE,120)[3],ptAt(LBE,120)[2]);
  for(let s=92;s<=196;s+=26)log(78,s,24,ang);
  log(72,82,14,ang+.7);log(72,206,14,ang-.7);
  // kosz na śmieci
  {const [x,y]=lb(66,190);c.fillStyle='#00000030';c.fillRect(Math.round(x)-3,Math.round(y)-1,10,10);rect(c,x-3,y-5,8,9,'#14201a');rect(c,x-2,y-4,6,7,'#3f8a52');rect(c,x-2,y-4,6,2,'#5fae72')}
  // znak „P” na słupku przy wjeździe
  {const [x,y]=lb(66,66);rect(c,x,y-2,2,12,'#4a4a46');c.fillStyle='#00000030';c.fillRect(Math.round(x)-4,Math.round(y)+8,12,3);rect(c,x-6,y-14,14,13,'#14201a');rect(c,x-5,y-13,12,11,'#2f5ea8');rect(c,x-2,y-11,2,7,'#f1e6c2');rect(c,x-2,y-11,5,2,'#f1e6c2');rect(c,x-2,y-8,5,2,'#f1e6c2');rect(c,x+2,y-10,1,3,'#f1e6c2')}
  // stół z ławami za bali
  {const [x,y]=lb(94,140),A=ang;c.save();c.translate(Math.round(x),Math.round(y));c.rotate(A);
   c.fillStyle='#00000030';c.fillRect(-4,-9,12,20);rect(c,-3,-9,6,18,'#6b5238');rect(c,-2,-9,4,18,'#8b6c48');rect(c,-8,-8,3,16,'#6b5238');rect(c,-7,-8,1,16,'#8b6c48');rect(c,5,-8,3,16,'#6b5238');rect(c,5,-8,1,16,'#8b6c48');c.restore()}
  if(winter){const pts=LAYBY.poly;c.globalAlpha=.6;poly(pts,'#e8eef2');c.globalAlpha=1}
 }
}
export const CAM_COUNT=CAM_SPOTS.length;
