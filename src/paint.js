// Malowanie stałego podłoża z danych mapy (raz, przy starcie): ściółka oddziałów, pobocza, drogi, leśniczówka, składnica, polana, uprawa.
import {WORLD,hash,rect,line,poly,shadow,LIGHT,clamp} from './core.js';
import {mk,outlinedDraw,text3} from './sprite.js';
import {NODES,EDGES,roadClearance,oddzial,YARD,HOUSE,CARPORT,WOODSHED,GARDEN,KENNEL,WELL,SKLAD,POLANA,AMBONA,UPRAWA,FENCES,POSTS,BARRIERS,BOARD,inRect,inPolana} from './map.js';
export const [ground,g]=mk(WORLD.w,WORLD.h);
const DARK='#2a3328';
const vn=(u,v,z=5)=>{const x=Math.floor(u),y=Math.floor(v),fx=u-x,fy=v-y,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const a=hash(x,y,z),b=hash(x+1,y,z),c=hash(x,y+1,z),d=hash(x+1,y+1,z);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy};
const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mixc=(a,b,t)=>{const A=rgb(a),B=rgb(b);return`rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`};
// Ściółka: sosna — mech i borówki, świerk — ciemne igliwie, dąb/buk — opadłe liście.
const FLOOR={'101':['#647a45','#7a8a50','#4d6c40'],'102':['#4b6040','#5d6b45','#3c523a'],'103':['#7d6c48','#8e7c52','#68744a'],'104':['#6b7f48','#7d8c52','#59703f'],'105':['#617846','#768650','#4f6a40']};
const SPECK={'101':['#3f6a3d','#8a7a52','#506f3b','#9a8a5a'],'102':['#6b5a40','#354a35','#7a6a4c'],'103':['#9a7a48','#6e5a3a','#a88a55','#5f7243'],'104':['#8a7a50','#4a6a3c','#9a8a5a'],'105':['#836c48','#47683e','#9a8458']};
function paintFloor(){
 const B=4;
 for(let y=0;y<WORLD.h;y+=B)for(let x=0;x<WORLD.w;x+=B){
  const o=oddzial(x+(vn(x/70,y/70,11)-.5)*150,y+(vn(x/70,y/70,12)-.5)*150),f=FLOOR[o],n=vn(x/90,y/90)*.6+vn(x/26,y/26,7)*.4;
  const rc=roadClearance(x+2,y+2);
  let col=n<.5?mixc(f[2],f[0],n*2):mixc(f[0],f[1],(n-.5)*2);
  // pobocze: trawa przechodząca w ściółkę
  const verge=rc<62?clamp((62-rc)/22,0,1):0;
  g.fillStyle=verge>0?mixc(n<.5?f[2]:f[0],n>.6?'#9aae70':'#89a063',verge):col;g.fillRect(x,y,B,B);
 }
 for(let i=0;i<52000;i++){const x=hash(i,1,31)*WORLD.w|0,y=hash(i,2,31)*WORLD.h|0;if(roadClearance(x,y)<58)continue;const s=SPECK[oddzial(x,y)];rect(g,x,y,1+(i%3===0),1,s[i%s.length])}
 // borówczyska i kępy paproci w starszych drzewostanach
 for(let i=0;i<900;i++){const x=hash(i,3,31)*WORLD.w,y=hash(i,4,31)*WORLD.h;if(roadClearance(x,y)<70)continue;const o=oddzial(x,y);
  if(o==='101'||o==='104'){for(let k=0;k<14;k++)rect(g,x+(hash(k,i,5)-.5)*22,y+(hash(k,i,6)-.5)*12,2,2,k%3?'#3f6638':'#577c42')}
  else if(o==='103'||o==='105'){if(i%3)continue;for(let k=0;k<7;k++){const a=k*.9+hash(i,k)*.4;for(let u=0;u<9;u++)rect(g,x+Math.cos(a)*u,y+Math.sin(a)*u,2,1,u%3?'#5f8a45':'#79a356')}}}
}
// Drogi leśne: tłuczeń z dwiema koleinami i pasem trawy pośrodku; główna — asfalt z przerywaną osią.
const edgeRect=(e,add)=>{const A=NODES[e.a],B=NODES[e.b],h=(e.w+add)/2;
 if(A[0]===B[0])return[A[0]-h,Math.min(A[1],B[1])-(e.kind==='main'?0:h),h*2,Math.abs(B[1]-A[1])+(e.kind==='main'?0:h*2)];
 return[Math.min(A[0],B[0])-(e.kind==='main'?0:h),A[1]-h,Math.abs(B[0]-A[0])+(e.kind==='main'?0:h*2),h*2]};
function paintRoads(){
 const E=EDGES;
 for(const e of E){const [x,y,w,h]=edgeRect(e,e.kind==='main'?8:6);rect(g,x,y,w,h,e.kind==='main'?'#9a9888':'#9d8f70')}
 for(const kind of ['forest','drive','main'])for(const e of E.filter(q=>q.kind===kind)){const [x,y,w,h]=edgeRect(e,0);rect(g,x,y,w,h,kind==='main'?'#75797c':'#b8a682')}
 for(const e of E.filter(q=>q.kind!=='main')){
  const [x,y,w,h]=edgeRect(e,0);
  for(let i=0;i<w*h/7;i++){const px=x+hash(i,e.len|0,41)*(w-1)|0,py=y+hash(i,e.len|0,42)*(h-1)|0;rect(g,px,py,1+(i%4===0),1,['#a99674','#c7b791','#9a8866','#d2c4a0'][i%4])}
 }
 for(const e of E.filter(q=>q.kind==='forest'||q.kind==='drive')){
  const A=NODES[e.a],B=NODES[e.b],vert=A[0]===B[0],L=e.len;
  for(const off of [-9,9]){if(vert)rect(g,A[0]+off-2,Math.min(A[1],B[1])+14,4,L-28,'#8e7a58');else rect(g,Math.min(A[0],B[0])+14,A[1]+off-2,L-28,4,'#8e7a58')}
  for(let u=24;u<L-24;u+=3){const j=hash(u,e.len|0,43);if(j<.25)continue;const w=2+(j*3|0);
   if(vert)rect(g,A[0]-w/2,Math.min(A[1],B[1])+u,w,2,j>.7?'#7f9a58':'#6d8a4b');else rect(g,Math.min(A[0],B[0])+u,A[1]-w/2,2,w,j>.7?'#7f9a58':'#6d8a4b')}
 }
 for(const e of E.filter(q=>q.kind==='main')){
  const [x,y,w,h]=edgeRect(e,0);
  for(let i=0;i<w*h/8;i++){const px=x+hash(i,301,w)*(w-1)|0,py=y+hash(i,302,h)*(h-1)|0;rect(g,px,py,1+(i%5===0),1,['#6c7175','#81868a','#70757a'][i%3])}
  for(let i=0;i<w*h/3600;i++){const px=x+hash(i,310)*(w-14)|0,py=y+hash(i,311)*(h-8)|0;rect(g,px,py,12+(i%4)*6,5+(i%3)*2,i%3?'#727779':'#7d8285')}
  for(let xx=Math.ceil(x/40)*40;xx<x+w;xx+=40){if(Math.abs(xx+10-820)<42||Math.abs(xx+10-1700)<42)continue;rect(g,xx,1719,22,2,'#e6e4d8')}
 }
 // rów przy drodze głównej (po południowej stronie) z wodą w zagłębieniach
 rect(g,0,1764,WORLD.w,9,'#6a8656');rect(g,0,1767,WORLD.w,4,'#56724a');for(let x=0;x<WORLD.w;x+=34)rect(g,x+(hash(x,7)*10|0),1768,8,2,'#7fa3a0');
}
// Pobocza: kępy traw, kwiaty, krzewy (leszczyna, kruszyna, jeżyny).
function paintVerges(){
 for(let i=0;i<9000;i++){const x=hash(i,7,51)*WORLD.w,y=hash(i,8,51)*WORLD.h,rc=roadClearance(x,y);if(rc<3||rc>52)continue;
  const k=hash(i,9,51);rect(g,x,y,1,2+(k*2|0),k<.5?'#a4b878':'#6f8d52');if(k>.93)rect(g,x,y-1,2,2,['#e8e2c0','#d7c24a','#b98ad0','#e6a0a0'][i%4])}
 for(let i=0;i<700;i++){const x=hash(i,10,52)*WORLD.w,y=hash(i,11,52)*WORLD.h,rc=roadClearance(x,y);
  if(rc<14||rc>46||inRect(x,y,YARD,30)||inRect(x,y,SKLAD,20)||inRect(x,y,UPRAWA,10))continue;
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
 rect(g,360,262,200,76,'#b7a684');for(let i=0;i<700;i++)rect(g,360+hash(i,63)*198|0,262+hash(i,64)*74|0,2,1,i%2?'#a6956f':'#cbbd98');
 g.lineCap='round';g.strokeStyle='#cbbd98';g.lineWidth=10;g.beginPath();g.moveTo(300,292);g.lineTo(300,312);g.lineTo(372,312);g.stroke();
 g.beginPath();g.moveTo(300,312);g.lineTo(220,312);g.lineTo(212,346);g.stroke();g.lineCap='butt';
 // ogródek z grządkami
 const G=GARDEN;rect(g,G.x-3,G.y-3,G.w+6,G.h+6,'#6f8a4c');
 for(let x=G.x+4;x<G.x+G.w-8;x+=16){rect(g,x,G.y,10,G.h,'#6b5238');for(let y=G.y+5;y<G.y+G.h-6;y+=11)rect(g,x+2,y,6,5,(x+y)%3?'#4f7a45':'#7a9a4a')}
 // dom: czerwona dachówka, komin, lukarna
 roof(HOUSE.x,HOUSE.y,HOUSE.w,HOUSE.h,'#a2523b','#8e4532','#d48a62');
 rect(g,HOUSE.x+112,HOUSE.y+14,14,14,'#857563');rect(g,HOUSE.x+114,HOUSE.y+16,10,10,'#a89a86');rect(g,HOUSE.x+117,HOUSE.y+19,4,4,'#3b3631');
 rect(g,HOUSE.x+30,HOUSE.y+HOUSE.h-26,22,14,'#6e3a2a');rect(g,HOUSE.x+33,HOUSE.y+HOUSE.h-23,16,8,'#7b9aa2');
 // ganek nad drzwiami
 rect(g,DOORX-12,HOUSE.y+HOUSE.h,24,10,'#7a5a42');rect(g,DOORX-11,HOUSE.y+HOUSE.h+1,22,3,'#9a7656');
 // wiata na samochód: drewniany dach z blachy
 roof(CARPORT.x,CARPORT.y,CARPORT.w,CARPORT.h,'#6d7470','#5c625e','#9aa29d');
 // drewutnia z polanami
 const W=WOODSHED;shadow(g,W.x,W.y,W.w,W.h,22);rect(g,W.x,W.y,W.w,W.h,'#5e4a37');rect(g,W.x+2,W.y+2,W.w-4,W.h-4,'#7c624a');
 for(let r=0;r<5;r++)for(let c=0;c<7;c++){const px=W.x+6+c*9,py=W.y+8+r*12;rect(g,px,py,8,8,'#4a3a2a');rect(g,px+1,py+1,6,6,'#c9a473');rect(g,px+3,py+3,2,2,'#9a7a50')}
 // buda i studnia
 const K=KENNEL;shadow(g,K.x,K.y,K.w,K.h,10);rect(g,K.x,K.y,K.w,K.h,'#6f4f38');rect(g,K.x+1,K.y+1,K.w-2,K.h-2,'#a5714f');rect(g,K.x+K.w/2-1,K.y+1,2,K.h-2,'#7d5238');
 g.fillStyle='#4f4a44';g.beginPath();g.arc(WELL.x,WELL.y,9,0,6.28);g.fill();g.fillStyle='#8f8a80';g.beginPath();g.arc(WELL.x,WELL.y,7,0,6.28);g.fill();g.fillStyle='#2c3a3d';g.beginPath();g.arc(WELL.x,WELL.y,4,0,6.28);g.fill();rect(g,WELL.x-10,WELL.y-1,20,2,'#6b563d');
 // ławka i maszt z tablicą „LEŚNICTWO”
 rect(g,232,404,26,6,'#7a5a3e');rect(g,232,404,26,2,'#a07a52');
 outlinedDraw(g,520,240,G=>{rect(G,-1,-6,2,10,'#6b563d');rect(G,-22,-16,44,11,'#2f5a3a');rect(G,-21,-15,42,9,'#3e7048');text3(G,'LEŚNICTWO',-18,-13,'#f1e6c2')},DARK);
}
const DOORX=300;
function fence(f){
 const yard=f.style==='yard',hor=f.y1===f.y2,L=Math.hypot(f.x2-f.x1,f.y2-f.y1);
 const cols=yard?['#6f5236','#98764d']:['#9aa3a0','#c4ccc8'];
 for(const [d,c] of yard?[[0,cols[0]],[3,cols[1]]]:[[0,cols[1]],[2,cols[0]]]){if(hor)line(g,Math.min(f.x1,f.x2),f.y1+d,Math.max(f.x1,f.x2),f.y1+d,c,1);else line(g,f.x1+d,Math.min(f.y1,f.y2),f.x1+d,Math.max(f.y1,f.y2),c,1)}
 const step=yard?22:30;
 const post=(x,y)=>{rect(g,x+2,y+3,4,5,'#2d3b2b55');rect(g,x-2,y-2,4,5,yard?'#5f4329':'#6b563d');rect(g,x-1,y-2,2,1,yard?'#c9a574':'#a08560')};
 for(let t=0;t<=L;t+=step){if(hor)post(Math.min(f.x1,f.x2)+t,f.y1);else post(f.x1,Math.min(f.y1,f.y2)+t)}
}
function paintSklad(){
 const S=SKLAD;
 rect(g,S.x-4,S.y-4,S.w+8,S.h+8,'#9c9378');rect(g,S.x,S.y,S.w,S.h,'#aea68f');
 for(let i=0;i<3200;i++)rect(g,S.x+hash(i,71)*(S.w-2)|0,S.y+hash(i,72)*(S.h-2)|0,1+(i%3===0),1,['#9b937c','#c2baa2','#8d866f','#b8b098'][i%4]);
 for(let i=0;i<60;i++)rect(g,S.x+hash(i,73)*(S.w-12),S.y+hash(i,74)*(S.h-4),6+(i%3)*3,2,'#8a6c4a');   // kora i trociny
 // podkłady pod stos
 for(let x=1764;x<1950;x+=34){rect(g,x,1498,4,100,'#7d6a52');rect(g,x,1498,4,1,'#9a8668')}
 outlinedDraw(g,1756,1480,G=>{rect(G,-1,-4,2,10,'#6b563d');rect(G,-18,-14,36,10,'#2f5a3a');rect(G,-17,-13,34,8,'#3e7048');text3(G,'SKŁAD',-11,-12,'#f1e6c2')},DARK);
}
function paintPolana(){
 const P=POLANA;
 for(let y=P.y-P.r-12;y<P.y+P.r+12;y+=3)for(let x=P.x-P.r-12;x<P.x+P.r+12;x+=3){const d=Math.hypot(x-P.x,y-P.y);if(d>P.r+8*vn(x/30,y/30,9))continue;
  const n=vn(x/40,y/40,8);rect(g,x,y,3,3,mixc('#8aa462','#a6b878',n))}
 for(let i=0;i<1800;i++){const a=hash(i,81)*6.283,d=Math.sqrt(hash(i,82))*P.r,x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
  rect(g,x,y,1,2,i%7===0?['#e8e2c0','#d7c24a','#b98ad0','#e6e6f0'][i%4]:i%2?'#b4c288':'#71904f')}
 // paśnik z lizawką na skraju polany
 const px=P.x+40,py=P.y-60;shadow(g,px-14,py-8,28,16,16);rect(g,px-15,py-9,30,18,'#4e3c2c');rect(g,px-13,py-7,26,14,'#c6aa64');
 for(let k=0;k<6;k++)rect(g,px-12+k*5,py-6,2,12,'#9a7a3e');rect(g,px-15,py-1,30,2,'#6e5536');
 rect(g,px+24,py+6,5,5,'#ded8cc');rect(g,px+25,py+7,3,3,'#f4efe6');
}
// Ambona myśliwska: drewniana kabina na nogach, dach z papy (rysowana dynamicznie, nad postaciami).
export function drawAmbona(c){
 const {x,y}=AMBONA;
 c.fillStyle='#2b3b2a50';c.beginPath();c.moveTo(x+6,y+6);c.lineTo(x+6+LIGHT.x*60,y+6+LIGHT.y*60);c.lineTo(x+20+LIGHT.x*60,y-6+LIGHT.y*60);c.lineTo(x+20,y-6);c.fill();
 outlinedDraw(c,x,y,G=>{
  for(const [dx,dy] of [[-9,-9],[9,-9],[-9,9],[9,9]])rect(G,dx-1,dy-1,3,3,'#5a4630');
  rect(G,-2,10,4,14,'#7a6044');for(let k=12;k<24;k+=3)rect(G,-3,k,6,1,'#a4865e');
  rect(G,-10,-10,20,20,'#6b5238');rect(G,-9,-9,18,18,'#8f7050');
  rect(G,-11,-12,22,6,'#3a3a36');rect(G,-11,-12,22,2,'#56564f');rect(G,-11,-7,22,1,'#2a2a26');
  rect(G,-6,-2,12,3,'#2f2a24');
 },DARK);
}
function paintUprawa(){
 const U=UPRAWA;
 rect(g,U.x,U.y,U.w,U.h,'#7f8a55');
 for(let y=U.y+16;y<U.y+U.h-10;y+=22){rect(g,U.x+6,y-3,U.w-12,6,'#6e5a3e');rect(g,U.x+6,y-3,U.w-12,1,'#8a7452')}
 for(let i=0;i<5000;i++)rect(g,U.x+hash(i,91)*(U.w-2)|0,U.y+hash(i,92)*(U.h-2)|0,1,1+(i%2),['#97a46a','#6b7a46','#a8a87a','#8a7a52'][i%4]);
 outlinedDraw(g,U.x-12,U.gate[0]-12,G=>{rect(G,-1,-4,2,10,'#6b563d');rect(G,-16,-14,32,10,'#e9e2c6');text3(G,'UPRAWA',-12,-12,'#2a3b2d')},DARK);
}
function paintProps(){
 for(const p of POSTS){shadow(g,p.x-3,p.y-3,6,6,12);rect(g,p.x-4,p.y-4,8,8,'#55524a');rect(g,p.x-3,p.y-3,6,6,'#e8e6dc');rect(g,p.x-3,p.y-3,6,1,'#ffffff');
  text3(g,p.n[0],p.x+6,p.y-9,'#f1ecd8');text3(g,p.n[1],p.x+6,p.y+3,'#f1ecd8');
  g.globalAlpha=.55;rect(g,p.x+5,p.y-10,13,7,'#1f2a20');rect(g,p.x+5,p.y+2,13,7,'#1f2a20');g.globalAlpha=1;
  text3(g,p.n[0],p.x+6,p.y-9,'#f1ecd8');text3(g,p.n[1],p.x+6,p.y+3,'#f1ecd8')}
 // szlabany (otwarte, ramię wzdłuż pobocza)
 for(const b of BARRIERS){shadow(g,b.x+22,b.y-4,8,8,14);rect(g,b.x+22,b.y-4,8,8,'#4a4740');rect(g,b.x+23,b.y-3,6,6,'#7a776e');
  for(let k=0;k<40;k++)rect(g,b.x+25,b.y-4-k,3,1,Math.floor(k/6)%2?'#c8342b':'#f2efe6')}
 // tablica informacyjna leśnictwa
 const B=BOARD;shadow(g,B.x,B.y,34,8,18);outlinedDraw(g,B.x+17,B.y,G=>{rect(G,-15,-2,2,8,'#6b563d');rect(G,13,-2,2,8,'#6b563d');rect(G,-18,-14,36,14,'#5a4630');rect(G,-17,-13,34,12,'#3e7048');rect(G,-15,-11,30,2,'#f1e6c2');rect(G,-15,-7,22,1,'#cfe0c2');rect(G,-15,-5,26,1,'#cfe0c2')},DARK);
}
export function buildGround(){
 paintFloor();paintPolana();paintUprawa();paintRoads();paintVerges();paintSklad();paintYard();
 for(const f of FENCES)fence(f);
 paintProps();
}
