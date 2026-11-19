// Ochrona przyrody (0.9): gniazda rzadkich ptaków (strefy ochronne), pomniki przyrody, rezerwaty i martwe drewno.
// Moduł-liść (tylko core.js i map.js), żeby importować go z jobs/input/health/incidents bez cykli.
import {cal} from './core.js';
import {oddzial} from './map.js';
export const NAT={nests:[],reserve:[],monuments:[],log:[],bird:{},dw:0};
export const NEST_R_SMALL=55,NEST_R_BIG=160,MON_MAX=3,RES_MAX=2;
export const breeding=()=>cal.season()===0;
export const nestR=()=>breeding()?NEST_R_BIG:NEST_R_SMALL;
// 1.5.0: bocian czarny jest ptakiem wędrownym — jesienią odlatuje na zimowiska w Afryce i wraca wiosną.
// Pod jego nieobecność chronione jest tylko samo drzewo z gniazdem; wokół można normalnie pracować (np. uprzątnąć wywrot po wichurze).
export const away=sp=>sp==='stork'&&cal.season()>=2;
export const inReserve=(x,y)=>NAT.reserve.length>0&&NAT.reserve.includes(oddzial(x,y));
// 1.3.0: las „dziki” — puszcza (oddz. 104) i rezerwaty: tu pniaki odnawiają się same (samosiew), a martwe drzewa zostają w lesie
export const wildZone=(x,y)=>String(oddzial(x,y))==='104'||inReserve(x,y);
// Zwraca powód, dla którego w tym miejscu (albo na tym drzewie) nie wolno ciąć — albo null.
export function noCut(x,y,t){
 if(t&&t.nest)return 'To drzewo z gniazdem jest chronione.';
 if(t&&t.mon)return 'To drzewo jest pomnikiem przyrody i nie wolno go ściąć.';
 for(const n of NAT.nests)if(!away(n.sp)&&Math.hypot(x-n.x,y-n.y)<nestR())return 'Strefa ochronna gniazda ('+n.name+'): '+(breeding()?'w okresie lęgowym ':'')+'nie wolno prowadzić prac w promieniu '+Math.round(nestR())+' px.';
 if(inReserve(x,y))return 'Oddział '+oddzial(x,y)+' jest rezerwatem, więc obowiązuje w nim zakaz wycinki.';
 return null;
}
