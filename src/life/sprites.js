// Sprite'y rysowane kodem (styl farmy): pojazdy przodem do góry, zwierzęta i ludzie głową/twarzą w prawo; obracane ostro z obrysem.
import {rect,line,LIGHT,RT,hash} from '../core.js';
import {drawRotated,blob,orientedShadow,text3} from '../sprite.js';

// ───────── pojazdy ─────────
function wheels(s,xs,ys,w,h,travel){
 const off=Math.round((((-travel)%5)+5)%5);
 for(const x of xs)for(const y of ys){rect(s,x-w/2,y-h/2,w,h,'#262f2c');for(let t=y-h/2+off-5;t<y+h/2;t+=5){if(t<y-h/2||t+2>y+h/2)continue;rect(s,x-w/2,t,w,2,'#5f655a')}}
}
export function carTop(g,x,y,h,col,travel=0){
 orientedShadow(g,x,y,h,[[10,23,0]],9);
 drawRotated(g,x,y,h,s=>{
  wheels(s,[-8,8],[-13,14],4,8,travel);
  rect(s,-9,-23,18,46,'#3a403c');rect(s,-8,-24,16,45,col);
  rect(s,-6,-13,12,12,'#668d97');rect(s,-5,-12,10,5,'#a1b6ba');rect(s,-6,10,12,6,'#637c81');
  rect(s,-6,-25,4,2,'#ecddb6');rect(s,2,-25,4,2,'#e8d4a8');rect(s,-6,20,4,2,'#c2362b');rect(s,2,20,4,2,'#c2362b');
 });
}
// Terenówka leśniczego: zielony pikap z plandeką na skrzyni.
export function patrolTop(g,x,y,h,travel=0,beacon=false){
 orientedShadow(g,x,y,h,[[11,25,0]],11);
 drawRotated(g,x,y,h,s=>{
  wheels(s,[-10,10],[-15,15],5,10,travel);
  rect(s,-10,-25,20,50,'#26392b');rect(s,-9,-26,18,49,'#3f6b44');rect(s,-9,-26,18,2,'#6e9a6a');
  rect(s,-7,-17,14,10,'#5d8790');rect(s,-6,-16,12,4,'#a8c2c6');rect(s,-8,-6,16,9,'#4c7a50');
  rect(s,-8,5,16,18,'#5c6a52');rect(s,-7,6,14,16,'#6f7d63');for(let k=8;k<22;k+=4)rect(s,-7,k,14,1,'#5a674f');
  rect(s,-8,-2,16,3,'#f1e6c2');rect(s,-8,-1,16,1,'#d8b23a');
  rect(s,-7,-28,4,2,'#ecddb6');rect(s,3,-28,4,2,'#ecddb6');rect(s,-7,22,3,2,'#c2362b');rect(s,4,22,3,2,'#c2362b');
  if(beacon){const on=Math.floor(RT.frame/12)%2;rect(s,-5,-5,4,3,on?'#ffb233':'#7a5a20');rect(s,1,-5,4,3,on?'#7a5a20':'#ffb233')}
 });
}
// Bus ekipy leśnej: biały z pomarańczowym pasem.
export function vanTop(g,x,y,h,travel=0){
 orientedShadow(g,x,y,h,[[11,27,0]],12);
 drawRotated(g,x,y,h,s=>{
  wheels(s,[-10,10],[-17,17],5,10,travel);
  rect(s,-11,-27,22,54,'#3b403d');rect(s,-10,-28,20,53,'#e9e7de');rect(s,-10,-28,20,2,'#ffffff');
  rect(s,-8,-25,16,8,'#5d8790');rect(s,-7,-24,14,3,'#a8c2c6');
  rect(s,-10,-14,20,4,'#e07a1e');for(let k=-6;k<22;k+=7)rect(s,-8,k,16,1,'#d3d1c7');
  rect(s,-6,-30,4,2,'#ecddb6');rect(s,2,-30,4,2,'#ecddb6');rect(s,-8,24,4,2,'#c2362b');rect(s,4,24,4,2,'#c2362b');
 });
}
// Ciągnik leśny (zielono-żółty) z wyciągarką.
export function tractorTop(g,x,y,h,travel=0,steer=0){
 orientedShadow(g,x,y,h,[[16,30,0]],15);
 drawRotated(g,x,y,h,s=>{
  const off=Math.round((((-travel)%5)+5)%5);
  const wheel=(cx,cy,w,hh,rot)=>{s.save();s.translate(cx,cy);if(rot)s.rotate(rot);rect(s,-w/2,-hh/2,w,hh,'#262f2c');for(let t=-hh/2+off-5;t<hh/2;t+=5){if(t<-hh/2||t+2>hh/2)continue;rect(s,-w/2,t,w,2,'#5f655a')}s.restore()};
  for(const side of [-1,1]){wheel(side*14,-16,8,15,steer*.5);wheel(side*14,14,10,24,0)}
  rect(s,-7,-31,14,28,'#3f5f30');rect(s,-6,-30,12,25,'#5a8a3e');rect(s,-5,-30,10,3,'#7aab52');
  rect(s,-10,-4,20,24,'#3f5f30');rect(s,-9,-3,18,22,'#d8b23a');rect(s,-7,-1,14,14,'#8fb0a8');rect(s,-5,1,10,3,'#c6d6c8');
  rect(s,-9,20,18,8,'#3a3a36');rect(s,-6,22,12,4,'#8a8a80');rect(s,-1,23,2,2,'#c7c2b2');   // wyciągarka
  rect(s,-9,-26,2,3,'#ffd06a');rect(s,7,-26,2,3,'#ffd06a');
 });
}
// Ciężarówka do drewna (kabina z dźwigiem).
export function truckTop(g,x,y,h,travel=0){
 orientedShadow(g,x,y,h,[[14,36,0]],16);
 drawRotated(g,x,y,h,s=>{
  wheels(s,[-12,12],[-22,10,22],6,11,travel);
  rect(s,-14,-36,28,22,'#3b2b26');rect(s,-13,-37,26,20,'#b8452f');rect(s,-13,-37,26,2,'#e07a5a');
  rect(s,-10,-33,20,6,'#5d8790');rect(s,-9,-32,18,2,'#a8c2c6');
  rect(s,-12,-15,24,50,'#2f3431');for(let k=-12;k<34;k+=12)rect(s,-13,k,26,3,'#4a4f4a');
  rect(s,-4,-15,8,8,'#d8b23a');rect(s,-2,-13,4,4,'#3a3a36');   // żuraw złożony
  rect(s,-11,-39,4,2,'#ecddb6');rect(s,7,-39,4,2,'#ecddb6');
 });
}
export function quadTop(g,x,y,h,travel=0,col='#c23a2b'){
 orientedShadow(g,x,y,h,[[7,11,0]],6);
 drawRotated(g,x,y,h,s=>{
  wheels(s,[-7,7],[-8,8],4,7,travel);
  rect(s,-5,-11,10,22,'#2a2a28');rect(s,-4,-11,8,20,col);rect(s,-6,-12,12,3,'#3a3a36');
  rect(s,-3,-3,6,6,'#3a4a5a');rect(s,-2,-5,4,4,'#202020');rect(s,-1,-4,2,1,'#9ab');   // kierowca w kasku
  rect(s,-6,-8,2,2,'#2a2a28');rect(s,4,-8,2,2,'#2a2a28');
 });
}
export function crossTop(g,x,y,h,travel=0){
 orientedShadow(g,x,y,h,[[3,11,0]],6);
 drawRotated(g,x,y,h,s=>{
  rect(s,-1,-12,3,6,'#202020');rect(s,-1,6,3,7,'#202020');
  rect(s,-2,-6,5,12,'#e0d84a');rect(s,-5,-8,11,2,'#2a2a28');
  rect(s,-4,-3,9,7,'#2f4a8a');rect(s,-3,-6,7,6,'#e8e4dc');rect(s,-2,-5,5,2,'#3a3a3a');
 });
}
export function bikeTop(g,x,y,h,phase=0,col='#4f6a8a'){
 orientedShadow(g,x,y,h,[[2,8,0]],5);
 drawRotated(g,x,y,h,s=>{
  rect(s,-1,-9,2,18,'#2a2f2d');rect(s,-1,-2,2,6,'#8a3b2e');rect(s,-4,-5,8,2,'#2f3431');
  rect(s,-3,-3,7,7,col);rect(s,-2,-8,4,4,'#d6a77f');rect(s,-2,-9,4,2,'#3a3a3a');
  rect(s,-4+Math.round(Math.sin(phase*8)),2,2,2,'#26211d');rect(s,3-Math.round(Math.sin(phase*8)),3,2,2,'#26211d');
 });
}
// Przyczepy: leśna (kłonice + drewno) i naczepa ciężarówki.
export function forestTrailer(g,c,load,cap){
 orientedShadow(g,c.x,c.y,c.angle,[[13,30,0]],10);
 drawRotated(g,c.x,c.y,c.angle,s=>{
  for(let i=0;i<=14;i++){const x=Math.round(i/14*5);rect(s,-x-1,-44+i,2,2,'#3a3a36');rect(s,x,-44+i,2,2,'#3a3a36')}
  for(const sd of [-1,1])rect(s,sd*14-3,4,6,16,'#262f2c');
  rect(s,-12,-30,24,60,'#3a3a36');rect(s,-10,-28,20,56,'#55594f');
  for(const yy of [-26,-8,10,26]){rect(s,-13,yy,3,4,'#d8b23a');rect(s,10,yy,3,4,'#d8b23a')}
  logLoad(s,load/cap,20,54);
 });
}
export function logTrailer(g,c,load,cap){
 orientedShadow(g,c.x,c.y,c.angle,[[13,40,0]],12);
 drawRotated(g,c.x,c.y,c.angle,s=>{
  rect(s,-1,-54,3,14,'#3a3a36');
  for(const yy of [14,26])for(const sd of [-1,1])rect(s,sd*12-3,yy-5,6,11,'#262f2c');
  rect(s,-11,-40,22,80,'#2f3431');for(const yy of [-34,-12,10,32]){rect(s,-13,yy,26,3,'#4a4f4a');rect(s,-13,yy-5,3,8,'#c8342b');rect(s,10,yy-5,3,8,'#c8342b')}
  logLoad(s,load/cap,20,76);
 });
}
// Pług leśny dwuodkładnicowy (LPz): rama z dwiema odkładnicami odkładającymi skiby na boki.
export function plowTop(g,c,working){
 orientedShadow(g,c.x,c.y,c.angle,[[13,11,0]],6);
 drawRotated(g,c.x,c.y,c.angle,s=>{
  for(let i=0;i<=10;i++){const x=Math.round(i/10*4);rect(s,-x-1,-23+i,2,2,'#3a3a36');rect(s,x,-23+i,2,2,'#3a3a36')}
  rect(s,-3,-13,6,24,'#2e3a44');rect(s,-2,-12,4,22,'#4a6a82');
  for(const sd of [-1,1]){rect(s,sd*4-(sd<0?8:0),-4,8,10,'#26303a');rect(s,sd*5-(sd<0?7:0),-3,7,8,'#8fa3b0');rect(s,sd*5-(sd<0?7:0),-3,7,2,'#c6d2d8')}
  rect(s,-1,8,2,5,'#26303a');
  if(working){rect(s,-12,9,24,3,'#5e4630');rect(s,-12,8,24,1,'#a08460')}
 });
}
// Forwarder: przednia część (kabina, silnik, dwa wózki kół) i tylna rama z kłonicami i żurawiem.
export function forwarderTop(g,x,y,h,travel=0,steer=0){
 orientedShadow(g,x,y,h,[[15,19,0]],15);
 drawRotated(g,x,y,h,s=>{
  wheels(s,[-13,13],[-11,9],7,13,travel);
  rect(s,-11,-20,22,36,'#2c3324');rect(s,-10,-19,20,34,'#7a8a3a');rect(s,-10,-19,20,2,'#a8b85a');
  rect(s,-8,-17,16,12,'#e4dfc8');rect(s,-7,-16,14,8,'#5d8790');rect(s,-6,-15,12,3,'#a8c2c6');   // kabina
  rect(s,-9,-2,18,14,'#5f6c2c');for(let k=0;k<4;k++)rect(s,-7,0+k*3,14,1,'#454f22');             // silnik
  rect(s,-4,14,8,5,'#2a2a26');rect(s,-2,15,4,3,'#6a6a62');                                         // przegub
  rect(s,-10,-21,3,2,'#ffd06a');rect(s,7,-21,3,2,'#ffd06a');
 });
}
export function bunkTop(g,c,load,cap){
 orientedShadow(g,c.x,c.y,c.angle,[[15,26,0]],12);
 drawRotated(g,c.x,c.y,c.angle,s=>{
  wheels(s,[-13,13],[-6,12],7,13,0);
  rect(s,-11,-26,22,52,'#2c3324');rect(s,-10,-25,20,50,'#5f6c2c');
  rect(s,-5,-27,10,8,'#3a3a36');rect(s,-3,-26,6,6,'#d8b23a');rect(s,-1,-24,2,2,'#2a2a26');      // podstawa żurawia
  for(const yy of [-14,0,14,24]){rect(s,-13,yy-3,3,6,'#d8b23a');rect(s,10,yy-3,3,6,'#d8b23a')}
  const n=Math.round(Math.min(1,load/cap)*8);
  for(let k=0;k<n;k++){const x=-9+(k%4)*4.5,y0=-16,L=40;rect(s,x,y0,4,L,'#6b4a2e');rect(s,x+1,y0,2,L,k%2?'#a8743f':'#b8844a');rect(s,x+1,y0,2,2,'#e3c08a');rect(s,x+1,y0+L-2,2,2,'#e3c08a')}
 });
}
function logLoad(s,f,w,len){
 const n=Math.round(Math.min(1,f)*7);
 for(let k=0;k<n;k++){const x=-w/2+1+(k%4)*5+(k>3?2:0),L=len-6;
  rect(s,x,-L/2,5,L,'#6b4a2e');rect(s,x+1,-L/2,3,L,k%2?'#a8743f':'#b8844a');rect(s,x+1,-L/2,3,2,'#e3c08a');rect(s,x+1,L/2-2,3,2,'#e3c08a')}
}

// ───────── ludzie (z góry, twarzą w prawo) ─────────
export const LOOKS={
 lesniczy:{coat:'#4a6a3e',cap:'#2f4a2c',skin:'#d9b08a'},
 worker:{coat:'#e07a1e',cap:'#e8c43a',skin:'#d6a77f',pants:'#2f3a46'},
 picker:{coat:'#8a6a4a',cap:'#c84a3a',skin:'#dcb08c'},
 walker:{coat:'#5a7aa0',cap:'#6b4a2e',skin:'#d9b08a'},
 hunter:{coat:'#556b3a',cap:'#3f4f2a',skin:'#d0a582'},
 driver:{coat:'#3a3a3a',cap:'#202020',skin:'#d6a77f'}
};
export function personTop(g,p){
 const x=p.x,y=p.y,L=p.look,step=Math.floor(p.step||0),pose=p.pose;
 blob(g,x,y,5,3,4);
 drawRotated(g,x,y,p.heading||0,s=>{
  const coat=p.coat||L.coat,cap=p.cap||L.cap;
  if(pose==='kneel'||pose==='pick'){
   rect(s,-4,-3,7,7,coat);rect(s,0,-2,4,4,cap);rect(s,3,-3,2,2,L.skin);rect(s,3,2,2,2,L.skin);
   if(p.prop==='basket')rect(s,-1,4,5,4,'#a8743f');
   if(p.prop==='sapling'&&pose==='kneel'){rect(s,5,-1,3,3,'#3f744c')}
   return;
  }
  if(!pose||pose==='walk'){const a=step%2?2:-2;rect(s,a-1,-3,4,2,L.pants||'#3a3f3a');rect(s,-a-1,1,4,2,L.pants||'#3a3f3a')}
  rect(s,-3,-4,6,8,coat);rect(s,-3,-4,1,8,'#ffffff22');
  rect(s,-2,-2,4,4,cap);rect(s,1,-1,1,2,L.skin);
  if(pose==='saw'){rect(s,2,-4,3,2,L.skin);rect(s,2,2,3,2,L.skin);rect(s,4,-2,6,4,'#e07a1e');rect(s,9,-1,6,2,'#9aa3a0')}
  else if(pose==='talk'){rect(s,2,3,4,2,L.skin);rect(s,5,2,3,3,'#f1e6c2')}
  else{rect(s,-1,-6,3,2,L.skin);rect(s,-1,4,3,2,L.skin)}
  if(p.prop==='basket'&&pose!=='saw')rect(s,-2,5,5,4,'#a8743f');
  if(p.prop==='rifle')rect(s,-5,-5,9,1,'#3a2e24');
  if(p.prop==='bag'){rect(s,-6,-1,3,4,'#d8d8d0')}
 });
}

// ───────── zwierzęta (głową w prawo) ─────────
export function roeTop(g,x,y,h,phase,running,buck){
 blob(g,x,y,9,3,4);
 drawRotated(g,x,y,h,s=>{
  rect(s,-6,-3,11,6,'#8d5f3e');rect(s,-5,-3,9,5,'#a8744b');rect(s,-3,-1,6,2,'#946446');
  rect(s,5,-2,5,4,'#b98557');rect(s,9,-1,2,2,'#4d3a2c');rect(s,5,-4,2,2,'#7a5a40');rect(s,5,3,2,2,'#7a5a40');
  rect(s,-8,-2,3,4,'#f0e2c4');
  if(buck){rect(s,6,-3,1,1,'#e8dcc0');rect(s,6,2,1,1,'#e8dcc0')}
  const st=Math.round(Math.sin(phase*(running?3.4:1.5))*2);
  rect(s,-4+st,-5,2,2,'#6e5239');rect(s,-4-st,4,2,2,'#6e5239');rect(s,3-st,-5,2,2,'#6e5239');rect(s,3+st,4,2,2,'#6e5239');
 });
}
export function deerTop(g,x,y,h,phase,running,stag){
 blob(g,x,y,14,5,6);
 drawRotated(g,x,y,h,s=>{
  rect(s,-11,-5,19,10,'#6b4630');rect(s,-10,-5,17,9,'#86583a');rect(s,-7,-2,11,3,'#7a4f34');
  rect(s,7,-3,7,6,'#946646');rect(s,13,-2,3,4,'#5a3f2c');rect(s,6,-5,3,2,'#5f4230');rect(s,6,4,3,2,'#5f4230');
  rect(s,-13,-3,4,6,'#e3d0a8');
  if(stag){for(const sd of [-1,1]){for(let k=0;k<6;k++)rect(s,7-k,sd*(4+k),1,1,'#e3d6b8');rect(s,4,sd*7,1,2,'#e3d6b8');rect(s,2,sd*9,1,2,'#e3d6b8')}}
  const st=Math.round(Math.sin(phase*(running?3:1.3))*2);
  rect(s,-8+st,-7,3,2,'#4f3424');rect(s,-8-st,6,3,2,'#4f3424');rect(s,4-st,-7,3,2,'#4f3424');rect(s,4+st,6,3,2,'#4f3424');
 });
}
export function boarTop(g,x,y,h,phase,running,piglet){
 const k=piglet?.55:1;blob(g,x,y,10*k,4*k,3);
 drawRotated(g,x,y,h,s=>{
  s.scale(k,k);
  rect(s,-10,-5,18,10,'#2e2722');rect(s,-9,-5,16,9,'#4a3d33');rect(s,-6,-5,10,2,'#5a4b3f');
  rect(s,7,-3,6,6,'#3f342c');rect(s,12,-2,3,4,'#6a5a50');rect(s,8,-5,2,2,'#2e2722');rect(s,8,3,2,2,'#2e2722');
  if(piglet){for(let i=-8;i<6;i+=3)rect(s,i,-4,2,8,'#c9a878')}
  rect(s,-12,-1+Math.round(Math.sin(phase*4)),3,2,'#2e2722');
  const st=Math.round(Math.sin(phase*(running?4:1.8))*2);
  rect(s,-6+st,-6,2,2,'#1f1a16');rect(s,-6-st,5,2,2,'#1f1a16');rect(s,4-st,-6,2,2,'#1f1a16');rect(s,4+st,5,2,2,'#1f1a16');
 });
}
export function foxTop(g,x,y,h,phase,running){
 blob(g,x,y,8,3,3);
 drawRotated(g,x,y,h,s=>{
  rect(s,-5,-2,9,4,'#c8662f');rect(s,-4,-1,6,2,'#d97a3a');
  rect(s,4,-2,5,4,'#d97a3a');rect(s,8,-1,3,2,'#f0e0c8');rect(s,5,-3,2,1,'#3a2a22');rect(s,5,2,2,1,'#3a2a22');
  const sw=Math.round(Math.sin(phase*(running?2:.7)));rect(s,-12,-1+sw,7,3,'#c8662f');rect(s,-13,-1+sw,2,3,'#f2ede0');
 });
}
export function wolfTop(g,x,y,h,phase,running){
 blob(g,x,y,11,4,4);
 drawRotated(g,x,y,h,s=>{
  rect(s,-8,-3,15,7,'#5c5a54');rect(s,-7,-3,13,6,'#7c7a72');rect(s,-5,-3,9,2,'#4a4844');
  rect(s,7,-3,5,6,'#8a877e');rect(s,11,-1,3,3,'#a8a59a');rect(s,13,0,1,1,'#202020');rect(s,8,-4,2,2,'#4a4844');rect(s,8,3,2,2,'#4a4844');
  const sw=Math.round(Math.sin(phase*(running?2.6:.8)));rect(s,-14,-1+sw,7,3,'#6a685f');rect(s,-15,0+sw,2,2,'#3a3934');
  const st=Math.round(Math.sin(phase*(running?3.6:1.6))*2);
  rect(s,-5+st,-5,2,2,'#3a3934');rect(s,-5-st,4,2,2,'#3a3934');rect(s,4-st,-5,2,2,'#3a3934');rect(s,4+st,4,2,2,'#3a3934');
 });
}
export function hareTop(g,x,y,h,phase,running){
 blob(g,x,y,5,2,2);
 drawRotated(g,x,y,h,s=>{
  rect(s,-4,-2,7,5,'#9a8466');rect(s,-3,-2,5,4,'#b09878');rect(s,3,-1,3,3,'#a89070');rect(s,1,-3,4,1,'#8a7458');rect(s,1,2,4,1,'#8a7458');rect(s,-5,0,2,2,'#efe8dc');
 });
}
export function dogTop(g,x,y,h,phase,col='#7a5a3a',col2='#3a2e26'){
 blob(g,x,y,7,3,3);
 drawRotated(g,x,y,h,s=>{rect(s,-5,-2,10,4,col);rect(s,-4,-2,5,3,col2);rect(s,5,-2,4,4,col);rect(s,8,-1,2,2,'#2f2a26');rect(s,5,-3,2,1,col2);rect(s,5,2,2,1,col2);rect(s,-8,-1+Math.round(Math.sin(phase*6)),4,1,col)});
}
export function birds(g,t,camera,VIEW){
 for(let i=0;i<9;i++){
  const cycle=(t*.67+i*83)%560,bx=(i%2?2500-cycle*4.4:cycle*4.4-100),by=120+((i*173)%1500)+Math.sin(t*.9+i)*6;
  if(bx<camera.x-10||bx>camera.x+VIEW.w+10||by<camera.y-10||by>camera.y+VIEW.h+10)continue;
  const flap=Math.sin(t*6.5+i*3)>.15?-2:2;line(g,bx-5,by+flap,bx,by,'#38463c',1);line(g,bx,by,bx+5,by+flap,'#38463c',1);
 }
}
// Kłody (stos przy pniu): równoległe wałki z jasnymi czołami.
export function pileTop(g,p){
 const n=p.logs;
 g.save();g.translate(Math.round(p.x),Math.round(p.y));g.rotate(p.a);
 g.fillStyle='#2b3b2a40';g.fillRect(3,3,30,n*5+2);
 for(let k=0;k<n;k++){const y=-n*2.5+k*5;rect(g,-15,y,30,5,'#4a3624');rect(g,-15,y+1,30,3,p.bark||'#9a6a40');rect(g,-15,y,2,5,'#e3c08a');rect(g,13,y,2,5,'#d8b47c')}
 g.restore();
}
