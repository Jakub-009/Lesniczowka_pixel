// Graf dróg: sąsiedztwo, najkrótsze trasy (Dijkstra), najbliższy punkt drogi i plan przejazdu do dowolnego miejsca.
import {NODES,EDGES,ptAt,nearestOn} from './map.js';
import {WORLD} from './core.js';
const ADJ={};for(const k in NODES)ADJ[k]=[];
for(const e of EDGES){ADJ[e.a].push({edge:e,to:e.b});ADJ[e.b].push({edge:e,to:e.a})}
export const neighbours=k=>ADJ[k];
export const edgeOf=(a,b)=>ADJ[a].find(n=>n.to===b)?.edge;
export const ALL=['main','forest','drive'];
export const offMap=k=>{const p=NODES[k];return p[0]<0||p[0]>WORLD.w||p[1]<0||p[1]>WORLD.h};
// Wjazd na mapę (zachód / wschód) i najbliższy wyjazd.
export const ENTRY=w=>w?{from:'mW',to:'j1',s:0}:{from:'mE',to:'j4',s:0};
export const exitNode=x=>x<WORLD.w/2?'mW':'mE';
// Zawracanie: na końcu drogi (plac nawrotowy, brama, wyjazd z mapy) bez kosztu, na skrzyżowaniu z kosztem tc
// (wjazd w boczną drogę i powrót), a na środku odcinka — prawie nigdy (pen w planRoute).
const live=(k,allow)=>ADJ[k].filter(q=>allow.includes(q.edge.kind)).length;
const turnCost=(k,allow,tc)=>{const n=live(k,allow);return n<=1?0:n>=3?tc:null};

// Dijkstra po stanach (węzeł, skąd przyjechał): nie wolno wrócić tym samym odcinkiem, chyba że to ślepy koniec drogi.
function dijkstra(src,prevNode,allow,tc){
 const dist=new Map(),prev=new Map(),done=new Set(),K=(n,p)=>n+'|'+p;dist.set(K(src,prevNode),0);
 for(let guard=0;guard<20000;guard++){let u=null,b=1e9;for(const [k,d] of dist)if(!done.has(k)&&d<b){b=d;u=k}
  if(!u)break;done.add(u);const [n,p]=u.split('|');
  for(const q of ADJ[n]){if(!allow.includes(q.edge.kind))continue;let extra=0;if(q.to===p){const t=turnCost(n,allow,tc);if(t==null)continue;extra=t}
   const k=K(q.to,n),d=b+q.edge.len+extra+(q.edge.blocked?4000:0);if(d<(dist.get(k)??1e9)){dist.set(k,d);prev.set(k,u)}}}
 return{dist,prev};
}
// Najlepszy stan w węźle gx, z którego wolno wjechać na odcinek prowadzący do gy.
function bestAt(D,gx,gy,allow,tc){let best=null;for(const [k,d0] of D.dist){const [n,p]=k.split('|');if(n!==gx)continue;let d=d0;if(p===gy){const t=turnCost(gx,allow,tc);if(t==null)continue;d+=t}if(!best||d<best.d)best={k,d}}return best}
const pathTo=(D,k)=>{const p=[k];let g=0;while(D.prev.has(p[0])&&g++<5000)p.unshift(D.prev.get(p[0]));return p.map(q=>q.split('|')[0])};

// Punkt na krawędzi: s mierzone od węzła e.a (krzywa).
export function pointOn(e,s){const p=ptAt(e,s);return[p[0],p[1]]}
export function nearestRoad(x,y,allow=ALL,opts={}){
 let best=null;
 for(const e of EDGES){
  if(!allow.includes(e.kind))continue;
  const q=nearestOn(e,x,y);if(best&&q.d>=best.d)continue;
  const m=opts.margin??30,s=Math.max(Math.min(m,e.len/2),Math.min(e.len-Math.min(m,e.len/2),q.s)),[px,py]=pointOn(e,s),d=Math.hypot(px-x,py-y);
  if(!best||d<best.d)best={edge:e,s,x:px,y:py,d};
 }
 return best;
}
// Plan przejazdu z bieżącej pozycji (krawędź from→to, s od from) do celu (krawędź + s od e.a).
// Wynik: {reverse, nodes:[n0,…,Gx,Gy], stopS} — pojazd jedzie przez węzły, na ostatnim odcinku Gx→Gy staje w stopS.
// pen — koszt zawracania w miejscu (na środku drogi): małe auta stojące w miejscu zawracają chętniej, ciężkie prawie nigdy.
export function planRoute(from,to,s,goal,allow=ALL,pen=6000){
 const tc=pen<3000?120:400;   // zawrócenie na skrzyżowaniu: auto — mały koszt, ciężki sprzęt — większy
 const cur=edgeOf(from,to),L=cur.len,G=goal.edge,sg=goal.s;
 let best=null;
 // cel na tym samym odcinku przed nami — jedziemy prosto
 if(G===cur){
  const sAlong=G.a===from?sg:G.len-sg;
  if(sAlong>=s-1)return{reverse:false,nodes:[],stopS:sAlong};
  best={c:s-sAlong+pen,reverse:true,nodes:[],stopS:L-sAlong};
 }
 for(const [n0,p0,c0,rev] of [[to,from,L-s,false],[from,to,s+pen,true]]){
  const D=dijkstra(n0,p0,allow,tc);
  for(const [gx,gy,last] of [[G.a,G.b,sg],[G.b,G.a,G.len-sg]]){
   if(!allow.includes(G.kind))continue;
   // wjazd na odcinek celu z węzła gx: jeśli gx to węzeł startowy, a odcinek to bieżąca droga — zawracanie
   const B=bestAt(D,gx,gy,allow,tc);if(!B)continue;
   const c=c0+B.d+last;
   if(!best||c<best.c)best={c,reverse:rev,nodes:[...pathTo(D,B.k),gy],stopS:last};
  }
 }
 return best;
}
// Cel = węzeł (np. wyjazd z mapy albo podwórze).
export function goalNode(k){const e=ADJ[k][0].edge;return{edge:e,s:e.a===k?0:e.len}}
