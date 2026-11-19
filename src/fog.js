// Poranna mgła (1.5.1).
// Kiedy: pogodne, chłodne poranki — wiosną i jesienią często, latem rzadko, zimą wcale; nie przy deszczu, wichurze ani suszy.
// Przebieg: zbiera się przed świtem, najgęstsza około wschodu słońca, w ciągu 1–2 godzin po nim znika.
// Gdzie: najgęstsza nad mokradłami i strumieniem, lżejsza nad polaną i drogami, nad zwartym lasem tylko lekki welon.
// Jak: mapa gęstości liczona raz na mglisty dzień (komórki 16 px), co klatkę tylko mały bufor widoku (1 px = 8 px świata)
// mnożony przez dwie warstwy szumu, które powoli dryfują z wiatrem; na ekran trafia rozmyty (wygładzony), bez twardych krawędzi.
import {state,cal,camera,VIEW,WORLD,hash,clamp} from './core.js';
import {WETLANDS,POLANA,streamDist} from './map.js';
import {treesIn,STAND} from './forest.js';
import {HL} from './health.js';

const CELL=16,GW=Math.ceil(WORLD.w/CELL),GH=Math.ceil(WORLD.h/CELL),BS=8;   // BS: piksele świata na piksel bufora
const P_SEASON=[.5,.18,.55,0];   // szansa na mglisty poranek: wiosna, lato, jesień, zima
const DAWN=[6,5,6.5,7.5];        // przybliżony wschód słońca w danej porze roku
export const FOG={day:-1,on:false,k:0,dir:0,mapDay:-99};
let base=null,noiseA=null,noiseB=null,buf=null;

const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function density(x,y){
 let w=0;
 for(const W of WETLANDS){const d=Math.sqrt(((x-W.x)/(W.rx+110))**2+((y-W.y)/(W.ry+80))**2);w=Math.max(w,1-sm(.45,1,d))}
 w=Math.max(w,.85*(1-sm(8,70,streamDist(x,y))));
 w=Math.max(w,.45*(1-sm(.55,1.2,Math.hypot(x-POLANA.x,y-POLANA.y)/POLANA.r)));
 let n=0;for(const t of treesIn(x-18,y-18,x+18,y+18))if(t.st===STAND&&++n>=4)break;
 const open=1-n/4;
 return clamp(w*(.5+.5*open)+.16*open+.05,0,1);
}
function buildMap(){
 if(!base){base=document.createElement('canvas');base.width=GW;base.height=GH}
 const g=base.getContext('2d'),img=g.createImageData(GW,GH),D=img.data;
 for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=(j*GW+i)*4,d=density(i*CELL+CELL/2,j*CELL+CELL/2);D[k]=228;D[k+1]=233;D[k+2]=236;D[k+3]=Math.round(d*255)}
 // rozmycie mapy gęstości (ok. 40–50 px świata) — bez schodków na granicy lasu, polany i wody
 const raw=document.createElement('canvas');raw.width=GW;raw.height=GH;raw.getContext('2d').putImageData(img,0,0);
 g.clearRect(0,0,GW,GH);g.filter='blur(2.6px)';g.drawImage(raw,0,0);g.filter='none';
}
// szum wartości, kafelkowalny (64×64), alfa w zakresie [lo,1]
function noise(seed,lat,lo){
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),img=g.createImageData(64,64),D=img.data;
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let a=0,amp=1,tot=0;
  for(const L of [lat,lat*2]){const fx=x/64*L,fy=y/64*L,i=Math.floor(fx),j=Math.floor(fy),u=sm(0,1,fx-i),w=sm(0,1,fy-j);
   const q=(ii,jj)=>hash(((ii%L)+L)%L,((jj%L)+L)%L,seed+L);
   a+=amp*((q(i,j)*(1-u)+q(i+1,j)*u)*(1-w)+(q(i,j+1)*(1-u)+q(i+1,j+1)*u)*w);tot+=amp;amp*=.5}
  const k=(y*64+x)*4;D[k]=D[k+1]=D[k+2]=255;D[k+3]=Math.round((lo+(1-lo)*a/tot)*255)}
 g.putImageData(img,0,0);return c;
}
export function updateFog(dt){
 const d=Math.floor(state.days),h=cal.hour(),se=cal.season();
 if(d!==FOG.day&&h>=2.5){FOG.day=d;FOG.on=HL.dry<.6&&hash(d,7,3)<P_SEASON[se];FOG.dir=hash(d,7,4)*6.283}
 let target=0;
 if(FOG.on&&HL.wx==='clear'){const sr=DAWN[se];target=sm(sr-3,sr-.6,h)*(1-sm(sr+.6,sr+2,h))}
 FOG.k+=(target-FOG.k)*Math.min(1,dt/45);if(FOG.k<.002&&target===0)FOG.k=0;
 if(FOG.k>0&&FOG.mapDay!==d){FOG.mapDay=d;buildMap()}
}
export function drawFog(g){
 if(FOG.k<=.004||!base)return;
 if(!noiseA){noiseA=noise(11,4,.5);noiseB=noise(29,3,.68)}
 const x0=Math.floor(camera.x/BS)*BS-BS*2,y0=Math.floor(camera.y/BS)*BS-BS*2,bw=Math.ceil(VIEW.w/BS)+5,bh=Math.ceil(VIEW.h/BS)+5;
 if(!buf){buf=document.createElement('canvas')}
 if(buf.width!==bw||buf.height!==bh){buf.width=bw;buf.height=bh}
 const b=buf.getContext('2d');b.imageSmoothingEnabled=true;
 b.globalCompositeOperation='copy';b.drawImage(base,x0/CELL,y0/CELL,bw*BS/CELL,bh*BS/CELL,0,0,bw,bh);
 // dwie warstwy szumu dryfują z wiatrem z różną prędkością — mgła „płynie” i zmienia kształt
 const t=state.elapsed,cx=Math.cos(FOG.dir),cy=Math.sin(FOG.dir);
 // (jedno wypełnienie wzorem na warstwę — „destination-in” czyści wszystko poza rysowanym obszarem, więc nie kafelkujemy drawImage)
 b.globalCompositeOperation='destination-in';
 for(const [N,tile,sp] of [[noiseA,720,3.2],[noiseB,480,-1.9]]){const T=tile/BS,ox=(-(x0+t*sp*cx))/BS,oy=(-(y0+t*sp*cy))/BS;
  const pat=b.createPattern(N,'repeat');pat.setTransform(new DOMMatrix().translate(ox%T,oy%T).scale(T/64));b.fillStyle=pat;b.fillRect(0,0,bw,bh)}
 b.globalCompositeOperation='source-over';
 g.save();g.imageSmoothingEnabled=true;g.globalAlpha=Math.min(1,FOG.k*.95);g.drawImage(buf,0,0,bw,bh,x0,y0,bw*BS,bh*BS);g.restore();
}
