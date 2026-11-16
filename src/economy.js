// Trzy wskaźniki: budżet leśnictwa, stan lasu, ochrona terenu — plan na porę roku i raport z sezonu (0.2).
import {state,clamp,cal,toast,zl,displayNumber,SEASONS,SEASON_DAYS,YEARS_PER_SEASON} from './core.js';
import {trees,STUMP,STAND,SAPLING_AGE,coverSum,treesIn,seasonGrow} from './forest.js';
import {E} from './ents.js';
import {sfx} from './sound.js';
import {mail,prio} from './mail.js';
import {J,COST,MACH,truckTotal} from './jobs.js';
const blank=()=>({delivered:0,sold:0,earned:0,spent:0,felled:0,planted:0,handled:0,ignored:0,health0:state.health,protect0:state.protect,money0:state.money});
export const ECO={cover0:1,damage:0,renew:1,stumps:0,renewed:0,unrenewed:0,lastDay:-1,lastSeason:-1,plan:null,log:[],dailyBase:300,st:null,onSeason:null,market:1,seasonHooks:[],staff:{pod:false},nursery:null,ord:{cams:false,bar:false,parking:false},act:{b:false,f:false},debtWarn:false,hintDay:-9};
export const DEBT_LIM=8000;
// ── 0.9: faktury za pracę ekip i pożyczka z ratami (bez kar: upomnienie to jednorazowa, niewielka opłata) ──
export const FIN={inv:[],accr:{},auto:false,loan:null,nid:1};
// 1.0: trzy pożyczki (jedna naraz): im większa, tym wyższy procent i więcej rat
export const LOANS=[{amount:5000,rate:.06,parts:4},{amount:15000,rate:.08,parts:6},{amount:25000,rate:.10,parts:8}];
const invoices=()=>FIN.inv.filter(i=>!i.paid);
export const owedTotal=()=>invoices().reduce((a,i)=>a+i.amount,0);
export const owedCount=()=>invoices().length;
// Praca ekip nie schodzi z kasy od razu — trafia na dzienną fakturę (termin: jedna pora roku).
export function bill(n,what){FIN.accr[what]=(FIN.accr[what]||0)+n}
function issueInvoice(){
 const items=Object.entries(FIN.accr).filter(([,v])=>v>=1),sum=Math.round(items.reduce((a,[,v])=>a+v,0));FIN.accr={};
 if(sum<1)return;
 const inv={id:FIN.nid++,day:state.days,due:state.days+SEASON_DAYS,amount:sum,base:sum,items:items.map(([k,v])=>[k,Math.round(v)]),paid:false,rem:false,st:0};
 FIN.inv.push(inv);if(FIN.inv.length>40)FIN.inv.splice(0,FIN.inv.length-40);
 const m=mail('invoice','Faktura nr '+inv.id+': '+zl(sum)+' ('+inv.items.map(([k,v])=>k+' '+zl(v)).join(', ')+'). Termin: '+SEASON_DAYS+' dni.',{quiet:true});m.inv=inv.id;
 if(FIN.auto)payInvoice(inv.id,true);
}
export function payInvoice(id,silent){
 const i=FIN.inv.find(q=>q.id===id);if(!i||i.paid)return false;
 if(state.money-i.amount<-DEBT_LIM){if(!silent)toast('Brak środków na fakturę nr '+i.id+' ('+zl(i.amount)+'). Sprzedaj drewno (K).');return false}
 pay(i.amount,'faktura nr '+i.id+' (ekipa pozyskowa)');i.paid=true;sfx('coin');if(!silent)toast('Zapłacono fakturę nr '+i.id+': '+zl(i.amount)+'.');return true}
export function payAllInvoices(){let n=0,sum=0;for(const i of invoices().slice()){const a=i.amount;if(payInvoice(i.id,true)){n++;sum+=a}}toast(n?'Zapłacono '+n+' faktur na '+zl(sum)+'.':owedCount()?'Brak środków na zapłatę faktur.':'Nie ma faktur do zapłaty.');return n}
export const toggleAutoPay=()=>{FIN.auto=!FIN.auto;toast(FIN.auto?'Płacenie automatyczne: włączone.':'Płacenie automatyczne: wyłączone.');if(FIN.auto)for(const i of invoices().slice())payInvoice(i.id,true)};
// 1.0: kary za zwlekanie z płatnością (bez końca gry): 1) upomnienie po terminie (+5%, min. 40 zł), 2) wezwanie do zapłaty po kolejnej porze roku
// (+10%, min. 80 zł; do zapłaty ekipy nie przyjmują nowych zleceń), 3) windykacja po trzech porach roku (+15%, min. 150 zł; bank ściąga należność z konta).
export const dunning=()=>invoices().some(i=>(i.st||0)>=2);
function remind(){
 const dd=Math.floor(state.days);
 for(const i of invoices().slice()){i.st=i.st||(i.rem?1:0);const late=dd-Math.floor(i.due);if(late<0)continue;
  const note=t=>{const m=mail('invoice',t,{quiet:true});m.inv=i.id};
  if(i.st<1){const fee=Math.max(40,Math.round(i.base*.05));i.amount+=fee;i.rem=true;i.st=1;
   note('Upomnienie: faktura nr '+i.id+' po terminie. Opłata '+zl(fee)+', do zapłaty '+zl(i.amount)+'.')}
  else if(i.st<2&&late>=SEASON_DAYS){const fee=Math.max(80,Math.round(i.base*.1));i.amount+=fee;i.st=2;
   note('Wezwanie do zapłaty: faktura nr '+i.id+'. Opłata '+zl(fee)+', do zapłaty '+zl(i.amount)+'. Ekipy nie przyjmą nowych zleceń do czasu zapłaty.');toast('Wezwanie do zapłaty: faktura nr '+i.id+'. Ekipy nie przyjmą nowych zleceń.')}
  else if(i.st<3&&late>=SEASON_DAYS*3){const fee=Math.max(150,Math.round(i.base*.15));i.amount+=fee;i.st=3;
   pay(i.amount,'windykacja faktury nr '+i.id);i.paid=true;i.forced=true;
   note('Windykacja: z konta zeszło '+zl(i.amount)+' za fakturę nr '+i.id+' (w tym koszty '+zl(fee)+').')}}}
// Pożyczka: jedna naraz, 6 równych rat potrącanych na początku każdej pory roku (nie wstrzymuje gry, gdy saldo jest za niskie — rata idzie na debet).
export function takeLoan(k=1){
 if(FIN.loan){toast('Masz już pożyczkę.');return}
 const LN=LOANS[k]||LOANS[1],total=Math.round(LN.amount*(1+LN.rate));FIN.loan={total,left:total,inst:Math.round(total/LN.parts),parts:LN.parts,partsLeft:LN.parts,day:state.days};
 state.money+=LN.amount;ECO.log.unshift({t:state.days,n:LN.amount,why:'pożyczka z banku'});sfx('coin');
 mail('money','Pożyczka '+zl(LN.amount)+': do oddania '+zl(total)+' w '+LN.parts+' ratach po '+zl(FIN.loan.inst)+' (raty na początku pory roku).',{quiet:true});toast('Pożyczka '+zl(LN.amount)+' wpłynęła na konto.')}
export function repayLoan(){
 const L=FIN.loan;if(!L)return;if(!canAfford(L.left,true))return;
 pay(L.left,'spłata pożyczki (całość)');FIN.loan=null;mail('money','Pożyczka spłacona.',{quiet:true});toast('Pożyczka spłacona.')}
function installment(){
 const L=FIN.loan;if(!L)return;const a=Math.min(L.left,L.partsLeft<=1?L.left:L.inst);
 pay(a,'rata pożyczki');L.left-=a;L.partsLeft--;
 if(L.left<=0||L.partsLeft<=0){FIN.loan=null;mail('money','Pożyczka spłacona.',{quiet:true})}
 else mail('money','Rata pożyczki '+zl(a)+'. Zostało '+zl(L.left)+' ('+L.partsLeft+' rat).',{quiet:true})}
export const saveFin=()=>({inv:FIN.inv,accr:FIN.accr,auto:FIN.auto,loan:FIN.loan,nid:FIN.nid});
export function loadFin(o){FIN.inv=(o&&o.inv)||[];FIN.accr=(o&&o.accr)||{};FIN.auto=!!(o&&o.auto);FIN.loan=(o&&o.loan)||null;FIN.nid=(o&&o.nid)||(FIN.inv.reduce((a,i)=>Math.max(a,i.id),0)+1)}
export function initEconomy(){ECO.cover0=coverSum();ECO.lastDay=Math.floor(state.days);ECO.lastSeason=cal.season();ECO.st=blank();newPlan();setMarket()}
// Cena drewna zmienia się co porę roku (zimą drożej, latem taniej, plus wahania rynku).
function setMarket(){const se=cal.season();ECO.market=+((se===3?1.1:se===1?.9:1)*(.88+Math.random()*.24)).toFixed(2)}
// Koszty dzienne: utrzymanie leśniczówki i paliwo + pensje i sprzęt. 0.8.3: ekipa B i forwarder kosztują tylko w dni, w których pracowały
// (real=true — tyle schodzi z kasy; bez argumentu — pełna stawka, pokazywana w panelu).
export function dailyCost(real=false){return ECO.dailyBase+(ECO.ord.cams?25:0)+(ECO.ord.parking?15:0)+(ECO.ord.repel?10:0)+(J.crews.length>1&&(!real||ECO.act.b)?COST.crewB:0)+(ECO.staff.pod?COST.pod:0)+(J.skid.owned&&(!real||ECO.act.f)?COST.fwd:0)}
// Zlecenia wymagają pieniędzy w kasie — bez nich trzeba najpierw sprzedać drewno.
// 0.8.3: debet=true — zlecenia, które zarabiają (wycinka), wolno zlecać na debecie do −DEBT_LIM, inaczej z minusu nie da się wyjść.
export function canAfford(n,debet=false){if(debet?state.money-n>=-DEBT_LIM:state.money>=n)return true;toast(debet?'Limit debetu ('+zl(DEBT_LIM)+') wyczerpany. Sprzedaj drewno (K).':'Brak środków: potrzeba '+zl(n)+', w kasie '+zl(state.money)+'.');sfx('unmark');return false}
export function pay(n,why){state.money-=n;if(ECO.st)ECO.st.spent+=n;ECO.log.unshift({t:state.days,n:-n,why});ECO.log.length=Math.min(ECO.log.length,30)}
export function earn(n,why){state.money+=n;if(ECO.st)ECO.st.earned+=n;ECO.log.unshift({t:state.days,n,why});ECO.log.length=Math.min(ECO.log.length,30);sfx('coin')}
export function bumpProtect(d){state.protect=clamp(state.protect+d,0,100)}
export function bumpDamage(d){ECO.damage=clamp(ECO.damage+d,0,40)}
export function stat(k,n=1){if(ECO.st)ECO.st[k]+=n}
// Plan na porę roku: dostarczyć drewno na składnicę, posadzić sadzonki, obsłużyć zgłoszenia.
function newPlan(){
 const se=cal.season();
 ECO.plan={season:se,year:cal.year(),cut:se===3?12:se===1?6:8,plant:se===0?24:se===2?16:se===3?0:8,handle:2,doneCut:0,donePlant:0,doneHandle:0,rewarded:false,reward:2000};
 const P=ECO.plan;if(state.playing)mail('plan','Plan na '+SEASONS[se]+': '+P.cut+' m³ drewna'+(P.plant?', '+P.plant+' sadzonek':'')+', '+P.handle+' zgłoszenia. Premia '+zl(P.reward)+'.',{quiet:true});
}
export function planProgress(kind,n){const P=ECO.plan;if(!P)return;
 if(kind==='cut'){P.doneCut+=n;stat('delivered',n)}else if(kind==='plant'){P.donePlant+=n;stat('planted',n)}else{P.doneHandle+=n;stat('handled',n)}
 if(!P.rewarded&&P.doneCut>=P.cut&&P.donePlant>=(P.season===3?0:P.plant)&&P.doneHandle>=P.handle){P.rewarded=true;earn(P.reward,'premia za plan');mail('plan','Plan na '+SEASONS[P.season]+' wykonany. Premia '+zl(P.reward)+'.')}}
// Koniec pory roku: podsumowanie, skok wzrostu lasu, nowy plan.
function endSeason(){
 const P=ECO.plan,S=ECO.st,G=seasonGrow(YEARS_PER_SEASON),grown=G.grown;ECO.goneRen=(ECO.goneRen||0)*.92+(G.rotted||0);
 const rep={season:P.season,year:P.year,plan:P,st:S,grown,years:YEARS_PER_SEASON,health:state.health,protect:state.protect,money:state.money,unrenewed:ECO.unrenewed,next:cal.season(),died:G.died,young:G.young,browsed:G.browsed||0,market:ECO.market};
 for(const h of ECO.seasonHooks)Object.assign(rep,h()||{});
 // ocena nadleśniczego
 const score=(P.rewarded?2:0)+(state.health>=S.health0-1?1:-1)+(state.protect>=S.protect0?1:-1)+(S.ignored===0?1:-1)+(ECO.unrenewed<6?1:-1);
 rep.verdict=score>=5?'Wzorowo prowadzone leśnictwo. Nadleśniczy jest zadowolony.':score>=3?'Dobra robota, choć jest jeszcze co poprawiać.':score>=1?'Poprawnie, ale nadleśnictwo oczekuje więcej.':'Nadleśniczy ma zastrzeżenia: las i teren wymagają więcej uwagi.';
 if(state.money<0)rep.verdict+=' Leśnictwo jest na minusie — nadleśniczy oczekuje poprawy finansów.';
 newPlan();ECO.st=blank();setMarket();rep.nextMarket=ECO.market;
 if(ECO.onSeason)ECO.onSeason(rep);else toast('Nowa pora roku: '+SEASONS[rep.next]+'.');
}
let accT=0;
export function updateEconomy(dt){
 if(J.crews[1]&&J.crews[1].phase!=='idle')ECO.act.b=true;
 if(J.skid.owned&&J.skid.trac&&!['idle','home','arriving'].includes(J.skid.phase))ECO.act.f=true;
 const day=Math.floor(state.days);
 if(day!==ECO.lastDay){
  const n=day-ECO.lastDay;ECO.lastDay=day;
  for(let i=0;i<n;i++){
   pay(dailyCost(true),'koszty dzienne (utrzymanie, paliwo, pensje)');ECO.act.b=false;ECO.act.f=false;issueInvoice();remind();
   if(state.money<-DEBT_LIM){if(!ECO.debtWarn){ECO.debtWarn=true;mail('money','Debet ponad '+zl(DEBT_LIM)+'. Nadleśnictwo wstrzymuje nowe zakupy i zlecenia wycinki, dopóki nie sprzedasz drewna (klawisz K) albo nie poprawi się saldo.')}}else if(state.money>=0)ECO.debtWarn=false;
   if(state.money<0&&day-ECO.hintDay>=3){const tt=truckTotal();if(tt>=1){ECO.hintDay=day;mail('money','Saldo jest ujemne, a przy drogach leży '+displayNumber(tt,1)+' m³ drewna. Zamów wywóz (K), a pieniądze wrócą do kasy.')}}
   // 0.6.2: najmocniej obniża ochronę zgłoszenie bez reakcji; to w kolejce patrolu — słabiej (patrol już jedzie)
   // 0.8.1: kara zależy od wagi zgłoszenia (drobiazgi ważą mało, propozycje wcale) i ma dzienny sufit, żeby zaległości nie dobijały na wysokim tempie
   const live=E.incidents.filter(q=>q.status!=='done'&&q.status!=='gone'&&q.type!=='feed'&&q.type!=='assess'&&prio(q)>0);
   let pen=0;for(const q of live)pen+=q.status==='new'?[0,1,3,3][prio(q)]:(prio(q)>=2?1:0);
   if(pen>0)bumpProtect(-Math.min(9,pen));else if(state.protect<74&&!live.some(q=>prio(q)>=2))bumpProtect(1.5);
   ECO.damage=Math.max(0,ECO.damage-.4);
  }
 }
 if(cal.season()!==ECO.lastSeason){ECO.lastSeason=cal.season();endSeason();installment()}
 accT+=dt;if(accT<2)return;accT=0;
 // odnowienie: pień jest „odnowiony”, gdy w pobliżu rośnie młode drzewko
 let stumps=0,ren=0;
 for(const t of trees){if(t.st!==STUMP||t.stumpAge>40)continue;stumps++;
  if(treesIn(t.x-30,t.y-30,t.x+30,t.y+30).some(q=>q.st===STAND&&q.age<SAPLING_AGE*3))ren++}
 const gr=Math.round(ECO.goneRen||0);   // zdrowiejące, zniknięte pniaki nadal liczą się jako odnowione (zanikają z pamięci po kilku porach roku)
 ECO.stumps=stumps+gr;ECO.renewed=ren+gr;ECO.renew=ECO.stumps?ECO.renewed/ECO.stumps:1;
 const unren=stumps-ren;ECO.unrenewed=unren;
 const cover=Math.min(1,coverSum()/ECO.cover0),trash=E.trash.reduce((n,t)=>n+(t.dead||t.fire?0:t.kind==='dump'?4:1),0),fires=E.incidents.filter(q=>q.type==='fire'&&q.status!=='done'&&q.status!=='gone').length;
 const target=clamp(32+50*cover-Math.min(15,unren*.35)-1.2*trash-3*fires-ECO.damage,0,100);
 state.health+=clamp(target-state.health,-3.2,3.2);   // tick co 2 s (było co .5 s i ±.8) — to samo tempo, 4× mniej pracy
 ECO.cover=cover;
}
