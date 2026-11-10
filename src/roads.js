// Graf dróg: sąsiedztwo, najkrótsze trasy (Dijkstra), najbliższy punkt drogi i plan przejazdu do dowolnego miejsca.
import {NODES,EDGES} from './map.js';
const ADJ={};for(const k in NODES)ADJ[k]=[];
for(const e of EDGES){ADJ[e.a].push({edge:e,to:e.b});ADJ[e.b].push({edge:e,to:e.a})}
export const neighbours=k=>ADJ[k];
export const edgeOf=(a,b)=>ADJ[a].find(n=>n.to===b)?.edge;
export const ALL=['main','forest','drive'];
export const offMap=k=>{const p=NODES[k];return p[0]<0||p[0]>2400||p[1]<0||p[1]>1800};

function dijkstra(src,allow){
 const dist={},prev={},done=new Set();for(const k in NODES)dist[k]=1e9;dist[src]=0;
 for(;;){let u=null,b=1e9;for(const k in dist)if(!done.has(k)&&dist[k]<b){b=dist[k];u=k}
  if(!u)break;done.add(u);
  for(const n of ADJ[u]){if(!allow.includes(n.edge.kind))continue;const d=b+n.edge.len;if(d<dist[n.to]){dist[n.to]=d;prev[n.to]=u}}}
 return{dist,prev};
}
const pathTo=(D,t)=>{const p=[t];while(D.prev[p[0]])p.unshift(D.prev[p[0]]);return p};

// Punkt na krawędzi: s mierzone od węzła e.a.
export function pointOn(e,s){const A=NODES[e.a],B=NODES[e.b],t=s/e.len;return[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]}
export function nearestRoad(x,y,allow=ALL,opts={}){
 let best=null;
 for(const e of EDGES){
  if(!allow.includes(e.kind))continue;
  const A=NODES[e.a],B=NODES[e.b],dx=B[0]-A[0],dy=B[1]-A[1];
  let s=((x-A[0])*dx+(y-A[1])*dy)/e.len;
  const m=opts.margin??30;s=Math.max(Math.min(m,e.len/2),Math.min(e.len-Math.min(m,e.len/2),s));
  const [px,py]=pointOn(e,s),d=Math.hypot(px-x,py-y);
  if(!best||d<best.d)best={edge:e,s,x:px,y:py,d};
 }
 return best;
}
// Plan przejazdu z bieżącej pozycji (krawędź from→to, s od from) do celu (krawędź + s od e.a).
// Wynik: {reverse, nodes:[n0,…,Gx,Gy], stopS} — pojazd jedzie przez węzły, na ostatnim odcinku Gx→Gy staje w stopS.
export function planRoute(from,to,s,goal,allow=ALL){
 const cur=edgeOf(from,to),L=cur.len,G=goal.edge,sg=goal.s;
 // cel na tym samym odcinku
 if(G===cur){
  const sAlong=G.a===from?sg:G.len-sg;
  if(sAlong>=s-1)return{reverse:false,nodes:[],stopS:sAlong};
  return{reverse:true,nodes:[],stopS:L-sAlong};
 }
 let best=null;
 for(const [n0,c0,rev] of [[to,L-s,false],[from,s+40,true]]){
  const D=dijkstra(n0,allow);
  for(const [gx,gy,last] of [[G.a,G.b,sg],[G.b,G.a,G.len-sg]]){
   if(D.dist[gx]>=1e9||!allow.includes(G.kind))continue;
   const c=c0+D.dist[gx]+last;
   if(!best||c<best.c)best={c,reverse:rev,nodes:[...pathTo(D,gx),gy],stopS:last};
  }
 }
 return best;
}
// Cel = węzeł (np. wyjazd z mapy albo podwórze).
export function goalNode(k){const e=ADJ[k][0].edge;return{edge:e,s:e.a===k?0:e.len}}
