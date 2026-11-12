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
// ── kształt powierzchni (0.7.2): prostokąt albo wielokąt (p.poly); rzeczywisty obszar = kształt minus drogi, podwórze i plac ──
export const outline=p=>p.poly||[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h]];
const pip=(P,x,y)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
const edgeD=(P,x,y)=>{let m=1e9;for(let i=0,j=P.length-1;i<P.length;j=i++){const [ax,ay]=P[j],[bx,by]=P[i],dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1,t=clamp(((x-ax)*dx+(y-ay)*dy)/l,0,1);m=Math.min(m,Math.hypot(x-ax-dx*t,y-ay-dy*t))}return m};
export function inShape(p,x,y,pad=0){
 if(!p.poly)return inRect(x,y,p,pad);
 const m=Math.max(pad,0);if(x<p.x-m||y<p.y-m||x>p.x+p.w+m||y>p.y+p.h+m)return false;
 const i=pip(p.poly,x,y);if(!pad)return i;const d=edgeD(p.poly,x,y);return pad>0?(i||d<=pad):(i&&d>=-pad);
}
const maskOk=(x,y)=>roadClearance(x,y)>=14&&!inRect(x,y,YARD,6)&&!inRect(x,y,PLAC,6);
export const inPlot=(p,x,y,pad=0)=>inShape(p,x,y,pad)&&maskOk(x,y);
export const perimOf=p=>{const P=outline(p);let s=0;for(let i=0,j=P.length-1;i<P.length;j=i++)s+=Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);return s};
export const areaHa=p=>{if(p.ha==null){let n=0;for(let y=p.y+6;y<p.y+p.h;y+=12)for(let x=p.x+6;x<p.x+p.w;x+=12)if(inPlot(p,x,y))n++;p.ha=n*144/(PX_PER_M*PX_PER_M)/10000}return p.ha};
// Przejazdy pługa: w każdym rzędzie odcinki w obrębie obszaru, z uwrociem ok. 2,5 m od dróg i brzegu
const PS=new WeakMap();
export function passesOf(p){
 if(PS.has(p))return PS.get(p);const out=[];
 for(let y=p.y+9;y<p.y+p.h-5;y+=ROW){let a=null;const xe=p.x+p.w-6;
  for(let x=p.x+6;x<=xe+6;x+=6){const ok=x<=xe&&inPlot(p,x,y,-8)&&roadClearance(x,y)>=30;
   if(ok&&a===null)a=x;
   if(!ok&&a!==null){if(x-6-a>=36)out.push({y:Math.round(y),x0:a,x1:x-6});a=null}}}
 PS.set(p,out);return out;
}
export const rowsOf=p=>passesOf(p).map(q=>q.y);
export const prepCost=p=>Math.round(passesOf(p).reduce((a,q)=>a+q.x1-q.x0,0)/PX_PER_M*PREP_PER_M);
export const fenceCost=p=>Math.round(perimOf(p)/PX_PER_M*FENCE_PER_M);
// Miejsca na sadzonki: w rzędach (w bruzdach), z pominięciem drzew, pniaków, dróg i już zaplanowanych sadzonek.
function spotOk(x,y){
 if(roadClearance(x,y)<40||inRect(x,y,YARD,8)||inRect(x,y,PLAC,8)||pointBlocked(x,y,6))return false;
 for(const t of treesIn(x-40,y-40,x+40,y+40)){const d=Math.hypot(t.x-x,t.y-y);
  if(t.st===STUMP?d<8:t.age<SAPLING_AGE?d<9:d<Math.max(10,crownR(t)*.45))return false}
 return !J.plants.some(q=>Math.hypot(q.x-x,q.y-y)<9);
}
export function spotsIn(x0,y0,w,h,ok){const out=[];for(let y=y0+9;y<y0+h-5;y+=ROW)for(let x=x0+8;x<x0+w-5;x+=STEP)if(spotOk(x,y)&&(!ok||ok(x,y)))out.push([x,y]);return out}
// ── skład gatunkowy nasadzenia (0.6.2): rzędy z domieszką albo gniazda dębu ──
export const MIXES={
 so:{name:'sosna'},sobrz:{name:'sosna z domieszką brzozy (co 5. rząd)'},sodb:{name:'sosna z dębem w gniazdach'},
 sw:{name:'świerk'},swbk:{name:'świerk z bukiem (co 3. rząd)'},bkdb:{name:'buk z dębem (grąd)'},db:{name:'dąb'},brz:{name:'brzoza'}};
export const MIX_ORDER=Object.keys(MIXES);
const MIX_OF={sosna:'sobrz',swierk:'swbk',dab:'bkdb',buk:'bkdb',brzoza:'brz'};
export const mixFor=sp=>MIX_OF[sp]||'so';
export function mixSp(p,x,y){
 const r=Math.round((y-(p.y+9))/ROW),m=p.mix||mixFor(p.sp);
 if(m==='so')return'sosna';if(m==='sw')return'swierk';if(m==='db')return'dab';if(m==='brz')return'brzoza';
 if(m==='sobrz')return r%5===4?'brzoza':'sosna';
 if(m==='swbk')return r%3===2?'buk':'swierk';
 if(m==='bkdb')return r%3===0?'dab':'buk';
 // gniazda dębu: koła ok. 3 m promienia co ok. 12 m
 const gx=p.x+70+Math.round((x-p.x-70)/140)*140,gy=p.y+60+Math.round((y-p.y-60)/120)*120;
 return Math.hypot(x-gx,y-gy)<34?'dab':'sosna';
}
export function cycleMix(p){const i=MIX_ORDER.indexOf(p.mix||mixFor(p.sp));p.mix=MIX_ORDER[(i+1)%MIX_ORDER.length];toast('Skład P'+p.id+': '+MIXES[p.mix].name+'.')}
export function plotStats(p){
 let stand=0,stumps=0,slash=0,young=0;
 for(const t of treesIn(p.x,p.y,p.x+p.w,p.y+p.h)){if(!inPlot(p,t.x,t.y))continue;if(t.st===STUMP){stumps++;if(t.slash)slash++}else if(t.age<SAPLING_AGE)young++;else stand++}
 return{stand,stumps,slash,young};
}
export function createPlot(x0,y0,x1,y1){
 const x=Math.round(Math.min(x0,x1)),y=Math.round(Math.min(y0,y1)),w=Math.round(Math.abs(x1-x0)),h=Math.round(Math.abs(y1-y0));
 if(w<48||h<40){toast('Za mała powierzchnia — zaznacz większy obszar.');return null}
 return addPlot({x,y,w,h});
}
function addPlot(g){
 const sp0=speciesFor(g.x+g.w/2,g.y+g.h/2),p={id:R.nextId++,...g,state:'new',prepared:false,planted:0,toPlant:0,sp:sp0,mix:mixFor(sp0),odd:oddzial(g.x+g.w/2,g.y+g.h/2)};
 if(areaHa(p)<.012){R.nextId--;toast('Za mała powierzchnia (drogi i pasy ochronne są wyłączone) — zaznacz większy obszar.');return null}
 R.plots.push(p);toast('Powierzchnia odnowieniowa P'+p.id+' ('+displayNumber(areaHa(p),2)+' ha, bez dróg). Wybierz pracę na karcie.');
 return p;
}
// Wielokąt: min. 3 punkty; obszar liczony po odjęciu dróg, podwórza i placu
export function createPolyPlot(pts){
 if(pts.length<3){toast('Wielokąt potrzebuje co najmniej 3 narożników.');return null}
 const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]),x=Math.round(Math.min(...xs)),y=Math.round(Math.min(...ys));
 return addPlot({x,y,w:Math.round(Math.max(...xs))-x,h:Math.round(Math.max(...ys))-y,poly:pts.map(q=>[Math.round(q[0]),Math.round(q[1])])});
}
export function removePlot(p){if(p.state==='prepping'||p.state==='planting'){toast('Na tej powierzchni trwają prace.');return}R.plots=R.plots.filter(q=>q!==p)}
export const plotAt=(x,y)=>R.plots.slice().reverse().find(p=>inShape(p,x,y));
// ── przygotowanie gleby: usługa zewnętrzna (ciągnik z pługiem LPz) ──
export function orderPrep(p){
 if(p.prepared||p.state==='prepping'||R.plow.queue.includes(p)){toast('Ta powierzchnia jest już przygotowana albo w kolejce.');return}
 if(!passesOf(p).length){toast('Brak miejsca na bruzdy — obszar jest za wąski albo leży na drogach.');return}
 const st=plotStats(p);if(!canAfford(prepCost(p)))return;
 pay(prepCost(p),'przygotowanie gleby (pług LPz)');p.state='queued';R.plow.queue.push(p);
 toast('Zlecono przygotowanie gleby P'+p.id+(st.stand?' — uwaga: stoi tam '+st.stand+' drzew, pług je ominie':'')+'. Ciągnik przyjedzie '+(cal.work(7,16)?'za chwilę':cal.nextStart(7,17))+'.');
}
function plowPath(p){
 const pts=[];passesOf(p).forEach((q,k)=>{if(k%2===0)pts.push([q.x0,q.y],[q.x1,q.y]);else pts.push([q.x1,q.y],[q.x0,q.y])});
 return pts;
}
function plowWork(v,step){
 const O=v.off,P=R.plow,p=P.cur;if(!p)return;
 const seg=O.i-P.base;v.plowing=seg>=0&&seg%2===0&&seg<2*P.rows-1;
 v.rutAcc=(v.rutAcc||0)+step;if(v.rutAcc>4){v.rutAcc=0;paintRut(v.pos[0],v.pos[1],v.heading,v.spec.hw*.65)}
 if(!v.plowing)return;
 const q=P.passes[seg/2],y=q.y,[rx]=cartRear(v.cart);
 if(rx>q.x0-3&&rx<q.x1+3)paintFurrow(rx-1,y,3);
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
   P.base=ap.length+1;P.passes=passesOf(p);P.rows=P.passes.length;P.ys=P.passes.map(q=>q.y);P.phase='plowing';v.label='orka bruzd na P'+p.id;
   v.driveOff([...ap,...rows],{work:plowWork,onArrive:()=>{
    v.plowing=false;p.prepared=true;p.state='prepared';
    for(const t of treesIn(p.x,p.y,p.x+p.w,p.y+p.h))if(t.slash){t.slash=null;dirtyTree(t)}   // gałęzie zgarnięte w wały na skraju
    for(const q of P.passes)paintFurrowRow(q.y,q.x0,q.x1);    // domalowanie ciągłych bruzd
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
 const spots=spotsIn(p.x,p.y,p.w,p.h,(x,y)=>inPlot(p,x,y,-6));
 if(!spots.length){toast('Brak wolnych miejsc na sadzonki w tej powierzchni.');return}
 if(!canAfford(Math.min(spots.length,40)*COST.plant))return;
 const tasks=[];
 for(const [x,y] of spots){const q={x,y,sp:mixSp(p,x,y),assigned:true,plot:p.id,prep:p.prepared,onDone:()=>{p.planted++;if(p.planted>=p.toPlant){p.state='planted';toast('P'+p.id+' obsadzona: '+p.planted+' sadzonek ('+MIXES[p.mix||mixFor(p.sp)].name+').')}}};J.plants.push(q);tasks.push({type:'plant',p:q})}
 p.state='planting';p.toPlant=p.planted+spots.length;
 addCrewTasks(tasks,'Sadzenie na P'+p.id+': '+spots.length+' sadzonek ('+MIXES[p.mix||mixFor(p.sp)].name+(p.prepared?', w bruzdach':', bez przygotowania gleby')+').');
}
// Szybkie sadzenie obszarem (narzędzie 3): rzędy zaplanowanych sadzonek bez przygotowania gleby.
export function planAreaPlants(x0,y0,x1,y1){
 const x=Math.min(x0,x1),y=Math.min(y0,y1),spots=spotsIn(x,y,Math.abs(x1-x0),Math.abs(y1-y0)).slice(0,400);
 for(const [px,py] of spots)J.plants.push({x:px,y:py,sp:speciesFor(px,py),assigned:false});
 return spots.length;
}
// Grodzenie powierzchni siatką (chroni sadzonki przed zgryzaniem przez sarny i jelenie).
export function orderFence(p){
 if(p.fence&&p.fence!=='gone'){toast('Ta powierzchnia jest już grodzona.');return}
 const c=fenceCost(p);if(!canAfford(c))return;
 pay(c,'grodzenie uprawy siatką');p.fence='building';p.fenceP=0;p.dismOffered=0;
 toast('Zlecono grodzenie P'+p.id+' ('+Math.round(perimOf(p)/PX_PER_M)+' m siatki, bramy na drogach). Montaż w godzinach pracy.');
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
 if(cal.work(7,16))for(const p of R.plots)if(p.fence==='building'){p.fenceP+=dt*6;if(p.fenceP>=perimOf(p)){p.fence='done';p.fenceDay=state.days;rebuildWild();toast('Grodzenie P'+p.id+' gotowe — sadzonki są bezpieczne od zgryzania.')}}
 // 0.7.4: gdy sadzonki wyrosną (ok. 10 lat), pojawia się zgłoszenie demontażu siatki; zaniedbana siatka po ok. 15 latach niszczeje sama
 if(state.days>=(R.fenceCheck||0)){R.fenceCheck=state.days+1;
  for(const p of R.plots){if(p.fence!=='done')continue;
   if(!p.dismOffered){
    const tt=treesIn(p.x,p.y,p.x+p.w,p.y+p.h).filter(t=>t.planted&&t.st===STAND&&inShape(p,t.x,t.y));
    if(tt.length>=5&&tt.filter(t=>t.age>=SAPLING_AGE+2).length>=tt.length*.6&&HOOK.report){p.dismOffered=state.days;HOOK.report('fence',p.x+p.w/2,p.y+p.h/2,'Sadzonki na P'+p.id+' wyrosły — można zdemontować siatkę (zbędna i pogarsza przejścia zwierzyny).',p)}}
   else if(state.days-p.dismOffered>15){p.fence='gone';for(const q of E.incidents)if(q.type==='fence'&&q.ref===p&&q.status==='new')q.status='gone';rebuildWild();toast('Siatka na P'+p.id+' zniszczała ze starości i została rozebrana przez nieznanych sprawców.')}}}
}
export const HOOK={report:null};
export function dismantleFence(p){if(p.fence!=='done')return;p.fence='gone';rebuildWild();toast('Siatka na P'+p.id+' zdemontowana — zwierzyna ma znów wolny przejazd.')}
// Siatka grodzenia (na poziomie gruntu): słupki co ~2,5 m, rysowana do miejsca, gdzie doszli monterzy.
export function drawFences(g){
 for(const p of R.plots){if(!p.fence||p.fence==='gone')continue;
  let left=p.fence==='done'?1e9:p.fenceP;const P=outline(p);
  for(let i=0;i<P.length&&left>0;i++){const [ax,ay]=P[i],[bx,by]=P[(i+1)%P.length],d=Math.hypot(bx-ax,by-ay)||1,L=Math.min(d,left);left-=d;
   let px=ax,py=ay,pg=roadClearance(ax,ay)<10;
   for(let t=0;t<=L+0.01;t+=10){const x=ax+(bx-ax)/d*t,y=ay+(by-ay)/d*t,gate=roadClearance(x,y)<10;
    if(t>0&&!gate&&!pg){g.strokeStyle='#c4ccc8';g.lineWidth=1;g.beginPath();g.moveTo(Math.round(px)+.5,Math.round(py)+.5);g.lineTo(Math.round(x)+.5,Math.round(y)+.5);g.stroke()}
    if((t%30===0&&!gate)||(gate!==pg))rect(g,x-1,y-2,3,4,gate!==pg?'#8a6a3a':'#6b563d');
    px=x;py=y;pg=gate}}
 }
}
// Rysowanie obrysów powierzchni (nad koronami, żeby było je widać).
const SH=new WeakMap();
function shade(p){   // zacieniony obszar faktycznie objęty powierzchnią (bez dróg), rysowany raz
 let c=SH.get(p);if(c)return c;c=document.createElement('canvas');c.width=p.w+2;c.height=p.h+2;const x=c.getContext('2d');x.fillStyle='rgba(255,244,200,.16)';
 for(let y=0;y<p.h;y+=6)for(let X=0;X<p.w;X+=6)if(inPlot(p,p.x+X+3,p.y+y+3))x.fillRect(X,y,6,6);
 SH.set(p,c);return c;
}
const path=(g,P)=>{g.beginPath();P.forEach(([x,y],i)=>i?g.lineTo(x+.5,y+.5):g.moveTo(x+.5,y+.5));g.closePath()};
export function drawPlots(g,sel){
 if(state.poly&&state.poly.length){const P=state.poly;g.strokeStyle='#1d2b24';g.lineWidth=3;g.beginPath();P.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
  g.strokeStyle='#ffe9a0';g.lineWidth=1;g.stroke();for(const [x,y] of P)rect(g,x-2,y-2,5,5,'#ffe9a0');rect(g,P[0][0]-3,P[0][1]-3,7,7,'#fff')}
 for(const p of R.plots){
  const col=p.state==='new'?'#f1e6c2':p.state==='queued'||p.state==='prepping'?'#e8b06a':p.state==='prepared'?'#c89a62':p.state==='planting'?'#9fd27a':'#7ac27a';
  g.drawImage(shade(p),p.x,p.y);
  g.strokeStyle='#1d2b24';g.lineWidth=3;g.setLineDash([6,4]);path(g,outline(p));g.stroke();
  g.strokeStyle=col;g.lineWidth=1;path(g,outline(p));g.stroke();g.setLineDash([]);
  if(sel===p){g.strokeStyle='#ffffff';g.lineWidth=1;path(g,outline(p));g.stroke();g.strokeRect(p.x-2.5,p.y-2.5,p.w+6,p.h+6)}
  const lbl='P'+p.id;rect(g,p.x+2,p.y+2,lbl.length*4+4,9,'#1d2b24');g.fillStyle=col;
  let px=p.x+4;for(const ch of lbl){/* cyfry 3×5 */const G={P:'111101111100100',0:'111101101101111',1:'010110010010111',2:'111001111100111',3:'111001111001111',4:'101101111001001',5:'111100111001111',6:'111100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001111'}[ch];
   if(G)for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(G[r*3+c]==='1')g.fillRect(px+c,p.y+4+r,1,1);px+=4}
 }
}
