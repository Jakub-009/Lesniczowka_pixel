// Mapa leśnictwa (Tab), 1.1: okno na wspólnej ramce. Płaskie kolory komórek 100×100 zamiast kropek drzew, cztery warstwy
// (Gatunki, Wiek, Odnowienie, Prace), odczyt wartości pod kursorem i tabela oddziałów. Klik w mapę: kamera + karta oddziału.
import {WORLD,camera,VIEW,state,$} from './core.js';
import {trees,STAND,SAPLING_AGE,volume,SP} from './forest.js';
import {EDGES,STANDS,oddzial,GX,GY,YARD,POLANY,polR,PLAC,WETLANDS,STREAM} from './map.js';
import {E} from './ents.js';
import {R,outline} from './renew.js';
import {J} from './jobs.js';
import {U} from './incidents.js';
import {ECO} from './economy.js';
import {oddStats,oddBounds,SPCOL} from './oddcard.js';
import {centerOn,toggleOdd} from './ui.js';
import {registerWin,closeWin} from './win.js';

const K=4,CS=100,NX=Math.ceil(WORLD.w/CS),NY=Math.ceil(WORLD.h/CS),IDS=['101','102','103','104','105','106','107','108'];
const LAYERS=[['sp','Gatunki'],['age','Wiek'],['ren','Odnowienie'],['work','Prace']];
const AGES=[[SAPLING_AGE,'#f0e070','uprawa (do 8 lat)'],[25,'#9ad06a','młodnik (8–25)'],[60,'#4a9a50','drągowina i średni (25–60)'],[90,'#2f6e40','dojrzały (60–90)'],[999,'#173a26','starodrzew (90+)']];
const SPN=k=>SP[k].name.split(' ')[0];
const rgb=(h,a)=>{const n=parseInt(h.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`};
let layer='sp',cv=null,g=null,base=null,terr=null,cells=null,stats=null,lastC=0,hover=null,dirty=true;
const ageCol=a=>AGES.find(q=>a<q[0])[1];
const cellOf=(x,y)=>cells[Math.max(0,Math.min(NY-1,Math.floor(y/CS)))*NX+Math.max(0,Math.min(NX-1,Math.floor(x/CS)))];

// tło (raz): płaski kolor, polany, woda; drogi osobno, żeby leżały nad kolorami komórek
function buildBase(){
 const mk=()=>{const c=document.createElement('canvas');c.width=WORLD.w/K;c.height=WORLD.h/K;return c};
 base=mk();let x=base.getContext('2d');
 x.fillStyle='#d9d5bb';x.fillRect(0,0,base.width,base.height);
 x.fillStyle='#e3ebc0';for(const P of POLANY){x.beginPath();for(let a=0;a<=6.29;a+=.2){const r=polR(a,P),px=(P.x+Math.cos(a)*r)/K,py=(P.y+Math.sin(a)*r)/K;a?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.fill()}
 x.fillStyle='#b89a6a';x.fillRect(YARD.x/K,YARD.y/K,YARD.w/K,YARD.h/K);x.fillStyle='#a8a08a';x.fillRect(PLAC.x/K,PLAC.y/K,PLAC.w/K,PLAC.h/K);
 x.lineJoin='round';x.lineCap='round';
 x.strokeStyle='#7aa4c0';x.lineWidth=2;x.beginPath();STREAM.forEach((p,i)=>i?x.lineTo(p[0]/K,p[1]/K):x.moveTo(p[0]/K,p[1]/K));x.stroke();
 x.fillStyle='#7aa4c0';for(const w of WETLANDS){x.beginPath();x.ellipse(w.x/K,w.y/K,w.rx/K,w.ry/K,0,0,6.28);x.fill()}
 terr=mk();x=terr.getContext('2d');x.lineJoin='round';x.lineCap='round';
 for(const e of EDGES){x.lineWidth=e.kind==='main'?5:e.kind==='dukt'?2:3;x.strokeStyle=e.kind==='main'?'#6a6e72':e.kind==='dukt'?'#8f9a62':'#a8946a';x.beginPath();e.pts.forEach((p,i)=>i?x.lineTo(p[0]/K,p[1]/K):x.moveTo(p[0]/K,p[1]/K));x.stroke()}
}
// statystyki komórek (raz na ok. 0,8 s) i oddziałów
function compute(){
 cells=Array.from({length:NX*NY},()=>({n:0,sp:{},aged:0,ageSum:0,vol:0,young:0,unren:0,marked:0}));
 for(const t of trees){
  if(t.st!==STAND)continue;const c=cellOf(t.x,t.y);
  c.n++;c.sp[t.sp]=(c.sp[t.sp]||0)+1;
  if(t.age<SAPLING_AGE*3)c.young++;
  if(t.age>=SAPLING_AGE){c.aged++;c.ageSum+=t.age;c.vol+=volume(t)}
  if(t.marked)c.marked++;
 }
 for(const t of ECO.unrenList)cellOf(t.x,t.y).unren++;
 stats={};for(const id of IDS)stats[id]=oddStats(id);
 lastC=performance.now();dirty=true;
}
const dom=c=>Object.entries(c.sp).sort((a,b)=>b[1]-a[1])[0];
function fillCell(c,x,y){
 let col=null;
 if(layer==='sp'){if(c.n){const d=dom(c);col=rgb(SPCOL[d[0]],Math.min(1,.4+c.n/10))}}
 else if(layer==='age'){if(c.n)col=rgb(c.aged?ageCol(c.ageSum/c.aged):AGES[0][1],.9)}
 else if(layer==='ren'){
  if(c.unren)col=rgb('#e0602e',Math.min(1,.5+c.unren*.2));else if(c.young)col=rgb('#5fb04a',Math.min(.9,.35+c.young/10));else if(c.n)col='rgba(168,184,128,.7)'}
 else if(c.marked)col=rgb('#d63a2c',Math.min(1,.4+c.marked*.12));else if(c.n)col='rgba(176,190,140,.55)';
 if(col){g.fillStyle=col;g.fillRect(x,y,CS/K+.6,CS/K+.6)}
}
function draw(){
 if(!cv||!cells)return;dirty=false;
 g.drawImage(base,0,0);
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++)fillCell(cells[j*NX+i],i*CS/K,j*CS/K);
 g.drawImage(terr,0,0);
 // granice oddziałów i numery
 g.strokeStyle='#1d2b22';g.globalAlpha=.75;g.lineWidth=1.5;g.beginPath();
 for(const x of GX){g.moveTo(x/K,0);g.lineTo(x/K,WORLD.h/K)}g.moveTo(0,GY/K);g.lineTo(WORLD.w/K,GY/K);g.stroke();g.globalAlpha=1;
 if(layer==='ren'||layer==='work'){g.lineWidth=1;for(const p of R.plots){g.strokeStyle=p.fence==='done'?'#ffffff':'#fff4c8';g.setLineDash(p.fence==='done'?[]:[3,2]);g.beginPath();outline(p).forEach(([x,y],i)=>i?g.lineTo(x/K,y/K):g.moveTo(x/K,y/K));g.closePath();g.stroke();g.setLineDash([])}}
 if(layer==='work'){
  g.fillStyle='#2f9a3a';for(const p of J.plants)g.fillRect(p.x/K-1.5,p.y/K-1.5,3,3);
  g.fillStyle='#8a4a1e';for(const s of J.stacks)if(s.vol>.05)g.fillRect(s.x/K-2.5,s.y/K-2.5,5,5);
  g.fillStyle='#f0a030';for(const C of J.crews)if(C.van&&!C.van.dead)g.fillRect(C.van.pos[0]/K-2.5,C.van.pos[1]/K-2.5,5,5);
  if(J.skid.trac&&!J.skid.trac.dead){const v=J.skid.trac;g.fillStyle='#e0d030';g.fillRect(v.pos[0]/K-2.5,v.pos[1]/K-2.5,5,5)}
  g.fillStyle='#3a80e0';for(const u of U)g.fillRect(u.car.pos[0]/K-2.5,u.car.pos[1]/K-2.5,5,5);
  for(const q of E.incidents){if(q.status==='done'||q.status==='gone')continue;g.fillStyle=q.type==='fire'?'#ff3a1a':'#ffd028';g.fillRect(q.x/K-3,q.y/K-3,6,6);g.strokeStyle='#14201a';g.lineWidth=1;g.strokeRect(q.x/K-3,q.y/K-3,6,6)}
 }
 g.font='bold 15px ui-monospace,monospace';g.textAlign='center';g.textBaseline='middle';
 for(const id of IDS){const B=oddBounds(id),x=(B.x0+B.x1)/2/K,y=(B.y0+B.y1)/2/K;g.lineWidth=4;g.strokeStyle='#ffffffe0';g.strokeText(id,x,y);g.fillStyle='#1d2b22';g.fillText(id,x,y)}
 if(hover){
  const B=oddBounds(hover.id);g.strokeStyle='#f4d58a';g.lineWidth=3;g.strokeRect(B.x0/K+1.5,B.y0/K+1.5,(B.x1-B.x0)/K-3,(B.y1-B.y0)/K-3);
  g.strokeStyle='#ffffff';g.lineWidth=2;g.strokeRect(hover.cx*CS/K,hover.cy*CS/K,CS/K,CS/K);
 }
 g.strokeStyle='#ffffff';g.lineWidth=2;g.strokeRect(camera.x/K,camera.y/K,VIEW.w/K,VIEW.h/K);g.strokeStyle='#1d2b22';g.lineWidth=1;g.strokeRect(camera.x/K-1,camera.y/K-1,VIEW.w/K+2,VIEW.h/K+2);
}
const chip=(c,n)=>`<span><i style="background:${c}"></i>${n}</span>`;
function legend(){
 return layer==='sp'?Object.entries(SPCOL).map(([k,c])=>chip(c,SPN(k))).join('')+'<span class="muted">intensywność = zagęszczenie</span>'
 :layer==='age'?AGES.map(a=>chip(a[1],a[2])).join('')
 :layer==='ren'?chip('#e0602e','nieodnowione pniaki')+chip('#5fb04a','młode drzewka')+chip('rgba(168,184,128,.9)','drzewostan')+chip('#fff4c8','powierzchnia odnowieniowa')
 :chip('#d63a2c','oznaczone do cięcia')+chip('#2f9a3a','zaplanowane sadzonki')+chip('#ffd028','zgłoszenie')+chip('#f0a030','ekipa')+chip('#e0d030','ciągnik')+chip('#3a80e0','patrol')+chip('#8a4a1e','stos drewna');
}
const n0=v=>Math.round(v).toLocaleString('pl-PL');
const ageTxt=a=>a?Math.round(a)+' l.':'—';
function table(){
 let T={n:0,v:0,m:0,o:0,u:0,i:0};
 const rows=IDS.map(id=>{const S=stats[id];T.n+=S.stand;T.v+=S.vol;T.m+=S.mature;T.o+=S.marked;T.u+=S.unren;T.i+=S.incidents;
  return `<tr data-id="${id}" class="${hover&&hover.id===id?'hl':''}"><td><b>${id}</b></td><td>${S.stand}</td><td>${ageTxt(S.age)}</td><td>${n0(S.vol)}</td><td>${S.mature}</td><td>${S.marked||'·'}</td><td class="${S.unren?'warnv':''}">${S.unren||'·'}</td><td class="${S.incidents?'warnv':''}">${S.incidents||'·'}</td></tr>`}).join('');
 return `<thead><tr><th>Odz.</th><th title="drzewa razem">Drzewa</th><th title="średni wiek">Wiek</th><th title="miąższość w m³">m³</th><th title="drzewa dojrzałe, do wycinki">Dojrz.</th><th title="oznaczone do cięcia">Ozn.</th><th title="pniaki bez odnowienia">Nieodn.</th><th title="otwarte zgłoszenia">Zgł.</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Razem</td><td>${T.n}</td><td></td><td>${n0(T.v)}</td><td>${T.m}</td><td>${T.o||'·'}</td><td>${T.u||'·'}</td><td>${T.i||'·'}</td></tr></tfoot>`;
}
function readout(){
 if(!hover)return '<span class="muted">Najedź kursorem na mapę, aby zobaczyć wartości. Klik: kamera i karta oddziału.</span>';
 const S=stats[hover.id],c=cells[hover.cy*NX+hover.cx],tot=Math.max(1,c.n);
 const sp=Object.entries(c.sp).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>SPN(k)+' '+Math.round(n/tot*100)+'%').join(', ')||'brak drzew';
 const r=(a,b)=>`<div class="srow"><span>${a}</span><i>${b}</i></div>`;
 return `<b>Oddział ${hover.id}</b> <span class="muted">${STANDS[hover.id].desc}</span>
 ${r('drzewa · wiek · zapas',S.stand+' · '+ageTxt(S.age)+' · '+n0(S.vol)+' m³')}${r('dojrzałe · oznaczone',S.mature+' · '+(S.marked||'—'))}${r('pniaki nieodnowione · zgłoszenia',(S.unren||'—')+' · '+(S.incidents||'—'))}
 <div class="mh2">Ta komórka</div>
 ${r('drzewa · gatunki',c.n+' · '+sp)}${r('wiek · zapas',ageTxt(c.aged?c.ageSum/c.aged:0)+' · '+n0(c.vol)+' m³')}${r('młode · pniaki nieodn. · oznaczone',c.young+' · '+(c.unren||'—')+' · '+(c.marked||'—'))}`;
}
function hov(el){$('#maphover').innerHTML=readout();for(const r of el.querySelectorAll('#maptab tr[data-id]'))r.classList.toggle('hl',!!hover&&r.dataset.id===hover.id);draw()}
function side(el){
 for(const b of el.querySelectorAll('[data-ml]'))b.classList.toggle('on',b.dataset.ml===layer);
 $('#maplegend').innerHTML=legend();$('#maphover').innerHTML=readout();$('#maptab').innerHTML=table();
}
const SHELL=`<div class="whead"><div><div class="kicker">Leśnictwo Zielony Gaj · 8 oddziałów</div><h1>Mapa leśnictwa</h1></div><button class="xbtn" data-x="win" title="Zamknij (Esc)" aria-label="Zamknij">✕</button></div>
 <div class="mapgrid"><div class="mapl"><canvas id="mapcv"></canvas><div class="maphint">Biała ramka: widok kamery. Klik w mapę przenosi kamerę i otwiera kartę oddziału.</div></div>
 <div class="mapr"><div class="layers">${LAYERS.map(([k,n])=>`<button data-ml="${k}">${n}</button>`).join('')}</div><div id="maplegend"></div><div id="maphover" class="mhover"></div>
 <table id="maptab" class="otab"></table><p class="hint2">Dojrz. — do wycinki, Ozn. — oznaczone do cięcia, Nieodn. — pniaki bez odnowienia, Zgł. — otwarte zgłoszenia. Klik w wiersz: pokaż cały oddział.</p></div></div>
 <div class="wfoot"><button class="wclose" data-x="win">ZAMKNIJ (Tab / Esc)</button></div>`;
function pos(e){const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*WORLD.w,(e.clientY-r.top)/r.height*WORLD.h]}
registerWin('map',{cls:'xl',
 open(){if(!base)buildBase();compute();hover=null},
 close(){hover=null},
 render:()=>SHELL,
 after(el){
  cv=$('#mapcv');cv.width=WORLD.w/K;cv.height=WORLD.h/K;g=cv.getContext('2d');dirty=true;
  cv.addEventListener('mousemove',e=>{const [x,y]=pos(e);if(x<0||y<0||x>=WORLD.w||y>=WORLD.h)return;hover={id:String(oddzial(x,y)),cx:Math.floor(x/CS),cy:Math.floor(y/CS)};hov(el)});
  cv.addEventListener('mouseleave',()=>{hover=null;hov(el)});
  cv.addEventListener('click',e=>{const [x,y]=pos(e),id=String(oddzial(x,y));closeWin();centerOn(x,y);state.follow=null;toggleOdd(true,id)});
  for(const b of el.querySelectorAll('[data-ml]'))b.addEventListener('click',()=>{layer=b.dataset.ml;dirty=true;side(el)});
  $('#maptab').addEventListener('click',e=>{const tr=e.target.closest('tr[data-id]');if(!tr)return;closeWin();toggleOdd(true,tr.dataset.id);dispatchEvent(new CustomEvent('las-fit',{detail:oddBounds(tr.dataset.id)}))});
  side(el);draw();
 },
 tick(el){if(!cv||!document.body.contains(cv))return;if(performance.now()-lastC>800){compute();side(el)}if(dirty)draw()}
});
