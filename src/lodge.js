// Zabudowa leśniczówki (0.7.2, styl A: murowana gajówka) na osobnej warstwie — wariant letni i zimowy.
// Warstwa jest rysowana PO zimowej mgiełce, więc dachy mają śnieg, a nie biały welon.
import {rect,line,poly,shadow} from './core.js';
import {mk,outlinedDraw,text3} from './sprite.js';
import {HOUSE,CARPORT,GARAGE,WOODSHED,KENNEL,WELL,PLAC,DOOR,LDY,FENCES} from './map.js';
import {fence} from './paint.js';

export const LODGE_BOX={x:120,y:1230,w:700,h:360};
const DARK='#2a3328';
const PAL={
 summer:{r1:'#b5543a',r2:'#9a4630',r3:'#a84e36',rg:'#d98a62',rl:'#00000026',m1:'#7d8480',m2:'#686f6b',m3:'#8f9692',mg:'#b4bbb6',w1:'#8a6a4a',w2:'#6e5238',wg:'#a98458'},
 winter:{r1:'#eef3f7',r2:'#d3dfe9',r3:'#e1eaf1',rg:'#ffffff',rl:'#8da0b422',m1:'#eef3f7',m2:'#d3dfe9',m3:'#e1eaf1',mg:'#ffffff',w1:'#eef3f7',w2:'#d3dfe9',wg:'#ffffff'}
};
// czterospadowy dach; (x,y,w,h) — obrys okapu
function hip(c,x,y,w,h,k1,k2,k3,rg,rl,eave){
 shadow(c,x,y,w,h+4,34);
 rect(c,x-1,y+h-1,w+2,5,eave);                       // cień pod okapem
 const m=Math.min(w,h)/2;
 poly(c,[[x,y],[x+w,y],[x+w-m,y+m],[x+m,y+m]],k1);   // połać północna (jasna)
 poly(c,[[x+m,y+m],[x+w-m,y+m],[x+w,y+h],[x,y+h]],k2);// połać południowa
 poly(c,[[x,y],[x+m,y+m],[x,y+h]],k3);poly(c,[[x+w,y],[x+w-m,y+m],[x+w,y+h]],k3);
 line(c,x+m,y+m,x+w-m,y+m,rg,2);
 for(let yy=y+4;yy<y+m;yy+=5)line(c,x+Math.min(m,(yy-y))+1,yy,x+w-Math.min(m,(yy-y))-1,yy,rl,1);
 for(let yy=y+m+5;yy<y+h-1;yy+=5)line(c,x+2,yy,x+w-2,yy,rl,1);
 for(const [a,b,d,e] of [[x,y,x+w,y],[x,y+h,x+w,y+h],[x,y,x,y+h],[x+w,y,x+w,y+h]])line(c,a,b,d,e,'#00000040',1);
}
function house(c,P,win){
 const H=HOUSE,bx=H.x,by=H.y,fy=by+H.h;
 // ściana południowa (widoczny pas elewacji): tynk, cokół z cegły, okna z okiennicami, drzwi
 rect(c,bx+3,fy,H.w-6,11,'#ece6d6');rect(c,bx+3,fy,H.w-6,2,'#b9b19c');rect(c,bx+3,fy+9,H.w-6,2,'#8a5a48');
 for(const dx of [14,42,106,134]){rect(c,bx+dx-1,fy+2,14,7,'#f6f3ea');rect(c,bx+dx,fy+3,12,5,'#6f95a6');rect(c,bx+dx+5,fy+3,2,5,'#f6f3ea');rect(c,bx+dx-4,fy+2,3,7,'#3f6a4a');rect(c,bx+dx+13,fy+2,3,7,'#3f6a4a')}
 const dx=DOOR[0];rect(c,dx-5,fy+1,10,9,'#5a3a28');rect(c,dx-4,fy+2,8,8,'#7a4e34');rect(c,dx+2,fy+6,1,1,'#d8b060');
 if(!win){for(const dd of [14,42,106,134]){rect(c,bx+dd-2,fy+10,16,3,'#5d7f3c');for(let k=0;k<5;k++)rect(c,bx+dd+k*3,fy+10,2,2,k%2?'#e0708f':'#f2d24a')}}
 else{rect(c,bx+3,fy+10,H.w-6,3,'#f2f6fa')}
 // dach, komin, lukarna
 hip(c,bx,by,H.w,H.h,P.r1,P.r2,P.r3,P.rg,P.rl,'#5d4c3c');
 rect(c,bx+112,by+16,15,15,'#6a2f22');rect(c,bx+113,by+17,13,13,'#9a5340');rect(c,bx+111,by+14,17,3,win?'#f2f6fa':'#6d6a64');rect(c,bx+116,by+20,5,5,'#2e2a28');
 poly(c,[[bx+24,by+H.h-30],[bx+58,by+H.h-30],[bx+58,by+H.h-8],[bx+24,by+H.h-8]],P.r1);
 rect(c,bx+27,by+H.h-24,28,14,'#e6e0d0');rect(c,bx+30,by+H.h-22,22,9,'#6f95a6');rect(c,bx+40,by+H.h-22,2,9,'#f6f3ea');
 poly(c,[[bx+22,by+H.h-8],[bx+60,by+H.h-8],[bx+57,by+H.h-32],[bx+25,by+H.h-32]],P.r2);
 line(c,bx+25,by+H.h-32,bx+57,by+H.h-32,P.rg,2);
 // daszek nad wejściem, słupki
 rect(c,dx-15,fy+8,30,6,win?'#e1eaf1':'#a84e36');rect(c,dx-15,fy+13,30,2,'#00000030');rect(c,dx-14,fy+9,28,1,P.rg);
 rect(c,dx-14,fy+3,2,11,'#7a5a42');rect(c,dx+12,fy+3,2,11,'#7a5a42');
 rect(c,dx-12,fy+15,24,3,win?'#dfe6ea':'#b9b19c');
}
function carport(c,P,win){
 const C=CARPORT,fy=C.y+C.h;
 for(const px of [C.x+2,C.x+C.w/2-1,C.x+C.w-4]){rect(c,px,fy-2,3,9,'#6b563d');rect(c,px+3,fy+5,3,2,'#00000030')}
 rect(c,C.x,fy-1,C.w,3,'#00000040');
 shadow(c,C.x,C.y,C.w,C.h,30);
 rect(c,C.x-2,C.y-2,C.w+4,C.h+4,P.m2);rect(c,C.x,C.y,C.w,C.h,P.m1);
 for(let x=C.x+6;x<C.x+C.w;x+=8)line(c,x,C.y,x,C.y+C.h,P.m3,1);
 rect(c,C.x-2,C.y+C.h,C.w+4,2,P.mg);
 // panele fotowoltaiczne
 for(let r=0;r<2;r++)for(let k=0;k<4;k++){const x=C.x+8+k*25,y=C.y+8+r*30;
  if(win&&(r+k)%2){rect(c,x,y,23,27,'#e6edf3');continue}
  rect(c,x-1,y-1,25,29,'#20344b');rect(c,x,y,23,27,win?'#4a6a8c':'#2d4c74');
  for(let i=1;i<3;i++)line(c,x+i*7.7,y,x+i*7.7,y+27,'#6f93bd',1);for(let j=1;j<4;j++)line(c,x,y+j*6.7,x+23,y+j*6.7,'#6f93bd',1);
  rect(c,x,y,23,1,'#9bb9d8')}
}
function woodshed(c,P,win){
 const W=WOODSHED;
 shadow(c,W.x,W.y,W.w,W.h,22);rect(c,W.x,W.y,W.w,W.h,'#4a3a2a');
 // z przodu otwarta część z klepką polan, z tyłu dach z gontu
 rect(c,W.x+2,W.y+40,W.w-4,W.h-42,'#33281d');
 for(let r=0;r<3;r++)for(let k=0;k<7;k++){const px=W.x+6+k*9,py=W.y+43+r*9;rect(c,px,py,8,8,'#4a3a2a');rect(c,px+1,py+1,6,6,'#c9a473');rect(c,px+3,py+3,2,2,'#9a7a50')}
 poly(c,[[W.x-2,W.y-2],[W.x+W.w+2,W.y-2],[W.x+W.w+2,W.y+40],[W.x-2,W.y+40]],P.w2);
 poly(c,[[W.x-2,W.y-2],[W.x+W.w+2,W.y-2],[W.x+W.w+2,W.y+18],[W.x-2,W.y+18]],P.w1);
 for(let y=W.y+3;y<W.y+40;y+=5)line(c,W.x-1,y,W.x+W.w+1,y,'#00000030',1);
 line(c,W.x-2,W.y+18,W.x+W.w+2,W.y+18,P.wg,2);rect(c,W.x-2,W.y+40,W.w+4,2,'#00000040');
}
function small(c,P,win){
 const K=KENNEL;shadow(c,K.x,K.y,K.w,K.h,10);rect(c,K.x-1,K.y-1,K.w+2,K.h+2,'#5d4a36');
 rect(c,K.x,K.y,K.w,K.h/2,P.w1);rect(c,K.x,K.y+K.h/2,K.w,K.h/2,P.w2);line(c,K.x,K.y+K.h/2,K.x+K.w,K.y+K.h/2,P.wg,1);rect(c,K.x+K.w/2-3,K.y+K.h-1,6,3,'#1e1814');
 // studnia z daszkiem
 const wl=WELL;c.fillStyle='#4f4a44';c.beginPath();c.arc(wl.x,wl.y,10,0,6.28);c.fill();c.fillStyle='#8f8a80';c.beginPath();c.arc(wl.x,wl.y,8,0,6.28);c.fill();
 c.fillStyle=win?'#cfd9e0':'#2c3a3d';c.beginPath();c.arc(wl.x,wl.y,5,0,6.28);c.fill();
 rect(c,wl.x-12,wl.y-1,3,10,'#6b4a30');rect(c,wl.x+9,wl.y-1,3,10,'#6b4a30');
 poly(c,[[wl.x-14,wl.y-3],[wl.x+14,wl.y-3],[wl.x+12,wl.y-14],[wl.x-12,wl.y-14]],win?P.r1:'#7a5a40');line(c,wl.x-13,wl.y-3,wl.x+13,wl.y-3,'#00000040',1);line(c,wl.x-12,wl.y-14,wl.x+12,wl.y-14,P.wg,1);
 // ławka i słup oświetleniowy na placu
 rect(c,232,1504,26,6,'#7a5a3e');rect(c,232,1504,26,2,win?'#f2f6fa':'#a07a52');rect(c,234,1510,2,3,'#4a3a2a');rect(c,254,1510,2,3,'#4a3a2a');
 const S=PLAC;for(const [lx,ly] of [[S.x+12,S.y+8],[S.x+S.w-12,S.y+8]]){rect(c,lx+3,ly+5,5,3,'#00000035');rect(c,lx-1,ly-24,2,30,'#4a4f52');rect(c,lx-5,ly-26,10,3,'#6d7478');rect(c,lx-4,ly-24,8,1,'#f2e29a')}
}
function signs(c,win){
 outlinedDraw(c,690,256+LDY,G=>{rect(G,-14,-4,2,10,'#55524a');rect(G,12,-4,2,10,'#55524a');rect(G,-22,-16,44,13,'#2f5a3a');rect(G,-21,-15,42,11,'#3e7048');rect(G,-21,-15,42,1,'#6aa070');text3(G,'LEŚNICTWO',-18,-12,'#f1e6c2');if(win)rect(G,-22,-17,44,2,'#f2f6fa')},DARK);
}
function yard(c,win){
 for(const f of FENCES){fence(f,c);if(win){const hor=f.y1===f.y2;if(hor)line(c,Math.min(f.x1,f.x2),f.y1-1,Math.max(f.x1,f.x2),f.y1-1,'#eef3f7',1);else line(c,f.x1-1,Math.min(f.y1,f.y2),f.x1-1,Math.max(f.y1,f.y2),'#eef3f7',1)}}
 const S=PLAC;outlinedDraw(c,S.x+14,S.y+S.h-6,G=>{rect(G,-1,-4,2,10,'#55524a');rect(G,-12,-14,24,10,'#2f5a3a');rect(G,-11,-13,22,8,'#3e7048');text3(G,'PLAC',-8,-12,'#f1e6c2');if(win)rect(G,-12,-15,24,2,'#f2f6fa')},DARK);
}
// magazyn (kupowany): hala murowana z blaszanym dachem i dwiema bramami rolowanymi, obok wiaty
export function drawGarage(c,win){
 const G=GARAGE,P=win?PAL.winter:PAL.summer,fy=G.y+G.h;
 shadow(c,G.x,G.y,G.w,G.h+10,32);
 rect(c,G.x+2,fy,G.w-4,12,'#d9d3c2');rect(c,G.x+2,fy,G.w-4,2,'#9d968a');rect(c,G.x+2,fy+10,G.w-4,2,'#8a5a48');
 for(const dx of [10,60]){rect(c,G.x+dx-1,fy+1,42,10,'#6d7470');rect(c,G.x+dx,fy+2,40,9,'#9aa29d');for(let y=fy+3;y<fy+11;y+=2)rect(c,G.x+dx,y,40,1,'#7d8480')}
 hip(c,G.x,G.y,G.w,G.h,P.m1,P.m2,P.m3,P.mg,P.rl,'#4d4a46');
 for(let x=G.x+8;x<G.x+G.w-6;x+=9)line(c,x,G.y+3,x,G.y+G.h-3,P.rl,1);
 outlinedDraw(c,G.x+G.w/2,G.y+G.h/2+4,H=>{rect(H,-17,-5,34,10,'#2f5a3a');rect(H,-16,-4,32,8,'#3e7048');text3(H,'MAGAZYN',-14,-3,'#f1e6c2')},DARK);
}
function build(win){
 const [cv,c]=mk(LODGE_BOX.w,LODGE_BOX.h),P=win?PAL.winter:PAL.summer;
 c.translate(-LODGE_BOX.x,-LODGE_BOX.y);
 woodshed(c,P,win);small(c,P,win);house(c,P,win);carport(c,P,win);signs(c,win);yard(c,win);
 return cv;
}
let sum=null,win=null;
export function drawLodge(ctx,winter){
 const cv=winter?(win||(win=build(true))):(sum||(sum=build(false)));
 ctx.drawImage(cv,LODGE_BOX.x,LODGE_BOX.y);
}

// 0.8.1: skrzynka pocztowa przy bramie — flaga w górze, gdy w poczcie są nieprzeczytane listy. Rysowana na bieżąco (nie jest w buforze).
export const MAILBOX={x:700,y:1452};
export function drawMailbox(c,unread,winter){
 const {x,y}=MAILBOX;
 rect(c,x-6,y-3,13,4,'#40564255');
 rect(c,x-1,y-14,3,16,'#6b4a2e');rect(c,x,y-14,1,16,'#8a6a46');
 rect(c,x-7,y-24,15,10,'#14201a');rect(c,x-6,y-23,13,9,'#2f5f9a');rect(c,x-6,y-23,13,2,'#4b7fbf');rect(c,x-6,y-16,13,2,'#244a78');
 rect(c,x-4,y-19,9,1,'#0f2238');   // szczelina na listy
 if(winter){rect(c,x-8,y-26,17,3,'#eef3f8');rect(c,x-7,y-24,15,1,'#c9d4e0')}
 if(unread){rect(c,x+8,y-30,1,10,'#6b4a2e');rect(c,x+9,y-30,6,4,'#d8402f');rect(c,x+9,y-30,6,1,'#f06a55');rect(c,x-3,y-22,6,4,'#f1e6c2')}   // flaga i list w szczelinie
 else rect(c,x+8,y-20,5,1,'#8a2f25');
}
