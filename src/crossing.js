// Zwierzyna na szosie i potrącenia (0.8.3).
// Sarna, jeleń albo dzik czasem przebiega przez szosę — najczęściej o zmierzchu i jesienią. To krótka, zaplanowana scena
// zsynchronizowana z przejeżdżającym autem (bez fizyki zderzeń): zwykle auto tylko hamuje, rzadko dochodzi do potrącenia.
// Skutki: zwierzę leży przy jezdni (zgłoszenie „padlina”: patrol albo koło łowieckie), ucieka ranne (myśliwy z psem szuka go
// w lesie) albo znika, bo zabrał je kierowca (sam list). Bez Policji — nie ma tu sprawcy do ścigania.
import {state,cal,toast,clamp} from './core.js';
import {hy,oddzial,EDGES} from './map.js';
import {ENTRY,exitNode,goalNode,nearestRoad} from './roads.js';
import {E,NAV} from './ents.js';
import {Vehicle,Ped,Wild,Group,rand} from './life/agents.js';
import {FA,NAMES} from './life/fauna.js';
import {mail} from './mail.js';
import {report} from './incidents.js';

const JUNCTIONS=[820,1700,2600,3260];
const ACC={roe:'sarnę',deer:'jelenia',boar:'dzika'};
const NOM={roe:'sarna',deer:'jeleń',boar:'dzik'};
const CAR_COLS=['#8c9b95','#a4684f','#6f86a0','#b9a56a','#7a8f6f','#a8a6a0','#5a5f6a','#9a4a3a'];
const odd=(x,y)=>'oddz. '+oddzial(x,y);
const T={day:-1,at:null};
export let X=null;   // bieżąca scena

// plan dnia: najczęściej o zmierzchu, jesienią najczęściej (okres rykowiska i zmierzchów)
function plan(){
 const se=cal.season(),p=[.45,.4,.75,.25][se];   // wiosna, lato, jesień, zima: szansa na scenę danego dnia
 T.at=state.days>4&&rand()<p?Math.floor(state.days)+(rand()<.75?17.5+rand()*4:4.5+rand()*2.5)/24:null;
}
export function startCrossing(force={}){
 if(X)return false;
 let x0=0;for(let k=0;k<30;k++){x0=380+rand()*2900;if(JUNCTIONS.every(j=>Math.abs(x0-j)>170))break}
 const kind=force.kind||(()=>{const r=rand();return r<.6?'roe':r<.75?'deer':'boar'})();
 const east=rand()<.5,north=rand()<.5;
 const car=new Vehicle('car',{...ENTRY(east),color:CAR_COLS[Math.floor(rand()*CAR_COLS.length)]});car.label='samochód na szosie';
 car.goTo(goalNode(exitNode(east?3600:0)),{leave:true});
 X={car,kind,x0,east,north,hit:force.hit??rand()<.18,force:force.out||null,state:'approach',t:0,a:null,out:null};
 return true;
}
const roadY=x=>hy(x);
function spawnAnimal(){
 const x=X.x0,y=roadY(x)+(X.north?-72:72);
 const a=new Wild({kind:X.kind,x,y,seed:Math.floor(rand()*1e5),group:new Group(x,y,3,{fixed:true}),male:rand()<.4});
 a.x=x;a.y=y;a.state='run';a.v=0;a.flee=0;a.scripted=true;
 const dir=X.north?1:-1,sp=a.run*.65;
 a.update=function(dt){
  this.phase+=dt*1.4;this.heading=dir>0?Math.PI/2:-Math.PI/2;
  if(X&&X.state==='hit'&&X.out==='lies'){return}                       // zwierzę leży — zdejmie je scena
  this.v+=clamp(sp-this.v,-80*dt,80*dt);this.y+=dir*this.v*dt;
  if(Math.abs(this.y-roadY(this.x))>96){this.dead=true}
 };
 X.a=a;X.state='cross';
}
function release(){if(X.car&&!X.car.dead){X.car.stopped=false;X.car.speedMul=1;X.car.label='samochód na szosie'}}
function doHit(){
 const a=X.a,kind=X.kind,x=a.x,y=a.y,c=X.car;
 c.stopped=true;c.v=0;c.label='kierowca zatrzymał się po potrąceniu';X.state='hit';X.t=0;
 FA.pop[kind]=Math.max(0,FA.pop[kind]-1);
 const r=rand();X.out=X.force||(r<.45?'lies':r<.8?'wounded':'taken');
 const ox=x,oy=roadY(x)+(X.north?38:-38);
 if(X.out==='lies'){
  a.dead=true;const car={x:ox,y:oy,a:X.north?.3:-2.9,kind,road:true,day:state.days};FA.carcasses.push(car);
  car.inc=report('carcass',ox,oy,'Padlina przy szosie ('+NOM[kind]+'), '+odd(ox,oy)+'.',car,true);
  mail('road','Samochód potrącił '+ACC[kind]+' na szosie w '+odd(ox,oy)+'. Zwierzę leży przy jezdni — wyślij patrol albo zabierze je koło łowieckie.',{x:ox,y:oy});
 }else if(X.out==='wounded'){
  mail('road','Samochód potrącił '+ACC[kind]+' w '+odd(ox,oy)+'. Zwierzę uciekło ranne w las — koło łowieckie wysyła myśliwego z psem do tropienia.',{x:ox,y:oy});
  huntWounded(ox,oy+(X.north?60:-60),kind);
 }else{
  a.dead=true;
  mail('road','Kierowca potrącił '+ACC[kind]+' w '+odd(ox,oy)+', zabrał zwierzę i odjechał. Nikt niczego nie zgłosił.',{x:ox,y:oy,quiet:true});
 }
}
// myśliwy z psem tropi postrzałka: dojeżdża, idzie w las, szuka, wraca
function huntWounded(x,y,kind){
 const rp=nearestRoad(x,y,['main','forest']),car=new Vehicle('car',{...ENTRY(rand()<.5),color:'#4a5a3a'});car.label='myśliwy (koło łowieckie)';
 car.goTo({edge:rp.edge,s:rp.s},{park:true,onArrive:v=>{
  const cx=v.pos[0]+Math.cos(v.heading)*18,cy=v.pos[1]+Math.sin(v.heading)*18;
  const h=new Ped({kind:'hunter',x:cx,y:cy,prop:'rifle',speed:13});h.label='myśliwy tropi ranne zwierzę';
  const dog=new Wild({kind:'dog',x:cx,y:cy+6,seed:Math.floor(rand()*1e5),nav:'foot',group:new Group(cx,cy,2,{fixed:true}),follow:h,leash:40,idleMin:.4,idleVar:1.5,col:'#8a5a32',col2:'#e8e0d0',flee:0});
  const dn=Math.sign(y-roadY(x))||1,spots=[0,1,2].map(i=>{const px=x+(i-1)*34,py=y+dn*(50+i*40);const w=NAV.foot.nearestWalkable(px,py,60);return w||[px,py]});
  const ok=rand()<.7;
  h.run([{go:[x,y]},...spots.flatMap(s=>[{go:s},{wait:5,pose:'kneel',face:s}]),
   {call:q=>{
     if(ok){mail('road','Myśliwy z psem odnalazł ranne zwierzę w lesie i zakończył jego cierpienie. Padlina zabrana przez koło łowieckie.',{x:q.x,y:q.y,quiet:true})}
     else mail('road','Tropienie rannego zwierzęcia nie dało rezultatu. Koło łowieckie wróci do sprawy rano.',{x:q.x,y:q.y,quiet:true})}},
   {wait:3,pose:'stand'},{go:[cx,cy]},{call:q=>{q.dead=true;dog.dead=true;v.label='myśliwy odjeżdża';v.goTo(goalNode(exitNode(v.pos[0]+(rand()-.5)*1200)),{leave:true})}}]);
 }});
}
export function updateCrossing(dt){
 const d=Math.floor(state.days);
 if(d!==T.day){T.day=d;plan()}
 if(T.at&&state.days>=T.at&&!X){T.at=null;startCrossing()}
 // koło łowieckie zabiera padlinę po dobie
 for(const c of FA.carcasses){
  if(!c.road||c.dead)continue;
  if(state.days-c.day>1){c.dead=true;if(c.inc&&(c.inc.status==='new'||c.inc.status==='queued')){c.inc.status='done'}
   mail('road','Koło łowieckie zabrało padlinę z pobocza szosy w '+odd(c.x,c.y)+'.',{x:c.x,y:c.y,quiet:true})}
 }
 if(!X)return;
 const c=X.car;
 if(c.dead||c.leave&&Math.abs(c.pos[0]-X.x0)>400&&X.state!=='approach'){if(X.a&&!X.a.dead&&X.state!=='cross')X.a.dead=true;X=null;return}
 const ahead=(X.x0-c.pos[0])*(X.east?1:-1);   // >0: auto jeszcze nie minęło miejsca przejścia
 if(X.state==='approach'){
  if(ahead<clamp(Math.abs(c.v)*1.5,90,230))spawnAnimal();
  else if(ahead<-300||c.dead){X=null}
  return;
 }
 X.t+=dt;
 if(X.state==='cross'){
  const a=X.a;
  if(!a||a.dead){release();X=null;return}
  const near=Math.abs(a.y-roadY(a.x))<46;
  if(X.hit&&near&&ahead<42&&ahead>-20)return doHit();
  // bez potrącenia: auto zwalnia, gdy zwierzę jest na jezdni lub tuż przy niej
  if(ahead>-10&&ahead<190&&Math.abs(a.y-roadY(a.x))<70){c.speedMul=.3;c.label='kierowca hamuje przed zwierzyną'}
  else if(ahead<=-10){release()}
  if(ahead<-120&&(a.dead))X=null;
  return;
 }
 if(X.state==='hit'){
  if(X.t>4.2){release();c.label='samochód odjeżdża';
   X=null}
 }
}
