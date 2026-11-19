// WebAudio (bez plików): wiatr w koronach, ptaki, dzięcioł, sowa nocą, piły, silniki, krótkie efekty.
import {state,camera,VIEW,SETTINGS,cal,active,toast} from './core.js';
import {E} from './ents.js';
let A=null;
function init(){
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ac=new AC(),master=ac.createGain();master.gain.value=0;
  // ogranicznik na wyjściu: głośniejsze efekty (strzał, upadek drzewa) nie przesterują
  const lim=ac.createDynamicsCompressor();lim.threshold.value=-12;lim.knee.value=6;lim.ratio.value=8;lim.attack.value=.003;lim.release.value=.2;master.connect(lim);lim.connect(ac.destination);
  const buf=ac.createBuffer(1,ac.sampleRate*1.2,ac.sampleRate),d=buf.getChannelData(0);let s=1999;for(let i=0;i<d.length;i++){s=(Math.imul(s,1664525)+1013904223)|0;d[i]=(s/2147483648)*.5}
  const noise=ac.createBufferSource();noise.buffer=buf;noise.loop=true;noise.start();
  const chain=(nodes)=>{for(let i=0;i<nodes.length-1;i++)nodes[i].connect(nodes[i+1]);return nodes[nodes.length-1]};
  const gain=v=>{const g=ac.createGain();g.gain.value=v;return g};
  const filt=(type,f,q=1)=>{const b=ac.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;return b};
  // wiatr
  const windF=filt('lowpass',380),windG=gain(.02);chain([noise,windF,windG,master]);
  // szelest liści: miękkie pasmo 700–2200 Hz (bez ostrych wysokich tonów), słychać go tylko w porywach wiatru
  const leafH=filt('highpass',700,.5),leafF=filt('lowpass',2200,.5),leafG=gain(0);chain([noise,leafH,leafF,leafG,master]);
  // piła łańcuchowa: piła + szum pasmowy
  const sawO=ac.createOscillator();sawO.type='sawtooth';sawO.frequency.value=150;sawO.start();
  const sawO2=ac.createOscillator();sawO2.type='square';sawO2.frequency.value=300;sawO2.start();   // 1.5.0: druga harmoniczna — ostrzejszy, „dwusuwowy” dźwięk
  const sawF=filt('bandpass',1400,1.4),sawG=gain(0);chain([sawO,sawF,sawG,master]);const s2G=gain(.35);sawO2.connect(s2G).connect(sawF);
  const sawN=filt('bandpass',2600,2),sawNG=gain(0);chain([noise,sawN,sawNG,master]);
  // silniki: niski pomruk (auta, ciągnik) i brzęczenie quada
  // 1.5.0: dwa lekko rozstrojone oscylatory (dudnienie jak nierówna praca cylindrów) + podharmoniczna
  const engO=ac.createOscillator();engO.type='sawtooth';engO.frequency.value=48;engO.start();
  const engO2=ac.createOscillator();engO2.type='sawtooth';engO2.frequency.value=48*1.013;engO2.start();
  const engSub=ac.createOscillator();engSub.type='triangle';engSub.frequency.value=24;engSub.start();
  const engF=filt('lowpass',260,.9),engG=gain(0);chain([engO,engF,engG,master]);engO2.connect(engF);const subG=gain(.6);engSub.connect(subG).connect(engF);
  const quadO=ac.createOscillator();quadO.type='square';quadO.frequency.value=92;quadO.start();
  const quadF=filt('bandpass',700,1.2),quadG=gain(0);chain([quadO,quadF,quadG,master]);
  A={ac,master,noise,windF,windG,leafG,gust:0,gustT:3,sawO,sawO2,sawF,sawG,sawNG,engO,engO2,engSub,engG,quadO,quadG,bird:4,wood:12,owl:20};
 }catch(e){A=null}
}
export function toggleSound(){
 if(!A)init();state.mute=!state.mute;A?.ac.resume();
 toast(state.mute?'Dźwięk wyłączony (M).':'Dźwięk włączony (M).');
}
export function resumeSound(){A?.ac.resume()}
const LOOPS=['windG','leafG','sawG','sawNG','engG','quadG'];
const inView=(x,y)=>{const cx=camera.x+VIEW.w/2,cy=camera.y+VIEW.h/2,R=Math.max(VIEW.w,VIEW.h)*.75;return Math.max(0,1-Math.hypot(x-cx,y-cy)/R)};
export function updateSound(dt){
 if(!A)return;const {ac,master}=A,t=ac.currentTime,audible=!state.mute&&!document.hidden;
 // 1.5.0: wyciszenie albo ukryta karta — płynne wygaszenie, potem wstrzymanie całego kontekstu audio (nic nie „wisi”)
 if(!audible){if(ac.state==='running'&&!A.hold){master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(0,t,.05);A.hold=setTimeout(()=>{A.hold=null;if(state.mute||document.hidden)ac.suspend()},250)}return}
 if(A.hold){clearTimeout(A.hold);A.hold=null}
 if(ac.state==='suspended'){master.gain.cancelScheduledValues(t);master.gain.setValueAtTime(0,t);ac.resume()}
 master.gain.setTargetAtTime(.9*SETTINGS.volume,t,.25);
 // pauza: tło (wiatr, piły, silniki) cichnie, a krótkie dźwięki interfejsu nadal działają
 if(!active()){for(const k of LOOPS)A[k].gain.setTargetAtTime(0,t,.08);return}
 const h=cal.hour(),night=cal.night(),se=cal.season();
 // wiatr: dwie nieskorelowane fale (okresy ~30 s i ~11 s) zamiast jednej — szum nie „pompuje” regularnie; w porywach jaśnieje (wyższe pasmo)
 const wv=.5+.3*Math.sin(state.elapsed*.21)+.2*Math.sin(state.elapsed*.57+1.3);
 A.windG.gain.setTargetAtTime(.16+.28*wv*wv,t,.6);A.windF.frequency.setTargetAtTime(300+260*wv+A.gust*220,t,.8);
 // porywy: co kilka–kilkanaście sekund liście szeleszczą przez 2–4 s, potem cisza (zimą prawie wcale)
 A.gustT-=dt;if(A.gustT<=0){A.gust=A.gust>0?0:(se===3?.15:.4+Math.random()*.6);A.gustT=A.gust>0?2+Math.random()*2:6+Math.random()*10}
 A.leafG.gain.setTargetAtTime(A.gust*.035,t,A.gust>0?.7:1.2);
 let saw=0;for(const p of E.people)if(p.pose==='saw'&&!p.hidden&&p.kind==='worker')saw=Math.max(saw,inView(p.x,p.y));
 A.sawG.gain.setTargetAtTime(saw*.5,t,.05);A.sawNG.gain.setTargetAtTime(saw*.3,t,.05);
 // piła pod obciążeniem: cykl „wejście w drewno” (obroty spadają ~20%), potem wyjście (obroty rosną) co ~1,6 s
 const rev=.5+.5*Math.sin(state.elapsed*3.9),sf=128+rev*46+Math.sin(state.elapsed*23)*3;
 A.sawO.frequency.setTargetAtTime(sf,t,.06);A.sawO2.frequency.setTargetAtTime(sf*2,t,.06);A.sawF.frequency.setTargetAtTime(1100+rev*700,t,.08);
 let eng=0,quad=0;for(const v of E.vehicles){const k=inView(v.pos[0],v.pos[1])*Math.min(1,Math.abs(v.v)/20+.15*(v.parked?0:1));if(v.kind==='quad'||v.kind==='cross')quad=Math.max(quad,k);else if(v.kind!=='bike')eng=Math.max(eng,k)}
 A.engG.gain.setTargetAtTime(eng*.12,t,.15);
 const ef=44+eng*18;A.engO.frequency.setTargetAtTime(ef,t,.3);A.engO2.frequency.setTargetAtTime(ef*1.013,t,.3);A.engSub.frequency.setTargetAtTime(ef/2,t,.3);   // obroty rosną z prędkościąA.quadG.gain.setTargetAtTime(quad*.3,t,.1);A.quadO.frequency.setTargetAtTime(88+quad*40+Math.sin(state.elapsed*5)*6,t,.08);
 A.bird-=dt;A.wood-=dt;A.owl-=dt;
 if(!night&&se!==3&&A.bird<=0){A.bird=2+Math.random()*5;chirp()}
 if(!night&&A.wood<=0){A.wood=14+Math.random()*20;drum()}
 if(night&&A.owl<=0){A.owl=12+Math.random()*16;owl()}
}
function tone(type,f0,f1,a,d,at=0){const {ac,master}=A,t=ac.currentTime+at,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(a,t+.01);g.gain.exponentialRampToValueAtTime(.00001,t+d);o.connect(g).connect(master);o.start(t);o.stop(t+d+.03)}
// Krótki szum (dzięcioł, strzał, kłoda). Wzmocnienie startuje od zera TERAZ — wcześniej do chwili startu efektu
// grało pełną głośnością (głośny szum). Po efekcie węzły są odłączane od wspólnego źródła szumu (inaczej narastały).
function burst(f,q,a,d,at=0){
 const {ac,master,noise}=A,now=ac.currentTime,t=now+at,b=ac.createBiquadFilter(),g=ac.createGain();
 b.type='bandpass';b.frequency.value=f;b.Q.value=q;
 // wąskie pasmo przepuszcza mało szumu — wyrównujemy, żeby `a` oznaczało podobną głośność dla każdego pasma
 const k=Math.min(40,1/(.29*Math.sqrt(Math.min(1,f/q/(ac.sampleRate/2)))));
 g.gain.value=0;g.gain.setValueAtTime(0,now);g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(a*k,t+.01);g.gain.exponentialRampToValueAtTime(.00001,t+d);g.gain.setValueAtTime(0,t+d+.01);
 noise.connect(b);b.connect(g);g.connect(master);A.live=(A.live||0)+1;
 setTimeout(()=>{try{noise.disconnect(b)}catch(e){}try{b.disconnect()}catch(e){}try{g.disconnect()}catch(e){}A.live--},(d+at)*1000+300);
}
// 1.5.0: trzy typy śpiewu zamiast jednego: krótkie świergoty, trel (szybkie powtórzenia) i opadająca fraza zakończona „zawijasem”
function chirp(){
 const r=Math.random(),f=1800+Math.random()*1400;
 if(r<.4){const n=2+Math.floor(Math.random()*4);for(let i=0;i<n;i++)tone('sine',f,f*(1.2+Math.random()*.3),.06+Math.random()*.04,.09,i*.13)}
 else if(r<.7){const n=6+Math.floor(Math.random()*6);for(let i=0;i<n;i++)tone('sine',f*1.1,f*.92,.05,.045,i*.06)}
 else{const n=5+Math.floor(Math.random()*3);for(let i=0;i<n;i++){const fi=f*1.35*Math.pow(.93,i);tone('sine',fi,fi*.9,.055,.08,i*.1)}tone('sine',f*.9,f*1.6,.06,.14,n*.1+.05)}
}
function drum(){for(let i=0;i<14;i++)burst(900,4,.07*(1-i/16),.03,i*.055)}
function owl(){tone('sine',380,340,.09,.35);tone('sine',390,330,.08,.6,.55)}
export function sfx(k){
 if(!A||state.mute||A.ac.state!=='running')return;
 if(!active()&&(k==='crash'||k==='creak'||k==='winch'||k==='log'||k==='shot'||k==='roar'||k==='klang'||k==='honk'||k==='uhu'))return;   // odgłosy świata nie grają w pauzie
 if(k==='crash'){burst(180,.7,.22,1.1);burst(600,.9,.12,.6,.05);tone('triangle',70,40,.3,.5)}
 else if(k==='creak')tone('sawtooth',220,90,.07,1.1);
 else if(k==='coin'){tone('sine',880,880,.12,.14);tone('sine',1320,1320,.12,.2,.1)}
 else if(k==='ping'){tone('triangle',660,660,.13,.15);tone('triangle',990,990,.13,.22,.12)}
 else if(k==='mark')tone('square',520,700,.05,.06);
 else if(k==='unmark')tone('square',600,380,.045,.06);
 else if(k==='clunk'){tone('square',130,48,.15,.14);tone('triangle',70,40,.25,.2)}
 else if(k==='winch')tone('sawtooth',90,140,.07,.9);
 else if(k==='log')burst(260,1.2,.08,.18);
 else if(k==='shot'){burst(900,.5,.25,.35);burst(200,.6,.15,.9,.05)}
 else if(k==='roar'){roar()}
 // 1.5.1: klangor żurawi (trąbiące „krruu” kilku ptaków), gęgawy i pohukiwanie puchacza („bu-ho”)
 else if(k==='klang'){for(let i=0;i<4;i++){const f=480+Math.random()*120,d=i*.24+Math.random()*.1;tone('sawtooth',f,f*.88,.03,.26,d);tone('triangle',f*1.5,f*1.3,.02,.22,d+.02)}}
 else if(k==='honk'){for(let i=0;i<5;i++){const f=270+Math.random()*60,d=i*.17+Math.random()*.06;tone('square',f,f*.85,.022,.11,d)}}
 else if(k==='uhu'){tone('sine',330,300,.09,.32);tone('sine',305,280,.08,.42,.55)}
 else if(k==='door'){tone('triangle',300,240,.1,.12);tone('triangle',240,200,.08,.12,.12)}
}
// Ryk byka na rykowisku: niski, chrapliwy, opadający ton z szumem.
function roar(){
 const {ac,master}=A,t=ac.currentTime;
 for(const [f0,f1,a,d,at] of [[120,180,.22,.9,0],[180,95,.28,1.6,.85]]){
  const o=ac.createOscillator(),g=ac.createGain(),b=ac.createBiquadFilter();o.type='sawtooth';b.type='lowpass';b.frequency.value=520;
  o.frequency.setValueAtTime(f0,t+at);o.frequency.linearRampToValueAtTime(f1,t+at+d);g.gain.setValueAtTime(.00001,t+at);g.gain.linearRampToValueAtTime(a,t+at+.15);g.gain.exponentialRampToValueAtTime(.00001,t+at+d);
  o.connect(b).connect(g).connect(master);o.start(t+at);o.stop(t+at+d+.05)}
 burst(300,.8,.03,2.2,.1);
}
