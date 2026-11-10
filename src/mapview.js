// Mapa leśnictwa (0.6, klawisz Tab): cały obszar z góry, drzewa w kolorach gatunku albo klasy wieku,
// drogi, oddziały, powierzchnie odnowieniowe, stosy i pojazdy. Klik przenosi kamerę w to miejsce.
import {WORLD,camera,VIEW,$} from './core.js';
import {trees,STAND,STUMP,SAPLING_AGE,crownR,QUAL} from './forest.js';
import {NODES,EDGES,STANDS,oddzial,YARD,POLANA,UPRAWA,PLAC} from './map.js';
import {R} from './renew.js';
import {J} from './jobs.js';
import {U} from './incidents.js';
import {centerOn} from './ui.js';

const K=4;   // 1 piksel mapy = 4 px świata
const SPC={sosna:'#3f7a4a',swierk:'#1f4a36',dab:'#9a8a2e',buk:'#c0763a',brzoza:'#cfe08e'};
const SPN={sosna:'sosna',swierk:'świerk',dab:'dąb',buk:'buk',brzoza:'brzoza'};
const AGES=[[SAPLING_AGE,'#f0e070','uprawa (do 8 lat)'],[25,'#9ad06a','młodnik (8–25)'],[60,'#4a9a50','drągowina i średni (25–60)'],[90,'#2f6e40','dojrzały (60–90)'],[999,'#173a26','starodrzew (90+)']];
let open=false,mode='sp',cv=null,g=null,bg=null,T=0;
const ageCol=a=>AGES.find(q=>a<q[0])[1];
// tło (raz): oddziały w jasnych barwach i ich numery
function background(){
 const c=document.createElement("canvas");c.width=WORLD.w/K;c.height=WORLD.h/K;const x=c.getContext('2d');
 const ODC={'101':'#d9d4b8','102':'#cfd2bc','103':'#ddd0b4','104':'#d6d6b8','105':'#d2d2bc','106':'#cbcfbb','107':'#d8d6b6','108':'#d6d2b6','109':'#dccfb6','110':'#d9d9ba'};
 for(let y=0;y<c.height;y+=3)for(let X=0;X<c.width;X+=3){x.fillStyle=ODC[oddzial(X*K,y*K)]||'#d6d2b8';x.fillRect(X,y,3,3)}
 x.strokeStyle='#8a7a5a';x.lineCap='round';
 for(const e of EDGES){const A=NODES[e.a],B=NODES[e.b];x.lineWidth=e.kind==='main'?5:3;x.strokeStyle=e.kind==='main'?'#6a6e72':'#a8946a';x.beginPath();x.moveTo(A[0]/K,A[1]/K);x.lineTo(B[0]/K,B[1]/K);x.stroke()}
 x.fillStyle='#b89a6a';x.fillRect(YARD.x/K,YARD.y/K,YARD.w/K,YARD.h/K);x.fillStyle='#a8a08a';x.fillRect(PLAC.x/K,PLAC.y/K,PLAC.w/K,PLAC.h/K);
 x.fillStyle='#b8cc8a';x.beginPath();x.arc(POLANA.x/K,POLANA.y/K,POLANA.r/K,0,6.28);x.fill();
 return c;
}
// środek każdego oddziału (do podpisu)
let centers=null;
function oddCenters(){const acc={};for(let y=40;y<WORLD.h;y+=80)for(let x=40;x<WORLD.w;x+=80){const o=oddzial(x,y),a=acc[o]||(acc[o]=[0,0,0]);a[0]+=x;a[1]+=y;a[2]++}
 return Object.entries(acc).map(([o,a])=>[o,a[0]/a[2],a[1]/a[2]])}
function draw(){
 if(!bg)bg=background();if(!centers)centers=oddCenters();
 g.drawImage(bg,0,0);
 for(const t of trees){
  const x=t.x/K,y=t.y/K;
  if(t.st===STUMP){g.fillStyle='#8a5a3a';g.fillRect(x-.5,y-.5,1.5,1.5);continue}
  if(t.st!==STAND)continue;
  g.fillStyle=mode==='sp'?SPC[t.sp]:mode==='q'?(t.qk&&t.age>=SAPLING_AGE?QUAL[t.q].col:'#9aa08a'):ageCol(t.age);const r=t.age<SAPLING_AGE?1:Math.max(2,Math.min(6,crownR(t)*1.6/K));g.fillRect(x-r/2,y-r/2,r,r);
 }
 g.lineWidth=1;
 g.strokeStyle='#c4ccc8';g.strokeRect(UPRAWA.x/K,UPRAWA.y/K,UPRAWA.w/K,UPRAWA.h/K);
 for(const p of R.plots){g.strokeStyle=p.fence==='done'?'#e8f0f0':'#f1e6c2';g.setLineDash(p.fence==='done'?[]:[3,2]);g.strokeRect(p.x/K+.5,p.y/K+.5,p.w/K,p.h/K);g.setLineDash([])}
 for(const s of J.stacks){if(s.vol<.05)continue;g.fillStyle='#8a4a1e';g.fillRect(s.x/K-2,s.y/K-2,4,4)}
 for(const C of J.crews)if(C.van&&!C.van.dead){g.fillStyle='#f0a030';g.fillRect(C.van.pos[0]/K-2,C.van.pos[1]/K-2,4,4)}
 if(J.skid.trac&&!J.skid.trac.dead){const v=J.skid.trac;g.fillStyle='#e0d030';g.fillRect(v.pos[0]/K-2,v.pos[1]/K-2,4,4)}
 for(const u of U){const v=u.car;g.fillStyle='#3a80e0';g.fillRect(v.pos[0]/K-2,v.pos[1]/K-2,4,4)}
 for(const t of trees)if(t.marked&&t.st===STAND){g.strokeStyle='#e04030';g.strokeRect(t.x/K-1.5,t.y/K-1.5,3,3)}
 g.font='bold 13px ui-monospace,monospace';g.textAlign='center';g.textBaseline='middle';
 for(const [o,x,y] of centers){g.fillStyle='#ffffffb0';g.fillText(o,x/K+1,y/K+1);g.fillStyle='#1d2b22';g.fillText(o,x/K,y/K)}
 g.strokeStyle='#ffffff';g.lineWidth=2;g.strokeRect(camera.x/K,camera.y/K,VIEW.w/K,VIEW.h/K);g.strokeStyle='#1d2b22';g.lineWidth=1;g.strokeRect(camera.x/K-1,camera.y/K-1,VIEW.w/K+2,VIEW.h/K+2);
 legend();
}
function legend(){
 const L=$('#maplegend');if(!L)return;
 L.innerHTML=(mode==='sp'?Object.entries(SPC).map(([k,c])=>`<span><i style="background:${c}"></i>${SPN[k]}</span>`).join(''):mode==='q'?[...QUAL.map(q=>[q.col,q.name]),['#9aa08a','nieoceniona']].map(([c,n])=>`<span><i style="background:${c}"></i>${n}</span>`).join(''):AGES.map(([,c,n])=>`<span><i style="background:${c}"></i>${n}</span>`).join(''))+
  '<span><i style="background:#8a5a3a"></i>pniaki</span><span><i style="background:#8a4a1e"></i>stos</span><span><i style="background:#3a80e0"></i>patrol</span><span><i style="background:#f0a030"></i>ekipa</span>';
 for(const b of document.querySelectorAll('[data-mapmode]'))b.classList.toggle('on',b.dataset.mapmode===mode);
}
export const mapOpen=()=>open;
export function toggleMap(v){
 open=v??!open;$('#mapov').classList.toggle('hidden',!open);
 if(open){if(!cv){cv=$('#mapcv');cv.width=WORLD.w/K;cv.height=WORLD.h/K;g=cv.getContext('2d');bindMap()}draw()}
}
export function updateMap(dt){if(!open)return;T+=dt;if(T>.5){T=0;draw()}}
function bindMap(){
 cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*WORLD.w,y=(e.clientY-r.top)/r.height*WORLD.h;centerOn(x,y);toggleMap(false)});
 for(const b of document.querySelectorAll('[data-mapmode]'))b.addEventListener('click',()=>{mode=b.dataset.mapmode;draw()});
 $('#mapclose').addEventListener('click',()=>toggleMap(false));
}
