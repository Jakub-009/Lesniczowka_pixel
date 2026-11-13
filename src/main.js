// Punkt wejścia: budowa świata, stały krok symulacji (60 Hz, przy przyspieszeniu kilka kroków na klatkę), kamera, zoom, pętla.
import {C,ctx,VIEW,WORLD,$,clamp,keys,state,camera,RT,fx,DEBUG,DAY_S,SETTINGS,toast,active,VERSION,cal} from './core.js';
import {buildGround,fadeMarks} from './paint.js';
import {generate,updateFalls,trees,counts,dirtyAll,seasonGrow} from './forest.js';
import {buildNavs,E,prune} from './ents.js';
import {MAIL,mail} from './mail.js';
import {updateCrossing,startCrossing} from './crossing.js';
import {updateOrder,spawnDump,dispatchPolice,buyCams,toggleBarriers,buyParking} from './order.js';
import {spawnWildlife,updateVisitors,groups} from './life/populate.js';
import {updateHealth,HL} from './health.js';
import {initPatrol,updateIncidents,U,spawnRider,spawnSmoke,spawnIntruder,addTrash,dispatch,hirePod} from './incidents.js';
import {initFauna,updateFauna,FA} from './life/fauna.js';
import {initAmbony,AMB} from './life/ambony.js';
import {initBase,updateBase,BASE,buildNursery,buildGarage,hireDeputy} from './base.js';
import {initJobs,updateJobs,J,orderTruck,hireCrewB,dispatchCrew} from './jobs.js';
import {updateRenew,R,createPlot,orderPrep,orderPlant} from './renew.js';
import {initEconomy,updateEconomy,ECO} from './economy.js';
import {spawnWildlife as respawnWild} from './life/populate.js';
import {drawWorld} from './render.js';
import {hud,bindUI,centerOn,repositionInfo} from './ui.js';
import {bindInput} from './input.js';
import {updateSound,toggleSound,resumeSound} from './sound.js';
import {toggleMap,updateMap} from './mapview.js';
import {hasSave,clearSave,saveGame,loadGame} from './save.js';

const STEP=1/60,RATES=[1,3,10],NIGHT_FF=8;
// Ochrona przed zawieszeniem: wyjątek w jednym podsystemie lub u jednego obiektu nie może zatrzymać całej gry.
const ERR=new Map();let errToast=false;
function fail(where,e){
 const k=where+':'+(e&&e.message),n=(ERR.get(k)||0)+1;ERR.set(k,n);
 if(n===1){console.error('[Leśniczówka] błąd w '+where,e);DEBUG.errors=(DEBUG.errors||0)+1}
 if(!errToast){errToast=true;toast('Wystąpił błąd w grze ('+where+'), ale gra działa dalej. Jeśli coś przestanie reagować, odśwież stronę — zapis jest automatyczny.')}
}
// Diagnostyka zacięć: czas każdego podsystemu; wolne wywołania (>40 ms) trafiają do __lasDiag().
const DIAG={slow:[],stalls:[]};
const noteSlow=(where,ms)=>{if(ms>40){DIAG.slow.push({t:Math.round(performance.now()/1000),where,ms:Math.round(ms)});if(DIAG.slow.length>40)DIAG.slow.shift();if(ms>150&&!noteSlow[where]){noteSlow[where]=1;console.warn('[Leśniczówka] wolny podsystem: '+where+' '+Math.round(ms)+' ms')}}};
const safe=(where,fn,dt)=>{const t0=performance.now();RT.where=where;try{fn(dt)}catch(e){fail(where,e)}noteSlow(where,performance.now()-t0)};
const each=(where,list,dt)=>{const t0=performance.now();RT.where=where;for(const o of list){try{o.update(dt)}catch(e){fail(where,e);o.dead=true}}noteSlow(where,performance.now()-t0)};
function sim(dt){
 state.elapsed+=dt;const d0=Math.floor(state.days);state.days+=dt/DAY_S;if(Math.floor(state.days)!==d0)safe('znaczniki',()=>fadeMarks(.12));
 safe('drzewa',updateFalls,dt);
 each('grupy',groups,dt);each('zwierzęta',E.animals,dt);each('ludzie',E.people,dt);each('pojazdy',E.vehicles,dt);
 safe('goście',updateVisitors,dt);safe('incydenty',updateIncidents,dt);safe('ekipy',updateJobs,dt);safe('odnowienia',updateRenew,dt);safe('fauna',updateFauna,dt);
 safe('baza',updateBase,dt);safe('porządek',updateOrder,dt);safe('przejścia',updateCrossing,dt);safe('zdrowie lasu',updateHealth,dt);safe('ekonomia',updateEconomy,dt);
 for(let i=fx.length-1;i>=0;i--){const p=fx[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)fx.splice(i,1)}
 safe('sprzątanie',prune);
}
function step(dt){
 if(!active())return;
 // noc przewija się sama (×8), chyba że trwa interwencja albo w lesie pali się / kręci kłusownik
 const busy=U.some(u=>u.phase!=='home')||E.incidents.some(q=>q.status==='assigned'||(q.status==='new'&&(q.type==='fire'||q.type==='intruder')));
 state.ff=cal.night()&&!busy&&!state.noFF?NIGHT_FF:1;
 const n=Math.min(30,state.rate*state.ff);for(let i=0;i<n;i++)sim(dt);
 // kamera: WASD / strzałki albo śledzenie wybranego obiektu
 const sp=520*dt/Math.max(1,VIEW.scale)*2;
 const kx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),ky=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
 if(kx||ky){camera.x+=kx*sp;camera.y+=ky*sp;state.follow=null}
 const f=state.follow;
 if(f){if(f.dead||f.hidden)state.follow=null;else{const [x,y]=f.pos||[f.x,f.y];camera.x+=(x-VIEW.w/2-camera.x)*Math.min(1,dt*4);camera.y+=(y-VIEW.h/2-camera.y)*Math.min(1,dt*4)}}
 updateSound(dt);
 if(RT.msgT>0){RT.msgT-=dt;if(RT.msgT<=0)$('#msg').style.opacity='0'}
}
// 0.6: kamera może wyjechać poza krawędź mapy o szerokość paneli, żeby rogi lasu nie były zasłonięte
function clampCamera(){
 const k=(window.devicePixelRatio||1)/Math.max(1,VIEW.scale),ml=260*k,mr=300*k,mt=120*k,mb=90*k;
 camera.x=VIEW.w>=WORLD.w+ml+mr?(WORLD.w-VIEW.w)/2:clamp(camera.x,-ml,WORLD.w-VIEW.w+mr);
 camera.y=VIEW.h>=WORLD.h+mt+mb?(WORLD.h-VIEW.h)/2:clamp(camera.y,-mt,WORLD.h-VIEW.h+mb);
}
// Skalowanie całkowite: piksel gry = `scale` pikseli ekranu. Zoom zmienia skalę (oddalenie = mniejsza skala).
function size(){
 const dpr=window.devicePixelRatio||1,W=innerWidth*dpr,H=innerHeight*dpr;
 const base=Math.max(1,Math.round(Math.min(H/360,W/560)));VIEW.maxZoom=Math.max(0,base-1);VIEW.zoom=clamp(VIEW.zoom,0,VIEW.maxZoom);
 const sc=base-VIEW.zoom,cx=camera.x+VIEW.w/2,cy=camera.y+VIEW.h/2;
 VIEW.scale=sc;VIEW.w=Math.ceil(W/sc);VIEW.h=Math.ceil(H/sc);
 C.width=VIEW.w;C.height=VIEW.h;C.style.width=VIEW.w*sc/dpr+'px';C.style.height=VIEW.h*sc/dpr+'px';
 ctx.imageSmoothingEnabled=false;camera.x=cx-VIEW.w/2;camera.y=cy-VIEW.h/2;clampCamera();
}
function zoom(d,at){
 const z=clamp(VIEW.zoom+d,0,VIEW.maxZoom);if(z===VIEW.zoom)return;
 const before=at?[at[0]-camera.x,at[1]-camera.y].map((v,i)=>v/(i?VIEW.h:VIEW.w)):null;
 VIEW.zoom=z;SETTINGS.zoom=z;size();
 if(at){camera.x=at[0]-before[0]*VIEW.w;camera.y=at[1]-before[1]*VIEW.h;clampCamera()}
}
addEventListener('resize',size);
let fpsT=0,fpsN=0;
function run(ts){
 RT.beat=performance.now();
 const frame=RT.last?Math.min((ts-RT.last)/1000,.1):0;RT.last=ts;RT.frame++;
 RT.acc+=frame;let n=0;while(RT.acc>=STEP&&n<4){safe('krok',step,STEP);RT.acc-=STEP;n++}if(n===4)RT.acc=0;
 safe('kamera',clampCamera);
 fpsT+=frame;fpsN++;if(fpsT>=.5){DEBUG.fps=Math.round(fpsN/fpsT);fpsT=0;fpsN=0}
 safe('rysowanie',drawWorld);safe('mapa',updateMap,frame);
 safe('panel',repositionInfo);RT.hudT+=frame;if(RT.hudT>=.15){RT.hudT=0;safe('interfejs',hud)}
 RT.saveT=(RT.saveT||0)+frame;if(RT.saveT>=30){RT.saveT=0;safe('zapis',saveGame)}
}
// Pętla klatek ma „generację”: po zawieszeniu uruchamiamy nową, a stara kończy się sama.
function startLoop(){
 const g=RT.gen=(RT.gen||0)+1;
 const tick=ts=>{if(g!==RT.gen)return;requestAnimationFrame(tick);run(ts)};
 RT.beat=performance.now();requestAnimationFrame(tick);
}
// Strażnik: wykrywa martwą pętlę klatek, „wiszące” okno (pauza bez okna) i stojący czas — i naprawia, co się da.
let lastEl=-1,stillN=0;
setInterval(()=>{
 if(!state.playing||document.hidden)return;
 const now=performance.now();
 if(now-RT.beat>2500){DIAG.stalls.push({t:Math.round(now/1000),what:'pętla klatek stała',where:RT.where});startLoop();toast('Wykryto zacięcie gry — wznowiono pętlę.')}
 // pauza z okna, którego nie ma na ekranie: zdejmujemy blokadę
 const winOpen=!$('#report').classList.contains('hidden')||!$('#base').classList.contains('hidden');
 if(state.modal&&!winOpen){DIAG.stalls.push({t:Math.round(now/1000),what:'blokada okna bez okna'});state.modal=false;state.panel=false;state.paused=false;toast('Gra była zablokowana bez okna — odblokowano.')}
 const pb=$('#pausebtn'),want=state.paused?'▶':'❚❚';if(pb.textContent!==want)pb.textContent=want;
 // czas stoi mimo braku pauzy
 if(active()&&!state.modal&&Math.abs(state.elapsed-lastEl)<1e-9){if(++stillN===5){DIAG.stalls.push({t:Math.round(now/1000),what:'czas gry stoi',frame:RT.frame,where:RT.where});console.warn('[Leśniczówka] czas gry stoi mimo braku pauzy',DIAG.stalls[DIAG.stalls.length-1])}}else stillN=0;
 lastEl=state.elapsed;
},1000);
window.__lasDiag=()=>({stalls:DIAG.stalls,slow:DIAG.slow,errors:[...ERR],frame:RT.frame,where:RT.where,elapsed:state.elapsed,paused:state.paused,modal:state.modal,trees:trees.length,vehicles:E.vehicles.length,people:E.people.length,animals:E.animals.length,tasks:J.crews.map(c=>c.tasks.length)});
// ── budowa świata ──
buildGround();generate();buildNavs();initEconomy();initFauna();initAmbony();spawnWildlife();initPatrol();initJobs();initBase();
ECO.seasonHooks.push(()=>{respawnWild();return null});   // widoczna zwierzyna według nowej liczebności
bindUI();bindInput(zoom);
VIEW.zoom=1;size();centerOn(720,520);clampCamera();
$('#speedbtn').addEventListener('click',()=>{const i=(RATES.indexOf(state.rate)+1)%RATES.length;state.rate=RATES[i];$('#speedbtn').textContent='Czas ×'+state.rate;toast('Czas płynie ×'+state.rate+'.')});
$('#pausebtn').addEventListener('click',()=>{if(!state.playing||state.modal)return;state.paused=!state.paused;$('#pausebtn').textContent=state.paused?'▶':'❚❚';toast(state.paused?'Pauza (P).':'Gra wznowiona.')});
$('#soundbtn').addEventListener('click',toggleSound);
$('#helpbtn').addEventListener('click',()=>$('#help').classList.toggle('hidden'));
$('#mapbtn').addEventListener('click',()=>toggleMap());
$('#help-close').addEventListener('click',()=>$('#help').classList.add('hidden'));
const begin=msg=>{state.playing=true;$('#overlay').classList.add('hidden');C.focus();if(state.mute)toggleSound();resumeSound();toast(msg)};
if(hasSave()){$('#continue').style.display='block';$('#start').textContent='NOWA GRA'}
$('#start').addEventListener('click',()=>{clearSave();begin('Witaj w leśnictwie! Przeciągnij mapę, kółko myszy przybliża. H — pomoc.')});
$('#continue').addEventListener('click',()=>{if(loadGame()){hud();begin('Wczytano zapis. Gra zapisuje się sama co 30 s.')}else{toast('Nie udało się wczytać zapisu.');$('#continue').style.display='none'}});
$('#newgame').addEventListener('click',()=>{clearSave();state.playing=false;location.reload()});
addEventListener('beforeunload',saveGame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveGame();if(state.playing&&!state.paused)$('#pausebtn').click()}});
document.title='Leśniczówka '+VERSION;
// Diagnostyka do testów
window.__las={dispatchCrew,AMB,startCrossing,dispatchPolice,buyCams,toggleBarriers,buyParking,spawnDump,MAIL,mail,HL,R,createPlot,orderPrep,orderPlant,dirtyAll,seasonGrow,cal,spawnIntruder,saveGame,loadGame,state,E,J,U,FA,BASE,ECO,buildNursery,buildGarage,hireDeputy,hireCrewB,orderTruck,trees,counts,camera,VIEW,centerOn,spawnRider,spawnSmoke,addTrash,dispatch,step:(s)=>{for(let i=0;i<Math.ceil(s*60);i++)sim(STEP)},simStep:(s,dt)=>{for(let i=0;i<Math.ceil(s/dt);i++)sim(dt)},zoom};
hud();startLoop();
