// Las jako dane: każde drzewo ma gatunek, wiek i stan. Malowanie w kawałkach 256×256 px —
// zmiana jednego drzewa (wycinka, wzrost, posadzenie, pora roku) przemalowuje tylko kawałki, które obejmuje.
import {WORLD,hash,rect,poly,clamp,LIGHT,cal,PX_PER_M,state} from './core.js';
import {mk,outlinedDraw,crispAlpha} from './sprite.js';
import {distToSegment} from './geometry.js';
import {roadClearance,oddzial,STANDS,YARD,PLAC,TURNS,POLANA,UPRAWA,inRect,inPolana,inWorld,EDGES,NODES} from './map.js';

export const SP={
 sosna:{name:'sosna zwyczajna',maxR:30,mature:70,h:28,d:42,vol:1.15,price:250,conifer:true,bark:['#9a5b33','#c47c48']},
 swierk:{name:'świerk pospolity',maxR:25,mature:60,h:30,d:40,vol:1.2,price:240,conifer:true,bark:['#6b5241','#8d7059']},
 dab:{name:'dąb szypułkowy',maxR:42,mature:110,h:30,d:70,vol:2.2,price:420,bark:['#4f4840','#6d6559']},
 buk:{name:'buk zwyczajny',maxR:38,mature:95,h:32,d:60,vol:1.9,price:320,bark:['#7f7c72','#a29e92']},
 brzoza:{name:'brzoza brodawkowata',maxR:22,mature:45,h:24,d:32,vol:.6,price:200,bark:['#e6e2d6','#2e2c28']}
};
export const STAND=0,STUMP=1;
export const SAPLING_AGE=8;      // młodsze drzewka malujemy jako sadzonki (warstwa dolna)
export const CUT_AGE=25;
export const THIN_AGE=12;        // 0.6.2: od tego wieku pojedyncze drzewo można usunąć w trzebieży         // od tego wieku drzewo można wyznaczyć do wycinki (trzebież / rębnia)
export const trees=[];

// ── rozmiar, wysokość, miąższość ──
export const frac=t=>clamp((t.age+(t.gb||0))/SP[t.sp].mature,0,1);   // gb: premia wzrostu z trzebieży (luźniej = szybciej)
// ── jakość drzewa (0.6.2): ukryta, dopóki leśniczy nie oceni drzewostanu ──
export const QUAL=[{name:'dorodne',col:'#6ad06a'},{name:'przeciętne',col:'#e0d050'},{name:'wadliwe (krzywe / chore)',col:'#e05040'}];
const qualityFor=(x,y,planted)=>{const r=hash(x|0,y|0,313);return planted?(r<.25?0:r<.85?1:2):(r<.3?0:r<.8?1:2)};
// Sortymenty: tartaczne (grube, proste), papierówka (cienkie), opał (krzywe, chore, wierzchołki). Udziały w miąższości:
export function sortSplit(t){
 if(t.age<35||volume(t)<.25)return t.q===2?{tart:0,pap:.3,opal:.7}:{tart:0,pap:.7,opal:.3};
 return [{tart:.75,pap:.1,opal:.15},{tart:.5,pap:.25,opal:.25},{tart:.1,pap:.3,opal:.6}][t.q||0];
}
export const SORTS={tart:{name:'drewno tartaczne',short:'tartaczne',k:1.35},pap:{name:'papierówka',short:'papierówka',k:.72},opal:{name:'drewno opałowe',short:'opał',k:.5}};
export const treeValue=t=>{const v=volume(t),f=sortSplit(t);let s=0;for(const k in f)s+=v*f[k]*SP[t.sp].price*SORTS[k].k;return s};
export const crownR=t=>SP[t.sp].maxR*(.1+.9*frac(t)**.75);
export const heightM=t=>SP[t.sp].h*frac(t)**.8;
export const dbhCm=t=>Math.max(1,SP[t.sp].d*frac(t));
export const volume=t=>SP[t.sp].vol*frac(t)**2.2;
export const fallLen=t=>clamp(crownR(t)*4.2,30,170);

// ── generowanie lasu ──
function pickSpecies(mix,u){let a=0;for(const k in mix){a+=mix[k];if(u<a)return k}return Object.keys(mix)[0]}
const nearTurn=(x,y)=>TURNS.some(k=>Math.hypot(x-NODES[k][0],y-NODES[k][1])<118);
const free=(x,y)=>inWorld(x,y,6)&&!nearTurn(x,y)&&!inRect(x,y,YARD,46)&&!inRect(x,y,PLAC,40)&&!inPolana(x,y,6)&&!inRect(x,y,UPRAWA,22);
function addTree(x,y,sp,age,extra={}){const t={id:trees.length,x,y,sp,age,st:STAND,seed:(hash(x|0,y|0,77)*1e6)|0,marked:false,q:qualityFor(x,y,extra.planted),qk:false,gb:0,...extra};t.rI=Math.round(crownR(t));trees.push(t);bucketAdd(t);return t}
// Zapis sprzed 0.6.3: dosadzenie lasu przy drogach (węższe pobocza) i na drogach usuniętych w 0.6.3.
// Tylko tam, gdzie w promieniu 20 px nie ma drzewa ani pniaka i nie ma powierzchni gracza (skip).
export function fillVerges(oldSegs,skip){
 const CELL=38;let n=0;const near=(x,y)=>treesIn(x-20,y-20,x+20,y+20).some(t=>Math.hypot(t.x-x,t.y-y)<20)||treesIn(x-30,y-30,x+30,y+30).some(t=>t.st===STUMP);
 for(let j=0;j*CELL<WORLD.h+CELL;j++)for(let i=0;i*CELL<WORLD.w+CELL;i++){
  if(hash(i,j,1)<.07)continue;
  const x=i*CELL+8+(hash(i,j,2)-.5)*30,y=j*CELL+8+(hash(i,j,3)-.5)*30;
  if(!free(x,y)||skip(x,y))continue;
  const rf=roadClearance(x,y,['forest','drive']),rm=roadClearance(x,y,['main']),onOld=oldSegs.some(([a,b,c,d])=>distToSegment(x,y,a,b,c,d)<90);
  if(!(rf<78||rm<92||onOld)||near(x,y))continue;
  const st=STANDS[oddzial(x,y)],sp=pickSpecies(st.mix,hash(i,j,4)),age=st.age[0]+(st.age[1]-st.age[0])*hash(i,j,5);
  const r=SP[sp].maxR*(.1+.9*clamp(age/SP[sp].mature,0,1)**.75);
  if(rf<Math.max(28+hash(i,j,7)*14,r*.72+6)||rm<Math.max(46,r+10))continue;
  addTree(x,y,sp,onOld?14+hash(i,j,8)*10:Math.max(12,age));n++;
 }
 dirtyAll();return n;
}
export function generate(){
 const CELL=38;
 for(let j=0;j*CELL<WORLD.h+CELL;j++)for(let i=0;i*CELL<WORLD.w+CELL;i++){
  if(hash(i,j,1)<.07)continue;                                   // luki w drzewostanie
  const x=i*CELL+8+(hash(i,j,2)-.5)*30,y=j*CELL+8+(hash(i,j,3)-.5)*30;
  if(!free(x,y))continue;
  const st=STANDS[oddzial(x,y)],sp=pickSpecies(st.mix,hash(i,j,4));
  const age=st.age[0]+(st.age[1]-st.age[0])*hash(i,j,5)+(hash(i,j,6)<.12?-18:0);
  const r=SP[sp].maxR*(.1+.9*clamp(age/SP[sp].mature,0,1)**.75);
  // 0.6.3: węższe pobocza — las bardziej zarośnięty; korona może lekko sięgać nad skraj jezdni
  const rf=roadClearance(x,y,['forest','drive']),rm=roadClearance(x,y,['main']);
  if(rf<Math.max(28+hash(i,j,7)*14,r*.72+6)||rm<Math.max(46,r+10))continue;
  addTree(x,y,sp,Math.max(12,age));
 }
 // młode drzewka na skraju pobocza (brzozy i sosny samosiejki)
 for(const e of EDGES){if(e.kind!=='forest')continue;
  const A=NODES[e.a],B=NODES[e.b],dx=(B[0]-A[0])/e.len,dy=(B[1]-A[1])/e.len;
  for(let s=50;s<e.len-50;s+=42)for(const side of [-1,1]){
   const k=s*7+side*3+e.len;if(hash(k,9,1)>.36)continue;
   const off=e.w/2+12+hash(k,9,2)*12,x=A[0]+dx*s-dy*off*side,y=A[1]+dy*s+dx*off*side;
   if(!free(x,y)||roadClearance(x,y)<9)continue;
   addTree(x,y,hash(k,9,3)<.6?'brzoza':'sosna',9+hash(k,9,4)*9);
  }
 }
 // uprawa: rzędy sadzonek sosny w grodzeniu
 const U=UPRAWA;
 for(let y=U.y+16;y<U.y+U.h-10;y+=22)for(let x=U.x+14;x<U.x+U.w-10;x+=17){
  if(hash(x,y,11)<.06)continue;
  addTree(x+(hash(x,y,12)-.5)*4,y+(hash(x,y,13)-.5)*4,hash(x,y,14)<.85?'sosna':'brzoza',3+hash(x,y,15)*5,{uprawa:true});
 }
}

// Wczytanie stanu lasu z zapisu (zamiast wygenerowanego).
export function loadTrees(arr){
 trees.length=0;for(const b of buckets)b.length=0;
 for(const [x,y,sp,age,st,marked,stumpR,stumpAge,slash,burnt,uprawa,seed,flags,gb] of arr){
  const t=addTree(x,y,sp,age,{st,marked:!!marked,stumpR,stumpAge,burnt:!!burnt,uprawa:!!uprawa,planted:!!(flags&1),prep:!!(flags&2),gb:gb||0});if(seed)t.seed=seed;
  if(flags&32){t.q=(flags>>3)&3;t.qk=!!(flags&4)}
  if(slash)t.slash={x:slash[0],y:slash[1],a:slash[2]};
 }
 dirtyAll();
}
export function serializeTrees(){return trees.map(t=>[+t.x.toFixed(1),+t.y.toFixed(1),t.sp,+t.age.toFixed(2),t.st===STUMP||t.lying?1:0,t.marked||t.assigned?1:0,t.stumpR||(t.lying?clamp(t.lying.r*.2,3,8):0),+(t.stumpAge||0).toFixed(1),t.slash?[Math.round(t.slash.x),Math.round(t.slash.y),+t.slash.a.toFixed(2)]:0,t.burnt?1:0,t.uprawa?1:0,t.seed,(t.planted?1:0)|(t.prep?2:0)|(t.qk?4:0)|((t.q||0)<<3)|32,+(t.gb||0).toFixed(2)])}
// ── indeks przestrzenny (kubełki 128 px) ──
const BK=128,BW=Math.ceil(WORLD.w/BK)+1,BH=Math.ceil(WORLD.h/BK)+1,buckets=Array.from({length:BW*BH},()=>[]);
function bucketAdd(t){buckets[clamp(Math.floor(t.y/BK),0,BH-1)*BW+clamp(Math.floor(t.x/BK),0,BW-1)].push(t)}
export function treesIn(x0,y0,x1,y1){
 const out=[];
 for(let by=clamp(Math.floor(y0/BK),0,BH-1);by<=clamp(Math.floor(y1/BK),0,BH-1);by++)
  for(let bx=clamp(Math.floor(x0/BK),0,BW-1);bx<=clamp(Math.floor(x1/BK),0,BW-1);bx++)
   for(const t of buckets[by*BW+bx])if(t.x>=x0&&t.x<=x1&&t.y>=y0&&t.y<=y1)out.push(t);
 return out;
}
// Drzewo (lub pień) pod kursorem: najbliższy pień w promieniu korony.
export function treeAt(x,y,filter){
 let best=null,bd=1e9;
 for(const t of treesIn(x-50,y-50,x+50,y+50)){
  if(filter&&!filter(t))continue;
  const r=t.st===STUMP?8:Math.max(7,crownR(t)*.8),d=Math.hypot(t.x-x,t.y-y);
  if(d<r&&d/r<bd){bd=d/r;best=t}
 }
 return best;
}

// ── kawałki mapy ──
const CH=256,CW=Math.ceil(WORLD.w/CH),CHH=Math.ceil(WORLD.h/CH),chunks=new Array(CW*CHH).fill(null);
const [maskCv,maskG]=mk(CH,CH);
export function dirtyArea(x0,y0,x1,y1){
 for(let j=clamp(Math.floor(y0/CH),0,CHH-1);j<=clamp(Math.floor(y1/CH),0,CHH-1);j++)
  for(let i=clamp(Math.floor(x0/CH),0,CW-1);i<=clamp(Math.floor(x1/CH),0,CW-1);i++){const c=chunks[j*CW+i];if(c)c.dirty=true}
}
export const dirtyTree=t=>{const R=SP[t.sp].maxR*2.3+8;dirtyArea(t.x-R,t.y-R,t.x+R,t.y+R)};
export function dirtyAll(){for(const c of chunks)if(c)c.dirty=true}
function paintChunk(c,i,j){
 const x0=i*CH,y0=j*CH,M=104;
 const list=treesIn(x0-M,y0-M,x0+CH+M,y0+CH+M).sort((a,b)=>a.y-b.y||a.x-b.x);
 const season=cal.season(),lg=c.lg,hg=scrG;
 lg.setTransform(1,0,0,1,0,0);lg.clearRect(0,0,CH,CH);hg.setTransform(1,0,0,1,0,0);hg.clearRect(0,0,CH,CH);
 // cienie koron: jedna maska (bez podwójnego ciemnienia), potem nałożona półprzezroczyście
 maskG.setTransform(1,0,0,1,-x0,-y0);maskG.clearRect(x0,y0,CH,CH);maskG.fillStyle='#1c2b1b';
 const winterBare=t=>season===3&&!SP[t.sp].conifer;
 for(const t of list){if(t.st!==STAND||t.falling||t.lying||t.age<SAPLING_AGE)continue;
  const r=crownR(t)*(winterBare(t)?.7:1),cx=t.x+LIGHT.x*r*.95,cy=t.y+LIGHT.y*r*.95;
  maskG.beginPath();maskG.ellipse(cx,cy,r*1.05,r*.74,Math.atan2(LIGHT.y,LIGHT.x),0,Math.PI*2);maskG.fill()}
 lg.globalAlpha=season===3?.22:.34;lg.drawImage(maskCv,0,0);lg.globalAlpha=1;
 lg.translate(-x0,-y0);hg.translate(-x0,-y0);
 for(const t of list){
  if(t.slash)paintSlash(lg,t);
  if(t.st===STUMP){paintStump(lg,t);continue}
  if(t.falling||t.lying)continue;
  if(t.age<SAPLING_AGE)paintSapling(lg,t,season);
  else outlinedDraw(hg,t.x,t.y,G=>paintCrown(G,t,season),'#1a2a20');
 }
 // korony malujemy na wspólnym płótnie roboczym (odczyt pikseli), a do kawałka kopiujemy gotowy obraz —
 // kawałki zostają w pamięci karty graficznej i przesuwanie mapy nie przycina
 crispAlpha(scrH);c.hg.setTransform(1,0,0,1,0,0);c.hg.clearRect(0,0,CH,CH);c.hg.drawImage(scrH,0,0);
 c.dirty=false;c.painted=true;
}
const [scrH,scrG]=mk(CH,CH,true);
function chunk(i,j){let c=chunks[j*CW+i];if(!c){const [low,lg]=mk(CH,CH),[high,hg]=mk(CH,CH);c=chunks[j*CW+i]={low,lg,high,hg,dirty:true,painted:false}}return c}
// Rysuje widoczne kawałki jednej warstwy; przemalowanie ograniczone do kilku kawałków na klatkę (zmiana pory roku rozkłada się w czasie).
// Wstępne malowanie kawałków wokół widoku (w zapasie czasu klatki), żeby przy przesuwaniu były już gotowe.
export function prefetchForest(cam,vw,vh,ms=3,all=false){
 const t0=performance.now(),cx=cam.x+vw/2,cy=cam.y+vh/2,mx=all?1e5:vw*.8+CH,my=all?1e5:vh*.8+CH,list=[];
 for(let j=clamp(Math.floor((cam.y-my)/CH),0,CHH-1);j<=clamp(Math.floor((cam.y+vh+my)/CH),0,CHH-1);j++)
  for(let i=clamp(Math.floor((cam.x-mx)/CH),0,CW-1);i<=clamp(Math.floor((cam.x+vw+mx)/CH),0,CW-1);i++){const c=chunks[j*CW+i];if(!c||!c.painted||c.dirty)list.push([i,j,Math.hypot((i+.5)*CH-cx,(j+.5)*CH-cy)])}
 list.sort((a,b)=>a[2]-b[2]);let n=0;
 for(const [i,j] of list){paintChunk(chunk(i,j),i,j);n++;if(performance.now()-t0>ms)break}
 return list.length-n;
}
export function drawForest(g,cam,vw,vh,layer){
 let budget=layer==='low'?4:0;
 const i0=clamp(Math.floor(cam.x/CH),0,CW-1),i1=clamp(Math.floor((cam.x+vw)/CH),0,CW-1),j0=clamp(Math.floor(cam.y/CH),0,CHH-1),j1=clamp(Math.floor((cam.y+vh)/CH),0,CHH-1);
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  const c=chunk(i,j);c.used=frame;
  if(layer==='low'&&c.dirty&&(!c.painted||budget-->0))paintChunk(c,i,j);
  g.drawImage(layer==='low'?c.low:c.high,i*CH,j*CH);
 }
 if(layer==='high'){frame++;if(frame%120===0)evict()}
}
// Duża mapa: trzymamy w pamięci najwyżej MAXC kawałków lasu; dawno niewidziane zwalniamy (namalują się ponownie przy powrocie).
let frame=0;const MAXC=400;   // 0.6.2: praktycznie bez zwalniania — ponowne malowanie przy przesuwaniu powodowało przycięcia
function evict(){
 const live=[];for(let k=0;k<chunks.length;k++)if(chunks[k])live.push(k);
 if(live.length<=MAXC)return;
 live.sort((a,b)=>chunks[a].used-chunks[b].used);
 for(let n=0;n<live.length-MAXC;n++){const c=chunks[live[n]];if(frame-c.used<60)break;chunks[live[n]]=null}
}

// ── malowanie drzew ──
function crownPatch(G,cx,cy,rad,base,lit,seed,dens=2){
 const rr=Math.round(rad);
 for(let yy=-rr;yy<=rr;yy+=3){
  const taper=Math.sqrt(Math.max(0,1-(yy/rad)**2)),w=Math.round(rad*taper*(.86+.15*hash(yy,seed)));
  const shift=Math.round((hash(yy,seed,9)-.5)*4);
  if(w>0)rect(G,cx-w+shift,cy+yy,w*2,3,base);
 }
 for(let k=0;k<Math.round(rad*dens);k++){
  const dx=(hash(k,seed,3)*2-1)*rad,dy=(hash(k,seed,4)*2-1)*rad;
  if(dx*dx+dy*dy>rad*rad*.8)continue;
  rect(G,cx+dx,cy+dy,2+(k%3),1+(k%2),lit[k%lit.length]);
 }
}
const DECID={
 dab:[['#79a24f',['#a3c46f','#5f8a42','#bcd487']],['#4e7a3c',['#6f9a4f','#3d6633','#8aab60']],['#94713a',['#c09045','#74562c','#d8ad5c']]],
 buk:[['#86b452',['#acd172','#679a40','#c6e08a']],['#4a8642',['#69a255','#3a6c37','#86b866']],['#ad5e2a',['#d27c36','#87461f','#e6a050']]],
 brzoza:[['#a6cc68',['#c4e08a','#88b052','#dbeea6']],['#7cad55',['#a2c86c','#64944a','#bfd98a']],['#d4ae3c',['#ebcd5d','#b48d2b','#f3df85']]]
};
export function paintCrown(G,t,season,scale=1){
 const r=crownR(t)*scale,s=t.seed,sp=t.sp;
 if(sp==='sosna'){
  // sosna z góry: nieregularne kępy igliwia z cieniem, prześwity z rudymi gałęziami
  const dull=season===3;
  crownPatch(G,0,0,r*.5,'#2a4a3a',['#24402f','#3a5a3e'],s,.6);
  for(let k=0;k<r*.6;k++){const a=hash(k,s,8)*6.283,d=hash(k,s,9)*r*.75;rect(G,Math.cos(a)*d,Math.sin(a)*d,2,1,'#a8673e')}
  const n=6+(s%4);
  for(let k=0;k<n;k++){const a=k/n*6.283+hash(k,s,1)*.8,d=r*(.3+hash(k,s,2)*.36),cr=r*(.25+hash(k,s,3)*.15),cx=Math.cos(a)*d,cy=Math.sin(a)*d;
   crownPatch(G,cx+1,cy+2,cr,'#22402f',['#1e3a2b'],s+k,.3);
   crownPatch(G,cx,cy,cr*.92,dull?'#466f58':'#3d7350',dull?['#5c8468','#355c47']:['#5a9163','#78a870','#32604a'],s+k*7,1.9)}
  crownPatch(G,-r*.08,-r*.1,r*.26,dull?'#4f7a5e':'#48805a',['#86b07a','#6a9c6a'],s+99,2.2);
  if(dull)snow(G,r,s);
  return;
 }
 if(sp==='swierk'){
  const rot=hash(s,1,1)*6.283,pts=9;
  const layers=season===3?['#1d3f33','#28503f','#355f49','#4c7558']:['#1b4433','#245540','#2f684b','#4a845a'];
  layers.forEach((col,li)=>{const R=r*(1-li*.24),q=[];
   for(let k=0;k<pts*2;k++){const a=rot+li*.3+k/(pts*2)*6.283,rr=k%2?R*.58:R;q.push([Math.cos(a)*rr,Math.sin(a)*rr])}
   poly(G,q,col)});
  for(let k=0;k<r*.8;k++){const a=hash(k,s,5)*6.283,d=hash(k,s,6)*r*.8;rect(G,Math.cos(a)*d,Math.sin(a)*d,1,1,k%3?'#5f9468':'#86b07a')}
  rect(G,-1,-1,2,2,'#8fb57a');
  if(season===3)snow(G,r,s);
  return;
 }
 // liściaste
 if(season===3){paintBare(G,t,r);return}
 const [base,lit]=DECID[sp][season===0?0:season===1?1:2];
 if(sp==='brzoza'){
  for(let k=0;k<4;k++){const a=k*1.57+hash(k,s,1),d=r*.35;crownPatch(G,Math.cos(a)*d,Math.sin(a)*d,r*.5,base,lit,s+k,2.6)}
  rect(G,-1,-2,2,4,'#efece2');rect(G,-1,0,2,1,'#2e2c28');
  return;
 }
 const n=sp==='dab'?5:4;
 crownPatch(G,0,0,r*.72,base,lit,s,1.4);
 for(let k=0;k<n;k++){const a=k/n*6.283+hash(k,s,1)*.7,d=r*(.32+hash(k,s,2)*.18);crownPatch(G,Math.cos(a)*d,Math.sin(a)*d,r*(.42+hash(k,s,3)*.12),base,lit,s+k*5,1.8)}
 crownPatch(G,-r*.12,-r*.12,r*.32,lit[2]||base,lit,s+50,2.2);
}
function snow(G,r,s){for(let k=0;k<r*1.3;k++){const a=hash(k,s,31)*6.283,d=Math.sqrt(hash(k,s,32))*r*.8;rect(G,Math.cos(a)*d,Math.sin(a)*d,2+(k%2),1+(k%3===0),k%3?'#e9eff2':'#c9d6dc')}}
// Zimą liściaste są bezlistne: widać rozgałęzienia (buk trzyma trochę suchych liści).
function paintBare(G,t,r){
 const s=t.seed,birch=t.sp==='brzoza',col=birch?'#d8d2c4':t.sp==='buk'?'#8b8478':'#6e6152',col2=birch?'#a9a294':'#56493d';
 const n=7+(s%3);
 for(let k=0;k<n;k++){
  const a=k/n*6.283+hash(k,s,1)*.6,L=r*(.75+hash(k,s,2)*.25);
  for(let u=2;u<L;u+=1.5){const w=u<L*.4?2:1;rect(G,Math.cos(a)*u,Math.sin(a)*u,w,w,u<L*.5?col2:col)}
  for(const sd of [-1,1]){const a2=a+sd*(.5+hash(k,s,3+sd)*.3),u0=L*(.35+hash(k,s,5)*.2);
   for(let u=0;u<L*.4;u+=1.5)rect(G,Math.cos(a)*u0+Math.cos(a2)*u,Math.sin(a)*u0+Math.sin(a2)*u,1,1,col)}
 }
 if(t.sp==='buk')for(let k=0;k<r*1.2;k++){const a=hash(k,s,7)*6.283,d=hash(k,s,8)*r*.8;rect(G,Math.cos(a)*d,Math.sin(a)*d,2,1,k%2?'#a0673a':'#8a5631')}
 rect(G,-2,-2,4,4,col2);
}
function paintSapling(g,t,season){
 const x=Math.round(t.x),y=Math.round(t.y),r=Math.max(2,Math.round(crownR(t))),s=t.seed;
 rect(g,x+2,y+2,r+1,2,'#2a3d2a40');
 if(SP[t.sp].conifer){
  rect(g,x-r,y,r*2+1,1,'#2f5a3e');rect(g,x,y-r,1,r*2+1,'#2f5a3e');
  rect(g,x-r+1,y-1,r*2-1,3,'#3f744c');rect(g,x-1,y-r+1,3,r*2-1,'#3f744c');rect(g,x,y,1,1,'#7fae6c');
 }else if(season===3){for(let k=0;k<4;k++)rect(g,x-1+(hash(k,s)*3|0)-1,y-r+k*2,1,2,'#6e5a46')}
 else{const [b,l]=DECID[t.sp]?DECID[t.sp][season===0?0:season===1?1:2]:['#6a9a4a',['#8cbf62']];
  for(let k=0;k<5;k++)rect(g,x+(hash(k,s,1)-.5)*r*1.6,y+(hash(k,s,2)-.5)*r*1.6,2,2,k%2?b:l[0]);rect(g,x,y,1,1,'#5a4a36')}
}
function paintStump(g,t){
 const r=t.stumpR||5,x=Math.round(t.x),y=Math.round(t.y),old=(t.stumpAge||0)>12;
 g.fillStyle='#2b241c';g.beginPath();g.arc(x,y,r+1,0,6.283);g.fill();
 g.fillStyle=old?'#6b5c4b':SP[t.sp].bark[0];g.beginPath();g.arc(x,y,r,0,6.283);g.fill();
 g.fillStyle=old?'#8f7f69':'#d8b47c';g.beginPath();g.arc(x,y,r-1.5,0,6.283);g.fill();
 if(!old){g.strokeStyle='#b58f5c';g.lineWidth=1;g.beginPath();g.arc(x,y,Math.max(1,r-3.5),0,6.283);g.stroke()}
 rect(g,x,y,1,1,'#8a6a44');
}
function paintSlash(g,t){
 const {x,y,a}=t.slash,s=t.seed,old=(t.stumpAge||0)>4,green=SP[t.sp].conifer&&!old;
 for(let k=0;k<26;k++){const u=(hash(k,s,21)-.5)*30,v=(hash(k,s,22)-.5)*14,px=x+Math.cos(a)*u-Math.sin(a)*v,py=y+Math.sin(a)*u+Math.cos(a)*v;
  rect(g,px,py,2+(k%3),1,green?(k%2?'#3e6a45':'#557d4f'):(k%2?'#7a6450':'#5e4c3b'))}
}

// ── wzrost i stan ──
// Las rośnie skokowo, przy zmianie pory roku (czas lasu). Zwraca, ile sadzonek przeszło w młode drzewka.
// Udatność: część świeżo posadzonych sadzonek nie przyjmuje się — bez przygotowania gleby dużo więcej (sucha ściółka, chwasty).
export function seasonGrow(years){
 let grown=0,died=0,young=0;
 for(const t of trees.slice()){
  if(t.st===STUMP){t.stumpAge=(t.stumpAge||0)+years;continue}
  if(t.planted&&t.age<4){young++;if(hash(t.seed,Math.floor(t.age*10),91)<(t.prep?.05:.25)){removeTree(t);died++;continue}}
  const was=t.age<SAPLING_AGE;t.age+=years;if(was&&t.age>=SAPLING_AGE)grown++;
  // 0.6.2: w luźniejszym drzewostanie (po trzebieży) drzewa przyrastają szybciej; dorodne lepiej, wadliwe słabiej
  if(t.age>=THIN_AGE&&t.age<120){const r=crownR(t)*1.7;let n=0;for(const q of treesIn(t.x-r,t.y-r,t.x+r,t.y+r))if(q!==t&&q.st===STAND&&q.age>=SAPLING_AGE&&Math.hypot(q.x-t.x,q.y-t.y)<r)n++;
   t.gb=(t.gb||0)+years*(clamp(.35-.06*n,-.25,.35)+[.1,0,-.1][t.q||0])}
  t.rI=Math.round(crownR(t));
 }
 dirtyAll();return{grown,died,young};
}
export function testGrow(years){for(const t of trees)if(t.st===STAND&&t.age<60){t.age+=years;t.rI=Math.round(crownR(t));dirtyTree(t)}}
// Wycinka: start (korona znika z warstwy), upadek (rysowany dynamicznie), leżące drzewo, wyrzynka (pień + gałęzie).
export function startFall(t,dir){t.marked=false;t.falling={p:0,dir,L:fallLen(t),r:crownR(t)};dirtyTree(t)}
export function updateFalls(dt,list){for(const t of list)if(t.falling){t.falling.p+=dt/1.5;if(t.falling.p>=1){t.lying={dir:t.falling.dir,L:t.falling.L,r:t.falling.r};t.falling=null;t.onLand&&t.onLand()}}}
export function finishTree(t){
 const L=t.lying;t.slash={x:t.x+Math.cos(L.dir)*L.L*.85,y:t.y+Math.sin(L.dir)*L.L*.85,a:L.dir};
 t.stumpR=clamp(L.r*.2,3,8);t.st=STUMP;t.stumpAge=0;t.lying=null;dirtyTree(t);
}
export function plantTree(x,y,sp,prep=false){const t=addTree(x,y,sp,1,{planted:true,prep});dirtyTree(t);return t}
export function removeTree(t){const i=trees.indexOf(t);if(i>=0)trees.splice(i,1);for(const b of buckets){const k=b.indexOf(t);if(k>=0){b.splice(k,1);break}}dirtyTree(t)}
export function speciesFor(x,y){const st=STANDS[oddzial(x,y)];let best=null,b=0;for(const k in st.mix)if(st.mix[k]>b){b=st.mix[k];best=k}return best}
// Pokrycie (suma powierzchni koron) do wskaźnika „Stan lasu”.
export function coverSum(){let s=0;for(const t of trees)if(t.st===STAND&&!t.falling&&!t.lying){const r=crownR(t);s+=r*r}return s}
export function counts(){let stand=0,stumps=0,saplings=0,marked=0;for(const t of trees){if(t.st===STUMP)stumps++;else{stand++;if(t.age<SAPLING_AGE)saplings++;if(t.marked)marked++}}return{stand,stumps,saplings,marked}}
