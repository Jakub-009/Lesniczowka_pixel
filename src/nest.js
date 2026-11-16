// Ochrona przyrody (0.9): gniazda rzadkich ptaków (strefy ochronne), pomniki przyrody, rezerwaty i martwe drewno.
// Moduł-liść (tylko core.js i map.js), żeby importować go z jobs/input/health/incidents bez cykli.
import {cal} from './core.js';
import {oddzial} from './map.js';
export const NAT={nests:[],reserve:[],monuments:[],log:[],bird:{},dw:0};
export const NEST_R_SMALL=55,NEST_R_BIG=160,MON_MAX=3,RES_MAX=2;
export const breeding=()=>cal.season()===0;
export const nestR=()=>breeding()?NEST_R_BIG:NEST_R_SMALL;
export const inReserve=(x,y)=>NAT.reserve.length>0&&NAT.reserve.includes(oddzial(x,y));
// Zwraca powód, dla którego w tym miejscu (albo na tym drzewie) nie wolno ciąć — albo null.
export function noCut(x,y,t){
 if(t&&t.nest)return 'To drzewo z gniazdem jest chronione.';
 if(t&&t.mon)return 'Pomnik przyrody — nie wolno ścinać.';
 for(const n of NAT.nests)if(Math.hypot(x-n.x,y-n.y)<nestR())return 'Strefa ochronna gniazda ('+n.name+'): '+(breeding()?'okres lęgowy — ':'')+'bez prac w promieniu '+Math.round(nestR())+' px.';
 if(inReserve(x,y))return 'Oddział '+oddzial(x,y)+' jest rezerwatem — bez wycinki.';
 return null;
}
