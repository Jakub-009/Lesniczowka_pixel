// Zdrowie lasu (0.7): pogoda i susza, zagrożenie pożarowe, kornik drukarz (pułapki feromonowe, cięcia sanitarne),
// wichury (wiatrołomy, zatarasowane drogi), wieża przeciwpożarowa i zakaz wstępu do lasu.
// Stan zdrowia drzewa jest ukryty: kb 1 = zasiedlone (nie widać), 2 = zamiera (rude korony), 3 = martwe, 4 = wiatrołom.
import {state,cal,toast,zl,clamp,hash,camera,VIEW} from './core.js';
import {trees,treesIn,STAND,STUMP,dirtyTree,crownR} from './forest.js';
import {E} from './ents.js';
import {report} from './incidents.js';
import {mail} from './mail.js';
import {pay,canAfford,bumpDamage,ECO} from './economy.js';
import {EDGES,WETLANDS,STREAM,ptAt,oddzial,YARD,inRect} from './map.js';
import {nearestRoad} from './roads.js';
import {rand} from './life/agents.js';

export const HL={dry:.15,wx:'clear',wxNext:0,stormAt:-1,stormEnd:0,tickNext:0,dayRoll:-1,traps:-1,tower:false,ban:false,blocks:[],list:[],stats:{cutSan:0,storms:0,outbreaks:0}};
export const TOWER={x:2300,y:1560};
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
function infect(t){if(t.kb)return;t.kb=1;t.kbT=state.days;HL.list.push(t)}
export const rebuildHealth=()=>{HL.list=trees.filter(t=>t.kb&&t.kb<4&&t.st===STAND);for(const t of HL.list)t.kbT=t.kbT??state.days;
 for(const b of HL.blocks){const e=EDGES.find(q=>q.id===b.e);if(e){e.blocked=true;const p=ptAt(e,b.s);b.edge=e;b.x=p[0];b.y=p[1];b.ang=Math.atan2(p[3],p[2])+Math.PI/2}}}
const stump=t=>{t.stumpR=clamp(crownR(t)*.2,3,8);t.st=STUMP;t.stumpAge=20;t.kb=0;t.marked=false;dirtyTree(t)};
export const sick=()=>trees.filter(t=>t.kb>=2&&t.st===STAND).length;

export function seedOutbreak(){
 for(let k=0;k<500;k++){const t=trees[(rand()*trees.length)|0];
  if(!t||t.st!==STAND||t.sp!=='swierk'||t.age<20||t.kb||inRect(t.x,t.y,YARD,80))continue;
  const nb=treesIn(t.x-80,t.y-80,t.x+80,t.y+80).filter(q=>q.st===STAND&&q.sp==='swierk'&&q.age>=20&&!q.kb);
  if(nb.length<3)continue;infect(t);for(const q of nb.slice(0,4))infect(q);HL.stats.outbreaks++;return}
}
function beetleTick(){
 const se=cal.season(),sub=1/8,trap=trapsOn(),now=state.days;
 const wb=trees.reduce((a,t)=>a+(t.kb===4&&t.st===STAND?1:0),0);
 if(!HL.list.some(t=>t.kb<3)&&now>3&&(se===0||se===1)&&rand()<((se===1?.2+HL.dry*.5:.1+HL.dry*.3)+Math.min(.3,wb*.004))*sub)seedOutbreak();
 let dead=0;const keep=[];
 for(const t of HL.list){
  if(t.st!==STAND||!t.kb||t.kb>=4)continue;
  const age=now-t.kbT;
  if(t.kb===1&&age>(trap?.4:.8)){t.kb=2;dirtyTree(t);
   if(!E.incidents.some(q=>q.type==='beetle'&&open_(q)&&Math.hypot(q.x-t.x,q.y-t.y)<320))
    report('beetle',t.x,t.y,(trap?'Pułapki feromonowe wykazały nalot kornika — ':'Zamierające świerki — podejrzenie kornika w ')+odd(t.x,t.y)+'.',{x:t.x,y:t.y,r:260,n:0})}
  if(t.kb===2&&age>2.6){t.kb=3;dirtyTree(t)}
  if(t.kb===3&&age>7){stump(t);continue}
  if(t.kb<3&&rand()<.25*(1+HL.dry*1.5)*(trap?.45:1)*sub){
   const nb=treesIn(t.x-110,t.y-110,t.x+110,t.y+110).filter(q=>q.st===STAND&&!q.kb&&q.age>=20&&(q.sp==='swierk'||(q.sp==='sosna'&&q.age>50&&rand()<.2)));
   if(nb.length)infect(nb[(rand()*nb.length)|0])}
  if(t.kb===3)dead++;
  keep.push(t);
 }
 HL.list=keep;if(dead)bumpDamage(Math.min(.25,dead*.01));
}
// Patrol po zgłoszeniu: sprawdza korę i cechuje do cięcia sanitarnego wszystkie zasiedlone drzewa w okolicy.
export function sanitaryMark(A){
 let n=0;for(const t of treesIn(A.x-A.r,A.y-A.r,A.x+A.r,A.y+A.r)){
  if(t.st!==STAND||!t.kb||t.marked||t.assigned||Math.hypot(t.x-A.x,t.y-A.y)>A.r)continue;
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
  if(t.st!==STAND||t.age<25||t.kb===4||Math.hypot(t.x-cx,t.y-cy)>R)continue;
  const p=t.sp==='swierk'?.34:t.sp==='sosna'?.1:.08;
  if(rand()<p*(1-Math.hypot(t.x-cx,t.y-cy)/R*.5)){t.kb=4;t.kbT=state.days;dirtyTree(t);down.push(t);if(++n>=70)break}}
 let bl=0;
 for(const t of down){if(bl>=2)break;
  const rp=nearestRoad(t.x,t.y,['forest'],{margin:30});
  if(!rp||rp.d>70||rp.edge.a==='l1'||rp.edge.b==='l1'||HL.blocks.some(b=>b.edge===rp.edge&&Math.abs(b.s-rp.s)<150))continue;
  const p=ptAt(rp.edge,rp.s),b={edge:rp.edge,e:rp.edge.id,s:rp.s,x:p[0],y:p[1],ang:Math.atan2(p[3],p[2])+Math.PI/2};
  rp.edge.blocked=true;HL.blocks.push(b);bl++;
  b.inc=report('block',b.x,b.y,'Drzewa powalone na drodze leśnej w '+odd(b.x,b.y)+' — droga nieprzejezdna.',b)}
 HL.stats.storms++;bumpDamage(Math.min(5,n*.08));
 mail('storm','Wichura! W '+odd(cx,cy)+' powalone lub połamane drzewa: '+n+(bl?', zatarasowane drogi: '+bl:'')+'. Wiatrołomy trzeba szybko uprzątnąć — sprzyjają kornikowi.',{x:cx,y:cy});
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
  if(HL.ban&&fireLvl()<=1){HL.ban=false;toast('Zakaz wstępu do lasu zniesiony: zagrożenie pożarowe jest niskie.')}
  if(HL.ban)pay(40,'zakaz wstępu do lasu (tablice, kontrole)');
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
 if(fireLvl()===3&&!HL.ban&&!HL.warned){HL.warned=true;toast('Zagrożenie pożarowe wysokie — rozważ zakaz wstępu do lasu (L).')}
 if(fireLvl()<3)HL.warned=false;
}
export function updateHealth(){
 weatherTick();
 if(state.days>=HL.tickNext){HL.tickNext=state.days+1/8;beetleTick()}
}

// ── zakupy i decyzje (panel leśniczówki) ──
export const COSTS={traps:1800,tower:6000};
export function buyTraps(){
 if(trapsOn()){toast('Pułapki feromonowe już wyłożone.');return}
 if(!canAfford(COSTS.traps))return;pay(COSTS.traps,'pułapki feromonowe na kornika');HL.traps=state.days+TEMP_DAYS;
 toast('Pułapki feromonowe wyłożone na rok: nalot kornika wychodzi wcześniej, a jego rozprzestrzenianie spada o połowę.');
}
export function buildTower(){
 if(HL.tower)return;if(!canAfford(COSTS.tower))return;pay(COSTS.tower,'budowa wieży przeciwpożarowej');HL.tower=true;
 for(const t of treesIn(TOWER.x-40,TOWER.y-40,TOWER.x+40,TOWER.y+40).slice())if(Math.hypot(t.x-TOWER.x,t.y-TOWER.y)<38){t.st=STUMP;t.stumpR=3;t.stumpAge=60;t.kb=0;dirtyTree(t)}
 toast('Wieża przeciwpożarowa gotowa: pożary rozwijają się wolniej, bo wcześniej je widać (dyżur '+zl(60)+' dziennie).');
}
export function toggleBan(){
 HL.ban=!HL.ban;toast(HL.ban?'Zakaz wstępu do lasu: grzybiarze, spacerowicze i rowerzyści nie wjadą, ryzyko pożaru spada ('+zl(40)+' dziennie).':'Zakaz wstępu do lasu zniesiony.');
}

// ── zapis ──
export const saveHealth=()=>({dry:+HL.dry.toFixed(3),wx:HL.wx,traps:HL.traps,tower:HL.tower,ban:HL.ban,blocks:HL.blocks.map(b=>({e:b.e,s:Math.round(b.s)})),stats:HL.stats});
export function loadHealth(o){
 if(!o)return;Object.assign(HL,{dry:o.dry??.15,wx:o.wx==='storm'?'rain':o.wx||'clear',traps:o.traps??-1,tower:!!o.tower,ban:!!o.ban,blocks:(o.blocks||[]).map(b=>({...b})),stats:o.stats||HL.stats});
 HL.wxNext=state.days;HL.tickNext=state.days;HL.dayRoll=-1;rebuildHealth();
 for(const b of HL.blocks)if(b.edge&&!b.inc)b.inc=report('block',b.x,b.y,'Drzewa na drodze leśnej w '+odd(b.x,b.y)+' — droga nieprzejezdna.',b,true);
}

// ── rysowanie ──
const vis=(x,y,m=60)=>x>camera.x-m&&y>camera.y-m&&x<camera.x+VIEW.w+m&&y<camera.y+VIEW.h+m;
const R_=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
let trapSpots=null;
function traps(){if(trapSpots)return trapSpots;trapSpots=[];
 const es=EDGES.filter(e=>e.kind==='forest'&&e.a!=='l1'&&e.b!=='l1'&&e.len>500);
 es.forEach((e,i)=>{const p=ptAt(e,e.len*(.3+.4*hash(i,3,5))),sg=i%2?1:-1;trapSpots.push([p[0]-p[3]*sg*34,p[1]+p[2]*sg*34])});return trapSpots}
export function drawHealth(g){
 // mokradła wysychają w suszy, strumień zamienia się w koryto
 const s=clamp((HL.dry-.3)/.6,0,1);
 if(s>.02){
  for(const w of WETLANDS){if(!vis(w.x,w.y,200))continue;
   g.fillStyle=`rgba(128,108,72,${.75*s})`;g.beginPath();g.ellipse(w.x,w.y,w.rx*1.04,w.ry*1.04,0,0,6.283);g.ellipse(w.x,w.y,w.rx*(1-.55*s),w.ry*(1-.55*s),0,0,6.283);g.fill('evenodd')}
  if(s>.45)for(let i=0;i<STREAM.length;i+=3){const p=STREAM[i];if(!vis(p[0],p[1]))continue;R_(g,p[0]-6,p[1]-2,12,4,`rgba(150,128,92,${.8*(s-.4)})`)}
 }
 if(trapsOn())for(const [x,y] of traps()){if(!vis(x,y))continue;R_(g,x-1,y-8,2,9,'#5a4630');R_(g,x-3,y-12,6,5,'#d8c23a');R_(g,x-2,y-11,4,1,'#f4e68a');R_(g,x-3,y-7,6,2,'#3e7048')}
 if(HL.tower&&vis(TOWER.x,TOWER.y,80)){const {x,y}=TOWER;
  R_(g,x-14,y+4,34,12,'#1c2b1b55');
  for(const dx of [-10,10]){R_(g,x+dx-1,y-30,3,36,'#6b563d')}R_(g,x-11,y-12,22,2,'#7a6248');R_(g,x-11,y-22,22,2,'#7a6248');
  R_(g,x-14,y-34,28,6,'#5e4a36');R_(g,x-12,y-33,24,3,'#8a7255');R_(g,x-15,y-42,30,8,'#9a4a34');R_(g,x-14,y-41,28,2,'#c46a4a');
  R_(g,x-18,y-12,6,12,'#8a7255');R_(g,x-17,y-12,1,12,'#6b563d');
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
