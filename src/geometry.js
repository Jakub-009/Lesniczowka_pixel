// Geometria kolizji: obrócone prostokąty (OBB) i koła, z wektorem wypchnięcia (MTV).
// OBB: {x,y,hw,hh,a} — środek, półszerokość, półdługość, kąt (osie lokalne u=(cos a,sin a), v=(-sin a,cos a)).
export function obb(x,y,hw,hh,a=0){return{shape:'obb',x,y,hw,hh,a}}
export function circle(x,y,r){return{shape:'circle',x,y,r}}
export function rectToObb(r){return obb(r.x+r.w/2,r.y+r.h/2,r.w/2,r.h/2,0)}

function corners(o){
 const c=Math.cos(o.a),s=Math.sin(o.a),ux=c,uy=s,vx=-s,vy=c;
 return[[o.x+ux*o.hw+vx*o.hh,o.y+uy*o.hw+vy*o.hh],[o.x-ux*o.hw+vx*o.hh,o.y-uy*o.hw+vy*o.hh],
        [o.x-ux*o.hw-vx*o.hh,o.y-uy*o.hw-vy*o.hh],[o.x+ux*o.hw-vx*o.hh,o.y+uy*o.hw-vy*o.hh]];
}
export function obbCorners(o){return corners(o)}

// Zwraca {nx,ny,depth}: kierunek, w którym trzeba przesunąć A, żeby wyjść z B.
export function satObb(A,B){
 const ca=corners(A),cb=corners(B);
 const axes=[[Math.cos(A.a),Math.sin(A.a)],[-Math.sin(A.a),Math.cos(A.a)],[Math.cos(B.a),Math.sin(B.a)],[-Math.sin(B.a),Math.cos(B.a)]];
 let best=1e9,bx=0,by=0;
 for(const [ax,ay] of axes){
  let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;
  for(const p of ca){const d=p[0]*ax+p[1]*ay;if(d<a0)a0=d;if(d>a1)a1=d}
  for(const p of cb){const d=p[0]*ax+p[1]*ay;if(d<b0)b0=d;if(d>b1)b1=d}
  const ov=Math.min(a1,b1)-Math.max(a0,b0);
  if(ov<=0)return null;
  if(ov<best){best=ov;bx=ax;by=ay}
 }
 if((A.x-B.x)*bx+(A.y-B.y)*by<0){bx=-bx;by=-by}
 return{nx:bx,ny:by,depth:best};
}

export function obbCircle(A,c){
 const cs=Math.cos(A.a),sn=Math.sin(A.a);
 const dx=c.x-A.x,dy=c.y-A.y;
 const px=dx*cs+dy*sn,py=-dx*sn+dy*cs; // środek koła w układzie A
 const qx=Math.max(-A.hw,Math.min(A.hw,px)),qy=Math.max(-A.hh,Math.min(A.hh,py));
 let ex=px-qx,ey=py-qy;const dist=Math.hypot(ex,ey);
 let lx,ly,depth;
 if(dist>1e-6){
  if(dist>=c.r)return null;
  lx=ex/dist;ly=ey/dist;depth=c.r-dist;
 }else{ // środek koła wewnątrz prostokąta
  const ox=A.hw-Math.abs(px),oy=A.hh-Math.abs(py);
  if(ox<oy){lx=Math.sign(px)||1;ly=0;depth=c.r+ox}else{lx=0;ly=Math.sign(py)||1;depth=c.r+oy}
 }
 // kierunek od koła do A (w świecie)
 const wx=lx*cs-ly*sn,wy=lx*sn+ly*cs;
 return{nx:-wx,ny:-wy,depth};
}

// A: zawsze OBB gracza; B: obb | circle.
export function collide(A,B){return B.shape==='circle'?obbCircle(A,B):satObb(A,B)}

// Odległość punktu od odcinka.
export function distToSegment(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
 let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0;t=Math.max(0,Math.min(1,t));
 return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
}
