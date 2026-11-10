// Mapa jako dane (wzorzec z farmy): jedno źródło prawdy dla malowania, kolizji, nawigacji i tras pojazdów.
import {WORLD} from './core.js';
import {distToSegment,obbCircle} from './geometry.js';

// ── Graf dróg ──
// main = droga wojewódzka na dole (asfalt), forest = drogi leśne (tłuczeń, trawa pośrodku), drive = wjazd na podwórze leśniczówki.
// Węzły mW i mE leżą poza mapą: tam pojazdy pojawiają się i znikają.
export const NODES={mW:[-140,1720],j1:[820,1720],j2:[1700,1720],mE:[2540,1720],
 a1:[820,1100],a2:[820,560],a3:[820,300],l1:[560,300],yd:[478,300],
 b1:[1700,1100],sk:[1700,1590],b2:[1700,560],e1:[2250,560]};
const F=(a,b)=>({a,b,kind:'forest',w:40,lane:7});
export const EDGES=[
 {a:'mW',b:'j1',kind:'main',w:60,lane:15},{a:'j1',b:'j2',kind:'main',w:60,lane:15},{a:'j2',b:'mE',kind:'main',w:60,lane:15},
 F('j1','a1'),F('a1','a2'),F('a2','a3'),F('a3','l1'),{a:'l1',b:'yd',kind:'drive',w:44,lane:0},
 F('a1','b1'),F('j2','sk'),F('sk','b1'),F('b1','b2'),F('a2','b2'),F('b2','e1')
];
for(const e of EDGES){const A=NODES[e.a],B=NODES[e.b];e.len=Math.hypot(B[0]-A[0],B[1]-A[1]);e.id=e.a+'-'+e.b}
const SEG=EDGES.map(e=>({x1:NODES[e.a][0],y1:NODES[e.a][1],x2:NODES[e.b][0],y2:NODES[e.b][1],w:e.w,kind:e.kind}));
// Odległość od krawędzi jezdni (ujemna = na jezdni).
export function roadClearance(x,y,kinds){let m=1e9;for(const s of SEG)if(!kinds||kinds.includes(s.kind))m=Math.min(m,distToSegment(x,y,s.x1,s.y1,s.x2,s.y2)-s.w/2);return m}

// ── Leśniczówka (północny zachód) ──
export const YARD={x:150,y:150,w:410,h:300,gate:[270,330]};
export const HOUSE={x:196,y:178,w:156,h:108};
export const CARPORT={x:412,y:172,w:112,h:78};
export const WOODSHED={x:172,y:352,w:72,h:70};
export const GARDEN={x:272,y:330,w:124,h:92};
export const KENNEL={x:424,y:372,w:22,h:18};
export const WELL={x:500,y:404};
export const DOOR=[300,296];            // drzwi leśniczówki (od podwórza)
export const PARK_YARD=[478,300];
// Szkółka leśna (budowana w 0.5) — tuż za płotem podwórza, od południa.
export const NURSERY={x:186,y:470,w:214,h:78};

// ── Baza maszyn przy drodze B (dawna składnica; od 0.5 drewno leży w stosach przy drogach) ──
export const SKLAD={x:1726,y:1470,w:250,h:190};
export const STACK={x:1752,y:1500,w:200,h:96};

// ── Polana z amboną, uprawa w grodzeniu ──
export const POLANA={x:2080,y:1090,r:150};
export const AMBONA={x:1946,y:1050};
export const UPRAWA={x:960,y:680,w:400,h:250,gate:[780,828]};   // furtka w zachodnim płocie (od drogi A)

// ── Oddziały (granice biegną drogami, jak liniami oddziałowymi) ──
export const STANDS={
 '101':{name:'101',desc:'starodrzew sosnowy',mix:{sosna:.84,brzoza:.1,dab:.06},age:[66,88]},
 '102':{name:'102',desc:'świerczyna z brzozą',mix:{swierk:.55,brzoza:.25,sosna:.2},age:[38,62]},
 '103':{name:'103',desc:'dąbrowa z bukiem',mix:{dab:.46,buk:.4,sosna:.14},age:[82,115]},
 '104':{name:'104',desc:'młodszy bór mieszany',mix:{sosna:.6,dab:.24,brzoza:.16},age:[32,50]},
 '105':{name:'105',desc:'las mieszany',mix:{swierk:.38,buk:.36,brzoza:.26},age:[48,76]}
};
export function oddzial(x,y){if(x<820)return y<470?'102':'101';if(y<560)return '102';if(x<1700)return y<1100?'103':'104';return '105'}
// Słupki oddziałowe na skrzyżowaniach (numery sąsiednich oddziałów).
export const POSTS=[{x:842,y:1122,n:['103','104']},{x:842,y:582,n:['102','103']},{x:1722,y:1122,n:['104','105']},{x:1722,y:582,n:['102','105']},{x:798,y:1078,n:['101','103']}];
// Szlabany na wjazdach z drogi głównej, tablica leśnictwa.
export const BARRIERS=[{x:820,y:1636},{x:1700,y:1636}];
export const BOARD={x:872,y:1630};

// ── Kolizje (dla pieszych i zwierząt) ──
export const colliders=[];
function addRect(x,y,w,h,id){colliders.push({shape:'obb',x:x+w/2,y:y+h/2,hw:w/2,hh:h/2,a:0,id,br:Math.hypot(w,h)/2})}
function addCircle(x,y,r,id){colliders.push({shape:'circle',x,y,r,id,br:r})}
for(const b of [HOUSE,CARPORT,WOODSHED])addRect(b.x,b.y,b.w,b.h,'building');
addRect(KENNEL.x,KENNEL.y,KENNEL.w,KENNEL.h,'kennel');addCircle(WELL.x,WELL.y,8,'well');
addCircle(AMBONA.x,AMBONA.y,9,'ambona');
// płoty: podwórze (brama od wschodu) i grodzenie uprawy (furtka od zachodu)
export const FENCES=[];
{const {x,y,w,h,gate}=YARD;
 FENCES.push({x1:x,y1:y,x2:x+w,y2:y,style:'yard'},{x1:x,y1:y+h,x2:x+w,y2:y+h,style:'yard'},{x1:x,y1:y,x2:x,y2:y+h,style:'yard'},
  {x1:x+w,y1:y,x2:x+w,y2:gate[0],style:'yard'},{x1:x+w,y1:gate[1],x2:x+w,y2:y+h,style:'yard'});}
{const {x,y,w,h,gate}=UPRAWA;
 FENCES.push({x1:x,y1:y,x2:x+w,y2:y,style:'net'},{x1:x,y1:y+h,x2:x+w,y2:y+h,style:'net'},{x1:x+w,y1:y,x2:x+w,y2:y+h,style:'net'},
  {x1:x,y1:y,x2:x,y2:gate[0],style:'net'},{x1:x,y1:gate[1],x2:x,y2:y+h,style:'net'});}
for(const f of FENCES){
 if(f.y1===f.y2)addRect(Math.min(f.x1,f.x2)-3,f.y1-3,Math.abs(f.x2-f.x1)+6,6,'fence');
 else addRect(f.x1-3,Math.min(f.y1,f.y2)-3,6,Math.abs(f.y2-f.y1)+6,'fence');
}
export function nearbyColliders(x,y,r){const out=[];for(const c of colliders){const dx=c.x-x,dy=c.y-y,rr=r+c.br;if(dx*dx+dy*dy<rr*rr)out.push(c)}return out}
export function pointBlocked(x,y,r=6){
 for(const c of nearbyColliders(x,y,r)){
  if(c.shape==='circle'){if(Math.hypot(c.x-x,c.y-y)<c.r+r)return true}
  else if(obbCircle(c,{x,y,r}))return true;
 }
 return false;
}
export const inRect=(x,y,R,m=0)=>x>R.x-m&&x<R.x+R.w+m&&y>R.y-m&&y<R.y+R.h+m;
export const inPolana=(x,y,m=0)=>Math.hypot(x-POLANA.x,y-POLANA.y)<POLANA.r+m;
export const inWorld=(x,y,m=0)=>x>m&&y>m&&x<WORLD.w-m&&y<WORLD.h-m;
