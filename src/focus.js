// 1.1: podświetlenia w świecie — nieodnowione pniaki (widoczne także pod koronami) i granice wybranego oddziału.
// Rysowane nad koronami (render.js, tuż przed edgeCover), więc nic ich nie zasłania.
import {$,state,camera,VIEW,toast} from './core.js';
import {oddzial} from './map.js';
import {ECO} from './economy.js';
import {oddBounds} from './oddcard.js';
import {plantAtStumps,J} from './jobs.js';

// state.showStumps: false | true (cały las) | numer oddziału
export const stumpList=()=>{const f=state.showStumps;if(!f)return [];return f===true?ECO.unrenList:ECO.unrenList.filter(t=>+oddzial(t.x,t.y)===+f)};
export function showStumps(v){state.showStumps=v;updateFocusBar();if(v)toast('Podświetlono nieodnowione pniaki. Podświetlenie wyłączysz klawiszem Esc albo przyciskiem „Wyłącz”.')}
export function drawFocus(ctx){
 const L=stumpList();
 if(L.length){
  const x0=camera.x-12,y0=camera.y-12,x1=camera.x+VIEW.w+12,y1=camera.y+VIEW.h+12,pulse=(Math.sin(state.elapsed*5)+1)/2;
  ctx.lineWidth=2;
  for(const t of L){
   if(t.x<x0||t.x>x1||t.y<y0||t.y>y1)continue;
   const r=7+pulse*3;
   ctx.strokeStyle='#14201a';ctx.beginPath();ctx.arc(t.x,t.y,r+1.5,0,6.28);ctx.stroke();
   const col=J.plants.some(p=>Math.hypot(p.x-t.x,p.y-t.y)<32)?'#9fe070':'#ffd25a';   // zielony: sadzonka już zaplanowana
   ctx.strokeStyle=col;ctx.beginPath();ctx.arc(t.x,t.y,r,0,6.28);ctx.stroke();
   ctx.fillStyle=col;ctx.fillRect(Math.round(t.x)-1,Math.round(t.y)-1,3,3);
  }
 }
 const id=state.oddFocus;
 if(id){
  const B=oddBounds(id),X0=Math.floor(camera.x),Y0=Math.floor(camera.y),X1=X0+VIEW.w+1,Y1=Y0+VIEW.h+1;
  ctx.fillStyle='rgba(10,18,14,.42)';
  ctx.fillRect(X0,Y0,X1-X0,Math.max(0,B.y0-Y0));ctx.fillRect(X0,B.y1,X1-X0,Math.max(0,Y1-B.y1));
  const ya=Math.max(Y0,B.y0),yb=Math.min(Y1,B.y1);
  ctx.fillRect(X0,ya,Math.max(0,B.x0-X0),yb-ya);ctx.fillRect(B.x1,ya,Math.max(0,X1-B.x1),yb-ya);
  ctx.lineWidth=3;ctx.strokeStyle='#14201a';ctx.strokeRect(B.x0+1.5,B.y0+1.5,B.x1-B.x0-3,B.y1-B.y0-3);
  ctx.lineWidth=1.5;ctx.strokeStyle='#f4d58a';ctx.setLineDash([10,6]);ctx.strokeRect(B.x0+1.5,B.y0+1.5,B.x1-B.x0-3,B.y1-B.y0-3);ctx.setLineDash([]);
 }
}
// pasek informacyjny pod górnym panelem, gdy włączone jest podświetlenie pniaków
export function updateFocusBar(){
 const el=$('#focusbar');if(!el)return;
 if(!state.showStumps){el.style.display='none';el.dataset.sig='';return}
 const n=stumpList().length,f=state.showStumps;
 if(!n&&state.playing&&ECO.parts){state.showStumps=false;toast('Wszystkie pniaki zostały odnowione.');el.style.display='none';return}
 const sig=n+'|'+f;if(el.dataset.sig===sig){el.style.display='block';return}el.dataset.sig=sig;
 el.innerHTML=`<div>Podświetlone: nieodnowione pniaki${f===true?'':' w oddz. '+f} <b>(${n})</b><br><span class="muted">żółte: do posadzenia, zielone: sadzonka zaplanowana</span></div><div class="fbb"><button data-fb="plant">Posadź przy wszystkich</button><button class="sec" data-fb="off">Wyłącz</button></div>`;
 el.style.display='block';
}
export function bindFocus(){
 $('#focusbar').addEventListener('click',e=>{const b=e.target.closest('[data-fb]');if(!b)return;
  if(b.dataset.fb==='off'){state.showStumps=false;updateFocusBar()}
  else{plantAtStumps(stumpList());updateFocusBar()}});
}
