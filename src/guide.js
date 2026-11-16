// 1.0: samouczek (pierwsze kroki) i ustawienia gry — zapisywane w localStorage osobno od zapisu gry.
import {$,state,SETTINGS,toast} from './core.js';
import {toggleSound} from './sound.js';
const KEY='lesniczowka-set';
export const SET={tempo:1,tips:true,tut:true,volume:.8};
try{Object.assign(SET,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(SET))}catch(e){}};
const STEPS=[
 ['Cel gry','Prowadzisz małe leśnictwo. Patrz na budżet, stan lasu i ochronę terenu u góry. Nie ma przegranej ani pośpiechu. Czas możesz zatrzymać (P), przyspieszyć (T) albo przewinąć do rana („Do jutra”).'],
 ['Mapa i narzędzia','Przeciągnij mapę myszą, kółko przybliża. Narzędzia (1–4) są na dolnym pasku: podgląd, wycinka, sadzenie, odnowienie. Kliknięcie obiektu otwiera jego kartę. Esc lub ✕ zamyka okno.'],
 ['Pierwsza wycinka','Wybierz Wycinkę (2) i kliknij dojrzałe drzewa albo przeciągnij obszar. Potem E: ekipa ścina, ciągnik zwozi kłody do drogi. K sprowadza ciężarówkę, która płaci za drewno.'],
 ['Odnowienie','Po wycince zostają pniaki. Sadź narzędziem 3 (klik lub rzędy) albo zaznacz zrąb narzędziem 4: przygotowanie gleby, sadzenie, grodzenie przed zwierzyną.'],
 ['Zgłoszenia i faktury','Zgłoszenia (pożar, wysypisko, intruzi, kornik) pojawiają się po prawej. Q wysyła patrol. Wiadomości i faktury są w poczcie (C). Zapłać faktury w terminie.'],
 ['Leśniczówka (L)','Okno L zawiera kadry, budynki i sprzęt, finanse, zdrowie lasu, przyrodę i koło łowieckie. Pomoc: H. Ustawienia: ⚙.']
];
let step=0,wasPaused=false;
const open=el=>!$(el).classList.contains('hidden');
export function openTutor(){
 step=0;if(!open('#tutor')){wasPaused=state.paused;state.paused=true}$('#tutor').classList.remove('hidden');renderTutor();
}
export function closeTutor(){
 if(!open('#tutor'))return;$('#tutor').classList.add('hidden');state.paused=!!wasPaused;
 if(SET.tut){SET.tut=false;save()}
}
function renderTutor(){
 const [h,t]=STEPS[step],last=step===STEPS.length-1;
 $('#tutorcard').innerHTML=`<div class="whead"><div><div class="kicker">Pierwsze kroki · ${step+1} z ${STEPS.length}</div><h1>${h}</h1></div><button class="xbtn" data-x="tutor" title="Zamknij (Esc)" aria-label="Zamknij">✕</button></div>
 <p>${t}</p><div class="dots">${STEPS.map((_,i)=>`<i class="${i===step?'on':''}"></i>`).join('')}</div>
 <div class="wnav"><button class="sec" data-tn="skip">${last?'Zamknij':'Pomiń samouczek'}</button><span>${step?'<button data-tn="prev">Wstecz</button>':''}${last?'<button data-tn="done">Zaczynamy</button>':'<button data-tn="next">Dalej</button>'}</span></div>`;
}
export function toggleSettings(force){
 const el=$('#settings');const o=force??el.classList.contains('hidden');el.classList.toggle('hidden',!o);if(o)renderSettings();
}
function applySet(){$('#toolhint').style.display=SET.tips?'':'none';SETTINGS.volume=SET.volume;SETTINGS.hints=SET.tips}
function renderSettings(){
 const row=(a,b,btn)=>`<div class="rrow"><span>${a}</span><span>${btn}</span></div>`,tog=(k,v)=>`<button data-set="${k}">${v}</button>`;
 $('#settingscard').innerHTML=`<div class="whead"><div><div class="kicker">Leśnictwo Zielony Gaj</div><h1>Ustawienia</h1></div><button class="xbtn" data-x="settings" title="Zamknij (Esc)" aria-label="Zamknij">✕</button></div>
 <div class="rep">${row('Dźwięk','',tog('sound',state.mute?'wyłączony':'włączony'))}${row('Głośność','',tog('vol',Math.round(SET.volume*100)+'%'))}${row('Tempo na początku gry','',tog('tempo','×'+SET.tempo))}${row('Podpowiedzi przy narzędziach','',tog('tips',SET.tips?'włączone':'wyłączone'))}${row('Samouczek przy nowej grze','',tog('tut',SET.tut?'pokazuj':'nie pokazuj'))}</div>
 <p class="hint2">Ustawienia są zapamiętywane osobno od zapisu gry.</p>
 <div class="wnav"><button class="sec" data-set="tutor">Pokaż samouczek</button><button data-set="close">Gotowe</button></div>`;
}
export function initGuide(){
 applySet();
 $('#tutor').addEventListener('click',e=>{const b=e.target.closest('[data-tn]');if(!b)return;const k=b.dataset.tn;
  if(k==='next'&&step<STEPS.length-1){step++;renderTutor()}else if(k==='prev'&&step>0){step--;renderTutor()}else if(k==='skip'||k==='done')closeTutor()});
 $('#settings').addEventListener('click',e=>{const b=e.target.closest('[data-set]');if(!b)return;const k=b.dataset.set;
  if(k==='sound')toggleSound();else if(k==='vol')SET.volume=SET.volume>=1?.2:Math.round((SET.volume+.2)*10)/10;
  else if(k==='tempo')SET.tempo=SET.tempo%3+1;else if(k==='tips')SET.tips=!SET.tips;else if(k==='tut')SET.tut=!SET.tut;
  else if(k==='tutor'){toggleSettings(false);openTutor();return}else if(k==='close'){toggleSettings(false);return}
  save();applySet();renderSettings()});
 $('#setbtn').addEventListener('click',()=>toggleSettings());
}
export const startTempo=()=>{state.rate=SET.tempo;$('#speedbtn').textContent='Czas ×'+SET.tempo};
export const closeGuides=()=>{closeTutor();$('#settings').classList.add('hidden')};
