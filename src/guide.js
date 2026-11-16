// 1.0: samouczek (pierwsze kroki) i ustawienia gry — zapisywane w localStorage osobno od zapisu gry.
import {$,state,SETTINGS,toast} from './core.js';
import {toggleSound} from './sound.js';
const KEY='lesniczowka-set';
export const SET={tempo:1,tips:true,tut:true,volume:.8};
try{Object.assign(SET,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(SET))}catch(e){}};
const STEPS=[
 ['Cel i rytm gry','Prowadzisz niewielkie leśnictwo. Patrzysz na trzy liczby u góry: <b>budżet</b>, <b>stan lasu</b> i <b>ochronę terenu</b>. Nie ma tu przegranej ani pośpiechu — gra jest spokojną piaskownicą. Czas płynie sam, możesz go zatrzymać (P), przyspieszyć (T, ×1–×3) albo przewinąć do rana („Do jutra”).'],
 ['Mapa i narzędzia','Przeciągnij mapę myszą (albo prawym przyciskiem), kółko myszy przybliża. Klawisze <b>1–4</b> to narzędzia: podgląd, wycinka, sadzenie, odnowienie. Kliknięcie drzewa, zwierzęcia, pojazdu, zgłoszenia lub budynku pokazuje jego kartę z przyciskami akcji. <b>Esc</b> albo ✕ zamyka każde okno.'],
 ['Pierwsza wycinka','Wybierz <b>2 — Wycinka</b> i kliknij dojrzałe drzewa (albo przeciągnij obszar). Potem <b>E — Wyślij ekipę</b>: pilarze ścinają i tną na kłody, ciągnik zwozi je do drogi, a <b>K — Wywóz drewna</b> sprowadza ciężarówkę, która płaci za drewno. Drzewa wadliwe znajdziesz zlecając „Ocenę drzewostanu” na karcie drzewa.'],
 ['Odnowienie lasu','Po wycince zostają pniaki. Posadź młode drzewa: narzędzie <b>3</b> (klik lub przeciągnięcie = rzędy) albo <b>4</b> na większym zrębie (przygotowanie gleby, sadzenie w rzędach, grodzenie przed zwierzyną). Bez odnowienia stan lasu spada.'],
 ['Zgłoszenia, poczta i faktury','Po prawej pojawiają się <b>zgłoszenia</b> (pożar, wysypisko, intruzi, kornik) — <b>Q</b> wysyła patrol. Ważne wiadomości trafiają do poczty (<b>C</b>). Praca ekip rozlicza się fakturami: zapłać je w poczcie albo w oknie Leśniczówki — nie zostawiaj ich na długo.'],
 ['Leśniczówka (L)','Okno <b>L</b> to Twoja baza: kadry i kancelaria, budynki i sprzęt, finanse (pożyczka, płacenie automatyczne), zdrowie lasu, ochrona przyrody oraz koło łowieckie. Wszystko jest podzielone na zakładki; „ⓘ Jak to działa” rozwija wyjaśnienia. Pomoc znajdziesz pod <b>?</b> (H), ustawienia pod <b>⚙</b>.']
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
 <p class="hint2">Ustawienia zapisują się osobno od zapisu gry (nie znikają po „Nowej grze”). Gra sama zapisuje się co 30 s.</p>
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
