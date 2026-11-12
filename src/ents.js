// Rejestr wszystkiego, co żyje i się rusza, oraz siatki nawigacji (piesi, dzika zwierzyna, podwórze).
import {createNav} from './nav.js';
import {pointBlocked,roadClearance,YARD,PLAC,NURSERY,inRect,inWorld} from './map.js';
import {R,inShape} from './renew.js';
export const E={vehicles:[],people:[],animals:[],piles:[],trash:[],incidents:[],plants:[],ropes:[]};
export const NAV={foot:null,wild:null,yard:null};
// zwierzyna: nie wchodzi na podwórze, plac, do grodzeń (uprawa i ogrodzone powierzchnie) ani na drogę główną
const wildOk=(x,y)=>inWorld(x,y,20)&&!pointBlocked(x,y,10)&&!inRect(x,y,YARD,70)&&!inRect(x,y,PLAC,40)&&!inRect(x,y,NURSERY,16)&&roadClearance(x,y,['main'])>40
 &&!R.plots.some(p=>p.fence==='done'&&inShape(p,x,y,14));
// Po ogrodzeniu powierzchni: przeliczenie siatki zwierzyny i wyprowadzenie zwierząt, które zostały w środku.
export function rebuildWild(){
 NAV.wild.build(wildOk);
 for(const a of E.animals){if(a.dead||a.nav!=='wild'||NAV.wild.walkable(a.x,a.y))continue;
  const p=NAV.wild.nearestWalkable(a.x,a.y,14);if(p){a.x=p[0];a.y=p[1];a.lx=a.x;a.ly=a.y}a.path=[];a.pi=0;a.state='idle';a.t=1}
}
export function buildNavs(){
 NAV.foot=createNav((x,y)=>inWorld(x,y,14)&&!pointBlocked(x,y,9));
 NAV.wild=createNav(wildOk);
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
