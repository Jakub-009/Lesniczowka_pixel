// Trzy rodzaje „żywych” obiektów: pojazdy na grafie dróg, piesi ze scenariuszem kroków, dzika zwierzyna (A*, grupy, ucieczka).
// Wzorzec: klasy Walker / Person / Wild z life.js farmy, uogólnione — bez pojazdu gracza.
import {clamp,angDiff,hash,ctx,camera,VIEW,cal} from '../core.js';
import {NODES,ptAt,dirPt,dirProj} from '../map.js';
import {neighbours,edgeOf,planRoute,offMap,nearestRoad} from '../roads.js';
import {obb,collide} from '../geometry.js';
import {E,NAV,nearestThreat} from '../ents.js';
import * as S from './sprites.js';

const near=(x,y,r=80)=>x>camera.x-r&&x<camera.x+VIEW.w+r&&y>camera.y-r&&y<camera.y+VIEW.h+r;
let seedN=1;const rnd=()=>hash(seedN++,77,5);
export const WX={flee:1};   // 0.8.3: gdy w lesie jest wataha, sarny i jelenie są bardziej płochliwe (ustawia fauna.js)
export const rand=rnd;

// ───────── holowanie (model przyczepy jednoosiowej z tow.js farmy) ─────────
// forest = przyczepa ciągnika, log = naczepa ciężarówki, plow = pług leśny LPz, bunk = tylna rama forwardera (przegub)
const CARTS={forest:{hw:13,hh:30,tongue:14,axle:.4},log:{hw:13,hh:40,tongue:14,axle:.5},plow:{hw:13,hh:11,tongue:12,axle:.1},bunk:{hw:15,hh:26,tongue:5,axle:.25}};
const fwd=a=>[Math.sin(a),-Math.cos(a)];
function advanceCart(c,hx,hy,vehAngle){
 const d=CARTS[c.kind];if(c.hx==null){c.hx=hx;c.hy=hy;return}
 const dx=hx-c.hx,dy=hy-c.hy;c.hx=hx;c.hy=hy;
 let a=c.angle+(dx*Math.cos(c.angle)+dy*Math.sin(c.angle))/(d.tongue+d.hh*(1+d.axle));
 const rel=angDiff(vehAngle,a);if(Math.abs(rel)>1.15)a=vehAngle+Math.sign(rel)*1.15;
 c.angle=a;const f=fwd(a),L=d.tongue+d.hh;c.x=hx-f[0]*L;c.y=hy-f[1]*L;
}
function alignCart(c,hx,hy,angle){const d=CARTS[c.kind],f=fwd(angle),L=d.tongue+d.hh;c.angle=angle;c.x=hx-f[0]*L;c.y=hy-f[1]*L;c.hx=hx;c.hy=hy}
export const cartRear=c=>{const d=CARTS[c.kind],f=fwd(c.angle);return[c.x-f[0]*d.hh,c.y-f[1]*d.hh]};
export const cartFront=c=>{const d=CARTS[c.kind],f=fwd(c.angle);return[c.x+f[0]*d.hh,c.y+f[1]*d.hh]};

// ───────── pojazdy ─────────
// prędkości w px/s (12 px = 1 m); forest = mnożnik na drodze leśnej, off = prędkość w terenie, wb = rozstaw osi (promień skrętu)
export const VSPEC={
 car:{speed:100,forest:.55,acc:38,hw:10,hh:23,wb:30,name:'samochód osobowy'},
 patrol:{speed:104,forest:.62,acc:42,hw:11,hh:25,wb:32,name:'terenówka leśniczego',allow:['main','forest','drive']},
 van:{speed:88,forest:.6,acc:32,hw:11,hh:27,wb:34,name:'bus ekipy leśnej'},
 tractor:{speed:42,forest:.9,off:20,acc:14,hw:16,hh:30,wb:30,hitch:31,cart:'forest',name:'ciągnik z wyciągarką'},
 forwarder:{speed:48,forest:.9,off:30,acc:16,hw:15,hh:19,wb:22,hitch:21,cart:'bunk',name:'forwarder (zrywka)'},
 plower:{speed:40,forest:.9,off:16,acc:14,hw:16,hh:30,wb:30,hitch:31,cart:'plow',name:'ciągnik z pługiem LPz'},
 truck:{speed:82,forest:.55,acc:20,hw:14,hh:37,wb:44,hitch:34,cart:'log',name:'ciągnik siodłowy z wózkiem do dłużycy'},
 quad:{speed:70,forest:1,acc:40,hw:7,hh:11,wb:16,wild:true,name:'quad'},
 cross:{speed:80,forest:1,acc:45,hw:3,hh:11,wb:16,wild:true,name:'motocykl crossowy'},
 firetruck:{speed:92,forest:.6,acc:34,hw:13,hh:34,wb:40,name:'wóz strażacki',allow:['main','forest']},
 police:{speed:110,forest:.62,acc:46,hw:10,hh:24,wb:30,name:'radiowóz Policji'},
 waste:{speed:70,forest:.5,acc:20,hw:13,hh:35,wb:42,name:'śmieciarka firmy wywozowej'},
 bike:{speed:28,forest:.9,acc:14,hw:3,hh:9,wb:14,rider:true,name:'rowerzysta'}
};
// Jazda (0.3): pojazd goni „marchewkę” — punkt przesuwający się po pasie ruchu (albo po ścieżce w terenie) —
// i skręta jak prawdziwy pojazd (model rowerowy, skręt kół ograniczony). Nie przesuwa się bokiem i nie obraca w miejscu.
const MAXSTEER=.72;
const SMALLV=new Set(['car','patrol','van','quad','cross','bike','police']);
export class Vehicle{
 constructor(kind,o={}){
  this.kind=kind;this.spec=VSPEC[kind];this.allow=o.allow||this.spec.allow||['main','forest'];
  Object.assign(this,{color:o.color||'#8c9b95',v:0,laneX:0,travel:0,dwell:0,steer:0,route:null,final:false,stopS:null,park:false,parked:false,arrived:false,
   leave:false,dead:false,roam:o.roam||null,despawn:o.despawn??true,blockT:0,ghost:false,load:0,cap:o.cap||8,label:o.label||null,speedMul:1,stopped:false,off:null});
  this.setEdge(o.from,o.to);this.s=o.s||0;
  this.s=o.s||0;{const t=dirPt(this.edge,this.from,this.s);this.heading=Math.atan2(t[2],-t[3])}const [cx,cy]=this.carrot();this.pos=[cx,cy];this.shape=obb(cx,cy,this.spec.hw,this.spec.hh,this.heading);
  const ck=o.cart||this.spec.cart;if(ck){this.cart={kind:ck,x:0,y:0,angle:0};const H=this.hitch();alignCart(this.cart,H[0],H[1],this.heading)}
  E.vehicles.push(this);
 }
 get x(){return this.pos[0]}get y(){return this.pos[1]}
 setEdge(from,to){const e=edgeOf(from,to);this.from=from;this.to=to;this.edge=e;this.len=e.len;const t=dirPt(e,from,0);this.dirH=Math.atan2(t[2],-t[3])}
 hitch(){const k=this.spec.hitch;return[this.pos[0]-Math.sin(this.heading)*k,this.pos[1]+Math.cos(this.heading)*k]}
 // Punkt na pasie ruchu odcinka from→to w odległości s od from (prawy pas + zjazd na pobocze dla bieżącego odcinka).
 lanePos(from,to,s,cur){
  const e=edgeOf(from,to),[px,py,tx,ty]=dirPt(e,from,s);
  const lane=(this.spec.rider?Math.min(26,e.w/2-2):e.lane)+(cur?this.laneX:0);
  return[px-ty*lane,py+tx*lane];
 }
 // Następny węzeł trasy (przy jeździe bez celu wybierany z wyprzedzeniem, żeby pojazd mógł ściąć zakręt).
 peek(k){
  if(this.route&&k<this.route.length)return this.route[k];
  if(this.roam&&k===0&&(!this.route||!this.route.length)&&!(this.final&&this.stopS!=null)){const n=this.chooseNext();if(n){this.route=[n];return n}}
  return null;
 }
 la(){return this.off?(this.off.work?14:20):Math.max(26,16+this.v*.35)}
 // „Marchewka”: punkt na trasie o la() przed rzutem pojazdu na trasę — pojazd zawsze goni punkt przed sobą (pure pursuit).
 carrot(){
  const LA=this.la();
  if(this.off){const P=this.off.pts;let i=this.off.i,t=this.off.t+LA;
   while(i<P.length-1){const L=Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1])||1;if(t<=L)return[P[i][0]+(P[i+1][0]-P[i][0])*t/L,P[i][1]+(P[i+1][1]-P[i][1])*t/L];t-=L;i++}
   return P[P.length-1]}
  let from=this.from,to=this.to,len=this.len,s=this.s+LA,k=0,cur=true;
  const stopOn=kk=>this.stopS!=null&&(this.final?kk===0:this.route&&kk===this.route.length);
  for(let guard=0;guard<64;guard++){
   if(stopOn(k)&&s>this.stopS){s=this.stopS;break}
   if(s<=len)break;
   const nx=this.peek(k);if(!nx){s=len;break}
   s-=len;from=to;to=nx;len=edgeOf(from,to).len;k++;cur=false;
  }
  return this.lanePos(from,to,s,cur);
 }
 // Postój na poboczu w bieżącym miejscu (start gry, zakup maszyny).
 parkHere(){this.final=true;this.stopS=this.s;this.arrived=true;this.parked=true;this.park=true;this.laneX=this.edge.w/2+10-this.edge.lane;this.pos=this.carrot();this.v=0;
  if(this.cart){const H=this.hitch();alignCart(this.cart,H[0],H[1],this.heading)}this.shape=obb(this.pos[0],this.pos[1],this.spec.hw,this.spec.hh,this.heading);return this}
 // Jedź do celu {edge,s}. park = zjedź na pobocze; leave = zniknij po dojechaniu.
 goTo(goal,o={}){
  if(this.off)this.rejoin();
  // zawracanie w miejscu: tylko stojące małe auta i tylko gdy objazd byłby dużo dłuższy; ciężki sprzęt jedzie do skrzyżowania albo placu nawrotowego
  const small=SMALLV.has(this.kind)&&Math.abs(this.v)<3;
  const plan=planRoute(this.from,this.to,this.s,goal,this.allow,o.pen??(small?2500:6000));
  this.parked=false;this.arrived=false;this.stopped=false;this.park=!!o.park;this.leave=!!o.leave;this.onArrive=o.onArrive||null;this.roam=null;
  if(!plan){this.stopS=this.s;this.final=true;return}
  if(plan.reverse){const s=this.len-this.s;this.setEdge(this.to,this.from);this.s=s}
  this.route=plan.nodes.slice(1);this.final=plan.nodes.length===0;this.stopS=plan.stopS;
 }
 // Zjazd w teren: jazda po ścieżce pts (lista punktów), np. szlakiem zrywkowym albo bruzdami pługa.
 driveOff(pts,o={}){
  this.off={pts:[[this.pos[0],this.pos[1]],...pts],i:0,t:0,done:false,work:o.work||null};if(this.off.pts.length<2)this.off.pts.push([this.pos[0]+.1,this.pos[1]]);
  this.offArrive=o.onArrive||null;this.arrived=false;this.parked=false;this.final=false;this.stopS=null;this.route=null;this.roam=null;this.stopped=false;this.laneX=0;
 }
 // Powrót na drogę w najbliższym punkcie (po jeździe w terenie): pas dobrany do kierunku jazdy.
 rejoin(){
  const rp=nearestRoad(this.pos[0],this.pos[1],this.allow,{margin:20});this.off=null;
  const e=rp.edge,tg=ptAt(e,rp.s),ab=Math.atan2(tg[2],-tg[3]);
  if(Math.cos(angDiff(this.heading,ab))>=0){this.setEdge(e.a,e.b);this.s=rp.s}else{this.setEdge(e.b,e.a);this.s=e.len-rp.s}
  this.final=true;this.stopS=this.s;this.arrived=true;this.laneX=0;
 }
 cruise(){
  if(this.stopped||this.parked||this.arrived)return 0;
  let sp;
  if(this.off){sp=this.spec.off||this.spec.speed*.4;if(this.off.work)sp=Math.min(sp,this.off.workSpeed||14)}
  else sp=this.spec.speed*(this.edge.kind==='forest'?(this.beacon?.92:this.spec.forest):this.edge.kind==='drive'?.35:1)*this.speedMul;
  const [cx,cy]=this.carrot(),want=Math.atan2(cx-this.pos[0],-(cy-this.pos[1])),err=Math.abs(angDiff(this.heading,want));
  if(err>.6)sp=Math.min(sp,12);                       // ciasny zakręt albo zawracanie
  let rem=null;
  if(this.off)rem=this.offRemaining();
  else if(this.final&&this.stopS!=null)rem=this.stopS-this.s;
  else if(this.len-this.s<50&&this.route&&this.route.length&&this.turnAhead())sp=Math.min(sp,24);   // zwalnia przed skrętem (nie przy jeździe prosto)
  if(rem!=null)sp=Math.min(sp,Math.max(2.5,Math.sqrt(2*30*Math.max(0,rem-2))));
  return sp;
 }
 // Czy na najbliższym węźle trasa skręca (kąt > ok. 25°)? Przy jeździe prosto pojazd nie zwalnia.
 turnAhead(){
  const nx=this.route[0],e2=nx&&edgeOf(this.to,nx);if(!e2)return true;
  const a=dirPt(this.edge,this.from,this.len),b=dirPt(e2,this.to,0);
  return a[2]*b[2]+a[3]*b[3]<.9;
 }
 offRemaining(){const O=this.off,P=O.pts;let r=0;for(let k=O.i;k<P.length-1;k++){const L=Math.hypot(P[k+1][0]-P[k][0],P[k+1][1]-P[k][1]);r+=k===O.i?Math.max(0,L-O.t):L}return r}
 probe(){const h=this.heading,sp=this.spec,reach=14+this.v*.55,d=sp.hh+reach/2;return obb(this.pos[0]+Math.sin(h)*d,this.pos[1]-Math.cos(h)*d,Math.max(3,sp.hw*.7),reach/2,h)}
 // Rzut pojazdu na trasę: postęp s na odcinku (albo na ścieżce w terenie); przejście na kolejny odcinek przy ścinaniu zakrętu.
 progress(){
  const [x,y]=this.pos;
  if(this.off){const O=this.off,P=O.pts;
   for(let g=0;g<4;g++){const A=P[O.i],B=P[O.i+1];if(!B){O.done=true;break}
    const L=Math.hypot(B[0]-A[0],B[1]-A[1])||1,t=((x-A[0])*(B[0]-A[0])+(y-A[1])*(B[1]-A[1]))/L;O.t=clamp(t,0,L);
    if(t>=L-2&&O.i<P.length-2){O.i++;O.t=0;continue}
    if(O.i>=P.length-2&&t>=L-2)O.done=true;break}
   return}
  let sp=dirProj(this.edge,this.from,x,y,this.s,110);
  if(this.final&&this.stopS!=null)sp=Math.min(sp,this.stopS);
  this.s=Math.max(0,sp);
  for(let g=0;g<3;g++){
   if(this.final)break;
   const nx=this.peek(0);if(!nx)break;
   const e=edgeOf(this.to,nx),sn=dirProj(e,this.to,x,y,0,60);
   if(this.s>=this.len-2||(sn>=1&&this.s>=this.len-this.la()-4)){this.arriveNode();if(this.dead)return;this.s=Math.max(0,dirProj(this.edge,this.from,x,y,0,60));continue}
   break;
  }
  if(!this.final&&!this.peek(0)&&this.s>=this.len-1)this.arriveNode();
 }
 update(dt){
  let target=0;
  if(this.dwell>0){this.dwell-=dt}
  else{
   target=this.cruise();let blocked=false;
   if(target>0&&!this.off){
    const pr=this.probe();
    for(const w of E.vehicles)if(w!==this&&!w.parked&&!w.dead&&!w.off&&(w.kind!=='bike'||this.kind==='bike')&&Math.cos(w.heading-this.heading)>.3&&collide(pr,w.shape)){blocked=true;break}
    if(!blocked)for(const a of E.animals)if(a.big&&collide(pr,{shape:'circle',x:a.x,y:a.y,r:6})){blocked=true;break}
    if(!blocked)for(const p of E.people)if(!p.hidden&&collide(pr,{shape:'circle',x:p.x,y:p.y,r:4})){blocked=true;break}
    this.blockT=blocked?this.blockT+dt:0;
    if(!this.ghost&&this.blockT>6){this.ghost=true;this.ghostT=0}
    if(this.ghost){this.ghostT+=dt;if(this.ghostT>3){this.ghost=false;this.blockT=0}}
    if(blocked&&!this.ghost)target=0;
   }
  }
  this.v+=clamp(target-this.v,-110*dt,this.spec.acc*dt);if(this.v<0)this.v=0;
  // zjazd na pobocze przy parkowaniu: przesunięcie pasa narasta przed miejscem postoju
  if(!this.off){const parkSoon=this.parked||(this.park&&this.final&&this.stopS!=null&&this.stopS-this.s<90);
   const lx=parkSoon?this.edge.w/2+10-this.edge.lane:0;this.laneX+=clamp(lx-this.laneX,-22*dt,22*dt)}
  // skręt (model rowerowy) i ruch do przodu
  if(this.v>.05){
   const [cx,cy]=this.carrot(),dd=Math.hypot(cx-this.pos[0],cy-this.pos[1]);
   if(dd>1){const want=Math.atan2(cx-this.pos[0],-(cy-this.pos[1])),e=angDiff(this.heading,want),st=clamp(e*1.8,-MAXSTEER,MAXSTEER);
    this.steer=st/MAXSTEER;this.heading+=this.v/this.spec.wb*Math.tan(st)*dt}
   const step=this.v*dt;this.pos=[this.pos[0]+Math.sin(this.heading)*step,this.pos[1]-Math.cos(this.heading)*step];this.travel+=step;
   if(this.off&&this.off.work)this.off.work(this,step);
   this.progress();
  }
  // dojazd do celu
  if(!this.arrived&&!this.dead){
   let ok=false;
   if(this.off){const O=this.off,P=O.pts,L=P[P.length-1],dl=Math.hypot(this.pos[0]-L[0],this.pos[1]-L[1]);
    // cel w terenie bywa wewnątrz okręgu skrętu — po kilku sekundach krążenia blisko celu uznajemy dojazd
    if(O.done||this.offRemaining()<50)O.endT=(O.endT||0)+dt;
    ok=dl<7||(this.v<3&&dl<14)||(O.done&&dl<24)||(O.endT>5&&dl<60)}
   else if(this.final&&this.stopS!=null){const [sx,sy]=this.lanePos(this.from,this.to,this.stopS,true),dl=Math.hypot(this.pos[0]-sx,this.pos[1]-sy);ok=dl<8||(this.s>=this.stopS-3&&this.v<4)}
   if(ok){
    this.v=0;this.arrived=true;
    if(this.off){const cb=this.offArrive;this.offArrive=null;cb&&cb(this)}
    else{if(this.park)this.parked=true;if(this.leave)this.dead=true;const cb=this.onArrive;this.onArrive=null;cb&&cb(this)}
   }
  }
  this.shape=obb(this.pos[0],this.pos[1],this.spec.hw,this.spec.hh,this.heading);
  if(this.cart){const H=this.hitch(),c=this.cart;advanceCart(c,H[0],H[1],this.heading)}
 }
 chooseNext(){
  const node=this.to,prev=this.from;
  if(offMap(node)&&this.despawn&&this.travel>200)return null;
  const opts=neighbours(node).filter(n=>this.roam.includes(n.edge.kind)),fw=opts.filter(n=>n.to!==prev);
  if(fw.length){const wt=fw.map(n=>this.spec.wild&&n.edge.kind==='forest'?3:1),tot=wt.reduce((a,b)=>a+b,0);let r=rnd()*tot,k=0;while(k<fw.length-1&&r>=wt[k]){r-=wt[k];k++}return fw[k].to}
  return opts.length?prev:null;
 }
 arriveNode(){
  const node=this.to;let next=null;
  if(this.route&&this.route.length){next=this.route.shift();this.final=this.route.length===0&&!this.roam}
  else if(this.roam){if(offMap(node)&&this.despawn&&this.travel>200){this.dead=true;return}next=this.chooseNext()}
  if(!next){if(this.roam&&offMap(node)){this.dead=true;return}this.s=this.len;this.final=true;this.stopS=this.len;return}
  this.setEdge(node,next);this.s=0;
 }
 draw(){
  const [x,y]=this.pos;if(!near(x,y,120))return;
  if(this.cart){const c=this.cart;if(c.kind==='forest')S.forestTrailer(ctx,c,this.load,this.cap);else if(c.kind==='log')S.logTrailer(ctx,c,this.load,this.cap);else if(c.kind==='plow')S.plowTop(ctx,c,this.plowing);else S.bunkTop(ctx,c,this.load,this.cap)}
  const k=this.kind,h=this.heading,t=this.travel;
  if(k==='car')S.carTop(ctx,x,y,h,this.color,t);
  else if(k==='patrol')S.patrolTop(ctx,x,y,h,t,this.beacon);
  else if(k==='van')S.vanTop(ctx,x,y,h,t);
  else if(k==='police')S.policeTop(ctx,x,y,h,t,this.beacon);
  else if(k==='waste')S.wasteTop(ctx,x,y,h,t);
  else if(k==='firetruck')S.fireTop(ctx,x,y,h,t,this.beacon);
  else if(k==='tractor'||k==='plower')S.tractorTop(ctx,x,y,h,t,this.steer);
  else if(k==='forwarder')S.forwarderTop(ctx,x,y,h,t,this.steer);
  else if(k==='truck')S.truckTop(ctx,x,y,h,t,this.cap?this.load/this.cap:0);
  else if(k==='quad')S.quadTop(ctx,x,y,h,t,this.color);
  else if(k==='cross')S.crossTop(ctx,x,y,h,t);
  else if(k==='bike')S.bikeTop(ctx,x,y,h,t*.12,this.color);
 }
}

// ───────── piesi: scenariusz kroków {go}, {wait,pose}, {call}, {wander} ─────────
export class Ped{
 constructor(o){
  Object.assign(this,{kind:'walker',x:0,y:0,heading:0,speed:15,step:0,pose:null,prop:null,script:[],cur:null,path:null,pi:0,hidden:false,dead:false,nav:'foot'},o);
  this.look=S.LOOKS[this.kind]||S.LOOKS.walker;E.people.push(this);
 }
 run(steps){this.script=steps.slice();this.cur=null;this.path=null;return this}
 then(...steps){this.script.push(...steps);return this}
 get busy(){return !!this.cur||this.script.length>0}
 nav_(){return NAV[this.nav]||NAV.foot}
 plan(tx,ty){
  const N=this.nav_();let t=[tx,ty];if(!N.walkable(tx,ty)){const q=N.nearestWalkable(tx,ty,4);if(q)t=q}
  let p=N.findPath(this.x,this.y,t[0],t[1]);if(!p||!p.length)p=[t];p[p.length-1]=[tx,ty];this.path=p;this.pi=0;
 }
 walk(dt,sp){
  const wp=this.path&&this.path[this.pi];if(!wp)return true;
  const dx=wp[0]-this.x,dy=wp[1]-this.y,d=Math.hypot(dx,dy),st=sp*dt;
  if(d<=st){this.x=wp[0];this.y=wp[1];this.pi++;return this.pi>=this.path.length}
  this.heading+=clamp(angDiff(this.heading,Math.atan2(dy,dx)),-8*dt,8*dt);
  this.x+=dx/d*st;this.y+=dy/d*st;this.step+=dt*sp/5;return false;
 }
 update(dt){
  if(this.hidden)return;
  if(!this.cur){this.cur=this.script.shift()||null;this.path=null;this.t=0;this.sub=null;if(!this.cur){this.pose=null;this.onIdle&&this.onIdle(this);return}}
  const c=this.cur;this.t+=dt;
  if(c.go){if(!this.path)this.plan(c.go[0],c.go[1]);this.pose=null;if(this.walk(dt,c.speed||this.speed)){this.cur=null;if(c.face)this.heading=Math.atan2(c.face[1]-this.y,c.face[0]-this.x)}}
  else if(c.wait!=null){this.pose=c.pose||'stand';if(c.face)this.heading=Math.atan2(c.face[1]-this.y,c.face[0]-this.x);c.tick&&c.tick(this,dt);if(this.t>=c.wait||(c.until&&c.until(this))){this.pose=null;this.cur=null}}
  else if(c.call){this.cur=null;c.call(this)}
  else if(c.wander){
   const W=c.wander;
   if((this.t>W.t||(W.until&&W.until()))&&!this.sub){this.cur=null;return}
   if(!this.sub){for(let k=0;k<12;k++){const a=rnd()*6.283,d=20+rnd()*W.r,x=W.x+Math.cos(a)*d,y=W.y+Math.sin(a)*d;if(this.nav_().walkable(x,y)&&(!W.ok||W.ok(x,y))){this.sub={x,y,pause:rnd()<(W.pickP??.6)?2+rnd()*3:0};this.plan(x,y);break}}if(!this.sub){this.sub={pause:1}}}
   if(this.sub.pause!=null&&this.pi>=(this.path?.length||0)){this.pose=W.pose||'pick';this.sub.pause-=dt;if(this.sub.pause<=0){this.sub=null;this.pose=null;W.onPick&&W.onPick(this)}}
   else{this.pose=null;if(this.walk(dt,this.speed*.8)){if(!this.sub.pause){this.sub=null}}}
  }
 }
 draw(){if(this.hidden||!near(this.x,this.y,20))return;S.personTop(ctx,this)}
}

// ───────── dzika zwierzyna (Wild + Group z farmy) ─────────
export const ASPEC={
 roe:{name:'sarna',speed:13,run:52,flee:120,leash:220,idle:[4,10],big:true},
 deer:{name:'jeleń',speed:15,run:58,flee:170,leash:300,idle:[5,12],big:true},
 boar:{name:'dzik',speed:12,run:44,flee:100,leash:200,idle:[3,8],big:true},
 piglet:{name:'warchlak',speed:13,run:46,flee:100,leash:120,idle:[2,5]},
 fox:{name:'lis',speed:30,run:78,flee:130,leash:420,idle:[3,9]},
 wolf:{name:'wilk',speed:24,run:70,flee:240,leash:520,idle:[3,8],big:true},
 hare:{name:'zając',speed:18,run:80,flee:70,leash:160,idle:[3,9]},
 dog:{name:'pies',speed:22,run:50,flee:0,leash:200,idle:[5,12]}
};
// Aktywność dobowa: zwierzyna w dzień leży w ostojach (gęstwina), o zmierzchu i nocą wychodzi żerować.
export function activeNow(kind,seed=0){
 const h=cal.hour(),dusk=h<7.5||h>18.5;
 if(kind==='dog')return true;
 if(kind==='boar'||kind==='piglet'||kind==='wolf')return h<6.5||h>19.5;
 if(kind==='roe')return dusk||seed%3===0;          // część saren żeruje też w dzień
 return dusk;                                      // jelenie, lisy, zające
}
export class Group{
 constructor(hx,hy,seed,o={}){Object.assign(this,{hx,hy,ox:hx,oy:hy,seed,n:0,t:20+hash(seed,3)*40,range:[220,520],fixed:false,kind:'roe',act:null},o)}
 rnd(){return hash(this.seed,50+this.n++)}
 update(dt){
  if(this.fixed)return;
  const act=activeNow(this.kind,this.seed);
  if(act!==this.act){this.act=act;this.t=60+this.rnd()*80;
   if(!act){this.hx=this.ox;this.hy=this.oy;return}                     // powrót do ostoi
   if(this.likes&&this.rnd()<.75){const [x,y]=this.likes[Math.floor(this.rnd()*this.likes.length)];this.hx=x;this.hy=y;return}}
  if(!act)return;
  this.t-=dt;if(this.t>0)return;this.t=60+this.rnd()*120;
  for(let k=0;k<20;k++){const a=this.rnd()*6.283,d=this.range[0]+this.rnd()*(this.range[1]-this.range[0]),x=this.hx+Math.cos(a)*d,y=this.hy+Math.sin(a)*d;
   if(NAV.wild.walkable(x,y)){this.hx=x;this.hy=y;return}}
 }
}
export class Wild{
 constructor(o){
  const sp=ASPEC[o.kind];
  Object.assign(this,{heading:hash(o.seed,1)*6.28,v:0,state:'idle',t:1+hash(o.seed,2)*6,path:[],pi:0,phase:hash(o.seed,4)*6,rng:(o.seed*7919)|0,chkT:0,stuckN:0,
   speed:sp.speed,run:sp.run,flee:sp.flee,leash:sp.leash,idleMin:sp.idle[0],idleVar:sp.idle[1],big:!!sp.big,nav:'wild',dead:false},o);
  this.name=sp.name;const N=this.N();const p=N.nearestWalkable(this.x,this.y,12);if(p){this.x=p[0];this.y=p[1]}this.lx=this.x;this.ly=this.y;
  E.animals.push(this);
 }
 N(){return NAV[this.nav]}
 rand(){this.rng=(Math.imul(this.rng,1664525)+1013904223)|0;return((this.rng>>>0)%100000)/100000}
 plan(tx,ty){const p=this.N().findPath(this.x,this.y,tx,ty);if(!p||!p.length)return false;this.path=p;this.pi=0;return true}
 wander(){
  const G=this.group,rest=!activeNow(this.kind,this.seed);
  if(rest&&!this.follow&&Math.hypot(this.x-G.hx,this.y-G.hy)<70){this.state='idle';this.t=20+this.rand()*40;return}   // leży w ostoi
  for(let k=0;k<14;k++){const a=this.rand()*6.283,d=20+this.rand()*(rest?40:this.leash)*(this.follow?.25:1),bx=this.follow?this.follow.x:G.hx,by=this.follow?this.follow.y:G.hy,x=bx+Math.cos(a)*d,y=by+Math.sin(a)*d;
   if(this.N().walkable(x,y)&&this.plan(x,y)){this.state='walk';return}}
  this.state='idle';this.t=3+this.rand()*4;
 }
 escape(fx,fy){
  const away=Math.atan2(this.y-fy,this.x-fx);
  for(const dist of [320,220,140])for(const off of [0,.5,-.5,1,-1,1.6,-1.6]){const x=this.x+Math.cos(away+off)*dist,y=this.y+Math.sin(away+off)*dist;
   if(this.N().walkable(x,y)&&this.plan(x,y)){this.state='run';this.runT=0;return true}}
  return false;
 }
 update(dt){
  this.phase+=dt;
  if(this.flee&&this.state!=='run'){
   const th=nearestThreat(this.x,this.y,this.flee*((this.kind==='roe'||this.kind==='deer')?WX.flee:1));
   if(th)this.escape(th.x,th.y);
   else if(this.kind==='roe'||this.kind==='deer'||this.kind==='hare'){for(const w of E.animals)if(w.kind==='wolf'&&Math.hypot(w.x-this.x,w.y-this.y)<150){this.escape(w.x,w.y);break}}
  }
  if(this.state==='idle'){this.v+=clamp(-this.v,-40*dt,40*dt);this.t-=dt;if(this.t<=0)this.wander();return}
  const wp=this.path[this.pi];
  if(!wp){this.state='idle';this.t=this.idleMin+this.rand()*this.idleVar;return}
  const dx=wp[0]-this.x,dy=wp[1]-this.y,d=Math.hypot(dx,dy);
  if(d<7){this.pi++;return}
  const run=this.state==='run',sp=run?this.run:this.speed;
  this.heading+=clamp(angDiff(this.heading,Math.atan2(dy,dx)),-(run?7:3.5)*dt,(run?7:3.5)*dt);
  this.v+=clamp(sp-this.v,-60*dt,60*dt);
  this.x+=Math.cos(this.heading)*this.v*dt;this.y+=Math.sin(this.heading)*this.v*dt;
  this.chkT+=dt;
  if(this.chkT>=2){const moved=Math.hypot(this.x-this.lx,this.y-this.ly);this.lx=this.x;this.ly=this.y;this.chkT=0;
   if(moved<8){this.stuckN++;if(this.stuckN>=3){const p=this.N().nearestWalkable(this.x,this.y,10);if(p){this.x=p[0];this.y=p[1]}this.state='idle';this.t=2;this.stuckN=0;this.v=0}else this.wander()}else this.stuckN=0}
 }
 draw(){
  if(!near(this.x,this.y,30))return;const run=this.state==='run',k=this.kind;
  if(k==='roe')S.roeTop(ctx,this.x,this.y,this.heading,this.phase,run,this.male);
  else if(k==='deer')S.deerTop(ctx,this.x,this.y,this.heading,this.phase,run,this.male);
  else if(k==='boar'||k==='piglet')S.boarTop(ctx,this.x,this.y,this.heading,this.phase,run,k==='piglet');
  else if(k==='wolf')S.wolfTop(ctx,this.x,this.y,this.heading,this.phase,run);
  else if(k==='hare')S.hareTop(ctx,this.x,this.y,this.heading,this.phase,run);
  else if(k==='dog')S.dogTop(ctx,this.x,this.y,this.heading,this.phase,this.col,this.col2);
  else S.foxTop(ctx,this.x,this.y,this.heading,this.phase,run);
 }
}
