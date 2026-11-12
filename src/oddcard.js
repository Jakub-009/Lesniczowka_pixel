// Karta oddziału (0.8.1): zestawienie drzewostanu jednego z 12 oddziałów — skład, wiek, zapas, jakość, odnowienia i zgłoszenia.
import {WORLD,state} from './core.js';
import {trees,STAND,STUMP,SAPLING_AGE,CUT_AGE,THIN_AGE,volume,treesIn,SP} from './forest.js';
import {oddzial,STANDS,GX,GY} from './map.js';
import {E} from './ents.js';
import {R} from './renew.js';
import {ASSESS} from './incidents.js';
export function oddBounds(id){const n=+id-101,r=Math.floor(n/4),c=n%4,xs=[0,GX[0],GX[1],GX[2],WORLD.w],ys=[0,GY,1720,WORLD.h];return{x0:xs[c],x1:xs[c+1],y0:ys[r],y1:ys[r+1]}}
export function oddStats(id){
 const B=oddBounds(id),S={id,def:STANDS[id],stand:0,sapl:0,thin:0,mature:0,vol:0,ageSum:0,aged:0,sp:{},assessed:0,q:[0,0,0],marked:0,markedVol:0,sick:0,stumps:0,unren:0};
 for(const t of treesIn(B.x0,B.y0,B.x1,B.y1)){
  if(t.x<B.x0||t.x>=B.x1||t.y<B.y0||t.y>=B.y1)continue;
  if(t.st===STUMP){if(t.stumpAge>40)continue;S.stumps++;
   if(!treesIn(t.x-30,t.y-30,t.x+30,t.y+30).some(q=>q.st===STAND&&q.age<SAPLING_AGE*3))S.unren++;continue}
  if(t.st!==STAND)continue;
  S.stand++;S.sp[t.sp]=(S.sp[t.sp]||0)+1;
  if(t.age<SAPLING_AGE){S.sapl++;continue}
  S.aged++;S.ageSum+=t.age;S.vol+=volume(t);
  if(t.age>=CUT_AGE)S.mature++;else if(t.age>=THIN_AGE)S.thin++;
  if(t.qk){S.assessed++;S.q[t.q]++}
  if(t.marked){S.marked++;S.markedVol+=volume(t)}
  if(t.kb>=1)S.sick++;
 }
 S.age=S.aged?S.ageSum/S.aged:0;
 const inB=(x,y)=>x>=B.x0&&x<B.x1&&y>=B.y0&&y<B.y1;
 S.incidents=E.incidents.filter(q=>q.status!=='done'&&q.status!=='gone'&&inB(q.x,q.y)).length;
 S.plots=R.plots.filter(p=>String(p.odd)===String(id));S.fenced=S.plots.filter(p=>p.fence==='done').length;
 const last=ASSESS.filter(q=>inB(q.x,q.y)).sort((a,b)=>b.day-a.day)[0];S.lastAssess=last?last.day:null;
 S.center=[(B.x0+B.x1)/2,(B.y0+B.y1)/2];
 return S;
}
export function oddAt(x,y){return oddzial(x,y)}
