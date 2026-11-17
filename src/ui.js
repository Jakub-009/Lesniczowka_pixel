// HUD w HTML (styl farmy): trzy wskaźniki, zegar i kalendarz, narzędzia, plan na sezon, zgłoszenia, karta wybranego obiektu.
import {closeTutor,toggleSettings} from './guide.js';
import {$,state,cal,SEASONS,DOW,displayNumber,zl,SETTINGS,camera,VIEW,clamp,toast,SEASON_DAYS,YEARS_PER_SEASON} from './core.js';
import {HL,WX,LVLN,fireLvl,trapsOn,sick,buyTraps,buildTower,toggleBan,COSTS as HC} from './health.js';
import {SP,STAND,STUMP,SAPLING_AGE,CUT_AGE,THIN_AGE,crownR,heightM,dbhCm,volume,counts,treesIn,QUAL,SORTS,sortSplit,treeValue} from './forest.js';
import {STANDS,oddzial} from './map.js';
import {J,COST,PRICE,MACH,pendingCount,ordersCount,clearOrders,toggleMark,dispatchCrew,orderTruck,plantNear,plantAtStumps,buyForwarder,stackTotal,stackValue,hireCrewB,fireCrewB,truckTotal,pileSorts,spotOf} from './jobs.js';
import {R,inPlot,perimOf,plotStats,prepCost,areaHa,spotsIn,orderPrep,orderPlant,removePlot,rowsOf,fenceCost,orderFence,orderRepel,repelCost,seasonKey,MIXES,mixFor,cycleMix,mixSp} from './renew.js';
import {signsOn,repelOn,trailOn,buySigns,buyRepel,buyTrail,vs,VC} from './visit.js';
import {NAT,canMonument,makeMonument,toggleDeadwood,makeReserve,journalRows,MON_COST,RES_COST,richness} from './nature.js';
import {ECO,dailyCost,costParts,costText,FIN,LOANS,dunning,owedTotal,owedCount,payAllInvoices,toggleAutoPay,takeLoan,repayLoan} from './economy.js';
import {E} from './ents.js';
import {dispatch,openIncidents,U,orderAssess,assessing,ASSESS,DEC,decide} from './incidents.js';
import {prio} from './mail.js';
import {FA,NAMES,pressure,planLeft,requestReduction,FEED_COST,FEED_MAX,nextFeederSlot,buyFeeder} from './life/fauna.js';
import {FEEDERS} from './map.js';
import {AMB,AMB_COST,AMB_MAX,AMB_R,AMBONY,nextAmbonaSlot,buyAmbona} from './life/ambony.js';
import {BASE,BUILD,buildNursery,buildGarage,hireDeputy,fireDeputy,NPLANS,cycleNursery,nurseryText} from './base.js';
import {VSPEC,ASPEC} from './life/agents.js';
import {unreadMail} from './mail.js';
import {oddStats,oddBounds,SPCOL} from './oddcard.js';
import {renderWin,closeWin} from './win.js';
import {sfx} from './sound.js';
import {showStumps,updateFocusBar} from './focus.js';
import {COSTS as OC,buyCams,toggleBarriers,buyParking,camsOn,barClosed,parkingOn,CAM_COUNT} from './order.js';

export function lat(n){n=Math.round(n);const d=n%10,dd=n%100;return n+(n===1?' rok':(d>=2&&d<=4&&!(dd>=12&&dd<=14))?' lata':' lat')}
const pct=v=>Math.round(v)+'%';
function barCol(v){return v>=70?'#8ec86a':v>=50?'#d8b665':'#e0704f'}
// tempo: ×1/×2/×3 przyciskami albo T; ×10 tylko świadomie (Shift), bo przy ×10 łatwo przegapić zdarzenia
export function setRate(r,shift){
 state.rate=shift?(state.rate>3?1:10):r;toast('Czas płynie ×'+state.rate+(state.rate>3?' (tryb szybki).':'.'));
}
export const cycleRate=shift=>setRate([1,2,3][([1,2,3].indexOf(state.rate)+1)%3]||1,shift);
export function setTool(t){state.tool=t;state.poly=null;state.hover=null;state.box=null;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('on',b.dataset.tool===t);
 const msg={select:'Kliknij drzewo, zwierzę, pojazd, zgłoszenie lub powierzchnię.',mark:'Klik: drzewo (trzebież od '+THIN_AGE+' lat). Przeciągnij: obszar (wycinka od '+CUT_AGE+' lat). Shift: odznacz. Ctrl+Z: cofnij.',plant:'Klik: sadzonka. Przeciągnij: rzędy sadzonek.',plot:'Przeciągnij prostokąt albo klikaj narożniki wielokąta (Enter kończy, Esc anuluje).'}[t];
 $('#toolhint').textContent=msg;
}
let incSig='',infoSig='',taskSig='';
export function hud(){
 document.body.classList.toggle('modal',!!state.modal);   // 1.1.2: przy otwartym oknie komunikat idzie na górę ekranu, nie na przyciski okna
 {const tb=$('#toolbar'),m=$('#msg');if(tb&&!state.modal){const b=Math.round(innerHeight-tb.getBoundingClientRect().top+16)+'px';if(m.style.bottom!==b)m.style.bottom=b}else if(m.style.bottom)m.style.bottom=''}   // komunikat zawsze tuż nad paskiem narzędzi
 const h=cal.hour(),hh=Math.floor(h),mm=Math.floor((h-hh)*60);
 $('#time').textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
 $('#date').textContent='Rok '+cal.year()+' · '+SEASONS[cal.season()]+' · dzień '+cal.dayOf()+' · '+DOW[cal.dow()]+(cal.weekend()?' (weekend)':'');
 {const lv=fireLvl(),w=$('#wx');w.textContent=WX[HL.wx]+(lv?' · pożary: '+LVLN[lv]:'');w.style.color=lv===3?'#ff9a7a':lv===2?'#f0d070':''}
 {const f=$('#ff'),t=state.skipTo!=null?'PRZEWIJANIE · do 6:00':state.ff>1?'NOC · czas ×'+state.ff:state.rate>3?'TRYB SZYBKI ×'+state.rate:'';f.textContent=t||'\u00a0';f.classList.toggle('on',!!t)}   // 1.1.2: wiersz zawsze zajmuje miejsce — panel nie zmienia wysokości
 for(const b of document.querySelectorAll('[data-rate]'))b.classList.toggle('on',+b.dataset.rate===state.rate);$('#pausebtn').classList.toggle('on',state.paused);
 $('#money').textContent=Math.round(state.money).toLocaleString('pl-PL');$('#money').style.color=state.money<0?'#ff8a6a':'';
 $('#health').textContent=pct(state.health);$('#healthbar').style.width=clamp(state.health,0,100)+'%';$('#healthbar').style.background=barCol(state.health);
 $('#protect').textContent=pct(state.protect);$('#protectbar').style.width=clamp(state.protect,0,100)+'%';$('#protectbar').style.background=barCol(state.protect);
 const n=pendingCount();$('#crewn').textContent=n?'('+n+')':'';$('#crewbtn').classList.toggle('hot',n>0);const oc=ordersCount();$('#cancelbtn').style.display=oc?'':'none';$('#canceln').textContent=oc?'('+oc+')':'';
 statusPanel();
 // 1.1.2: „Do zapłaty” pod budżetem (klik → Finanse), na czerwono przy wezwaniu do zapłaty
 {const oc=owedCount(),o=$('#owe'),txt=oc?'do zapłaty '+zl(owedTotal())+' ('+oc+') ›':'faktury opłacone ›';if(o.textContent!==txt)o.textContent=txt;o.className='owe'+(dunning()?' bad':oc?' warn':'')}
 if(state.panel)renderBase();
 planPanel();
 // zgłoszenia (1.1.2): wiersze z kropką typu, oddziałem i stanem; najwyżej 4, reszta w oknie Ochrony terenu
 const open=openIncidents(),sig=open.map(q=>q.id+q.status+(q.unit?q.unit.name:'')).join('|');
 if(sig!==incSig){incSig=sig;$('#incn').textContent=open.length?'('+open.length+')':'';
  const ord=open.slice().sort((a,b)=>(b.status==='new')-(a.status==='new')||prio(b)-prio(a)||a.id-b.id),shown=ord.slice(0,4);
  $('#incidents').innerHTML=open.length?shown.map(q=>`<div class="irow" data-go="${q.id}" title="${q.text.replace(/"/g,'&quot;')}"><i class="dot" style="background:${incCol(q)}"></i><div class="ib"><b>${incName(q)}</b><span>oddz. ${oddzial(q.x,q.y)}</span></div>${q.status==='new'?`<button data-inc="${q.id}">${incLabel(q)}</button>`:`<em class="chip2 ${q.status==='assigned'?'go':''}">${incWait(q)}</em>`}</div>`).join('')+(open.length>4?`<div class="imore" data-win="protect">+ jeszcze ${open.length-4} — pokaż wszystkie ›</div>`:''):'<div class="muted">Spokojnie w lesie.</div>';
 }
  const um=unreadMail();$('#mailn').textContent=um?'('+um+')':'';$('#mailbtn').classList.toggle('hot',um>0);
 renderWin();if(state.oddOpen)renderOdd();updateFocusBar();
 renderDecide();info();
}
export const incLabel=q=>q.type==='feed'?'Dowieź karmę':q.type==='dump'?'Wywóz · '+zl(OC.waste):q.type==='assess'?'Wyślij':'Wyślij patrol';
const INC_NAME={trash:'Śmieci w lesie',dump:'Dzikie wysypisko',fire:'Pożar',quad:'Quad / cross',intruder:'Nocny intruz',beetle:'Kornik',assess:'Ocena drzewostanu',feed:'Pusty paśnik',fence:'Siatka do zdjęcia',block:'Drzewa na drodze',carcass:'Padlina przy szosie'};
export const incName=q=>q.type==='trash'&&q.ref&&q.ref.kind==='snare'?'Wnyki':q.type==='intruder'&&q.ref&&q.ref.intruder?({poacher:'Kłusownik',thief:'Złodziej drewna',xmas:'Złodziej choinek'}[q.ref.intruder]||INC_NAME.intruder):INC_NAME[q.type]||'Zgłoszenie';
const INC_COL={fire:'#e0482f',intruder:'#e8732e',quad:'#e8a32e',dump:'#c9a03a',trash:'#d8c23a',beetle:'#b5763a',block:'#a88c62',carcass:'#9a8a7a',feed:'#8ec86a',assess:'#8fae5f',fence:'#8fae5f'};
const incCol=q=>INC_COL[q.type]||'#d9d2b4';
// ── 1.1.2: panel ekip i maszyn (lewy dół): grupy, kropki stanu (zielona: praca, żółta: czeka, szara: bezczynna) ──
const DOT={work:'#8ec86a',wait:'#e8c77a',idle:'#5f6a58'};
const setRow=(dot,id,txt,k)=>{const e=$('#'+id);if(e.textContent!==txt)e.textContent=txt;$('#'+dot).style.background=DOT[k]};
function statusPanel(){
 const crew=C=>{const nt=C.tasks.length+C.cluster.length,held=C.held.length;
  if(C.phase==='idle')return nt?['czeka · '+cal.nextStart(7,17)+' ('+nt+')','wait']:held?['wstrzymane: '+held,'wait']:['wolna','idle'];
  return[{driving:'w drodze',working:'pracuje',leaving:'wraca do bazy'}[C.phase]+(nt?' · zadań '+nt:''),C.phase==='leaving'?'idle':'work']};
 const [ta,ka]=crew(J.crews[0]);setRow('dotA','crewstate',ta,ka);
 $('#crewBrow').style.display=J.crews[1]?'flex':'none';if(J.crews[1]){const [tb,kb]=crew(J.crews[1]);setRow('dotB','crewBstate',tb,kb)}
 {const S=J.skid,nm=S.trac?(S.mach==='forwarder'?'Forwarder':'Ciągnik'):S.owned?'Forwarder':'Zrywka';if($('#skidname').textContent!==nm)$('#skidname').textContent=nm;
  const ph={idle:'czeka na kłody',arriving:'dojeżdża',driving:'jedzie po drewno',in:'w szlaku',load:'ładuje',out:'wraca na drogę',tostack:'wiezie na stos',unload:'układa stos',home:'wraca na plac'};
  if(!S.trac)setRow('dotS','skidstate',S.owned?'w drodze':E.piles.some(p=>!p.dead)?'usługa · '+(cal.work(7,15)?'przyjedzie':cal.nextStart(7,15)):'usługa na wezwanie','idle');
  else if(S.phase==='idle'&&!cal.work(7,17))setRow('dotS','skidstate','po pracy','idle');
  else setRow('dotS','skidstate',ph[S.phase]||S.phase,S.phase==='idle'||S.phase==='home'?'wait':'work')}
 {const PL=R.plow,on=PL.phase!=='idle'||PL.queue.length;$('#plowrow').style.display=on?'flex':'none';
  if(on)setRow('dotP','plowstate',PL.phase==='idle'?'czeka · '+cal.nextStart(7,16)+' ('+PL.queue.length+')':PL.phase==='plowing'?'orze P'+PL.cur.id:PL.phase==='leaving'?'odjeżdża':'w drodze do P'+(PL.cur?PL.cur.id:''),PL.phase==='idle'?'wait':'work')}
 {const T=J.truck,tot=stackTotal(),op=stackTotal(q=>q.sort==='opal');
  setRow('dotT','stackinfo',displayNumber(tot,1)+' m³'+(T.v?' · TIR':T.pending?' · zamówiony':op>.05?' · opał '+displayNumber(op,1):''),T.v?'work':T.pending?'wait':'idle');$('#stackinfo').parentNode.title=J.stacks.filter(q=>q.vol>.05).length+' stosów przy drogach, w tym opał '+displayNumber(op,1)+' m³'+(T.v?'; ciężarówka odbiera drewno':T.pending?'; wywóz zamówiony':'')+'. Kliknij: pokaż największy stos.'}
 const pat=u=>u.phase==='home'?[u.person.sleeping?'śpi':u.person.busyOffice?'w kancelarii':'w leśniczówce','idle']:[{boarding:'wyjeżdża',driving:'w drodze',onsite:'na miejscu',return:'wraca'}[u.phase]+(u.queue.length?' · kolejka '+u.queue.length:''),'work'];
 {const [t,k]=pat(U[0]);setRow('dotL','patrolstate',t,k)}
 $('#podrow').style.display=U[1]?'flex':'none';if(U[1]){const [t,k]=pat(U[1]);setRow('dotD','podstate',t,k)}
}
// klik w wiersz panelu: kamera jedzie do jednostki i ją śledzi
function showUnit(k){
 const go=(o,msg)=>{if(!o||o.dead){toast(msg);return}const [x,y]=o.pos||[o.x,o.y];centerOn(x,y);state.follow=o.pos?o:null;state.selected=o.pos?o:state.selected};
 if(k==='crew0'||k==='crew1'){const C=J.crews[+k.slice(4)];if(!C)return;const w=C.workers.find(q=>!q.dead&&!q.hidden);go(w||C.van,'Ekipa '+C.id+' jest w bazie'+(C.tasks.length?' — przyjedzie '+cal.nextStart(7,17)+'.':'.'))}
 else if(k==='skid')go(J.skid.trac,J.skid.owned?'Forwarder jest w drodze.':'Ciągnik przyjedzie, gdy w lesie leżą kłody.');
 else if(k==='plow')go(R.plow.v,'Pług przyjedzie '+cal.nextStart(7,16)+'.');
 else if(k==='stacks'){if(J.truck.v){go(J.truck.v,'');return}const st=J.stacks.filter(q=>q.vol>.05).sort((a,b)=>b.vol-a.vol)[0];if(st){centerOn(st.x,st.y);state.selected=st;state.follow=null}else toast('Przy drogach nie ma drewna.')}
 else if(k==='pat0'||k==='pat1'){const u=U[+k.slice(3)];if(!u)return;if(u.phase==='home'){const p=u.person;centerOn(p.x,p.y);state.follow=null}else go(u.car,'')}
 hud();
}
// ── 1.1.2: plan na porę roku jako lista rozwijana pod przyciskiem ──
function planPanel(){
 const Pl=ECO.plan;if(!Pl)return;
 const left=(Math.floor(state.days/SEASON_DAYS)+1)*SEASON_DAYS-state.days,dl=Math.floor(left),hl=Math.floor((left-dl)*24);
 const sig=[Pl.doneCut.toFixed(1),Pl.donePlant,Pl.doneHandle,Pl.rewarded,Pl.season,dl,hl].join();if(sig===taskSig)return;taskSig=sig;
 const goals=[[Pl.doneCut>=Pl.cut,'Drewno zerwane do dróg',Math.min(Pl.doneCut,Pl.cut),Pl.cut,' m³',1]];
 if(!(Pl.season===3||!Pl.plant))goals.push([Pl.donePlant>=Pl.plant,'Posadzone sadzonki',Math.min(Pl.donePlant,Pl.plant),Pl.plant,' szt.',0]);
 goals.push([Pl.doneHandle>=Pl.handle,'Obsłużone zgłoszenia',Math.min(Pl.doneHandle,Pl.handle),Pl.handle,'',0]);
 $('#plansum').textContent=goals.filter(g=>g[0]).length+'/'+goals.length;$('#planbtn').classList.toggle('hot',goals.every(g=>g[0]));
 $('#planseason').textContent=SEASONS[Pl.season];
 $('#tasks').innerHTML=goals.map(([ok,txt,a,b,u,d])=>`<div class="pgoal ${ok?'ok':''}"><div class="trow"><span>${ok?'✔':'·'} ${txt}</span><b>${displayNumber(a,d)} / ${b}${u}</b></div><div class="pbar"><i style="width:${Math.round(clamp(a/b,0,1)*100)}%"></i></div></div>`).join('')
  +`<div class="pfoot"><span>${Pl.rewarded?'Plan wykonany — premia wypłacona.':'Premia za cały plan: <b>'+zl(Pl.reward)+'</b>'}</span><span>Do końca pory roku: <b>${dl?dl+' d ':''}${hl} h</b></span></div>`;
}
function placePlan(){const p=$('#plan'),r=$('#planbtn').getBoundingClientRect();p.style.top=Math.round(r.bottom+14)+'px';p.style.left=Math.round(clamp(r.left+r.width/2-150,12,innerWidth-312))+'px'}
export function togglePlan(open){const p=$('#plan');open=open??p.style.display==='none';if(open){taskSig='';planPanel();placePlan()}p.style.display=open?'block':'none';$('#planbtn').setAttribute('aria-expanded',open?'true':'false')}

export const incWait=q=>q.type==='dump'?(q.status==='queued'?'czeka na firmę':'śmieciarka'):q.status==='queued'?'w kolejce':(q.unit&&U.length>1?(q.unit===U[0]?'leśniczy':'podleśniczy')+' działa':'patrol działa');
function treeInfo(t){
 const st=STANDS[oddzial(t.x,t.y)],sp=SP[t.sp];
 if(t.st===STUMP){
  const ren=treesIn(t.x-30,t.y-30,t.x+30,t.y+30).some(q=>q.st===STAND&&q.age<SAPLING_AGE*3);
  const pl=J.plants.some(p=>Math.hypot(p.x-t.x,p.y-t.y)<32);
  return{title:t.burnt?'Spalony pniak':'Pniak — '+sp.name,lines:['Oddział '+st.name+' · '+st.desc,ren?'Odnowione: obok rośnie młode drzewko.':pl?'Sadzonka zaplanowana. Posadzi ją ekipa (E).':'Nieodnowiony. Posadź sadzonkę obok (narzędzie 3).'],btns:ren||pl?[]:[['plantnear','Zaplanuj sadzonkę obok']]};
 }
 if(t.age<SAPLING_AGE)return{title:'Sadzonka — '+sp.name,lines:['Oddział '+st.name+(t.uprawa?' · uprawa w grodzeniu':''),'Wiek: '+lat(t.age)+' · wys. ok. '+displayNumber(Math.max(.2,heightM(t)),1)+' m'],btns:[]};
 const f=sortSplit(t);
 const lines=['Oddział '+st.name+' · '+st.desc,'Wiek: '+lat(t.age)+' · wysokość '+Math.round(heightM(t))+' m','Pierśnica '+Math.round(dbhCm(t))+' cm · miąższość '+displayNumber(volume(t),2)+' m³',
  t.qk?'Jakość: '+QUAL[t.q].name:'Jakość: nieoceniona',
  t.qk?'Sortymenty: '+['tart','pap','opal'].filter(k=>f[k]>0).map(k=>SORTS[k].short+' '+Math.round(f[k]*100)+'%').join(', ')+' · wartość ok. '+zl(treeValue(t)):'Wartość zależy od jakości (po ocenie).',
  'Koszt ścinki '+zl(COST.fell)];
 if(t.kb===4)lines.push('Wiatrołom. Uprzątnij, zanim zasiedli go kornik.');else if(t.kb>=2)lines.push(t.kb===2?'Zamiera (kornik). Tnij sanitarnie.':'Martwe (kornik), drewno sanitarne.');
 if(t.assigned)lines.push('Zlecone ekipie.');
 const btns=t.assigned||t.age<THIN_AGE?[]:[['mark',t.marked?'Usuń oznaczenie':t.age<CUT_AGE||t.q===2&&t.qk?'Wyznacz do trzebieży':'Wyznacz do wycinki']];
 const last=ASSESS.filter(q=>Math.hypot(q.x-t.x,q.y-t.y)<250).sort((a,b)=>b.day-a.day)[0],ago=last?(state.days-last.day)/SEASON_DAYS*YEARS_PER_SEASON:null;
 if(last)lines.push('Cechowanie w tym miejscu: '+(ago<1?'w tym roku':Math.round(ago)+' lat temu')+(ago<10?', kolejne za ok. '+Math.max(1,Math.round(10-ago))+' lat.':'.'));
 if((!t.qk||ago==null||ago>=10)&&!assessing(t.x,t.y))btns.push(['assess','Oceń drzewostan wokół']);
 if(assessing(t.x,t.y))lines.push('Ocena drzewostanu zlecona.');
 if(t.nest)lines.push('Na tym drzewie gniazduje '+({stork:'bocian czarny',bielik:'bielik'}[t.nest]||'rzadki ptak')+' (drzewo i strefa wokół chronione).');
 if(t.mon)lines.push('Pomnik przyrody.');
 if(t.dw)lines.push('Martwe drewno zostaje w lesie.');
 if(canMonument(t))btns.push(['monument','Pomnik przyrody · '+zl(MON_COST)]);
 if(t.kb===3&&!t.nest)btns.push(['deadwood',t.dw?'Zezwól na cięcie sanitarne':'Zostaw jako martwe drewno']);
 btns.push(['odd','Oddział '+st.name]);
 return{title:sp.name[0].toUpperCase()+sp.name.slice(1),lines,btns};
}
function plotInfo(p){
 const st=plotStats(p),spots=p.state==='planting'||p.state==='planted'?0:spotsIn(p.x,p.y,p.w,p.h,(x,y)=>inPlot(p,x,y,-6)).length,stName={new:'nowa',queued:'czeka na pług',prepping:'trwa orka',prepared:'gleba przygotowana',planting:'trwa sadzenie',planted:'obsadzona'}[p.state];
 const lines=['Oddział '+p.odd+' · '+displayNumber(areaHa(p),2)+' ha · '+rowsOf(p).length+' rzędów','Stan: '+stName+' · skład: '+MIXES[p.mix||mixFor(p.sp)].name,
  'Pniaki: '+st.stumps+(st.slash?' (gałęzie: '+st.slash+')':'')+' · drzewa: '+st.stand+' · sadzonki: '+st.young];
 if(st.stand)lines.push('Stojące drzewa zostaną ominięte.');
 if(p.state==='planting')lines.push('Posadzono '+p.planted+' z '+p.toPlant+'.');
 const btns=[];
 if(!p.prepared&&p.state==='new')btns.push(['prep','Przygotuj glebę · '+zl(prepCost(p))]);
 // koszt z uwzględnieniem sadzonek ze szkółki (osobno dla każdego gatunku)
 let fromNur=0;if(spots&&ECO.nursery&&ECO.nursery.sp){const need={};for(const [x,y] of spotsIn(p.x,p.y,p.w,p.h,(x,y)=>inPlot(p,x,y,-6))){const k=mixSp(p,x,y);need[k]=(need[k]||0)+1}for(const k in need)fromNur+=Math.min(need[k],ECO.nursery.sp[k]||0)}
 if(p.state==='new'||p.state==='prepared')btns.push(['mix','Zmień skład gatunkowy']);
 if(spots&&(p.state==='new'||p.state==='prepared'||p.state==='planted'))btns.push(['plantplot','Sadź w rzędach: '+spots+' szt. · '+zl(fromNur*COST.plantNursery+(spots-fromNur)*COST.plant)+(fromNur?' ('+fromNur+' ze szkółki)':'')+(p.prepared?'':' (bez orki)')]);
 if(!p.fence||p.fence==='gone')btns.push(['fence','Ogródź siatką · '+zl(fenceCost(p))]);
 if(p.fence!=='done'&&st.young>0&&p.repel!==seasonKey())btns.push(['repel','Repelent na sezon · '+zl(repelCost(p))]);
 if(p.repel===seasonKey()&&p.fence!=='done')lines.push('Repelent do końca pory roku.');
 lines.push(p.fence==='done'?'Ogrodzona.':p.fence==='building'?'Grodzenie: '+Math.round(p.fenceP/perimOf(p)*100)+'%':'Bez grodzenia: zwierzyna zgryza sadzonki (presja '+Math.round(pressure()*100)+'%).');
 if(p.state!=='prepping'&&p.state!=='planting'&&p.state!=='queued'&&p.fence!=='building')btns.push(['delplot','Usuń powierzchnię']);
 btns.push(['odd','Oddział '+p.odd]);
 return{title:'Powierzchnia odnowieniowa P'+p.id,lines,btns};
}
// 0.8.3: karta decyzji po złapaniu sprawcy (pouczenie / Policja)
let decSig='';
const DECTXT={quad:'Złapany kierujący pojazdem w lesie.',intruder:'Zatrzymany sprawca (nocny intruz).'};
function renderDecide(){
 const el=$('#decide');if(!el)return;
 if(!DEC.inc){decSig='';el.style.display='none';return}
 const w=Math.round(DEC.t),sig=DEC.inc.id+DEC.warn;
 if(sig!==decSig){decSig=sig;el.style.display='block';
  el.innerHTML=`<div class="wh"><b>Patrol na miejscu</b></div><div>${DECTXT[DEC.inc.type]||DEC.inc.text}</div><div class="muted small">${DEC.warn?'Wykroczenie: pouczenie albo Policja (mandat 250 zł, więcej ochrony, ale trzeba czekać na radiowóz).':'Sprawę przejmuje Policja.'}</div><div class="dbtn">${DEC.warn?'<button data-dec="warn">Puść z pouczeniem</button>':''}<button data-dec="police">Wezwij Policję</button></div><div class="dbar"><i id="decbar"></i></div>`}
 const b=$('#decbar');if(b)b.style.width=Math.max(0,Math.min(100,DEC.t/30*100))+'%';
}
function info(){
 const s=state.selected,el=$('#info');
 if(!s||s.dead||(s.status&&(s.status==='done'||s.status==='gone'))){if(state.selected&&(s.dead||s.status))state.selected=null;el.style.display='none';infoSig='';return}
 let I;
 if(s.st!==undefined)I=treeInfo(s);
 else if(s.text)I={title:{quad:'Nielegalny wjazd',fire:'Dym nad lasem',intruder:'Nocny intruz',feed:'Paśnik do uzupełnienia',trash:'Śmieci w lesie',dump:'Dzikie wysypisko',carcass:'Padlina przy szosie'}[s.type]||'Zgłoszenie',lines:[s.text,s.type==='feed'?'Karma: '+zl(ECO.feedCost||120)+' + paliwo.':'',{new:'Czeka na decyzję.',queued:'W kolejce patrolu.',assigned:'Patrol w drodze.'}[s.status]||''].filter(Boolean),btns:[...(s.status==='new'?[['patrol',incLabel(s)]]:[])]};
 else if(s.value!=null&&s.edge&&!s.pos){const sp=spotOf(s),op=sp.find(q=>q.sort==='opal'),so=op?'opal':(s.sort||'tart'),tv=sp.reduce((a,q)=>a+q.value,0);I={title:'Składnica drewna przy drodze, oddz. '+s.odd,lines:['Na składnicy: '+displayNumber(sp.reduce((a,q)=>a+q.vol,0),1)+' m³ · wartość ok. '+zl(Math.round(tv*ECO.market)),sp.map(q=>SORTS[q.sort||'tart'].name+' '+displayNumber(q.vol,1)+' m³').join(' · '),
  so==='opal'?((op||s).truck===false?'Opał dla ludności (petenci, '+zl(PRICE.opal)+'/m³). Ciężarówka go nie bierze.':'Ciężarówka może zabrać ten opał (taniej niż petentom).'):'Cena rynkowa ×'+displayNumber(ECO.market,2)+'',
  'Do wywozu: '+displayNumber(truckTotal(),1)+' m³ (od 10 m³ transport przyjedzie sam). Opał: '+displayNumber(stackTotal(q=>q.sort==='opal'),1)+' m³.','Sprzedano łącznie: '+displayNumber(J.sold,1)+' m³.'],
  btns:[...(so==='opal'?[['opaltruck',(op||s).truck===false?'Pozwól zabrać ciężarówce':'Zostaw dla ludności']]:[]),...(J.truck.v?[]:[['truck','Zamów wywóz teraz']])]}}
 else if(s.shots!==undefined&&s.outings!==undefined)I={title:'Ambona '+(s.id+1),lines:['Wyjść myśliwych: '+s.outings+' · pozyskano: '+s.got+' szt.','Zasięg ok. '+AMB_R+' px. Myśliwy wychodzi wieczorem i o świcie, dopóki trwa plan łowiecki.'],btns:[]};
 else if(s.level!=null&&s.name)I={title:'Paśnik '+s.name,lines:['Karma: '+Math.round(s.level*100)+'%',cal.season()===3?'Zimą karma ubywa. Przy niskim poziomie pojawi się zadanie.':'Poza zimą stoi nieużywany.'],btns:[]};
 else if(s.day!=null&&s.vol!=null&&s.edge)I={title:'Drewno opałowe do odbioru',lines:['Sprzedane w kancelarii: '+displayNumber(s.vol,1)+' m³','Nabywca przyjedzie ciągnikiem z przyczepą.'],btns:[]};
 else if(s.pos)I={title:VSPEC[s.kind].name[0].toUpperCase()+VSPEC[s.kind].name.slice(1),lines:[s.label||'',s.cart?'Ładunek: '+displayNumber(s.load,1)+' / '+s.cap+' m³':'',s.illegal?'Wjazd pojazdów silnikowych do lasu jest zabroniony.':''].filter(Boolean),btns:[...(s.illegal&&s.inc&&s.inc.status==='new'?[['patrol','Wyślij patrol']]:[])]};
 else if(s.kind&&ASPEC[s.kind])I={title:s.name||ASPEC[s.kind].name,lines:[{idle:'Odpoczywa / żeruje',walk:'Wędruje',run:'Ucieka!'}[s.state]||'',s.male&&s.kind==='deer'?'Byk z porożem':s.male&&s.kind==='roe'?'Rogacz':s.sow?'Locha prowadząca warchlaki (pod ochroną)':'',FA.pop[s.kind==='piglet'?'boar':s.kind]!=null?'W obwodzie: '+NAMES[s.kind==='piglet'?'boar':s.kind]+' ok. '+FA.pop[s.kind==='piglet'?'boar':s.kind]+' szt.':'',s.kind==='wolf'?'Gatunek chroniony — reguluje liczebność saren i jeleni.':''].filter(Boolean),btns:[]};
 else if(s.look)I={title:s.label?s.label[0].toUpperCase()+s.label.slice(1):'Osoba',lines:[s.kind==='picker'?(s.berry?'Zbiera jagody w borze. Czasem zostawia śmieci…':'Zbiera grzyby. Czasem zostawia śmieci…'):s.kind==='worker'?'Pracownik ekipy leśnej.':s.kind==='lesniczy'?(s.unit&&s.unit!==U[0]?'Podleśniczy: drugi patrol, dyżur w kancelarii.':'Prowadzi leśnictwo. Wyjeżdża na interwencje.'):s.kind==='hunter'?'Koło łowieckie: plan odstrzału '+['roe','deer','boar'].map(k=>FA.culled[k]+'/'+FA.plan[k]).join(', ')+' (sarny, jelenie, dziki).':s.petent?'Petent czeka przed kancelarią.':'Odpoczywa w lesie.'],btns:[]};
 else if(s.logs&&s.edge&&s.day!=null&&!s.state)I={title:'Opał do odbioru',lines:['Kupka drewna opałowego ('+displayNumber(s.vol,1)+' m³) sprzedanego petentowi; nabywca odbiera ją sam w godzinach pracy.','Jeśli zalega przy drodze, możesz ją usunąć.'],btns:[['rmpile','Usuń kupkę']]};
 else if(s.logs&&s.state)I={title:'Kłody — '+SP[s.sp].name,lines:['Miąższość '+displayNumber(s.vol,2)+' m³: '+Object.entries(pileSorts(s)).filter(([,v])=>v>.01).map(([k,v])=>SORTS[k].short+' '+displayNumber(v,2)).join(', '),s.state==='ground'?'Czeka na zrywkę.':'Ciągnik już po nie jedzie.'],btns:s.state==='ground'?[['rmpile','Usuń kłody (strata drewna)']]:[]};
 else if(s.toPlant!==undefined)I=plotInfo(s);
 if(!I){el.style.display='none';return}
 const sig=JSON.stringify(I),fresh=sig!==infoSig;infoSig=sig;
 if(fresh)el.innerHTML=`<div class="wh"><b>${I.title}</b><button class="xbtn sm" data-x="info" aria-label="Zamknij">✕</button></div>`+I.lines.map(l=>`<div class="ln">${l}</div>`).join('')+(I.btns.length?`<div class="ibtns">${I.btns.map(([k,t])=>`<button data-ia="${k}">${t}</button>`).join('')}</div>`:'')+(s.pos||s.look||(s.kind&&ASPEC[s.kind]&&!s.edge)?`<div class="muted small">F: śledź kamerą</div>`:'');
 el.style.display='block';placeInfo(el,s);
}
// 0.7.3: okno z opcjami pojawia się przy klikniętym obiekcie (nie w rogu ekranu) i podąża za kamerą
export function repositionInfo(){const el=$('#info');if(el&&el.style.display==='block'&&state.selected)placeInfo(el,state.selected)}
function placeInfo(el,s){
 const cv=$('#game'),r=cv.getBoundingClientRect(),plot=s.toPlant!==undefined,bx=s.pos?s.pos[0]:s.x,by=s.pos?s.pos[1]:s.y,ax=bx+(plot?s.w/2:0),ay=by+(plot?s.h/2:0)-(s.st===undefined?0:6);
 const sx=r.left+(ax-camera.x)*r.width/VIEW.w,sy=r.top+(ay-camera.y)*r.height/VIEW.h,w=el.offsetWidth||300,h=el.offsetHeight||120;
 let x=sx+24,y=sy-h/2;if(x+w>innerWidth-8)x=sx-24-w;x=clamp(x,8,innerWidth-w-8);y=clamp(y,8,innerHeight-h-8);
 el.style.position='fixed';el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px';el.style.bottom='auto';
}
// ── Karta oddziału (O) ──
// 1.1: trzy sekcje (Drzewostan, Do zrobienia, Stan), granice oddziału podświetlone w świecie (focus.js) i dopasowanie kamery.
let oddId=null,oddT=0,oddSig='';
const inOdd=(t,B)=>t.x>=B.x0&&t.x<B.x1&&t.y>=B.y0&&t.y<B.y1;
export function toggleOdd(open,id){
 const el=$('#oddcard');open=open??!state.oddOpen;
 if(open){const s=state.selected,c=s&&(s.pos||[s.x,s.y]);const px=c?c[0]:camera.x+VIEW.w/2,py=c?c[1]:camera.y+VIEW.h/2;
  oddId=String(id||oddzial(px,py));state.oddOpen=true;state.oddFocus=oddId;oddT=0;oddSig='';el.style.display='block';renderOdd(true)}
 else{state.oddOpen=false;state.oddFocus=null;el.style.display='none'}
}
export function renderOdd(force){
 oddT-=.15;if(!force&&oddT>0)return;oddT=1;
 const S=oddStats(oddId),d=S.def,row=(a,b)=>`<div class="srow"><span>${a}</span><i>${b}</i></div>`;
 const tot=Math.max(1,S.stand),sp=Object.entries(S.sp).sort((a,b)=>b[1]-a[1]);
 const bar=`<div class="spbar">${sp.map(([k,n])=>`<i style="width:${n/tot*100}%;background:${SPCOL[k]}" title="${SP[k].name}"></i>`).join('')}</div><div class="splg">${sp.map(([k,n])=>`<span><i style="background:${SPCOL[k]}"></i>${SP[k].name.split(' ')[0]} ${Math.round(n/tot*100)}%</span>`).join('')}</div>`;
 const ago=S.lastAssess!=null?(state.days-S.lastAssess)/SEASON_DAYS*YEARS_PER_SEASON:null;
 const q=S.assessed?`${Math.round(S.assessed/Math.max(1,S.aged)*100)}% ocenione: dorodne ${S.q[0]}, przeciętne ${S.q[1]}, wadliwe ${S.q[2]}`:'nieocenione';
 const res=NAT.reserve.includes(S.id),hl=String(state.showStumps)===String(S.id);
 const html=`<div class="wh"><b>Oddział ${S.id}</b><button class="xbtn sm" data-x="odd" aria-label="Zamknij">✕</button></div><div class="ln">${d.desc}</div>
  <div class="ibtns"><button data-oa="fit">Pokaż cały oddział</button><button class="sec" data-oa="res">${res?'Znieś rezerwat':'Utwórz rezerwat · '+zl(RES_COST)}</button></div>
  <div class="osec"><h4>Drzewostan</h4>${bar}
  ${row('Drzewa',S.stand+' (w tym sadzonki '+S.sapl+')')}${row('Średni wiek',S.aged?lat(S.age):'—')}${row('Miąższość',displayNumber(S.vol,0)+' m³')}
  ${row('Dojrzałe (od '+CUT_AGE+' lat)',S.mature)}${row('Do trzebieży ('+THIN_AGE+'–'+(CUT_AGE-1)+' lat)',S.thin)}${row('Jakość',q)}</div>
  <div class="osec"><h4>Do zrobienia</h4>
  ${row('Oznaczone do cięcia',S.marked?S.marked+' drz. · '+displayNumber(S.markedVol,0)+' m³':'—')}
  ${row('Pniaki / w tym nieodnowione',S.stumps+' / <b class="'+(S.unren?'warnv':'')+'">'+S.unren+'</b>')}
  ${S.unren?`<div class="ibtns"><button data-oa="stumps">${hl?'Wyłącz podświetlenie':'Pokaż nieodnowione pniaki'}</button><button data-oa="plant">Posadź przy nieodnowionych pniakach (${S.unren})</button></div>`:''}
  ${row('Otwarte zgłoszenia',S.incidents||'—')}${row('Ostatnie cechowanie',ago==null?'nigdy':ago<1?'w tym roku':Math.round(ago)+' lat temu')}</div>
  <div class="osec"><h4>Stan</h4>
  ${row('Zamierające (kornik, wiatrołomy)',S.sick||'—')}${row('Powierzchnie odnowieniowe',S.plots.length?S.plots.length+' (ogrodzone '+S.fenced+')':'—')}${row('Rezerwat',res?'tak — bez wycinki':'nie')}</div>`;
 if(html===oddSig)return;oddSig=html;$('#oddcard').innerHTML=html;
}
function oddAct(k){
 const B=oddBounds(oddId);
 if(k==='fit'){state.follow=null;dispatchEvent(new CustomEvent('las-fit',{detail:B}))}
 else if(k==='res'){makeReserve(oddId);hud()}
 else if(k==='stumps')showStumps(String(state.showStumps)===oddId?false:+oddId);
 else if(k==='plant')plantAtStumps(ECO.unrenList.filter(t=>inOdd(t,B)));
 oddSig='';renderOdd(true);
}
// ── panel Leśniczówki (L) ──
let baseSig='',baseTab='kadry';const hintOpen=new Set();
const hint=(k,t)=>`<p class="hint2">${t}</p>`;
export function toggleBase(open){
 const el=$('#base');open=open??el.classList.contains('hidden');
 if(open){if(state.modal&&!state.panel)return;if(!state.modal)state.wasPaused=state.paused;el.classList.remove('hidden');state.panel=true;state.modal=true;state.paused=true;baseSig='';renderBase()}
 else{el.classList.add('hidden');if(state.panel&&state.modal){state.modal=false;state.paused=!!state.wasPaused}state.panel=false}
}
export function openBaseTab(t){baseTab=t;baseSig='';toggleBase(true)}
export function renderBase(){
 const row=(a,b)=>`<div class="rrow"><span>${a}</span><b>${b}</b></div>`,btn=(k,t,dis,sec)=>`<button data-b="${k}" ${dis?'disabled':''} class="${sec?'sec':''}">${t}</button>`;
 const B=BASE.stats,crewB=!!J.crews[1],pod=ECO.staff.pod,pr=pressure();
 const meter=v=>`<div class="meter"><i style="width:${Math.round(clamp(v,0,1)*100)}%"></i></div>`;
const SEC={
  kanc:`<div class="bsec"><h3>KANCELARIA</h3><p class="hint2">Petenci przychodzą pon.–pt. 8–15: opał (${zl(PRICE.opal)}/m³), zezwolenia, sadzonki. Ktoś musi być w kancelarii.</p>
  ${row('Petenci obsłużeni / nieobsłużeni',B.visits+' / '+B.missed)}${row('Sprzedany opał',displayNumber(B.opalVol,1)+' m³ ('+B.opal+' umów)')}${row('Zezwolenia / sadzonki',B.permits+' / '+B.seedlings)}
  ${BASE.log.length?'<p class="hint2">'+BASE.log.slice(0,3).join(' · ')+'</p>':''}</div>`,
  kadry:`<div class="bsec"><h3>KADRY</h3>
  ${row('Ekipa A (pilarze)','stała umowa')}${row('Ekipa B',crewB?'zatrudniona · '+zl(COST.crewB)+' za dzień pracy':'—')}
  ${crewB?btn('fireB','Rozwiąż umowę z ekipą B',false,true):btn('hireB','Zatrudnij ekipę B · '+zl(COST.crewB)+' za dzień pracy')}
  ${row('Podleśniczy',pod?'pracuje · '+zl(COST.pod)+'/dzień':BASE.garage?'—':'wymaga garażu')}
  ${pod?btn('firePod','Zwolnij podleśniczego',false,true):btn('hirePod','Zatrudnij podleśniczego · '+zl(COST.pod)+'/dzień',!BASE.garage)}
  ${hint('kadry',`Podleśniczy to drugi patrol i dyżur w kancelarii. Ekipy dzielą zadania po skupiskach.`)}</div>`,
  bud:`<div class="bsec"><h3>BUDYNKI</h3>
  ${row('Szkółka leśna',BASE.nursery?'sadzonek: '+ECO.nursery.stock:'—')}${BASE.nursery?meter(ECO.nursery.stock/1200)+row('Zapas',nurseryText())+row('Produkcja',NPLANS[BASE.nplan||0].name)+btn('nplan','Zmień plan szkółki'):btn('nursery','Zbuduj szkółkę · '+zl(BUILD.nursery))}
  ${row('Garaż z magazynem',BASE.garage?'gotowy · karma '+zl(ECO.feedCost):'—')}${BASE.garage?'':btn('garage','Zbuduj garaż z magazynem · '+zl(BUILD.garage))}
  ${hint('bud',`Sadzonka ze szkółki: ${zl(COST.plantNursery)} zamiast ${zl(COST.plant)}, lepiej się przyjmuje. Garaż: druga terenówka i tańsza karma.`)}</div>`,
  sprz:`<div class="bsec"><h3>SPRZĘT</h3>
  ${row('Zrywka',J.skid.owned?MACH.forwarder.name+' (własny)':MACH.tractor.name+' (usługa)')}${J.skid.owned?row('Utrzymanie forwardera',zl(COST.fwd)+' za dzień pracy'):`<div class="offer"><b>Forwarder z żurawiem · ${zl(MACH.forwarder.price)}</b><span>Utrzymanie: ${zl(COST.fwd)} za każdy dzień, w którym pracuje (dni bez pracy nic nie kosztują).</span><span>Ładowność ${MACH.forwarder.cap} m³ zamiast ${MACH.tractor.cap} m³, ładuje żurawiem, stoi na placu — nie czeka na przyjazd usługi. Stawka zrywki na fakturze bez zmian: ${zl(COST.skid)}/m³.</span></div>${btn('fwd','Kup forwarder · '+zl(MACH.forwarder.price))}`}
  ${row('Drewno przy drogach',displayNumber(stackTotal(),1)+' m³ · ok. '+zl(Math.round(stackValue()*ECO.market)))}${row('w tym opał dla ludności',displayNumber(stackTotal(q=>q.sort==='opal'),1)+' m³')}${row('Cena rynkowa','×'+displayNumber(ECO.market,2))}
  ${J.truck.v?'':btn('truck','Zamów wywóz drewna')}
  ${(()=>{const c=costParts(),v=[c.varB?'ekipa B '+zl(c.varB):'',c.varF?'forwarder '+zl(c.varF):''].filter(Boolean).join(', ');return row('Koszty dzienne stałe',zl(c.fixed))+(v?row('Tylko za dzień pracy',v):'')})()}</div>`,
  zdr:`<div class="bsec"><h3>ZDROWIE LASU</h3>
  ${row('Pogoda',WX[HL.wx])}${row('Susza ściółki',Math.round(HL.dry*100)+'%')}${meter(HL.dry)}${row('Zagrożenie pożarowe',LVLN[fireLvl()])}
  ${row('Zamierające drzewa (widoczne)',sick())}${row('Zatarasowane drogi',HL.blocks.length)}${row('Cięte sanitarnie',HL.stats.cutSan)}
  ${btn('traps',trapsOn()?'Pułapki feromonowe wyłożone':'Pułapki feromonowe na kornika · '+zl(HC.traps)+'/rok',trapsOn())}
  ${btn('tower',HL.tower?'Wieża przeciwpożarowa działa':'Zbuduj wieżę przeciwpożarową · '+zl(HC.tower),HL.tower)}
  ${btn('ban',HL.ban?'Zniesienie zakazu wstępu do lasu':'Zakaz wstępu do lasu · '+zl(40)+'/dzień',false,HL.ban)}
  ${hint('zdr',`Kornik zasiedla świerki po cichu, rude korony widać po kilku dniach. Susza i wiatrołomy mu sprzyjają, pułapki hamują.`)}</div>`,
  porz:`<div class="bsec"><h3>PORZĄDEK W LESIE</h3>
  ${row('Fotopułapki przy wjazdach',camsOn()?'działają · '+zl(OC.camsDay)+'/dzień':'—')}${camsOn()?'':btn('cams','Zamontuj fotopułapki · '+zl(OC.cams))}
  ${row('Szlabany na wjazdach',barClosed()?'zamknięte':'otwarte')}${btn('bar',barClosed()?'Otwórz szlabany':'Zamknij szlabany',false,barClosed())}
  ${row('Parking leśny z koszem',parkingOn()?'jest · '+zl(OC.parkingDay)+'/dzień':'—')}${parkingOn()?'':btn('parking','Zbuduj parking przy szosie · '+zl(OC.parking))}
  ${hint('porz',`Fotopułapki zgłaszają wjazdy i wysypiska od razu. Szlabany ograniczają wjazdy od szosy, ale bez parkingu ubywa też grzybiarzy. Wywóz wysypiska: ${zl(OC.waste)}.`)}</div>`,
  fin:`<div class="bsec"><h3>FINANSE</h3>
  ${row('Faktury do zapłaty',owedCount()?owedCount()+' · '+zl(owedTotal()):'—')}${owedCount()?btn('payall','Zapłać wszystkie · '+zl(owedTotal())):''}
  ${btn('autopay',FIN.auto?'Płacenie automatyczne: włączone':'Płacenie automatyczne: wyłączone',false,true)}
  ${row('Pożyczka',FIN.loan?'zostało '+zl(FIN.loan.left)+' · rata '+zl(FIN.loan.inst):'—')}${FIN.loan?btn('repay','Spłać całość · '+zl(FIN.loan.left),false,true):LOANS.map((l,k)=>btn('loan'+k,'Pożyczka '+zl(l.amount)+' · '+Math.round(l.rate*100)+'%, '+l.parts+' rat')).join('')}
  ${hint('fin',`Faktura przychodzi co dzień, termin to jedna pora roku. Po terminie: upomnienie (+5%), po porze roku wezwanie (+10%, ekipy czekają na zapłatę), po trzech porach windykacja (+15%). Pożyczka: jedna naraz, raty na początku pory roku.`)}</div>`,
  znaki:`<div class="bsec"><h3>ZNAKI I EDUKACJA</h3>
  ${row('Znaki zakazu wjazdu',signsOn()?'stoją przy wjazdach':'—')}${signsOn()?'':btn('buysigns','Postaw znaki zakazu wjazdu · '+zl(VC.signs))}
  ${row('Odstraszacze zwierzyny przy szosie',repelOn()?'działają · '+zl(VC.repelDay)+'/dzień':'—')}${repelOn()?'':btn('buyrepel','Znaki A-18b i słupki z odblaskami · '+zl(VC.repel))}
  ${row('Ścieżka przyrodnicza',trailOn()?'otwarta · wycieczek: '+vs().tours+' ('+vs().kids+' uczniów)':'—')}${trailOn()?'':btn('buytrail','Zbuduj ścieżkę przyrodniczą · '+zl(VC.trail))}
  ${hint('znaki',`Znaki ograniczają wjazdy quadów, odstraszacze potrącenia zwierzyny. Ścieżka przyrodnicza: wycieczki w dni robocze, każda zostawia ${zl(VC.tourFee)}.`)}</div>`,
  przyr:`<div class="bsec"><h3>PRZYRODA — DZIENNIK OBSERWACJI</h3>
  ${journalRows().map(([a,b])=>row(a,b)).join('')}
  ${row('Rezerwaty',NAT.reserve.length?NAT.reserve.map(q=>'oddz. '+q).join(', '):'—')}${row('Pomniki przyrody',NAT.monuments.length+' / 3')}${row('Martwe drewno (zostawione)',NAT.dw)}${row('Bogactwo przyrody','×'+displayNumber(richness(),1))}
  ${NAT.log.slice(0,4).map(e=>`<p class="hint2">${e.text}</p>`).join('')}
  ${hint('przyr',`Rzadkie ptaki przylatują raz, wokół gniazda jest strefa ochronna. Rezerwat, pomniki i martwe drewno zwiększają szansę na przylot.`)}</div>`,
  kolo:`<div class="bsec"><h3>KOŁO ŁOWIECKIE</h3>
  ${['roe','deer','boar','fox','hare'].map(k=>row(NAMES[k][0].toUpperCase()+NAMES[k].slice(1),FA.pop[k]+(FA.plan[k]!=null?' · plan '+FA.culled[k]+'/'+FA.plan[k]:''))).join('')}
  ${row('Ambony',AMB.list.length+' / '+AMB_MAX+' · '+AMB.list.reduce((a,q)=>a+q.got,0)+' szt. pozyskano')}${nextAmbonaSlot()==null?'':btn('ambona','Wybuduj ambonę '+AMBONY[nextAmbonaSlot()].name+' · '+zl(AMB_COST))}
  <p class="hint2">Każda ambona ma własnego myśliwego (wieczorem i o świcie, zasięg ok. ${AMB_R} px). Miejsca są stałe.</p>
  ${row('Wilki (wędrowne, chronione)',FA.wolf.present?'wataha: '+FA.wolf.size+' os. · jeszcze ok. '+Math.max(1,Math.ceil(FA.wolf.until-state.days))+' dni':'nie ma w lesie')}
  ${row('Presja na uprawy',Math.round(pr*100)+'%')}${meter(pr/2)}
  ${FA.reduction?'<p class="hint2">Odstrzał redukcyjny przyjęty — myśliwi co wieczór na ambonie.</p>':btn('reduce','Wniosek o odstrzał redukcyjny',pr<1.05)}</div>`,
  pas:`<div class="bsec"><h3>PAŚNIKI (${FA.feeders.length}/${FEED_MAX})</h3>
  ${FA.feeders.map(f=>row(f.name,Math.round(f.level*100)+'%')+meter(f.level)).join('')}
  ${nextFeederSlot()==null?'':btn('pasnik','Wybuduj paśnik '+FEEDERS[nextFeederSlot()].name+' · '+zl(FEED_COST))}
  ${hint('pas',`Pusty paśnik zimą to zadanie dla patrolu (${zl(ECO.feedCost||120)} za karmę). Maks. ${FEED_MAX} paśniki.`)}</div>`
 };
 const TABS=[['kadry','Kadry',['kanc','kadry']],['sprzet','Budynki i sprzęt',['bud','sprz']],['fin','Finanse',['fin']],['las','Las i porządek',['zdr','porz']],['przyr','Przyroda',['znaki','przyr']],['lowy','Łowiectwo',['kolo','pas']]];
 const tab=TABS.find(t=>t[0]===baseTab)||TABS[0],badge={fin:owedCount()?owedCount():0,las:(sick()>0?1:0)+(HL.blocks.length?1:0)};
 const od=FIN.inv.some(i=>!i.paid&&(i.st||0)>=1);const tile=(a,b,c)=>`<div class="tile ${c||''}"><span>${a}</span><b>${b}</b></div>`;
 const html=`<div class="whead"><div><div class="kicker">Leśnictwo Zielony Gaj · ${DOW[cal.dow()]}, ${SEASONS[cal.season()]}</div><h1>Leśniczówka</h1></div><button class="xbtn" data-x="base" title="Zamknij (Esc)" aria-label="Zamknij">✕</button></div>
 <div class="tiles">${tile('Budżet',zl(Math.round(state.money)),state.money<0?'bad':'')}${(()=>{const c=costParts(),v=c.varB+c.varF;return `<div class="tile" title="${costText()}"><span>Koszty dzienne</span><b>${zl(c.fixed)}${v?' <small>+ do '+zl(v)+'</small>':''}</b>${v?'<em>dopłata tylko za dni pracy</em>':''}</div>`})()}${tile('Faktury do zapłaty',owedCount()?owedCount()+' · '+zl(owedTotal()):'brak',dunning()?'bad':owedCount()?'warn':'')}${tile('Zagrożenie pożarowe',LVLN[fireLvl()])}</div>
 <div class="tabs">${TABS.map(t=>`<button class="tab ${t[0]===tab[0]?'on':''}" data-tab="${t[0]}">${t[1]}${badge[t[0]]?' <i>'+badge[t[0]]+'</i>':''}</button>`).join('')}</div>
 <div class="bgrid">${tab[2].map(k=>SEC[k]).join('')}</div>
 <div class="wfoot"><button id="base-close">ZAMKNIJ (L / Esc)</button></div>`;
 if(html===baseSig)return;baseSig=html;$('#basecard').innerHTML=html;
 $('#base-close').onclick=()=>toggleBase(false);
}
export function centerOn(x,y){camera.x=x-VIEW.w/2;camera.y=y-VIEW.h/2}
// Raport z sezonu (0.2): podsumowanie pory roku, skok wzrostu lasu, nowy plan. Gra stoi, dopóki gracz nie kliknie „Dalej”.
const sgn=(n,d=0)=>(n>=0?'+':'−')+displayNumber(Math.abs(n),d);
export function showReport(r){
 const S=r.st,P=r.plan,N=ECO.plan;
 const row=(a,b)=>`<div class="rrow"><span>${a}</span><b>${b}</b></div>`;
 $('#reportcard').innerHTML=`<div class="whead"><div><div class="kicker">Raport z sezonu · rok ${r.year}</div><h1>${SEASONS[r.season][0].toUpperCase()+SEASONS[r.season].slice(1)} — podsumowanie</h1></div><button class="xbtn" data-x="report" title="Dalej (Enter / Esc)" aria-label="Dalej">✕</button></div>
  <p class="verdict">${r.verdict}</p><div class="rep">
  ${row('Drewno zerwane do dróg',displayNumber(S.delivered,1)+' m³')}${row('Drewno sprzedane — wywóz ciężarówką',displayNumber(S.sold,1)+' m³')}${row('Opał sprzedany w kancelarii',displayNumber(S.opal||0,1)+' m³')}
  ${row('Ścięte drzewa / posadzone sadzonki',S.felled+' / '+S.planted)}${row('Zgłoszenia obsłużone / zignorowane',S.handled+' / '+S.ignored)}
  ${row('Przychody / wydatki','+'+zl(S.earned)+' / −'+zl(S.spent))}
  ${row('Budżet',zl(r.money)+' ('+sgn(r.money-S.money0)+' zł)')}${row('Stan lasu',Math.round(r.health)+'% ('+sgn(r.health-S.health0)+')')}${row('Ochrona terenu',Math.round(r.protect)+'% ('+sgn(r.protect-S.protect0)+')')}
  ${row('Plan nadleśnictwa',P.rewarded?'wykonany (+'+zl(P.reward)+')':'niewykonany')}</div>
  ${row('Cena drewna w minionym sezonie','×'+displayNumber(r.market,2)+' → teraz ×'+displayNumber(r.nextMarket,2))}
  ${r.fauna?row('Zwierzyna (sarny / jelenie / dziki)',r.fauna.pop.roe+' / '+r.fauna.pop.deer+' / '+r.fauna.pop.boar):''}
  ${r.fauna&&r.fauna.wolfDays?row('Wilki w lesie (dni)',r.fauna.wolfDays):''}
  ${r.fauna?row('Odstrzał koła łowieckiego w sezonie',r.fauna.cull+' szt.'):''}
  ${r.fauna&&r.fauna.fed!=null?row('Paśniki z karmą przez zimę',Math.round(r.fauna.fed*100)+'%'):''}
  ${r.fauna?row('Zgryzione sadzonki (zniszczone)',r.fauna.browsed+' ('+r.fauna.browsedKilled+')'):''}
  ${r.nursery?row('Szkółka: nowe sadzonki',r.nursery):''}
  <p>Las urósł o ${r.years} lata.${r.grown?' '+r.grown+' sadzonek wyrosło na młode drzewka.':''}${r.young?' Udatność nowych upraw: '+Math.round((1-r.died/r.young)*100)+'% (nie przyjęło się: '+r.died+').':''}${r.unrenewed?' Pniaków bez odnowienia: '+r.unrenewed+'.':''}</p>
  ${r.fauna&&r.fauna.browsed>20?'<p><b>Zgryzanie!</b> Sarny i jelenie niszczą niegrodzone uprawy. Ogródź powierzchnie (karta powierzchni) albo złóż wniosek o odstrzał redukcyjny (L).</p>':''}
  ${r.next===3?'<p><b>Zima:</b> ekipa nie sadzi, a paśniki trzeba uzupełniać karmą.</p>':r.next===0?'<p><b>Wiosna:</b> okres lęgowy — w oddz. 103 wycinka czeka do lata. Uwaga na wypalanie traw.</p>':r.next===2?'<p><b>Jesień:</b> grzybiarze w lesie i rykowisko o zmierzchu.</p>':''}
  <p><b>Teraz ${SEASONS[r.next]}.</b> Nowy plan: ${N.cut} m³ drewna, ${N.plant?N.plant+' sadzonek, ':''}${N.handle} zgłoszenia${N.plant?'':' (zimą bez sadzenia)'} — premia ${zl(N.reward)}.</p>
  <button id="report-close">DALEJ</button>`;
 if(!state.modal)state.wasPaused=state.paused;
 $('#report').classList.remove('hidden');state.paused=true;state.modal=true;
 $('#report-close').onclick=()=>{$('#report').classList.add('hidden');state.paused=!!state.wasPaused;state.modal=false;taskSig='';hud()};
}
export function bindUI(){
 for(const b of document.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>setTool(b.dataset.tool));
 $('#crewbtn').addEventListener('click',dispatchCrew);$('#cancelbtn').addEventListener('click',clearOrders);$('#sellbtn').addEventListener('click',()=>orderTruck(true));
 $('#decide').addEventListener('click',e=>{const b=e.target.closest('[data-dec]');if(b){decide(b.dataset.dec);renderDecide()}});
 $('#incidents').addEventListener('click',e=>{
  const b=e.target.closest('[data-inc]');if(b){const q=E.incidents.find(x=>x.id==b.dataset.inc);dispatch(q);incSig='';hud();return}
  const g=e.target.closest('[data-go]');if(g){const q=E.incidents.find(x=>x.id==g.dataset.go);if(q){centerOn(q.x,q.y);state.selected=q;state.follow=null;hud()}}
 });
 $('#info').addEventListener('click',e=>{
  const b=e.target.closest('[data-ia]');if(!b)return;const s=state.selected,k=b.dataset.ia;
  if(k==='mark'){toggleMark(s)}
  else if(k==='patrol'){dispatch(s.text?s:s.inc)}
  else if(k==='truck')orderTruck(true);
  else if(k==='fence')orderFence(s);
  else if(k==='mix')cycleMix(s);
  else if(k==='opaltruck'){const o=spotOf(s).find(q=>q.sort==='opal')||s;o.truck=o.truck===false;toast(o.truck?'Ten opał może zabrać ciężarówka.':'Opał zostaje dla ludności.')}
  else if(k==='rmpile'){s.dead=true;state.selected=null;toast('Kupkę usunięto.');hud()}
  else if(k==='assess')orderAssess(s.x,s.y);
  else if(k==='monument')makeMonument(s);else if(k==='deadwood')toggleDeadwood(s);
  else if(k==='odd')toggleOdd(true,oddzial(s.x+(s.w?s.w/2:0),s.y+(s.h?s.h/2:0)));
  else if(k==='repel')orderRepel(s);
  else if(k==='prep')orderPrep(s);else if(k==='plantplot')orderPlant(s);else if(k==='delplot'){removePlot(s);if(!R.plots.includes(s))state.selected=null}
  else if(k==='plantnear'){const r=plantNear(s);if(r==='ok')sfx('mark');else toast(r==='plan'?'Sadzonka przy tym pniaku jest już zaplanowana.':'Przy tym pniaku nie ma miejsca na sadzonkę.')}
  infoSig='';hud();
 });
 $('#basebtn').addEventListener('click',()=>toggleBase(true));
 $('#planbtn').addEventListener('click',e=>{e.stopPropagation();togglePlan()});
 document.addEventListener('click',e=>{if(!e.target.closest('#plan')&&$('#plan').style.display!=='none')togglePlan(false)});
 addEventListener('resize',()=>{if($('#plan').style.display!=='none')placePlan()});
 $('#status').addEventListener('click',e=>{const r=e.target.closest('[data-unit]');if(r&&state.playing&&!state.modal)showUnit(r.dataset.unit)});
 $('#oddcard').addEventListener('click',e=>{const b=e.target.closest('[data-oa]');if(b)oddAct(b.dataset.oa)});
 $('#moneybtn').addEventListener('click',()=>{if(state.playing)openBaseTab('fin')});
 $('#qbtn').addEventListener('click',()=>{const q=E.incidents.find(x=>x.status==='new');if(q)dispatch(q);else toast('Brak nowych zgłoszeń.')});
 $('#basecard').addEventListener('click',e=>{
  const tb=e.target.closest('[data-tab]');if(tb){baseTab=tb.dataset.tab;baseSig='';renderBase();return}
  const hs=e.target.closest('[data-hk]');if(hs){e.preventDefault();const k=hs.dataset.hk;hintOpen.has(k)?hintOpen.delete(k):hintOpen.add(k);baseSig='';renderBase();return}
  const b=e.target.closest('[data-b]');if(!b)return;const k=b.dataset.b;
  ({buysigns:buySigns,buyrepel:buyRepel,buytrail:buyTrail,payall:payAllInvoices,autopay:toggleAutoPay,loan0:()=>takeLoan(0),loan1:()=>takeLoan(1),loan2:()=>takeLoan(2),repay:repayLoan,ambona:()=>buyAmbona(nextAmbonaSlot()),pasnik:()=>buyFeeder(nextFeederSlot()),nplan:cycleNursery,hireB:hireCrewB,fireB:fireCrewB,hirePod:hireDeputy,firePod:fireDeputy,nursery:buildNursery,garage:buildGarage,fwd:buyForwarder,truck:()=>orderTruck(true),reduce:requestReduction,traps:buyTraps,tower:buildTower,ban:toggleBan,cams:buyCams,bar:toggleBarriers,parking:buyParking})[k]?.();
  baseSig='';renderBase();hud()});
 // 1.0: spójne zamykanie okien — ✕, klik w tło (poza kartą); Esc obsługuje input.js
 document.addEventListener('click',e=>{
  const x=e.target.closest('.xbtn,.wclose');const id=x?x.dataset.x:(e.target.classList&&e.target.classList.contains('panel')?e.target.id:null);if(!id)return;
  if(id==='base')toggleBase(false);else if(id==='help')$('#help').classList.add('hidden');else if(id==='report')$('#report-close')?.click();else if(id==='win')closeWin();else if(id==='tutor')closeTutor();else if(id==='plan')togglePlan(false);else if(id==='info'){state.selected=null;state.follow=null}else if(id==='settings')toggleSettings(false);else if(id==='odd')toggleOdd(false);
 });
 setTool('select');
 ECO.onSeason=showReport;
}
