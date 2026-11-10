// Kolejność warstw: podłoże → las (cienie, pnie, sadzonki) → przedmioty na ziemi → zwierzęta, ludzie, pojazdy →
// korony → „prześwit” postaci pod koronami → padające drzewa, dym, znaczniki → noc i światła.
import {ctx,VIEW,camera,state,fx,clamp,cal,DEBUG,rect,SETTINGS,RT,LIGHT} from './core.js';
import {ground,markChunks,drawAmbona} from './paint.js';
import {drawForest,trees,crownR,paintCrown,SP,STAND} from './forest.js';
import {outlinedDraw} from './sprite.js';
import {E} from './ents.js';
import {drawGroundItems,drawRopes,J} from './jobs.js';
import {drawBase} from './base.js';
import {drawFeeders} from './life/fauna.js';
import {birds} from './life/sprites.js';
import {NODES,EDGES,YARD,HOUSE} from './map.js';
import {drawPlots,drawFences} from './renew.js';

const vis=(x,y,r=60)=>x>camera.x-r&&x<camera.x+VIEW.w+r&&y>camera.y-r&&y<camera.y+VIEW.h+r;
function blitGround(cv=ground){
 const cx=Math.floor(camera.x),cy=Math.floor(camera.y),sx=Math.max(0,cx),sy=Math.max(0,cy),ex=Math.min(cv.width,cx+VIEW.w),ey=Math.min(cv.height,cy+VIEW.h);
 if(ex>sx&&ey>sy)ctx.drawImage(cv,sx,sy,ex-sx,ey-sy,sx,sy,ex-sx,ey-sy);
}
function blitMarks(){for(const c of markChunks)if(c&&vis(c.x+128,c.y+128,190))ctx.drawImage(c.cv,c.x,c.y)}
function drawTrash(){
 for(const t of E.trash){if(t.dead||t.fire||!vis(t.x,t.y))continue;const x=Math.round(t.x),y=Math.round(t.y);
  if(t.kind==='bag'){rect(ctx,x-4,y-3,9,7,'#20262a');rect(ctx,x-3,y-3,7,6,'#3a4248');rect(ctx,x-1,y-5,3,2,'#3a4248');rect(ctx,x-2,y-2,2,1,'#6a747a')}
  else if(t.kind==='tire'){ctx.fillStyle='#1e1e1e';ctx.beginPath();ctx.arc(x,y,6,0,6.28);ctx.fill();ctx.fillStyle='#55594f';ctx.beginPath();ctx.arc(x,y,3,0,6.28);ctx.fill()}
  else if(t.kind==='snare'){ctx.strokeStyle='#a8b0ae';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x+.5,y+.5,4,0,6.28);ctx.stroke();rect(ctx,x+4,y-1,4,2,'#6b563d');rect(ctx,x-1,y-1,2,2,'#cfd6d4')}
  else{for(let k=0;k<4;k++){rect(ctx,x-6+k*4,y-2+(k%2)*3,2,4,k%2?'#4a8a5a':'#c8d8d0');rect(ctx,x-6+k*4,y-3+(k%2)*3,2,1,'#e8e4dc')}rect(ctx,x+5,y+2,5,3,'#d8d0b8')}
 }
 for(const b of (E.burns||[])){if(!vis(b.x,b.y,90))continue;ctx.globalAlpha=.55;ctx.fillStyle='#1c1a16';ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*.8,.3,0,6.28);ctx.fill();ctx.globalAlpha=1}
}
function drawLying(){
 for(const t of trees){if(!t.lying&&!t.falling)continue;if(!vis(t.x,t.y,200))continue;
  if(t.lying){const L=t.lying,x2=t.x+Math.cos(L.dir)*L.L,y2=t.y+Math.sin(L.dir)*L.L,w=clamp(L.r*.22,3,7);
   ctx.lineCap='butt';ctx.strokeStyle='#2b241c';ctx.lineWidth=w+2;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(x2,y2);ctx.stroke();
   ctx.strokeStyle=SP[t.sp].bark[t.sp==='brzoza'?0:1];ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(x2,y2);ctx.stroke();
   const cx=t.x+Math.cos(L.dir)*L.L*.8,cy=t.y+Math.sin(L.dir)*L.L*.8;
   ctx.save();ctx.translate(cx,cy);ctx.scale(1,.75);ctx.translate(-cx,-cy);outlinedDraw(ctx,cx,cy,G=>paintCrown(G,t,cal.season(),.75),'#1a2a20');ctx.restore();}
 }
}
function drawFalling(){
 for(const t of trees){if(!t.falling||!vis(t.x,t.y,220))continue;
  const F=t.falling,p=F.p*F.p,th=p*Math.PI/2,d=F.L*Math.sin(th),cx=t.x+Math.cos(F.dir)*d,cy=t.y+Math.sin(F.dir)*d,w=clamp(F.r*.22,3,7);
  ctx.strokeStyle='#2b241c';ctx.lineWidth=w+2;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(cx,cy);ctx.stroke();
  ctx.strokeStyle=SP[t.sp].bark[t.sp==='brzoza'?0:1];ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(cx,cy);ctx.stroke();
  outlinedDraw(ctx,cx,cy,G=>paintCrown(G,t,cal.season(),1-.2*p),'#1a2a20');
 }
}
function drawParticles(){
 for(const p of fx){const k=clamp(p.life/p.max,0,1);
  if(p.type==='smoke'){ctx.globalAlpha=k*.5;ctx.fillStyle=k>.7?'#6a6660':'#9a968e';ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1.6-k),0,6.28);ctx.fill()}
  else{ctx.globalAlpha=k*.8;rect(ctx,p.x,p.y,p.size,p.size,p.col||'#d8c49a')}
 }
 ctx.globalAlpha=1;
}
function ring(x,y,r,col,w=1,dash){ctx.strokeStyle=col;ctx.lineWidth=w;if(dash)ctx.setLineDash(dash);ctx.beginPath();ctx.arc(Math.round(x)+.5,Math.round(y)+.5,r,0,6.28);ctx.stroke();ctx.setLineDash([])}
function drawMarkers(){
 const pulse=(Math.sin(state.elapsed*5)+1)/2;
 // drzewa wyznaczone do wycinki: pomarańczowa obwódka i kropka farby
 for(const t of trees){if(!t.marked&&!t.assigned)continue;if(t.st!==STAND||t.falling||t.lying||!vis(t.x,t.y))continue;
  const r=crownR(t)*.62;ring(t.x,t.y,r,t.assigned?'#ffd06a':'#ff7a2e',2,t.assigned?[3,3]:null);rect(ctx,t.x-2,t.y-2,4,4,'#ff5a1e');rect(ctx,t.x-1,t.y-1,2,2,'#ffd2a8')}
 // zgłoszenia: pinezka z wykrzyknikiem
 for(const q of E.incidents){if(q.status==='done'||q.status==='gone')continue;
  const x=Math.round(q.x),y=Math.round(q.y)-18-Math.round(pulse*3),col=q.type==='fire'?'#e0482f':q.type==='quad'||q.type==='intruder'?'#e8a32e':q.type==='feed'?'#8ac0e0':'#d8c23a';
  rect(ctx,x-6,y-7,13,13,'#1d2b24');rect(ctx,x-5,y-6,11,11,col);rect(ctx,x-1,y-4,3,5,'#1d2b24');rect(ctx,x-1,y+2,3,2,'#1d2b24');rect(ctx,x,y+6,1,6,'#1d2b24');
  if(q.status!=='new')ring(q.x,q.y,10+pulse*3,'#f1e6c2',1,[2,2]);
  if(state.selected===q)ring(q.x,q.y-12,16,'#ffffff',1);
 }
 // zaznaczenie i najechanie
 const s=state.selected;
 if(s&&s.st!==undefined&&!s.dead){const r=s.st===STAND?Math.max(6,crownR(s)*.85):9;ring(s.x,s.y,r+1,'#ffffff',1);ring(s.x,s.y,r+3,'#1d2b24',1)}
 else if(s&&s.edge&&s.vol!=null){ring(s.x,s.y,24,'#ffffff',1,[4,3])}
 else if(s&&(s.pos||s.x!=null)&&!s.dead&&!s.hidden){const [x,y]=s.pos||[s.x,s.y];ring(x,y,s.pos?30:12,'#ffffff',1,[4,3])}
 if(state.box){const [[x0,y0],[x1,y1]]=state.box;ctx.strokeStyle='#ffb070';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(Math.min(x0,x1)+.5,Math.min(y0,y1)+.5,Math.abs(x1-x0),Math.abs(y1-y0));ctx.setLineDash([]);ctx.fillStyle='#ffb07018';ctx.fillRect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0),Math.abs(y1-y0))}
 const h=state.hover;if(h&&h!==s){const r=h.st===STAND?Math.max(6,crownR(h)*.85):h.plant?6:9;ring(h.x,h.y,r,state.tool==='mark'?'#ffb070':state.tool==='plant'?'#9ae07a':'#e8e4d0',1,[2,2])}
}
function nightLayer(){
 const h=cal.hour();let dark=0;
 if(h<5)dark=1;else if(h<7.5)dark=1-(h-5)/2.5;else if(h>19.5&&h<22)dark=(h-19.5)/2.5;else if(h>=22)dark=1;
 if(dark<=0)return 0;
 ctx.fillStyle=`rgba(14,22,48,${dark*.55})`;ctx.fillRect(0,0,VIEW.w,VIEW.h);
 // światła: okna leśniczówki, reflektory pojazdów
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(-Math.floor(camera.x),-Math.floor(camera.y));
 ctx.fillStyle=`rgba(255,200,110,${dark*.35})`;ctx.beginPath();ctx.arc(HOUSE.x+40,HOUSE.y+HOUSE.h+8,22,0,6.28);ctx.arc(HOUSE.x+120,HOUSE.y+HOUSE.h+6,18,0,6.28);ctx.fill();
 for(const v of E.vehicles){if(v.kind==='bike'||v.dark||(v.parked&&!v.beacon)||!vis(v.pos[0],v.pos[1],140))continue;const [x,y]=v.pos,hd=v.heading,fx=Math.sin(hd),fy=-Math.cos(hd),L=v.spec.hh,R=95;
  const g=ctx.createRadialGradient(x+fx*L,y+fy*L,4,x+fx*(L+R*.5),y+fy*(L+R*.5),R*.7);g.addColorStop(0,`rgba(255,240,190,${dark*.38})`);g.addColorStop(1,'rgba(255,240,190,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x+fx*L,y+fy*L);ctx.lineTo(x+fx*(L+R)-fy*30,y+fy*(L+R)+fx*30);ctx.lineTo(x+fx*(L+R)+fy*30,y+fy*(L+R)-fx*30);ctx.closePath();ctx.fill();
  if(v.beacon){ctx.fillStyle=`rgba(255,170,40,${dark*.4})`;ctx.beginPath();ctx.arc(x,y,16,0,6.28);ctx.fill()}}
 for(const t of E.trash)if(t.fire&&!t.dead&&vis(t.x,t.y)){ctx.fillStyle=`rgba(255,120,40,${dark*.5})`;ctx.beginPath();ctx.arc(t.x,t.y,14+t.grow*18,0,6.28);ctx.fill()}
 ctx.restore();return dark;
}
function drawFire(){
 for(const t of E.trash){if(!t.fire||t.dead||!vis(t.x,t.y))continue;const r=4+t.grow*14,fl=Math.sin(state.elapsed*18)*1.5;
  ctx.globalAlpha=.85;ctx.fillStyle='#d8442a';ctx.beginPath();ctx.ellipse(t.x,t.y,r+fl,r*.7,0,0,6.28);ctx.fill();ctx.fillStyle='#ffb04a';ctx.beginPath();ctx.ellipse(t.x,t.y-1,r*.55,r*.38,0,0,6.28);ctx.fill();ctx.globalAlpha=1}
}
export function drawWorld(){
 ctx.save();ctx.translate(-Math.floor(camera.x),-Math.floor(camera.y));
 ctx.fillStyle='#2b3b2a';ctx.fillRect(Math.floor(camera.x),Math.floor(camera.y),VIEW.w+1,VIEW.h+1);
 blitGround();blitMarks();
 if(cal.season()===3){ctx.fillStyle='rgba(234,240,246,.5)';ctx.fillRect(Math.floor(camera.x),Math.floor(camera.y),VIEW.w+1,VIEW.h+1)}
 drawForest(ctx,camera,VIEW.w,VIEW.h,'low');
 drawBase(ctx);drawTrash();drawFeeders(ctx);drawFences(ctx);drawGroundItems(ctx);drawLying();
 for(const a of E.animals)if(!a.dead)a.draw();
 for(const p of E.people)if(!p.onStand)p.draw();
 for(const v of E.vehicles)if(!v.dead)v.draw();
 drawRopes(ctx);
 drawAmbona(ctx);for(const p of E.people)if(p.onStand)p.draw();
 drawForest(ctx,camera,VIEW.w,VIEW.h,'high');
 // prześwit: zwierzęta i ludzie pod koronami widoczni jako półprzezroczyste sylwetki
 if(SETTINGS.ghosts){ctx.globalAlpha=.5;for(const a of E.animals)if(!a.dead)a.draw();for(const p of E.people)if(!p.onStand)p.draw();for(const v of E.vehicles)if(v.off&&!v.dead)v.draw();ctx.globalAlpha=1}
 drawFire();drawFalling();drawParticles();drawPlots(ctx,state.selected);drawMarkers();
 birds(ctx,state.elapsed,camera,VIEW);
 if(DEBUG.on){ctx.strokeStyle='#40e0ff';for(const e of EDGES){const A=NODES[e.a],B=NODES[e.b];ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.stroke()}}
 ctx.restore();
 const se=cal.season();
 if(se===3){ctx.fillStyle='rgba(225,235,245,.06)';ctx.fillRect(0,0,VIEW.w,VIEW.h)}
 else if(se===2){ctx.fillStyle='rgba(240,180,90,.035)';ctx.fillRect(0,0,VIEW.w,VIEW.h)}
 const h=cal.hour(),warm=h>17&&h<20?clamp(1-Math.abs(h-18.6)/1.4,0,1):0;
 if(warm>0){ctx.fillStyle=`rgba(248,150,70,${warm*.09})`;ctx.fillRect(0,0,VIEW.w,VIEW.h)}
 nightLayer();
 if(DEBUG.on){ctx.fillStyle='#000a';ctx.fillRect(2,2,190,22);ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.fillText(`FPS ${DEBUG.fps}  skala ${VIEW.scale}x  ${E.vehicles.length} poj. ${E.people.length} os. ${E.animals.length} zw.`,5,14)}
}
