// Trzy wskaźniki: budżet leśnictwa, stan lasu, ochrona terenu — oraz plan na porę roku z nadleśnictwa.
import {state,clamp,cal,toast,zl,SEASONS} from './core.js';
import {trees,STUMP,STAND,SAPLING_AGE,coverSum,treesIn} from './forest.js';
import {E} from './ents.js';
import {sfx} from './sound.js';
export const ECO={cover0:1,damage:0,renew:1,stumps:0,renewed:0,lastDay:-1,lastSeason:-1,plan:null,log:[],delivered:0,planted:0,handled:0,dailyCost:140};
export function initEconomy(){ECO.cover0=coverSum();ECO.lastDay=Math.floor(state.days);ECO.lastSeason=cal.season();newPlan()}
export function pay(n,why){state.money-=n;ECO.log.unshift({t:state.days,n:-n,why});ECO.log.length=Math.min(ECO.log.length,30)}
export function earn(n,why){state.money+=n;ECO.log.unshift({t:state.days,n,why});ECO.log.length=Math.min(ECO.log.length,30);sfx('coin')}
export function bumpProtect(d){state.protect=clamp(state.protect+d,0,100)}
export function bumpDamage(d){ECO.damage=clamp(ECO.damage+d,0,40)}
// Plan na porę roku: dostarczyć drewno na składnicę, posadzić sadzonki, obsłużyć zgłoszenia.
function newPlan(){
 const se=cal.season();
 ECO.plan={season:se,cut:se===3?18:se===1?8:12,plant:se===0?30:se===2?20:10,handle:2,doneCut:0,donePlant:0,doneHandle:0,rewarded:false,reward:3000};
}
export function planProgress(kind,n){const P=ECO.plan;if(!P)return;if(kind==='cut')P.doneCut+=n;else if(kind==='plant')P.donePlant+=n;else P.doneHandle+=n;
 if(!P.rewarded&&P.doneCut>=P.cut&&P.donePlant>=P.plant&&P.doneHandle>=P.handle){P.rewarded=true;earn(P.reward,'premia za plan');toast('Plan na '+SEASONS[P.season]+' wykonany! Premia z nadleśnictwa: '+zl(P.reward)+'.')}}
let accT=0;
export function updateEconomy(dt){
 const day=Math.floor(state.days);
 if(day!==ECO.lastDay){
  const n=day-ECO.lastDay;ECO.lastDay=day;
  for(let i=0;i<n;i++){
   pay(ECO.dailyCost,'koszty dzienne (paliwo, wynagrodzenia)');
   const open=E.incidents.filter(q=>q.status!=='done'&&q.status!=='gone').length;
   if(open)bumpProtect(-2.5*open);else if(state.protect<74)bumpProtect(.9);
   ECO.damage=Math.max(0,ECO.damage-.15);
  }
 }
 const se=cal.season();
 if(se!==ECO.lastSeason){
  const P=ECO.plan;if(P&&!P.rewarded)toast('Nowa pora roku: '+SEASONS[se]+'. Plan za '+SEASONS[P.season]+' niewykonany — bez premii.');
  else toast('Nowa pora roku: '+SEASONS[se]+'.');
  ECO.lastSeason=se;newPlan();
 }
 accT+=dt;if(accT<.5)return;accT=0;
 // odnowienie: pień jest „odnowiony”, gdy w pobliżu rośnie młode drzewko
 let stumps=0,ren=0;
 for(const t of trees){if(t.st!==STUMP||t.stumpAge>40)continue;stumps++;
  if(treesIn(t.x-30,t.y-30,t.x+30,t.y+30).some(q=>q.st===STAND&&q.age<SAPLING_AGE*3))ren++}
 ECO.stumps=stumps;ECO.renewed=ren;ECO.renew=stumps?ren/stumps:1;
 const cover=Math.min(1,coverSum()/ECO.cover0),trash=E.trash.filter(t=>!t.dead).length,fires=E.incidents.filter(q=>q.type==='fire'&&q.status!=='done'&&q.status!=='gone').length;
 const unren=stumps-ren;ECO.unrenewed=unren;
 const target=clamp(32+50*cover-Math.min(15,unren*.35)-1.2*trash-3*fires-ECO.damage,0,100);
 state.health+=clamp(target-state.health,-.8,.8);
 ECO.cover=cover;
}
