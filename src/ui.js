// HUD w HTML (styl farmy): trzy wskaźniki, zegar i kalendarz, narzędzia, plan na sezon, zgłoszenia, karta wybranego obiektu.
import {$,state,cal,SEASONS,DOW,displayNumber,zl,SETTINGS,camera,VIEW,clamp,toast,SEASON_DAYS,YEARS_PER_SEASON} from './core.js';
import {HL,WX,LVLN,fireLvl,trapsOn,sick,buyTraps,buildTower,toggleBan,COSTS as HC} from './health.js';
import {SP,STAND,STUMP,SAPLING_AGE,CUT_AGE,THIN_AGE,crownR,heightM,dbhCm,volume,counts,treesIn,QUAL,SORTS,sortSplit,treeValue} from './forest.js';
import {STANDS,oddzial} from './map.js';
import {J,COST,PRICE,MACH,pendingCount,toggleMark,dispatchCrew,orderTruck,togglePlant,buyForwarder,stackTotal,stackValue,hireCrewB,fireCrewB,truckTotal,pileSorts} from './jobs.js';
import {R,plotStats,prepCost,areaHa,spotsIn,orderPrep,orderPlant,removePlot,rowsOf,fenceCost,orderFence,orderRepel,repelCost,seasonKey,MIXES,mixFor,cycleMix,mixSp} from './renew.js';
import {ECO,dailyCost} from './economy.js';
import {E} from './ents.js';
import {dispatch,openIncidents,U,orderAssess,assessing,ASSESS} from './incidents.js';
import {FA,NAMES,pressure,planLeft,requestReduction} from './life/fauna.js';
import {BASE,BUILD,buildNursery,buildGarage,hireDeputy,fireDeputy,NPLANS,cycleNursery,nurseryText} from './base.js';
import {VSPEC,ASPEC} from './life/agents.js';

export function lat(n){n=Math.round(n);const d=n%10,dd=n%100;return n+(n===1?' rok':(d>=2&&d<=4&&!(dd>=12&&dd<=14))?' lata':' lat')}
const pct=v=>Math.round(v)+'%';
function barCol(v){return v>=70?'#8ec86a':v>=50?'#d8b665':'#e0704f'}
export function setTool(t){state.tool=t;state.hover=null;state.box=null;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('on',b.dataset.tool===t);
 const msg={select:'Podgląd: kliknij drzewo, zwierzę, pojazd, zgłoszenie albo powierzchnię.',mark:'Wycinka: klik = drzewo (trzebież od '+THIN_AGE+' lat), przeciągnij = obszar (od '+CUT_AGE+' lat), Shift + przeciągnij = odznacz, Ctrl+Z = cofnij. Kolorowe kropki = oceniona jakość. Prawy przycisk przesuwa mapę.',plant:'Sadzenie: klik = sadzonka, przeciągnij = rzędy sadzonek (bez przygotowania gleby).',plot:'Odnowienie: przeciągnij obszar zrębu → pług LPz → sadzenie w rzędach.'}[t];
 $('#toolhint').textContent=msg;}
let incSig='',infoSig='',taskSig='';
export function hud(){
 const h=cal.hour(),hh=Math.floor(h),mm=Math.floor((h-hh)*60);
 $('#time').textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
 $('#date').textContent='Rok '+cal.year()+' · '+SEASONS[cal.season()]+' · dzień '+cal.dayOf();
 {const lv=fireLvl(),w=$('#wx');w.textContent=WX[HL.wx]+(lv?' · pożary: '+LVLN[lv]:'');w.style.color=lv===3?'#ff9a7a':lv===2?'#f0d070':''}
 $('#dow').textContent=DOW[cal.dow()]+(cal.weekend()?' (weekend)':'');
 $('#ff').style.display=state.ff>1?'block':'none';
 $('#money').textContent=Math.round(state.money).toLocaleString('pl-PL');$('#money').style.color=state.money<0?'#ff8a6a':'';
 $('#health').textContent=pct(state.health);$('#healthbar').style.width=clamp(state.health,0,100)+'%';$('#healthbar').style.background=barCol(state.health);
 $('#protect').textContent=pct(state.protect);$('#protectbar').style.width=clamp(state.protect,0,100)+'%';$('#protectbar').style.background=barCol(state.protect);
 const n=pendingCount();$('#crewn').textContent=n?'('+n+')':'';$('#crewbtn').classList.toggle('hot',n>0);
 const ns=J.stacks.filter(q=>q.vol>.05).length;$('#stackinfo').textContent=displayNumber(stackTotal(),1)+' m³ (opał '+displayNumber(stackTotal(q=>q.sort==='opal'),1)+')'+(J.truck.v?' · TIR':J.truck.pending?' · zamów.':'');$('#stackinfo').title=ns+' stosów przy drogach';
 $('#market').textContent='×'+displayNumber(ECO.market,2);
 $('#daily').textContent=zl(dailyCost());
 const crewTxt=C=>{const nt=C.tasks.length+C.cluster.length,held=C.held.length;
  return (C.phase==='idle'&&nt?'czeka · '+cal.nextStart(7,15):({idle:'wolna',driving:'w drodze',working:'pracuje',leaving:'odjeżdża'}[C.phase]+(nt?' · zadań: '+nt:'')))+(held?' · wstrzym.: '+held:'')};
 $('#crewstate').textContent=crewTxt(J.crews[0]);
 $('#crewBrow').style.display=J.crews[1]?'flex':'none';if(J.crews[1])$('#crewBstate').textContent=crewTxt(J.crews[1]);
  $('#skidstate').textContent=!J.skid.trac?(J.skid.owned?'forwarder: w drodze':'usługa: przyjedzie do kłód'):(J.skid.mach==='forwarder'?'forwarder: ':'ciągnik: ')+(J.skid.phase==='idle'&&!cal.work(7,17)?'po pracy':{idle:'czeka',arriving:'dojeżdża',driving:'jedzie po drewno',in:'w szlaku',load:'ładuje',out:'wraca na drogę',tostack:'wiezie na stos',unload:'układa stos',home:'jedzie na plac'}[J.skid.phase]||J.skid.phase);
 const PL=R.plow;$('#plowstate').textContent=PL.phase==='idle'?(PL.queue.length?'czeka · '+cal.nextStart(7,17):'—'):PL.phase==='plowing'?'orze P'+PL.cur.id:'w drodze';
 const uTxt=u=>u.phase==='home'&&u.person.sleeping?'śpi':u.phase==='home'&&u.person.busyOffice?'kancelaria':{home:U.length>1?'w domu':'w leśniczówce',boarding:'wyjeżdża',driving:'w drodze',onsite:'na miejscu',return:'wraca'}[u.phase]+(u.queue.length?' (+'+u.queue.length+')':'');
 $('#patrolstate').textContent=U.map((u,i)=>(U.length>1?(i?'P: ':'L: '):'')+uTxt(u)).join(', ');
 if(state.panel)renderBase();
 // plan na sezon
 const Pl=ECO.plan;if(Pl){const sig=[Pl.doneCut.toFixed(1),Pl.donePlant,Pl.doneHandle,Pl.rewarded,Pl.season].join();if(sig!==taskSig){taskSig=sig;
  const row=(ok,txt,a,b)=>`<div class="trow ${ok?'ok':''}"><span>${ok?'✔':'·'} ${txt}</span><b>${a} / ${b}</b></div>`;
  $('#tasks').innerHTML=row(Pl.doneCut>=Pl.cut,'Drewno zerwane do dróg',displayNumber(Math.min(Pl.doneCut,Pl.cut),1),Pl.cut+' m³')+row(Pl.donePlant>=Pl.plant,'Posadzone sadzonki',Math.min(Pl.donePlant,Pl.plant),Pl.plant)+row(Pl.doneHandle>=Pl.handle,'Obsłużone zgłoszenia',Math.min(Pl.doneHandle,Pl.handle),Pl.handle)+
   `<div class="muted small">${Pl.rewarded?'Plan wykonany — premia wypłacona.':'Premia za wykonanie: '+zl(Pl.reward)}</div>`}}
 // zgłoszenia
 const open=openIncidents(),sig=open.map(q=>q.id+q.status).join('|');
 if(sig!==incSig){incSig=sig;
  $('#incidents').innerHTML=open.length?open.map(q=>`<div class="inc ${q.type}"><span class="go" data-go="${q.id}">${q.text}</span>${q.status==='new'?`<button data-inc="${q.id}">${q.type==='feed'?'Dowieź karmę':'Wyślij patrol'}</button>`:`<i>${q.status==='queued'?'w kolejce':(q.unit&&U.length>1?q.unit.name+' działa':'patrol działa')}</i>`}</div>`).join(''):'<div class="muted">Spokojnie w lesie.</div>';
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
 const f=sortSplit(t);
 const lines=['Oddział '+st.name+' · '+st.desc,'Wiek: '+lat(t.age)+' · wysokość '+Math.round(heightM(t))+' m','Pierśnica '+Math.round(dbhCm(t))+' cm · miąższość '+displayNumber(volume(t),2)+' m³',
  t.qk?'Jakość: '+QUAL[t.q].name:'Jakość: nieoceniona — zleć ocenę drzewostanu',
  t.qk?'Sortymenty: '+['tart','pap','opal'].filter(k=>f[k]>0).map(k=>SORTS[k].short+' '+Math.round(f[k]*100)+'%').join(', ')+' · wartość ok. '+zl(treeValue(t)):'Wartość drewna zależy od jakości (tartaczne / papierówka / opał).',
  'Koszt ścinki '+zl(COST.fell)];
 if(t.kb===4)lines.push('Wiatrołom — połamane przez wichurę; zasiedla je kornik, uprzątnij.');else if(t.kb>=2)lines.push(t.kb===2?'Zamiera: zasiedlone przez kornika. Tnij sanitarnie, zanim zarazi sąsiadów.':'Martwe, zasiedlone przez kornika — drewno sanitarne.');
 if(t.assigned)lines.push('Ekipa ma je na liście.');
 const btns=t.assigned||t.age<THIN_AGE?[]:[['mark',t.marked?'Usuń oznaczenie':t.age<CUT_AGE||t.q===2&&t.qk?'Wyznacz do trzebieży':'Wyznacz do wycinki']];
 const last=ASSESS.filter(q=>Math.hypot(q.x-t.x,q.y-t.y)<250).sort((a,b)=>b.day-a.day)[0],ago=last?(state.days-last.day)/SEASON_DAYS*YEARS_PER_SEASON:null;
 if(last)lines.push('Cechowanie w tym miejscu: '+(ago<1?'w tym roku':Math.round(ago)+' lat temu')+(ago<10?' — kolejne za ok. '+Math.max(1,Math.round(10-ago))+' lat.':'.'));
 if((!t.qk||ago==null||ago>=10)&&!assessing(t.x,t.y))btns.push(['assess','Ocena drzewostanu i cechowanie (okolica)']);
 if(assessing(t.x,t.y))lines.push('Leśniczy ma tu zleconą ocenę drzewostanu.');
 return{title:sp.name[0].toUpperCase()+sp.name.slice(1),lines,btns};
}
function plotInfo(p){
 const st=plotStats(p),spots=p.state==='planting'||p.state==='planted'?0:spotsIn(p.x,p.y,p.w,p.h).length,stName={new:'nowa',queued:'czeka na pług',prepping:'trwa orka',prepared:'gleba przygotowana',planting:'trwa sadzenie',planted:'obsadzona'}[p.state];
 const lines=['Oddział '+p.odd+' · '+displayNumber(areaHa(p),2)+' ha · '+rowsOf(p).length+' rzędów','Stan: '+stName+' · skład: '+MIXES[p.mix||mixFor(p.sp)].name,
  'Pniaki: '+st.stumps+(st.slash?' (gałęzie: '+st.slash+')':'')+' · drzewa: '+st.stand+' · sadzonki: '+st.young];
 if(st.stand)lines.push('Stojące drzewa zostaną ominięte — możesz je najpierw wyciąć (narzędzie 2).');
 if(p.state==='planting')lines.push('Posadzono '+p.planted+' z '+p.toPlant+'.');
 const btns=[];
 if(!p.prepared&&p.state==='new')btns.push(['prep','Przygotuj glebę (pług LPz) · '+zl(prepCost(p))]);
 // koszt z uwzględnieniem sadzonek ze szkółki (osobno dla każdego gatunku)
 let fromNur=0;if(spots&&ECO.nursery&&ECO.nursery.sp){const need={};for(const [x,y] of spotsIn(p.x,p.y,p.w,p.h)){const k=mixSp(p,x,y);need[k]=(need[k]||0)+1}for(const k in need)fromNur+=Math.min(need[k],ECO.nursery.sp[k]||0)}
 if(p.state==='new'||p.state==='prepared')btns.push(['mix','Zmień skład gatunkowy']);
 if(spots&&(p.state==='new'||p.state==='prepared'||p.state==='planted'))btns.push(['plantplot','Sadź w rzędach: '+spots+' szt. · '+zl(fromNur*COST.plantNursery+(spots-fromNur)*COST.plant)+(fromNur?' ('+fromNur+' ze szkółki)':'')+(p.prepared?'':' (bez orki)')]);
 if(!p.fence)btns.push(['fence','Ogródź siatką · '+zl(fenceCost(p))]);
 if(p.fence!=='done'&&st.young>0&&p.repel!==seasonKey())btns.push(['repel','Repelent na sezon · '+zl(repelCost(p))]);
 if(p.repel===seasonKey()&&p.fence!=='done')lines.push('Repelent naniesiony — chroni do końca tej pory roku.');
 lines.push(p.fence==='done'?'Ogrodzona — sadzonki bezpieczne od zgryzania.':p.fence==='building'?'Grodzenie: '+Math.round(p.fenceP/(2*(p.w+p.h))*100)+'%':'Bez grodzenia: sarny i jelenie mogą zgryzać sadzonki (presja '+Math.round(pressure()*100)+'%).');
 if(p.state!=='prepping'&&p.state!=='planting'&&p.state!=='queued'&&p.fence!=='building')btns.push(['delplot','Usuń powierzchnię']);
 return{title:'Powierzchnia odnowieniowa P'+p.id,lines,btns};
}
function info(){
 const s=state.selected,el=$('#info');
 if(!s||s.dead||(s.status&&(s.status==='done'||s.status==='gone'))){if(state.selected&&(s.dead||s.status))state.selected=null;el.style.display='none';infoSig='';return}
 let I;
 if(s.st!==undefined)I=treeInfo(s);
 else if(s.text)I={title:{quad:'Nielegalny wjazd',fire:'Dym nad lasem',intruder:'Nocny intruz',feed:'Paśnik do uzupełnienia',trash:'Śmieci w lesie'}[s.type]||'Zgłoszenie',lines:[s.text,s.type==='feed'?'Karma: '+zl(ECO.feedCost||120)+' + paliwo. Pusty paśnik zimą = większe straty zwierzyny i więcej zgryzania.':'',{new:'Czeka na decyzję.',queued:'W kolejce patrolu.',assigned:'Patrol w drodze.'}[s.status]||''].filter(Boolean),btns:s.status==='new'?[['patrol',s.type==='feed'?'Dowieź karmę':'Wyślij patrol']]:[]};
 else if(s.value!=null&&s.edge&&!s.pos){const so=s.sort||'tart';I={title:SORTS[so].name[0].toUpperCase()+SORTS[so].name.slice(1)+' — stos przy drodze, oddz. '+s.odd,lines:['Na stosie: '+displayNumber(s.vol,1)+' m³ · wartość ok. '+zl(Math.round(s.value*ECO.market)),
  so==='opal'?(s.truck===false?'Opał dla ludności: kupują go petenci w kancelarii ('+zl(PRICE.opal)+'/m³) i odbierają spod stosu. Ciężarówka go nie bierze.':'Ciężarówka może zabrać ten opał (taniej niż sprzedaż petentom).'):'Cena rynkowa ×'+displayNumber(ECO.market,2)+' (zimą drożej, latem taniej).',
  'Do wywozu: '+displayNumber(truckTotal(),1)+' m³ (przy 16 m³ nadleśnictwo samo przyśle transport). Opał przy drogach: '+displayNumber(stackTotal(q=>q.sort==='opal'),1)+' m³.','Sprzedano łącznie: '+displayNumber(J.sold,1)+' m³.'],
  btns:[...(so==='opal'?[['opaltruck',s.truck===false?'Pozwól zabrać ciężarówce':'Zostaw dla ludności']]:[]),...(J.truck.v?[]:[['truck','Zamów wywóz teraz']])]}}
 else if(s.level!=null&&s.name)I={title:'Paśnik '+s.name,lines:['Karma: '+Math.round(s.level*100)+'%',cal.season()===3?'Zima: zwierzyna wyjada karmę. Przy niskim poziomie pojawi się zadanie.':'Poza zimą paśnik stoi, lizawka solna obok.'],btns:[]};
 else if(s.day!=null&&s.vol!=null&&s.edge)I={title:'Drewno opałowe do odbioru',lines:['Sprzedane w kancelarii: '+displayNumber(s.vol,1)+' m³','Nabywca przyjedzie ciągnikiem z przyczepą.'],btns:[]};
 else if(s.pos)I={title:VSPEC[s.kind].name[0].toUpperCase()+VSPEC[s.kind].name.slice(1),lines:[s.label||'',s.cart?'Ładunek: '+displayNumber(s.load,1)+' / '+s.cap+' m³':'',s.illegal?'Wjazd pojazdów silnikowych do lasu jest zabroniony.':''].filter(Boolean),btns:s.illegal&&s.inc&&s.inc.status==='new'?[['patrol','Wyślij patrol']]:[]};
 else if(s.kind&&ASPEC[s.kind])I={title:s.name||ASPEC[s.kind].name,lines:[{idle:'Odpoczywa / żeruje',walk:'Wędruje',run:'Ucieka!'}[s.state]||'',s.male&&s.kind==='deer'?'Byk z porożem':s.male&&s.kind==='roe'?'Rogacz':s.sow?'Locha prowadząca warchlaki (pod ochroną)':'',FA.pop[s.kind==='piglet'?'boar':s.kind]!=null?'W obwodzie: '+NAMES[s.kind==='piglet'?'boar':s.kind]+' ok. '+FA.pop[s.kind==='piglet'?'boar':s.kind]+' szt.':'',s.kind==='wolf'?'Gatunek chroniony — reguluje liczebność saren i jeleni.':''].filter(Boolean),btns:[]};
 else if(s.look)I={title:s.label?s.label[0].toUpperCase()+s.label.slice(1):'Osoba',lines:[s.kind==='picker'?(s.berry?'Zbiera jagody w borze. Czasem zostawia śmieci…':'Zbiera grzyby. Czasem zostawia śmieci…'):s.kind==='worker'?'Pracownik ekipy leśnej.':s.kind==='lesniczy'?(s.unit&&s.unit!==U[0]?'Podleśniczy: drugi patrol, dyżur w kancelarii.':'Prowadzi leśnictwo. Wyjeżdża na interwencje.'):s.kind==='hunter'?'Koło łowieckie: plan odstrzału '+['roe','deer','boar'].map(k=>FA.culled[k]+'/'+FA.plan[k]).join(', ')+' (sarny, jelenie, dziki).':s.petent?'Petent czeka przed kancelarią.':'Odpoczywa w lesie.'],btns:[]};
 else if(s.logs&&s.state)I={title:'Kłody — '+SP[s.sp].name,lines:['Miąższość '+displayNumber(s.vol,2)+' m³: '+Object.entries(pileSorts(s)).filter(([,v])=>v>.01).map(([k,v])=>SORTS[k].short+' '+displayNumber(v,2)).join(', '),s.state==='ground'?'Czeka na zrywkę (ciągnik przyjedzie sam).':'Ciągnik już po nie jedzie.'],btns:[]};
 else if(s.toPlant!==undefined)I=plotInfo(s);
 if(!I){el.style.display='none';return}
 const sig=JSON.stringify(I);if(sig===infoSig)return;infoSig=sig;
 el.innerHTML=`<div class="kick">${I.title}</div>`+I.lines.map(l=>`<div class="ln">${l}</div>`).join('')+(I.btns.length?`<div class="ibtns">${I.btns.map(([k,t])=>`<button data-ia="${k}">${t}</button>`).join('')}</div>`:'')+(s.pos||s.look||(s.kind&&ASPEC[s.kind]&&!s.edge)?`<div class="muted small">F — kamera śledzi</div>`:'');
 el.style.display='block';
}
// ── panel Leśniczówki (L) ──
let baseSig='';
export function toggleBase(open){
 const el=$('#base');open=open??el.classList.contains('hidden');
 if(open){if(state.modal&&!state.panel)return;el.classList.remove('hidden');state.panel=true;state.modal=true;state.paused=true;baseSig='';renderBase()}
 else{el.classList.add('hidden');state.panel=false;state.modal=false;state.paused=false}
}
export function renderBase(){
 const row=(a,b)=>`<div class="rrow"><span>${a}</span><b>${b}</b></div>`,btn=(k,t,dis,sec)=>`<button data-b="${k}" ${dis?'disabled':''} class="${sec?'sec':''}">${t}</button>`;
 const B=BASE.stats,crewB=!!J.crews[1],pod=ECO.staff.pod,pr=pressure();
 const meter=v=>`<div class="meter"><i style="width:${Math.round(clamp(v,0,1)*100)}%"></i></div>`;
 const html=`<div class="kicker">Leśnictwo Zielony Gaj · ${DOW[cal.dow()]}, ${SEASONS[cal.season()]}</div><h1>Leśniczówka</h1>
 <div class="bgrid">
 <div class="bsec"><h3>KANCELARIA</h3><p>Pon.–pt. 8–15 przychodzą petenci: drewno opałowe (${zl(PRICE.opal)}/m³ ze stosów przy drogach), zezwolenia, sadzonki, zgłoszenia. Ktoś musi być w leśniczówce.</p>
  ${row('Petenci obsłużeni / nieobsłużeni',B.visits+' / '+B.missed)}${row('Sprzedany opał',displayNumber(B.opalVol,1)+' m³ ('+B.opal+' umów)')}${row('Zezwolenia / sadzonki',B.permits+' / '+B.seedlings)}
  ${BASE.log.length?'<p class="hint2">'+BASE.log.slice(0,3).join(' · ')+'</p>':''}</div>
 <div class="bsec"><h3>KADRY</h3>
  ${row('Ekipa A (pilarze)','stała umowa')}${row('Ekipa B',crewB?'zatrudniona · '+zl(COST.crewB)+'/dzień':'—')}
  ${crewB?btn('fireB','Rozwiąż umowę z ekipą B',false,true):btn('hireB','Zatrudnij ekipę B · '+zl(COST.crewB)+'/dzień')}
  ${row('Podleśniczy',pod?'pracuje · '+zl(COST.pod)+'/dzień':BASE.garage?'—':'wymaga garażu')}
  ${pod?btn('firePod','Zwolnij podleśniczego',false,true):btn('hirePod','Zatrudnij podleśniczego · '+zl(COST.pod)+'/dzień',!BASE.garage)}
  <p class="hint2">Ekipy dzielą zadania po skupiskach. Podleśniczy to drugi patrol i dyżur w kancelarii, gdy jesteś w terenie.</p></div>
 <div class="bsec"><h3>BUDYNKI</h3>
  ${row('Szkółka leśna',BASE.nursery?'sadzonek: '+ECO.nursery.stock:'—')}${BASE.nursery?meter(ECO.nursery.stock/1200)+row('Zapas',nurseryText())+row('Produkcja',NPLANS[BASE.nplan||0].name)+btn('nplan','Zmień plan szkółki'):btn('nursery','Zbuduj szkółkę · '+zl(BUILD.nursery))}
  ${row('Garaż z magazynem',BASE.garage?'gotowy · karma '+zl(ECO.feedCost):'—')}${BASE.garage?'':btn('garage','Zbuduj garaż z magazynem · '+zl(BUILD.garage))}
  <p class="hint2">Sadzonki ze szkółki: ${zl(COST.plantNursery)} zamiast ${zl(COST.plant)} i lepiej się przyjmują. Garaż: miejsce na drugą terenówkę, tańsza karma.</p></div>
 <div class="bsec"><h3>SPRZĘT</h3>
  ${row('Zrywka',MACH[J.skid.mach].name)}${J.skid.owned?row('Utrzymanie forwardera',zl(COST.fwd)+'/dzień'):btn('fwd','Kup forwarder · '+zl(MACH.forwarder.price))}
  ${row('Drewno przy drogach',displayNumber(stackTotal(),1)+' m³ · ok. '+zl(Math.round(stackValue()*ECO.market)))}${row('w tym opał dla ludności',displayNumber(stackTotal(q=>q.sort==='opal'),1)+' m³')}${row('Cena rynkowa','×'+displayNumber(ECO.market,2))}
  ${J.truck.v?'':btn('truck','Zamów wywóz drewna')}
  ${row('Koszty dzienne razem',zl(dailyCost()))}</div>
 <div class="bsec"><h3>ZDROWIE LASU</h3>
  ${row('Pogoda',WX[HL.wx])}${row('Susza ściółki',Math.round(HL.dry*100)+'%')}${meter(HL.dry)}${row('Zagrożenie pożarowe',LVLN[fireLvl()])}
  ${row('Zamierające drzewa (widoczne)',sick())}${row('Zatarasowane drogi',HL.blocks.length)}${row('Cięte sanitarnie',HL.stats.cutSan)}
  ${btn('traps',trapsOn()?'Pułapki feromonowe wyłożone':'Pułapki feromonowe na kornika · '+zl(HC.traps)+'/rok',trapsOn())}
  ${btn('tower',HL.tower?'Wieża przeciwpożarowa działa':'Zbuduj wieżę przeciwpożarową · '+zl(HC.tower),HL.tower)}
  ${btn('ban',HL.ban?'Zniesienie zakazu wstępu do lasu':'Zakaz wstępu do lasu · '+zl(40)+'/dzień',false,HL.ban)}
  <p class="hint2">Kornik zasiedla świerki po cichu: rude korony widać dopiero po kilku dniach. Zgłoszenie obejrzy patrol i oznaczy drzewa do cięcia sanitarnego (E). Susza i wiatrołomy mu sprzyjają, pułapki hamują. Zakaz wstępu zmniejsza ryzyko pożaru, ale znika się po spadku zagrożenia.</p></div>
 <div class="bsec"><h3>KOŁO ŁOWIECKIE</h3>
  ${['roe','deer','boar','wolf','fox','hare'].map(k=>row(NAMES[k][0].toUpperCase()+NAMES[k].slice(1),FA.pop[k]+(FA.plan[k]!=null?' · plan '+FA.culled[k]+'/'+FA.plan[k]:k==='wolf'?' · chronione':''))).join('')}
  ${row('Presja na uprawy',Math.round(pr*100)+'%')}${meter(pr/2)}
  ${FA.reduction?'<p class="hint2">Odstrzał redukcyjny przyjęty — myśliwi co wieczór na ambonie.</p>':btn('reduce','Wniosek o odstrzał redukcyjny',pr<1.05)}</div>
 <div class="bsec"><h3>PAŚNIKI</h3>
  ${FA.feeders.map(f=>row(f.name,Math.round(f.level*100)+'%')+meter(f.level)).join('')}
  <p class="hint2">Zimą zwierzyna wyjada karmę — pusty paśnik to zadanie dla patrolu (${zl(ECO.feedCost||120)} za karmę). Głodna zwierzyna mocniej zgryza uprawy.</p></div>
 </div><button id="base-close">ZAMKNIJ (L / Esc)</button>`;
 if(html===baseSig)return;baseSig=html;$('#basecard').innerHTML=html;
 $('#base-close').onclick=()=>toggleBase(false);
}
export function centerOn(x,y){camera.x=x-VIEW.w/2;camera.y=y-VIEW.h/2}
// Raport z sezonu (0.2): podsumowanie pory roku, skok wzrostu lasu, nowy plan. Gra stoi, dopóki gracz nie kliknie „Dalej”.
const sgn=(n,d=0)=>(n>=0?'+':'−')+displayNumber(Math.abs(n),d);
export function showReport(r){
 const S=r.st,P=r.plan,N=ECO.plan;
 const row=(a,b)=>`<div class="rrow"><span>${a}</span><b>${b}</b></div>`;
 $('#reportcard').innerHTML=`<div class="kicker">Raport z sezonu · rok ${r.year}</div><h1>${SEASONS[r.season][0].toUpperCase()+SEASONS[r.season].slice(1)} — podsumowanie</h1>
  <p class="verdict">${r.verdict}</p><div class="rep">
  ${row('Drewno zerwane do dróg',displayNumber(S.delivered,1)+' m³')}${row('Drewno sprzedane',displayNumber(S.sold,1)+' m³')}
  ${row('Ścięte drzewa / posadzone sadzonki',S.felled+' / '+S.planted)}${row('Zgłoszenia obsłużone / zignorowane',S.handled+' / '+S.ignored)}
  ${row('Przychody / wydatki','+'+zl(S.earned)+' / −'+zl(S.spent))}
  ${row('Budżet',zl(r.money)+' ('+sgn(r.money-S.money0)+' zł)')}${row('Stan lasu',Math.round(r.health)+'% ('+sgn(r.health-S.health0)+')')}${row('Ochrona terenu',Math.round(r.protect)+'% ('+sgn(r.protect-S.protect0)+')')}
  ${row('Plan nadleśnictwa',P.rewarded?'wykonany (+'+zl(P.reward)+')':'niewykonany')}</div>
  ${row('Cena drewna w minionym sezonie','×'+displayNumber(r.market,2)+' → teraz ×'+displayNumber(r.nextMarket,2))}
  ${r.fauna?row('Zwierzyna (sarny / jelenie / dziki / wilki)',r.fauna.pop.roe+' / '+r.fauna.pop.deer+' / '+r.fauna.pop.boar+' / '+r.fauna.pop.wolf):''}
  ${r.fauna?row('Odstrzał koła łowieckiego w sezonie',r.fauna.cull+' szt.'):''}
  ${r.fauna&&r.fauna.fed!=null?row('Paśniki z karmą przez zimę',Math.round(r.fauna.fed*100)+'%'):''}
  ${r.fauna?row('Zgryzione sadzonki (zniszczone)',r.fauna.browsed+' ('+r.fauna.browsedKilled+')'):''}
  ${r.nursery?row('Szkółka: nowe sadzonki',r.nursery):''}
  <p>Las urósł o ${r.years} lata.${r.grown?' '+r.grown+' sadzonek wyrosło na młode drzewka.':''}${r.young?' Udatność nowych upraw: '+Math.round((1-r.died/r.young)*100)+'% (nie przyjęło się: '+r.died+').':''}${r.unrenewed?' Pniaków bez odnowienia: '+r.unrenewed+'.':''}</p>
  ${r.fauna&&r.fauna.browsed>20?'<p><b>Zgryzanie!</b> Sarny i jelenie niszczą niegrodzone uprawy. Ogródź powierzchnie (karta powierzchni) albo złóż wniosek o odstrzał redukcyjny (L).</p>':''}
  ${r.next===3?'<p><b>Zima:</b> ekipa nie sadzi, a paśniki trzeba uzupełniać karmą.</p>':r.next===0?'<p><b>Wiosna:</b> okres lęgowy — w oddz. 103 wycinka czeka do lata. Uwaga na wypalanie traw.</p>':r.next===2?'<p><b>Jesień:</b> grzybiarze w lesie i rykowisko o zmierzchu.</p>':''}
  <p><b>Teraz ${SEASONS[r.next]}.</b> Nowy plan: ${N.cut} m³ drewna, ${N.plant} sadzonek, ${N.handle} zgłoszenia — premia ${zl(N.reward)}.</p>
  <button id="report-close">DALEJ</button>`;
 $('#report').classList.remove('hidden');state.paused=true;state.modal=true;
 $('#report-close').onclick=()=>{$('#report').classList.add('hidden');state.paused=false;state.modal=false;taskSig='';hud()};
}
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
  else if(k==='fence')orderFence(s);
  else if(k==='mix')cycleMix(s);
  else if(k==='opaltruck'){s.truck=s.truck===false;toast(s.truck?'Ten opał może zabrać ciężarówka.':'Opał zostaje dla ludności.')}
  else if(k==='assess')orderAssess(s.x,s.y);
  else if(k==='repel')orderRepel(s);
  else if(k==='prep')orderPrep(s);else if(k==='plantplot')orderPlant(s);else if(k==='delplot'){removePlot(s);if(!R.plots.includes(s))state.selected=null}
  else if(k==='plantnear'){for(let a=0;a<12;a++){const x=s.x+Math.cos(a)*12,y=s.y+Math.sin(a)*12;const n=J.plants.length;togglePlant(x,y);if(J.plants.length>n)break}}
  infoSig='';hud();
 });
 $('#basebtn').addEventListener('click',()=>toggleBase(true));
 $('#basecard').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b)return;const k=b.dataset.b;
  ({nplan:cycleNursery,hireB:hireCrewB,fireB:fireCrewB,hirePod:hireDeputy,firePod:fireDeputy,nursery:buildNursery,garage:buildGarage,fwd:buyForwarder,truck:()=>orderTruck(true),reduce:requestReduction,traps:buyTraps,tower:buildTower,ban:toggleBan})[k]?.();
  baseSig='';renderBase();hud()});
 setTool('select');
 ECO.onSeason=showReport;
}
