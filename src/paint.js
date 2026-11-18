// Malowanie stałego podłoża z danych mapy (raz, przy starcie): ściółka oddziałów, pobocza, drogi, leśniczówka, składnica, polana, uprawa.
import {WORLD,hash,rect,line,poly,shadow,LIGHT,clamp} from './core.js';
import {mk,outlinedDraw,text3} from './sprite.js';
import {NODES,EDGES,roadClearance,oddzial,YARD,HOUSE,CARPORT,WOODSHED,KENNEL,WELL,PLAC,PLAC_SPOTS,TURNS,POLANA,POLANY,AMBONA,FENCES,POSTS,BARRIERS,BOARD,inRect,inPolana,LDY,ptAt,hy,WETLANDS,STREAM,streamDist,inWater,PRZESIEKI,FIRE_SIGNS,polR} from './map.js';
export const [ground,g]=mk(WORLD.w,WORLD.h);
const DARK='#2a3328';
const vn=(u,v,z=5)=>{const x=Math.floor(u),y=Math.floor(v),fx=u-x,fy=v-y,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const a=hash(x,y,z),b=hash(x+1,y,z),c=hash(x,y+1,z),d=hash(x+1,y+1,z);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy};
const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mixc=(a,b,t)=>{const A=rgb(a),B=rgb(b);return`rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`};
// 1.3.3: susza na mokradle — lustro wody cofa się do środka w obrębie namalowanego kształtu wody (ta sama maska z szumem co przy malowaniu),
// zamiast brązowej elipsy zasłaniającej brzegi i dopływy. Poziomy 1–4 liczone raz i trzymane w pamięci.
const DRY={};
export function dryMask(wi,lvl){
 const k=wi+'_'+lvl;if(DRY[k])return DRY[k];
 const W=WETLANDS[wi],nz=(x,y)=>1+.26*(vn(x/26,y/26,21)-.5)*2+.08*(vn(x/9,y/9,25)-.5),d=(x,y)=>Math.hypot((x-W.x)/W.rx,(y-W.y)/W.ry)/nz(x,y);
 const x0=Math.floor(W.x-W.rx*.75),y0=Math.floor(W.y-W.ry*.75),[cv,g]=mk(Math.ceil(W.rx*1.5),Math.ceil(W.ry*1.5)),edge=.6*(1-.13*lvl);
 for(let y=y0;y<y0+W.ry*1.5;y+=3)for(let x=x0;x<x0+W.rx*1.5;x+=3){const q=d(x,y);if(q>.6||q<=edge)continue;
  const t=(q-edge)/(.6-edge);g.fillStyle=t>.55?mixc('#6e6a48','#7d7652',vn(x/8,y/8,31)):mixc('#5d6a52','#6a7458',vn(x/9,y/9,32));g.fillRect(x-x0,y-y0,3,3);
  if(t>.4&&hash(x,y,33)<.06){g.fillStyle='#4e4a34';g.fillRect(x-x0,y-y0,3,1)}}   // spękany muł
 return DRY[k]={x:x0,y:y0,cv};
}
// Ściółka: sosna — mech i borówki, świerk — ciemne igliwie, dąb/buk — opadłe liście.
const FLOOR={'101':['#647a45','#7a8a50','#4d6c40'],'102':['#4b6040','#5d6b45','#3c523a'],'103':['#7d6c48','#8e7c52','#68744a'],'104':['#6b7f48','#7d8c52','#59703f'],'105':['#617846','#768650','#4f6a40'],
 '106':['#485c3e','#58673f','#3a4f38'],'107':['#68804a','#7a8c52','#566e40'],'108':['#6a7c46','#7e8c52','#55703f'],'109':['#7a6a46','#8c7a50','#66724a'],'110':['#72864c','#86955a','#5f7642']};
const SPECK={'101':['#3f6a3d','#8a7a52','#506f3b','#9a8a5a'],'102':['#6b5a40','#354a35','#7a6a4c'],'103':['#9a7a48','#6e5a3a','#a88a55','#5f7243'],'104':['#8a7a50','#4a6a3c','#9a8a5a'],'105':['#836c48','#47683e','#9a8458'],
 '106':['#6b5a40','#354a35','#7a6a4c'],'107':['#8a7a50','#4a6a3c','#9a8a5a'],'108':['#3f6a3d','#8a7a52','#506f3b','#9a8a5a'],'109':['#9a7a48','#6e5a3a','#a88a55','#5f7243'],'110':['#8a7a50','#5a7a44','#a09060']};
{const F0={...FLOOR},S0={...SPECK};for(const [n,o] of Object.entries({'101':'101','102':'102','103':'103','104':'106','105':'105','106':'104','107':'106','108':'107','109':'108','110':'108','111':'110','112':'109'})){FLOOR[n]=F0[o];SPECK[n]=S0[o]}}
const AREA=WORLD.w*WORLD.h/(2400*1800),PINE=new Set(['101','106','108','109','110','111']),LEAF=new Set(['103','105','112']);
function paintFloor(){
 const B=4;
 for(let y=0;y<WORLD.h;y+=B)for(let x=0;x<WORLD.w;x+=B){
  const o=oddzial(x+(vn(x/70,y/70,11)-.5)*150,y+(vn(x/70,y/70,12)-.5)*150),f=FLOOR[o],n=vn(x/90,y/90)*.6+vn(x/26,y/26,7)*.4;
  const rc=roadClearance(x+2,y+2);
  let col=n<.5?mixc(f[2],f[0],n*2):mixc(f[0],f[1],(n-.5)*2);
  // pobocze: trawa przechodząca w ściółkę
  const verge=rc<34?clamp((34-rc)/16,0,1):0;
  g.fillStyle=verge>0?mixc(n<.5?f[2]:f[0],n>.6?'#9aae70':'#89a063',verge):col;g.fillRect(x,y,B,B);
 }
 for(let i=0;i<52000*AREA;i++){const x=hash(i,1,31)*WORLD.w|0,y=hash(i,2,31)*WORLD.h|0;if(roadClearance(x,y)<30)continue;const s=SPECK[oddzial(x,y)];rect(g,x,y,1+(i%3===0),1,s[i%s.length])}
 // borówczyska i kępy paproci w starszych drzewostanach
 for(let i=0;i<900*AREA;i++){const x=hash(i,3,31)*WORLD.w,y=hash(i,4,31)*WORLD.h;if(roadClearance(x,y)<40)continue;const o=oddzial(x,y);
  if(PINE.has(o)){for(let k=0;k<14;k++)rect(g,x+(hash(k,i,5)-.5)*22,y+(hash(k,i,6)-.5)*12,2,2,k%3?'#3f6638':'#577c42')}
  else if(LEAF.has(o)){if(i%3)continue;for(let k=0;k<7;k++){const a=k*.9+hash(i,k)*.4;for(let u=0;u<9;u++)rect(g,x+Math.cos(a)*u,y+Math.sin(a)*u,2,1,u%3?'#5f8a45':'#79a356')}}}
}
// Drogi jako krzywe (0.6.4): pobocze, tłuczeń/asfalt, koleiny z trawą pośrodku, rozszerzenia przy skrzyżowaniach (zaokrąglone narożniki).
const trace=(e,a,b,off=0)=>{g.beginPath();for(let u=a;u<=b+5;u+=5){const p=ptAt(e,Math.min(u,b));if(u===a)g.moveTo(p[0]-p[3]*off,p[1]+p[2]*off);else g.lineTo(p[0]-p[3]*off,p[1]+p[2]*off)}};
const strokeE=(e,w,col,off=0,a=0,b=e.len)=>{g.lineWidth=w;g.strokeStyle=col;g.lineCap='butt';g.lineJoin='round';trace(e,a,b,off);g.stroke()};
const deg={};for(const e of EDGES){deg[e.a]=(deg[e.a]||0)+1;deg[e.b]=(deg[e.b]||0)+1}
const junc=k=>deg[k]>=3&&k[0]!=='m';
function flare(e,col,extra){g.fillStyle=col;for(const [node,atA] of [[e.a,true],[e.b,false]]){if(!junc(node)||e.kind==='main')continue;
 for(let u=26;u<=70;u+=3){const p=ptAt(e,atA?u:e.len-u),r=e.w/2+extra*(1-(u-26)/44)**2;g.beginPath();g.arc(p[0],p[1],r,0,6.283);g.fill()}}}
function paintRoads(){
 const E=EDGES,nm=E.filter(q=>q.kind!=='main'),mn=E.filter(q=>q.kind==='main');
 for(const e of E){if(e.kind==='dukt'){strokeE(e,e.w+9,'#6f8450');flare(e,'#6f8450',15);continue}strokeE(e,e.w+(e.kind==='main'?8:6),e.kind==='main'?'#9a9888':'#9d8f70');flare(e,'#9d8f70',22)}
 for(const e of nm){if(e.kind==='dukt'){strokeE(e,e.w+2,'#8a9660');flare(e,'#8a9660',11);continue}strokeE(e,e.w,'#b8a682');flare(e,'#b8a682',18)}
 for(const e of mn)strokeE(e,e.w,'#75797c');
 for(const e of nm){
  for(let i=0;i<e.len*e.w/7;i++){const s0=hash(i,e.len|0,41)*e.len,lat=(hash(i,e.len|0,42)-.5)*(e.w-2),p=ptAt(e,s0);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,1+(i%4===0),1,['#a99674','#c7b791','#9a8866','#d2c4a0'][i%4])}
  if(e.kind==='drive'){strokeE(e,e.w-6,'#a89a78',0,0,e.len);continue}
  if(e.kind==='dukt'){   // wąski dukt: dwie koleiny z gęstą trawą pośrodku, pobocze zarośnięte
   strokeE(e,e.w-6,'#a1a56e');
   strokeE(e,3,'#7d6e4b',-5.5,10,e.len-10);strokeE(e,3,'#7d6e4b',5.5,10,e.len-10);strokeE(e,5,'#5f8a47',0,4,e.len-4);
   for(let i=0;i<e.len*.5;i++){const s0=hash(i,e.len|0,47)*e.len,lat=(hash(i,e.len|0,48)-.5)*(e.w+8),p=ptAt(e,s0),k=hash(i,s0|0,49);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,1,2+(k*3|0),k<.4?'#86ae5c':k<.75?'#5a8244':'#a9bd7a')}
   for(let u=10;u<e.len-10;u+=22){const k=hash(u,e.len|0,46);if(k<.45)continue;const p=ptAt(e,u),side=k<.72?-1:1,off=(e.w/2+3+k*5)*side;rect(g,p[0]-p[3]*off|0,p[1]+p[2]*off|0,3,2,'#6d5a3c');rect(g,p[0]-p[3]*off|0,p[1]+p[2]*off-1|0,2,1,'#8a7656')}   // przydrożne kamyki i patyki
   continue}
  strokeE(e,4,'#8e7a58',-9,14,e.len-14);strokeE(e,4,'#8e7a58',9,14,e.len-14);
  for(let u=24;u<e.len-24;u+=3){if((junc(e.a)&&u<36)||(junc(e.b)&&u>e.len-36))continue;const j=hash(u,e.len|0,43);if(j<.25)continue;const p=ptAt(e,u);rect(g,p[0]-1|0,p[1]-1|0,2+(j*2|0),2,j>.7?'#7f9a58':'#6d8a4b')}
 }
 for(const e of mn){
  for(let i=0;i<e.len*e.w/8;i++){const s0=hash(i,301,e.len|0)*e.len,lat=(hash(i,302,e.len|0)-.5)*(e.w-2),p=ptAt(e,s0);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,1+(i%5===0),1,['#6c7175','#81868a','#70757a'][i%3])}
  for(let i=0;i<e.len*e.w/3600;i++){const s0=hash(i,310,e.len|0)*e.len,lat=(hash(i,311,e.len|0)-.5)*(e.w-12),p=ptAt(e,s0);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,12+(i%4)*6,5+(i%3)*2,i%3?'#727779':'#7d8285')}
  g.lineWidth=2;g.strokeStyle='#e6e4d8';g.lineCap='butt';
  for(let u=10;u<e.len-32;u+=40){const p=ptAt(e,u+11);if(['j1','j2'].some(k=>Math.hypot(p[0]-NODES[k][0],p[1]-NODES[k][1])<46))continue;const A=ptAt(e,u),B=ptAt(e,u+22);g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.stroke()}
 }
 // rów przy szosie (po południowej stronie) z wodą; przerwany tam, gdzie z szosy odchodzą drogi na południe (przepusty)
 const gaps=[];   // 0.9: rów ciągły (dawne wjazdy na południe usunięte); przerwa tylko przy strumieniu
 for(const e of mn)for(let u=0;u<e.len-8;u+=8){const A=ptAt(e,u),B=ptAt(e,u+9),nx=-A[3]*48,ny=A[2]*48,nx2=-B[3]*48,ny2=B[2]*48;if(streamDist(A[0]+nx,A[1]+ny)<15||streamDist(B[0]+nx2,B[1]+ny2)<15)continue;
  g.lineCap='butt';g.lineWidth=9;g.strokeStyle='#6a8656';g.beginPath();g.moveTo(A[0]+nx,A[1]+ny);g.lineTo(B[0]+nx2,B[1]+ny2);g.stroke();
  g.lineWidth=4;g.strokeStyle='#56724a';g.stroke();if((u/8|0)%4===0)rect(g,A[0]+nx,A[1]+ny-1,8,2,'#7fa3a0')}
 // strumień pod drogami: przepusty z kamiennymi czołami po obu stronach jezdni
 for(const e of E){let inx=false,sum=0,n=0;for(let u=0;u<=e.len;u+=3){const p=ptAt(e,u),c=streamDist(p[0],p[1])<9;
   if(c){inx=true;sum+=u;n++}
   if(inx&&(!c||u+3>e.len)){inx=false;const m=sum/n,p2=ptAt(e,m);sum=0;n=0;
    for(const sd of [-1,1]){const off=(e.w/2+4)*sd,cx=p2[0]-p2[3]*off,cy=p2[1]+p2[2]*off;rect(g,cx-4,cy-4,8,8,'#4a4a44');rect(g,cx-3,cy-3,6,6,'#8e8e84');rect(g,cx-1,cy-1,2,2,'#2c3a3d')}}}}
}
// Pobocza: kępy traw, kwiaty, krzewy (leszczyna, kruszyna, jeżyny).
function paintVerges(){
 for(let i=0;i<9000*AREA;i++){const x=hash(i,7,51)*WORLD.w,y=hash(i,8,51)*WORLD.h,rc=roadClearance(x,y);if(rc<3||rc>30||inWater(x,y,4))continue;
  const k=hash(i,9,51);rect(g,x,y,1,2+(k*2|0),k<.5?'#a4b878':'#6f8d52');if(k>.93)rect(g,x,y-1,2,2,['#e8e2c0','#d7c24a','#b98ad0','#e6a0a0'][i%4])}
 for(let i=0;i<700*AREA;i++){const x=hash(i,10,52)*WORLD.w,y=hash(i,11,52)*WORLD.h,rc=roadClearance(x,y);
  if(rc<8||rc>30||inRect(x,y,YARD,30)||inRect(x,y,PLAC,20)||inWater(x,y,8))continue;
  const r=6+hash(i,12,52)*5,s=i*13,pal=hash(i,13)<.25?['#4a6a3a','#5d7a46','#7a5a5a','#8e4a4a']:['#4a6e4a','#5a8052','#76955c','#8ea870'];
  g.fillStyle='#2a3b2a40';g.beginPath();g.ellipse(x+LIGHT.x*5,y+LIGHT.y*4,r*1.1,r*.7,.5,0,6.28);g.fill();
  outlinedDraw(g,x,y,G=>{for(let k=0;k<3;k++){const a=k*2.1+hash(k,s),d=r*.35;blobPatch(G,Math.cos(a)*d,Math.sin(a)*d,r*.6,pal[0],pal,s+k)}},'#26392a');
 }
}
function blobPatch(G,cx,cy,rad,base,lit,seed){
 for(let yy=-Math.round(rad);yy<=rad;yy+=2){const w=Math.round(rad*Math.sqrt(Math.max(0,1-(yy/rad)**2)));if(w>0)rect(G,cx-w,cy+yy,w*2,2,base)}
 for(let k=0;k<rad*2;k++){const dx=(hash(k,seed,3)*2-1)*rad,dy=(hash(k,seed,4)*2-1)*rad;if(dx*dx+dy*dy<rad*rad*.8)rect(G,cx+dx,cy+dy,2,1,lit[k%lit.length])}
}
// Dach dwuspadowy (wzorzec roof() z farmy).
function roof(x,y,w,h,col,col2,ridge){
 shadow(g,x,y,w,h,34);
 rect(g,x+2,y+5,w,h+4,'#5d4c3c');
 if(w>=h){poly(g,[[x,y],[x+w,y],[x+w-6,y+h/2],[x+6,y+h/2]],col);poly(g,[[x+6,y+h/2],[x+w-6,y+h/2],[x+w,y+h],[x,y+h]],col2);line(g,x+8,y+h/2,x+w-8,y+h/2,ridge,2);
  for(let i=10;i<w-6;i+=12)line(g,x+i,y+3,x+i,y+h-3,'#00000022',1)}
 else{poly(g,[[x,y],[x+w/2,y+6],[x+w/2,y+h-6],[x,y+h]],col);poly(g,[[x+w/2,y+6],[x+w,y],[x+w,y+h],[x+w/2,y+h-6]],col2);line(g,x+w/2,y+6,x+w/2,y+h-6,ridge,2)}
 for(const [ax,ay,bx,by] of [[x,y,x+w,y],[x,y+h,x+w,y+h],[x,y,x,y+h],[x+w,y,x+w,y+h]])line(g,ax,ay,bx,by,'#3b2b22',1);
}
function paintYard(){
 const Y=YARD;
 rect(g,Y.x,Y.y,Y.w,Y.h,'#8aa064');
 for(let i=0;i<4200;i++){const x=Y.x+hash(i,61)*(Y.w-2)|0,y=Y.y+hash(i,62)*(Y.h-2)|0;rect(g,x,y,1+(i%2),1,['#9db078','#7a9257','#a9b982'][i%3])}
 // utwardzony plac i dojście do domu
 rect(g,360,262+LDY,360,76,'#b7a684');for(let i=0;i<1300;i++)rect(g,360+hash(i,63)*358|0,262+LDY+hash(i,64)*74|0,2,1,i%2?'#a6956f':'#cbbd98');
 g.save();g.translate(0,LDY);g.lineCap='round';g.strokeStyle='#cbbd98';g.lineWidth=10;g.beginPath();g.moveTo(300,292);g.lineTo(300,312);g.lineTo(372,312);g.stroke();
 g.beginPath();g.moveTo(300,312);g.lineTo(220,312);g.lineTo(212,346);g.stroke();g.lineCap='butt';g.restore();
 // (zabudowa leśniczówki leży na osobnej warstwie: lodge.js)
}
const DOORX=300;
export function fence(f,g){
 const yard=f.style==='yard',hor=f.y1===f.y2,L=Math.hypot(f.x2-f.x1,f.y2-f.y1);
 const cols=yard?['#6f5236','#98764d']:['#9aa3a0','#c4ccc8'];
 for(const [d,c] of yard?[[0,cols[0]],[3,cols[1]]]:[[0,cols[1]],[2,cols[0]]]){if(hor)line(g,Math.min(f.x1,f.x2),f.y1+d,Math.max(f.x1,f.x2),f.y1+d,c,1);else line(g,f.x1+d,Math.min(f.y1,f.y2),f.x1+d,Math.max(f.y1,f.y2),c,1)}
 const step=yard?22:30;
 const post=(x,y)=>{rect(g,x+2,y+3,4,5,'#2d3b2b55');rect(g,x-2,y-2,4,5,yard?'#5f4329':'#6b563d');rect(g,x-1,y-2,2,1,yard?'#c9a574':'#a08560')};
 for(let t=0;t<=L;t+=step){if(hor)post(Math.min(f.x1,f.x2)+t,f.y1);else post(f.x1,Math.min(f.y1,f.y2)+t)}
}
// Plac manewrowy przy leśniczówce (0.6): tłuczeń, ślady kół; tu nocują maszyny zrywkowe.
function paintPlac(){   // 0.7.4: plac to część podwórza — ten sam żwir co dziedziniec, tylko ubity pod stanowiskami
 const S=PLAC;
 rect(g,S.x,S.y-6,S.w,S.h+6,'#b7a684');
 for(let i=0;i<1100;i++)rect(g,S.x+hash(i,71)*(S.w-2)|0,S.y-6+hash(i,72)*(S.h)|0,2,1,i%2?'#a6956f':'#cbbd98');
 for(const sp of PLAC_SPOTS){
  rect(g,sp.x-38,sp.y-26,76,52,'#ac9b79');
  for(let i=0;i<260;i++)rect(g,sp.x-38+hash(i,sp.x)*74|0,sp.y-26+hash(i,sp.x+1)*50|0,2,1,i%2?'#9d8c6a':'#bfae8b');
  for(const dy of [-12,12])for(let x=sp.x-60;x<sp.x+60;x+=3)if(hash(x,dy+sp.x)>.18)rect(g,x,sp.y+dy,2,3,'#8f7f5f');
 }
 // rozjeżdżone krawędzie przy trawie
 for(let i=0;i<120;i++){const x=S.x+hash(i,73)*S.w,y=S.y+S.h-2+(hash(i,74)-.5)*8;rect(g,x,y,2,1,i%2?'#a6956f':'#8aa064')}
}
// Mały plac nawrotowy na końcu ślepej drogi (przy paśniku P2): niewielkie poszerzenie z tłucznia.
function paintTurns(){
 for(const k of TURNS){const [cx,cy]=NODES[k];
  for(const [R,c] of [[38,'#9d8f70'],[33,'#b8a682']]){g.fillStyle=c;g.beginPath();g.ellipse(cx,cy,R,R*.8,.5,0,6.283);g.fill()}
  for(let i=0;i<260;i++){const a=hash(i,1,61)*6.283,d=Math.sqrt(hash(i,1,62))*30;rect(g,cx+Math.cos(a)*d,cy+Math.sin(a)*d*.8,1+(i%4===0),1,['#a99674','#c7b791','#9a8866','#d2c4a0'][i%4])}
 }
}
// Mokradła i strumień: pas błota i trzcin, woda w środku; strumień łączy mokradła (pod drogami przepusty).
function paintWater(){
 g.lineJoin='round';g.lineCap='round';
 const n=STREAM.length,wd=i=>5+9*Math.pow(i/(n-1),.75)+1.2*Math.sin(i*.37);   // strumień: wąski przy źródle, szerszy w dole
 // 1.0: jedna maska wody — kształt mokradła (z szumem) liczony tak samo przy rysowaniu mokradeł i strumienia
 const nzAt=(x,y)=>1+.26*(vn(x/26,y/26,21)-.5)*2+.08*(vn(x/9,y/9,25)-.5);
 const wdN=(x,y,W)=>Math.hypot((x-W.x)/W.rx,(y-W.y)/W.ry)/nzAt(x,y);
 const wdAny=(x,y)=>{let m=9;for(const W of WETLANDS)m=Math.min(m,wdN(x,y,W));return m};
 // strumień zwęża się przy wejściu w pas trzcin (tam rozpada się na strużki), a odpływa wąską smugą i dopiero dalej się poszerza
 const taper=i=>{const d=Math.min(wdAny(STREAM[i][0],STREAM[i][1]),wdAny(STREAM[i+1][0],STREAM[i+1][1]));return d<1.12?.42:d<2.5?.42+.58*(d-1.12)/1.38:1};
 const layer=(extra,k,col)=>{g.strokeStyle=col;for(let i=0;i<n-1;i++){const A=STREAM[i],B=STREAM[i+1];g.lineWidth=(wd(i)*k+extra)*taper(i);g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.stroke()}};
 layer(22,1,'#7a9558');layer(15,1,'#76804e');layer(9,1,'#8c8658');layer(4,1,'#5f5a3e');layer(0,1,'#457b8b');layer(0,.62,'#5a94a2');
 // połyski i drobna fala wzdłuż nurtu
 for(let i=0;i<n-1;i++){if(hash(i,3,70)<.35)continue;const A=STREAM[i],B=STREAM[i+1],t=hash(i,4,70)-.5,w=wd(i)*.35,dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy)||1;
  rect(g,A[0]-dy/L*w*t*2,A[1]+dx/L*w*t*2,4+(i%3)*2,1,'#bfe3e8');if(i%4===0)rect(g,A[0]+dy/L*w*t,A[1]-dx/L*w*t+2,3,1,'#2f6072')}
 // brzegi: trzciny z rdestem, kamienie, kępy turzycy, wierzby
 const free=(x,y)=>roadClearance(x,y)>30&&!inRect(x,y,YARD,24)&&!inRect(x,y,PLAC,20)&&!inPolana(x,y,6);
 for(let i=0;i<n*7;i++){const k=(hash(i,5,71)*(n-1))|0,p=STREAM[k],a=hash(i,6,71)*6.283,d=wd(k)/2+3+hash(i,7,71)*8,x=p[0]+Math.cos(a)*d,y=p[1]+Math.sin(a)*d;if(!free(x,y))continue;
  const h=3+(i%5);rect(g,x,y-h+2,1,h,i%2?'#8c9c50':'#a9b266');if(i%6===0)rect(g,x-1,y-h,3,2,'#6b4a30');if(i%9===0){rect(g,x+2,y-2,1,4,'#7f8a46')}}
 for(let i=0;i<n*.8;i++){const k=(hash(i,8,71)*(n-1))|0,p=STREAM[k],a=hash(i,9,71)*6.283,d=wd(k)/2+2+hash(i,10,71)*5,x=p[0]+Math.cos(a)*d,y=p[1]+Math.sin(a)*d;if(!free(x,y))continue;
  rect(g,x+1,y+1,5,3,'#2f3a30aa');rect(g,x,y,5,3,'#7d7e76');rect(g,x,y,4,1,'#a9aaa0');rect(g,x+3,y+2,2,1,'#5c5d56')}
 for(let i=0;i<n/6;i++){const k=(hash(i,11,71)*(n-1))|0,p=STREAM[k],side=hash(i,12,71)<.5?-1:1,d=wd(k)/2+10+hash(i,13,71)*6,x=p[0]+side*d,y=p[1]-4+hash(i,14,71)*8;if(!free(x,y))continue;
  const r=6+hash(i,15,71)*4,pal=['#4f7a4c','#6a9a58','#86ae66','#3f6a42'];g.fillStyle='#2a3b2a40';g.beginPath();g.ellipse(x+LIGHT.x*4,y+LIGHT.y*3,r*1.2,r*.7,.5,0,6.28);g.fill();
  outlinedDraw(g,x,y,G=>{for(let q=0;q<3;q++){const aa=q*2.1+hash(q,i),dd=r*.4;blobPatch(G,Math.cos(aa)*dd,Math.sin(aa)*dd,r*.65,pal[0],pal,i+q)}},'#26392a')}
 // mokradła: łąka turzycowa → pas trzcin i błota → płytka woda z liliami, kępy i martwe pnie
 for(const [wi,W] of WETLANDS.entries()){
  for(let y=W.y-W.ry*1.5;y<W.y+W.ry*1.5;y+=3)for(let x=W.x-W.rx*1.5;x<W.x+W.rx*1.5;x+=3){
   const d=wdN(x,y,W);if(d>1.12)continue;
   let c;if(d>1)c=mixc('#7d9a58','#8aa462',vn(x/7,y/7,26));
   else if(d>.84)c=mixc('#6f8a4a','#8a9a56',vn(x/8,y/8,22));
   else if(d>.6)c=mixc('#5d5a3e','#6e6a48',vn(x/10,y/10,23));
   else if(d>.3)c=mixc('#4a7a88','#5f93a0',vn(x/14,y/14,24));
   else c=mixc('#3c6a7a','#4a7a88',vn(x/16,y/16,27));
   rect(g,x,y,3,3,c)}
  // odbicia nieba i fale
  for(let i=0;i<110;i++){const a=hash(i,W.x|0,76)*6.283,d=Math.sqrt(hash(i,W.x|0,77))*.55,x=W.x+Math.cos(a)*W.rx*d,y=W.y+Math.sin(a)*W.ry*d;rect(g,x,y,3+(i%4),1,i%3?'#a9d2d8':'#7fb2bd')}
  // wysepki-kępy z krzakiem lub martwym pniem
  for(let i=0;i<3;i++){const a=hash(i,W.x|0,78)*6.283,d=.12+hash(i,W.x|0,79)*.34,x=W.x+Math.cos(a)*W.rx*d,y=W.y+Math.sin(a)*W.ry*d;
   g.fillStyle='#4a5a3a';g.beginPath();g.ellipse(x,y,9+i*2,5+i,0,0,6.283);g.fill();g.fillStyle='#6f8a4a';g.beginPath();g.ellipse(x,y-1,7+i*2,3.5+i,0,0,6.283);g.fill();
   if(i===1){rect(g,x-1,y-12,3,12,'#4a3a2a');rect(g,x-4,y-9,4,1,'#4a3a2a');rect(g,x+2,y-7,4,1,'#4a3a2a');rect(g,x-1,y-12,1,12,'#6b5a44')}
   else for(let q=0;q<9;q++)rect(g,x-6+q*1.5,y-5-(q%3)*2,1,5+(q%3)*2,q%2?'#8c9c50':'#a9b266')}
  // grążele
  for(let i=0;i<26;i++){const a=hash(i,W.x|0,80)*6.283,d=.28+hash(i,W.x|0,81)*.4,x=W.x+Math.cos(a)*W.rx*d,y=W.y+Math.sin(a)*W.ry*d;
   g.fillStyle='#3f7a48';g.beginPath();g.ellipse(x,y,4,2,0,0,6.283);g.fill();rect(g,x-2,y-1,3,1,'#5fa05e');if(i%4===0){rect(g,x,y-2,2,2,'#f2efe0');rect(g,x,y-3,1,1,'#e8d060')}}
  // trzciny i pałki na brzegu
  for(let i=0;i<520;i++){const a=hash(i,W.x|0,72)*6.283,d=.62+hash(i,W.x|0,73)*.5,x=W.x+Math.cos(a)*W.rx*d,y=W.y+Math.sin(a)*W.ry*d;
   if(d>.82&&hash(i,W.y|0,74)<.75||d>.6&&hash(i,W.y|0,75)<.45){const h=3+(i%5);rect(g,x,y-h+2,1,h,['#9a9a58','#b8b070','#7f8a46'][i%3]);if(i%11===0)rect(g,x-1,y-h,3,3,'#5a3a24')}
   if(i%53===0)rect(g,x,y-5,2,6,'#5a3f2a')}
  // (łączenie ze strumieniem rysujemy niżej, po wszystkich mokradłach)
  // kępy turzyc dookoła
  for(let i=0;i<40;i++){const a=hash(i,W.x|0,82)*6.283,x=W.x+Math.cos(a)*W.rx*(1.02+hash(i,W.x|0,83)*.12),y=W.y+Math.sin(a)*W.ry*(1.02+hash(i,W.x|0,84)*.14);if(!free(x,y))continue;
   for(let q=0;q<5;q++)rect(g,x-4+q*2,y-4-(q%2)*2,1,5+(q%2)*2,q%2?'#6f9a4a':'#86ae5c')}
 }

 // 1.0: dopływ = kilka cienkich strużek przez pas błota ku wodzie; odpływ = wąska smuga z wody, poszerzająca się dalej w strumień.
 // Źródło w mokradle NW ma tylko odpływ (wypływa spod trzcin).
 const rill=(pts,lat,w0,w1,seed,fan)=>{
  const P=pts.map((p,k)=>{const q=pts[Math.min(pts.length-1,k+1)],r=pts[Math.max(0,k-1)],dx=q[0]-r[0],dy=q[1]-r[1],L=Math.hypot(dx,dy)||1,t=k/(pts.length-1),
   o=lat*Math.pow(Math.max(0,fan?(t-.12)/.88:t),1.15)+Math.sin(k*.9+seed)*1.6*(fan?t:1)+Math.sin(k*2.3+seed*2)*.8;return[p[0]-dy/L*o,p[1]+dx/L*o]});
  for(const [col,add] of [['#5d5a3e',3.4],['#4f7f8c',0],['#6aa3b0',-1.2]]){g.strokeStyle=col;
   for(let k=0;k<P.length-1;k++){const t=k/(P.length-1),w=(w0+(w1-w0)*t)+add;if(w<.8)continue;g.lineWidth=w;g.beginPath();g.moveTo(P[k][0],P[k][1]);g.lineTo(P[k+1][0],P[k+1][1]);g.stroke()}}
  // błotniste łatki i trzciny przy strużce
  for(let k=0;k<P.length;k+=2){const [x,y]=P[k];if(hash(k,seed*7|0,93)<.5)continue;
   g.fillStyle='#5d5a3e90';g.beginPath();g.ellipse(x+(hash(k,1,93)-.5)*8,y+(hash(k,2,93)-.5)*8,3+hash(k,3,93)*3,1.6+hash(k,4,93)*1.5,0,0,6.28);g.fill();
   const h=3+((k+seed)%4);rect(g,x+(hash(k,5,93)<.5?-1:1)*(w1+3),y-h+2,1,h,k%2?'#9a9a58':'#b8b070')}
 };
 for(const W of WETLANDS){
  const dW=i=>wdN(STREAM[i][0],STREAM[i][1],W);let i=0;
  while(i<n){if(dW(i)>=1.12){i++;continue}
   const a=i;while(i<n&&dW(i)<1.12)i++;const b=i-1;
   let wa=a;while(wa<=b&&dW(wa)>=.62)wa++;let wb=b;while(wb>=a&&dW(wb)>=.62)wb--;
   if(a>0&&wa<=b){const pts=STREAM.slice(a-1,wa+1);
    rill(pts,15,2.4,1.8,1.3,true);rill(pts,-13,2.2,1.6,3.1,true);rill(pts,0,3.4,2.6,5.7,false)}
   if(b<n-1&&wb>=a){const pts=STREAM.slice(wb,Math.min(n,b+3));rill(pts,0,2.8,wd(b)*.42+1,2.2,false);
    const p=STREAM[b+1];for(let q=0;q<7;q++){const x=p[0]+(hash(q,b,94)-.5)*26,y=p[1]+(hash(q,b,95)-.5)*22,h=3+(q%4);if(wdAny(x,y)<.9||!free(x,y))continue;rect(g,x,y-h+2,1,h,q%2?'#9a9a58':'#b8b070')}}}
 }
}
// Przesieki: wąskie proste pasy trawy między oddziałami (dla pieszych i zwierząt, nie dla aut).
function paintPrzesieki(){
 for(const L of PRZESIEKI){const v=L.dir==='v',n=Math.hypot(L.x2-L.x1,L.y2-L.y1);
  for(let u=0;u<n;u+=2){const x=v?L.x1:L.x1+u,y=v?L.y1+u:L.y1;
   if(roadClearance(x,y)<24||inPolana(x,y,8)||inRect(x,y,YARD,30)||inRect(x,y,PLAC,20)||inWater(x,y,4))continue;
   const j=hash(u,L.x1+L.y1,75);
   if(v){rect(g,x-4,y,8,2,'#6b8a4c');rect(g,x-3,y,6,2,j>.5?'#86a464':'#7b9a58');if(j>.8)rect(g,x-1,y,1,2,'#a8c07c')}
   else{rect(g,x,y-4,2,8,'#6b8a4c');rect(g,x,y-3,2,6,j>.5?'#86a464':'#7b9a58');if(j>.8)rect(g,x,y-1,2,1,'#a8c07c')}}}
}
// Tablice dróg pożarowych (zarezerwowane do 0.7).
function paintPolana(){
 for(const [pi,P] of POLANY.entries()){const R=P.r*1.45;
 for(let y=P.y-R;y<P.y+R;y+=3)for(let x=P.x-R;x<P.x+R;x+=3){if(Math.hypot(x-P.x,y-P.y)>polR(Math.atan2(y-P.y,x-P.x),P)+8*vn(x/30,y/30,9))continue;
  const n=vn(x/40,y/40,8);rect(g,x,y,3,3,mixc('#8aa462','#a6b878',n))}
 for(let i=0;i<2600*(P.r/150)**2;i++){const a=hash(i,81+pi)*6.283,d=Math.sqrt(hash(i,82+pi)),r=polR(a,P)*d,x=P.x+Math.cos(a)*r,y=P.y+Math.sin(a)*r;
  rect(g,x,y,1,2,i%7===0?['#e8e2c0','#d7c24a','#b98ad0','#e6e6f0'][i%4]:i%2?'#b4c288':'#71904f')}
 // krzewy na polanie i przy brzegu (zarastanie)
 const nb=Math.round(16*(P.r/150)**2)+2;
 for(let i=0;i<nb;i++){const a=hash(i,83+pi)*6.283,d=i<nb*.4?.35+hash(i,84)*.4:.82+hash(i,85)*.12,x=P.x+Math.cos(a)*polR(a,P)*d,y=P.y+Math.sin(a)*polR(a,P)*d,r=5+hash(i,86)*4,pal=['#4a6e4a','#5a8052','#76955c','#8ea870'];
  g.fillStyle='#2a3b2a40';g.beginPath();g.ellipse(x+LIGHT.x*4,y+LIGHT.y*3,r*1.1,r*.7,.5,0,6.28);g.fill();
  outlinedDraw(g,x,y,G=>{for(let k=0;k<3;k++){const aa=k*2.1+hash(k,i),dd=r*.35;blobPatch(G,Math.cos(aa)*dd,Math.sin(aa)*dd,r*.6,pal[0],pal,i+k)}},'#26392a')}
 }
}
// Ambona myśliwska: drewniana kabina na nogach, dach z papy (rysowana dynamicznie, nad postaciami).
export function drawAmbona(c,x=AMBONA.x,y=AMBONA.y){
 c.fillStyle='#2b3b2a50';c.beginPath();c.moveTo(x+6,y+6);c.lineTo(x+6+LIGHT.x*60,y+6+LIGHT.y*60);c.lineTo(x+20+LIGHT.x*60,y-6+LIGHT.y*60);c.lineTo(x+20,y-6);c.fill();
 outlinedDraw(c,x,y,G=>{
  for(const [dx,dy] of [[-9,-9],[9,-9],[-9,9],[9,9]])rect(G,dx-1,dy-1,3,3,'#5a4630');
  rect(G,-2,10,4,14,'#7a6044');for(let k=12;k<24;k+=3)rect(G,-3,k,6,1,'#a4865e');
  rect(G,-10,-10,20,20,'#6b5238');rect(G,-9,-9,18,18,'#8f7050');
  rect(G,-11,-12,22,6,'#3a3a36');rect(G,-11,-12,22,2,'#56564f');rect(G,-11,-7,22,1,'#2a2a26');
  rect(G,-6,-2,12,3,'#2f2a24');
 },DARK);
}
// Elementy „rekwizytów” (słupki, szlabany, tablice, znaki DP) są pieczone osobno i rysowane po zimowej mgiełce, żeby zimą nie były wyszarzone.
export const PROPS=[];
function bakeProp(x,y,w,h,fn){const [cv,c]=mk(w,h);c.translate(-x,-y);fn(c);PROPS.push({x,y,w,h,cv})}
const postDraw=(g,p)=>{shadow(g,p.x-3,p.y-3,6,6,12);rect(g,p.x-4,p.y-4,8,8,'#55524a');rect(g,p.x-3,p.y-3,6,6,'#e8e6dc');rect(g,p.x-3,p.y-3,6,1,'#ffffff');
  p.n.forEach((t,k)=>{const y=p.y-9+k*12;g.globalAlpha=.55;rect(g,p.x+5,y-1,t.length*5+3,8,'#1f2a20');g.globalAlpha=1;text3(g,t,p.x+6,y,'#f1ecd8')})}
const barrierDraw=(g,b)=>{shadow(g,b.x-4,b.y-4,8,8,14);rect(g,b.x-4,b.y-4,8,8,'#4a4740');rect(g,b.x-3,b.y-3,6,6,'#7a776e');
  for(let k=3;k<44;k++)rect(g,Math.round(b.x+b.bx*k)-1,Math.round(b.y+b.by*k)-1,3,3,Math.floor(k/6)%2?'#c8342b':'#f2efe6')}
const boardDraw=g=>{const B=BOARD;shadow(g,B.x,B.y,34,8,18);outlinedDraw(g,B.x+17,B.y,G=>{rect(G,-15,-2,2,8,'#6b563d');rect(G,13,-2,2,8,'#6b563d');rect(G,-18,-14,36,14,'#5a4630');rect(G,-17,-13,34,12,'#3e7048');rect(G,-15,-11,30,2,'#f1e6c2');rect(G,-15,-7,22,1,'#cfe0c2');rect(G,-15,-5,26,1,'#cfe0c2')},DARK);
};
const signDraw=(g,f)=>outlinedDraw(g,f.x+28,f.y,G=>{rect(G,-1,-4,2,10,'#6b563d');rect(G,-13,-14,26,10,'#a8342b');rect(G,-12,-13,24,8,'#c8453a');text3(G,'DP '+f.n,-8,-12,'#f6efe0')},DARK);
function bakeProps(){
 for(const p of POSTS)bakeProp(p.x-8,p.y-16,90,p.n.length*12+22,c=>postDraw(c,p));
 {const B=BOARD;bakeProp(B.x-8,B.y-22,60,40,c=>boardDraw(c))}
 for(const f of FIRE_SIGNS)bakeProp(f.x+28-20,f.y-22,44,34,c=>signDraw(c,f));
}
export function buildGround(){
 paintFloor();paintPolana();paintWater();paintRoads();paintTurns();paintVerges();paintYard();paintPlac();
 bakeProps();
}

// ── ślady na podłożu (0.5): koleiny szlaków zrywkowych i bruzdy pługa na osobnej warstwie, która co dzień blednie ──
// Koleiny znikają po kilku dniach, bruzdy (malowane mocniej) po kilku porach roku. Po wczytaniu zapisu malujemy je ponownie z jasnością wg wieku.
// Warstwa śladów w kawałkach 256 px tworzonych tylko tam, gdzie coś namalowano (duża mapa — oszczędność pamięci).
const MC=256,MW=Math.ceil(WORLD.w/MC),MH=Math.ceil(WORLD.h/MC);export const markChunks=new Array(MW*MH).fill(null);
let A=1;export const markAlpha=a=>{A=a};
function mchunk(x,y){const i=Math.floor(x/MC),j=Math.floor(y/MC);if(i<0||j<0||i>=MW||j>=MH)return null;let c=markChunks[j*MW+i];if(!c){const [cv,cg]=mk(MC,MC);c=markChunks[j*MW+i]={cv,cg,x:i*MC,y:j*MC}}return c}
// prostokąt na warstwie śladów (może zahaczyć o sąsiednie kawałki)
function mrect(x,y,w,h,col){let a=null,b=null;for(const [px,py] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){const c=mchunk(px,py);if(!c||c===a||c===b)continue;if(!a)a=c;else if(!b)b=c;c.cg.globalAlpha=mg.globalAlpha;rect(c.cg,x-c.x,y-c.y,w,h,col)}}
const mg={globalAlpha:1};
export function fadeMarks(k=.12){for(const c of markChunks){if(!c)continue;const g2=c.cg;g2.save();g2.globalCompositeOperation='destination-out';g2.fillStyle=`rgba(0,0,0,${k})`;g2.fillRect(0,0,MC,MC);g2.restore()}}
export function paintRut(x,y,h,hw){
 const c=Math.cos(h),s=Math.sin(h);
 mg.globalAlpha=.55*A;
 for(const side of [-1,1]){const px=x+c*hw*side,py=y+s*hw*side;mrect(px-1.5,py-1.5,3,3,'#5c4a34')}
 mg.globalAlpha=.25*A;mrect(x-1,y-1,2,2,'#8a7a5a');mg.globalAlpha=1;
}
export function paintTrail(pts,hw=9){
 for(let i=0;i<pts.length-1;i++){const [ax,ay]=pts[i],[bx,by]=pts[i+1],L=Math.hypot(bx-ax,by-ay),h=Math.atan2(bx-ax,-(by-ay));
  for(let u=0;u<L;u+=2)paintRut(ax+(bx-ax)*u/L,ay+(by-ay)*u/L,h,hw)}
}
// Bruzda pługa LPz: ciemny pas odsłoniętej gleby z jaśniejszymi skibami po bokach (rzędy co 18 px ≈ 1,5 m).
export function paintFurrow(x,y,len=3){
 const xx=Math.round(x);mg.globalAlpha=A;
 mrect(xx,y-5,len,2,'#a08460');mrect(xx,y-3,len,6,'#5e4630');mrect(xx,y-1,len,1,'#4e3a28');mrect(xx,y+3,len,2,'#9a7e5a');
 if(hash(xx,y,7)<.3)mrect(xx,y-2,1,1,'#7a6040');mg.globalAlpha=1;
}
export function paintFurrowRow(y,x0,x1){for(let x=x0;x<x1;x+=3)paintFurrow(x,y,3)}
