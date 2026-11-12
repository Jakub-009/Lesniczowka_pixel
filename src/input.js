// Mysz i klawiatura: przeciąganie mapy, kółko = zoom (całkowite skale, ostre piksele), kliknięcie = wybór lub polecenie narzędzia.
import {C,$,keys,state,camera,VIEW,SETTINGS,DEBUG,toast,active} from './core.js';
import {treeAt,STAND,STUMP,CUT_AGE,treesIn,testGrow} from './forest.js';
import {HOUSE,inRect} from './map.js';
import {E} from './ents.js';
import {J,toggleMark,togglePlant,dispatchCrew,orderTruck} from './jobs.js';
import {plotAt,createPlot,createPolyPlot,planAreaPlants} from './renew.js';
import {setTool,hud,toggleBase} from './ui.js';
import {toggleMap,mapOpen} from './mapview.js';
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
// 0.6.3: cofanie ostatnich zaznaczeń obszarem (Ctrl+Z)
const UNDO=[];
function undo(){
 const u=UNDO.pop();if(!u){toast('Nie ma czego cofnąć.');return}
 if(u.type==='mark'){let n=0;for(const t of u.list)if(t.marked&&!t.assigned){t.marked=false;n++}toast('Cofnięto oznaczenie '+n+' drzew.')}
 else if(u.type==='unmark'){let n=0;for(const t of u.list)if(!t.marked&&!t.assigned&&t.st===STAND){t.marked=true;n++}toast('Przywrócono oznaczenie '+n+' drzew.')}
 else if(u.type==='plant'){const set=new Set(u.list.filter(p=>!p.assigned));J.plants=J.plants.filter(p=>!set.has(p));toast('Cofnięto plan '+set.size+' sadzonek.')}
 hud();
}
function finishPoly(){const P=state.poly;state.poly=null;if(!P)return;const p=createPolyPlot(P);if(p)state.selected=p;hud()}
export function bindInput(zoomFn){
 C.addEventListener('contextmenu',e=>e.preventDefault());
 // w narzędziach wycinki, sadzenia i odnowienia lewy przycisk zaznacza obszar; mapę przesuwa prawy (albo lewy w podglądzie)
 C.addEventListener('pointerdown',e=>{C.focus();resumeSound();down={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,btn:e.button,drag:false,box:e.button===0&&state.tool!=='select',shift:e.shiftKey,w:toWorld(e)};C.setPointerCapture(e.pointerId)});
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
   const area=treesIn(Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1));
   if(state.tool==='mark'&&d.shift){const list=[];   // Shift + przeciągnięcie: odznaczenie obszaru
    for(const t of area)if(t.marked&&!t.assigned){t.marked=false;list.push(t)}
    if(list.length)UNDO.push({type:'unmark',list});toast(list.length?'Usunięto oznaczenie '+list.length+' drzew. Ctrl+Z — cofnij.':'W zaznaczeniu nie było oznaczonych drzew.')}
   else if(state.tool==='mark'){const list=[];
    for(const t of area)if(t.st===STAND&&!t.falling&&!t.lying&&!t.assigned&&t.age>=CUT_AGE&&!t.marked){t.marked=true;list.push(t)}
    if(list.length)UNDO.push({type:'mark',list});
    toast(list.length?'Wyznaczono '+list.length+' drzew do wycinki. E — wyślij ekipę. Ctrl+Z — cofnij, Shift + przeciągnięcie — odznacz.':'W zaznaczeniu nie ma drzew do wycinki (od '+CUT_AGE+' lat).')}
   else if(state.tool==='plant'){const before=J.plants.length,n=planAreaPlants(x0,y0,x1,y1);if(n)UNDO.push({type:'plant',list:J.plants.slice(before)});toast(n?'Zaplanowano '+n+' sadzonek w rzędach. E — wyślij ekipę. Ctrl+Z — cofnij.':'Brak wolnych miejsc na sadzonki.')}
   else if(state.tool==='plot'){if(!state.poly){const p=createPlot(x0,y0,x1,y1);if(p)state.selected=p}}
   hud();return}
  if(d.drag)return;
  if(d.btn===2){state.poly=null;setTool('select');state.selected=null;return}
  if(!active())return;
  const [x,y]=toWorld(e);
  if(state.tool==='mark'){const t=treeAt(x,y,t=>t.st===STAND);if(t){toggleMark(t);state.selected=t}else toast('Kliknij koronę drzewa.')}
  else if(state.tool==='plant')togglePlant(x,y);
  else if(state.tool==='plot'){
   if(state.poly){const P=state.poly;if(P.length>=3&&Math.hypot(x-P[0][0],y-P[0][1])<16)finishPoly();else P.push([x,y])}
   else{const p=plotAt(x,y);if(p)state.selected=p;else{state.poly=[[x,y]];toast('Wielokąt: klikaj kolejne narożniki. Enter albo klik w pierwszy punkt kończy, Esc anuluje. (Prostokąt: przeciągnij.)')}}}
  else{const p=pick(x,y);if(p&&p.isHouse){toggleBase(true);return}state.selected=p;state.follow=null}
  hud();
 });
 C.addEventListener('wheel',e=>{e.preventDefault();zoomFn(e.deltaY>0?1:-1,toWorld(e))},{passive:false});
 addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(state.poly&&state.playing){if(k==='enter'){e.preventDefault();finishPoly();return}if(k==='escape'){state.poly=null;toast('Wielokąt anulowany.');return}}
  if((e.ctrlKey||e.metaKey)&&k==='z'&&state.playing&&!state.modal){e.preventDefault();undo();return}
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','f1','f3','tab'].includes(k))e.preventDefault();
  if(!state.playing){if(k==='enter')$('#start').click();return}
  if(mapOpen()&&(k==='tab'||k==='escape')){toggleMap(false);return}
  if(state.modal){if(state.panel){if(k==='escape'||k==='l')toggleBase(false)}else if(k==='enter'||k===' '||k==='escape')$('#report-close')?.click();return}
  if(e.repeat&&!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))return;
  if(k==='1')setTool('select');else if(k==='2')setTool('mark');else if(k==='3')setTool('plant');else if(k==='4')setTool('plot');
  else if(k==='l')toggleBase(true);
  else if(k==='tab')toggleMap(true);
  else if(k==='u'){document.body.classList.toggle('noui');toast(document.body.classList.contains('noui')?'Interfejs schowany (U — pokaż).':'Interfejs widoczny.')}
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
