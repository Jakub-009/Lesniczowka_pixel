// Odnowienie lasu (0.3): powierzchnia odnowieniowa zaznaczana obszarem → przygotowanie gleby pługiem leśnym LPz
// (bruzdy co ok. 1,5 m, uprzątnięcie gałęzi) → sadzenie w rzędach przez ekipę. Bez przygotowania gleby sadzonki gorzej się przyjmują.
import {state,toast,cal,clamp,zl,displayNumber,PX_PER_M,rect,SEASON_DAYS} from './core.js';
import {roadClearance,inRect,YARD,PLAC,pointBlocked,oddzial} from './map.js';
import {nearestRoad,goalNode,ENTRY,exitNode} from './roads.js';
import {E,NAV,rebuildWild} from './ents.js';
import {Vehicle,cartRear} from './life/agents.js';
import {trees,treesIn,STAND,STUMP,SAPLING_AGE,crownR,speciesFor,SP,dirtyTree} from './forest.js';
import {J,addCrewTasks,COST} from './jobs.js';
import {pay,canAfford} from './economy.js';
import {paintFurrowRow,paintFurrow,paintRut} from './paint.js';

export const R={plots:[],plow:{v:null,phase:'idle',queue:[],cur:null},nextId:1};
const ROW=18,STEP=16,PREP_PER_M=3,FENCE_PER_M=7;
export const rowsOf=p=>{const ys=[];for(let y=p.y+9;y<p.y+p.h-5;y+=ROW)ys.push(Math.round(y));return ys};
export const prepCost=p=>Math.round(rowsOf(p).length*(p.w-12)/PX_PER_M*PREP_PER_M);
export const fenceCost=p=>Math.round(2*(p.w+p.h)/PX_PER_M*FENCE_PER_M);
export const areaHa=p=>p.w*p.h/(PX_PER_M*PX_PER_M)/10000;
// Miejsca na sadzonki: w rzędach (w bruzdach), z pominięciem drzew, pniaków, dróg i już zaplanowanych sadzonek.
function spotOk(x,y){
 if(roadClearance(x,y)<8||inRect(x,y,YARD,8)||inRect(x,y,PLAC,8)||pointBlocked(x,y,6))return false;
 for(const t of treesIn(x-40,y-40,x+40,y+40)){const d=Math.hypot(t.x-x,t.y-y);
  if(t.st===STUMP?d<8:t.age<SAPLING_AGE?d<9:d<Math.max(10,crownR(t)*.45))return false}
 return !J.plants.some(q=>Math.hypot(q.x-x,q.y-y)<9);
}
export function spotsIn(x0,y0,w,h){const out=[];for(let y=y0+9;y<y0+h-5;y+=ROW)for(let x=x0+8;x<x0+w-5;x+=STEP)if(spotOk(x,y))out.push([x,y]);return out}
export function plotStats(p){
 let stand=0,stumps=0,slash=0,young=0;
 for(const t of treesIn(p.x,p.y,p.x+p.w,p.y+p.h)){if(t.st===STUMP){stumps++;if(t.slash)slash++}else if(t.age<SAPLING_AGE)young++;else stand++}
 return{stand,stumps,slash,young};
}
export function createPlot(x0,y0,x1,y1){
 const x=Math.round(Math.min(x0,x1)),y=Math.round(Math.min(y0,y1)),w=Math.round(Math.abs(x1-x0)),h=Math.round(Math.abs(y1-y0));
 if(w<48||h<40){toast('Za mała powierzchnia — zaznacz większy obszar.');return null}
 const p={id:R.nextId++,x,y,w,h,state:'new',prepared:false,planted:0,toPlant:0,sp:speciesFor(x+w/2,y+h/2),odd:oddzial(x+w/2,y+h/2)};
 R.plots.push(p);toast('Powierzchnia odnowieniowa P'+p.id+' ('+displayNumber(areaHa(p),2)+' ha). Wybierz pracę na karcie.');
 return p;
}
export function removePlot(p){if(p.state==='prepping'||p.state==='planting'){toast('Na tej powierzchni trwają prace.');return}R.plots=R.plots.filter(q=>q!==p)}
export const plotAt=(x,y)=>R.plots.slice().reverse().find(p=>inRect(x,y,p));
// ── przygotowanie gleby: usługa zewnętrzna (ciągnik z pługiem LPz) ──
export function orderPrep(p){
 if(p.prepared||p.state==='prepping'||R.plow.queue.includes(p)){toast('Ta powierzchnia jest już przygotowana albo w kolejce.');return}
 const st=plotStats(p);if(!canAfford(prepCost(p)))return;
 pay(prepCost(p),'przygotowanie gleby (pług LPz)');p.state='queued';R.plow.queue.push(p);
 toast('Zlecono przygotowanie gleby P'+p.id+(st.stand?' — uwaga: stoi tam '+st.stand+' drzew, pług je ominie':'')+'. Ciągnik przyjedzie '+(cal.work(7,16)?'za chwilę':cal.nextStart(7,17))+'.');
}
function plowPath(p){
 const ys=rowsOf(p),x0=p.x+6,x1=p.x+p.w-6,pts=[];
 ys.forEach((y,k)=>{if(k%2===0)pts.push([x0,y],[x1,y]);else pts.push([x1,y],[x0,y])});
 return pts;
}
function plowWork(v,step){
 const O=v.off,P=R.plow,p=P.cur;if(!p)return;
 const seg=O.i-P.base;v.plowing=seg>=0&&seg%2===0&&seg<2*P.rows-1;
 v.rutAcc=(v.rutAcc||0)+step;if(v.rutAcc>4){v.rutAcc=0;paintRut(v.pos[0],v.pos[1],v.heading,v.spec.hw*.65)}
 if(!v.plowing)return;
 const row=seg/2,y=P.ys[row],[rx]=cartRear(v.cart);
 if(rx>p.x+3&&rx<p.x+p.w-3)paintFurrow(rx-1,y,3);
 // pług zgarnia gałęzie pozostawione po ścince
 for(const t of treesIn(rx-16,y-14,rx+16,y+14))if(t.slash&&Math.hypot(t.slash.x-rx,t.slash.y-y)<18){t.slash=null;dirtyTree(t)}
}
function plowUpdate(){
 const P=R.plow;
 if(P.phase==='idle'&&P.queue.length&&cal.work(7,16)){
  const p=P.cur=P.queue.shift();p.state='prepping';
  const v=P.v=new Vehicle('plower',ENTRY(false));v.label='ciągnik z pługiem LPz jedzie do P'+p.id;
  const rows=plowPath(p),rp=nearestRoad(rows[0][0],rows[0][1],['main','forest'],{margin:50});
  P.phase='driving';
  v.goTo({edge:rp.edge,s:rp.s},{onArrive:()=>{
   // dojazd w teren do pierwszego rzędu, potem orka rząd po rzędzie (zawracanie na uwrociach)
   let ap=NAV.foot.findPath(v.pos[0],v.pos[1],rows[0][0]-24,rows[0][1]);if(!ap||!ap.length)ap=[[rows[0][0]-24,rows[0][1]]];
   P.base=ap.length+1;P.rows=rowsOf(p).length;P.ys=rowsOf(p);P.phase='plowing';v.label='orka bruzd na P'+p.id;
   v.driveOff([...ap,...rows],{work:plowWork,onArrive:()=>{
    v.plowing=false;p.prepared=true;p.state='prepared';
    for(const t of treesIn(p.x,p.y,p.x+p.w,p.y+p.h))if(t.slash){t.slash=null;dirtyTree(t)}   // gałęzie zgarnięte w wały na skraju
    for(const y of P.ys)paintFurrowRow(y,p.x+6,p.x+p.w-6);    // domalowanie ciągłych bruzd
    p.prepDay=state.days;
    toast('Gleba na P'+p.id+' przygotowana: '+P.ys.length+' bruzd. Można sadzić.');
    const back=nearestRoad(v.pos[0],v.pos[1],['main','forest'],{margin:40});
    let bp=NAV.foot.findPath(v.pos[0],v.pos[1],back.x,back.y);if(!bp||!bp.length)bp=[[back.x,back.y]];
    P.phase='leaving';v.label='ciągnik z pługiem wraca';
    v.driveOff(bp,{onArrive:()=>{v.rejoin();v.goTo(goalNode(exitNode(v.pos[0])),{leave:true,onArrive:()=>{}});P.v=null;P.cur=null;P.phase='idle'}});
   }});
   v.off.workSpeed=16;
  }});
 }
}
// ── sadzenie w rzędach ──
export function orderPlant(p){
 if(p.state==='planting'){toast('Sadzenie już trwa.');return}
 const spots=spotsIn(p.x,p.y,p.w,p.h);
 if(!spots.length){toast('Brak wolnych miejsc na sadzonki w tej powierzchni.');return}
 if(!canAfford(Math.min(spots.length,40)*COST.plant))return;
 const tasks=[];
 for(const [x,y] of spots){const q={x,y,sp:p.sp,assigned:true,plot:p.id,prep:p.prepared,onDone:()=>{p.planted++;if(p.planted>=p.toPlant){p.state='planted';toast('P'+p.id+' obsadzona: '+p.planted+' sadzonek ('+SP[p.sp].name.split(' ')[0]+').')}}};J.plants.push(q);tasks.push({type:'plant',p:q})}
 p.state='planting';p.toPlant=p.planted+spots.length;
 addCrewTasks(tasks,'Sadzenie na P'+p.id+': '+spots.length+' sadzonek ('+SP[p.sp].name.split(' ')[0]+(p.prepared?', w bruzdach':', bez przygotowania gleby')+').');
}
// Szybkie sadzenie obszarem (narzędzie 3): rzędy zaplanowanych sadzonek bez przygotowania gleby.
export function planAreaPlants(x0,y0,x1,y1){
 const x=Math.min(x0,x1),y=Math.min(y0,y1),spots=spotsIn(x,y,Math.abs(x1-x0),Math.abs(y1-y0)).slice(0,400);
 for(const [px,py] of spots)J.plants.push({x:px,y:py,sp:speciesFor(px,py),assigned:false});
 return spots.length;
}
// Grodzenie powierzchni siatką (chroni sadzonki przed zgryzaniem przez sarny i jelenie).
export function orderFence(p){
 if(p.fence){toast('Ta powierzchnia jest już grodzona.');return}
 const c=fenceCost(p);if(!canAfford(c))return;
 pay(c,'grodzenie uprawy siatką');p.fence='building';p.fenceP=0;
 toast('Zlecono grodzenie P'+p.id+' ('+Math.round(2*(p.w+p.h)/PX_PER_M)+' m siatki). Montaż w godzinach pracy.');
}
// Repelent (0.6): środek odstraszający na sadzonki — tani, chroni przez bieżącą porę roku (ok. 75% mniej zgryzania).
export const seasonKey=()=>Math.floor(state.days/SEASON_DAYS);
export const repelCost=p=>Math.max(60,Math.round(plotStats(p).young*.5));
export function orderRepel(p){
 if(p.fence==='done'){toast('Powierzchnia jest ogrodzona — repelent niepotrzebny.');return}
 if(p.repel===seasonKey()){toast('Repelent już naniesiony w tej porze roku.');return}
 const c=repelCost(p);if(!canAfford(c))return;
 pay(c,'repelent na sadzonki');p.repel=seasonKey();toast('Naniesiono repelent na sadzonki w P'+p.id+' — chroni do końca tej pory roku.');
}
export function updateRenew(dt){
 plowUpdate();
 if(cal.work(7,16))for(const p of R.plots)if(p.fence==='building'){p.fenceP+=dt*6;if(p.fenceP>=2*(p.w+p.h)){p.fence='done';rebuildWild();toast('Grodzenie P'+p.id+' gotowe — sadzonki są bezpieczne od zgryzania.')}}
}
// Siatka grodzenia (na poziomie gruntu): słupki co ~2,5 m, rysowana do miejsca, gdzie doszli monterzy.
export function drawFences(g){
 for(const p of R.plots){if(!p.fence)continue;
  const L=p.fence==='done'?1e9:p.fenceP,pts=[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h],[p.x,p.y]];let left=L;
  for(let i=0;i<4&&left>0;i++){const [ax,ay]=pts[i],[bx,by]=pts[i+1],d=Math.hypot(bx-ax,by-ay),k=Math.min(1,left/d);left-=d;
   const ex=ax+(bx-ax)*k,ey=ay+(by-ay)*k;
   g.strokeStyle='#c4ccc8';g.lineWidth=1;g.beginPath();g.moveTo(Math.round(ax)+.5,Math.round(ay)+.5);g.lineTo(Math.round(ex)+.5,Math.round(ey)+.5);g.stroke();
   for(let t=0;t<=d*k;t+=30){const x=ax+(bx-ax)/d*t,y=ay+(by-ay)/d*t;rect(g,x-1,y-2,3,4,'#6b563d');rect(g,x,y-2,1,1,'#a08560')}}
 }
}
// Rysowanie obrysów powierzchni (nad koronami, żeby było je widać).
export function drawPlots(g,sel){
 for(const p of R.plots){
  const col=p.state==='new'?'#f1e6c2':p.state==='queued'||p.state==='prepping'?'#e8b06a':p.state==='prepared'?'#c89a62':p.state==='planting'?'#9fd27a':'#7ac27a';
  g.strokeStyle='#1d2b24';g.lineWidth=3;g.setLineDash([6,4]);g.strokeRect(p.x+.5,p.y+.5,p.w,p.h);
  g.strokeStyle=col;g.lineWidth=1;g.strokeRect(p.x+.5,p.y+.5,p.w,p.h);g.setLineDash([]);
  if(sel===p){g.strokeStyle='#ffffff';g.strokeRect(p.x-2.5,p.y-2.5,p.w+6,p.h+6)}
  const lbl='P'+p.id;rect(g,p.x+2,p.y+2,lbl.length*4+4,9,'#1d2b24');g.fillStyle=col;
  let px=p.x+4;for(const ch of lbl){/* cyfry 3×5 */const G={P:'111101111100100',0:'111101101101111',1:'010110010010111',2:'111001111100111',3:'111001111001111',4:'101101111001001',5:'111100111001111',6:'111100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001111'}[ch];
   if(G)for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(G[r*3+c]==='1')g.fillRect(px+c,p.y+4+r,1,1);px+=4}
 }
}
