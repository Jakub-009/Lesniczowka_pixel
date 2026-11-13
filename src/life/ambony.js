// 0.9: ambony budowane w trybie Budowa (klawisz 5). Każda ambona ma własnego myśliwego (wyjścia wieczorem i o świcie),
// zasięg ok. 420 px i własną porcję pozyskania — im więcej ambon, tym łatwiej wykonać plan łowiecki.
import {state,toast,zl} from '../core.js';
import {AMBONA,FEEDERS,YARD,colliders,pointBlocked,inWorld,inWater,inRect} from '../map.js';
import {nearestRoad} from '../roads.js';
import {treesIn,removeTree} from '../forest.js';
import {R,inShape} from '../renew.js';
import {canAfford,pay,earn} from '../economy.js';
import {rand} from './agents.js';

export const AMB={list:[],next:1};
export const AMB_COST=1100,AMB_MAX=8,AMB_R=420,AMB_GAP=330,AMB_ROAD=650;
export function initAmbony(){AMB.list=[mkAmb(0,AMBONA.x,AMBONA.y)];AMB.next=1}
const mkAmb=(id,x,y)=>({id,x,y,off:rand(),hDay:-1,dDay:-1,shots:0,outings:0,got:0});
// powód, dla którego nie można tu postawić ambony (null = można)
export function ambonaWhy(x,y){
 if(AMB.list.length>=AMB_MAX)return 'osiągnięto limit '+AMB_MAX+' ambon';
 if(!inWorld(x,y,140))return 'zbyt blisko krawędzi mapy';
 if(inRect(x,y,YARD,90))return 'zbyt blisko leśniczówki';
 const rd=nearestRoad(x,y,['main','forest','drive']);
 if(rd&&rd.d<70)return 'zbyt blisko drogi (strzał w stronę drogi jest niebezpieczny)';
 const fr=nearestRoad(x,y,['forest']);
 if(!fr||fr.d>AMB_ROAD)return 'zbyt daleko od drogi leśnej (myśliwy musi dojść w rozsądnym czasie)';
 if(inWater(x,y,22))return 'mokradło albo ciek wodny';
 if(pointBlocked(x,y,16))return 'przeszkoda';
 if(R.plots.some(p=>inShape(p,x,y,24)))return 'powierzchnia odnowieniowa';
 for(const a of AMB.list)if(Math.hypot(a.x-x,a.y-y)<AMB_GAP)return 'zbyt blisko innej ambony (min. '+AMB_GAP+' px — zasięgi mają się uzupełniać)';
 for(const f of FEEDERS)if(Math.hypot(f.x-x,f.y-y)<110)return 'zbyt blisko paśnika';
 return null;
}
export function buildAmbona(x,y){
 const why=ambonaWhy(x,y);if(why){toast('Nie tu: '+why+'.');return false}
 if(!canAfford(AMB_COST))return false;
 x=Math.round(x);y=Math.round(y);
 pay(AMB_COST,'budowa ambony');
 for(const t of treesIn(x-18,y-18,x+18,y+18).slice())if(Math.hypot(t.x-x,t.y-y)<16)removeTree(t);
 const a=mkAmb(AMB.next++,x,y);AMB.list.push(a);colliders.push({shape:'circle',x,y,r:9,id:'ambona',br:9,amb:a.id});
 toast('Ambona gotowa ('+AMB.list.length+'. w obwodzie). Koło łowieckie wystawi tu własnego myśliwego wieczorem i o świcie.');
 return true;
}
export function demolishAmbona(a){
 if(!a||a.id===0){toast('Pierwszej ambony nie można rozebrać.');return false}
 const i=AMB.list.indexOf(a);if(i<0)return false;AMB.list.splice(i,1);
 const k=colliders.findIndex(c=>c.amb===a.id);if(k>=0)colliders.splice(k,1);
 earn(Math.round(AMB_COST*.4),'rozbiórka ambony');toast('Ambona rozebrana — odzysk '+zl(Math.round(AMB_COST*.4))+'.');return true;
}
export const ambonaAt=(x,y)=>AMB.list.find(a=>Math.hypot(a.x-x,a.y-y)<20)||null;
// po wczytaniu zapisu: ambony gracza (poza pierwszą) wracają razem z kolizjami
export function loadAmbony(list){
 for(let i=colliders.length-1;i>=0;i--)if(colliders[i].amb!=null)colliders.splice(i,1);
 initAmbony();
 for(const q of list||[]){if(!q||q.id===0){if(q){const a=AMB.list[0];a.shots=q.shots||0;a.outings=q.outings||0;a.got=q.got||0}continue}
  const a=mkAmb(AMB.next++,q.x,q.y);a.shots=q.shots||0;a.outings=q.outings||0;a.got=q.got||0;AMB.list.push(a);colliders.push({shape:'circle',x:a.x,y:a.y,r:9,id:'ambona',br:9,amb:a.id})}
}
export const saveAmbony=()=>AMB.list.map(a=>({id:a.id,x:a.x,y:a.y,shots:a.shots,outings:a.outings,got:a.got}));
