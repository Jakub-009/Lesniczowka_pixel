// Poczta (0.8.1): dziennik ważnych zdarzeń („listy” w skrzynce przy bramie) + priorytety zgłoszeń i ochrona przed zawałem na wysokim tempie.
// Moduł zależy tylko od core.js, żeby można go było importować z każdego miejsca bez cykli.
import {state,toast,$,SEASONS,SEASON_DAYS} from './core.js';
// 3 = pilne (pożar, nielegalny wjazd, nocny intruz): zatrzymują przyspieszenie, 2 = zwykłe, 1 = drobne (wygasają), 0 = propozycje (bez kary)
export const PRIO={fire:3,quad:3,intruder:3,block:2,beetle:2,feed:2,trash:1,fence:0,assess:0};
export const prio=q=>PRIO[q.type]??2;
export const MAXOPEN=7;   // tyle otwartych zgłoszeń naraz; nadmiar niepilnych wygasa (z listem w skrzynce)
export const TTL={trash:2.2};   // w dniach gry, dotyczy zgłoszeń, których nikt nie ruszył
export const MAIL=[];let nid=1;
export function mail(kind,text,o={}){
 const m={id:nid++,day:state.days,kind,text,x:o.x,y:o.y,read:false};
 MAIL.unshift(m);if(MAIL.length>40)MAIL.length=40;
 if(!o.quiet)toast(text);return m;
}
export const unreadMail=()=>{let n=0;for(const m of MAIL)if(!m.read)n++;return n};
// Wraca do ×1, gdy dzieje się coś pilnego; zwraca true, jeśli faktycznie zwolniło.
export function slowDown(){if(state.rate>1){state.rate=1;const b=$('#speedbtn');if(b)b.textContent='Czas ×1';return true}return false}
export const stamp=d=>{const h=(d%1)*24,hh=Math.floor(h),mm=Math.floor((h-hh)*60);
 return 'rok '+(Math.floor(d/(4*SEASON_DAYS))+1)+' · '+SEASONS[Math.floor(d/SEASON_DAYS)%4]+' · '+String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')};
export const serializeMail=()=>MAIL.slice(0,30).map(m=>[+m.day.toFixed(3),m.kind,m.text,m.x==null?null:Math.round(m.x),m.y==null?null:Math.round(m.y),m.read?1:0]);
export function loadMail(a){MAIL.length=0;for(const [day,kind,text,x,y,read] of a||[])MAIL.push({id:nid++,day,kind,text,x:x??undefined,y:y??undefined,read:!!read})}
