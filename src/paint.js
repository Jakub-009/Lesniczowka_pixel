// Malowanie stałego podłoża z danych mapy (raz, przy starcie): ściółka oddziałów, pobocza, drogi, leśniczówka, składnica, polana, uprawa.
import {WORLD,hash,rect,line,poly,shadow,LIGHT,clamp} from './core.js';
import {mk,outlinedDraw,text3} from './sprite.js';
import {NODES,EDGES,roadClearance,oddzial,YARD,HOUSE,CARPORT,WOODSHED,GARDEN,KENNEL,WELL,PLAC,TURNS,POLANA,AMBONA,UPRAWA,FENCES,POSTS,BARRIERS,BOARD,inRect,inPolana,LDY,ptAt,hy,WETLANDS,STREAM,streamDist,inWater,PRZESIEKI,FIRE_SIGNS,polR} from './map.js';
export const [ground,g]=mk(WORLD.w,WORLD.h);
const DARK='#2a3328';
const vn=(u,v,z=5)=>{const x=Math.floor(u),y=Math.floor(v),fx=u-x,fy=v-y,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const a=hash(x,y,z),b=hash(x+1,y,z),c=hash(x,y+1,z),d=hash(x+1,y+1,z);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy};
const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mixc=(a,b,t)=>{const A=rgb(a),B=rgb(b);return`rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`};
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
 for(const e of E){strokeE(e,e.w+(e.kind==='main'?8:6),e.kind==='main'?'#9a9888':'#9d8f70');flare(e,'#9d8f70',22)}
 for(const e of nm){strokeE(e,e.w,'#b8a682');flare(e,'#b8a682',18)}
 for(const e of mn)strokeE(e,e.w,'#75797c');
 for(const e of nm){
  for(let i=0;i<e.len*e.w/7;i++){const s0=hash(i,e.len|0,41)*e.len,lat=(hash(i,e.len|0,42)-.5)*(e.w-2),p=ptAt(e,s0);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,1+(i%4===0),1,['#a99674','#c7b791','#9a8866','#d2c4a0'][i%4])}
  if(e.kind==='drive'){strokeE(e,e.w-6,'#a89a78',0,0,e.len);continue}
  strokeE(e,4,'#8e7a58',-9,14,e.len-14);strokeE(e,4,'#8e7a58',9,14,e.len-14);
  for(let u=24;u<e.len-24;u+=3){if((junc(e.a)&&u<36)||(junc(e.b)&&u>e.len-36))continue;const j=hash(u,e.len|0,43);if(j<.25)continue;const p=ptAt(e,u);rect(g,p[0]-1|0,p[1]-1|0,2+(j*2|0),2,j>.7?'#7f9a58':'#6d8a4b')}
 }
 for(const e of mn){
  for(let i=0;i<e.len*e.w/8;i++){const s0=hash(i,301,e.len|0)*e.len,lat=(hash(i,302,e.len|0)-.5)*(e.w-2),p=ptAt(e,s0);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,1+(i%5===0),1,['#6c7175','#81868a','#70757a'][i%3])}
  for(let i=0;i<e.len*e.w/3600;i++){const s0=hash(i,310,e.len|0)*e.len,lat=(hash(i,311,e.len|0)-.5)*(e.w-12),p=ptAt(e,s0);rect(g,p[0]-p[3]*lat|0,p[1]+p[2]*lat|0,12+(i%4)*6,5+(i%3)*2,i%3?'#727779':'#7d8285')}
  g.lineWidth=2;g.strokeStyle='#e6e4d8';g.lineCap='butt';
  for(let u=10;u<e.len-32;u+=40){const p=ptAt(e,u+11);if(['j1','j2','j3','j4'].some(k=>Math.hypot(p[0]-NODES[k][0],p[1]-NODES[k][1])<46))continue;const A=ptAt(e,u),B=ptAt(e,u+22);g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.stroke()}
 }
 // rów przy szosie (po południowej stronie) z wodą; przerwany tam, gdzie z szosy odchodzą drogi na południe (przepusty)
 const gaps=['j1','j2','j4'].map(k=>NODES[k][0]);
 for(const e of mn)for(let u=0;u<e.len-8;u+=8){const A=ptAt(e,u),B=ptAt(e,u+9),nx=-A[3]*48,ny=A[2]*48,nx2=-B[3]*48,ny2=B[2]*48;if(gaps.some(gx=>Math.abs(A[0]-gx)<32))continue;
  g.lineCap='butt';g.lineWidth=9;g.strokeStyle='#6a8656';g.beginPath();g.moveTo(A[0]+nx,A[1]+ny);g.lineTo(B[0]+nx2,B[1]+ny2);g.stroke();
  g.lineWidth=4;g.strokeStyle='#56724a';g.stroke();if((u/8|0)%4===0)rect(g,A[0]+nx,A[1]+ny-1,8,2,'#7fa3a0')}
 for(const gx of gaps)for(const sx of [gx-31,gx+27]){const y=hy(sx)+48;rect(g,sx,y-6,4,11,'#8e8e86');rect(g,sx+1,y-3,2,5,'#4a4e4a')}
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
  if(rc<8||rc>30||inRect(x,y,YARD,30)||inRect(x,y,PLAC,20)||inRect(x,y,UPRAWA,10)||inWater(x,y,8))continue;
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
 rect(g,360,262+LDY,200,76,'#b7a684');for(let i=0;i<700;i++)rect(g,360+hash(i,63)*198|0,262+LDY+hash(i,64)*74|0,2,1,i%2?'#a6956f':'#cbbd98');
 g.save();g.translate(0,LDY);g.lineCap='round';g.strokeStyle='#cbbd98';g.lineWidth=10;g.beginPath();g.moveTo(300,292);g.lineTo(300,312);g.lineTo(372,312);g.stroke();
 g.beginPath();g.moveTo(300,312);g.lineTo(220,312);g.lineTo(212,346);g.stroke();g.lineCap='butt';g.restore();
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
 rect(g,232,404+LDY,26,6,'#7a5a3e');rect(g,232,404+LDY,26,2,'#a07a52');
 outlinedDraw(g,520,240+LDY,G=>{rect(G,-1,-6,2,10,'#6b563d');rect(G,-22,-16,44,11,'#2f5a3a');rect(G,-21,-15,42,9,'#3e7048');text3(G,'LEŚNICTWO',-18,-13,'#f1e6c2')},DARK);
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
// Plac manewrowy przy leśniczówce (0.6): tłuczeń, ślady kół; tu nocują maszyny zrywkowe.
function paintPlac(){
 const S=PLAC;
 rect(g,S.x-4,S.y-4,S.w+8,S.h+8,'#9c9378');rect(g,S.x,S.y,S.w,S.h,'#aea68f');
 for(let i=0;i<2600;i++)rect(g,S.x+hash(i,71)*(S.w-2)|0,S.y+hash(i,72)*(S.h-2)|0,1+(i%3===0),1,['#9b937c','#c2baa2','#8d866f','#b8b098'][i%4]);
 for(let k=0;k<2;k++){rect(g,S.x+30+k*88,S.y+30,46,3,'#8d866f');rect(g,S.x+30+k*88,S.y+60,46,3,'#8d866f')}
 g.fillStyle='#4a4a4250';g.beginPath();g.ellipse(S.x+150,S.y+70,10,5,0,0,6.28);g.fill();
 outlinedDraw(g,S.x+S.w-18,S.y+S.h-6,G=>{rect(G,-1,-4,2,10,'#6b563d');rect(G,-12,-14,24,10,'#2f5a3a');rect(G,-11,-13,22,8,'#3e7048');text3(G,'PLAC',-8,-12,'#f1e6c2')},DARK);
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
 const path=()=>{g.beginPath();STREAM.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]))};
 path();g.lineWidth=20;g.strokeStyle='#6f7a4c';g.stroke();path();g.lineWidth=15;g.strokeStyle='#5d5a3e';g.stroke();path();g.lineWidth=10;g.strokeStyle='#4f7f8f';g.stroke();
 path();g.lineWidth=3;g.strokeStyle='#8fc0cb';g.setLineDash([9,15]);g.stroke();g.setLineDash([]);
 for(let i=0;i<STREAM.length*5;i++){const p=STREAM[(hash(i,5,71)*(STREAM.length-1))|0],a=hash(i,6,71)*6.283,d=9+hash(i,7,71)*6;rect(g,p[0]+Math.cos(a)*d,p[1]+Math.sin(a)*d,1,3+(i%3),i%2?'#9a9a58':'#b8b070')}
 for(const W of WETLANDS){
  for(let y=W.y-W.ry*1.4;y<W.y+W.ry*1.4;y+=3)for(let x=W.x-W.rx*1.4;x<W.x+W.rx*1.4;x+=3){
   const nz=1+.22*(vn(x/28,y/28,21)-.5)*2,d=Math.hypot((x-W.x)/W.rx,(y-W.y)/W.ry)/nz;if(d>1)continue;
   const c=d>.8?mixc('#6f7f4a','#8a9456',vn(x/9,y/9,22)):d>.52?mixc('#5d5a3e','#6e6a48',vn(x/10,y/10,23)):mixc('#4a7a88','#5f93a0',vn(x/14,y/14,24));rect(g,x,y,3,3,c)}
  for(let i=0;i<380;i++){const a=hash(i,W.x|0,72)*6.283,d=.55+hash(i,W.x|0,73)*.55,x=W.x+Math.cos(a)*W.rx*d,y=W.y+Math.sin(a)*W.ry*d;if(d>.8&&hash(i,W.y|0,74)<.7||d>.52)rect(g,x,y,1,3+(i%4),['#9a9a58','#b8b070','#7f8a46'][i%3]);if(i%47===0)rect(g,x,y-4,2,5,'#5a3f2a')}
 }
}
// Przesieki: wąskie proste pasy trawy między oddziałami (dla pieszych i zwierząt, nie dla aut).
function paintPrzesieki(){
 for(const L of PRZESIEKI){const v=L.dir==='v',n=Math.hypot(L.x2-L.x1,L.y2-L.y1);
  for(let u=0;u<n;u+=2){const x=v?L.x1:L.x1+u,y=v?L.y1+u:L.y1;
   if(roadClearance(x,y)<24||inPolana(x,y,8)||inRect(x,y,UPRAWA,26)||inRect(x,y,YARD,30)||inRect(x,y,PLAC,20)||inWater(x,y,4))continue;
   const j=hash(u,L.x1+L.y1,75);
   if(v){rect(g,x-4,y,8,2,'#6b8a4c');rect(g,x-3,y,6,2,j>.5?'#86a464':'#7b9a58');if(j>.8)rect(g,x-1,y,1,2,'#a8c07c')}
   else{rect(g,x,y-4,2,8,'#6b8a4c');rect(g,x,y-3,2,6,j>.5?'#86a464':'#7b9a58');if(j>.8)rect(g,x,y-1,2,1,'#a8c07c')}}}
}
// Tablice dróg pożarowych (zarezerwowane do 0.7).
function paintSigns(){for(const f of FIRE_SIGNS)outlinedDraw(g,f.x+28,f.y,G=>{rect(G,-1,-4,2,10,'#6b563d');rect(G,-13,-14,26,10,'#a8342b');rect(G,-12,-13,24,8,'#c8453a');text3(G,'DP '+f.n,-8,-12,'#f6efe0')},DARK)}
function paintPolana(){
 const P=POLANA,R=P.r*1.45;
 for(let y=P.y-R;y<P.y+R;y+=3)for(let x=P.x-R;x<P.x+R;x+=3){if(!inPolana(x,y,8*vn(x/30,y/30,9)))continue;
  const n=vn(x/40,y/40,8);rect(g,x,y,3,3,mixc('#8aa462','#a6b878',n))}
 for(let i=0;i<2600;i++){const a=hash(i,81)*6.283,d=Math.sqrt(hash(i,82)),r=polR(a)*d,x=P.x+Math.cos(a)*r,y=P.y+Math.sin(a)*r;
  rect(g,x,y,1,2,i%7===0?['#e8e2c0','#d7c24a','#b98ad0','#e6e6f0'][i%4]:i%2?'#b4c288':'#71904f')}
 // krzewy na polanie i przy brzegu (zarastanie)
 for(let i=0;i<16;i++){const a=hash(i,83)*6.283,d=i<6?.35+hash(i,84)*.4:.82+hash(i,85)*.12,x=P.x+Math.cos(a)*polR(a)*d,y=P.y+Math.sin(a)*polR(a)*d,r=5+hash(i,86)*4,pal=['#4a6e4a','#5a8052','#76955c','#8ea870'];
  g.fillStyle='#2a3b2a40';g.beginPath();g.ellipse(x+LIGHT.x*4,y+LIGHT.y*3,r*1.1,r*.7,.5,0,6.28);g.fill();
  outlinedDraw(g,x,y,G=>{for(let k=0;k<3;k++){const aa=k*2.1+hash(k,i),dd=r*.35;blobPatch(G,Math.cos(aa)*dd,Math.sin(aa)*dd,r*.6,pal[0],pal,i+k)}},'#26392a')}
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
function paintUprawa(){   // szkółka leśna: ogrodzony, pusty plac (po zakupie rysuje go drawBase)
 const U=UPRAWA;
 rect(g,U.x,U.y,U.w,U.h,'#7f8a55');
 for(let i=0;i<5000;i++)rect(g,U.x+hash(i,91)*(U.w-2)|0,U.y+hash(i,92)*(U.h-2)|0,1,1+(i%2),['#97a46a','#6b7a46','#a8a87a','#8a7a52'][i%4]);
 outlinedDraw(g,U.x-12,U.gate[0]-12,G=>{rect(G,-1,-4,2,10,'#6b563d');rect(G,-16,-14,32,10,'#e9e2c6');text3(G,'SZKÓŁKA',-14,-12,'#2a3b2d')},DARK);
}
function paintProps(){
 for(const p of POSTS){shadow(g,p.x-3,p.y-3,6,6,12);rect(g,p.x-4,p.y-4,8,8,'#55524a');rect(g,p.x-3,p.y-3,6,6,'#e8e6dc');rect(g,p.x-3,p.y-3,6,1,'#ffffff');
  p.n.forEach((t,k)=>{const y=p.y-9+k*12;g.globalAlpha=.55;rect(g,p.x+5,y-1,t.length*5+3,8,'#1f2a20');g.globalAlpha=1;text3(g,t,p.x+6,y,'#f1ecd8')})}
 // szlabany (otwarte, ramię wzdłuż pobocza)
 for(const b of BARRIERS){shadow(g,b.x+22,b.y-4,8,8,14);rect(g,b.x+22,b.y-4,8,8,'#4a4740');rect(g,b.x+23,b.y-3,6,6,'#7a776e');
  const dir=b.y>hy(b.x)?1:-1;for(let k=0;k<40;k++)rect(g,b.x+25,dir<0?b.y-4-k:b.y+4+k,3,1,Math.floor(k/6)%2?'#c8342b':'#f2efe6')}
 // tablica informacyjna leśnictwa
 const B=BOARD;shadow(g,B.x,B.y,34,8,18);outlinedDraw(g,B.x+17,B.y,G=>{rect(G,-15,-2,2,8,'#6b563d');rect(G,13,-2,2,8,'#6b563d');rect(G,-18,-14,36,14,'#5a4630');rect(G,-17,-13,34,12,'#3e7048');rect(G,-15,-11,30,2,'#f1e6c2');rect(G,-15,-7,22,1,'#cfe0c2');rect(G,-15,-5,26,1,'#cfe0c2')},DARK);
}
export function buildGround(){
 paintFloor();paintPolana();paintUprawa();paintWater();paintPrzesieki();paintRoads();paintTurns();paintVerges();paintPlac();paintYard();paintSigns();
 for(const f of FENCES)fence(f);
 paintProps();
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
