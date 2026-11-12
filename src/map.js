// Mapa jako dane (wzorzec z farmy): jedno źródło prawdy dla malowania, kolizji, nawigacji i tras pojazdów.
// 0.6.4 „Nowe drogi”: drogi to gładkie krzywe (linie łamane gęsto próbkowane), jedna wspólna geometria dla jazdy, malowania i kolizji.
import {WORLD} from './core.js';
import {obbCircle} from './geometry.js';

// ── Krzywe ──
const D=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
// Catmull–Rom przez punkty kontrolne (węzły drogi leżą dokładnie na jej końcach)
function cr(P){const out=[];for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)],n=Math.max(2,Math.round(D(p1,p2)/12));
 for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(c=>.5*(2*p1[c]+(p2[c]-p0[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(3*p1[c]-p0[c]-3*p2[c]+p3[c])*t3)))}}
 out.push(P[P.length-1].slice());return out}
// zagęszczenie prostych odcinków (żeby dało się dzielić ścieżkę w dowolnym miejscu)
function dens(P,st=12){const out=[P[0].slice()];for(let i=1;i<P.length;i++){const A=P[i-1],B=P[i],n=Math.max(1,Math.round(D(A,B)/st));for(let k=1;k<=n;k++)out.push([A[0]+(B[0]-A[0])*k/n,A[1]+(B[1]-A[1])*k/n])}return out}
// łamana z zaokrąglonymi narożnikami (łuk = krzywa Béziera z punktem kontrolnym w narożniku)
function rounded(P,r){const out=[P[0].slice()];for(let i=1;i<P.length-1;i++){const A=P[i-1],B=P[i],C=P[i+1],la=D(A,B),lc=D(B,C),t=Math.min(r,la/2,lc/2),
  T1=[B[0]+(A[0]-B[0])*t/la,B[1]+(A[1]-B[1])*t/la],T2=[B[0]+(C[0]-B[0])*t/lc,B[1]+(C[1]-B[1])*t/lc];
 for(let k=0;k<=14;k++){const u=k/14,a=(1-u)*(1-u),b=2*u*(1-u),c=u*u;out.push([a*T1[0]+b*B[0]+c*T2[0],a*T1[1]+b*B[1]+c*T2[1]])}}
 out.push(P[P.length-1].slice());return dens(out)}
const nearIdx=(P,pt)=>{let bi=0,bd=1e9;P.forEach((p,i)=>{const d=D(p,pt);if(d<bd){bd=d;bi=i}});return bi};

// ── Szosa: łagodny łuk (y zależy od x) ──
export const hy=x=>1724-26*Math.sin(Math.PI*(x+140)/3880);
const HX={j1:820,j2:1700,j3:2600,j4:3260};
export const NODES={mW:[-140,hy(-140)],j1:[820,hy(820)],j2:[1700,hy(1700)],j3:[2600,hy(2600)],j4:[3260,hy(3260)],mE:[3740,hy(3740)],
 // dukty północne (zakręcone) i pętle
 a3:[820,1400],a1:[800,1000],b1:[1720,1150],b2:[1680,560],c1:[2600,1100],
 // leśniczówka (0.6.4: zachód, przy szosie i wjeździe w duktę)
 l1:[720,1400],yd:[478,1400]};
export const EDGES=[];
function mkEdge(a,b,kind,w,lane,pts){pts=dens(pts);pts[0]=NODES[a].slice();pts[pts.length-1]=NODES[b].slice();
 const e={a,b,kind,w,lane,pts,id:a+'-'+b,cum:[0]};for(let i=1;i<pts.length;i++)e.cum.push(e.cum[i-1]+D(pts[i-1],pts[i]));e.len=e.cum[e.cum.length-1];EDGES.push(e);return e}
const F=(a,b,ctrl)=>mkEdge(a,b,'forest',40,7,cr([NODES[a],...ctrl,NODES[b]]));
// szosa
{const ks=['mW','j1','j2','j3','j4','mE'];for(let i=0;i<5;i++){const A=NODES[ks[i]],B=NODES[ks[i+1]],c=[];for(let x=A[0]+260;x<B[0]-130;x+=260)c.push([x,hy(x)]);mkEdge(ks[i],ks[i+1],'main',60,15,cr([A,...c,B]))}}
// pętla południowa: prostokąt z zaokrąglonymi rogami, wyjazdy z szosy dokładnie naprzeciw dukt północnych (j1, j4) i środkowej (j2)
{const P=rounded([[820,hy(820)],[820,2310],[3260,2310],[3260,hy(3260)]],110);
 NODES.s2=[1700,2310];const i2=nearIdx(P,NODES.s2);NODES.s2=P[i2].slice();
 const i3=nearIdx(P,[3260,2310]);NODES.se=P[i3].slice();
 mkEdge('j1','s2','forest',40,7,P.slice(0,i2+1));mkEdge('s2','se','forest',40,7,P.slice(i2,i3+1));mkEdge('se','j4','forest',40,7,P.slice(i3));
 mkEdge('j2','s2','forest',40,7,[NODES.j2,NODES.s2]);
 // ślepa droga z narożnika pętli do mokradła (paśnik P2); na końcu mały plac nawrotowy
 NODES.w1=[3392,2530];mkEdge('se','w1','forest',40,7,cr([NODES.se,[3300,2380],[3350,2450],NODES.w1]))}
// dukty północne
F('j1','a3',[[820,1560]]);
F('a3','a1',[[842,1280],[812,1130]]);
F('a1','b2',[[822,900],[840,780],[826,640],[850,540],[1000,480],[1200,505],[1420,590]]);
F('a1','b1',[[1000,1060],[1250,1000],[1480,1110]]);
F('j2','b1',[[1706,1500],[1740,1300]]);
F('b1','b2',[[1745,950],[1690,780]]);
F('b2','c1',[[1850,520],[2050,600],[2250,560],[2400,500],[2520,580],[2640,560],[2610,760],[2640,950]]);
F('c1','j3',[[2570,1300],[2620,1500]]);
F('c1','j4',[[2800,1050],[3000,1120],[3150,1115],[3230,1160],[3262,1250],[3260,1500]]);
// droga do leśniczówki i podjazd
F('a3','l1',[]);mkEdge('l1','yd','drive',44,0,[NODES.l1,NODES.yd]);
// Place nawrotowe: jedynie mały plac na końcu ślepej drogi (u ślepego końca pojazd zawraca bez kosztu)
export const TURNS=['w1'];

// ── Dostęp do geometrii krzywej ──
const idxAt=(e,s)=>{const c=e.cum;let lo=0,hi=c.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(c[m]<=s)lo=m;else hi=m}return lo};
// punkt i wersor stycznej w odległości s od węzła e.a
export function ptAt(e,s){const c=e.cum;s=s<0?0:s>e.len?e.len:s;const lo=idxAt(e,s),hi=lo+1,L=c[hi]-c[lo]||1,t=(s-c[lo])/L,A=e.pts[lo],B=e.pts[hi];
 return[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,(B[0]-A[0])/L,(B[1]-A[1])/L]}
// punkt/styczna dla jazdy od węzła from (s liczone od from)
export function dirPt(e,from,s){if(from===e.a)return ptAt(e,s);const p=ptAt(e,e.len-s);return[p[0],p[1],-p[2],-p[3]]}
// najbliższy punkt krawędzi; s0+win — szukanie tylko w pobliżu podpowiedzi (jazda), inaczej na całej drodze
export function nearestOn(e,x,y,s0=null,win=90){
 const P=e.pts,c=e.cum;let i0=0,i1=P.length-2;
 if(s0!=null){i0=idxAt(e,Math.max(0,s0-win));i1=Math.min(P.length-2,idxAt(e,Math.min(e.len,s0+win)))}
 let bs=0,bd=1e18,bx=0,by=0;
 for(let i=i0;i<=i1;i++){const A=P[i],B=P[i+1],dx=B[0]-A[0],dy=B[1]-A[1],l2=dx*dx+dy*dy||1;let t=((x-A[0])*dx+(y-A[1])*dy)/l2;t=t<0?0:t>1?1:t;
  const px=A[0]+dx*t,py=A[1]+dy*t,d=(px-x)*(px-x)+(py-y)*(py-y);if(d<bd){bd=d;bs=c[i]+t*(c[i+1]-c[i]);bx=px;by=py}}
 return{s:bs,d:Math.sqrt(bd),x:bx,y:by}}
// postęp s (od węzła from) rzutu punktu na krawędź
export function dirProj(e,from,x,y,s0,win=90){if(from===e.a)return nearestOn(e,x,y,s0,win).s;return e.len-nearestOn(e,x,y,s0==null?null:e.len-s0,win).s}

// ── Odległość od krawędzi jezdni (ujemna = na jezdni) ──
// Odcinki w siatce 128 px; poza zasięgiem 100 px od drogi zwracamy ≥100 (dokładna wartość nie jest potrzebna).
const SEG=[];for(const e of EDGES)for(let i=0;i<e.pts.length-1;i++){const A=e.pts[i],B=e.pts[i+1];SEG.push({x1:A[0],y1:A[1],x2:B[0],y2:B[1],w:e.w,kind:e.kind})}
const CELL=128,OFF=300,GW=Math.ceil((WORLD.w+2*OFF)/CELL),GH=Math.ceil((WORLD.h+2*OFF)/CELL),GRID=Array.from({length:GW*GH},()=>[]);
for(const s of SEG){const R=s.w/2+100,x0=Math.floor((Math.min(s.x1,s.x2)-R+OFF)/CELL),x1=Math.floor((Math.max(s.x1,s.x2)+R+OFF)/CELL),y0=Math.floor((Math.min(s.y1,s.y2)-R+OFF)/CELL),y1=Math.floor((Math.max(s.y1,s.y2)+R+OFF)/CELL);
 for(let j=Math.max(0,y0);j<=Math.min(GH-1,y1);j++)for(let i=Math.max(0,x0);i<=Math.min(GW-1,x1);i++)GRID[j*GW+i].push(s)}
export function roadClearance(x,y,kinds){const i=Math.floor((x+OFF)/CELL),j=Math.floor((y+OFF)/CELL);if(i<0||j<0||i>=GW||j>=GH)return 160;
 let m=160;for(const s of GRID[j*GW+i]){if(kinds&&!kinds.includes(s.kind))continue;
  const dx=s.x2-s.x1,dy=s.y2-s.y1,l2=dx*dx+dy*dy||1;let t=((x-s.x1)*dx+(y-s.y1)*dy)/l2;t=t<0?0:t>1?1:t;
  const d=Math.hypot(x-(s.x1+dx*t),y-(s.y1+dy*t))-s.w/2;if(d<m)m=d}return m}

// ── Leśniczówka (zachód, przy szosie i wjeździe w duktę — 0.6.4) ──
export const LDY=1100;   // przesunięcie względem układu z 0.6.3 (NW → zachód-środek)
export const YARD={x:150,y:150+LDY,w:570,h:300,gate:[270+LDY,330+LDY]};   // 0.7.4: podwórze obejmuje plac
export const HOUSE={x:196,y:178+LDY,w:156,h:108};
export const CARPORT={x:412,y:172+LDY,w:112,h:78};
export const WOODSHED={x:172,y:352+LDY,w:72,h:70};
export const NURSERY={x:262,y:1428,w:150,h:100};   // szkółka leśna na podwórzu (0.7.2)
export const KENNEL={x:424,y:372+LDY,w:22,h:18};
export const WELL={x:500,y:404+LDY};
export const DOOR=[300,296+LDY];            // drzwi leśniczówki (od podwórza)
export const PARK_YARD=[478,300+LDY];
// ── Plac manewrowy przy leśniczówce (0.6): tu nocują maszyny zrywkowe i stoi kupiony forwarder ──
export const PLAC={x:540,y:340+LDY,w:170,h:100};   // 0.7.4: plac wewnątrz podwórza (żwir jak reszta)
export const GARAGE={x:540,y:172+LDY,w:112,h:78};   // magazyn/garaż obok wiaty (kupowany)
export const PLAC_SPOTS=[{x:584,y:392+LDY,h:Math.PI/2},{x:664,y:392+LDY,h:Math.PI/2}];   // h: kierunek jazdy (na wschód)

// ── Polana z amboną: nieregularna (zatoki), uprawa w grodzeniu ──
export const POLANA={x:2100,y:1060,r:150};
export const polR=a=>POLANA.r*(1+.17*Math.sin(2*a+1)+.1*Math.sin(3*a+.5)+.06*Math.sin(5*a+2));
export const AMBONA={x:1958,y:1030};
// Szkółka leśna: ogrodzony plac w oddz. 101 od początku gry (pusty); kupno uruchamia produkcję sadzonek (0.7)

// ── Mokradła i strumień (łańcuch: zachód → środek → południowy wschód) ──
export const WETLANDS=[{x:470,y:1010,rx:120,ry:62},{x:1850,y:1430,rx:130,ry:70},{x:3440,y:2590,rx:115,ry:60}];
export const STREAM=dens(cr([[585,1030],[700,1110],[850,1200],[1100,1260],[1400,1330],[1730,1400],[1850,1430],[1990,1455],[2090,1520],[2180,1610],[2230,1710],[2300,1830],[2450,1980],[2650,2090],[2850,2160],[3000,2200],[3100,2330],[3250,2420],[3380,2520],[3440,2590]]),10);
export const inWetland=(x,y,m=0)=>WETLANDS.some(w=>((x-w.x)/(w.rx+m))**2+((y-w.y)/(w.ry+m))**2<1);
export function streamDist(x,y){let m=1e9;for(let i=0;i<STREAM.length-1;i++){const A=STREAM[i],B=STREAM[i+1];if(Math.abs(A[0]-x)>60&&Math.abs(B[0]-x)>60)continue;if(Math.abs(A[1]-y)>60&&Math.abs(B[1]-y)>60)continue;
 const dx=B[0]-A[0],dy=B[1]-A[1],l2=dx*dx+dy*dy||1;let t=((x-A[0])*dx+(y-A[1])*dy)/l2;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-A[0]-dx*t,y-A[1]-dy*t))}return m}
export const inWater=(x,y,m=0)=>inWetland(x,y,m)||streamDist(x,y)<8+m;
// paśniki: stałe miejsca (0.6.4 — wszystkie 4; od 0.9 gra zaczyna od jednego, resztę się dokupuje)
export const FEEDERS=[{name:'P1 (polana)',x:POLANA.x+40,y:POLANA.y-60},{name:'P2 (mokradło SE)',x:3340,y:2560},{name:'P3 (mokradło przy leśniczówce)',x:548,y:1092},{name:'P4 (skraj puszczy)',x:2695,y:790}];
// miejsca zarezerwowane na kolejne wersje: parking leśny przy szosie (0.8), ścieżka przyrodnicza (0.9), drogi pożarowe z tablicami (0.7)
export const RESERVED=[{id:'sciezka',x:2840,y:1280,w:120,h:90}];
export const FIRE_SIGNS=[{x:842,y:1250,n:1},{x:1740,y:1330,n:2},{x:2625,y:1390,n:3},{x:3280,y:1420,n:4}];

// ── Oddziały: regularna siatka przesiek (wąskie proste linie podziału, trawa i słupki; dla pieszych i zwierząt, nie dla aut) ──
// 12 oddziałów 101–112 od NW do SE: trzy rzędy (północ I/II, południe) × cztery kolumny.
export const GX=[1250,2150,2950],GY=870;
export const PRZESIEKI=[...GX.map(x=>({x1:x,y1:0,x2:x,y2:1660,dir:'v'})),{x1:0,y1:GY,x2:WORLD.w,y2:GY,dir:'h'},...GX.map(x=>({x1:x,y1:1790,x2:x,y2:WORLD.h,dir:'v'}))];
export const onPrzesieka=(x,y,m=8)=>{for(const p of PRZESIEKI){if(p.dir==='v'){if(Math.abs(x-p.x1)<m&&y>p.y1&&y<p.y2)return true}else if(Math.abs(y-p.y1)<m)return true}return false};
export const STANDS={
 '101':{name:'101',desc:'starodrzew sosnowy',mix:{sosna:.84,brzoza:.1,dab:.06},age:[66,88]},
 '102':{name:'102',desc:'świerczyna z brzozą',mix:{swierk:.55,brzoza:.25,sosna:.2},age:[38,62]},
 '103':{name:'103',desc:'dąbrowa z bukiem',mix:{dab:.46,buk:.4,sosna:.14},age:[82,115]},
 '104':{name:'104',desc:'puszcza: stary, ciemny drzewostan bez dróg',mix:{swierk:.46,buk:.28,dab:.16,sosna:.1},age:[96,130]},
 '105':{name:'105',desc:'las mieszany przy leśniczówce',mix:{swierk:.38,buk:.36,brzoza:.26},age:[48,76]},
 '106':{name:'106',desc:'młodszy bór mieszany',mix:{sosna:.6,dab:.24,brzoza:.16},age:[32,50]},
 '107':{name:'107',desc:'stara świerczyna',mix:{swierk:.7,sosna:.15,brzoza:.15},age:[70,96]},
 '108':{name:'108',desc:'bór sosnowy w średnim wieku',mix:{sosna:.8,brzoza:.12,dab:.08},age:[40,62]},
 '109':{name:'109',desc:'młodszy bór sosnowy przy szosie',mix:{sosna:.74,brzoza:.2,swierk:.06},age:[24,42]},
 '110':{name:'110',desc:'bór sosnowy w środku pętli',mix:{sosna:.72,brzoza:.18,swierk:.1},age:[34,58]},
 '111':{name:'111',desc:'młode sosny z brzozą',mix:{sosna:.76,brzoza:.24},age:[18,36]},
 '112':{name:'112',desc:'grąd przy mokradle: dąb, buk, brzoza',mix:{dab:.36,buk:.34,brzoza:.2,sosna:.1},age:[60,92]}
};
export function oddzial(x,y){
 const r=y<GY?0:y<1720?1:2,c=x<GX[0]?0:x<GX[1]?1:x<GX[2]?2:3;return String(101+r*4+c)}
// Słupki oddziałowe: skrzyżowania przesiek i miejsca, gdzie przesieki dochodzą do szosy (numery sąsiednich oddziałów).
const st=(r,c)=>String(101+r*4+c);
export const POSTS=[...GX.flatMap((x,i)=>[{x:x+14,y:GY+14,n:[st(0,i)+' '+st(0,i+1),st(1,i)+' '+st(1,i+1)]},
 {x:x+14,y:hy(x)-46,n:[st(1,i)+' '+st(1,i+1)]},{x:x+14,y:hy(x)+52,n:[st(2,i)+' '+st(2,i+1)]}])];
// Szlabany na wjazdach z szosy w dukty i tablica leśnictwa.
export const BARRIERS=[];{   // 0.7.2: słup na poboczu dukty, ramię wzdłuż drogi (otwarte); pozycja liczona z geometrii dukty
 const fe=EDGES.filter(e=>e.kind==='forest'),near=(x,y)=>{let b=null;for(const e of fe)for(let s=0;s<=e.len;s+=6){const p=ptAt(e,s),d=Math.hypot(p[0]-x,p[1]-y);if(!b||d<b.d)b={d,x:p[0],y:p[1],tx:p[2],ty:p[3]}}return b};
 for(const k of ['j1','j2','j3','j4'])for(const sg of [-1,1]){if(k==='j3'&&sg>0)continue;const x=HX[k],y=hy(x)+(k==='j2'&&sg<0?205:84)*sg,b=near(x,y);   // 0.8.3: szlaban przy j2 dalej od szosy — przed nim jest zatoka parkingowa
  let nx=-b.ty,ny=b.tx;if(nx<0||(Math.abs(nx)<.2&&ny<0)){nx=-nx;ny=-ny}
  const a=b.ty*(b.y-hy(b.x))>0?1:-1;BARRIERS.push({x:b.x+nx*32,y:b.y+ny*32,bx:b.tx*a,by:b.ty*a})}
}
export const BOARD={x:872,y:hy(820)-96};

// ── Kolizje (dla pieszych i zwierząt) ──
export const colliders=[];
function addRect(x,y,w,h,id){colliders.push({shape:'obb',x:x+w/2,y:y+h/2,hw:w/2,hh:h/2,a:0,id,br:Math.hypot(w,h)/2})}
function addCircle(x,y,r,id){colliders.push({shape:'circle',x,y,r,id,br:r})}
for(const b of [HOUSE,CARPORT,GARAGE,WOODSHED])addRect(b.x,b.y,b.w,b.h,'building');
addRect(KENNEL.x,KENNEL.y,KENNEL.w,KENNEL.h,'kennel');addCircle(WELL.x,WELL.y,8,'well');addRect(NURSERY.x,NURSERY.y,NURSERY.w,NURSERY.h,'nursery');
addCircle(AMBONA.x,AMBONA.y,9,'ambona');
// płoty: podwórze (brama od wschodu) i grodzenie uprawy (furtka od zachodu)
export const FENCES=[];
{const {x,y,w,h,gate}=YARD;
 FENCES.push({x1:x,y1:y,x2:x+w,y2:y,style:'yard'},{x1:x,y1:y+h,x2:x+w,y2:y+h,style:'yard'},{x1:x,y1:y,x2:x,y2:y+h,style:'yard'},
  {x1:x+w,y1:y,x2:x+w,y2:gate[0],style:'yard'},{x1:x+w,y1:gate[1],x2:x+w,y2:y+h,style:'yard'});}
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
export const inPolana=(x,y,m=0)=>Math.hypot(x-POLANA.x,y-POLANA.y)<polR(Math.atan2(y-POLANA.y,x-POLANA.x))+m;
export const inWorld=(x,y,m=0)=>x>m&&y>m&&x<WORLD.w-m&&y<WORLD.h-m;
