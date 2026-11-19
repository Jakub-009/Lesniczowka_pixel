// 1.0: samouczek (pierwsze kroki) i ustawienia gry — zapisywane w localStorage osobno od zapisu gry.
import {$,state,SETTINGS,toast} from './core.js';
import {toggleSound} from './sound.js';
const KEY='lesniczowka-set';
export const SET={tempo:1,tips:true,tut:true,volume:.8};
try{Object.assign(SET,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(SET))}catch(e){}};
const STEPS=[
 ['Cel gry','Prowadzisz małe leśnictwo. U góry ekranu widzisz budżet, stan lasu i ochronę terenu — kliknij dowolny pasek, aby sprawdzić, z czego się składa. W tej grze nie można przegrać i nic nie wymaga pośpiechu. Czas możesz zatrzymać (P), przyspieszyć (T) albo przewinąć do rana przyciskiem „Do jutra”.'],
 ['Mapa i narzędzia','Mapę przesuwasz, przeciągając ją myszą, a kółkiem myszy ją przybliżasz. Na dolnym pasku znajdują się cztery narzędzia (klawisze 1–4): podgląd, wycinka, sadzenie i odnowienie. Kliknięcie obiektu otwiera jego kartę, a Esc lub ✕ zamyka okno.'],
 ['Pierwsza wycinka','Wybierz narzędzie Wycinka (2) i kliknij dojrzałe drzewa albo przeciągnij myszą obszar. Następnie naciśnij E: ekipa cięcia zetnie drzewa, a ciągnik zrywkowy zwiezie kłody do drogi. Ciężarówka leśna (BDF) przyjeżdża po drewno automatycznie od 5 m³, a ciężarówka do przewozu dłużycy — od 20 m³. Za odebrane drewno otrzymujesz zapłatę.'],
 ['Odnowienie','Po wycince zostają pniaki, które trzeba odnowić. Pojedyncze sadzonki albo całe rzędy sadzisz narzędziem 3 — gatunek wybierasz nad dolnym paskiem. Większy zrąb zaznacz narzędziem 4 jako powierzchnię odnowieniową: możesz na niej przygotować glebę, posadzić sadzonki i ogrodzić je przed zwierzyną. Sadzeniem zajmuje się ekipa sadzenia w zielonych kamizelkach.'],
 ['Zgłoszenia i faktury','Zgłoszenia, takie jak pożar, wysypisko, intruzi czy kornik, pojawiają się po prawej stronie ekranu, a klawisz Q wysyła do nich patrol. Wiadomości trafiają do poczty (C). Faktury opłacasz w Leśniczówce (L, zakładka Finanse) — pamiętaj o terminach.'],
 ['Leśniczówka (L)','Okno Leśniczówki (L) ma pięć zakładek: Kadry i sprzęt, Finanse, Las, Ochrona terenu oraz Przyroda i łowy. Ustawienia i pomoc otworzysz przyciskiem Menu, a sama pomoc jest też pod klawiszem H.']
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
 <div class="wnav"><span><button class="sec" data-set="tutor">Samouczek</button><button class="sec" data-set="help">Pomoc (H)</button></span><button data-set="close">Gotowe</button></div>`;
}
export function initGuide(){
 applySet();
 $('#tutor').addEventListener('click',e=>{const b=e.target.closest('[data-tn]');if(!b)return;const k=b.dataset.tn;
  if(k==='next'&&step<STEPS.length-1){step++;renderTutor()}else if(k==='prev'&&step>0){step--;renderTutor()}else if(k==='skip'||k==='done')closeTutor()});
 $('#settings').addEventListener('click',e=>{const b=e.target.closest('[data-set]');if(!b)return;const k=b.dataset.set;
  if(k==='sound')toggleSound();else if(k==='vol')SET.volume=SET.volume>=1?.2:Math.round((SET.volume+.2)*10)/10;
  else if(k==='tempo')SET.tempo=SET.tempo%3+1;else if(k==='tips')SET.tips=!SET.tips;else if(k==='tut')SET.tut=!SET.tut;
  else if(k==='tutor'){toggleSettings(false);openTutor();return}else if(k==='help'){toggleSettings(false);$('#help').classList.remove('hidden');return}else if(k==='close'){toggleSettings(false);return}
  save();applySet();renderSettings()});
 $('#menubtn').addEventListener('click',()=>{if(state.playing&&!state.modal)toggleSettings()});
}
export const startTempo=()=>{state.rate=SET.tempo};
export const closeGuides=()=>{closeTutor();$('#settings').classList.add('hidden')};
