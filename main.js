// Punkt wejścia: budowa świata, stały krok symulacji (60 Hz, przy przyspieszeniu kilka kroków na klatkę), kamera, zoom, pętla.
import {C,ctx,VIEW,WORLD,$,clamp,keys,state,camera,RT,fx,DEBUG,DAY_S,SETTINGS,toast,active,VERSION,cal} from './core.js';
import {buildGround,fadeMarks} from './paint.js';
import {generate,updateFalls,trees,counts,dirtyAll,seasonGrow} from './forest.js';
import {buildNavs,E,prune} from './ents.js';
import {spawnWildlife,updateVisitors,groups} from './life/populate.js';
import {initPatrol,updateIncidents,U,spawnRider,spawnSmoke,spawnIntruder,addTrash,dispatch,hirePod} from './incidents.js';
import {initFauna,updateFauna,FA} from './life/fauna.js';
import {initBase,updateBase,BASE,buildNursery,buildGarage,hireDeputy} from './base.js';
import {initJobs,updateJobs,J,orderTruck,hireCrewB} from './jobs.js';
import {updateRenew,R,createPlot,orderPrep,orderPlant} from './renew.js';
import {initEconomy,updateEconomy,ECO} from './economy.js';
import {spawnWildlife as respawnWild} from './life/populate.js';
import {drawWorld} from './render.js';
import {hud,bindUI,centerOn} from './ui.js';
import {bindInput} from './input.js';
import {updateSound,toggleSound,resumeSound} from './sound.js';
import {hasSave,clearSave,saveGame,loadGame} from './save.js';

const STEP=1/60,RATES=[1,3,10],NIGHT_FF=8;
const falling=()=>trees.filter(t=>t.falling);
function sim(dt){
 state.elapsed+=dt;const d0=Math.floor(state.days);state.days+=dt/DAY_S;if(Math.floor(state.days)!==d0)fadeMarks(.12);
 updateFalls(dt,falling());
 for(const g of groups)g.update(dt);
 for(const a of E.animals)a.update(dt);
 for(const p of E.people)p.update(dt);
 for(const v of E.vehicles)v.update(dt);
 updateVisitors(dt);updateIncidents(dt);updateJobs(dt);updateRenew(dt);updateFauna(dt);updateBase(dt);updateEconomy(dt);
 for(let i=fx.length-1;i>=0;i--){const p=fx[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)fx.splice(i,1)}
 prune();
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
function clampCamera(){
 camera.x=VIEW.w>=WORLD.w?(WORLD.w-VIEW.w)/2:clamp(camera.x,0,WORLD.w-VIEW.w);
 camera.y=VIEW.h>=WORLD.h?(WORLD.h-VIEW.h)/2:clamp(camera.y,0,WORLD.h-VIEW.h);
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
 const frame=RT.last?Math.min((ts-RT.last)/1000,.1):0;RT.last=ts;RT.frame++;
 RT.acc+=frame;let n=0;while(RT.acc>=STEP&&n<4){step(STEP);RT.acc-=STEP;n++}if(n===4)RT.acc=0;
 clampCamera();
 fpsT+=frame;fpsN++;if(fpsT>=.5){DEBUG.fps=Math.round(fpsN/fpsT);fpsT=0;fpsN=0}
 drawWorld();
 RT.hudT+=frame;if(RT.hudT>=.15){RT.hudT=0;hud()}
 RT.saveT=(RT.saveT||0)+frame;if(RT.saveT>=30){RT.saveT=0;saveGame()}
 requestAnimationFrame(run);
}
// ── budowa świata ──
buildGround();generate();buildNavs();initEconomy();initFauna();spawnWildlife();initPatrol();initJobs();initBase();
ECO.seasonHooks.push(()=>{respawnWild();return null});   // widoczna zwierzyna według nowej liczebności
bindUI();bindInput(zoom);
VIEW.zoom=1;size();centerOn(720,520);clampCamera();
$('#speedbtn').addEventListener('click',()=>{const i=(RATES.indexOf(state.rate)+1)%RATES.length;state.rate=RATES[i];$('#speedbtn').textContent='Czas ×'+state.rate;toast('Czas płynie ×'+state.rate+'.')});
$('#pausebtn').addEventListener('click',()=>{if(!state.playing||state.modal)return;state.paused=!state.paused;$('#pausebtn').textContent=state.paused?'▶':'❚❚';toast(state.paused?'Pauza (P).':'Gra wznowiona.')});
$('#soundbtn').addEventListener('click',toggleSound);
$('#helpbtn').addEventListener('click',()=>$('#help').classList.toggle('hidden'));
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
window.__las={R,createPlot,orderPrep,orderPlant,dirtyAll,seasonGrow,cal,spawnIntruder,saveGame,loadGame,state,E,J,U,FA,BASE,ECO,buildNursery,buildGarage,hireDeputy,hireCrewB,orderTruck,trees,counts,camera,VIEW,centerOn,spawnRider,spawnSmoke,addTrash,dispatch,step:(s)=>{for(let i=0;i<Math.ceil(s*60);i++)sim(STEP)},zoom};
hud();requestAnimationFrame(run);
