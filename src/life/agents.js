// Trzy rodzaje „żywych” obiektów: pojazdy na grafie dróg, piesi ze scenariuszem kroków, dzika zwierzyna (A*, grupy, ucieczka).
// Wzorzec: klasy Walker / Person / Wild z life.js farmy, uogólnione — bez pojazdu gracza.
import {clamp,angDiff,hash,ctx,camera,VIEW,cal} from '../core.js';
import {NODES} from '../map.js';
import {neighbours,edgeOf,planRoute,offMap} from '../roads.js';
import {obb,collide} from '../geometry.js';
import {E,NAV,nearestThreat} from '../ents.js';
import * as S from './sprites.js';

const near=(x,y,r=80)=>x>camera.x-r&&x<camera.x+VIEW.w+r&&y>camera.y-r&&y<camera.y+VIEW.h+r;
let seedN=1;const rnd=()=>hash(seedN++,77,5);
export const rand=rnd;

// ───────── holowanie (model przyczepy jednoosiowej z tow.js farmy) ─────────
const CARTS={forest:{hw:13,hh:30,tongue:14,axle:.4},log:{hw:13,hh:40,tongue:14,axle:.5}};
const fwd=a=>[Math.sin(a),-Math.cos(a)];
function advanceCart(c,hx,hy,vehAngle){
 const d=CARTS[c.kind];if(c.hx==null){c.hx=hx;c.hy=hy;return}
 const dx=hx-c.hx,dy=hy-c.hy;c.hx=hx;c.hy=hy;
 let a=c.angle+(dx*Math.cos(c.angle)+dy*Math.sin(c.angle))/(d.tongue+d.hh*(1+d.axle));
 const rel=angDiff(vehAngle,a);if(Math.abs(rel)>1.15)a=vehAngle+Math.sign(rel)*1.15;
 c.angle=a;const f=fwd(a),L=d.tongue+d.hh;c.x=hx-f[0]*L;c.y=hy-f[1]*L;
}
function alignCart(c,hx,hy,angle){const d=CARTS[c.kind],f=fwd(angle),L=d.tongue+d.hh;c.angle=angle;c.x=hx-f[0]*L;c.y=hy-f[1]*L;c.hx=hx;c.hy=hy}

// ───────── pojazdy ─────────
export const VSPEC={
 car:{speed:46,hw:10,hh:23,name:'samochód osobowy'},
 patrol:{speed:50,hw:11,hh:25,name:'terenówka leśniczego',allow:['main','forest','drive']},
 van:{speed:44,hw:11,hh:27,name:'bus ekipy leśnej'},
 tractor:{speed:24,hw:16,hh:30,hitch:31,cart:'forest',name:'ciągnik zrywkowy'},
 truck:{speed:42,hw:14,hh:37,hitch:34,cart:'log',name:'ciężarówka do drewna'},
 quad:{speed:44,hw:7,hh:11,wild:true,name:'quad'},
 cross:{speed:52,hw:3,hh:11,wild:true,name:'motocykl crossowy'},
 bike:{speed:15,hw:3,hh:9,rider:true,name:'rowerzysta'}
};
const TURN=2.4;
export class Vehicle{
 constructor(kind,o={}){
  this.kind=kind;this.spec=VSPEC[kind];this.allow=o.allow||this.spec.allow||['main','forest'];
  Object.assign(this,{color:o.color||'#8c9b95',v:0,laneX:0,travel:0,dwell:0,steer:0,route:null,final:false,stopS:null,park:false,parked:false,arrived:false,
   leave:false,dead:false,roam:o.roam||null,despawn:o.despawn??true,blockT:0,ghost:false,load:0,cap:o.cap||8,label:o.label||null,speedMul:1,stopped:false,passengers:[]});
  this.setEdge(o.from,o.to);this.s=o.s||0;this.heading=this.dirH;this.place();
  if(this.spec.cart){this.cart={kind:this.spec.cart,x:0,y:0,angle:0};const H=this.hitch();alignCart(this.cart,H[0],H[1],this.heading)}
  E.vehicles.push(this);
 }
 get x(){return this.pos[0]}get y(){return this.pos[1]}
 setEdge(from,to){const e=edgeOf(from,to);this.from=from;this.to=to;this.edge=e;const A=NODES[from],B=NODES[to];this.len=e.len;this.dx=(B[0]-A[0])/e.len;this.dy=(B[1]-A[1])/e.len;this.dirH=Math.atan2(this.dx,-this.dy)}
 hitch(){const k=this.spec.hitch;return[this.pos[0]-Math.sin(this.heading)*k,this.pos[1]+Math.cos(this.heading)*k]}
 // Jedź do celu {edge,s}. park = zjedź na pobocze; leave = zniknij po dojechaniu.
 goTo(goal,o={}){
  const plan=planRoute(this.from,this.to,this.s,goal,this.allow);
  this.parked=false;this.arrived=false;this.stopped=false;this.park=!!o.park;this.leave=!!o.leave;this.onArrive=o.onArrive||null;this.roam=null;
  if(!plan){this.stopS=this.s;this.final=true;return}
  if(plan.reverse){const s=this.len-this.s;this.setEdge(this.to,this.from);this.s=s;this.dwell=Math.max(this.dwell,.6)}
  this.route=plan.nodes.slice(1);this.final=plan.nodes.length===0;this.stopS=plan.stopS;
 }
 cruise(){
  if(this.stopped||this.parked||this.arrived)return 0;
  let sp=this.spec.speed*(this.edge.kind==='forest'&&!this.spec.wild?.62:this.edge.kind==='drive'?.4:1)*this.speedMul;
  if(Math.abs(angDiff(this.heading,this.dirH))>.5)sp=Math.min(sp,8);
  if(this.final&&this.stopS!=null){const d=this.stopS-this.s;sp=Math.min(sp,Math.max(3,Math.sqrt(2*36*Math.max(0,d))))}
  else if(this.len-this.s<36)sp=Math.min(sp,16);   // zwalnia przed skrzyżowaniem
  return sp;
 }
 probe(){const h=this.heading,sp=this.spec,reach=14+this.v*.55,d=sp.hh+reach/2;return obb(this.pos[0]+Math.sin(h)*d,this.pos[1]-Math.cos(h)*d,Math.max(3,sp.hw*.7),reach/2,h)}
 update(dt){
  if(this.dwell>0){this.dwell-=dt;this.v=Math.max(0,this.v-80*dt)}
  else{
   let target=this.cruise(),blocked=false;
   if(target>0){
    const pr=this.probe();
    for(const w of E.vehicles)if(w!==this&&!w.parked&&!w.dead&&(w.kind!=='bike'||this.kind==='bike')&&Math.cos(w.heading-this.heading)>.3&&collide(pr,w.shape)){blocked=true;break}
    if(!blocked)for(const a of E.animals)if(a.big&&collide(pr,{shape:'circle',x:a.x,y:a.y,r:6})){blocked=true;break}
    if(!blocked)for(const p of E.people)if(!p.hidden&&collide(pr,{shape:'circle',x:p.x,y:p.y,r:4})){blocked=true;break}
    this.blockT=blocked?this.blockT+dt:0;
    if(!this.ghost&&this.blockT>6){this.ghost=true;this.ghostT=0}
    if(this.ghost){this.ghostT+=dt;if(this.ghostT>3){this.ghost=false;this.blockT=0}}
    if(blocked&&!this.ghost)target=0;
   }
   this.v+=clamp(target-this.v,-80*dt,(this.spec.wild?30:20)*dt);
  }
  this.s+=this.v*dt;this.travel+=this.v*dt;
  if(this.final&&this.stopS!=null&&!this.arrived&&this.s>=this.stopS-.3){
   this.s=this.stopS;this.v=0;this.arrived=true;if(this.park)this.parked=true;
   if(this.leave)this.dead=true;const cb=this.onArrive;this.onArrive=null;cb&&cb(this);
  }
  let guard=0;while(this.s>=this.len&&!this.dead&&!this.arrived&&guard++<4)this.arriveNode();
  const dh=angDiff(this.heading,this.dirH),st=clamp(dh,-TURN*dt,TURN*dt);this.heading+=st;this.steer=clamp(st/(TURN*dt||1),-1,1);
  const lx=this.parked?this.edge.w/2+10-this.edge.lane:0;this.laneX+=clamp(lx-this.laneX,-14*dt,14*dt);
  this.place();
  if(this.cart){const H=this.hitch(),c=this.cart;advanceCart(c,H[0],H[1],this.heading);
   // stojąc: przyczepa powoli prostuje się za pojazdem (np. po zjeździe na pobocze)
   if(Math.abs(this.v)<.5){c.angle+=clamp(angDiff(c.angle,this.heading),-dt*.9,dt*.9);const d=CARTS[c.kind],f=fwd(c.angle),L=d.tongue+d.hh;c.x=H[0]-f[0]*L;c.y=H[1]-f[1]*L}}
 }
 arriveNode(){
  const node=this.to,prev=this.from,over=this.s-this.len;let next=null;
  if(this.route&&this.route.length){next=this.route.shift();this.final=this.route.length===0}
  else if(this.roam){
   if(offMap(node)&&this.despawn&&this.travel>200){this.dead=true;return}
   const opts=neighbours(node).filter(n=>this.roam.includes(n.edge.kind)),fw=opts.filter(n=>n.to!==prev);
   if(fw.length){const wt=fw.map(n=>this.spec.wild&&n.edge.kind==='forest'?3:1),tot=wt.reduce((a,b)=>a+b,0);let r=rnd()*tot,k=0;while(k<fw.length-1&&r>=wt[k]){r-=wt[k];k++}next=fw[k].to}
   else{next=prev;this.dwell=1.4}
  }
  if(!next){this.s=this.len;this.v=0;this.arrived=true;return}
  this.setEdge(node,next);this.s=Math.max(0,over);
 }
 place(){
  const A=NODES[this.from],cx=A[0]+this.dx*this.s,cy=A[1]+this.dy*this.s,h=this.heading;
  const lane=(this.spec.rider?Math.min(26,this.edge.w/2-2):this.edge.lane)+this.laneX;
  this.pos=[cx+Math.cos(h)*lane,cy+Math.sin(h)*lane];
  this.shape=obb(this.pos[0],this.pos[1],this.spec.hw,this.spec.hh,h);
 }
 draw(){
  const [x,y]=this.pos;if(!near(x,y,120))return;
  if(this.cart){if(this.cart.kind==='forest')S.forestTrailer(ctx,this.cart,this.load,this.cap);else S.logTrailer(ctx,this.cart,this.load,this.cap)}
  const k=this.kind,h=this.heading,t=this.travel;
  if(k==='car')S.carTop(ctx,x,y,h,this.color,t);
  else if(k==='patrol')S.patrolTop(ctx,x,y,h,t,this.beacon);
  else if(k==='van')S.vanTop(ctx,x,y,h,t);
  else if(k==='tractor')S.tractorTop(ctx,x,y,h,t,this.steer);
  else if(k==='truck')S.truckTop(ctx,x,y,h,t);
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
  else if(c.wait!=null){this.pose=c.pose||'stand';if(c.face)this.heading=Math.atan2(c.face[1]-this.y,c.face[0]-this.x);c.tick&&c.tick(this,dt);if(this.t>=c.wait){this.pose=null;this.cur=null}}
  else if(c.call){this.cur=null;c.call(this)}
  else if(c.wander){
   const W=c.wander;
   if(this.t>W.t&&!this.sub){this.cur=null;return}
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
export class Group{
 constructor(hx,hy,seed,o={}){Object.assign(this,{hx,hy,seed,n:0,t:20+hash(seed,3)*40,range:[220,520],fixed:false},o)}
 rnd(){return hash(this.seed,50+this.n++)}
 update(dt){
  if(this.fixed)return;this.t-=dt;if(this.t>0)return;this.t=40+this.rnd()*80;
  const h=cal.hour(),dusk=h<7||h>18;
  if(this.likes&&dusk&&this.rnd()<.6){const [x,y]=this.likes[Math.floor(this.rnd()*this.likes.length)];this.hx=x;this.hy=y;return}
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
  const G=this.group;
  for(let k=0;k<14;k++){const a=this.rand()*6.283,d=20+this.rand()*this.leash*(this.follow?.25:1),bx=this.follow?this.follow.x:G.hx,by=this.follow?this.follow.y:G.hy,x=bx+Math.cos(a)*d,y=by+Math.sin(a)*d;
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
   const th=nearestThreat(this.x,this.y,this.flee);
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
