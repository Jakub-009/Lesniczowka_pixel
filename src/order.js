// Porządek w lesie (0.8.2, przerobiony w 0.8.3): dzikie wysypiska i firma wywozowa, Policja wzywana na miejscu zdarzenia, fotopułapki, szlabany z rury i zatoka parkingowa.
import {state,toast,cal,clamp,rect,line,DAY_S,zl,hash,camera,VIEW,WORLD} from './core.js';
import {EDGES,BARRIERS,oddzial,roadClearance,ptAt,hy} from './map.js';
import {ENTRY,exitNode,goalNode,nearestRoad,pointOn,edgeOf,ROUTE} from './roads.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,rand,VHOOK} from './life/agents.js';
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
// Zatoka parkingowa (0.8.3; od 0.9 jedna na każdym wjeździe z szosy): przy drodze leśnej tuż za szosą i przed szlabanem.
// Współrzędne lokalne (v — w bok od osi drogi, s — wzdłuż drogi od szosy); sg=+1 zatoka po wschodniej stronie drogi, -1 po zachodniej.
const mkBay=(id,sg)=>({e:EDGES.find(q=>q.id===id),sg,slots:[{v:42,s:126,car:null},{v:42,s:178,car:null}],approach:62,poly:[[20,58],[74,84],[74,196],[20,222]]});
export const LAYBYS=[mkBay('j2-b1',1),mkBay('j1-a3',-1)];
const lb=(B,v,s)=>{const p=ptAt(B.e,s);return[p[0]-p[3]*v*B.sg,p[1]+p[2]*v*B.sg]};
const SLOTS=LAYBYS.flatMap(B=>B.slots.map(q=>({B,q})));
// wolne miejsce dla odwiedzającego (albo -1): indeks wspólny dla obu zatok
export const freeSlot=()=>{if(!ECO.ord.parking)return -1;const f=SLOTS.map((o,i)=>(!o.q.car||o.q.car.dead||o.q.car.leave)?i:-1).filter(i=>i>=0);return f.length?f[Math.floor(rand()*f.length)]:-1};
export function parkInBay(v,i,cb){
 const {B,q}=SLOTS[i];q.car=v;const [x0,y0]=lb(B,16,B.approach+10),[x1,y1]=lb(B,q.v,Math.min(q.s-32,96)),[x2,y2]=lb(B,q.v,q.s);
 v.driveOff([[x0,y0],[x1,y1],[x2,y2]],{onArrive:()=>{v.v=0;v.parked=true;cb&&cb(lb(B,q.v+26,q.s))}});
}
// fotopułapki wiszą na słupkach szlabanów przy czterech wjazdach
// 0.9: dwa wjazdy z szosy (j1, j2) + trzy wyjścia dukt za krawędź mapy (tam intruzi omijają szlabany)
const edgeSpot=(id,fromEnd)=>{const e=EDGES.find(q=>q.id===id);if(!e)return null;for(let s=fromEnd?e.len:0;fromEnd?s>=0:s<=e.len;s+=fromEnd?-6:6){const p=ptAt(e,s);if(p[0]>70&&p[0]<WORLD.w-70&&p[1]>70&&p[1]<WORLD.h-70)return{x:p[0]+p[3]*30,y:p[1]-p[2]*30}}return null};
export const CAM_SPOTS=[...BARRIERS,edgeSpot('b1-n3',true),edgeSpot('d1-e4',true),edgeSpot('d1-n1',true)].filter(Boolean);

// ───────── dzikie wysypiska ─────────
const forestEdges=()=>EDGES.filter(e=>e.kind==='forest'&&e.a!=='l1'&&e.b!=='l1'&&e.a!=='a3'&&e.b!=='a3');
export function spawnDump(){
 // 1.1.7: przy zamkniętych szlabanach wysypisko powstaje przed szlabanem, na poboczu dojazdu
 const vg=ECO.ord.bar?vergeSpot():null,E2=forestEdges(),e=vg?vg.e:E2[Math.floor(rand()*E2.length)],s=vg?vg.s:60+rand()*(e.len-120);
 const car=new Vehicle('car',{...ENTRY(rand()<.5),color:'#6a6a64'});car.dark=true;car.pub=true;car.label='samochód z przyczepą';
 car.goTo({edge:e,s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*18,cy=v.pos[1]+Math.sin(h)*18;
  const side=rand()<.5?1:-1;let sx=cx+Math.cos(h+1.57*side)*30,sy=cy+Math.sin(h+1.57*side)*30;
  if(!NAV.foot.walkable(sx,sy)){sx=cx+Math.cos(h-1.57*side)*30;sy=cy+Math.sin(h-1.57*side)*30}
  const p=new Ped({kind:'driver',x:cx,y:cy,speed:13});p.label='kierowca wyrzuca odpady';
  p.run([{go:[sx,sy]},{wait:9,pose:'kneel'},{call:()=>{
    const d={x:sx,y:sy,kind:'dump',dead:false,seed:Math.floor(rand()*1e4),t:0,report:camsOn()?2:25+rand()*30};E.trash.push(d);
    if(camsOn()){earn(450,'mandat — nagranie z fotopułapki');bumpProtect(2,'mandat z fotopułapki');mail('dump','Fotopułapka przy wjeździe nagrała sprawcę wysypiska w '+odd(sx,sy)+': mandat 450 zł.',{x:sx,y:sy,quiet:true})}}},
   {go:[cx,cy]},{call:q=>{q.dead=true;v.label='odjeżdża';leaveOut(v,v.pos[0])}}]);
  v.label='samochód z przyczepą (rozładunek)';
 }});
}
// Zlecenie firmie wywozowej: śmieciarka przyjeżdża w godzinach pracy, ładowacze zbierają odpady.
const W={q:[],cur:null};
export function orderWaste(inc){
 if(!inc||inc.status!=='new')return;
 if(!canAfford(COSTS.waste))return;
 pay(COSTS.waste,'firma wywozowa — dzikie wysypisko');inc.status='queued';W.q.push(inc);
 toast('Wywóz odpadów zlecony ('+zl(COSTS.waste)+'). Śmieciarka przyjedzie w godz. 7–16.');
}
// 1.1.1: opłacony wywóz po wczytaniu zapisu wraca do kolejki śmieciarki bez ponownej zapłaty
function requeueWaste(inc){if(!inc||inc.ref.dead)return;inc.status='queued';W.q.push(inc)}
function startWaste(inc){
 const d=inc.ref,rp=nearestRoad(d.x,d.y,['main','forest']),truck=new Vehicle('waste',{...ENTRY(rand()<.5)});
 truck.label='śmieciarka jedzie po dzikie wysypisko';W.cur={inc,truck};inc.status='assigned';
 truck.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:v=>{
  const h=v.heading,cx=v.pos[0]+Math.cos(h)*20,cy=v.pos[1]+Math.sin(h)*20;v.label='załadunek odpadów';
  let back=0;
  for(let i=0;i<2;i++){
   const p=new Ped({kind:'worker',x:cx+i*7,y:cy,speed:14});p.label='pracownik firmy wywozowej';
   p.run([{go:[d.x+(i?9:-9),d.y+4]},{wait:8,pose:'kneel',face:[d.x,d.y]},{call:q=>{q.prop='bag'}},{go:[cx,cy]},{call:q=>{q.dead=true;
     if(++back>=2){d.dead=true;inc.status='done';bumpProtect(4,'wysypisko uprzątnięte');planProgress('handle',1);W.cur=null;
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
 toast('Wezwano Policję. Radiowóz jedzie.');
}
function policeAway(p){if(p.car&&!p.car.dead){p.car.beacon=false;p.car.stopped=false;p.car.label='radiowóz odjeżdża';p.car.goTo(goalNode(exitNode(p.car.pos[0])),{leave:true})}}
function policeDone(p,why){
 if(p.done)return;p.done=true;if(why)toast(why);
 p.rel=p.offs&&p.offs.some(m=>!m.dead)?6:0;if(!p.rel)policeAway(p);
 p.cb&&p.cb();p.cb=null;
}
// 0.9: policjanci wysiadają, podchodzą do zatrzymanego i po załatwieniu sprawy wracają do radiowozu
function spawnOfficers(p,v){
 const c=p.car,h=c.heading,sx=Math.cos(h),sy=Math.sin(h);p.offs=[];
 for(let i=0;i<2;i++){
  const x=c.pos[0]+sx*(20+i*8),y=c.pos[1]+sy*(20+i*8),tx=v.pos[0]+(i?14:-14),ty=v.pos[1]+10;
  const o=new Ped({kind:'police',x,y,speed:15});o.label='policjant';p.offs.push(o);
  o.run([{go:[tx,ty],face:[v.pos[0],v.pos[1]]},{wait:600,pose:'talk',face:[v.pos[0],v.pos[1]],until:()=>p.done},{go:[x,y]},{call:q=>{q.dead=true}}]);
 }
}
function updatePolice(dt){
 for(const p of POL){
  // 1.0.2: wpis znika dopiero po odjeździe radiowozu (wcześniej usuwano go od razu, gdy policjanci jeszcze stali, i radiowóz zostawał na zawsze)
  if(p.done){if(p.rel>0){p.rel-=dt;if(p.rel<=0){policeAway(p);p.gone=true}}else p.gone=true;continue}
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
  if(d<105){p.at=8;spawnOfficers(p,v);p.car.stopped=true;p.car.v=0;p.car.label='Policja — interwencja';v.label='zatrzymany przez Policję';const m=v.man;if(m&&!m.dead)m.label=m.label+' — zatrzymany';continue}
  p.t-=dt;if(p.t<=0||p.car.arrived){p.t=2.5;const rp=nearestRoad(v.pos[0],v.pos[1],['main','forest','dukt']);p.car.goTo({edge:rp.edge,s:rp.s},{park:false,pen:250})}
 }
 for(let i=POL.length-1;i>=0;i--)if(POL[i].gone)POL.splice(i,1);
 // zabezpieczenie: radiowóz bez wpisu w POL (np. po błędzie) odjeżdża
 for(const v of E.vehicles)if(v.kind==='police'&&!v.dead&&!v._away&&!POL.some(p=>p.car===v)){v._away=true;v.beacon=false;v.stopped=false;v.label='radiowóz odjeżdża';v.goTo(goalNode(exitNode(v.pos[0])),{leave:true})}
}

// ───────── fotopułapki, szlabany, parking ─────────
export function buyCams(){
 if(camsOn()){toast('Fotopułapki już działają.');return}
 if(!canAfford(COSTS.cams))return;pay(COSTS.cams,'fotopułapki przy wjazdach');ECO.ord.cams=true;
 toast('Fotopułapki zamontowane ('+zl(COSTS.camsDay)+' dziennie).');
}
export function toggleBarriers(){
 ECO.ord.bar=!ECO.ord.bar;
 toast(ECO.ord.bar?'Szlabany zamknięte. Odwiedzający zostawiają auta '+(parkingOn()?'na parkingu albo ':'')+'na poboczu przed szlabanem; ekipy i maszyny otwierają i zamykają je same.':'Szlabany otwarte.');
}
export function buyParking(){
 if(parkingOn()){toast('Parking leśny już stoi.');return}
 if(!canAfford(COSTS.parking))return;pay(COSTS.parking,'parking leśny z koszem');ECO.ord.parking=true;
 for(const B of LAYBYS){const pts=B.poly.flatMap(([v,t])=>[lb(B,v,t),lb(B,v+34,t)]),x0=Math.min(...pts.map(q=>q[0]))-16,x1=Math.max(...pts.map(q=>q[0]))+16,y0=Math.min(...pts.map(q=>q[1]))-16,y1=Math.max(...pts.map(q=>q[1]))+16;
  for(const t of treesIn(x0,y0,x1,y1).slice())if(t.x>x0&&t.x<x1&&t.y>y0&&t.y<y1)removeTree(t)}
 toast('Parking przy szosie gotowy ('+zl(COSTS.parkingDay)+' dziennie za wywóz kosza).');
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
  t.t+=dt;if(t.t>t.report)t.inc=report('dump',t.x,t.y,'Dzikie wysypisko w '+odd(t.x,t.y)+'. Potrzebny wywóz ('+zl(COSTS.waste)+').',t);
 }
 if(!W.cur&&W.q.length&&cal.work(7,16)){const inc=W.q.shift();if(inc.status==='queued'&&!inc.ref.dead)startWaste(inc)}
 if(W.cur&&(W.cur.truck.dead)){W.cur.inc.status='new';W.cur=null}
 updatePolice(dt);
 updateGates(dt);
}
HK.waste=orderWaste;HK.requeue=requeueWaste;HK.police=dispatchPolice;HK2.free=freeSlot;HK2.verge=()=>vergeSpot();HK2.edge=i=>SLOTS[i].B.e;HK2.approach=i=>SLOTS[i].B.approach;HK2.park=parkInBay;HK2.reserve=(i,v)=>{SLOTS[i].q.car=v};

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
  let df=g.a1-g.a0;if(!isFinite(df))df=0;df=((df+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;g.df=df;geoC.set(b,g);
 }
 return g;
}
const vis_=(x,y,m=90)=>x>camera.x-m&&y>camera.y-m&&x<camera.x+VIEW.w+m&&y<camera.y+VIEW.h+m;
function post(c,x,y,cap){x=Math.round(x);y=Math.round(y);c.fillStyle='#00000030';c.fillRect(x-2,y-1,9,9);rect(c,x-3,y-3,7,7,'#3e3b35');rect(c,x-2,y-2,5,5,'#8a867b');rect(c,x-2,y-2,5,1,'#b7b3a6');if(cap)rect(c,x-1,y-1,3,3,cap)}
function drawBarrier(c,b){
 const g=barGeo(b),k=GATES[BARRIERS.indexOf(b)]?.k??(ECO.ord.bar?1:0),th=g.a0+g.df*k,[ax,ay]=g.A,[bx,by]=g.B,ex=ax+Math.cos(th)*g.L,ey=ay+Math.sin(th)*g.L;
 post(c,bx,by,'#5a4a30');post(c,ax,ay,'#c8a24a');
 // cień rury, potem rura w czerwono-białe pasy
 line(c,ax+3,ay+4,ex+3,ey+4,'#0000002e',5);
 const n=Math.max(2,Math.round(g.L/7));
 for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,col=i%2?'#c8342b':'#f2efe6';line(c,ax+(ex-ax)*t0,ay+(ey-ay)*t0-2,ax+(ex-ax)*t1,ay+(ey-ay)*t1-2,col,5)}
 line(c,ax,ay-4,ex,ey-4,'#ffffff40',1);
 rect(c,ex-1,ey-4,3,5,'#7a1d17');
 if(k>.97){rect(c,ex-2,ey-1,5,5,'#2c2a26');rect(c,ex-1,ey,3,3,'#d4b24a')}   // kłódka
}
function drawParking(c,winter){
 if(ECO.ord.parking)for(const B of LAYBYS){
  const [mx,my]=lb(B,40,140);if(!vis_(mx,my,150))continue;
  // żwir
  const poly=(pts,col)=>{c.fillStyle=col;c.beginPath();pts.forEach(([v,s],i)=>{const [x,y]=lb(B,v,s);i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y))});c.closePath();c.fill()};
  const P=B.poly;poly(P.map(([v,s])=>[v-2,s]),'#7d7461');poly([[22,61],[72,86],[72,194],[22,219]],'#a39a82');poly([[26,68],[68,90],[68,190],[26,213]],'#aea58c');
  for(let i=0;i<70;i++){const v=24+hash(i,3,9)*46,s=70+hash(i,7,2)*140,[x,y]=lb(B,v,s);rect(c,x,y,1+(i%3===0),1,i%2?'#c2b99f':'#8f866f')}
  for(const q of B.slots){const [x,y]=lb(B,q.v+1,q.s);c.globalAlpha=.16;rect(c,x-12,y-26,3,52,'#4a4332');rect(c,x+9,y-26,3,52,'#4a4332');c.globalAlpha=1}   // koleiny
  // bale: rząd kłód wzdłuż skraju i na końcach
  const log=(v,s,len,ang)=>{const [x,y]=lb(B,v,s),dx=Math.cos(ang)*len/2,dy=Math.sin(ang)*len/2;line(c,x-dx+2,y-dy+3,x+dx+2,y+dy+3,'#0000002e',6);line(c,x-dx,y-dy,x+dx,y+dy,'#5c4630',6);line(c,x-dx,y-dy-1,x+dx,y+dy-1,'#7a5e40',3);rect(c,x+dx-1,y+dy-2,3,5,'#c9a878')};
  const ang=Math.atan2(ptAt(B.e,120)[3],ptAt(B.e,120)[2]);
  for(let s=92;s<=196;s+=26)log(78,s,24,ang);
  log(72,82,14,ang+.7);log(72,206,14,ang-.7);
  // kosz na śmieci
  {const [x,y]=lb(B,66,190);c.fillStyle='#00000030';c.fillRect(Math.round(x)-3,Math.round(y)-1,10,10);rect(c,x-3,y-5,8,9,'#14201a');rect(c,x-2,y-4,6,7,'#3f8a52');rect(c,x-2,y-4,6,2,'#5fae72')}
  // znak „P” na słupku przy wjeździe
  {const [x,y]=lb(B,66,66);rect(c,x,y-2,2,12,'#4a4a46');c.fillStyle='#00000030';c.fillRect(Math.round(x)-4,Math.round(y)+8,12,3);rect(c,x-6,y-14,14,13,'#14201a');rect(c,x-5,y-13,12,11,'#2f5ea8');rect(c,x-2,y-11,2,7,'#f1e6c2');rect(c,x-2,y-11,5,2,'#f1e6c2');rect(c,x-2,y-8,5,2,'#f1e6c2');rect(c,x+2,y-10,1,3,'#f1e6c2')}
  // stół z ławami za bali
  {const [x,y]=lb(B,94,140),A=ang;c.save();c.translate(Math.round(x),Math.round(y));c.rotate(A);
   c.fillStyle='#00000030';c.fillRect(-4,-9,12,20);rect(c,-3,-9,6,18,'#6b5238');rect(c,-2,-9,4,18,'#8b6c48');rect(c,-8,-8,3,16,'#6b5238');rect(c,-7,-8,1,16,'#8b6c48');rect(c,5,-8,3,16,'#6b5238');rect(c,5,-8,1,16,'#8b6c48');c.restore()}
  if(winter){const pts=B.poly;c.globalAlpha=.6;poly(pts,'#e8eef2');c.globalAlpha=1}
 }
}
export function drawOrder(c,winter){
 drawParking(c,winter);   // żwir i wyposażenie parkingu leżą pod szlabanami
 for(const b of BARRIERS)if(vis_(b.x,b.y))drawBarrier(c,b);
if(ECO.ord.cams)for(const b of CAM_SPOTS){
  const x=Math.round(b.x),y=Math.round(b.y)-4;rect(c,x-1,y-10,3,12,'#2c3a32');rect(c,x-5,y-18,11,8,'#14201a');rect(c,x-4,y-17,9,6,'#7d8a82');rect(c,x-4,y-17,9,1,'#a9b5ad');rect(c,x-1,y-15,4,3,'#14201a');rect(c,x,y-14,2,1,'#5d8790');
  if(Math.floor(performance.now()/700)%2)rect(c,x+3,y-17,2,2,'#ff4a3a');
 }
}
export const CAM_COUNT=CAM_SPOTS.length;

// ───────── 1.1.7: obsługa szlabanów ─────────
// Szlaban zamknięty (ustawienie w Leśniczówce): auta odwiedzających zostają przed nim (parking albo pobocze), rowery, quady i crossy
// przejeżdżają obok. Ekipy, maszyny, ciężarówka, myśliwi, petenci z przyczepą i patrol zatrzymują się: kierowca wysiada, otwiera,
// pojazd przejeżdża, za szlabanem staje, ktoś zamyka. Kilka pojazdów naraz — zamyka ostatni. Straż pożarna i Policja: szlaban otwiera się bez postoju.
const FREE=new Set(['bike','quad','cross']),EMERG=new Set(['firetruck','police']);
export const GATES=BARRIERS.map(b=>{const rp=nearestRoad(b.x,b.y,['forest']);return{b,edge:rp.edge,s:rp.s,rx:rp.x,ry:rp.y,k:ECO.ord.bar?1:0,held:false,emerg:0,users:new Set(),man:null,wait:new Set()}});
// odległość (wzdłuż trasy) do szlabanu przed pojazdem; null — szlaban nie leży na najbliższym odcinku trasy
function gateAhead(v,G){
 const e=G.edge,gA=G.s;
 if(v.edge===e){const dirA=v.from===e.a,pos=dirA?v.s:v.len-v.s,d=dirA?gA-pos:pos-gA;if(d<-2)return null;
  if(v.final&&v.stopS!=null){const st=dirA?v.stopS:v.len-v.stopS;if(dirA?st<gA-4:st>gA+4)return null}return d}
 if(v.final)return null;const nx=v.route&&v.route[0];if(!nx)return null;const ne=edgeOf(v.to,nx);if(ne!==e)return null;
 return (v.len-v.s)+(v.to===e.a?gA:e.len-gA);
}
function gateMan(G,v,close){
 const h=v.heading,dx=v.pos[0]+Math.cos(h)*14,dy=v.pos[1]+Math.sin(h)*14;
 const p=new Ped({kind:'driver',x:dx,y:dy,speed:15});p.label=close?'zamyka szlaban':'otwiera szlaban';G.man=p;G.manT=0;
 p.run([{go:[G.b.x,G.b.y]},{wait:1.4,pose:'stand',face:[G.rx,G.ry]},{call:()=>{G.held=!close}},{go:[dx,dy]},{call:q=>{q.dead=true;if(G.man===q)G.man=null;if(close&&v.gClose===G)v.gClose=null}}]);
}
function gateHook(v,dt){
 if(FREE.has(v.kind)||v.dead||v.intruder||v.roam)return false;   // intruz omija szlaban duktem; ruch tranzytowy jeździ tylko szosą
 const closedSet=ECO.ord.bar;let stop=false;
 for(const G of GATES){
  const d=Math.hypot(v.pos[0]-G.rx,v.pos[1]-G.ry);
  if(v.gDone===G&&d>160)v.gDone=null;
  if(v.gClose===G){stop=true;continue}
  if(EMERG.has(v.kind)||v.beacon){if(d<160)G.emerg=4;continue}
  if(G.users.has(v)){const past=gateAhead(v,G)==null&&d>45+(v.cart?70:0);
   if(past||v.leave&&d>200){G.users.delete(v);v.gDone=G;
    if(closedSet&&G.held&&!G.users.size&&!G.wait.size&&!G.man&&!E.vehicles.some(w=>w!==v&&!w.dead&&!FREE.has(w.kind)&&(gateAhead(w,G)??999)<120)){v.gClose=G;gateMan(G,v,true);stop=true}}
   continue}
  if(!closedSet||v.gDone===G)continue;
  const a=gateAhead(v,G);if(a==null||a>60)continue;
  if(v.pub&&outside(v)){if(!v.turning){v.turning=true;leaveOut(v,v.pos[0])}stop=true;continue}   // 1.1.8: odwiedzający nie otwierają szlabanu — zawracają
  if(G.held&&G.k<.06&&!G.man){G.wait.delete(v);G.users.add(v);continue}
  G.wait.add(v);if(!G.held&&!G.man)gateMan(G,v,false);stop=true;
 }
 return stop;
}
function updateGates(dt){
 for(const G of GATES){
  for(const v of G.wait)if(v.dead||gateAhead(v,G)==null)G.wait.delete(v);
  for(const v of G.users)if(v.dead)G.users.delete(v);
  if(G.man){G.manT+=dt;if(G.man.dead)G.man=null;else if(G.manT>30){G.man.dead=true;G.man=null;G.held=G.users.size>0||G.wait.size>0}}   // zabezpieczenie: kierowca utknął
  if(!ECO.ord.bar){G.held=false;G.users.clear();G.wait.clear()}
  G.emerg=Math.max(0,G.emerg-dt);
  const tg=ECO.ord.bar&&!G.held&&G.emerg<=0?1:0;G.k+=clamp(tg-G.k,-dt*.6,dt*.6);
 }
 for(const v of E.vehicles)if(v.gClose&&(v.dead||!GATES.some(G=>G.man&&v.gClose===G)))v.gClose=null;
 if(TURNQ.length)turnQueue();
}
VHOOK.gate=gateHook;
// miejsca przed szlabanami dla aut odwiedzających (pobocze), gdy szlaban zamknięty, a na parkingu nie ma miejsca
export const VERGE=[{e:'j1-a3',s:[262,226]},{e:'j2-b1',s:[150,104]}].flatMap(o=>{const e=EDGES.find(q=>q.id===o.e);return o.s.map(s=>({e,s,car:null}))});
export function vergeSpot(){const f=VERGE.filter(q=>!q.car||q.car.dead||q.car.leave);return f.length?f[Math.floor(rand()*f.length)]:null}

// ───────── 1.1.8: odjazd odwiedzających przy zamkniętych szlabanach ─────────
// Auto stojące przed szlabanem (parking, pobocze, podjazd do kancelarii) wraca do szosy tą samą drogą: z zatoki zawraca łukiem
// przez parking, z pobocza — na drodze. Trasa omija odcinki ze szlabanami. Kto był w lesie przed zamknięciem, wyjeżdża przez szlaban (otwiera).
const GATE_EDGES=new Set(GATES.map(G=>G.edge));
function outside(v){
 for(const G of GATES){if(v.edge!==G.edge)continue;const pos=v.from===G.edge.a?v.s:v.len-v.s;return pos<G.s}
 const e=v.edge;return e.kind==='main'||['j1-a3','a3-l1','j2-b1'].includes(e.id)||e.a==='l1'||e.b==='l1';
}
function uturnPts(v){
 if(!['j1-a3','j2-b1'].includes(v.edge.id))return null;   // zawracanie łukiem tylko na dojazdach z zatoką / poboczem
 if(v.to==='j1'||v.to==='j2')return null;   // już przodem do szosy
 const rp=nearestRoad(v.pos[0],v.pos[1],['forest']),dx=rp.x-v.pos[0],dy=rp.y-v.pos[1],dd=Math.hypot(dx,dy),h=v.heading,f=[Math.sin(h),-Math.cos(h)];
 let l=dd>3?[dx/dd,dy/dd]:[-Math.cos(h),-Math.sin(h)];l=[l[0]-f[0]*(l[0]*f[0]+l[1]*f[1]),l[1]-f[1]*(l[0]*f[0]+l[1]*f[1])];const ln=Math.hypot(l[0],l[1])||1;l=[l[0]/ln,l[1]/ln];   // w stronę środka drogi
 const d=Math.min(60,dd)+7,P=(a,b)=>[v.pos[0]+f[0]*a+l[0]*b,v.pos[1]+f[1]*a+l[1]*b];
 return [P(10,d*.25),P(14,d*.6),P(10,d+2),P(2,d+5),P(-8,d+6)];
}
export function leaveOut(v,x){
 const goal=goalNode(exitNode(x??v.pos[0]));
 if(!ECO.ord.bar||!outside(v)){v.goTo(goal,{leave:true});return}
 const go=q=>{ROUTE.ban=GATE_EDGES;try{q.goTo(goal,{leave:true,pen:300})}finally{ROUTE.ban=null}q.turning=false};
 const pts=uturnPts(v);
 if(pts){if(E.vehicles.some(w=>w!==v&&!w.dead&&w.uturn&&w.edge===v.edge)){TURNQ.push([v,x]);return}   // jedno auto naraz zawraca na danym dojeździe
  v.stopped=false;v.uturn=true;v.driveOff(pts,{onArrive:()=>{v.uturn=false;go(v)}})}else go(v);
}
const TURNQ=[];
function turnQueue(){for(let i=TURNQ.length-1;i>=0;i--){const [v,x]=TURNQ[i];if(v.dead){TURNQ.splice(i,1);continue}if(!E.vehicles.some(w=>w!==v&&!w.dead&&w.uturn&&w.edge===v.edge)){TURNQ.splice(i,1);leaveOut(v,x)}}}
HK2.leave=leaveOut;
