// Mysz i klawiatura: przeciąganie mapy, kółko = zoom (całkowite skale, ostre piksele), kliknięcie = wybór lub polecenie narzędzia.
import {C,$,keys,state,camera,VIEW,SETTINGS,DEBUG,toast,active} from './core.js';
import {treeAt,STAND,STUMP,CUT_AGE,treesIn,testGrow} from './forest.js';
import {HOUSE,inRect} from './map.js';
import {E} from './ents.js';
import {J,toggleMark,togglePlant,dispatchCrew,orderTruck} from './jobs.js';
import {plotAt,createPlot,planAreaPlants} from './renew.js';
import {setTool,hud,toggleBase} from './ui.js';
import {feederAt} from './life/fauna.js';
import {opalPileAt} from './base.js';
import {toggleSound,resumeSound} from './sound.js';
import {dispatch} from './incidents.js';

export function toWorld(e){const r=C.getBoundingClientRect();return[camera.x+(e.clientX-r.left)*VIEW.w/r.width,camera.y+(e.clientY-r.top)*VIEW.h/r.height]}
export function pick(x,y){
 for(const q of E.incidents)if(q.status!=='done'&&q.status!=='gone'&&Math.hypot(q.x-x,q.y-18-y)<10)return q;
 let best=null,bd=1e9;
 const test=(o,px,py,r)=>{const d=Math.hypot(px-x,py-y);if(d<r&&d<bd){bd=d;best=o}};
 for(const p of E.people)if(!p.hidden)test(p,p.x,p.y,9);
 for(const a of E.animals)test(a,a.x,a.y,11);
 for(const v of E.vehicles)test(v,v.pos[0],v.pos[1],v.spec.hh*.9);
 for(const p of E.piles)if(!p.dead)test(p,p.x,p.y,14);
 for(const st of J.stacks)if(st.vol>.05)test(st,st.x,st.y,22);
 if(best)return best;
 const f=feederAt(x,y);if(f)return f;
 const o=opalPileAt(x,y);if(o)return o;
 if(inRect(x,y,HOUSE,2))return{isHouse:true,x:HOUSE.x+HOUSE.w/2,y:HOUSE.y+HOUSE.h/2};
 return treeAt(x,y)||plotAt(x,y);
}
let down=null;
export function bindInput(zoomFn){
 C.addEventListener('contextmenu',e=>e.preventDefault());
 // w narzędziach wycinki, sadzenia i odnowienia lewy przycisk zaznacza obszar; mapę przesuwa prawy (albo lewy w podglądzie)
 C.addEventListener('pointerdown',e=>{C.focus();resumeSound();down={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,btn:e.button,drag:false,box:e.button===0&&state.tool!=='select',w:toWorld(e)};C.setPointerCapture(e.pointerId)});
 C.addEventListener('pointermove',e=>{
  if(down){const dx=e.clientX-down.x,dy=e.clientY-down.y;if(!down.drag&&Math.hypot(dx,dy)>5)down.drag=true;
   if(down.drag){if(down.box){state.box=[down.w,toWorld(e)]}else{const r=C.getBoundingClientRect();camera.x=down.cx-dx*VIEW.w/r.width;camera.y=down.cy-dy*VIEW.h/r.height;state.follow=null}}return}
  const [x,y]=toWorld(e);
  if(state.tool==='mark')state.hover=treeAt(x,y,t=>t.st===STAND);
  else if(state.tool==='plant'){state.hover={x,y,plant:true}}
  else{const p=pick(x,y);state.hover=p&&p.st!==undefined?p:null}
 });
 C.addEventListener('pointerup',e=>{
  if(!down)return;const d=down;down=null;
  if(d.box&&d.drag&&state.box){const [[x0,y0],[x1,y1]]=state.box;state.box=null;
   if(state.tool==='mark'){let n=0;
    for(const t of treesIn(Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1)))if(t.st===STAND&&!t.falling&&!t.lying&&!t.assigned&&t.age>=CUT_AGE&&!t.marked){t.marked=true;n++}
    toast(n?'Wyznaczono '+n+' drzew do wycinki. E — wyślij ekipę.':'W zaznaczeniu nie ma drzew do wycinki (od '+CUT_AGE+' lat).')}
   else if(state.tool==='plant'){const n=planAreaPlants(x0,y0,x1,y1);toast(n?'Zaplanowano '+n+' sadzonek w rzędach. E — wyślij ekipę.':'Brak wolnych miejsc na sadzonki.')}
   else if(state.tool==='plot'){const p=createPlot(x0,y0,x1,y1);if(p)state.selected=p}
   hud();return}
  if(d.drag)return;
  if(d.btn===2){setTool('select');state.selected=null;return}
  if(!active())return;
  const [x,y]=toWorld(e);
  if(state.tool==='mark'){const t=treeAt(x,y,t=>t.st===STAND);if(t){toggleMark(t);state.selected=t}else toast('Kliknij koronę drzewa.')}
  else if(state.tool==='plant')togglePlant(x,y);
  else if(state.tool==='plot'){const p=plotAt(x,y);if(p)state.selected=p;else toast('Przeciągnij, aby wyznaczyć powierzchnię odnowieniową.')}
  else{const p=pick(x,y);if(p&&p.isHouse){toggleBase(true);return}state.selected=p;state.follow=null}
  hud();
 });
 C.addEventListener('wheel',e=>{e.preventDefault();zoomFn(e.deltaY>0?1:-1,toWorld(e))},{passive:false});
 addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','f1','f3'].includes(k))e.preventDefault();
  if(!state.playing){if(k==='enter')$('#start').click();return}
  if(state.modal){if(state.panel){if(k==='escape'||k==='l')toggleBase(false)}else if(k==='enter'||k===' '||k==='escape')$('#report-close')?.click();return}
  if(e.repeat&&!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))return;
  if(k==='1')setTool('select');else if(k==='2')setTool('mark');else if(k==='3')setTool('plant');else if(k==='4')setTool('plot');
  else if(k==='l')toggleBase(true);
  else if(k==='e')dispatchCrew();else if(k==='k')orderTruck(true);
  else if(k==='q'){const q=E.incidents.find(x=>x.status==='new');if(q)dispatch(q);else toast('Brak nowych zgłoszeń.')}
  else if(k==='f'){const s=state.selected;state.follow=s&&(s.pos||s.look||s.phase!=null||s.kind)&&s.st===undefined?s:null;if(!state.follow)toast('Wybierz pojazd, osobę albo zwierzę.')}
  else if(k==='t')$('#speedbtn').click();else if(k==='p')$('#pausebtn').click();else if(k==='m')toggleSound();
  else if(k==='g'){testGrow(10);toast('Las urósł o 10 lat (test).')}
  else if(k==='n'){state.noFF=!state.noFF;toast(state.noFF?'Noc płynie normalnie (N).':'Noc przewija się sama (N).')}
  else if(k==='f3')DEBUG.on=!DEBUG.on;
  else if(k==='f1'||k==='h')$('#help').classList.toggle('hidden');
  else if(k==='escape'){setTool('select');state.selected=null;state.follow=null;$('#help').classList.add('hidden')}
  else if(k==='z')zoomFn(e.shiftKey?-1:1);else if(k==='+'||k==='=')zoomFn(-1);else if(k==='-')zoomFn(1);
  keys.add(k);hud();
 });
 addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
 addEventListener('blur',()=>keys.clear());
}
