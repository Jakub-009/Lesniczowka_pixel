// HUD w HTML (styl farmy): trzy wskaźniki, zegar i kalendarz, narzędzia, plan na sezon, zgłoszenia, karta wybranego obiektu.
import {$,state,cal,SEASONS,displayNumber,zl,SETTINGS,camera,VIEW,clamp,toast} from './core.js';
import {SP,STAND,STUMP,SAPLING_AGE,CUT_AGE,crownR,heightM,dbhCm,volume,counts,treesIn} from './forest.js';
import {STANDS,oddzial} from './map.js';
import {J,COST,pendingCount,toggleMark,dispatchCrew,orderTruck,togglePlant} from './jobs.js';
import {ECO} from './economy.js';
import {E} from './ents.js';
import {dispatch,openIncidents,P} from './incidents.js';
import {VSPEC,ASPEC} from './life/agents.js';

export function lat(n){n=Math.round(n);const d=n%10,dd=n%100;return n+(n===1?' rok':(d>=2&&d<=4&&!(dd>=12&&dd<=14))?' lata':' lat')}
const pct=v=>Math.round(v)+'%';
function barCol(v){return v>=70?'#8ec86a':v>=50?'#d8b665':'#e0704f'}
export function setTool(t){state.tool=t;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('on',b.dataset.tool===t);
 const msg={select:'Podgląd: kliknij drzewo, zwierzę, pojazd albo zgłoszenie.',mark:'Wycinka: klikaj drzewa (od '+CUT_AGE+' lat). Shift + przeciągnij = zaznacz obszar.',plant:'Sadzenie: klikaj miejsca na sadzonki (najlepiej przy pniakach).'}[t];
 $('#toolhint').textContent=msg;}
let incSig='',infoSig='',taskSig='';
export function hud(){
 const h=cal.hour(),hh=Math.floor(h),mm=Math.floor((h-hh)*60);
 $('#time').textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
 $('#date').textContent='Rok '+cal.year()+' · '+SEASONS[cal.season()]+' · dzień '+cal.dayOf();
 $('#money').textContent=Math.round(state.money).toLocaleString('pl-PL');$('#money').style.color=state.money<0?'#ff8a6a':'';
 $('#health').textContent=pct(state.health);$('#healthbar').style.width=clamp(state.health,0,100)+'%';$('#healthbar').style.background=barCol(state.health);
 $('#protect').textContent=pct(state.protect);$('#protectbar').style.width=clamp(state.protect,0,100)+'%';$('#protectbar').style.background=barCol(state.protect);
 const n=pendingCount();$('#crewn').textContent=n?'('+n+')':'';$('#crewbtn').classList.toggle('hot',n>0);
 $('#stackinfo').textContent=displayNumber(J.stack,1)+' m³';
 $('#crewstate').textContent={idle:'w bazie',driving:'w drodze',working:'pracuje',leaving:'wraca'}[J.crew.phase]+(J.crew.tasks.length+J.crew.cluster.length?' · zadań: '+(J.crew.tasks.length+J.crew.cluster.length):'');
 $('#skidstate').textContent={idle:'czeka',driving:'jedzie po drewno',winch:'zrywka',home:'wiezie drewno',unload:'rozładunek'}[J.skid.phase];
 $('#patrolstate').textContent={home:'w leśniczówce',boarding:'wyjeżdża',driving:'w drodze',onsite:'na miejscu',return:'wraca'}[P.phase];
 // plan na sezon
 const Pl=ECO.plan;if(Pl){const sig=[Pl.doneCut.toFixed(1),Pl.donePlant,Pl.doneHandle,Pl.rewarded,Pl.season].join();if(sig!==taskSig){taskSig=sig;
  const row=(ok,txt,a,b)=>`<div class="trow ${ok?'ok':''}"><span>${ok?'✔':'·'} ${txt}</span><b>${a} / ${b}</b></div>`;
  $('#tasks').innerHTML=row(Pl.doneCut>=Pl.cut,'Drewno na składnicę',displayNumber(Math.min(Pl.doneCut,Pl.cut),1),Pl.cut+' m³')+row(Pl.donePlant>=Pl.plant,'Posadzone sadzonki',Math.min(Pl.donePlant,Pl.plant),Pl.plant)+row(Pl.doneHandle>=Pl.handle,'Obsłużone zgłoszenia',Math.min(Pl.doneHandle,Pl.handle),Pl.handle)+
   `<div class="muted small">${Pl.rewarded?'Plan wykonany — premia wypłacona.':'Premia za wykonanie: '+zl(Pl.reward)}</div>`}}
 // zgłoszenia
 const open=openIncidents(),sig=open.map(q=>q.id+q.status).join('|');
 if(sig!==incSig){incSig=sig;
  $('#incidents').innerHTML=open.length?open.map(q=>`<div class="inc ${q.type}"><span class="go" data-go="${q.id}">${q.text}</span>${q.status==='new'?`<button data-inc="${q.id}">Wyślij patrol</button>`:`<i>${q.status==='queued'?'w kolejce':'patrol działa'}</i>`}</div>`).join(''):'<div class="muted">Spokojnie w lesie.</div>';
 }
 info();
}
function treeInfo(t){
 const st=STANDS[oddzial(t.x,t.y)],sp=SP[t.sp];
 if(t.st===STUMP){
  const ren=treesIn(t.x-30,t.y-30,t.x+30,t.y+30).some(q=>q.st===STAND&&q.age<SAPLING_AGE*3);
  return{title:t.burnt?'Spalony pniak':'Pniak — '+sp.name,lines:['Oddział '+st.name+' · '+st.desc,ren?'Odnowione: obok rośnie młode drzewko.':'Nieodnowione — zaplanuj sadzonkę obok (narzędzie 3).'],btns:ren?[]:[['plantnear','Zaplanuj sadzonkę obok']]};
 }
 if(t.age<SAPLING_AGE)return{title:'Sadzonka — '+sp.name,lines:['Oddział '+st.name+(t.uprawa?' · uprawa w grodzeniu':''),'Wiek: '+lat(t.age)+' · wys. ok. '+displayNumber(Math.max(.2,heightM(t)),1)+' m'],btns:[]};
 const lines=['Oddział '+st.name+' · '+st.desc,'Wiek: '+lat(t.age)+' · wysokość '+Math.round(heightM(t))+' m','Pierśnica '+Math.round(dbhCm(t))+' cm · miąższość '+displayNumber(volume(t),2)+' m³',
  'Wartość drewna ok. '+zl(volume(t)*sp.price)+' · koszt ścinki '+zl(COST.fell)];
 if(t.assigned)lines.push('Ekipa ma je na liście.');
 return{title:sp.name[0].toUpperCase()+sp.name.slice(1),lines,btns:t.assigned?[]:t.age<CUT_AGE?[]:[['mark',t.marked?'Usuń oznaczenie':'Wyznacz do wycinki']]};
}
function info(){
 const s=state.selected,el=$('#info');
 if(!s||s.dead||(s.status&&(s.status==='done'||s.status==='gone'))){if(state.selected&&(s.dead||s.status))state.selected=null;el.style.display='none';infoSig='';return}
 let I;
 if(s.st!==undefined)I=treeInfo(s);
 else if(s.text)I={title:s.type==='quad'?'Nielegalny wjazd':s.type==='fire'?'Dym nad lasem':'Śmieci w lesie',lines:[s.text,{new:'Czeka na decyzję.',queued:'W kolejce patrolu.',assigned:'Patrol w drodze.'}[s.status]||''],btns:s.status==='new'?[['patrol','Wyślij patrol']]:[]};
 else if(s.pos)I={title:VSPEC[s.kind].name[0].toUpperCase()+VSPEC[s.kind].name.slice(1),lines:[s.label||'',s.cart?'Ładunek: '+displayNumber(s.load,1)+' / '+s.cap+' m³':'',s.illegal?'Wjazd pojazdów silnikowych do lasu jest zabroniony.':''].filter(Boolean),btns:s.illegal&&s.inc&&s.inc.status==='new'?[['patrol','Wyślij patrol']]:[]};
 else if(s.kind&&ASPEC[s.kind])I={title:s.name||ASPEC[s.kind].name,lines:[{idle:'Odpoczywa / żeruje',walk:'Wędruje',run:'Ucieka!'}[s.state]||'',s.male&&s.kind==='deer'?'Byk z porożem':s.male&&s.kind==='roe'?'Rogacz':''].filter(Boolean),btns:[]};
 else if(s.look)I={title:s.label?s.label[0].toUpperCase()+s.label.slice(1):'Osoba',lines:[s.kind==='picker'?'Zbiera grzyby. Czasem zostawia śmieci…':s.kind==='worker'?'Pilarz z ekipy leśnej.':s.kind==='lesniczy'?'Prowadzi leśnictwo. Wyjeżdża na interwencje.':s.kind==='hunter'?'Poluje z ambony na skraju polany.':'Odpoczywa w lesie.'],btns:[]};
 else if(s.logs)I={title:'Kłody — '+SP[s.sp].name,lines:['Miąższość '+displayNumber(s.vol,2)+' m³',s.state==='ground'?'Czeka na zrywkę (ciągnik przyjedzie sam).':'Ciągnik już po nie jedzie.'],btns:[]};
 else if(s.isStack)I={title:'Składnica drewna',lines:['Na stosie: '+displayNumber(J.stack,1)+' m³','Wartość ok. '+zl(J.stackValue),'Sprzedano łącznie: '+displayNumber(J.sold,1)+' m³','Przy 16 m³ nadleśnictwo samo przyśle transport.'],btns:[['truck','Zamów wywóz teraz']]};
 if(!I){el.style.display='none';return}
 const sig=JSON.stringify(I);if(sig===infoSig)return;infoSig=sig;
 el.innerHTML=`<div class="kick">${I.title}</div>`+I.lines.map(l=>`<div class="ln">${l}</div>`).join('')+(I.btns.length?`<div class="ibtns">${I.btns.map(([k,t])=>`<button data-ia="${k}">${t}</button>`).join('')}</div>`:'')+(s.pos||s.look||(s.kind&&ASPEC[s.kind])?`<div class="muted small">F — kamera śledzi</div>`:'');
 el.style.display='block';
}
export function centerOn(x,y){camera.x=x-VIEW.w/2;camera.y=y-VIEW.h/2}
export function bindUI(){
 for(const b of document.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>setTool(b.dataset.tool));
 $('#crewbtn').addEventListener('click',dispatchCrew);$('#sellbtn').addEventListener('click',()=>orderTruck(true));
 $('#incidents').addEventListener('click',e=>{
  const b=e.target.closest('[data-inc]');if(b){const q=E.incidents.find(x=>x.id==b.dataset.inc);dispatch(q);incSig='';hud();return}
  const g=e.target.closest('[data-go]');if(g){const q=E.incidents.find(x=>x.id==g.dataset.go);if(q){centerOn(q.x,q.y);state.selected=q;state.follow=null}}
 });
 $('#info').addEventListener('click',e=>{
  const b=e.target.closest('[data-ia]');if(!b)return;const s=state.selected,k=b.dataset.ia;
  if(k==='mark'){toggleMark(s)}
  else if(k==='patrol'){dispatch(s.text?s:s.inc)}
  else if(k==='truck')orderTruck(true);
  else if(k==='plantnear'){for(let a=0;a<12;a++){const x=s.x+Math.cos(a)*12,y=s.y+Math.sin(a)*12;const n=J.plants.length;togglePlant(x,y);if(J.plants.length>n)break}}
  infoSig='';hud();
 });
 setTool('select');
}
