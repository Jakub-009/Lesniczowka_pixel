// Przyroda (0.9): rzadkie ptaki (bocian czarny, bielik, żuraw, puchacz), dziennik obserwacji, pomnik przyrody, rezerwat, martwe drewno.
// Zasady: para, która się osiedli (bocian czarny w puszczy, bielik przy mokradle NW),
// zostaje na stałe w gnieździe na starym drzewie. Strefa ochronna gniazda jest mała cały rok, a w okresie lęgowym (wiosna) większa.
// Goście (1.5.1): stado żurawi zatrzymuje się na 1–2 dni na mokradle wiosną i jesienią, puchacz raz w roku na 2–3 noce siada na skraju puszczy.
// Do tego przeloty kluczy żurawi i gęsi oraz małe ptaki leśne. Nic tu nie karze gracza — to nagroda za obserwację.
import {state,cal,toast,zl,clamp,rect,WORLD,SEASON_DAYS,SEASONS,pf,DAY_S,camera,VIEW,hash} from './core.js';
import {oddzial,roadClearance,offLimits,WETLANDS} from './map.js';
import {trees,STAND,treesIn,dirtyTree,crownR} from './forest.js';
import {mail} from './mail.js';
import {ECO,pay,canAfford,bumpProtect} from './economy.js';
import {rand} from './life/agents.js';
import {sfx} from './sound.js';
import {NAT,NEST_R_SMALL,NEST_R_BIG,MON_MAX,RES_MAX,breeding,nestR,inReserve,away} from './nest.js';
export {NAT};

export const SPEC={
 stork:{name:'bocian czarny',kind:'settler',home:[3300,420],from:[3700,260],trees:['swierk','buk','dab','sosna'],minAge:90,R:330,span:15,col:['#1d1f22','#f1efe8','#c4382a'],place:'puszcza (oddz. 104)',seasons:[0,1]},
 bielik:{name:'bielik',kind:'settler',home:[330,420],from:[-60,300],trees:['sosna'],minAge:80,R:330,span:19,col:['#4a3626','#f1efe8','#e0b63a'],place:'mokradło w północno-zachodniej części lasu'},
 zuraw:{name:'żuraw',kind:'guest',stop:[1850,1430],from:[1850,-60],span:15,col:['#9aa0a6','#e8e8e4','#b4352c'],place:'mokradło przy szosie',seasons:[0,2]},
 puchacz:{name:'puchacz',kind:'guest',stop:[3040,560],from:[3700,500],span:11,col:['#7a5a36','#c8a56a','#e8a020'],place:'skraj puszczy',night:true},
};
const ORDER=['stork','bielik','zuraw','puchacz'];
const flights=[];
export const richness=()=>1+.1*Math.min(8,NAT.dw)+(NAT.reserve.length?.5:0)+(NAT.monuments.length?.2:0);
const yr=d=>Math.floor(d/(4*SEASON_DAYS))+1;
const when=d=>'rok '+yr(d)+' · '+SEASONS[Math.floor(d/SEASON_DAYS)%4];
const note=(text,o={})=>{NAT.log.unshift({day:state.days,text,x:o.x,y:o.y});if(NAT.log.length>40)NAT.log.length=40};
export const birdState=k=>NAT.bird[k]||null;
export function initNature(){NAT.nests.length=0;NAT.reserve.length=0;NAT.monuments.length=0;NAT.log.length=0;NAT.bird={};NAT.dw=0;flights.length=0;
 for(const k of ORDER)NAT.bird[k]={st:'none',at:null,tries:0};T.day=Math.floor(state.days);
 if(!ECO.seasonHooks.includes(seasonHook))ECO.seasonHooks.push(seasonHook)}
const T={day:-1,loop:60,away:null};
function seasonHook(){const n=NAT.reserve.length;if(n)bumpProtect(1.2*n,'rezerwaty przyrody');return {nature:{reserves:n,nests:NAT.nests.length,seen:ORDER.filter(k=>NAT.bird[k]&&NAT.bird[k].st!=='none').length}}}
// ── drzewo na gniazdo: najstarsze odpowiednie drzewo w okolicy miejsca ──
function pickNestTree(k){
 const S=SPEC[k],[hx,hy]=S.home;
 const ok=(t,minAge)=>t.st===STAND&&!t.kb&&!t.falling&&!t.lying&&!t.marked&&!t.assigned&&!t.nest&&!t.mon&&t.age>=minAge&&roadClearance(t.x,t.y)>40&&!offLimits(t.x,t.y);
 for(const [sps,minAge] of [[S.trees,S.minAge],[null,Math.max(60,S.minAge-25)]]){
  let best=null;
  for(const t of treesIn(hx-S.R,hy-S.R,hx+S.R,hy+S.R)){if(!ok(t,minAge)||(sps&&!sps.includes(t.sp))||Math.hypot(t.x-hx,t.y-hy)>S.R)continue;
   const sc=Math.hypot(t.x-hx,t.y-hy)-t.age*1.4;if(!best||sc<best.sc){best=t;best.sc=sc}}
  if(best)return best}
 return null;
}
// ── loty ──
function fly(sp,pts,o={}){const f={sp,pts,i:0,x:pts[0][0],y:pts[0][1],ang:0,v:o.v||62,t:0,sit:0,landed:false,hidden:false,o};flights.push(f);return f}
const orbit=(cx,cy,R,turns,a0)=>{const p=[];for(let k=0;k<turns*10;k++){const a=a0+k/10*Math.PI*2*(k%2?1:1);p.push([cx+Math.cos(a)*R*(1+.18*Math.sin(k*1.7)),cy+Math.sin(a)*R*.8*(1+.18*Math.cos(k*1.3))])}return p};
// 1.0.3: ptaki robią wyprawy: 2–3 punkty do ~950 px od gniazda, nad każdym krążą, potem wracają okrążyć gniazdo
function nestFlight(n){
 const pts=[[n.x,n.y]],legs=2+((rand()*2)|0);
 for(let l=0;l<legs;l++){const a=rand()*6.28,d=350+rand()*600;
  pts.push(...orbit(clamp(n.x+Math.cos(a)*d,80,WORLD.w-80),clamp(n.y+Math.sin(a)*d*.8,80,WORLD.h-80),130+rand()*200,1,rand()*6.28))}
 pts.push(...orbit(n.x,n.y,160+rand()*180,1,rand()*6.28),[n.x,n.y]);
 return fly(n.sp,pts,{v:56+rand()*14,nest:n})}
function establish(k,t){
 const S=SPEC[k],n={sp:k,name:S.name,x:Math.round(t.x),y:Math.round(t.y),tx:t.x,ty:t.y,day:state.days};
 t.nest=k;NAT.nests.push(n);dirtyTree(t);
 // prace zaplanowane w strefie ochronnej gniazda przepadają
 for(const q of treesIn(n.x-NEST_R_BIG,n.y-NEST_R_BIG,n.x+NEST_R_BIG,n.y+NEST_R_BIG))if(q.marked&&!q.assigned&&Math.hypot(q.x-n.x,q.y-n.y)<NEST_R_BIG)q.marked=false;
 return n}
function arrive(k){
 const S=SPEC[k],B=NAT.bird[k];
 if(S.kind==='settler'){
  const t=pickNestTree(k);if(!t){B.tries++;return false}
  const n=establish(k,t);B.st='arriving';B.day=state.days;
  const f=fly(k,[S.from,[(S.from[0]+n.x)/2+(rand()-.5)*160,(S.from[1]+n.y)/2+(rand()-.5)*160],...orbit(n.x,n.y,100,2,rand()*6.28),[n.x,n.y]],{v:70,arrive:true,nest:n});
  f.cb=()=>{B.st='settled';const m=mail('nature','Obserwacja: '+S.name+' osiedlił się w lesie i założył gniazdo na starym drzewie ('+S.place+', oddz. '+oddzial(n.x,n.y)+'). Wokół gniazda obowiązuje strefa ochronna: '+NEST_R_SMALL+' px, a wiosną, w okresie lęgowym, '+NEST_R_BIG+' px.'+(k==='stork'?' Bocian czarny jest ptakiem wędrownym: jesienią odlatuje na zimowiska, a pod jego nieobecność chronione jest tylko drzewo z gniazdem.':''),{x:n.x,y:n.y});note('Pierwsza obserwacja: '+S.name+'. Para założyła gniazdo w oddz. '+oddzial(n.x,n.y)+'.',{x:n.x,y:n.y});bumpProtect(4,'ptak założył gniazdo');sfx('coin')};
  return true}
 // gość (1.5.1): przylatuje, zostaje kilka dni, potem odlatuje; pojawia się co porę roku (żuraw) albo co rok (puchacz)
 const first=B.st==='none',V=VISIT[k],[sx,sy]=S.stop;
 B.st='visiting';B.day=state.days;B.until=state.days+V.stay[0]+rand()*(V.stay[1]-V.stay[0]);B.n=V.n[0]+Math.floor(rand()*(V.n[1]-V.n[0]+1));
 spawnGuests(k,false);
 mail('nature',k==='zuraw'?'Na mokradle przy szosie (oddz. '+oddzial(sx,sy)+') zatrzymało się stado żurawi — '+pf(B.n,'ptak','ptaki','ptaków')+'. Odpoczną tu dzień lub dwa, zanim polecą dalej.'
  :'Na skraju puszczy (oddz. '+oddzial(sx,sy)+') zamieszkał na kilka nocy puchacz. Za dnia chowa się w koronach, a o zmierzchu siada na suchym drzewie; nocą słychać jego pohukiwanie.',{x:sx,y:sy});
 if(first){note('Pierwsza obserwacja: '+S.name+' ('+S.place+').',{x:sx,y:sy});bumpProtect(1.5,'pierwsza obserwacja rzadkiego ptaka');sfx('coin')}
 return true}
const VISIT={zuraw:{n:[3,6],stay:[1,2]},puchacz:{n:[1,1],stay:[2,3]}};
const sIdx=d=>Math.floor(d/SEASON_DAYS);
// żuraw może wrócić w kolejnej porze roku (wiosną i jesienią), puchacz w kolejnym roku
function guestDue(k){const B=NAT.bird[k];if(B.at!=null||B.st==='visiting')return false;if(B.st==='none')return true;
 return k==='zuraw'?sIdx(B.day)<sIdx(state.days):yr(B.day)<yr(state.days)}
function spawnGuests(k,landed){
 const S=SPEC[k],B=NAT.bird[k],[sx,sy]=S.stop,stay=Math.max(60,(B.until-state.days)*DAY_S),se=cal.season();
 const exit=k==='zuraw'?(se===0?[sx+(rand()-.5)*600,-160]:[sx-700,WORLD.h+160]):[WORLD.w+120,sy-200];
 // żurawie stoją na grząskim brzegu i płyciznach (pierścień przy krawędzi mokradła), nie na środku wody
 const W=k==='zuraw'?WETLANDS.reduce((m,q)=>Math.hypot(q.x-sx,q.y-sy)<Math.hypot(m.x-sx,m.y-sy)?q:m):null,a0=-1.3+rand()*.6;   // wschodnia połowa mokradła — zachodni brzeg dotyka drogi
 for(let i=0;i<B.n;i++){
  let x=sx,y=sy;if(W){const a=a0+i*.48+rand()*.15,r=.8+rand()*.14;x=W.x+Math.cos(a)*W.rx*r;y=W.y+Math.sin(a)*W.ry*r}
  const f=landed?fly(k,[[x,y]],{v:66,guest:true}):fly(k,[[S.from[0]-i*16,S.from[1]-i*10],[(S.from[0]+x)/2,(S.from[1]+y)/2+(rand()-.5)*60],[x,y]],{v:66,guest:true});
  f.stay=stay+i*4;f.exit=[exit[0]+i*14,exit[1]+i*10];f.home=[x,y];f.ang=rand()*6.28;f.cb=()=>{B.st='gone'};
  if(landed){f.landed=true;f.sit=f.stay;f.i=f.pts.length}}
}
function dayRoll(){
 const d=Math.floor(state.days),se=cal.season();
 if(state.days<8)return;
 for(const k of ORDER){const B=NAT.bird[k],S=SPEC[k];if(S.kind==='settler'?(B.st!=='none'||B.at!=null):!guestDue(k))continue;
  if(S.seasons&&!S.seasons.includes(se))continue;
  const p=(S.kind==='settler'?.07:k==='zuraw'?.4:.12)*richness();
  if(rand()<p){const h=S.night?19.5+rand()*1.5:8+rand()*8;B.at=d+h/24}}
}
function resident(){
 const day=cal.hour()>7&&cal.hour()<19&&!cal.night();
 for(const n of NAT.nests){
  if(!day||away(n.sp)||flights.some(f=>f.o&&f.o.nest===n))continue;
  if(rand()<.85)nestFlight(n)}
}
// 1.5.0: wędrówka bociana czarnego (odlot jesienią, powrót wiosną)
function migrate(){
 const n=NAT.nests.find(q=>q.sp==='stork'),a=away('stork');
 if(T.away===null||!n){T.away=a;return}
 if(a===T.away)return;T.away=a;const S=SPEC.stork,far=[3900,-200];
 for(let q=flights.length-1;q>=0;q--)if(flights[q].o.nest===n)flights.splice(q,1);
 if(a){fly('stork',[[n.x,n.y],...orbit(n.x,n.y,140,1,rand()*6.28),far],{v:70});
  mail('nature','Bocian czarny odleciał na zimowiska do Afryki. Do jego powrotu wiosną chroni się tylko drzewo z gniazdem, a w otoczeniu można normalnie prowadzić prace.',{x:n.x,y:n.y})}
 else{fly('stork',[far,...orbit(n.x,n.y,110,2,rand()*6.28),[n.x,n.y]],{v:70,nest:n});
  mail('nature','Bocian czarny wrócił z zimowisk do gniazda w oddz. '+oddzial(n.x,n.y)+'. Wokół gniazda ponownie obowiązuje strefa ochronna.',{x:n.x,y:n.y})}
}
export function updateNature(dt){
 const d=Math.floor(state.days);if(d!==T.day){T.day=d;dayRoll();migrate()}
 for(const k of ORDER){const B=NAT.bird[k];if(B&&B.at!=null&&state.days>=B.at){B.at=null;if(!arrive(k)){B.at=state.days+1+rand()}}}
 T.loop-=dt;if(T.loop<=0){T.loop=140+rand()*220;resident()}
 flockTick(dt);smallTick(dt);owlTick(dt);   // co 140–360 s gry: para wylatuje na przelot nad lasem
 for(let q=flights.length-1;q>=0;q--){const f=flights[q];f.t+=dt;
  if(f.sit>0){f.sit-=dt;if(f.sit<=0){f.landed=false;f.pts=[[f.x,f.y],f.exit];f.i=0;f.o.leaving=true;f.o.guest=false;continue}
   if(f.sp==='zuraw'&&f.home){   // żurawie powoli chodzą po mokradle i żerują
    if(!f.wt||f.wt<=0){f.wt=8+rand()*20;f.wx=f.home[0]+(rand()-.5)*24;f.wy=f.home[1]+(rand()-.5)*12}f.wt-=dt;
    const dx=f.wx-f.x,dy=f.wy-f.y,L=Math.hypot(dx,dy);if(L>1){f.x+=dx/L*Math.min(L,3*dt);f.y+=dy/L*Math.min(L,3*dt);f.ang=Math.atan2(dy,dx)}}
   continue}
  const P=f.pts[f.i+1];if(!P){if(f.o.guest&&!f.o.leaving){f.landed=true;f.sit=f.stay;f.i=f.pts.length;continue}if(f.cb)f.cb();flights.splice(q,1);continue}
  const dx=P[0]-f.x,dy=P[1]-f.y,L=Math.hypot(dx,dy),s=f.v*dt;
  if(L<=s){f.x=P[0];f.y=P[1];f.i++}else{f.x+=dx/L*s;f.y+=dy/L*s;f.ang+=((Math.atan2(dy,dx)-f.ang+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*3)}}
}
// ── rysowanie ──
export function drawNature(g,camera,VIEW){
 const vx0=camera.x-40,vy0=camera.y-40,vx1=camera.x+VIEW.w+40,vy1=camera.y+VIEW.h+40;
 // gniazda na koronach starych drzew + strefy ochronne w trybie wycinki
 const zones=state.tool==='mark';
 for(const n of NAT.nests){
  if(n.x<vx0||n.x>vx1||n.y<vy0||n.y>vy1)continue;
  rect(g,n.x-9,n.y-7,18,14,'#2a1f14');rect(g,n.x-8,n.y-6,16,12,'#5c4529');rect(g,n.x-6,n.y-4,12,8,'#7a5c36');rect(g,n.x-3,n.y-2,6,4,'#2a1f14');rect(g,n.x-11,n.y-2,3,2,'#8a6c42');rect(g,n.x+8,n.y+1,4,2,'#8a6c42');rect(g,n.x-2,n.y-9,4,2,'#8a6c42');
  if(!away(n.sp)&&(breeding()||zones||state.selected===n)){g.save();g.strokeStyle=breeding()?'#ffb45a88':'#ffd89a66';g.lineWidth=1;g.setLineDash([4,4]);g.beginPath();g.arc(n.x,n.y,nestR(),0,6.283);g.stroke();g.restore()}
 }
 for(const m of NAT.monuments){if(m.x<vx0||m.x>vx1||m.y<vy0||m.y>vy1)continue;rect(g,m.x+9,m.y+5,6,5,'#3a2a1a');rect(g,m.x+10,m.y+6,4,3,'#d8d0b0');rect(g,m.x+11,m.y+10,2,3,'#3a2a1a')}
 drawSmall(g,vx0,vy0,vx1,vy1);
 for(const f of flights){
  if(f.x<vx0||f.x>vx1||f.y<vy0||f.y>vy1)continue;const S=SPEC[f.sp],[c1,c2,c3]=S.col;
  if(f.landed){if(f.sp==='zuraw')drawCrane(g,f);else if(f.sp==='puchacz'){if(owlOut())drawOwl(g,f)}
   else{rect(g,f.x-3,f.y-2,6,5,c1);rect(g,f.x-3,f.y+2,6,1,c2);rect(g,f.x+2,f.y-3,2,2,c1);rect(g,f.x+4,f.y-2,2,1,c3)}continue}
  const fl=Math.sin(f.t*(f.sp==='zuraw'?7:5)+f.x*.01),soar=f.sp==='bielik'||f.sp==='stork'?(fl>-.3?.25:0):0,w=S.span*(soar?1:.62+.38*fl);
  g.save();g.translate(Math.round(f.x+10),Math.round(f.y+14));g.rotate(f.ang);g.scale(1.5,1.5);g.fillStyle='#0d1a1240';g.fillRect(-4,-w*.5,8,w);g.restore();   // cień na ziemi
  g.save();g.translate(Math.round(f.x),Math.round(f.y));g.rotate(f.ang);g.scale(1.5,1.5);drawBird(g,f.sp,w);g.restore()}
 drawFlocks(g,vx0,vy0,vx1,vy1);
}
// 1.5.1: puchacz siedzi na widoku od zmierzchu do świtu, za dnia chowa się w koronach
const owlOut=()=>{const h=cal.hour();return h>17.5||h<7.5};
// żuraw stojący (widok z góry): szary tułów, ciemniejszy „kuper” z piór, czarno-biała szyja, czerwona plamka na głowie; żerując pochyla głowę
function drawCrane(g,f){
 const x=Math.round(f.x),y=Math.round(f.y),feed=Math.sin(f.t*.9+f.home[0])>.2,bob=feed?Math.round(Math.sin(f.t*5)):0;
 g.fillStyle='#0d1a1238';g.beginPath();g.ellipse(x+3,y+4,9,4,0,0,6.283);g.fill();   // cień
 g.save();g.translate(x,y);g.rotate(f.ang);g.scale(1.5,1.5);
 g.fillStyle='#6f757b';g.fillRect(-7,-1,2,2);g.fillRect(-6,-2,2,4);   // kuper z wydłużonych, opadających piór
 g.fillStyle='#a3a9ae';g.fillRect(-4,-2,6,4);g.fillRect(-5,-1,8,2);   // zaokrąglony tułów
 g.fillStyle='#868c92';g.fillRect(-4,-2,5,1);g.fillRect(-4,1,5,1);   // złożone skrzydła po bokach (ciemniejsze)
 const L=feed?2+bob:4;g.fillStyle='#24262a';g.fillRect(3,-1,L,2);g.fillStyle='#e8e8e4';g.fillRect(3,0,Math.max(1,L-1),1);   // szyja z białym pasem; żerując pochyla głowę
 g.fillStyle='#24262a';g.fillRect(3+L,-1,2,2);g.fillStyle='#c4382a';g.fillRect(4+L,-1,1,1);g.fillStyle='#6a6a60';g.fillRect(5+L,0,2,1);   // głowa, czerwona plamka, dziób
 g.restore()}
// puchacz na suchym konarze (widok z boku, jak tablice i znaki): duży, płowobrązowy, z „uszami” z piór i pomarańczowymi oczami
function drawOwl(g,f){
 const x=Math.round(f.x),y=Math.round(f.y);
 rect(g,x-12,y+7,24,2,'#4a3a2a');rect(g,x+6,y+5,6,2,'#4a3a2a');rect(g,x-11,y+7,8,1,'#6a5440');   // suchy konar
 rect(g,x-4,y-7,8,14,'#5c4228');rect(g,x-3,y-6,6,12,'#7a5a36');rect(g,x-2,y-1,4,6,'#c8a56a');   // tułów i jaśniejsza pierś
 for(let k=0;k<3;k++)rect(g,x-1+(k%2),y+k*2,1,1,'#5c4228');   // prążki na piersi
 rect(g,x-4,y-9,2,3,'#5c4228');rect(g,x+2,y-9,2,3,'#5c4228');   // pęczki piór „uszy”
 const blink=Math.sin(f.t*.7)>.97;if(!blink){rect(g,x-3,y-5,2,2,'#e8a020');rect(g,x+1,y-5,2,2,'#e8a020');rect(g,x-2,y-4,1,1,'#1a1208');rect(g,x+1,y-4,1,1,'#1a1208')}
 rect(g,x-1,y-3,2,1,'#3a2a1a');rect(g,x-3,y+7,2,1,'#3a2a1a');rect(g,x+1,y+7,2,1,'#3a2a1a')}   // dziób i szpony
// nocą oczy puchacza lekko świecą (rysowane w warstwie świateł)
export function natureGlow(g,dark,vis){
 for(const f of flights){if(f.sp!=='puchacz'||!f.landed||!owlOut()||!vis(f.x,f.y,40))continue;
  for(const ex of [-2,2]){const gr=g.createRadialGradient(f.x+ex,f.y-4,0,f.x+ex,f.y-4,4);gr.addColorStop(0,`rgba(255,190,80,${dark*.55})`);gr.addColorStop(1,'rgba(255,190,80,0)');g.fillStyle=gr;g.beginPath();g.arc(f.x+ex,f.y-4,4,0,6.283);g.fill()}}
}
// 1.5.0: ptaki w locie rysowane jak reszta gry — z prostokątów (pikseli), w układzie lokalnym: x do przodu, y w bok.
// Skrzydło składa się z pasków 1 px wzdłuż rozpiętości; na końcu „palce” lotek.
const BIRD={
 // bocian czarny: smukłe, długie skrzydła, cały czarny z góry, długa szyja, czerwony dziób i nogi wystające za ogon
 stork:{arm:[2,-5],hand:[-2,-5],fing:4,col:'#16171a',cov:'#2b2c31',body:[-5,3,3],tail:[-8,-5,3,'#16171a'],neck:[3,8,1,'#16171a'],head:[7,9,2,'#22242a'],beak:[9,12,1,'#c4382a'],legs:'#c4382a'},
 // bielik: szerokie „deskowate” skrzydła, ciemnobrązowy z jaśniejszymi pokrywami, płowa głowa, żółty dziób, biały klinowaty ogon
 bielik:{arm:[3,-6],hand:[1,-5],fing:5,col:'#3a2a1e',cov:'#6b5038',body:[-5,3,4],tail:[-9,-5,4,'#f1efe8'],neck:null,head:[3,6,3,'#c9b48a'],beak:[6,8,2,'#e0b63a'],legs:null},
 // 1.5.1: żuraw: szare skrzydła z czarnymi lotkami, długa czarna szyja, nogi za ogonem; gęś gęgawa: szarobrązowa, pomarańczowy dziób
 zuraw:{arm:[2,-5],hand:[-1,-4],fing:4,col:'#33363a',cov:'#a3a9ae',bodyc:'#9aa0a6',body:[-4,3,3],tail:[-6,-4,3,'#7f868c'],neck:[3,8,1,'#24262a'],head:[8,10,2,'#24262a'],beak:[10,12,1,'#6a6a60'],legs:'#3a3a3a'},
 ges:{arm:[2,-4],hand:[0,-3],fing:3,col:'#4e4a44',cov:'#9a9286',bodyc:'#857d72',body:[-4,3,3],tail:[-6,-4,3,'#e8e4dc'],neck:[3,6,2,'#5e584f'],head:[6,8,2,'#5e584f'],beak:[8,10,1,'#e08a50'],legs:null}};
function drawBird(g,sp,w){
 const B=BIRD[sp];
 if(!B){const S=SPEC[sp],[c1,c2,c3]=S.col;   // pozostałe gatunki (żuraw, puchacz) — dotychczasowa prosta sylwetka
  g.fillStyle=c1;for(const s of [-1,1]){g.beginPath();g.moveTo(3,s*1);g.lineTo(-1,s*w);g.lineTo(-6,s*w*.85);g.lineTo(-5,s*1);g.closePath();g.fill()}
  g.fillRect(-6,-1.5,12,3);g.fillRect(-9,-1,4,2);g.fillStyle=c2;g.fillRect(5,-1,3,2);g.fillStyle=c3;g.fillRect(8,-1,2,1);return}
 const W=Math.max(5,Math.round(w)),C=Math.round(W*.45);   // C — nadgarstek: dalej skrzydło się zwęża
 for(const s of [-1,1])for(let k=1;k<=W;k++){
  const y=s>0?k:-k-1,q=k<=C?0:(k-C)/(W-C);
  let x1=Math.round(B.arm[0]+(B.hand[0]-B.arm[0])*q),x0=Math.round(B.arm[1]+(B.hand[1]-B.arm[1])*q);
  if(k>W-B.fing){if((W-k)%2)continue;x0=x1-3}   // rozcapierzone lotki na końcu skrzydła
  g.fillStyle=B.col;g.fillRect(x0,y,x1-x0,1);
  if(k<W-B.fing){const m=Math.round((x0+x1)/2);g.fillStyle=B.cov;g.fillRect(m,y,x1-m,1)}}   // pokrywy skrzydłowe (jaśniejsze)
 const [b0,b1,bw]=B.body,[t0,t1,tw,tc]=B.tail;
 if(B.legs){g.fillStyle=B.legs;g.fillRect(t0-3,-1,3,1);g.fillRect(t0-3,0,3,1)}   // czerwone nogi za ogonem
 g.fillStyle=tc;g.fillRect(t0+2,-tw/2,t1-t0-2,tw);g.fillRect(t0,-tw/2+1,2,tw-2);   // ogon (u bielika biały klin)
 g.fillStyle=B.bodyc||B.col;g.fillRect(b0,-bw/2,b1-b0,bw);
 if(B.neck){const [n0,n1,nw,nc]=B.neck;g.fillStyle=nc;g.fillRect(n0,-nw/2,n1-n0,nw)}
 const [h0,h1,hw,hc]=B.head;g.fillStyle=hc;g.fillRect(h0,-hw/2,h1-h0,hw);
 const [k0,k1,kw,kc]=B.beak;g.fillStyle=kc;g.fillRect(k0,-kw/2,k1-k0,kw);
}
// ── czynności gracza ──
export function canMonument(t){return t&&t.st===STAND&&t.age>=110&&!t.kb&&!t.nest&&!t.mon&&NAT.monuments.length<MON_MAX&&t.x>150&&t.y>150&&t.x<WORLD.w-150&&!offLimits(t.x,t.y)&&roadClearance(t.x,t.y)>30}
export const MON_COST=600,RES_COST=2500;
export function makeMonument(t){
 if(!canMonument(t)){toast(NAT.monuments.length>=MON_MAX?'W leśnictwie są już '+MON_MAX+' pomniki przyrody — to maksymalna liczba.':'Pomnikiem przyrody może zostać tylko zdrowe drzewo w wieku co najmniej 110 lat.');return false}
 if(!canAfford(MON_COST))return false;pay(MON_COST,'pomnik przyrody (uchwała, tablica)');
 t.mon=true;t.marked=false;NAT.monuments.push({x:t.x,y:t.y,sp:t.sp,day:state.days});dirtyTree(t);bumpProtect(2,'pomnik przyrody');
 mail('nature','W oddz. '+oddzial(t.x,t.y)+' ustanowiono pomnik przyrody. Drzewo jest odtąd objęte stałą ochroną.',{x:t.x,y:t.y});note('Ustanowiono pomnik przyrody w oddz. '+oddzial(t.x,t.y)+'.',{x:t.x,y:t.y});return true}
export function toggleDeadwood(t){
 if(!t||t.st!==STAND||t.kb!==3){toast('Pozostawić w lesie jako martwe drewno można tylko drzewa obumarłe.');return false}
 t.dw=!t.dw;if(t.dw){t.marked=false;NAT.dw++;toast('Martwe drzewo zostanie w lesie jako schronienie dla owadów, dzięciołów i puszczyka. Nie będzie wycięte sanitarnie.')}else{NAT.dw=Math.max(0,NAT.dw-1);toast('Martwe drzewo ponownie przeznaczono do cięcia sanitarnego.')}
 dirtyTree(t);return true}
export function makeReserve(id){
 if(NAT.reserve.includes(id)){NAT.reserve=NAT.reserve.filter(q=>q!==id);toast('Zniesiono rezerwat w oddz. '+id+'.');return true}
 if(NAT.reserve.length>=RES_MAX){toast('W leśnictwie mogą być najwyżej '+RES_MAX+' rezerwaty.');return false}
 if(!canAfford(RES_COST))return false;pay(RES_COST,'rezerwat przyrody — oddz. '+id);NAT.reserve.push(id);bumpProtect(5,'nowy rezerwat');
 for(const t of trees)if(t.marked&&!t.assigned&&t.st===STAND&&oddzial(t.x,t.y)===id)t.marked=false;
 mail('nature','W oddz. '+id+' utworzono rezerwat przyrody. Obowiązuje tam zakaz wycinki, a martwe drzewa zostają w lesie. Zwiększa to szansę na pojawienie się rzadkich ptaków.',{});note('Utworzono rezerwat w oddz. '+id+'.');return true}
// ── zapis ──
export function saveNature(){
 return {bird:NAT.bird,log:NAT.log.slice(0,40),reserve:NAT.reserve,
  nests:NAT.nests.map(n=>[n.sp,n.tx,n.ty,+n.day.toFixed(2)]),mon:NAT.monuments.map(m=>[m.x,m.y,m.sp,+m.day.toFixed(2)]),
  dw:trees.filter(t=>t.dw&&t.st===STAND).map(t=>[t.x,t.y])}}
export function loadNature(o){
 initNature();if(!o)return;
 for(const k of ORDER)if(o.bird&&o.bird[k]){NAT.bird[k]=o.bird[k];if(NAT.bird[k].st==='arriving')NAT.bird[k].st='settled';if(NAT.bird[k].st==='visiting'){const B=NAT.bird[k];if(B.until>state.days+.02){B.n=B.n||1;spawnGuests(k,true)}else B.st='gone'}}
 NAT.log=o.log||[];NAT.reserve=o.reserve||[];
 const at=(x,y)=>treesIn(x-2,y-2,x+2,y+2).find(t=>t.st===STAND&&Math.abs(t.x-x)<1.5&&Math.abs(t.y-y)<1.5);
 for(const [sp,x,y,day] of o.nests||[]){const t=at(x,y);if(!t)continue;t.nest=sp;NAT.nests.push({sp,name:SPEC[sp].name,x:Math.round(x),y:Math.round(y),tx:x,ty:y,day})}
 for(const [x,y,sp,day] of o.mon||[]){const t=at(x,y);if(!t)continue;t.mon=true;NAT.monuments.push({x:t.x,y:t.y,sp,day})}
 for(const [x,y] of o.dw||[]){const t=at(x,y);if(t){t.dw=true;NAT.dw++}}
}
export function journalRows(){
 return ORDER.map(k=>{const B=NAT.bird[k],S=SPEC[k],n=NAT.nests.find(q=>q.sp===k);
  const txt=!B||B.st==='none'?'jeszcze nie widziany':B.st==='visiting'?(k==='zuraw'?'stado jest teraz na mokradle':'jest teraz w lesie'):B.st==='gone'?'ostatnio widziany: '+when(B.day):n?'gniazduje (oddz. '+oddzial(n.x,n.y)+') od '+when(n.day):'obserwowany ('+when(B.day)+')';
  return [S.name[0].toUpperCase()+S.name.slice(1),txt]})}
export const when_=when;
export const _flyNest=n=>nestFlight(n,2);
export const _drawBird=drawBird;
export const _small=()=>SMALL.map(b=>[Math.round(b.x),Math.round(b.y),b.sp]);
export const _forceFlock=(sp,north,x,y)=>{spawnFlock(sp,north);const F=FLOCKS[FLOCKS.length-1];if(x!=null){F.x=x;F.y=y}return F};

// ── 1.5.1: klucze żurawi i gęsi (wiosną na północ, jesienią na południe) ──
const FLOCKS=[];const FL={t:120,seen:{}};
const isDay=()=>{const h=cal.hour();return h>7&&h<18};
function flockTick(dt){
 const se=cal.season();
 for(let i=FLOCKS.length-1;i>=0;i--){const F=FLOCKS[i];F.t+=dt;F.x+=F.dx*F.v*dt;F.y+=F.dy*F.v*dt;
  if(F.y<-260||F.y>WORLD.h+260||F.x<-400||F.x>WORLD.w+400){FLOCKS.splice(i,1);continue}
  F.ct-=dt;if(F.ct<=0){F.ct=4+rand()*6;const cx=camera.x+VIEW.w/2,cy=camera.y+VIEW.h/2;if(Math.hypot(F.x-cx,F.y-cy)<VIEW.w*1.1)sfx(F.sp==='zuraw'?'klang':'honk')}}
 if(se!==0&&se!==2||!isDay())return;
 FL.t-=dt;if(FL.t>0)return;FL.t=300+rand()*500;
 if(FLOCKS.length||rand()<.45)return;
 spawnFlock(rand()<.55?'zuraw':'ges',se===0)}
function spawnFlock(sp,north){
 const n=7+Math.floor(rand()*9);
 const x0=300+rand()*(WORLD.w-600),x1=clamp(x0+(rand()-.5)*900,100,WORLD.w-100),y0=north?WORLD.h+220:-220,y1=north?-220:WORLD.h+220,L=Math.hypot(x1-x0,y1-y0);
 FLOCKS.push({sp,n,x:x0,y:y0,dx:(x1-x0)/L,dy:(y1-y0)/L,v:sp==='zuraw'?70:78,t:0,ct:1,seed:rand()*100});
 const key=sp+sIdx(state.days);if(!FL.seen[key]){FL.seen[key]=1;
  mail('nature',(sp==='zuraw'?'Nad lasem przelatuje klucz żurawi':'Nad lasem przelatuje klucz gęsi')+(north?' — ptaki wracają z zimowisk na lęgowiska.':' — ptaki odlatują na zimowiska.'))}
}
function drawFlocks(g,vx0,vy0,vx1,vy1){
 for(const F of FLOCKS){const a=Math.atan2(F.dy,F.dx),px=-F.dy,py=F.dx;
  for(let i=0;i<F.n;i++){const r=Math.ceil(i/2),sd=i%2?1:-1,x=F.x-F.dx*r*15+px*sd*r*11+Math.sin(F.t*.6+i)*2,y=F.y-F.dy*r*15+py*sd*r*11;
   if(x<vx0-60||x>vx1+60||y<vy0-60||y>vy1+60)continue;
   const w=(F.sp==='zuraw'?13:11)*(.68+.32*Math.sin(F.t*(F.sp==='zuraw'?4:6)+i*.9));
   g.save();g.translate(Math.round(x+38),Math.round(y+56));g.rotate(a);g.fillStyle='#0d1a1222';g.fillRect(-4,-w*.5,8,w);g.restore();   // cień daleko — ptaki lecą wysoko
   g.save();g.translate(Math.round(x),Math.round(y));g.rotate(a);drawBird(g,F.sp,w);g.restore()}}
}
// ── 1.5.1: małe ptaki leśne — krótkie, faliste przeloty nad koronami (zięba, sikora, kos, sójka) ──
const SMALL=[];const SB={t:2};
const SMALL_SP={zieba:{b:'#9a6a4e',h:'#7a8a9a',w:'#3e3228',bar:'#ece6d6'},sikora:{b:'#d2c04a',h:'#1c1c1c',w:'#5a6a7a',bar:'#ece6d6'},kos:{b:'#1c1c1c',h:'#1c1c1c',w:'#262626',bar:null,beak:'#e0a020'},sojka:{b:'#b49482',h:'#c8b8a8',w:'#2a2a2a',bar:'#5a8ae0'}};
function smallTick(dt){
 for(let i=SMALL.length-1;i>=0;i--){const b=SMALL[i];b.t+=dt;const dx=b.tx-b.x,dy=b.ty-b.y,L=Math.hypot(dx,dy),st=b.v*dt;
  if(L<=st){SMALL.splice(i,1);continue}b.x+=dx/L*st;b.y+=dy/L*st;b.ang=Math.atan2(dy,dx)}
 const h=cal.hour(),se=cal.season();if(h<6||h>19.5||cal.night())return;
 SB.t-=dt;if(SB.t>0)return;SB.t=(se===3?5:1.6)+rand()*(se===3?6:3);
 if(SMALL.length>=(se===3?3:7))return;
 // start i cel na koronach drzew w widoku
 const pick=()=>{for(let k=0;k<8;k++){const x=camera.x+rand()*VIEW.w,y=camera.y+rand()*VIEW.h,T=treesIn(x-30,y-30,x+30,y+30).find(t=>t.st===STAND);if(T)return [T.x,T.y]}return null};
 const A=pick();if(!A)return;let B=null;for(let k=0;k<6&&!B;k++){const a=rand()*6.28,d=70+rand()*130,x=A[0]+Math.cos(a)*d,y=A[1]+Math.sin(a)*d;if(treesIn(x-25,y-25,x+25,y+25).some(t=>t.st===STAND))B=[x,y]}
 if(!B)return;const pool=se===3?['sikora','sikora','kos','sojka']:['zieba','zieba','sikora','sikora','kos','sojka'],sp=pool[Math.floor(rand()*pool.length)];
 SMALL.push({sp,x:A[0],y:A[1],tx:B[0],ty:B[1],v:sp==='sojka'?42:50,t:rand(),ang:0});
}
function drawSmall(g,vx0,vy0,vx1,vy1){
 for(const b of SMALL){if(b.x<vx0||b.x>vx1||b.y<vy0||b.y>vy1)continue;const C=SMALL_SP[b.sp],big=b.sp==='sojka'||b.sp==='kos';
  // lot falisty: kilka machnięć, potem ślizg ze złożonymi skrzydłami (ptak lekko „opada” — cień się zbliża)
  const cyc=(b.t*2.2)%1,flap=cyc<.55,open=flap&&Math.sin(b.t*40)>0,hop=Math.sin(cyc*Math.PI*2)*1.5;
  g.save();g.translate(Math.round(b.x),Math.round(b.y-hop));g.rotate(b.ang);g.scale(1.5,1.5);   // skala jak u pozostałych ptaków
  g.fillStyle='#0d1a1230';g.fillRect(2,3+hop,3,2);
  const ws=open?(big?4:3):1;g.fillStyle=C.w;g.fillRect(-1,-ws-1,2,ws);g.fillRect(-1,1,2,ws);if(C.bar&&open){g.fillStyle=C.bar;g.fillRect(0,-ws-1,1,1);g.fillRect(0,ws,1,1)}
  g.fillStyle=C.b;g.fillRect(-2,-1,big?4:3,2);g.fillStyle=C.w;g.fillRect(big?-4:-3,-1,big?2:1,2);g.fillStyle=C.h;g.fillRect(big?2:1,-1,2,2);if(C.beak){g.fillStyle=C.beak;g.fillRect(big?4:3,0,1,1)}
  g.restore()}
}
// puchacz pohukuje nocą (słychać go tylko, gdy kamera jest w tej części lasu)
const OWL={t:30};
function owlTick(dt){const f=flights.find(q=>q.sp==='puchacz'&&q.landed);if(!f||!owlOut())return;OWL.t-=dt;if(OWL.t>0)return;OWL.t=40+rand()*80;
 if(Math.hypot(f.x-(camera.x+VIEW.w/2),f.y-(camera.y+VIEW.h/2))<VIEW.w*1.2)sfx('uhu')}
