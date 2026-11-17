// Ruch i edukacja (0.9): znaki zakazu wjazdu przy wjazdach w las, odstraszacze zwierzyny przy szosie (znaki A-18b + słupki odblaskowe),
// ścieżka przyrodnicza w zarezerwowanym miejscu (2840,1280) i szkolne wycieczki. Wszystko opcjonalne — kupowane w Leśniczówce.
import {state,cal,toast,zl,rect,SEASON_DAYS} from './core.js';
import {hy,RESERVED} from './map.js';
import {trees,removeTree,treesIn,STAND} from './forest.js';
import {ECO,pay,earn,canAfford,bumpProtect} from './economy.js';
import {mail} from './mail.js';
import {Ped,rand} from './life/agents.js';
import {NAT} from './nest.js';
import {sfx} from './sound.js';

export const VC={signs:900,repel:1600,trail:2200,tourFee:180,repelDay:10};
export const vs=()=>ECO.ord.vs||(ECO.ord.vs={tours:0,kids:0});   // statystyka wycieczek (zapisuje się razem z eco.ord)
export const signsOn=()=>!!ECO.ord.signs,repelOn=()=>!!ECO.ord.repel,trailOn=()=>!!ECO.ord.trail;
// ścieżka: pętla w obrębie zarezerwowanego prostokąta, wejście od południowego zachodu
const R0=RESERVED.find(r=>r.id==='sciezka');
export const TRAIL=[[2852,1368],[2858,1344],[2874,1322],[2898,1306],[2924,1300],[2946,1312],[2950,1336],[2934,1356],[2910,1362],[2886,1352],[2870,1336],[2858,1344]];
export const BOARDS=[[2874,1322],[2924,1300],[2950,1336],[2910,1362]];
const BOARD_TXT=['Runo leśne','Martwe drewno','Ptaki lasu','Wiek drzew'];
export function buySigns(){
 if(signsOn()){toast('Znaki zakazu wjazdu już stoją.');return false}
 if(!canAfford(VC.signs))return false;pay(VC.signs,'znaki zakazu wjazdu (B-1, B-9) przy wjazdach w las');ECO.ord.signs=true;
 toast('Znaki zakazu wjazdu postawione.');return true}
export function buyRepel(){
 if(repelOn()){toast('Odstraszacze już działają.');return false}
 if(!canAfford(VC.repel))return false;pay(VC.repel,'odstraszacze zwierzyny i znaki A-18b przy szosie');ECO.ord.repel=true;
 toast('Odstraszacze przy szosie ustawione ('+zl(VC.repelDay)+' dziennie).');return true}
export function buyTrail(){
 if(trailOn()){toast('Ścieżka przyrodnicza już jest.');return false}
 if(!canAfford(VC.trail))return false;pay(VC.trail,'ścieżka przyrodnicza (tablice, kładki, wyłożenie ścieżki)');ECO.ord.trail=true;
 // trasa i miejsca przy tablicach są wycięte z podrostu i drzew
 const pts=[];for(let i=0;i<TRAIL.length-1;i++){const [a,b]=[TRAIL[i],TRAIL[i+1]],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let s=0;s<=L;s+=6)pts.push([a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L])}
 for(const [x,y] of [...pts,...BOARDS.map(b=>[b[0],b[1]])])for(const t of treesIn(x-13,y-13,x+13,y+13).slice())if(t.st===STAND&&Math.hypot(t.x-x,t.y-y)<(BOARDS.some(b=>b[0]===x&&b[1]===y)?20:12)&&!t.nest&&!t.mon)removeTree(t);
 for(const t of treesIn(2832,1372,2872,1412).slice())removeTree(t);
 toast('Ścieżka przyrodnicza gotowa. W dni robocze przychodzą wycieczki.');
 mail('nature','Ścieżka przyrodnicza otwarta (południowy wschód). Wycieczki przyjeżdżają w dni robocze, od wiosny do jesieni.',{x:2900,y:1330});return true}
export const visitDaily=()=>(repelOn()?VC.repelDay:0);

// ───────── wycieczki ─────────
const T={day:-1,at:null};
const COATS=['#d8483a','#3a7ad8','#e0b83a','#4aa86a','#d87aa8','#8a5ad8','#e8803a'];
function spawnTour(){
 const x0=2880+rand()*30,y0=1660,n=8+((rand()*4)|0);
 const guide=new Ped({kind:'lesniczy',x:x0,y:y0,speed:11.5});guide.label='leśniczy z wycieczką';
 const steps=(off,guideRole)=>{const s=[{go:[TRAIL[0][0]+off[0],TRAIL[0][1]+off[1]+8]}];
  BOARDS.forEach((b,i)=>{s.push({go:[b[0]+off[0]*.5,b[1]+off[1]*.5+(guideRole?10:6)]},{wait:guideRole?11:9+rand()*2,pose:'stand',face:[b[0],b[1]]})});
  s.push({go:[TRAIL[0][0],TRAIL[0][1]+10]},{go:[x0+off[0],y0+off[1]]});return s};
 guide.run([...steps([0,0],true),{call:q=>{q.dead=true;vs().tours++;vs().kids+=n;
   earn(VC.tourFee,'wycieczka szkolna po ścieżce przyrodniczej');bumpProtect(1.2,'wycieczka szkolna');
   mail('nature','Wycieczka szkolna zakończona: '+n+' uczniów. Szkoła wpłaciła '+zl(VC.tourFee)+'.',{x:2900,y:1330,quiet:true});
   NAT.log.unshift({day:state.days,text:'Szkolna wycieczka na ścieżce przyrodniczej ('+n+' uczniów).',x:2900,y:1330});if(NAT.log.length>40)NAT.log.length=40}}]);
 for(let i=0;i<n;i++){
  const off=[(rand()-.5)*26,(rand()-.5)*20+14],p=new Ped({kind:'walker',x:x0+off[0],y:y0+8+rand()*10,speed:10.5+rand()*1.6,coat:COATS[i%COATS.length],cap:COATS[(i+3)%COATS.length]});
  p.label='uczeń na wycieczce';p.run([...steps(off,false),{call:q=>{q.dead=true}}])}
 mail('nature','Wycieczka szkolna na ścieżce ('+n+' uczniów).',{x:x0,y:y0-20,quiet:true});
}
export function updateVisit(dt){
 if(!trailOn())return;
 const d=Math.floor(state.days),se=cal.season();
 if(d!==T.day){T.day=d;T.at=se!==3&&!cal.weekend()&&state.days>6&&rand()<.4?d+(9.5+rand()*2.5)/24:null}
 if(T.at&&state.days>=T.at){T.at=null;if(!cal.night()&&cal.hour()<14&&!ECO.ord.banVisit)spawnTour()}
}
export const _tour=spawnTour;

// ───────── rysowanie ─────────
const inView=(x,y,c,V,m=30)=>x>c.x-m&&x<c.x+V.w+m&&y>c.y-m&&y<c.y+V.h+m;
export function drawVisitGround(g,camera,VIEW){
 if(!trailOn()||!inView(2900,1330,camera,VIEW,160))return;
 g.save();g.lineCap='round';g.lineJoin='round';
 for(const [w,c] of [[9,'#6b5a3a'],[7,'#b49a68'],[3,'#c8b484']]){g.strokeStyle=c;g.lineWidth=w;g.beginPath();TRAIL.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke()}
 g.restore();
 for(let k=0;k<TRAIL.length*5;k++){const a=TRAIL[k%TRAIL.length],b=TRAIL[(k+1)%TRAIL.length],u=((k*37)%10)/10;rect(g,a[0]+(b[0]-a[0])*u+((k*13)%7-3),a[1]+(b[1]-a[1])*u+((k*29)%7-3),2,1,'#8a7448')}
}
export function drawVisit(g,camera,VIEW){
 const post=(x,y)=>{rect(g,x-1,y-2,2,12,'#4a4a48');rect(g,x-1,y-2,1,12,'#6a6a68')};
 if(trailOn()&&inView(2900,1330,camera,VIEW,140)){
  // tablice na stanowiskach
  BOARDS.forEach(([x,y],i)=>{rect(g,x-8,y-17,2,12,'#3a2a1a');rect(g,x+6,y-17,2,12,'#3a2a1a');rect(g,x-9,y-19,18,10,'#3a2a1a');rect(g,x-8,y-18,16,8,'#7a5c36');rect(g,x-6,y-16,12,4,'#e8e0c0');rect(g,x-5,y-15,3,2,'#4a7a3a');rect(g,x,y-15,4,1,'#6a6a58');
   g.fillStyle='#e8e0c0';g.font='5px monospace';g.fillText(String(i+1),x+5,y-11)});
  // brama na wejściu
  const [gx,gy]=TRAIL[0];rect(g,gx-9,gy+4,2,12,'#3a2a1a');rect(g,gx+8,gy+4,2,12,'#3a2a1a');rect(g,gx-10,gy+2,21,3,'#4a3a22');rect(g,gx-6,gy+2,13,2,'#c8b484')}
 // znaki przy szosie
 const x0=Math.floor(camera.x/70)*70,x1=camera.x+VIEW.w+70;
 if(repelOn()){
  for(let x=x0;x<x1;x+=70){if(x<380||x>3280)continue;const y=hy(x)-30;if(y<camera.y-20||y>camera.y+VIEW.h+20)continue;rect(g,x-1,y,2,7,'#d8d8d0');rect(g,x-1,y,2,2,'#3a7ad8');rect(g,x-1,y+2,2,1,'#e8e8e0')}
  for(const x of [1180,2150,2960,3330]){const y=hy(x)-34;if(!inView(x,y,camera,VIEW,30))continue;post(x,y+6);
   g.fillStyle='#d8403a';g.beginPath();g.moveTo(x,y-14);g.lineTo(x+9,y+2);g.lineTo(x-9,y+2);g.closePath();g.fill();
   g.fillStyle='#f2efe4';g.beginPath();g.moveTo(x,y-10);g.lineTo(x+6,y);g.lineTo(x-6,y);g.closePath();g.fill();rect(g,x-3,y-4,5,2,'#2a2a26');rect(g,x-4,y-2,2,2,'#2a2a26');rect(g,x+1,y-6,2,2,'#2a2a26')}}
 if(signsOn()){
  for(const x of [850,1730]){const y=hy(x)-42;if(!inView(x,y,camera,VIEW,30))continue;post(x,y+6);
   g.fillStyle='#d8403a';g.beginPath();g.arc(x,y-4,8,0,6.283);g.fill();g.fillStyle='#f2efe4';g.beginPath();g.arc(x,y-4,5.6,0,6.283);g.fill();
   g.fillStyle='#2a2a26';g.fillRect(x-3,y-6,6,4);g.fillRect(x-4,y-3,2,2);g.fillRect(x+2,y-3,2,2);g.fillStyle='#d8403a';g.fillRect(x-6,y-5,12,2)}}
 if(trailOn()){const x=2905,y=hy(x)-40;if(inView(x,y,camera,VIEW,30)){post(x,y+6);rect(g,x-9,y-12,18,11,'#3a2a1a');rect(g,x-8,y-11,16,9,'#7a5c36');rect(g,x-6,y-9,12,2,'#e8e0c0');rect(g,x-6,y-5,8,1,'#e8e0c0');rect(g,x+3,y-6,4,3,'#4a7a3a')}}
}
