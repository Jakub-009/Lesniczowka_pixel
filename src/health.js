// Zdrowie lasu (0.7): pogoda i susza, zagrożenie pożarowe, kornik drukarz (pułapki feromonowe, cięcia sanitarne),
// wichury (wiatrołomy, zatarasowane drogi), wieża przeciwpożarowa i zakaz wstępu do lasu.
// Stan zdrowia drzewa jest ukryty: kb 1 = zasiedlone (nie widać), 2 = zamiera (rude korony), 3 = martwe, 4 = wiatrołom.
import {state,cal,toast,zl,clamp,hash,camera,VIEW,pf} from './core.js';
import {trees,treesIn,STAND,STUMP,dirtyTree,crownR} from './forest.js';
import {E} from './ents.js';
import {report} from './incidents.js';
import {mail} from './mail.js';
import {pay,canAfford,bumpDamage,ECO} from './economy.js';
import {EDGES,WETLANDS,STREAM,ptAt,oddzial,YARD,inRect,offLimits} from './map.js';
import {noCut,inReserve} from './nest.js';
import {nearestRoad} from './roads.js';
import {rand} from './life/agents.js';
import {dryMask} from './paint.js';

export const HL={dry:.15,wx:'clear',wxNext:0,stormAt:-1,stormEnd:0,tickNext:0,dayRoll:-1,traps:-1,tower:false,ban:false,blocks:[],list:[],stats:{cutSan:0,storms:0,outbreaks:0}};
export const TOWER={x:2165,y:1150};   // 1.5.0: wieża stoi na polanie (oddz. 106), na otwartej przestrzeni — widać ją i nie ginie pod koronami
const TEMP_DAYS=12;   // rok gry = 4 pory × 3 dni
export const WX={clear:'słonecznie',rain:'deszcz',snow:'śnieg',storm:'wichura'};
export const LVLN=['brak zagrożenia','niskie','umiarkowane','wysokie'];
export const trapsOn=()=>state.days<HL.traps;
export const fireLvl=()=>cal.season()===3?0:HL.dry<.35?1:HL.dry<.65?2:3;
// mnożnik liczby pożarów i szybkość rozwoju ognia (wieża gasi szybciej)
export const fireMult=()=>[0,.5,1,2.1][fireLvl()]*(HL.ban?.35:1);
export const fireSpeed=()=>[.7,.8,1,1.35][fireLvl()]*(HL.tower?.55:1);
export const banned=()=>HL.ban;
const odd=(x,y)=>'oddz. '+oddzial(x,y);
const open_=q=>q.status!=='done'&&q.status!=='gone';

// ── stany drzew ──
// 0.9: pas za szosą nie należy do leśnictwa — nie ma tam kornika, wiatrołomów ani zgłoszeń, na które gracz nie ma wpływu
function infect(t){if(t.kb||t.nest||t.mon||offLimits(t.x,t.y))return;t.kb=1;t.kbT=state.days;HL.list.push(t)}
// 1.1.6: pas za szosą to tło — drzewa uszkodzone tam przed 0.9 (także wiatrołomy kb 4) wracają do zdrowia, bez oznaczeń
export function healOffLimits(){let n=0;for(const t of trees)if(t.st===STAND&&(t.kb||t.san||t.marked)&&offLimits(t.x,t.y)&&!t.assigned){t.kb=0;t.san=false;t.marked=false;dirtyTree(t);n++}return n}
export const rebuildHealth=()=>{healOffLimits();HL.list=trees.filter(t=>t.kb&&t.kb<4&&t.st===STAND);for(const t of HL.list)t.kbT=t.kbT??state.days;
 for(const b of HL.blocks){const e=EDGES.find(q=>q.id===b.e);if(e){e.blocked=true;const p=ptAt(e,b.s);b.edge=e;b.x=p[0];b.y=p[1];b.ang=Math.atan2(p[3],p[2])+Math.PI/2}}}
const stump=t=>{t.stumpR=clamp(crownR(t)*.2,3,8);t.st=STUMP;t.stumpAge=20;t.kb=0;t.marked=false;dirtyTree(t)};
export const sick=()=>trees.filter(t=>t.kb>=2&&t.st===STAND).length;

export function seedOutbreak(){
 for(let k=0;k<500;k++){const t=trees[(rand()*trees.length)|0];
  if(!t||t.st!==STAND||t.sp!=='swierk'||t.age<20||t.kb||offLimits(t.x,t.y)||inRect(t.x,t.y,YARD,80))continue;
  const nb=treesIn(t.x-80,t.y-80,t.x+80,t.y+80).filter(q=>q.st===STAND&&q.sp==='swierk'&&q.age>=20&&!q.kb&&!offLimits(q.x,q.y));
  if(nb.length<3)continue;infect(t);for(const q of nb.slice(0,4))infect(q);HL.stats.outbreaks++;return}
}
function beetleTick(){
 const se=cal.season(),sub=1/8,trap=trapsOn(),now=state.days;
 const wb=trees.reduce((a,t)=>a+(t.kb===4&&t.st===STAND?1:0),0);
 if(!HL.list.some(t=>t.kb<3)&&now>3&&(se===0||se===1)&&rand()<((se===1?.2+HL.dry*.5:.1+HL.dry*.3)+Math.min(.3,wb*.004))*sub)seedOutbreak();
 for(const q of E.incidents)if(q.type==='beetle'&&open_(q)&&offLimits(q.x,q.y))q.status='done';   // stare zgłoszenia zza szosy znikają
 let dead=0;const keep=[];
 for(const t of HL.list){
  if(t.st!==STAND||!t.kb||t.kb>=4)continue;
  if(offLimits(t.x,t.y)){t.kb=0;dirtyTree(t);continue}   // zapisy sprzed poprawki: drzewa za szosą wracają do zdrowia
  const age=now-t.kbT;
  if(t.kb===1&&age>(trap?.4:.8)){t.kb=2;dirtyTree(t);
   if(!E.incidents.some(q=>q.type==='beetle'&&open_(q)&&Math.hypot(q.x-t.x,q.y-t.y)<320))
    report('beetle',t.x,t.y,(trap?'Pułapki feromonowe wykazały obecność kornika w ':'W '+odd(t.x,t.y)+' zamierają świerki. Istnieje podejrzenie kornika')+(trap?odd(t.x,t.y):'')+'.',{x:t.x,y:t.y,r:260,n:0})}
  if(t.kb===2&&age>2.6){t.kb=3;dirtyTree(t)}
  if(t.kb===3&&age>7+((t.dw||inReserve(t.x,t.y))?70:0)){stump(t);continue}   // 0.9: martwe drewno (zostawione albo w rezerwacie) stoi znacznie dłużej
  if(t.kb<3&&rand()<.25*(1+HL.dry*1.5)*(trap?.45:1)*sub){
   const nb=treesIn(t.x-110,t.y-110,t.x+110,t.y+110).filter(q=>q.st===STAND&&!q.kb&&q.age>=20&&(q.sp==='swierk'||(q.sp==='sosna'&&q.age>50&&rand()<.2)));
   if(nb.length)infect(nb[(rand()*nb.length)|0])}
  if(t.kb===3)dead++;
  keep.push(t);
 }
 HL.list=keep;if(dead)bumpDamage(Math.min(.25,dead*.01),'kornik');
}
// Patrol po zgłoszeniu: sprawdza korę i cechuje do cięcia sanitarnego wszystkie zasiedlone drzewa w okolicy.
export function sanitaryMark(A){
 let n=0;for(const t of treesIn(A.x-A.r,A.y-A.r,A.x+A.r,A.y+A.r)){
  if(t.st!==STAND||!t.kb||t.marked||t.assigned||t.dw||offLimits(t.x,t.y)||noCut(t.x,t.y,t)||Math.hypot(t.x-A.x,t.y-A.y)>A.r)continue;
  t.marked=true;t.san=true;n++}
 A.n=n;HL.stats.cutSan+=n;return n;
}

// ── wichura ──
export function strike(){
 const c=[];
 if(rand()<.7){const es=EDGES.filter(e=>e.kind==='forest'&&e.a!=='l1'&&e.b!=='l1'),e=es[(rand()*es.length)|0],p=ptAt(e,e.len*(.15+.7*rand()));c.push({x:p[0]+(rand()-.5)*90,y:p[1]+(rand()-.5)*90})}
 for(let k=0;k<200&&!c.length;k++){const t=trees[(rand()*trees.length)|0];if(t&&t.st===STAND&&t.age>=25&&!inRect(t.x,t.y,YARD,200))c.push(t)}
 if(!c.length)return;const [cx,cy]=[c[0].x,c[0].y],R=380;let n=0;const down=[];
 for(const t of treesIn(cx-R,cy-R,cx+R,cy+R)){
  if(t.st!==STAND||t.age<25||t.kb===4||t.nest||t.mon||offLimits(t.x,t.y)||Math.hypot(t.x-cx,t.y-cy)>R)continue;
  const p=t.sp==='swierk'?.34:t.sp==='sosna'?.1:.08;
  if(rand()<p*(1-Math.hypot(t.x-cx,t.y-cy)/R*.5)){t.kb=4;t.kbT=state.days;dirtyTree(t);down.push(t);if(++n>=70)break}}
 let bl=0;
 for(const t of down){if(bl>=2)break;
  const rp=nearestRoad(t.x,t.y,['forest','dukt'],{margin:30});
  if(!rp||rp.d>70||rp.edge.a==='l1'||rp.edge.b==='l1'||HL.blocks.some(b=>b.edge===rp.edge&&Math.abs(b.s-rp.s)<150))continue;
  const p=ptAt(rp.edge,rp.s),b={edge:rp.edge,e:rp.edge.id,s:rp.s,x:p[0],y:p[1],ang:Math.atan2(p[3],p[2])+Math.PI/2};
  rp.edge.blocked=true;HL.blocks.push(b);bl++;
  b.inc=report('block',b.x,b.y,'Powalone drzewa zablokowały drogę leśną w '+odd(b.x,b.y)+'. Droga jest nieprzejezdna.',b)}
 HL.stats.storms++;bumpDamage(Math.min(5,n*.08),'wichura');
 mail('storm','Wichura! W '+odd(cx,cy)+' wiatr powalił albo połamał '+pf(n,'drzewo','drzewa','drzew')+(bl?', a '+pf(bl,'droga jest zatarasowana','drogi są zatarasowane','dróg jest zatarasowanych'):'')+'. Uprzątnij wiatrołomy, bo sprzyjają rozwojowi kornika.',{x:cx,y:cy});
}
export function clearBlock(b){
 b.dead=true;HL.blocks=HL.blocks.filter(q=>q!==b);
 if(!HL.blocks.some(q=>q.edge===b.edge))b.edge.blocked=false;
 for(const t of treesIn(b.x-45,b.y-45,b.x+45,b.y+45))if(t.kb===4&&t.st===STAND&&Math.hypot(t.x-b.x,t.y-b.y)<45)stump(t);
}

// ── pogoda i susza ──
function weatherTick(){
 const se=cal.season(),day=Math.floor(state.days);
 if(day!==HL.dayRoll){HL.dayRoll=day;
  HL.stormAt=rand()<[.05,.05,.14,.1][se]?day+.1+rand()*.8:-1;
  // 1.3.0: zakaz wstępu ogłasza i znosi nadleśnictwo (bez przycisku i bez kosztów leśnictwa)
  if(HL.ban&&fireLvl()<=1){HL.ban=false;mail('fire','Zagrożenie pożarowe spadło, więc nadleśnictwo znosi zakaz wstępu do lasu.')}
  if(HL.tower)pay(60,'dyżury na wieży przeciwpożarowej');
 }
 if(HL.stormAt>0&&state.days>=HL.stormAt){HL.stormAt=-1;HL.wx='storm';HL.stormEnd=state.days+.12;strike()}
 if(HL.wx==='storm'&&state.days>HL.stormEnd){HL.wx='rain';HL.wxNext=state.days+.2}
 if(state.days<HL.wxNext||HL.wx==='storm')return;
 const was=HL.wx!=='clear';
 HL.wx=rand()<(was?.55:[.26,.17,.38,.4][se]*.55)?(se===3?'snow':'rain'):'clear';
 HL.wxNext=state.days+.25+rand()*.2;
 // susza: letnie upały osuszają ściółkę, deszcz ją nawilża
 const w=HL.wx==='rain'||HL.wx==='snow';
 HL.dry=clamp(HL.dry+(w?-.12:[.035,.08,.012,-.03][se]),0,1);
 if(se===3)HL.dry*=.97;
 if(fireLvl()===3&&!HL.ban){HL.ban=true;mail('fire','Ogłoszono najwyższy stopień zagrożenia pożarowego, dlatego nadleśnictwo wprowadza zakaz wstępu do lasu. Dopóki susza nie minie, grzybiarzy i spacerowiczów będzie mniej.')}
}
export function updateHealth(){
 weatherTick();
 if(state.days>=HL.tickNext){HL.tickNext=state.days+1/8;beetleTick()}
}

// ── zakupy i decyzje (panel leśniczówki) ──
export const COSTS={traps:1800,tower:6000};
export function buyTraps(){
 if(trapsOn()){toast('Pułapki feromonowe są już wyłożone.');return}
 if(!canAfford(COSTS.traps))return;pay(COSTS.traps,'pułapki feromonowe na kornika');HL.traps=state.days+TEMP_DAYS;
 toast('Wyłożono pułapki feromonowe na kornika. Będą działać przez rok.');
}
export function buildTower(){
 if(HL.tower)return;if(!canAfford(COSTS.tower))return;pay(COSTS.tower,'budowa wieży przeciwpożarowej');HL.tower=true;
 for(const t of treesIn(TOWER.x-40,TOWER.y-40,TOWER.x+40,TOWER.y+40).slice())if(Math.hypot(t.x-TOWER.x,t.y-TOWER.y)<38){t.st=STUMP;t.stumpR=3;t.stumpAge=60;t.kb=0;dirtyTree(t)}
 toast('Wieża przeciwpożarowa na polanie jest gotowa. Dyżur obserwatora kosztuje '+zl(60)+' dziennie.');
}

// ── zapis ──
export const saveHealth=()=>({dry:+HL.dry.toFixed(3),wx:HL.wx,traps:HL.traps,tower:HL.tower,ban:HL.ban,blocks:HL.blocks.map(b=>({e:b.e,s:Math.round(b.s)})),stats:HL.stats});
export function loadHealth(o){
 if(!o)return;Object.assign(HL,{dry:o.dry??.15,wx:o.wx==='storm'?'rain':o.wx||'clear',traps:o.traps??-1,tower:!!o.tower,ban:!!o.ban,blocks:(o.blocks||[]).map(b=>({...b})),stats:o.stats||HL.stats});
 HL.wxNext=state.days;HL.tickNext=state.days;HL.dayRoll=-1;rebuildHealth();
 for(const b of HL.blocks)if(b.edge&&!b.inc)b.inc=report('block',b.x,b.y,'Drzewa leżą na drodze leśnej w '+odd(b.x,b.y)+'. Droga jest nieprzejezdna.',b,true);
}

// ── rysowanie ──
const vis=(x,y,m=60)=>x>camera.x-m&&y>camera.y-m&&x<camera.x+VIEW.w+m&&y<camera.y+VIEW.h+m;
const R_=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
let trapSpots=null;
function traps(){if(trapSpots)return trapSpots;trapSpots=[];
 const es=EDGES.filter(e=>e.kind==='forest'&&e.a!=='l1'&&e.b!=='l1'&&e.len>500);
 es.forEach((e,i)=>{const p=ptAt(e,e.len*(.3+.4*hash(i,3,5))),sg=i%2?1:-1;trapSpots.push([p[0]-p[3]*sg*34,p[1]+p[2]*sg*34])});return trapSpots}
export function drawHealth(g){
 // mokradła wysychają w suszy (1.3.3: woda cofa się w obrębie lustra wody, brzegi i dopływy zostają widoczne; zimą lód — bez suszy), strumień płycieje
 const s=cal.season()===3?0:clamp((HL.dry-.3)/.6,0,1),lvl=Math.round(s*4);
 if(lvl>0){
  WETLANDS.forEach((w,i)=>{if(!vis(w.x,w.y,200))return;const M=dryMask(i,lvl);g.drawImage(M.cv,M.x,M.y)});
  if(s>.45)for(let i=0;i<STREAM.length;i+=3){const p=STREAM[i];if(!vis(p[0],p[1]))continue;R_(g,p[0]-3,p[1]-1,6,2,`rgba(150,128,92,${.6*(s-.4)})`)}
 }
 if(trapsOn())for(const [x,y] of traps()){if(!vis(x,y))continue;R_(g,x-1,y-8,2,9,'#5a4630');R_(g,x-3,y-12,6,5,'#d8c23a');R_(g,x-2,y-11,4,1,'#f4e68a');R_(g,x-3,y-7,6,2,'#3e7048')}
 // 1.5.0: stalowa wieża kratownicowa widziana z góry: długi cień, cztery nogi zbiegające się ku kabinie, stężenia, kabina z oknami i dachem
 if(HL.tower&&vis(TOWER.x,TOWER.y,120)){const {x,y}=TOWER,B=17,T=8,ln=(a,b,c,d,col,w=1)=>{g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke()};
  g.fillStyle='#1c2b1b40';g.beginPath();g.moveTo(x-B,y+B);g.lineTo(x+B,y+B);g.lineTo(x+B+70,y+B+34);g.lineTo(x-B+70,y+B+34);g.closePath();g.fill();   // cień wieży
  g.fillStyle='#1c2b1b55';g.fillRect(x+60,y+40,24,16);
  R_(g,x-B-3,y-B-3,6,6,'#8a8578');R_(g,x+B-3,y-B-3,6,6,'#8a8578');R_(g,x-B-3,y+B-3,6,6,'#8a8578');R_(g,x+B-3,y+B-3,6,6,'#8a8578');   // stopy fundamentów
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]])ln(x+sx*B,y+sy*B,x+sx*T,y+sy*T-6,'#3e4440',2);   // nogi
  for(const [a,b] of [[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]]){   // stężenia krzyżowe na ścianach
   const m=k=>B+(T-B)*k;for(const k of [0,.5]){const k2=k+.5;ln(x+a[0]*m(k),y+a[1]*m(k)-6*k,x+b[0]*m(k2),y+b[1]*m(k2)-6*k2,'#5a605a');ln(x+b[0]*m(k),y+b[1]*m(k)-6*k,x+a[0]*m(k2),y+a[1]*m(k2)-6*k2,'#5a605a')}}
  R_(g,x-T-2,y-T-8,2*T+4,2*T+4,'#3e4440');R_(g,x-T-1,y-T-7,2*T+2,2*T+2,'#c8c2b0');   // kabina
  R_(g,x-T,y-T-6,2*T,2,'#6a8a96');R_(g,x-T,y+T-6,2*T,2,'#6a8a96');R_(g,x-T,y-T-6,2,2*T,'#6a8a96');R_(g,x+T-2,y-T-6,2,2*T,'#6a8a96');   // okna dookoła
  R_(g,x-T+2,y-T-4,2*T-4,2*T-4,'#8a3a2c');R_(g,x-T+2,y-T-4,2*T-4,2,'#b0563f');R_(g,x-1,y-12,2,2,'#4a4440');   // dach
  ln(x,y-12,x+3,y-22,'#2a2a26');R_(g,x+2,y-23,3,2,'#d84a3a');   // antena
 }
 for(const b of HL.blocks){if(!vis(b.x,b.y))continue;
  g.save();g.translate(b.x,b.y);g.rotate(b.ang);
  // dwa powalone pnie na ukos: korona z jednej strony, tarcza korzeniowa z drugiej, połamane gałęzie
  const line=(x0,y0,x1,y1,w,c)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke()};
  const tree=(x0,y0,x1,y1,w,sd)=>{
   line(x0,y0,x1,y1,w+2,'#2a1f16');line(x0,y0,x1,y1,w,'#5a4228');line(x0,y0,x1,y1,Math.max(1,w-4),'#7d5c3a');
   const dx=x1-x0,dy=y1-y0,l=Math.hypot(dx,dy);
   for(let k=0;k<9;k++){const t=.35+hash(k,sd,1)*.6,px=x0+dx*t,py=y0+dy*t,a=Math.atan2(dy,dx)+(k%2?1:-1)*(.5+hash(k,sd,2)*.8),L=7+hash(k,sd,3)*10;line(px,py,px+Math.cos(a)*L,py+Math.sin(a)*L,1,'#4a3524')}
   for(let k=0;k<34;k++){const t=.55+hash(k,sd,4)*.5,px=x0+dx*t+(hash(k,sd,5)-.5)*18,py=y0+dy*t+(hash(k,sd,6)-.5)*18;g.fillStyle=k%3?'#2d5a3e':'#3d7350';g.fillRect(Math.round(px),Math.round(py),3+(k%2),2)}
   g.fillStyle='#4a3a28';g.beginPath();g.ellipse(x0,y0,w*1.6,w*1.2,Math.atan2(dy,dx),0,6.283);g.fill();g.fillStyle='#6b563d';g.beginPath();g.ellipse(x0-dx/l*2,y0-dy/l*2,w*1.2,w*.9,Math.atan2(dy,dx),0,6.283);g.fill();
   for(let k=0;k<6;k++){const a=Math.atan2(dy,dx)+Math.PI+(k-2.5)*.5;line(x0,y0,x0+Math.cos(a)*10,y0+Math.sin(a)*10,1,'#5a4630')}};
  tree(34,10,-34,-14,5,Math.round(b.x)%97);tree(-26,16,40,-4,4,Math.round(b.y)%89);
  g.restore()}
}
export function drawWeather(g){
 const t=state.elapsed,W=VIEW.w,H=VIEW.h;
 if(HL.wx==='rain'||HL.wx==='storm'){
  const st=HL.wx==='storm';g.fillStyle=st?'rgba(30,40,55,.22)':'rgba(50,65,80,.1)';g.fillRect(0,0,W,H);
  g.strokeStyle=st?'rgba(190,205,225,.55)':'rgba(190,205,225,.38)';g.lineWidth=1;g.beginPath();
  const n=st?170:90;for(let i=0;i<n;i++){const x=(hash(i,1,5)*(W+40)+t*(st?90:40))%(W+40)-20,y=(hash(i,2,5)*H+t*(st?330:240))%H;g.moveTo(x,y);g.lineTo(x-(st?5:2),y+(st?9:6))}
  g.stroke();
 }else if(HL.wx==='snow'){
  g.fillStyle='rgba(255,255,255,.75)';for(let i=0;i<70;i++){const x=(hash(i,1,6)*W+Math.sin(t*.8+i)*8+W)%W,y=(hash(i,2,6)*H+t*26)%H;g.fillRect(Math.round(x),Math.round(y),1,1)}
 }
}
