// Pomocnicze rysowanie sprite'ów (wydzielone z vehicles.js i world.js farmy):
// obracanie bez wygładzania z obrysem 1 px, rysowanie z obrysem w miejscu, cienie, utwardzanie krawędzi.
import {LIGHT} from './core.js';
export const mk=(w,h,read=false)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',read?{willReadFrequently:true}:undefined);g.imageSmoothingEnabled=false;return[c,g]};
const S=220,[scratch,sg]=mk(S,S),[scratch2,sg2]=mk(S,S);
function outlineInto(col){
 sg2.setTransform(1,0,0,1,0,0);sg2.clearRect(0,0,S,S);
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])sg2.drawImage(scratch,dx,dy);
 sg2.globalCompositeOperation='source-in';sg2.fillStyle=col;sg2.fillRect(0,0,S,S);sg2.globalCompositeOperation='source-over';
 sg2.drawImage(scratch,0,0);
}
function prep(draw){sg.setTransform(1,0,0,1,0,0);sg.clearRect(0,0,S,S);sg.save();sg.translate(S/2,S/2);draw(sg);sg.restore()}
// Sprite rysowany w lokalnym układzie (pojazdy: przód do góry; zwierzęta: głowa w prawo), potem obracany ostro.
export function drawRotated(g,x,y,angle,draw,outline=true,col='#1d2b24'){
 prep(draw);let src=scratch;if(outline){outlineInto(col);src=scratch2}
 g.save();g.imageSmoothingEnabled=false;g.translate(Math.round(x),Math.round(y));if(angle)g.rotate(angle);g.drawImage(src,-S/2,-S/2);g.restore();
}
// Bez obrotu: obiekt z obrysem rysowany w miejscu (drzewa, krzewy, rekwizyty).
export function outlinedDraw(dst,x,y,draw,col='#1f3027'){
 prep(draw);outlineInto(col);dst.drawImage(scratch2,Math.round(x)-S/2,Math.round(y)-S/2);
}
export function blob(g,x,y,rx,ry,h,col='#2c3f2a55'){g.fillStyle=col;g.beginPath();g.ellipse(Math.round(x+LIGHT.x*h),Math.round(y+LIGHT.y*h),rx,ry,Math.atan2(LIGHT.y,LIGHT.x),0,Math.PI*2);g.fill()}
// Cień pojazdu w układzie świata: otoczka wypukła prostokątów i ich przesunięć o LIGHT*h.
export function orientedShadow(g,x,y,ang,boxes,h,col='#2a3b2848'){
 const c=Math.cos(ang),s=Math.sin(ang),dx=LIGHT.x*h,dy=LIGHT.y*h,pts=[];
 for(const [hw,hh,cy] of boxes)for(const [lx,ly] of [[-hw,cy-hh],[hw,cy-hh],[hw,cy+hh],[-hw,cy+hh]]){
  const px=x+c*lx-s*ly,py=y+s*lx+c*ly;pts.push([px,py],[px+dx,py+dy]);
 }
 pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[],up=[];
 for(const p of pts){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
 for(const p of pts.slice().reverse()){while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
 const hull=lo.slice(0,-1).concat(up.slice(0,-1));
 g.fillStyle=col;g.beginPath();hull.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();
}
// Progowanie alfa: ostre, pikselowe krawędzie po rysowaniu ścieżkami. soft = zostaw półprzezroczyste cienie.
export function crispAlpha(cv,soft=false){
 const c=cv.getContext('2d'),im=c.getImageData(0,0,cv.width,cv.height),d=im.data;
 for(let i=3;i<d.length;i+=4)d[i]=soft?(d[i]>=140?255:d[i]<24?0:d[i]):(d[i]<128?0:255);
 c.putImageData(im,0,0);
}
// Mikro-czcionka 3×5 (cyfry i kilka liter) do słupków oddziałowych i tablic.
const GL={0:'111101101101111',1:'010110010010111',2:'111001111100111',3:'111001111001111',4:'101101111001001',5:'111100111001111',6:'111100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001111',
 L:'100100100100111',E:'111100111100111',S:'111100111001111',N:'101111111111101',I:'111010010010111',C:'111100100100111',T:'111010010010010',W:'101101111111101',O:'111101101101111',Z:'111001010100111',G:'111100101101111',A:'010101111101101',J:'001001001101111',Ś:'111100111001111',Ń:'101111111111101',Ę:'111100111100111',R:'110101110101101',K:'101110100110101',Y:'101101010010010',D:'110101101101110',Ł:'100110100100111',U:'101101101101111',P:'111101111100100',H:'101101111101101',M:'101111111101101',B:'110101110101110',F:'111100110100100',Ó:'010111101101111',Ż:'010111001010111',' ':'000000000000000'};
export function text3(g,txt,x,y,col){g.fillStyle=col;let px=Math.round(x);for(const ch of txt){const gl=GL[ch]||GL[' '];for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(gl[r*3+c]==='1')g.fillRect(px+c,Math.round(y)+r,1,1);px+=4}}
