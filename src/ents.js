// Rejestr wszystkiego, co żyje i się rusza, oraz siatki nawigacji (piesi, dzika zwierzyna, podwórze).
import {createNav} from './nav.js';
import {pointBlocked,roadClearance,YARD,SKLAD,UPRAWA,NURSERY,inRect,inWorld} from './map.js';
export const E={vehicles:[],people:[],animals:[],piles:[],trash:[],incidents:[],plants:[],ropes:[]};
export const NAV={foot:null,wild:null,yard:null};
export function buildNavs(){
 NAV.foot=createNav((x,y)=>inWorld(x,y,14)&&!pointBlocked(x,y,9));
 // zwierzyna: nie wchodzi na podwórze, składnicę, do grodzenia uprawy ani na drogę główną
 NAV.wild=createNav((x,y)=>inWorld(x,y,20)&&!pointBlocked(x,y,10)&&!inRect(x,y,YARD,70)&&!inRect(x,y,SKLAD,40)&&!inRect(x,y,UPRAWA,14)&&!inRect(x,y,NURSERY,16)&&roadClearance(x,y,['main'])>40);
 NAV.yard=createNav((x,y)=>inRect(x,y,YARD,-14)&&!pointBlocked(x,y,9));
}
const posOf=e=>e.pos?e.pos:[e.x,e.y];
// Najbliższe zagrożenie dla zwierzyny: człowiek albo pojazd (stojący pojazd płoszy słabiej).
export function nearestThreat(x,y,r){
 let best=null,bd=r;
 for(const p of E.people){if(p.hidden||p.onStand)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p}}
 for(const v of E.vehicles){const [vx,vy]=v.pos,d=(Math.hypot(vx-x,vy-y)-14)/(Math.abs(v.v)>2?1:.45);if(d<bd){bd=d;best=v}}
 if(!best)return null;const [bx,by]=posOf(best);return{e:best,d:bd,x:bx,y:by};
}
export function prune(){for(const k of ['vehicles','people','animals','piles','trash'])E[k]=E[k].filter(o=>!o.dead)}
