// Wspólne jednostki, stan gry, kalendarz i małe funkcje rysowania (wzorzec z „Polskiej wsi”).
export const VERSION='0.1.0';
export const C=document.querySelector('#game');
export const ctx=C.getContext('2d',{alpha:false});
export const VIEW={w:640,h:360,scale:2,zoom:1,maxZoom:2};
export const $=s=>document.querySelector(s);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export function hash(x,y,z=0){let n=Math.imul(x+1289|0,374761393)^Math.imul(y+3929|0,668265263)^Math.imul(z+17|0,2147483647);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296}
export function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
export function line(g,x,y,x2,y2,c,w=1){const o=(w%2===1)?.5:0;g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(Math.round(x)+o,Math.round(y)+o);g.lineTo(Math.round(x2)+o,Math.round(y2)+o);g.stroke()}
export function poly(g,pts,col){g.fillStyle=col;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill()}
export const angDiff=(a,b)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d};
// Jeden wektor światła: cienie padają na południowy wschód.
export const LIGHT={x:.84,y:.54};
export function shadow(g,x,y,w,h,height=45){const dx=LIGHT.x*height,dy=LIGHT.y*height;poly(g,[[x+6,y+6],[x+w+6,y+6],[x+w+dx,y+h+dy],[x+dx,y+h+dy]],'#40564268')}

export const WORLD={w:2400,h:1800};
export const PX_PER_M=12;

// ── Kalendarz ──
// Doba trwa DAY_S sekund przy tempie ×1. Pora roku = SEASON_DAYS dni.
// Czas lasu jest skompresowany: każdy dzień gry to YEARS_PER_DAY lat wzrostu drzew (inaczej sadzonka nigdy by nie urosła).
export const DAY_S=180,SEASON_DAYS=10,YEARS_PER_DAY=1;
export const SEASONS=['wiosna','lato','jesień','zima'];
export const cal={
 hour:()=>(state.days%1)*24,
 season:()=>Math.floor(state.days/SEASON_DAYS)%4,
 year:()=>Math.floor(state.days/(4*SEASON_DAYS))+1,
 dayOf:()=>Math.floor(state.days%SEASON_DAYS)+1,
 night:()=>{const h=(state.days%1)*24;return h<5||h>21}
};

export const keys=new Set();
export const camera={x:0,y:0};
// Start: lato, 6. dzień, 7:00 — za kilka dni zaczyna się jesień i sezon grzybowy.
export const START_DAYS=SEASON_DAYS+5+7/24;
export const state={playing:false,paused:false,mute:true,rate:1,elapsed:0,days:START_DAYS,
 money:24500,health:82,protect:64,tool:'select',selected:null,hover:null,follow:null};
export const SETTINGS={volume:.8,hints:true,zoom:1,ghosts:true};
export const active=()=>state.playing&&!state.paused;
export const RT={last:0,acc:0,frame:0,msgT:0,hudT:0};
export const DEBUG={on:false,fps:0};
export const fx=[];
export function displayNumber(n,d=1){return n.toFixed(d).replace('.',',')}
export const zl=n=>Math.round(n).toLocaleString('pl-PL')+' zł';
export function toast(s){const m=$('#msg');m.textContent=s;m.style.opacity='1';RT.msgT=3.6}
export function particle(type,x,y,o={}){
 if(fx.length>260)return;
 fx.push({type,x,y,vx:o.vx??(Math.random()-.5)*24,vy:o.vy??(Math.random()-.5)*20-6,life:o.life??(.5+Math.random()*.4),max:o.life??.9,size:o.size??(1+Math.random()*2),col:o.col})
}
