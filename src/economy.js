// Trzy wskaźniki: budżet leśnictwa, stan lasu, ochrona terenu — plan na porę roku i raport z sezonu (0.2).
import {state,clamp,cal,toast,zl,SEASONS,YEARS_PER_SEASON} from './core.js';
import {trees,STUMP,STAND,SAPLING_AGE,coverSum,treesIn,seasonGrow} from './forest.js';
import {E} from './ents.js';
import {sfx} from './sound.js';
const blank=()=>({delivered:0,sold:0,earned:0,spent:0,felled:0,planted:0,handled:0,ignored:0,health0:state.health,protect0:state.protect,money0:state.money});
export const ECO={cover0:1,damage:0,renew:1,stumps:0,renewed:0,unrenewed:0,lastDay:-1,lastSeason:-1,plan:null,log:[],dailyCost:160,st:null,onSeason:null};
export function initEconomy(){ECO.cover0=coverSum();ECO.lastDay=Math.floor(state.days);ECO.lastSeason=cal.season();ECO.st=blank();newPlan()}
export function pay(n,why){state.money-=n;if(ECO.st)ECO.st.spent+=n;ECO.log.unshift({t:state.days,n:-n,why});ECO.log.length=Math.min(ECO.log.length,30)}
export function earn(n,why){state.money+=n;if(ECO.st)ECO.st.earned+=n;ECO.log.unshift({t:state.days,n,why});ECO.log.length=Math.min(ECO.log.length,30);sfx('coin')}
export function bumpProtect(d){state.protect=clamp(state.protect+d,0,100)}
export function bumpDamage(d){ECO.damage=clamp(ECO.damage+d,0,40)}
export function stat(k,n=1){if(ECO.st)ECO.st[k]+=n}
// Plan na porę roku: dostarczyć drewno na składnicę, posadzić sadzonki, obsłużyć zgłoszenia.
function newPlan(){
 const se=cal.season();
 ECO.plan={season:se,year:cal.year(),cut:se===3?12:se===1?6:8,plant:se===0?24:se===2?16:8,handle:2,doneCut:0,donePlant:0,doneHandle:0,rewarded:false,reward:3000};
}
export function planProgress(kind,n){const P=ECO.plan;if(!P)return;
 if(kind==='cut'){P.doneCut+=n;stat('delivered',n)}else if(kind==='plant'){P.donePlant+=n;stat('planted',n)}else{P.doneHandle+=n;stat('handled',n)}
 if(!P.rewarded&&P.doneCut>=P.cut&&P.donePlant>=P.plant&&P.doneHandle>=P.handle){P.rewarded=true;earn(P.reward,'premia za plan');toast('Plan na '+SEASONS[P.season]+' wykonany! Premia z nadleśnictwa: '+zl(P.reward)+'.')}}
// Koniec pory roku: podsumowanie, skok wzrostu lasu, nowy plan.
function endSeason(){
 const P=ECO.plan,S=ECO.st,G=seasonGrow(YEARS_PER_SEASON),grown=G.grown;
 const rep={season:P.season,year:P.year,plan:P,st:S,grown,years:YEARS_PER_SEASON,health:state.health,protect:state.protect,money:state.money,unrenewed:ECO.unrenewed,next:cal.season(),died:G.died,young:G.young};
 // ocena nadleśniczego
 const score=(P.rewarded?2:0)+(state.health>=S.health0-1?1:-1)+(state.protect>=S.protect0?1:-1)+(S.ignored===0?1:-1)+(ECO.unrenewed<6?1:-1);
 rep.verdict=score>=5?'Wzorowo prowadzone leśnictwo. Nadleśniczy jest zadowolony.':score>=3?'Dobra robota, choć jest jeszcze co poprawiać.':score>=1?'Poprawnie, ale nadleśnictwo oczekuje więcej.':'Nadleśniczy ma zastrzeżenia: las i teren wymagają więcej uwagi.';
 newPlan();ECO.st=blank();
 if(ECO.onSeason)ECO.onSeason(rep);else toast('Nowa pora roku: '+SEASONS[rep.next]+'.');
}
let accT=0;
export function updateEconomy(dt){
 const day=Math.floor(state.days);
 if(day!==ECO.lastDay){
  const n=day-ECO.lastDay;ECO.lastDay=day;
  for(let i=0;i<n;i++){
   pay(ECO.dailyCost,'koszty dzienne (paliwo, wynagrodzenia)');
   const open=E.incidents.filter(q=>q.status!=='done'&&q.status!=='gone').length;
   if(open)bumpProtect(-3*open);else if(state.protect<74)bumpProtect(1.5);
   ECO.damage=Math.max(0,ECO.damage-.4);
  }
 }
 if(cal.season()!==ECO.lastSeason){ECO.lastSeason=cal.season();endSeason()}
 accT+=dt;if(accT<.5)return;accT=0;
 // odnowienie: pień jest „odnowiony”, gdy w pobliżu rośnie młode drzewko
 let stumps=0,ren=0;
 for(const t of trees){if(t.st!==STUMP||t.stumpAge>40)continue;stumps++;
  if(treesIn(t.x-30,t.y-30,t.x+30,t.y+30).some(q=>q.st===STAND&&q.age<SAPLING_AGE*3))ren++}
 ECO.stumps=stumps;ECO.renewed=ren;ECO.renew=stumps?ren/stumps:1;
 const unren=stumps-ren;ECO.unrenewed=unren;
 const cover=Math.min(1,coverSum()/ECO.cover0),trash=E.trash.filter(t=>!t.dead&&!t.fire).length,fires=E.incidents.filter(q=>q.type==='fire'&&q.status!=='done'&&q.status!=='gone').length;
 const target=clamp(32+50*cover-Math.min(15,unren*.35)-1.2*trash-3*fires-ECO.damage,0,100);
 state.health+=clamp(target-state.health,-.8,.8);
 ECO.cover=cover;
}
