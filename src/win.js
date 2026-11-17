// 1.1: wspólna ramka dużych okien (Poczta, Mapa, Stan lasu, Ochrona terenu). Jedno okno naraz, gra stoi, jedno zamykanie (✕, Esc, klik w tło).
// Leśniczówka (L) ma własny, starszy mechanizm (state.panel) i działa obok.
import {$,state} from './core.js';
const W={};let cur=null,sig='';
export const registerWin=(id,o)=>{W[id]=o};
export const winCurrent=()=>cur;
export function openWin(id,arg){
 const w=W[id];if(!w||(state.modal&&!cur))return false;
 if(!cur){state.wasPaused=state.paused;state.modal=true;state.paused=true}
 else if(cur!==id&&W[cur].close)W[cur].close();
 cur=id;state.win=id;sig='';
 if(w.open)w.open(arg);
 $('#wincard').className='card '+(w.cls||'wide');$('#win').classList.remove('hidden');
 renderWin(true);return true;
}
export function closeWin(){
 if(!cur)return;const w=W[cur];cur=null;state.win=null;
 $('#win').classList.add('hidden');$('#wincard').innerHTML='';state.modal=false;state.paused=!!state.wasPaused;
 if(w.close)w.close();
}
export const toggleWin=(id,arg)=>cur===id?closeWin():openWin(id,arg);
// render() zwraca HTML (porównywany z poprzednim, żeby nie przebudowywać bez potrzeby); after(el) podpina elementy stanowe; tick(el) odświeża je co klatkę interfejsu
export function renderWin(force){
 if(!cur)return;const w=W[cur],el=$('#wincard');
 const html=w.render();
 if(force||html!==sig){const top=el.scrollTop;sig=html;el.innerHTML=html;el.scrollTop=top;if(w.after)w.after(el)}
 if(w.tick)w.tick(el);
}
// klik w element z data-win otwiera okno; data-wa przekazuje akcję do okna
export function bindWin(){
 document.addEventListener('click',e=>{
  const o=e.target.closest('[data-win]');if(o&&state.playing){toggleWin(o.dataset.win);return}
  const a=e.target.closest('#wincard [data-wa]');if(a&&cur&&W[cur].act){W[cur].act(a.dataset.wa,a.dataset,e);renderWin(true)}
 });
}
