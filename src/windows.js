// 1.1: okna informacyjne na wspólnej ramce (win.js): Poczta, Stan lasu, Ochrona terenu.
import {state,SEASONS,SEASON_DAYS,displayNumber,zl} from './core.js';
import {registerWin,closeWin} from './win.js';
import {MAIL,prio} from './mail.js';
import {FIN,ECO,owedCount,owedTotal,dunning,incPenalty,HL_BASE,YOUNG_MAX,YOUNG_FULL,UNREN_CAP,UNREN_EACH} from './economy.js';
import {E} from './ents.js';
import {openIncidents,dispatch} from './incidents.js';
import {plantAtStumps} from './jobs.js';
import {showStumps} from './focus.js';
import {centerOn,openBaseTab,incLabel,incWait} from './ui.js';
import {COSTS as OC} from './order.js';

const tile=(a,b,c)=>`<div class="tile ${c||''}"><span>${a}</span><b>${b}</b></div>`;
const head=(kick,h,id)=>`<div class="whead"><div><div class="kicker">${kick}</div><h1>${h}</h1></div><button class="xbtn" data-x="win" title="Zamknij (Esc)" aria-label="Zamknij">✕</button></div>`;
const foot=`<div class="wfoot"><button class="wclose" data-x="win">ZAMKNIJ (Esc)</button></div>`;
const sgn=(v,d=1)=>(v>=0?'+':'−')+displayNumber(Math.abs(v),d);
const hm=d=>{const h=(d%1)*24,hh=Math.floor(h);return String(hh).padStart(2,'0')+':'+String(Math.floor((h-hh)*60)).padStart(2,'0')};
const dayLabel=d=>{d=Math.floor(d);return 'Rok '+(Math.floor(d/(4*SEASON_DAYS))+1)+' · '+SEASONS[Math.floor(d/SEASON_DAYS)%4]+' · dzień '+(d%SEASON_DAYS+1)};
const ago=d=>{const n=Math.floor(state.days)-Math.floor(d);return n<=0?'dziś':n===1?'wczoraj':n+' dni temu'};

// ── Poczta ──
// 1.3.0: trzy zakładki — faktury płaci się w Finansach (kafelek powyżej), plan sezonu jest pod przyciskiem „Plan sezonu”; ich listy zostają we „Wszystkie”
const GROUP={nature:'prz',wolf:'prz'};   // reszta (poza „Wszystkie”): zdarzenia
const NOEV=new Set(['invoice','money','plan','assess']);
const grp=m=>GROUP[m.kind]||(NOEV.has(m.kind)?'':'zd');
const KIND={dump:['■','#b08a5a'],fire:['■','#e0482f'],quad:['■','#e8a32e'],intruder:['■','#e8a32e'],trash:['■','#c9b02a'],beetle:['■','#c9764a'],storm:['■','#6f9cc8'],plan:['✉','#5f9a45'],money:['■','#c9582f'],assess:['✔','#5f9a45'],wolf:['■','#7f94a8'],road:['■','#a08a5a'],invoice:['✉','#c9962f'],nature:['✦','#4fa690']};
const MTABS=[['all','Wszystkie'],['zd','Zdarzenia'],['prz','Przyroda']];
let mailTab='all',fresh=new Set();
const split=t=>{const i=t.search(/[.!?](?=\s+[A-ZĄĆĘŁŃÓŚŹŻ])/);return i>=5&&i<t.length-1?[t.slice(0,i+1),t.slice(i+1).trim()]:[t,'']};   // koniec zdania, a nie „oddz. 103”
function invState(m){if(m.inv==null)return '';const i=FIN.inv.find(q=>q.id===m.inv);if(!i)return '';
 return i.paid?'<span class="chip ok">zapłacona</span>':`<span class="chip ${(i.st||0)>=1?'bad':'warn'}">do zapłaty ${zl(i.amount)}</span><button class="sec" data-wa="fin">Przejdź do finansów</button>`}
function mailHtml(){
 for(const m of MAIL)if(!m.read){fresh.add(m.id);m.read=true}
 const list=MAIL.filter(m=>mailTab==='all'||grp(m)===mailTab);
 const cnt=k=>k==='all'?MAIL.length:MAIL.filter(m=>grp(m)===k).length;
 let body='',day=null;
 for(const m of list){
  const dd=Math.floor(m.day);if(dd!==day){day=dd;body+=`<div class="mday">${dayLabel(m.day)} <span>${ago(m.day)}</span></div>`}
  const k=KIND[m.kind]||['■','#8a8f78'],[t,r]=split(m.text);
  body+=`<div class="mrow2 ${fresh.has(m.id)?'new':''}"><span class="mk" style="color:${k[1]}">${k[0]}</span><div class="mb"><div class="mt"><b>${t}</b><i>${hm(m.day)}</i></div>${r?`<div class="mr">${r}</div>`:''}
   <div class="macts">${m.x!=null?`<button data-wa="go" data-id="${m.id}">Pokaż na mapie</button>`:''}${invState(m)}</div></div></div>`;
 }
 if(!body)body='<p class="hint2">'+(MAIL.length?'W tej zakładce nic nie ma.':'Skrzynka jest pusta. Trafiają tu ważne wiadomości oraz zdarzenia, które łatwo przeoczyć przy szybkim upływie czasu.')+'</p>';
 const od=FIN.inv.some(i=>!i.paid&&(i.st||0)>=1);
 return head('Leśnictwo Zielony Gaj · skrzynka przy bramie','Poczta')+
 `<div class="tiles t3">${tile('Nowe',fresh.size||'brak')}${tile('W skrzynce',MAIL.length)}<div class="tile ${od||dunning()?'bad':owedCount()?'warn':''} click" data-wa="fin"><span>Faktury do zapłaty</span><b>${owedCount()?owedCount()+' · '+zl(owedTotal()):'brak'}</b></div></div>
 <div class="tabs">${MTABS.map(([k,n])=>`<button class="tab ${k===mailTab?'on':''}" data-wa="tab" data-k="${k}">${n} <i class="c">${cnt(k)}</i></button>`).join('')}</div>
 <div class="mlist">${body}</div><p class="hint2">Faktury opłacasz w Leśniczówce (L), w zakładce Finanse. Tutaj są wyświetlane wyłącznie informacyjnie.</p>`+foot;
}
registerWin('mail',{cls:'wide',
 open(){fresh=new Set(MAIL.filter(m=>!m.read).map(m=>m.id));for(const m of MAIL)m.read=true},
 close(){fresh=new Set()},
 render:mailHtml,
 act(a,d){
  if(a==='tab')mailTab=d.k;
  else if(a==='go'){const m=MAIL.find(q=>q.id==d.id);if(m&&m.x!=null){closeWin();centerOn(m.x,m.y);state.follow=null}}
  else if(a==='fin'){closeWin();openBaseTab('fin')}
 }});

// ── Stan lasu ──
const prow=(label,note,v,neutral)=>`<div class="prow ${neutral?'':v<-.04?'neg':v>.04?'pos':''}"><div><b>${label}</b><span>${note}</span></div><em>${sgn(v)}</em></div>`;
function healthHtml(){
 const P=ECO.parts;if(!P)return head('Leśnictwo Zielony Gaj','Stan lasu')+'<p>Dane pojawią się za chwilę.</p>'+foot;
 const nu=ECO.unrenList.length,dm=Object.entries(ECO.dmgBy).sort((a,b)=>b[1]-a[1]).filter(q=>q[1]>=.05);
 const maxB=HL_BASE+50+YOUNG_MAX,tip=[];
 if(nu)tip.push(`<b>Odnów pniaki.</b> Każdy pniak, przy którym nie rośnie młode drzewko, obniża wskaźnik o ${displayNumber(UNREN_EACH,2)} pkt (łącznie najwyżej o ${UNREN_CAP} pkt). Masz ich ${nu}; posadzenie sadzonek przywróci nawet ${sgn(Math.min(UNREN_CAP,nu*UNREN_EACH))} pkt.`);
 if(P.young<YOUNG_FULL)tip.push(`<b>Sadź też poza pniakami.</b> Posadzone młode drzewka dają premię do +${YOUNG_MAX} pkt. Pełną premię uzyskasz przy ${YOUNG_FULL} drzewkach, a obecnie jest ich ${P.young}.`);
 if(P.trash)tip.push('<b>Uprzątnij śmieci i wysypiska</b> (zgłoszenia po prawej stronie ekranu). Jedno wysypisko liczy się tak jak cztery kupki śmieci.');
 if(P.fires)tip.push('<b>Pożar:</b> każdy trwający pożar obniża wskaźnik o 3 pkt. Wyślij do niego patrol.');
 if(P.damage>1)tip.push('<b>Szkody</b> spowodowane przez kornika, wichury, zgryzanie i pożary słabną o 0,4 pkt na dobę. Pułapki na kornika i grodzenie upraw ograniczają powstawanie nowych.');
 if(!tip.length)tip.push('Nie ma nic pilnego. Wskaźnik rośnie razem z koronami drzew i młodymi uprawami.');
 return head('Leśnictwo Zielony Gaj','Stan lasu')+
 `<div class="tiles">${tile('Teraz',Math.round(state.health)+'%')}${tile('Dąży do',Math.round(P.target)+'%',P.target<state.health-1?'warn':'')}${tile('Pniaki bez odnowienia',nu,nu>5?'warn':'')}${tile('Młode uprawy',P.young+' drzewek')}</div>
 <div class="wsec"><h3>Z czego składa się wskaźnik</h3>
 ${prow('Podstawa','stała część zdrowego lasu',P.base,true)}
 ${prow('Korony drzew','korony pokrywają '+Math.round(P.coverPct*100)+'% pierwotnej powierzchni; wycinka ją zmniejsza, a wzrost drzew i sadzenie przywracają',P.cover,true)}
 ${prow('Młode uprawy','posadzone drzewka młodsze niż 24 lata ('+P.young+' z '+YOUNG_FULL+' potrzebnych do pełnej premii)',P.bonus)}
 ${prow('Pniaki bez odnowienia',nu+' szt., każdy po '+displayNumber(UNREN_EACH,2)+' pkt; pniak uznaje się za odnowiony, gdy w promieniu około 30 px rośnie młode drzewko',P.unrenPts)}
 ${prow('Śmieci i wysypiska',P.trash?'ciężar '+P.trash+' (kupka śmieci to 1, wysypisko to 4), po 1,2 pkt za jednostkę':'brak',P.trashPts)}
 ${prow('Pożary',P.fires?P.fires+' trwających, każdy po 3 pkt':'brak',P.firePts)}
 ${prow('Szkody',dm.length?dm.map(([k,v])=>k+' '+displayNumber(v,1)).join(', ')+'; słabną o 0,4 pkt na dobę':'brak',-P.damage)}
 <div class="prow sum"><div><b>Wynik, do którego dąży wskaźnik</b><span>zbliża się do niego stopniowo; maksimum to ${maxB}%</span></div><em>${displayNumber(P.target,1)}%</em></div></div>
 <div class="wsec"><h3>Co poprawi wskaźnik</h3>${tip.map(t=>`<p class="hint2">${t}</p>`).join('')}
 ${nu?`<div class="wact"><button data-wa="show">Pokaż nieodnowione pniaki (${nu})</button><button data-wa="plant">Posadź przy nieodnowionych pniakach (${nu})</button></div>`:''}</div>
 <div class="wsec"><h3>Jak to widzi nadleśniczy</h3><p class="hint2">W raporcie sezonowym liczy się liczba nieodnowionych pniaków, a nie sam wskaźnik — jeśli jest ich mniej niż 6, otrzymujesz punkt. Wycinka nie obniża oceny, dopóki na bieżąco odnawiasz las.</p></div>`+foot;
}
registerWin('health',{cls:'wide',render:healthHtml,
 act(a){
  if(a==='show'){closeWin();showStumps(true)}
  else if(a==='plant')plantAtStumps(ECO.unrenList);
 }});

// ── Ochrona terenu ──
const TYPEN={quad:'Nielegalny wjazd',fire:'Pożar',intruder:'Nocny intruz',feed:'Paśnik',trash:'Śmieci',dump:'Wysypisko',carcass:'Padlina',block:'Zatarasowana droga',beetle:'Kornik',fence:'Ogrodzenie',assess:'Ocena'};
function protectHtml(){
 const open=openIncidents().slice().sort((a,b)=>incPenalty(b)-incPenalty(a)||prio(b)-prio(a));
 const pen=Math.min(9,open.reduce((n,q)=>n+incPenalty(q),0)),urgent=open.filter(q=>prio(q)>=3).length;
 const rows=open.map(q=>{const p=incPenalty(q);
  return `<div class="orow"><div class="ob"><b>${TYPEN[q.type]||'Zgłoszenie'}</b><span>${q.text}</span></div><div class="oc ${p?'neg':''}">${p?'−'+p+' pkt/dobę':'bez kary'}</div>
  <div class="oa">${q.status==='new'?`<button data-wa="send" data-id="${q.id}">${incLabel(q)}</button>`:`<i>${incWait(q)}</i>`}<button class="sec" data-wa="go" data-id="${q.id}">Pokaż</button></div></div>`}).join('');
 const log=ECO.plog.map(e=>`<div class="prow ${e.d<0?'neg':'pos'}"><div><b>${e.why}</b><span>${ago(e.t)} · ${hm(e.t)}</span></div><em>${sgn(e.d)}</em></div>`).join('');
 return head('Leśnictwo Zielony Gaj','Ochrona terenu')+
 `<div class="tiles">${tile('Teraz',Math.round(state.protect)+'%')}${tile('Otwarte zgłoszenia',open.length||'brak')}${tile('Kara na dobę',pen?'−'+pen+' pkt':'brak',pen>=6?'bad':pen?'warn':'')}${tile('Pilne',urgent||'brak',urgent?'bad':'')}</div>
 <div class="wsec"><h3>Otwarte zgłoszenia i ich koszt</h3>${rows||'<p class="hint2">Nie ma otwartych zgłoszeń — w lesie panuje spokój.</p>'}${open.length?'<p class="hint2">Kara jest naliczana raz na dobę, o północy, i łącznie wynosi najwyżej 9 pkt.</p>':''}</div>
 <div class="wsec"><h3>Ostatnie zmiany</h3>${log||'<p class="hint2">Od początku gry nic się nie zmieniło.</p>'}</div>
 <div class="wsec"><h3>Zasady</h3>
 <p class="hint2"><b>Kara za brak reakcji (na dobę):</b> nowe zgłoszenie pilne (pożar, nielegalny wjazd, intruz) albo zwykłe obniża ochronę o 3 pkt, a drobne (śmieci, padlina) — o 1 pkt. Gdy patrol już działa albo zgłoszenie czeka w kolejce, kara wynosi 1 pkt i dotyczy tylko zgłoszeń pilnych i zwykłych. Propozycje (ogrodzenia, ocena drzewostanu, karma) nie są karane.</p>
 <p class="hint2"><b>Spokój:</b> gdy nie czeka żadne zgłoszenie, a ochrona terenu jest niższa niż 74%, odbudowuje się o 1,5 pkt na dobę.</p>
 <p class="hint2"><b>Wskaźnik podnoszą:</b> obsłużone zgłoszenia, mandaty z fotopułapek, uprzątnięte wysypiska, wycieczki szkolne, rezerwaty i rzadkie ptaki. <b>Obniżają go:</b> pożary, kornik, wichury, sprawcy, którym udało się uciec, oraz zgryzanie upraw.</p>
 <p class="hint2">Kontrola wjazdów (fotopułapki i znaki zakazu), szlabany oraz znaki przy szosie zmniejszają liczbę zgłoszeń. Wszystko to kupisz w Leśniczówce (L), w zakładce Ochrona terenu.</p></div>`+foot;
}
registerWin('protect',{cls:'wide',render:protectHtml,
 act(a,d){
  const q=E.incidents.find(x=>x.id==d.id);
  if(a==='send'&&q)dispatch(q);
  else if(a==='go'&&q){closeWin();centerOn(q.x,q.y);state.selected=q;state.follow=null}
 }});
