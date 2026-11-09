// Siatka nawigacyjna dla dzikich zwierząt: komórki 24 px, A* z 8 sąsiadami, wygładzanie ścieżki (line-of-sight).
import {WORLD,clamp} from './core.js';
const CS=24,GW=Math.ceil(WORLD.w/CS),GH=Math.ceil(WORLD.h/CS);
// Fabryka siatek: jedna dla dzikich zwierząt (cała mapa), druga dla zwierząt gospodarskich (wnętrze gospodarstwa).
export function createNav(okFn){
let grid=null;
function buildNav(okFn){grid=new Uint8Array(GW*GH);for(let cy=0;cy<GH;cy++)for(let cx=0;cx<GW;cx++)grid[cy*GW+cx]=okFn(cx*CS+CS/2,cy*CS+CS/2)?1:0}
const cx=x=>clamp(Math.floor(x/CS),0,GW-1),cy=y=>clamp(Math.floor(y/CS),0,GH-1);
const walkable=(x,y)=>!!grid&&x>=0&&y>=0&&x<WORLD.w&&y<WORLD.h&&grid[cy(y)*GW+cx(x)]===1;
function nearestWalkable(x,y,maxR=10){
 const X=cx(x),Y=cy(y);
 for(let r=0;r<=maxR;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const a=X+dx,b=Y+dy;if(a<0||b<0||a>=GW||b>=GH)continue;
  if(grid[b*GW+a])return[a*CS+CS/2,b*CS+CS/2];
 }
 return null;
}
class Heap{constructor(){this.a=[]}
 push(n,p){const a=this.a;a.push([p,n]);let i=a.length-1;while(i>0){const q=(i-1)>>1;if(a[q][0]<=a[i][0])break;[a[q],a[i]]=[a[i],a[q]];i=q}}
 pop(){const a=this.a,t=a[0],l=a.pop();if(a.length){a[0]=l;let i=0;for(;;){let m=i,L=2*i+1,R=L+1;if(L<a.length&&a[L][0]<a[m][0])m=L;if(R<a.length&&a[R][0]<a[m][0])m=R;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m}}return t[1]}
 get size(){return this.a.length}}
// dynBlock(x,y): dodatkowe, chwilowe przeszkody (pojazdy). Zwraca listę punktów [x,y] (bez punktu startu) albo null.
function findPath(sx,sy,tx,ty,dynBlock){
 if(!grid)return null;
 const dyn=new Map(),blocked=(c)=>{if(!dynBlock)return false;let v=dyn.get(c);if(v===undefined){v=dynBlock(c%GW*CS+CS/2,Math.floor(c/GW)*CS+CS/2);dyn.set(c,v)}return v};
 const s=cy(sy)*GW+cx(sx),t=cy(ty)*GW+cx(tx);
 if(!grid[t])return null;
 const g=new Float32Array(GW*GH).fill(1e9),from=new Int32Array(GW*GH).fill(-1),closed=new Uint8Array(GW*GH);
 const h=(c)=>{const dx=Math.abs(c%GW-t%GW),dy=Math.abs(Math.floor(c/GW)-Math.floor(t/GW));return Math.max(dx,dy)+.414*Math.min(dx,dy)};
 const open=new Heap();g[s]=0;open.push(s,h(s));let n=0;
 while(open.size&&n++<6000){
  const c=open.pop();if(closed[c])continue;closed[c]=1;
  if(c===t)break;
  const X=c%GW,Y=Math.floor(c/GW);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;
   const a=X+dx,b=Y+dy;if(a<0||b<0||a>=GW||b>=GH)continue;
   const q=b*GW+a;if(closed[q]||!grid[q]||blocked(q))continue;
   if(dx&&dy&&(!grid[Y*GW+a]||!grid[b*GW+X]))continue;
   const ng=g[c]+(dx&&dy?1.414:1);
   if(ng<g[q]){g[q]=ng;from[q]=c;open.push(q,ng+h(q))}
  }
 }
 if(from[t]<0&&s!==t)return null;
 const cells=[];for(let c=t;c!==s&&c>=0;c=from[c])cells.push(c);cells.reverse();
 let pts=cells.map(c=>[c%GW*CS+CS/2,Math.floor(c/GW)*CS+CS/2]);
 pts[pts.length-1]=[tx,ty];
 // wygładzanie: pomijaj punkty, jeśli odcinek jest wolny
 const los=(ax,ay,bx,by)=>{const d=Math.hypot(bx-ax,by-ay);for(let u=CS*.5;u<d;u+=CS*.5){const x=ax+(bx-ax)*u/d,y=ay+(by-ay)*u/d;if(!walkable(x,y)||blocked(cy(y)*GW+cx(x)))return false}return true};
 const out=[];let ax=sx,ay=sy,i=0;
 while(i<pts.length){let j=pts.length-1;while(j>i&&!los(ax,ay,pts[j][0],pts[j][1]))j--;out.push(pts[j]);ax=pts[j][0];ay=pts[j][1];i=j+1}
 return out;
}

if(okFn)buildNav(okFn);
return{build:buildNav,walkable,nearestWalkable,findPath};
}
let main=null;
export function buildNav(okFn){main=createNav(okFn)}
export const walkable=(x,y)=>main.walkable(x,y);
export const nearestWalkable=(x,y,r)=>main.nearestWalkable(x,y,r);
export const findPath=(a,b,c,d,e)=>main.findPath(a,b,c,d,e);
